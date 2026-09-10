import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { MantisSettings } from "~/draft/mantis/engine";

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
  vi.doMock("./config.server", () => ({ db: drizzle(database) }));
  service = await import("./mantisDraft.server");
  route = await import("~/routes/draft.mantis.$id");
});

afterAll(() => database?.close());

function cookieForPath(setCookie: string | undefined, requestPath: string) {
  if (!setCookie) return "";
  const cookiePath = /(?:^|;\s*)Path=([^;]+)/i.exec(setCookie)?.[1] ?? "/";
  const matches =
    requestPath === cookiePath ||
    requestPath.startsWith(
      cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`,
    );
  return matches ? setCookie.split(";")[0] : "";
}

test("sends room credentials to document and React Router .data requests", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const cookie = await service.mantisCookie(id).serialize(token);
  expect(cookie).toContain("Path=/draft/mantis;");
  for (const path of [`/draft/mantis/${id}`, `/draft/mantis/${id}.data`]) {
    const request = new Request(`http://localhost${path}`, {
      headers: { Cookie: cookieForPath(cookie, path) },
    });
    const view = await route.loader({
      request,
      params: { id },
      context: {},
      unstable_pattern: "/draft/mantis/:id",
    });
    expect(view.data.isHost).toBe(true);
  }
  expect(cookieForPath(cookie, "/draft/mantis-other/room")).toBe("");
});

test("persists state atomically and rejects a stale concurrent update", () => {
  const { id } = service.createMantisRoom(settings);
  const first = service.getMantisRoom(id);
  const stale = service.getMantisRoom(id);
  first.room.claims[0] = "first-owner";
  service.saveMantisRoom(id, first.revision, first.room);
  stale.room.claims[0] = "stale-owner";
  expect(() => service.saveMantisRoom(id, stale.revision, stale.room)).toThrow(
    "Another player",
  );
  expect(service.getMantisRoom(id).room.claims[0]).toBe("first-owner");
  expect(service.getMantisRoom(id).revision).toBe(1);
});

test("requires player ownership for picks, host ownership for undo, and never exposes credentials", async () => {
  const { id, token } = service.createMantisRoom(settings);
  const post = async (fields: Record<string, string>, cookie?: string) =>
    route.action({
      request: new Request(`http://localhost/draft/mantis/${id}.data`, {
        method: "POST",
        body: new URLSearchParams(fields),
        headers: { Cookie: cookieForPath(cookie, `/draft/mantis/${id}.data`) },
      }),
      params: { id },
      context: {},
      unstable_pattern: "/draft/mantis/:id",
    });
  const pick = {
    intent: "pick",
    revision: "0",
    playerId: "0",
    action: JSON.stringify({ type: "seat", seat: 0 }),
  };
  const unauthorized = await post(pick);
  expect(unauthorized.data.error).toContain("Join as this player");
  expect(service.getMantisRoom(id).revision).toBe(0);

  const playerToken = service.newMantisToken();
  const playerCookie = await service.mantisCookie(id).serialize(playerToken);
  const join = await post(
    { intent: "join", revision: "0", playerId: "0" },
    playerCookie,
  );
  expect(join.data.success).toBe(true);
  const stolen = await post({ intent: "join", revision: "1", playerId: "0" });
  expect(stolen.data.error).toContain("already joined");

  const ownPick = await post({ ...pick, revision: "1" }, playerCookie);
  expect(ownPick.data.success).toBe(true);
  expect(service.getMantisRoom(id).room.draft.seats[0]).toBe(0);
  const guestUndo = await post({ intent: "undo", revision: "2" }, playerCookie);
  expect(guestUndo.data.error).toContain("Only the draft host");

  const view = await route.loader({
    request: new Request(`http://localhost/draft/mantis/${id}.data`, {
      headers: {
        Cookie: cookieForPath(playerCookie, `/draft/mantis/${id}.data`),
      },
    }),
    params: { id },
    context: {},
    unstable_pattern: "/draft/mantis/:id",
  });
  expect(view.data.ownPlayers).toEqual([0]);
  expect(view.data.isHost).toBe(false);
  expect(new Headers(view.init?.headers).get("Cache-Control")).toBe("no-store");
  expect(JSON.stringify(view)).not.toContain(token);
  expect(JSON.stringify(view)).not.toContain(
    service.mantisTokenHash(playerToken),
  );
  expect(view.data.draft).not.toHaveProperty("history");

  const hostUndo = await post(
    { intent: "undo", revision: "2" },
    await service.mantisCookie(id).serialize(token),
  );
  expect(hostUndo.data.success).toBe(true);
  const restored = service.getMantisRoom(id);
  expect(restored.room.draft.seats[0]).toBeUndefined();
  expect(restored.room.claims[0]).toBe(service.mantisTokenHash(playerToken));
  expect(restored.revision).toBe(3);
});

test("rejects malformed credential cookies", async () => {
  const { id } = service.createMantisRoom(settings);
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
});
