import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { drafts } from "./schema.server";

test("legacy text and binary draft JSON retain their string contract", () => {
  const sqlite = new Database(":memory:");
  try {
    sqlite.exec(
      "CREATE TABLE drafts (id TEXT PRIMARY KEY, data BLOB NOT NULL)",
    );
    const json = JSON.stringify({ selections: [], name: "Mecatol — 帝国" });
    const insert = sqlite.prepare(
      "INSERT INTO drafts (id, data) VALUES (?, ?)",
    );
    insert.run("text", json);
    insert.run("binary", Buffer.from(json));
    const db = drizzle(sqlite);
    for (const id of ["text", "binary"]) {
      const read = () =>
        db
          .select({ data: drafts.data })
          .from(drafts)
          .where(eq(drafts.id, id))
          .get()!.data;
      expect(read()).toBe(json);
      // Independent reads must compare by content for stale-update protection.
      expect(read()).toBe(read());
      const updated = JSON.stringify({ selections: [1], name: "Updated" });
      db.update(drafts).set({ data: updated }).where(eq(drafts.id, id)).run();
      expect(read()).toBe(updated);
      expect(
        sqlite
          .prepare("SELECT typeof(data) AS type FROM drafts WHERE id = ?")
          .get(id),
      ).toEqual({ type: "text" });
    }
  } finally {
    sqlite.close();
  }
});
