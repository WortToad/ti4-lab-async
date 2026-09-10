import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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
});
