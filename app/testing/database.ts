import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { vi } from "vitest";

/** Call before dynamically importing server modules; never opens the app database. */
export function createTestDatabase() {
  const database = new Database(":memory:");
  const db = drizzle(database);
  migrate(db, { migrationsFolder: "app/drizzle/migrations" });
  vi.doMock("~/drizzle/config.server", () => ({ db }));
  return database;
}
