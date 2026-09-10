import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { RawSettings } from "~/draft/raw/types";

const settings: RawSettings = {
  players: Array.from({ length: 4 }, (_, id) => ({
    id,
    name: `Slot ${id + 1}`,
  })),
  mode: "base",
  pok: false,
  te: false,
  shuffleSeats: false,
};
let database: Database.Database;
let service: typeof import("./rawDraft.server");
beforeAll(async () => {
  database = new Database(":memory:");
  database.exec(
    readFileSync("app/drizzle/migrations/0013_warm_leech.sql", "utf8"),
  );
  vi.doMock("./config.server", () => ({ db: drizzle(database) }));
  service = await import("./rawDraft.server");
});
afterAll(() => database?.close());
const cookieHeader = (value?: string) => value?.split(";")[0] ?? "";
function view(id: string, cookie = "") {
  return service.loadRawRoom({
    request: new Request(`http://localhost/draft/raw/${id}.data`, {
      headers: { Cookie: cookie },
    }),
    params: { id },
    context: {},
    unstable_pattern: "/draft/raw/:id",
  });
}
function post(id: string, fields: Record<string, string>, cookie = "") {
  return service.actRawRoom({
    request: new Request(`http://localhost/draft/raw/${id}.data`, {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: { Cookie: cookie },
    }),
    params: { id },
    context: {},
    unstable_pattern: "/draft/raw/:id",
  });
}
async function started(mode: RawSettings["mode"] = "base") {
  const room = service.createRawRoom({
    ...settings,
    mode,
    te: mode === "twilightsFall",
  });
  const admin = cookieHeader(
    await service.rawCookie(room.id, "admin").serialize(room.token),
  );
  const cookies: string[] = [];
  for (let id = 0; id < 4; id++) {
    const joined = await post(room.id, {
      intent: "join",
      playerId: String(id),
      name: `Player ${id + 1}`,
    });
    expect(joined.data.error).toBeNull();
    cookies.push(
      cookieHeader(new Headers(joined.init?.headers).get("Set-Cookie")!),
    );
  }
  expect(
    (await post(room.id, { intent: "start", revision: "4" }, admin)).data.error,
  ).toBeNull();
  return { ...room, admin, cookies };
}

test("new lobbies conceal the complete draft until all players join and admin starts", async () => {
  const { id, token } = service.createRawRoom(settings);
  const admin = cookieHeader(
    await service.rawCookie(id, "admin").serialize(token),
  );
  for (const cookie of ["", admin]) {
    const room = await view(id, cookie);
    expect(room.data.draft).toBeNull();
    expect(room.data.lobby.started).toBe(false);
    expect(room.data.lobby.slots.every((s) => !s.claimed)).toBe(true);
    expect(JSON.stringify(room)).not.toContain('"speaker"');
  }
  expect(
    (await post(id, { intent: "start", revision: "0" }, admin)).data.error,
  ).toContain("Every slot");
  expect(
    (await post(id, { intent: "start", revision: "0" })).data.error,
  ).toContain("Only the admin");
  const claims = await Promise.all([
    post(id, { intent: "join", playerId: "0", name: "Alice" }),
    post(id, { intent: "join", playerId: "0", name: "Imposter" }),
  ]);
  expect(claims.filter((r) => r.data.success)).toHaveLength(1);
  const cookie = cookieHeader(
    new Headers(claims[0].init?.headers).get("Set-Cookie")!,
  );
  const own = (await view(id, cookie)).data;
  expect(own.draft).toBeNull();
  expect(own.ownPlayers).toEqual([0]);
  expect(own.lobby.ownUuid).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    (
      await post(
        id,
        { intent: "join", playerId: "1", name: "Alice again" },
        cookie,
      )
    ).data.error,
  ).toContain("already have a slot");
  expect(
    (
      await post(
        id,
        {
          intent: "pick",
          revision: "1",
          playerId: "0",
          action: JSON.stringify({
            type: "chooseFaction",
            playerId: 0,
            factionId: "sol",
          }),
        },
        cookie,
      )
    ).data.error,
  ).toContain("start");
  const recover = await post(id, {
    intent: "recover",
    uuid: own.lobby.ownUuid!,
  });
  expect(recover.data.error).toBeNull();
  const recovered = cookieHeader(
    new Headers(recover.init?.headers).get("Set-Cookie")!,
  );
  expect((await view(id, recovered)).data.ownPlayers).toEqual([0]);
  expect(service.findRawRecovery(own.lobby.ownUuid!)).toEqual({
    id,
    role: "player",
  });
  expect(service.findRawRecovery(token)).toEqual({ id, role: "admin" });
  expect((await view(id, admin)).data.lobby.slots[0].uuid).toBe(
    own.lobby.ownUuid,
  );
  expect((await view(id)).data.lobby.slots[0].uuid).toBeUndefined();
});

test("player and admin cookies coexist and admin never receives other hidden hands", async () => {
  const room = await started("twilightsFall");
  const record = service.getRawRoom(room.id);
  record.room.draft.hands = { 0: ["private-map-0"], 1: ["private-map-1"] };
  Object.assign(record.room.draft, { futureSecret: "future-secret" });
  service.saveRawRoom(room.id, record.revision, record.room);
  const spectator = (await view(room.id)).data;
  const host = (await view(room.id, room.admin)).data;
  const own = (await view(room.id, `${room.admin}; ${room.cookies[0]}`)).data;
  expect(host.isHost).toBe(true);
  expect(host.ownPlayers).toEqual([]);
  expect(host.draft!.hands).toEqual({});
  expect(host.draft!.references).toEqual({});
  expect(spectator.draft!.hands).toEqual({});
  expect(own.draft!.hands).toEqual({ 0: ["private-map-0"] });
  expect(Object.keys(own.draft!.references)).toEqual(["0"]);
  expect(own.isHost).toBe(true);
  expect(own.ownPlayers).toEqual([0]);
  for (const result of [spectator, host, own]) {
    expect(JSON.stringify(result)).not.toContain("private-map-1");
    expect(JSON.stringify(result)).not.toContain("future-secret");
    expect(result.draft).not.toHaveProperty("history");
    expect(JSON.stringify(result)).not.toContain(
      record.room.lobby.backupSecret,
    );
  }
});

test("admin saves are encrypted, restore paused, preserve identities and reject tampering", async () => {
  const room = await started();
  const actor = {
    intent: "pick",
    revision: "5",
    playerId: "0",
    action: JSON.stringify({
      type: "chooseFaction",
      playerId: 0,
      factionId: "sol",
    }),
  };
  expect((await post(room.id, actor)).data.error).toContain("Join as");
  expect((await post(room.id, actor, room.cookies[1])).data.error).toContain(
    "Join as",
  );
  expect((await post(room.id, actor, room.cookies[0])).data.error).toBeNull();
  expect(
    (
      await post(
        room.id,
        { intent: "undoAction", revision: "6" },
        room.cookies[0],
      )
    ).data.error,
  ).toContain("Only the admin");
  const saved = await post(room.id, { intent: "export" }, room.admin);
  expect(saved.data.backup).toBeTruthy();
  expect(saved.data.backup).not.toContain('"factions"');
  expect(
    (await post(room.id, { intent: "export" }, room.cookies[0])).data.error,
  ).toContain("Only the admin");
  expect(
    (await post(room.id, { intent: "undoAction", revision: "6" }, room.admin))
      .data.error,
  ).toBeNull();
  const undone = (await view(room.id, room.cookies[0])).data;
  expect(undone.draft!.factions[0]).toBeUndefined();
  expect(undone.lobby.paused).toBe(true);
  expect(
    (await post(room.id, { ...actor, revision: "7" }, room.cookies[0])).data
      .error,
  ).toContain("paused");
  expect(
    (
      await post(
        room.id,
        { intent: "importState", revision: "7", state: saved.data.backup! },
        room.admin,
      )
    ).data.error,
  ).toBeNull();
  const restored = (await view(room.id, room.cookies[0])).data;
  expect(restored.draft!.factions[0]).toBe("sol");
  expect(restored.ownPlayers).toEqual([0]);
  expect(restored.lobby.paused).toBe(true);
  const forged = JSON.parse(saved.data.backup!);
  forged.data = "AAAA" + forged.data.slice(4);
  expect(
    (
      await post(
        room.id,
        { intent: "importState", revision: "8", state: JSON.stringify(forged) },
        room.admin,
      )
    ).data.error,
  ).toContain("damaged");
  expect(service.getRawRoom(room.id).revision).toBe(8);
  expect(
    (await post(room.id, { intent: "resume", revision: "8" }, room.admin)).data
      .error,
  ).toBeNull();
});

test("releasing and rotating a UUID revoke former device access and never undo identity changes", async () => {
  const room = await started();
  const before = (await view(room.id, room.cookies[0])).data.lobby.ownUuid!;
  expect(
    (
      await post(
        room.id,
        { intent: "rotate", playerId: "0", revision: "5" },
        room.admin,
      )
    ).data.error,
  ).toBeNull();
  expect(service.findRawRecovery(before)).toBeUndefined();
  expect((await view(room.id, room.cookies[0])).data.ownPlayers).toEqual([]);
  const after = (await view(room.id, room.admin)).data.lobby.slots[0].uuid!;
  expect(after).not.toBe(before);
  expect(
    (await post(room.id, { intent: "recover", uuid: before })).data.error,
  ).toContain("does not belong");
  expect(
    (
      await post(
        room.id,
        { intent: "release", playerId: "0", revision: "6" },
        room.admin,
      )
    ).data.error,
  ).toBeNull();
  expect((await view(room.id)).data.lobby.paused).toBe(true);
  expect(
    (await post(room.id, { intent: "resume", revision: "7" }, room.admin)).data
      .error,
  ).toContain("Fill every");
  expect(
    (
      await post(room.id, {
        intent: "join",
        playerId: "0",
        name: "Replacement",
      })
    ).data.error,
  ).toBeNull();
  expect(
    (await post(room.id, { intent: "resume", revision: "8" }, room.admin)).data
      .error,
  ).toBeNull();
  expect(
    (await post(room.id, { intent: "pause", revision: "8" }, room.admin)).data
      .error,
  ).toContain("Another player");
});

test("cookie scope covers data requests and atomic saves reject stale updates", async () => {
  const room = service.createRawRoom(settings);
  const cookie = await service
    .rawCookie(room.id, "admin")
    .serialize(room.token);
  expect(cookie).toContain("Path=/draft/raw;");
  expect(cookie).toContain("HttpOnly");
  expect((await view(room.id, cookieHeader(cookie))).data.isHost).toBe(true);
  for (const token of ["short", "G".repeat(64), { host: true }]) {
    const request = new Request(`http://localhost/draft/raw/${room.id}`, {
      headers: {
        Cookie: cookieHeader(await service.rawCookie(room.id).serialize(token)),
      },
    });
    expect(await service.readRawToken(room.id, request)).toBeUndefined();
  }
  const first = service.getRawRoom(room.id),
    stale = service.getRawRoom(room.id);
  first.room.claims[0] = "first-owner";
  service.saveRawRoom(room.id, first.revision, first.room);
  stale.room.claims[0] = "stale-owner";
  expect(() =>
    service.saveRawRoom(room.id, stale.revision, stale.room),
  ).toThrow("Another player");
  expect(service.getRawRoom(room.id).room.claims[0]).toBe("first-owner");
});
