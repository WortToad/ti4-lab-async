import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

let database: Database.Database;
let service: typeof import("./presetMap.server");

beforeAll(async () => {
  database = new Database(":memory:");
  const db = drizzle(database);
  migrate(db, { migrationsFolder: "app/drizzle/migrations" });
  vi.doMock("./config.server", () => ({ db }));
  service = await import("./presetMap.server");
});

afterAll(() => database?.close());

test("SQLite commits each new visitor's like once, including repeated requests", async () => {
  const preset = await service.createPresetMap({
    name: "Test map",
    description: "SQLite transaction test",
    author: "Test",
    mapConfigId: "milty6p",
    mapString: Array.from({ length: 18 }, (_, i) => String(i + 19)).join(","),
  });

  expect(await service.likePresetMap(preset.id, "192.0.2.1")).toEqual({
    likes: 1,
    liked: true,
  });
  expect(await service.likePresetMap(preset.id, "192.0.2.1")).toEqual({
    likes: 1,
    liked: true,
  });
  expect(await service.likePresetMap(preset.id, "192.0.2.2")).toEqual({
    likes: 2,
    liked: true,
  });
  expect((await service.presetMapById(preset.id))?.likes).toBe(2);
});
