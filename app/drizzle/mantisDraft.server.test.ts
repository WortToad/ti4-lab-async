import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import {
  createMantisMapBuild,
  type MantisSettings,
} from "~/draft/mantis/engine";
import { systemData } from "~/data/systemData";

const settings: MantisSettings = {
  players: Array.from({ length: 4 }, (_, id) => ({
    id,
    name: `Player ${id + 1}`,
  })),
  tileGameSets: ["base", "pok", "te"],
  factionGameSets: ["base", "pok", "te"],
  numFactions: 6,
  extraBlues: 0,
  extraReds: 0,
  mulligans: 1,
  draftOrder: [0, 1, 2, 3],
};
let database: Database.Database;
let service: typeof import("./mantisDraft.server");
let route: typeof import("~/routes/draft.mantis.$id");
beforeAll(async () => {
  database = new Database(":memory:");
  database.exec(
    "CREATE TABLE mantisDrafts (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, hostTokenHash TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  database.exec(
    "CREATE TABLE bagDrafts (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, credentials TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  vi.doMock("./config.server", () => ({ db: drizzle(database) }));
  service = await import("./mantisDraft.server");
  route = await import("~/routes/draft.mantis.$id");
});
afterAll(() => database?.close());

async function cookies(id: string, player?: string, admin?: string) {
  return [
    player ? await service.mantisCookie(id).serialize(player) : "",
    admin ? await service.mantisAdminCookie(id).serialize(admin) : "",
  ]
    .filter(Boolean)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
function get(id: string, cookie = "") {
  return route.loader({
    request: new Request(`http://localhost/draft/mantis/${id}.data`, {
      headers: { Cookie: cookie },
    }),
    params: { id },
    context: {},
    unstable_pattern: "/draft/mantis/:id",
  });
}
function post(id: string, fields: Record<string, string>, cookie = "") {
  return route.action({
    request: new Request(`http://localhost/draft/mantis/${id}.data`, {
      method: "POST",
      body: new URLSearchParams({
        revision: String(service.getMantisRoom(id).revision),
        ...fields,
      }),
      headers: { Cookie: cookie },
    }),
    params: { id },
    context: {},
    unstable_pattern: "/draft/mantis/:id",
  });
}
async function joinAll(id: string) {
  for (let playerId = 0; playerId < 4; playerId++) {
    const joined = await post(id, {
      intent: "join",
      name: `Player ${playerId}`,
    });
    expect(joined.data.error).toBeNull();
  }
  return service.getMantisRoom(id).room.lobby.seatKeys;
}

test("new rooms conceal all draft data until every slot joins and the admin starts", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const admin = await cookies(id, undefined, token);
  expect((await get(id)).data.draft).toBeNull();
  const hostView = (await get(id, admin)).data;
  expect(hostView.draft).toBeNull();
  expect(hostView.isHost).toBe(true);
  expect(hostView.lobby.adminUuid).toBe(token);
  expect(hostView.lobby.slots.every((slot) => !slot.claimed)).toBe(true);
  expect((await post(id, { intent: "start" }, admin)).data.error).toContain(
    "Every slot",
  );
  expect((await post(id, { intent: "join", name: " " })).data.error).toContain(
    "Enter a name",
  );
  const keys = await joinAll(id);
  expect(
    (await post(id, { intent: "join", name: "Intruder" })).data.error,
  ).toContain("full");
  expect((await post(id, { intent: "start" })).data.error).toContain(
    "Only the draft host",
  );
  expect((await post(id, { intent: "start" }, admin)).data.error).toBeNull();
  const spectator = (await get(id)).data;
  expect(spectator.draft?.phase).toBe("draft");
  expect(JSON.stringify(spectator)).not.toContain(token);
  for (const key of Object.values(keys))
    expect(JSON.stringify(spectator)).not.toContain(key);
  expect(spectator.draft).not.toHaveProperty("history");
});

test("UUID restores a player on a new device and admin can also own their separate slot", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const legacyHost = await cookies(id, token);
  const joined = await post(
    id,
    { intent: "join", name: "Admin player" },
    legacyHost,
  );
  expect(joined.data.error).toBeNull();
  const responseHeaders = new Headers(joined.init?.headers);
  expect(responseHeaders.get("Set-Cookie")).toContain(`mantis-admin-${id}=`);
  expect(responseHeaders.get("Set-Cookie")).toContain(`mantis-${id}=`);
  const uuid = service.getMantisRoom(id).room.lobby.seatKeys[0];
  expect(uuid).toMatch(/^[a-f0-9-]{36}$/);
  expect(uuid).not.toBe(token);
  const own = (await get(id, await cookies(id, uuid, token))).data;
  expect(own.ownPlayers).toEqual([0]);
  expect(own.isHost).toBe(true);
  expect(own.lobby.ownUuid).toBe(uuid);
  expect(
    (
      await post(
        id,
        { intent: "join", name: "Admin again" },
        await cookies(id, uuid, token),
      )
    ).data.error,
  ).toContain("already have a slot");
  expect(service.getMantisRoom(id).revision).toBe(1);
  expect(service.findMantisRecovery(uuid)).toMatchObject({
    id,
    playerId: 0,
    role: "player",
  });
  expect(service.findMantisRecovery(token)).toMatchObject({
    id,
    role: "admin",
  });
  const recover = await post(id, {
    intent: "recover",
    recoveryId: uuid,
    revision: "-1",
  });
  expect(recover.data.error).toBeNull();
  const recoveredCookie = new Headers(recover.init?.headers)
    .get("Set-Cookie")!
    .split(";")[0];
  expect((await get(id, recoveredCookie)).data.ownPlayers).toEqual([0]);
  expect(
    (
      await post(id, {
        intent: "recover",
        recoveryId: service.newMantisToken(),
      })
    ).data.error,
  ).toContain("does not belong");
});

test("ownership, start, pause, stale revision, UUID rotation and admin recovery are enforced", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const keys = await joinAll(id);
  const admin = await cookies(id, undefined, token);
  const player = await cookies(id, keys[0]);
  const pick = {
    intent: "pick",
    playerId: "0",
    action: JSON.stringify({ type: "seat", seat: 0 }),
  };
  expect((await post(id, pick)).data.error).toContain("Join as this player");
  expect((await post(id, pick, admin)).data.error).toContain(
    "Join as this player",
  );
  expect((await post(id, pick, player)).data.error).toContain("must start");
  await post(id, { intent: "start" }, admin);
  expect(
    (await post(id, { ...pick, revision: "0" }, player)).data.error,
  ).toContain("Another player");
  expect((await post(id, pick, player)).data.error).toBeNull();
  expect((await post(id, { intent: "undo" }, player)).data.error).toContain(
    "Only the draft host",
  );
  expect((await post(id, { intent: "undo" }, admin)).data.error).toBeNull();
  expect(service.getMantisRoom(id).room.draft.seats[0]).toBeUndefined();
  expect((await post(id, pick, player)).data.error).toContain("paused");
  await post(id, { intent: "resume" }, admin);
  expect((await post(id, pick, player)).data.error).toBeNull();
  await post(id, { intent: "rotate", playerId: "0" }, admin);
  expect(service.findMantisRecovery(keys[0])).toBeUndefined();
  const hostView = (await get(id, admin)).data;
  expect(hostView.lobby.slots[0].uuid).not.toBe(keys[0]);
  expect((await get(id, player)).data.ownPlayers).toEqual([]);
});

test("saved rounds export encrypted state, reject tampering, restore and keep recovery snapshots", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const keys = await joinAll(id);
  const admin = await cookies(id, undefined, token);
  await post(id, { intent: "start" }, admin);
  await post(id, { intent: "checkpoint" }, admin);
  const checkpoint = (await get(id, admin)).data.lobby.checkpoints![0].id;
  await post(
    id,
    {
      intent: "pick",
      playerId: "0",
      action: JSON.stringify({ type: "seat", seat: 0 }),
    },
    await cookies(id, keys[0]),
  );
  const exported = await post(id, { intent: "export" }, admin);
  const saved = exported.data.exportState!;
  expect(saved).toContain("ti4-lobby-save");
  expect(saved).not.toContain("chosenFactions");
  expect(saved).not.toContain(keys[0]);
  expect(
    (
      await post(
        id,
        {
          intent: "import",
          state: saved.replace('"data":"', '"data":"broken'),
        },
        admin,
      )
    ).data.error,
  ).toContain("damaged");
  expect(
    (await post(id, { intent: "restore", checkpointId: checkpoint }, admin))
      .data.error,
  ).toBeNull();
  expect(service.getMantisRoom(id).room.draft.seats[0]).toBeUndefined();
  expect(service.getMantisRoom(id).room.lobby.paused).toBe(true);
  expect(service.getMantisRoom(id).room.lobby.checkpoints![0].label).toContain(
    "Recovery",
  );
  await post(id, { intent: "rename", playerId: "0", name: "New name" }, admin);
  expect(
    (await post(id, { intent: "import", state: saved }, admin)).data.error,
  ).toBeNull();
  expect(service.getMantisRoom(id).room.draft.seats[0]).toBe(0);
  expect(service.getMantisRoom(id).room.draft.players[0].name).toBe("New name");
  expect(service.getMantisRoom(id).room.lobby.seatKeys[0]).toBe(keys[0]);
});

test("map rooms start active, preserve transferred UUIDs, and hide random draws from admin and other players", async () => {
  const base = service.createMantisRoom(settings);
  const draft = service.getMantisRoom(base.id).room.draft;
  const blues = draft.pool.filter((id) => systemData[id].type === "BLUE");
  const reds = draft.pool.filter((id) => systemData[id].type === "RED");
  const state = createMantisMapBuild(
    {
      players: settings.players,
      hands: Object.fromEntries(
        settings.players.map(({ id }) => [
          id,
          [
            ...blues.slice(id * 3, id * 3 + 3),
            ...reds.slice(id * 2, id * 2 + 2),
          ],
        ]),
      ),
      seatOrder: [0, 1, 2, 3],
    },
    () => 0,
  );
  const seatKeys = Object.fromEntries(
    settings.players.map(({ id }) => [id, service.newMantisToken()]),
  );
  const claims = Object.fromEntries(
    Object.entries(seatKeys).map(([id, uuid]) => [
      id,
      service.mantisTokenHash(uuid),
    ]),
  );
  const { id, token } = service.createMantisRoomFromState(state, claims, {
    seatKeys,
    adminUuid: base.token,
  });
  expect(token).toBe(base.token);
  expect((await get(id)).data.lobby.started).toBe(true);
  expect(
    (await get(id, await cookies(id, seatKeys[0]))).data.draft?.drawnTile,
  ).toBe(state.drawnTile);
  expect(
    (await get(id, await cookies(id, seatKeys[1]))).data.draft?.drawnTile,
  ).toBeUndefined();
  expect(
    (await get(id, await cookies(id, undefined, token))).data.draft?.drawnTile,
  ).toBeUndefined();
  expect((await get(id, await cookies(id, token))).data.isHost).toBe(true);
});

test("persists state atomically and rejects malformed cookies", async () => {
  const { id } = service.createMantisRoom(settings);
  const first = service.getMantisRoom(id);
  const stale = service.getMantisRoom(id);
  first.room.claims[0] = "first-owner";
  service.saveMantisRoom(id, first.revision, first.room);
  expect(() => service.saveMantisRoom(id, stale.revision, stale.room)).toThrow(
    "Another player",
  );
  expect(service.getMantisRoom(id).room.claims[0]).toBe("first-owner");
  for (const token of [
    "",
    "short",
    "0".repeat(63),
    "G".repeat(64),
    { host: true },
  ]) {
    const request = new Request(`http://localhost/draft/mantis/${id}`, {
      headers: { Cookie: await service.mantisCookie(id).serialize(token) },
    });
    expect(await service.readMantisToken(id, request)).toBeUndefined();
  }
  expect(
    await service.mantisCookie(id).serialize(service.newMantisToken()),
  ).toContain("Path=/draft/mantis;");
});

test("migrates legacy rooms with a persisted random backup key and remembers existing owners", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const old = service.getMantisRoom(id).room;
  const player = "a".repeat(64);
  const legacy = {
    draft: old.draft,
    claims: { 0: service.mantisTokenHash(player) },
  };
  database
    .prepare("UPDATE mantisDrafts SET data = ? WHERE id = ?")
    .run(JSON.stringify(legacy), id);
  const migrated = service.getMantisRoom(id);
  expect(migrated.room.lobby.started).toBe(true);
  expect(service.getMantisRoom(id).room.lobby.backupSecret).toBe(
    migrated.room.lobby.backupSecret,
  );
  expect(migrated.room.lobby.backupSecret).not.toBe(
    service.mantisTokenHash(`mantis-backup:${service.mantisTokenHash(token)}`),
  );
  expect((await get(id, await cookies(id, player))).data.lobby.ownUuid).toBe(
    player,
  );
  expect(
    (await get(id, await cookies(id, token))).data.lobby.slots[0].uuid,
  ).toBe(player);
  const exported = await post(
    id,
    { intent: "export" },
    await cookies(id, token),
  );
  expect(
    (
      await post(
        id,
        { intent: "import", state: exported.data.exportState! },
        await cookies(id, token),
      )
    ).data.error,
  ).toBeNull();
});

test("replacing an active player preserves picks, pauses play and needs a full lobby before resuming", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const keys = await joinAll(id);
  const admin = await cookies(id, undefined, token);
  await post(id, { intent: "start" }, admin);
  await post(
    id,
    {
      intent: "pick",
      playerId: "0",
      action: JSON.stringify({ type: "seat", seat: 0 }),
    },
    await cookies(id, keys[0]),
  );
  await post(id, { intent: "release", playerId: "0" }, admin);
  expect(service.getMantisRoom(id).room.lobby.paused).toBe(true);
  expect((await post(id, { intent: "resume" }, admin)).data.error).toContain(
    "Fill every released slot",
  );
  expect(
    (await post(id, { intent: "join", name: "Replacement" })).data.error,
  ).toBeNull();
  const replacement = service.getMantisRoom(id).room.lobby.seatKeys[0];
  expect(replacement).not.toBe(keys[0]);
  expect(service.getMantisRoom(id).room.draft.seats[0]).toBe(0);
  expect((await post(id, { intent: "resume" }, admin)).data.error).toBeNull();
  await post(id, { intent: "undo" }, admin);
  expect(service.getMantisRoom(id).room.draft.players[0].name).toBe(
    "Replacement",
  );
});

test("map UUID and name repairs stay synchronized with the original bag lobby", async () => {
  const bag = await import("~/draft/bag/bagDraft.server");
  const parent = await bag.createBagDraft({
    variant: "inaugural_splice",
    players: settings.players.map((p) => p.name),
  });
  const seatKeys: Record<number, string> = {};
  for (const player of settings.players)
    seatKeys[player.id] = (await bag.joinBagDraft(parent.id, player.name)).uuid;
  const initial = service.createMantisRoom(settings);
  const draft = service.getMantisRoom(initial.id).room.draft;
  draft.bagDraftId = parent.id;
  const claims = Object.fromEntries(
    Object.entries(seatKeys).map(([id, uuid]) => [
      id,
      service.mantisTokenHash(uuid),
    ]),
  );
  const map = service.createMantisRoomFromState(draft, claims, {
    seatKeys,
    adminUuid: parent.adminToken,
  });
  const stored = database
    .prepare("SELECT data FROM bagDrafts WHERE id = ?")
    .get(parent.id) as { data: string };
  const state = JSON.parse(stored.data);
  state.mapRoomId = map.id;
  database
    .prepare("UPDATE bagDrafts SET data = ? WHERE id = ?")
    .run(JSON.stringify(state), parent.id);
  const admin = await cookies(map.id, undefined, map.token);
  expect(
    (await post(map.id, { intent: "rotate", playerId: "0" }, admin)).data.error,
  ).toBeNull();
  const uuid = service.getMantisRoom(map.id).room.lobby.seatKeys[0];
  expect(bag.findBagLobby(seatKeys[0])).toBeUndefined();
  expect(bag.findBagLobby(uuid)).toMatchObject({
    id: parent.id,
    role: "player",
  });
  expect((await bag.getBagMapAccess(parent.id, uuid))?.token).toBe(uuid);
  expect(
    (
      await post(
        map.id,
        { intent: "rename", playerId: "0", name: "Map player" },
        admin,
      )
    ).data.error,
  ).toBeNull();
  const renamed = database
    .prepare("SELECT data FROM bagDrafts WHERE id = ?")
    .get(parent.id) as { data: string };
  expect(
    JSON.parse(renamed.data).seats.find((p: { id: number }) => p.id === 0).name,
  ).toBe("Map player");
  expect(
    (await post(map.id, { intent: "release", playerId: "2" }, admin)).data
      .error,
  ).toBeNull();
  expect(bag.findBagLobby(seatKeys[2])).toBeUndefined();
  expect(
    (await post(map.id, { intent: "join", name: "Replacement" })).data.error,
  ).toBeNull();
  const replacement = service.getMantisRoom(map.id).room.lobby.seatKeys[2];
  expect(bag.findBagLobby(replacement)).toMatchObject({
    id: parent.id,
    role: "player",
  });
  expect((await bag.getBagMapAccess(parent.id, replacement))?.token).toBe(
    replacement,
  );
  const replaced = database
    .prepare("SELECT data FROM bagDrafts WHERE id = ?")
    .get(parent.id) as { data: string };
  expect(
    JSON.parse(replaced.data).seats.find((p: { id: number }) => p.id === 2)
      .name,
  ).toBe("Replacement");
  expect(service.getMantisRoom(map.id).room.lobby.seatKeys[0]).toBe(uuid);
});

test("name-only joins assign different players from the same original lobby revision", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const names = ["First", "Second", "Third", "Fourth", "Fifth"];
  const results = await Promise.all(
    names.map((name) => post(id, { intent: "join", name, revision: "0" })),
  );
  expect(results.map((result) => result.data.error)).toEqual([
    null,
    null,
    null,
    null,
    "This lobby is full.",
  ]);
  const room = service.getMantisRoom(id);
  expect(room.revision).toBe(4);
  expect(Object.keys(room.room.claims)).toEqual(["0", "1", "2", "3"]);
  expect(new Set(Object.values(room.room.claims)).size).toBe(4);
  expect(
    [...room.room.draft.players]
      .sort((a, b) => a.id - b.id)
      .map((player) => player.name),
  ).toEqual(names.slice(0, 4));
  for (const [playerId, result] of results.slice(0, 4).entries()) {
    const cookie = new Headers(result.init?.headers)
      .get("Set-Cookie")!
      .split(";")[0];
    expect((await get(id, cookie)).data.ownPlayers).toEqual([playerId]);
  }
  expect(
    (
      await post(
        id,
        { intent: "join", name: "First again", revision: "0" },
        await cookies(id, room.room.lobby.seatKeys[0]),
      )
    ).data.error,
  ).toContain("already have a slot");
  expect(service.getMantisRoom(id).revision).toBe(4);
  expect(
    (
      await post(
        id,
        { intent: "export", revision: "0" },
        await cookies(id, undefined, token),
      )
    ).data.exportState,
  ).toBeTruthy();
});
