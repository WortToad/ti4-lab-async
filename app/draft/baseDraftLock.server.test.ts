import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { withBaseDraftLock } from "./baseDraftLock.server";

function gate() {
  let release!: () => void;
  return {
    promise: new Promise<void>((resolve) => {
      release = resolve;
    }),
    release: () => release(),
  };
}

describe("concurrent draft mutations", () => {
  it("runs operations for the same lobby in arrival order", async () => {
    const id = randomUUID();
    const pending = gate();
    const started = gate();
    const events: string[] = [];
    const first = withBaseDraftLock(id, async () => {
      events.push("first started");
      started.release();
      await pending.promise;
      events.push("first saved");
      return 1;
    });
    await started.promise;
    const second = withBaseDraftLock(id, async () => {
      events.push("second saved");
      return 2;
    });
    const third = withBaseDraftLock(id, async () => {
      events.push("third saved");
      return 3;
    });
    await Promise.resolve();
    expect(events).toEqual(["first started"]);
    pending.release();
    expect(await Promise.all([first, second, third])).toEqual([1, 2, 3]);
    expect(events).toEqual([
      "first started",
      "first saved",
      "second saved",
      "third saved",
    ]);
  });
  it("lets another lobby progress while one is waiting", async () => {
    const pending = gate();
    const blocked = withBaseDraftLock(randomUUID(), () => pending.promise);
    try {
      expect(await withBaseDraftLock(randomUUID(), async () => "saved")).toBe(
        "saved",
      );
    } finally {
      pending.release();
      await blocked;
    }
  });
  it("releases a failed operation and accepts both queued and later requests", async () => {
    const id = randomUUID();
    const error = new Error("SQLite write failed");
    const first = withBaseDraftLock(id, async () => {
      throw error;
    });
    const second = withBaseDraftLock(id, async () => "queued");
    await expect(first).rejects.toBe(error);
    await expect(second).resolves.toBe("queued");
    await expect(withBaseDraftLock(id, async () => "retry")).resolves.toBe(
      "retry",
    );
  });
  it("shares the same queue across server module reloads", async () => {
    const id = randomUUID();
    const pending = gate();
    const first = withBaseDraftLock(id, () => pending.promise);
    vi.resetModules();
    const reloaded = await import("./baseDraftLock.server");
    const operation = vi.fn(async () => "saved");
    const second = reloaded.withBaseDraftLock(id, operation);
    await Promise.resolve();
    expect(operation).not.toHaveBeenCalled();
    pending.release();
    await first;
    await expect(second).resolves.toBe("saved");
  });
});
