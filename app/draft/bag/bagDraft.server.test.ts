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
  it("keeps the lobby hidden until everyone claims a slot and the admin starts", async () => {
    const room = await service.createBagDraft({
      variant: "inaugural_splice",
      players: ["Slot 1", "Slot 2"],
    });
    const spectator = await service.getBagDraftView(room.id);
    expect(spectator.phase).toBe("lobby");
    expect(spectator.privateSeat).toBeUndefined();
    expect(
      spectator.lobby.slots.every((slot) => !slot.claimed && !slot.uuid),
    ).toBe(true);
    expect(JSON.stringify(spectator)).not.toContain("TECH:");
    const host = await service.getBagDraftView(
      room.id,
      undefined,
      room.adminToken,
    );
    expect(host.viewer.isAdmin).toBe(true);
    expect(host.privateSeat).toBeUndefined();
    expect(host.lobby.adminUuid).toBe(room.adminToken);
    await expect(
      service.mutateBagDraft(
        room.id,
        undefined,
        { action: "start", revision: host.revision },
        room.adminToken,
      ),
    ).rejects.toThrow(/Every slot/);
    const { uuid } = await service.joinBagDraft(room.id, 0, " Alice ");
    expect(uuid).toMatch(/^[a-f0-9-]{36}$/);
    expect(await service.recoverBagDraft(room.id, uuid)).toEqual({
      role: "player",
    });
    expect(await service.recoverBagDraft(room.id, room.adminToken)).toEqual({
      role: "admin",
    });
    expect(service.findBagLobby(uuid)).toEqual({ id: room.id, role: "player" });
    const waiting = await service.getBagDraftView(room.id, uuid);
    expect(waiting.privateSeat).toBeUndefined();
    expect(waiting.lobby.ownUuid).toBe(uuid);
    expect(waiting.lobby.slots[0].name).toBe("Alice");
    expect(JSON.stringify(waiting)).not.toContain("TECH:");
    await expect(service.joinBagDraft(room.id, 0, "Eve")).rejects.toThrow(
      /taken/,
    );
    await expect(
      service.joinBagDraft(room.id, 1, "Alice again", uuid),
    ).rejects.toThrow(/already have a slot/);
    await expect(
      service.mutateBagDraft(room.id, uuid, {
        action: "pick",
        round: 0,
        itemIds: [],
      }),
    ).rejects.toThrow(/admin to start/);
    await service.joinBagDraft(room.id, 1, "Bob");
    const full = await service.getBagDraftView(room.id, uuid, room.adminToken);
    const started = await service.mutateBagDraft(
      room.id,
      uuid,
      { action: "start", revision: full.revision },
      room.adminToken,
    );
    expect(started.phase).toBe("drafting");
    expect(started.viewer).toEqual({ isAdmin: true, playerId: 0 });
    expect(started.privateSeat?.bag).toHaveLength(7);
    expect(started.lobby.slots.every((slot) => !!slot.uuid)).toBe(true);
    const player = await service.getBagDraftView(room.id, uuid);
    expect(player.lobby.slots.every((slot) => !slot.uuid)).toBe(true);
    expect(player.players.every((seat) => seat.keptItems === undefined)).toBe(
      true,
    );
    expect(JSON.stringify(player)).not.toContain(room.adminToken);
    expect(
      (await service.getBagDraftView(room.id, undefined, room.adminToken))
        .privateSeat,
    ).toBeUndefined();
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

  it("claims a contested slot once, exchanges recovery UUIDs into role cookies, and clears revoked access", async () => {
    const room = await service.createBagDraft({
      variant: "inaugural_splice",
      players: ["Slot 1", "Slot 2"],
    });
    const attempts = await Promise.allSettled([
      service.joinBagDraft(room.id, 0, "Alice"),
      service.joinBagDraft(room.id, 0, "Bob"),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    const key = (await service.getBagDraftView(room.id, room.adminToken)).lobby
      .slots[0].uuid!;
    const route = await import("~/routes/draft.bag.$id");
    const result = await route.action({
      request: new Request(`http://localhost/draft/bag/${room.id}`, {
        method: "POST",
        body: new URLSearchParams({
          operation: JSON.stringify({ action: "recover", uuid: key }),
        }),
      }),
      params: { id: room.id },
      context: {},
      unstable_pattern: "/draft/bag/:id",
    });
    const cookie = new Headers(result.init?.headers).get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(
      await service.readBagToken(
        room.id,
        new Request("http://localhost", {
          headers: { Cookie: cookie.split(";")[0] },
        }),
      ),
    ).toBe(key);
    const host = await service.getBagDraftView(room.id, room.adminToken);
    await service.mutateBagDraft(
      room.id,
      undefined,
      { action: "rotate", playerId: 0, revision: host.revision },
      room.adminToken,
    );
    const revoked = await route.loader({
      request: new Request(`http://localhost/draft/bag/${room.id}`, {
        headers: { Cookie: cookie.split(";")[0] },
      }),
      params: { id: room.id },
      context: {},
      unstable_pattern: "/draft/bag/:id",
    });
    if (revoked instanceof Response)
      throw new Error("Expected recovered lobby data");
    expect(revoked.data.viewer.playerId).toBeUndefined();
    expect(revoked.data.accessError).toContain("UUID has changed");
    expect(new Headers(revoked.init?.headers).get("Set-Cookie")).toContain(
      "Max-Age=0",
    );
    const legacy = await route.loader({
      request: new Request(
        `http://localhost/draft/bag/${room.id}?key=${room.adminToken}`,
      ),
      params: { id: room.id },
      context: {},
      unstable_pattern: "/draft/bag/:id",
    });
    expect(legacy).toBeInstanceOf(Response);
    if (!(legacy instanceof Response))
      throw new Error("Expected credential exchange redirect");
    expect(legacy.headers.get("Location")).toBe(`/draft/bag/${room.id}`);
    expect(legacy.headers.get("Set-Cookie")).toContain(`bag-admin-${room.id}`);
  });

  it("restores encrypted checkpoints and last actions without exposing private picks", async () => {
    const room = await startedFixture();
    const player = await service.getBagDraftView(room.id, room.keys[0]);
    const save = await service.exportBagDraft(
      room.id,
      undefined,
      room.adminToken,
    );
    expect(JSON.parse(save)).toMatchObject({
      format: "ti4-lobby-save",
      mode: "bag",
      roomId: room.id,
    });
    expect(save).not.toContain(player.privateSeat!.bag[0].id);
    expect(save).not.toContain(room.keys[0]);
    await expect(
      service.exportBagDraft(room.id, room.keys[0]),
    ).rejects.toMatchObject({ status: 403 });
    const picked = await service.mutateBagDraft(room.id, room.keys[0], {
      action: "pick",
      round: 0,
      itemIds: [player.privateSeat!.draftableItemIds[0]],
    });
    const reverted = await service.mutateBagDraft(
      room.id,
      undefined,
      { action: "undoAction", revision: picked.revision },
      room.adminToken,
    );
    expect(reverted.players.every((player) => player.draftedCount === 0)).toBe(
      true,
    );
    expect(reverted.lobby.paused).toBe(true);
    const resumed = await service.mutateBagDraft(
      room.id,
      undefined,
      { action: "resume", revision: reverted.revision },
      room.adminToken,
    );
    await service.mutateBagDraft(room.id, room.keys[0], {
      action: "pick",
      round: resumed.round,
      itemIds: [player.privateSeat!.draftableItemIds[0]],
    });
    const current = await service.getBagDraftView(room.id, room.adminToken);
    const restored = await service.mutateBagDraft(
      room.id,
      undefined,
      { action: "importState", state: save, revision: current.revision },
      room.adminToken,
    );
    expect(restored.players.every((player) => player.draftedCount === 0)).toBe(
      true,
    );
    expect(restored.lobby.paused).toBe(true);
    expect(
      restored.lobby.checkpoints!.some((point) =>
        point.label.includes("before restoring"),
      ),
    ).toBe(true);
    const tampered = JSON.parse(save);
    tampered.data = "damaged";
    await expect(
      service.mutateBagDraft(
        room.id,
        undefined,
        {
          action: "importState",
          state: JSON.stringify(tampered),
          revision: restored.revision,
        },
        room.adminToken,
      ),
    ).rejects.toThrow(/damaged/);
    const other = await startedFixture();
    await expect(
      service.mutateBagDraft(
        other.id,
        undefined,
        {
          action: "importState",
          state: save,
          revision: (await service.getBagDraftView(other.id)).revision,
        },
        other.adminToken,
      ),
    ).rejects.toThrow(/another lobby/);
  });

  it("preserves simultaneous confirmations and rejects stale repeats", async () => {
    const room = await startedFixture();
    const keys = room.keys;
    const initialRevision = (await service.getBagDraftView(room.id)).revision;
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
    expect(reloaded.revision).toBe(initialRevision + 2);
  });

  it("creates the map on the last confirmation and opens it explicitly with each viewer’s access", async () => {
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
      confirmations.every(
        (result) => !(result instanceof Response) && result.data.error === null,
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
    expect(mantisTokenHash(hostAccess.adminToken!)).toBe(map.hostTokenHash);
    const viewers = [
      { key: undefined, host: false, players: [] },
      ...fixture.keys.map((key, id) => ({ key, host: false, players: [id] })),
      { key: fixture.adminToken, host: true, players: [] },
    ];
    for (const viewer of viewers) {
      const cookie = viewer.key
        ? await service
            .bagCookie(fixture.id, viewer.host ? "admin" : "player")
            .serialize(viewer.key)
        : "";
      const redirected = await bagRoute.loader({
        request: new Request(
          `http://localhost/draft/bag/${fixture.id}.data?map=1`,
          { headers: { Cookie: cookie.split(";")[0] } },
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
      const mapCookie = redirected.headers.get("Set-Cookie");
      if (!viewer.key) expect(mapCookie).toBeNull();
      const mapView = await mantisRoute.loader({
        request: new Request(`http://localhost/draft/mantis/${map.id}.data`, {
          headers: { Cookie: mapCookie?.split(";")[0] ?? "" },
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
      if (!viewer.host) {
        expect(JSON.stringify(bagView)).not.toContain(hostAccess.adminToken);
        expect(JSON.stringify(mapView)).not.toContain(hostAccess.adminToken);
      }
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
  const room = await startedFixture(variant, ["Alice", "Bob", "Carol"]);
  const keys = room.keys;
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

async function startedFixture(
  variant: BagVariant = "inaugural_splice",
  players = ["Alice", "Bob"],
) {
  const room = await service.createBagDraft({
    variant,
    players: players.map((_, index) => `Slot ${index + 1}`),
    shufflePlayers: false,
  });
  const keys: string[] = [];
  for (const [index, name] of players.entries())
    keys.push((await service.joinBagDraft(room.id, index, name)).uuid);
  const lobby = await service.getBagDraftView(room.id);
  await service.mutateBagDraft(
    room.id,
    undefined,
    { action: "start", revision: lobby.revision },
    room.adminToken,
  );
  return { ...room, keys };
}
