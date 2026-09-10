import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Draft } from "~/types";

const directory = mkdtempSync(join(tmpdir(), "ti4-base-lobby-"));
let service: typeof import("./baseDraftLobby.server");
let drafts: typeof import("./draft.server");
let sync: typeof import("./baseDraftSync.server");
vi.mock("~/utils/imageJobQueue.server", () => ({ enqueueImageJob: vi.fn() }));

beforeAll(async () => {
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(
    join(directory, "draft.sqlite"),
  ).href;
  service = await import("./baseDraftLobby.server");
  drafts = await import("./draft.server");
  sync = await import("./baseDraftSync.server");
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function fixture(): Draft {
  return {
    settings: {
      type: "milty",
      factionGameSets: ["base", "pok"],
      tileGameSets: ["base", "pok"],
      numFactions: 2,
      numSlices: 2,
      draftSpeaker: true,
      randomizeMap: false,
      randomizeSlices: false,
      allowEmptyTiles: false,
      allowHomePlanetSearch: false,
    },
    integrations: {},
    players: [
      { id: 1, name: "Second" },
      { id: 0, name: "First" },
    ],
    pickOrder: [0, 1, 1, 0],
    selections: [],
    slices: [],
    presetMap: [],
    availableFactions: ["arborec", "sol"],
  };
}
async function request(id: string, player?: string, admin?: string) {
  const cookies = await Promise.all([
    player ? service.baseCookie(id).serialize(player) : "",
    admin ? service.baseCookie(id, "admin").serialize(admin) : "",
  ]);
  return new Request(`http://localhost/draft/${id}`, {
    headers: {
      Cookie: cookies
        .filter(Boolean)
        .map((value) => value.split(";")[0])
        .join("; "),
    },
  });
}
async function joinedRoom() {
  const created = await drafts.createDraft(fixture());
  const admin = await request(created.id, undefined, created.adminUuid);
  const first = await service.mutateBaseLobby(
    created.id,
    await request(created.id),
    { type: "join", playerId: 0, name: "Alice" },
  );
  const second = await service.mutateBaseLobby(
    created.id,
    await request(created.id),
    { type: "join", playerId: 1, name: "Bob" },
  );
  await service.mutateBaseLobby(created.id, admin, { type: "start" });
  return {
    ...created,
    admin,
    alice: first.issued!.uuid,
    bob: second.issued!.uuid,
  };
}

describe("managed base draft lobbies", () => {
  it("lets separate players claim distinct free slots from the same loaded lobby revision", async () => {
    const room = await drafts.createDraft(fixture());
    const anonymous = await request(room.id);
    const joined = await Promise.all([
      service.mutateBaseLobby(
        room.id,
        anonymous,
        { type: "join", playerId: 0, name: "Alice" },
        0,
      ),
      service.mutateBaseLobby(
        room.id,
        anonymous,
        { type: "join", playerId: 1, name: "Bob" },
        0,
      ),
    ]);
    expect(joined.every((result) => result.issued?.role === "player")).toBe(
      true,
    );
    expect(
      service.getBaseLobby(room.id)!.slots.every((slot) => !!slot.uuid),
    ).toBe(true);
    expect(
      (
        await service.mutateBaseLobby(
          room.id,
          anonymous,
          { type: "recover", uuid: joined[0].issued!.uuid },
          0,
        )
      ).issued?.uuid,
    ).toBe(joined[0].issued!.uuid);
  });
  it("creates a hidden waiting lobby with ordered non-seating slots and requires all joins", async () => {
    const created = await drafts.createDraft(fixture());
    const spectator = await request(created.id);
    const lobby = service.getBaseLobby(created.id)!;
    const view = service.baseLobbyView(
      lobby,
      await service.readBaseViewer(created.id, spectator),
    );
    expect(view.started).toBe(false);
    expect(view.slots.map((slot) => slot.id)).toEqual([0, 1]);
    expect(view.slots.every((slot) => !slot.claimed && !slot.uuid)).toBe(true);
    expect(JSON.stringify(view)).not.toContain(created.adminUuid);
    const host = await request(created.id, undefined, created.adminUuid);
    await expect(
      service.mutateBaseLobby(created.id, host, { type: "start" }),
    ).rejects.toThrow(/Every player/);
    const results = await Promise.allSettled(
      ["Alice", "Mallory"].map(async (name) =>
        service.mutateBaseLobby(created.id, spectator, {
          type: "join",
          playerId: 0,
          name,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      service.getBaseLobby(created.id)!.slots.find((slot) => slot.id === 0)!
        .name,
    ).toBe("Alice");
  });

  it("supports admin and player identity together, global UUID recovery, and slot ownership", async () => {
    const room = await joinedRoom();
    const playerAdmin = await request(room.id, room.alice, room.adminUuid);
    expect(await service.readBaseViewer(room.id, playerAdmin)).toMatchObject({
      isAdmin: true,
      playerId: 0,
      uuid: room.alice,
      adminUuid: room.adminUuid,
    });
    expect(service.findBaseRecovery(room.alice)).toEqual({
      id: room.id,
      role: "player",
    });
    expect(
      (
        await service.mutateBaseLobby(room.id, await request(room.id), {
          type: "recover",
          uuid: room.alice,
        })
      ).issued,
    ).toEqual({ role: "player", uuid: room.alice });
    await expect(
      service.requireBasePlayer(room.id, playerAdmin, 1),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.requireBasePlayer(room.id, room.admin, 0),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.requireBasePlayer(room.id, playerAdmin, 0),
    ).resolves.toBeUndefined();
  });

  it("admin management never projects other hands, future deals, or private staged values", () => {
    const draft = fixture();
    draft.settings.adminPassword = "old-password";
    draft.stagedSelections = {
      texasBlueKeep1: { 0: "26", 1: "secret-staged" },
    };
    draft.texasDraft = {
      seatOrder: [0, 1],
      seatAssignments: { 0: 0, 1: 1 },
      speakerId: 0,
      factionOptions: { 0: ["sol"], 1: ["arborec"] },
      factionDrawPile: ["hacan"],
      initialFactionOptions: { 1: ["arborec"] },
      tileHands: { blue: { 0: ["26"], 1: ["27"] }, red: {} },
      initialTileHands: { blue: { 1: ["28"] }, red: {} },
      tileKeeps: { blue: { 1: ["29"] }, red: {} },
      playerTiles: { 0: ["26"], 1: ["30"] },
    };
    draft.selections = [
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasBlueKeep1",
        selections: [
          { playerId: 0, value: "26" },
          { playerId: 1, value: "29" },
        ],
      },
    ];
    const player = service.projectBaseDraft(draft, 0);
    expect(player.texasDraft?.tileHands?.blue).toEqual({ 0: ["26"] });
    expect(player.texasDraft?.factionDrawPile).toBeUndefined();
    expect(player.texasDraft?.initialTileHands).toBeUndefined();
    expect(player.stagedSelections?.texasBlueKeep1).toEqual({
      0: "26",
      1: "__ready__",
    });
    expect(player.settings.adminPassword).toBeUndefined();
    expect(JSON.stringify(player)).not.toContain("secret-staged");
    expect(service.projectBaseDraft(draft).texasDraft?.tileHands?.blue).toEqual(
      {},
    );
    expect(draft.texasDraft.tileHands!.blue[1]).toEqual(["27"]);
  });

  it("exports opaque saves, restores previous turns paused, and rejects another room's save", async () => {
    const room = await joinedRoom();
    const saved = await service.mutateBaseLobby(room.id, room.admin, {
      type: "export",
    });
    expect(saved.backup).not.toContain("arborec");
    expect(saved.backup).not.toContain(room.alice);
    const before = await drafts.draftById(room.id);
    const next = sync.applyBaseSelection(
      JSON.parse(before.data as string),
      { type: "SELECT_FACTION", playerId: 0, factionId: "arborec" },
      0,
    );
    await drafts.updateDraft(room.id, next, before.data as string);
    expect(service.getBaseLobby(room.id)!.checkpoints.length).toBeGreaterThan(
      1,
    );
    await service.mutateBaseLobby(room.id, room.admin, {
      type: "import",
      state: saved.backup!,
    });
    expect(service.getBaseLobby(room.id)!.paused).toBe(true);
    expect(
      JSON.parse((await drafts.draftById(room.id)).data as string).selections,
    ).toEqual([]);
    expect(service.findBaseRecovery(room.alice)?.id).toBe(room.id);
    const other = await joinedRoom();
    await expect(
      service.mutateBaseLobby(other.id, other.admin, {
        type: "import",
        state: saved.backup!,
      }),
    ).rejects.toThrow(/another lobby/);
  });

  it("replaces disconnected players without losing picks and invalidates old UUIDs", async () => {
    const room = await joinedRoom();
    await service.mutateBaseLobby(room.id, room.admin, {
      type: "release",
      playerId: 1,
    });
    expect(service.getBaseLobby(room.id)!.paused).toBe(true);
    expect(service.findBaseRecovery(room.bob)).toBeUndefined();
    await expect(
      service.mutateBaseLobby(room.id, room.admin, { type: "resume" }),
    ).rejects.toThrow(/Fill all slots/);
    const replacement = await service.mutateBaseLobby(
      room.id,
      await request(room.id),
      { type: "join", playerId: 1, name: "Charlie" },
    );
    await service.mutateBaseLobby(room.id, room.admin, { type: "resume" });
    expect(
      (
        await service.readBaseViewer(
          room.id,
          await request(room.id, replacement.issued!.uuid),
        )
      ).playerId,
    ).toBe(1);
    await service.mutateBaseLobby(room.id, room.admin, {
      type: "rotate",
      playerId: 1,
    });
    expect(service.findBaseRecovery(replacement.issued!.uuid)).toBeUndefined();
  });

  it("rejects wrong-turn selections and stale concurrent writes", async () => {
    const room = await joinedRoom();
    const before = await drafts.draftById(room.id);
    const draft = JSON.parse(before.data as string) as Draft;
    expect(() =>
      sync.applyBaseSelection(
        draft,
        { type: "SELECT_FACTION", playerId: 1, factionId: "sol" },
        1,
      ),
    ).toThrow(/Wait for your turn/);
    const next = sync.applyBaseSelection(
      draft,
      { type: "SELECT_FACTION", playerId: 0, factionId: "sol" },
      0,
    );
    await drafts.updateDraft(room.id, next, before.data as string);
    expect(() =>
      drafts.updateDraft(room.id, next, before.data as string),
    ).toThrow();
    expect(
      JSON.parse((await drafts.draftById(room.id)).data as string).selections,
    ).toHaveLength(1);
  });
});
