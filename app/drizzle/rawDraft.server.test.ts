import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { RawSettings } from "~/draft/raw/types";

const settings: RawSettings = {
  players: Array.from({ length: 4 }, (_, id) => ({
    id,
    name: `Player ${id + 1}`,
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

function cookieHeader(setCookie?: string) {
  return setCookie?.split(";")[0] ?? "";
}

function view(id: string, cookie?: string, dataRequest = false) {
  return service.loadRawRoom({
    request: new Request(
      `http://localhost/draft/raw/${id}${dataRequest ? ".data" : ""}`,
      { headers: { Cookie: cookieHeader(cookie) } },
    ),
    params: { id },
    context: {},
    unstable_pattern: "/draft/raw/:id",
  });
}

function post(id: string, fields: Record<string, string>, cookie?: string) {
  return service.actRawRoom({
    request: new Request(`http://localhost/draft/raw/${id}.data`, {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: { Cookie: cookieHeader(cookie) },
    }),
    params: { id },
    context: {},
    unstable_pattern: "/draft/raw/:id",
  });
}

test("persists rooms using the generated migration and rejects stale writes", () => {
  const { id, token } = service.createRawRoom(settings);
  const first = service.getRawRoom(id);
  const stale = service.getRawRoom(id);
  expect(first.room.draft.settings.mode).toBe("base");
  expect(first.hostTokenHash).toBe(service.rawTokenHash(token));
  expect(first.data).not.toContain(token);
  expect(first.createdAt).toBeTruthy();
  first.room.claims[0] = "first-owner";
  service.saveRawRoom(id, first.revision, first.room);
  stale.room.claims[0] = "stale-owner";
  expect(() => service.saveRawRoom(id, stale.revision, stale.room)).toThrow(
    "Another player",
  );
  expect(service.getRawRoom(id).room.claims[0]).toBe("first-owner");
  expect(service.getRawRoom(id).revision).toBe(1);
});

test("room cookies cover document and .data requests and reject malformed credentials", async () => {
  const { id, token } = service.createRawRoom(settings);
  const cookie = await service.rawCookie(id).serialize(token);
  expect(cookie).toContain("Path=/draft/raw;");
  expect(cookie).toContain("HttpOnly");
  for (const dataRequest of [false, true]) {
    expect((await view(id, cookie, dataRequest)).data.isHost).toBe(true);
  }
  for (const malformed of [
    "",
    "short",
    "0".repeat(63),
    "G".repeat(64),
    { host: true },
  ]) {
    const request = new Request(`http://localhost/draft/raw/${id}`, {
      headers: {
        Cookie: cookieHeader(await service.rawCookie(id).serialize(malformed)),
      },
    });
    expect(await service.readRawToken(id, request)).toBeUndefined();
  }
});

test("requires claimed players, rejects actor impersonation, and restricts undo and release to host", async () => {
  const { id, token } = service.createRawRoom(settings);
  const actorId = service.getRawRoom(id).room.draft.order[0];
  const otherId = settings.players.find(({ id }) => id !== actorId)!.id;
  const pick = {
    intent: "pick",
    revision: "0",
    playerId: String(actorId),
    action: JSON.stringify({
      type: "chooseFaction",
      playerId: actorId,
      factionId: "arborec",
    }),
  };
  expect((await post(id, pick)).data.error).toContain("Join as this player");
  const joined = await post(id, {
    intent: "join",
    revision: "0",
    playerId: String(actorId),
  });
  expect(joined.data.success).toBe(true);
  const playerCookie = new Headers(joined.init?.headers).get("Set-Cookie")!;
  expect(
    (
      await post(id, {
        intent: "join",
        revision: "1",
        playerId: String(actorId),
      })
    ).data.error,
  ).toContain("already joined");
  const impersonation = await post(
    id,
    {
      ...pick,
      revision: "1",
      action: JSON.stringify({
        type: "chooseFaction",
        playerId: otherId,
        factionId: "arborec",
      }),
    },
    playerCookie,
  );
  expect(impersonation.data.error).toContain("player you control");
  expect(service.getRawRoom(id).revision).toBe(1);
  const ownPick = await post(id, { ...pick, revision: "1" }, playerCookie);
  expect(ownPick.data.error).toBeNull();
  expect(service.getRawRoom(id).room.draft.factions[actorId]).toBe("arborec");
  expect(
    (await post(id, { intent: "undo", revision: "2" }, playerCookie)).data
      .error,
  ).toContain("Only the draft host");
  expect(
    (
      await post(
        id,
        { intent: "release", revision: "2", playerId: String(actorId) },
        playerCookie,
      )
    ).data.error,
  ).toContain("Only the host");

  const hostCookie = await service.rawCookie(id).serialize(token);
  const undone = await post(id, { intent: "undo", revision: "2" }, hostCookie);
  expect(undone.data.success).toBe(true);
  expect(service.getRawRoom(id).room.draft.factions[actorId]).toBeUndefined();
  expect((await view(id, playerCookie)).data.ownPlayers).toEqual([actorId]);
  const released = await post(
    id,
    { intent: "release", revision: "3", playerId: String(actorId) },
    hostCookie,
  );
  expect(released.data.success).toBe(true);
  expect(
    (await post(id, { ...pick, revision: "4" }, playerCookie)).data.error,
  ).toContain("Join as this player");
});

test("does not mutate state for malformed requests or stale revisions", async () => {
  const { id, token } = service.createRawRoom(settings);
  const hostCookie = await service.rawCookie(id).serialize(token);
  for (const fields of [
    { intent: "join", playerId: "0" },
    { intent: "join", revision: "0" },
    { intent: "join", revision: "1", playerId: "0" },
    { intent: "join", revision: "0", playerId: "999" },
    { intent: "pick", revision: "0", playerId: "0", action: "{" },
    { intent: "pick", revision: "0", playerId: "0", action: "[]" },
  ]) {
    const result = await post(id, fields as Record<string, string>, hostCookie);
    expect(result.data.success).toBe(false);
    expect(result.init?.status).toBe(400);
    expect(new Headers(result.init?.headers).get("Cache-Control")).toBe(
      "no-store",
    );
    expect(service.getRawRoom(id).revision).toBe(0);
  }
});

test("redacts all private hands, undealt cards, history, and future fields from spectators", async () => {
  const { id, token } = service.createRawRoom({
    ...settings,
    mode: "twilightsFall",
    pok: true,
    te: true,
  });
  const ownerToken = service.newRawToken();
  const ownerCookie = await service.rawCookie(id).serialize(ownerToken);
  const record = service.getRawRoom(id);
  record.room.claims[0] = service.rawTokenHash(ownerToken);
  Object.assign(record.room.draft, { futureSecret: "future-private-value" });
  record.room.draft.hands = { 0: ["private-map-0"], 1: ["private-map-1"] };
  record.room.draft.speaker = 1;
  record.room.draft.preplace = ["private-preplace"];
  record.room.draft.referenceDeck = ["barony"];
  record.room.draft.references = {
    0: { hand: ["arborec"], drafted: ["saar"], ready: true, priority: "saar" },
    1: { hand: ["muaat"], drafted: ["sardakk"], ready: false },
  };
  record.room.draft.splice = {
    0: { hand: ["private-splice-0"], drafted: ["private-pick-0"], ready: true },
    1: {
      hand: ["private-splice-1"],
      drafted: ["private-pick-1"],
      ready: false,
    },
  };
  const { history, ...snapshot } = record.room.draft;
  history.push({
    ...snapshot,
    hands: { 0: ["historical-private-value"] },
  });
  service.saveRawRoom(id, record.revision, record.room);

  const spectator = await view(id);
  expect(spectator.data.draft.hands).toEqual({});
  expect(spectator.data.draft.references).toEqual({});
  expect(spectator.data.draft.splice).toEqual({});
  expect(spectator.data.draft.preplace).toEqual([]);
  expect(spectator.data.handCounts).toEqual({ 0: 1, 1: 1, 2: 0, 3: 0 });
  expect(spectator.data.spliceHandCounts).toEqual({ 0: 1, 1: 1, 2: 0, 3: 0 });
  expect(spectator.data.referenceReady[0]).toBe(true);
  expect(spectator.data.canUndo).toBe(true);
  const owner = await view(id, ownerCookie);
  expect(owner.data.draft.hands).toEqual({ 0: ["private-map-0"] });
  expect(owner.data.draft.references[0]).toEqual(
    record.room.draft.references[0],
  );
  expect(owner.data.draft.references[1]).toBeUndefined();
  expect(owner.data.draft.splice[1]).toBeUndefined();
  expect(owner.data.draft.preplace).toEqual([]);
  const host = await view(id, await service.rawCookie(id).serialize(token));
  expect(host.data.draft.hands).toEqual(record.room.draft.hands);
  expect(host.data.draft.preplace).toEqual(["private-preplace"]);
  expect(host.data.draft.references).toEqual(record.room.draft.references);
  expect(host.data.draft.splice).toEqual(record.room.draft.splice);
  for (const result of [spectator, owner, host]) {
    expect(result.data.draft).not.toHaveProperty("history");
    expect(result.data.draft).not.toHaveProperty("referenceDeck");
    expect(JSON.stringify(result)).not.toContain("historical-private-value");
    expect(JSON.stringify(result)).not.toContain("future-private-value");
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(
      service.rawTokenHash(ownerToken),
    );
    expect(new Headers(result.init?.headers).get("Cache-Control")).toBe(
      "no-store",
    );
  }
  expect(JSON.stringify(spectator)).not.toContain("private-");
  expect(JSON.stringify(owner)).not.toContain("private-map-1");
  expect(JSON.stringify(owner)).not.toContain("private-splice-1");
  expect(JSON.stringify(owner)).not.toContain("private-pick-1");
});

test("reveals only kept splice cards when the draft completes", async () => {
  const { id } = service.createRawRoom(settings);
  const record = service.getRawRoom(id);
  record.room.draft.splice = {
    0: {
      hand: ["undealt-private-card"],
      drafted: ["discarded-private-card", "kept-card"],
      kept: ["kept-card"],
      ready: true,
    },
  };
  record.room.draft.phase = "spliceKeep";
  service.saveRawRoom(id, record.revision, record.room);
  expect((await view(id)).data.draft.splice).toEqual({});
  const completed = service.getRawRoom(id);
  completed.room.draft.phase = "complete";
  service.saveRawRoom(id, completed.revision, completed.room);
  const revealed = await view(id);
  expect(revealed.data.draft.splice[0].kept).toEqual(["kept-card"]);
  expect(JSON.stringify(revealed)).not.toContain("private-card");
});
