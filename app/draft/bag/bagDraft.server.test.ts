import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { applyBagAction, assemblyOptions } from "./engine";
import type { BagDraftState, BagVariant } from "./types";

const directory = mkdtempSync(join(tmpdir(), "ti4-bag-test-"));
let service: typeof import("./bagDraft.server");

beforeAll(async () => {
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(
    join(directory, "draft.sqlite"),
  ).href;
  service = await import("./bagDraft.server");
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("persistent private bag drafts", () => {
  it("migrates a fresh database and exposes only the viewer's private hand", async () => {
    const room = await service.createBagDraft({
      variant: "inaugural_splice",
      players: ["Alice", "Bob"],
    });
    const spectator = await service.getBagDraftView(room.id);
    expect(spectator.privateSeat).toBeUndefined();
    expect(spectator.seatLinks).toBeUndefined();
    expect(JSON.stringify(spectator)).not.toContain("TECH:");
    const host = await service.getBagDraftView(room.id, room.adminToken);
    expect(host.viewer.isAdmin).toBe(true);
    expect(host.privateSeat).toBeUndefined();
    expect(host.seatLinks).toHaveLength(2);
    const key = new URL(
      host.seatLinks![0].path,
      "http://localhost",
    ).searchParams.get("key")!;
    const player = await service.getBagDraftView(room.id, key);
    expect(player.privateSeat?.bag).toHaveLength(7);
    expect(player.seatLinks).toBeUndefined();
    expect(player.players.every((seat) => seat.keptItems === undefined)).toBe(
      true,
    );
    expect(JSON.stringify(player)).not.toContain(room.adminToken);
    await expect(
      service.getBagDraftView(room.id, "wrong-key"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.mutateBagDraft(room.id, undefined, {
        action: "pick",
        round: 0,
        itemIds: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("preserves simultaneous confirmations and rejects stale repeats", async () => {
    const room = await service.createBagDraft({
      variant: "inaugural_splice",
      players: ["Alice", "Bob"],
    });
    const host = await service.getBagDraftView(room.id, room.adminToken);
    const keys = host.seatLinks!.map(
      (link) => new URL(link.path, "http://localhost").searchParams.get("key")!,
    );
    const views = await Promise.all(
      keys.map((key) => service.getBagDraftView(room.id, key)),
    );
    await Promise.all(
      keys.map((key, index) =>
        service.mutateBagDraft(room.id, key, {
          action: "pick",
          round: 0,
          itemIds: [views[index].privateSeat!.draftableItemIds[0]],
        }),
      ),
    );
    const result = await service.getBagDraftView(room.id);
    expect(result.round).toBe(1);
    expect(result.players.map((player) => player.draftedCount)).toEqual([1, 1]);
    await expect(
      service.mutateBagDraft(room.id, keys[0], {
        action: "pick",
        round: 0,
        itemIds: [views[0].privateSeat!.draftableItemIds[0]],
      }),
    ).rejects.toThrow(/passed/);
    const reloaded = await service.getBagDraftView(room.id, keys[0]);
    expect(reloaded.privateSeat!.hand).toHaveLength(1);
    expect(reloaded.revision).toBe(2);
  });

  it("starts on the last confirmation and redirects every viewer with their own access", async () => {
    const fixture = await assemblyFixture();
    const bagRoute = await import("~/routes/draft.bag.$id");
    const mantisRoute = await import("~/routes/draft.mantis.$id");
    const { getMantisRoom, mantisTokenHash } = await import(
      "~/drizzle/mantisDraft.server"
    );
    const { db } = await import("~/drizzle/config.server");
    const { mantisDrafts } = await import("~/drizzle/schema.server");
    const roomCount = db.select().from(mantisDrafts).all().length;
    await service.mutateBagDraft(
      fixture.id,
      fixture.keys[0],
      fixture.selections[0],
    );
    expect(
      (await service.getBagDraftView(fixture.id)).mapRoomId,
    ).toBeUndefined();
    expect(
      await service.getBagMapAccess(fixture.id, fixture.keys[0]),
    ).toBeUndefined();

    const confirmations = await Promise.all(
      fixture.keys.slice(1).map((key, i) =>
        bagRoute.action({
          request: new Request(
            `http://localhost/draft/bag/${fixture.id}?key=${key}`,
            {
              method: "POST",
              body: new URLSearchParams({
                operation: JSON.stringify(fixture.selections[i + 1]),
              }),
            },
          ),
          params: { id: fixture.id },
          context: {},
          unstable_pattern: "/draft/bag/:id",
        }),
      ),
    );
    expect(
      confirmations.some(
        (result) => result instanceof Response && result.status === 302,
      ),
    ).toBe(true);
    const view = await service.getBagDraftView(fixture.id);
    expect(view.phase).toBe("complete");
    expect(view.mapRoomId).toBeTruthy();
    expect(db.select().from(mantisDrafts).all()).toHaveLength(roomCount + 1);
    const map = getMantisRoom(view.mapRoomId!);
    expect(map.room.draft).toMatchObject({
      phase: "build",
      mapType: "milty3p",
      bagDraftId: fixture.id,
    });
    const hostAccess = (await service.getBagMapAccess(
      fixture.id,
      fixture.adminToken,
    ))!;
    expect(mantisTokenHash(hostAccess.token!)).toBe(map.hostTokenHash);
    const viewers = [
      { key: undefined, host: false, players: [] },
      ...fixture.keys.map((key, id) => ({ key, host: false, players: [id] })),
      { key: fixture.adminToken, host: true, players: [] },
    ];
    for (const viewer of viewers) {
      const search = viewer.key ? `?key=${viewer.key}` : "";
      const redirected = await bagRoute.loader({
        request: new Request(
          `http://localhost/draft/bag/${fixture.id}.data${search}`,
        ),
        params: { id: fixture.id },
        context: {},
        unstable_pattern: "/draft/bag/:id",
      });
      expect(redirected).toBeInstanceOf(Response);
      if (!(redirected instanceof Response))
        throw new Error("Expected a map redirect");
      expect(redirected.headers.get("Location")).toBe(
        `/draft/mantis/${map.id}`,
      );
      const cookie = redirected.headers.get("Set-Cookie");
      if (!viewer.key) expect(cookie).toBeNull();
      const mapView = await mantisRoute.loader({
        request: new Request(`http://localhost/draft/mantis/${map.id}.data`, {
          headers: { Cookie: cookie?.split(";")[0] ?? "" },
        }),
        params: { id: map.id },
        context: {},
        unstable_pattern: "/draft/mantis/:id",
      });
      expect(mapView.data.isHost).toBe(viewer.host);
      expect(mapView.data.ownPlayers).toEqual(viewer.players);
      const bagView = await service.getBagDraftView(fixture.id, viewer.key);
      expect(bagView.mapRoomId).toBe(map.id);
      expect(bagView.canUndoRound).toBe(false);
      expect(JSON.stringify(bagView)).not.toContain(hostAccess.token);
      expect(JSON.stringify(mapView)).not.toContain(hostAccess.token);
    }
    expect(db.select().from(mantisDrafts).all()).toHaveLength(roomCount + 1);
    const summary = await bagRoute.loader({
      request: new Request(
        `http://localhost/draft/bag/${fixture.id}?results=1`,
      ),
      params: { id: fixture.id },
      context: {},
      unstable_pattern: "/draft/bag/:id",
    });
    expect(summary).not.toBeInstanceOf(Response);
    if (summary instanceof Response)
      throw new Error("Expected the faction summary");
    expect(
      summary.data.players.every((player) => player.keptItems?.length),
    ).toBe(true);
    await expect(
      service.getBagMapAccess(fixture.id, "wrong-key"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.mutateBagDraft(fixture.id, fixture.keys[0], { action: "reopen" }),
    ).rejects.toThrow(/Map building has started/);
  });

  it("keeps a draft without map tiles complete and explains the separate map setup", async () => {
    const fixture = await assemblyFixture("inaugural_splice");
    for (const [index, key] of fixture.keys.entries())
      await service.mutateBagDraft(fixture.id, key, fixture.selections[index]);
    const view = await service.getBagDraftView(fixture.id);
    expect(view.phase).toBe("complete");
    expect(view.mapRoomId).toBeUndefined();
    expect(view.mapBuildError).toContain("does not include map tiles");
    expect(
      await service.getBagMapAccess(fixture.id, fixture.keys[0]),
    ).toBeUndefined();
  });

  it("automatically resumes an eligible draft completed before automatic map setup", async () => {
    const fixture = await assemblyFixture();
    let state = fixture.state;
    for (const [index, selection] of fixture.selections.entries())
      state = applyBagAction(state, index, selection);
    const { db } = await import("~/drizzle/config.server");
    const { bagDrafts } = await import("~/drizzle/schema.server");
    db.update(bagDrafts)
      .set({ data: JSON.stringify(state), revision: state.revision })
      .where(eq(bagDrafts.id, fixture.id))
      .run();
    const views = await Promise.all(
      fixture.keys.map((key) => service.getBagDraftView(fixture.id, key)),
    );
    expect(views[0].mapRoomId).toBeTruthy();
    expect(new Set(views.map((view) => view.mapRoomId)).size).toBe(1);
    expect(views.every((view) => view.revision === state.revision + 1)).toBe(
      true,
    );
  });

  it("rolls back both the last confirmation and the room if map creation fails", async () => {
    const fixture = await assemblyFixture();
    for (let i = 0; i < 2; i++)
      await service.mutateBagDraft(
        fixture.id,
        fixture.keys[i],
        fixture.selections[i],
      );
    const { db } = await import("~/drizzle/config.server");
    const { mantisDrafts } = await import("~/drizzle/schema.server");
    const mantis = await import("~/drizzle/mantisDraft.server");
    const roomCount = db.select().from(mantisDrafts).all().length;
    const createRoom = mantis.createMantisRoomFromState;
    const failure = vi
      .spyOn(mantis, "createMantisRoomFromState")
      .mockImplementation((...args) => {
        createRoom(...args);
        throw new Error("Map creation failed");
      });
    try {
      await expect(
        service.mutateBagDraft(
          fixture.id,
          fixture.keys[2],
          fixture.selections[2],
        ),
      ).rejects.toThrow("Map creation failed");
      expect(db.select().from(mantisDrafts).all()).toHaveLength(roomCount);
      const view = await service.getBagDraftView(fixture.id, fixture.keys[2]);
      expect(view.phase).toBe("assembling");
      expect(view.privateSeat!.finished).toBe(false);
    } finally {
      failure.mockRestore();
    }
    const view = await service.mutateBagDraft(
      fixture.id,
      fixture.keys[2],
      fixture.selections[2],
    );
    expect(view.mapRoomId).toBeTruthy();
    expect(db.select().from(mantisDrafts).all()).toHaveLength(roomCount + 1);
  });
});

async function assemblyFixture(variant: BagVariant = "twilights_fall") {
  const room = await service.createBagDraft({
    variant,
    players: ["Alice", "Bob", "Carol"],
  });
  const host = await service.getBagDraftView(room.id, room.adminToken);
  const keys = host.seatLinks!.map(
    (link) => new URL(link.path, "http://localhost").searchParams.get("key")!,
  );
  const { db } = await import("~/drizzle/config.server");
  const { bagDrafts } = await import("~/drizzle/schema.server");
  const row = db
    .select()
    .from(bagDrafts)
    .where(eq(bagDrafts.id, room.id))
    .get()!;
  const state = JSON.parse(row.data) as BagDraftState;
  // Seed completed hands; the end-to-end rules test covers every bag pass.
  state.phase = "assembling";
  for (const seat of state.seats) {
    seat.hand = seat.bag;
    seat.bag = [];
  }
  const selections = state.seats.map((seat) => {
    const options = assemblyOptions(state, seat);
    return {
      action: "assemble" as const,
      itemIds: Object.entries(state.rules.keepLimits).flatMap(
        ([category, limit]) =>
          options
            .filter((item) => item.category === category)
            .slice(0, limit)
            .map((item) => item.id),
      ),
    };
  });
  db.update(bagDrafts)
    .set({ data: JSON.stringify(state), revision: state.revision })
    .where(eq(bagDrafts.id, room.id))
    .run();
  return { ...room, keys, selections, state };
}
