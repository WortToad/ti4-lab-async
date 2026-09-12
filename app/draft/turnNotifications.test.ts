import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserAlertsEnabled,
  rememberDraftTurn,
  setBrowserAlertsEnabled,
} from "./turnNotifications";

let values: Map<string, string>;
let storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
beforeEach(() => {
  values = new Map();
  storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("Notification", { permission: "granted" });
});
afterEach(() => vi.unstubAllGlobals());

describe("optional browser turn alerts", () => {
  it("requires explicit opt-in even when notification permission was granted", () => {
    expect(browserAlertsEnabled()).toBe(false);
    setBrowserAlertsEnabled(true);
    expect(browserAlertsEnabled()).toBe(true);
    setBrowserAlertsEnabled(false);
    expect(browserAlertsEnabled()).toBe(false);
  });
  it.each(["denied", "default"])(
    "honors %s browser permission after opt-in",
    (permission) => {
      setBrowserAlertsEnabled(true);
      vi.stubGlobal("Notification", { permission });
      expect(browserAlertsEnabled()).toBe(false);
    },
  );
  it("works during server rendering and when preference storage is unavailable", () => {
    vi.stubGlobal("Notification", undefined);
    expect(browserAlertsEnabled()).toBe(false);
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem: () => {
        throw new Error("Storage blocked");
      },
    });
    expect(browserAlertsEnabled()).toBe(false);
    expect(() => setBrowserAlertsEnabled(true)).not.toThrow();
  });
  it("deduplicates refreshes while separating lobbies, players, and new turns", () => {
    expect(rememberDraftTurn(storage, "raw:one:0", "chooseFaction")).toBe(true);
    expect(rememberDraftTurn(storage, "raw:one:0", "chooseFaction")).toBe(
      false,
    );
    expect(rememberDraftTurn(storage, "raw:one:1", "chooseFaction")).toBe(true);
    expect(rememberDraftTurn(storage, "raw:two:0", "chooseFaction")).toBe(true);
    expect(rememberDraftTurn(storage, "raw:one:0", "placeTile:1")).toBe(true);
    expect(rememberDraftTurn(storage, "raw:one:0", "placeTile:1")).toBe(false);
  });
  it("alerts again when undo or recovery returns a player to a previously completed choice", () => {
    expect(rememberDraftTurn(storage, "bag:room:0", "pick:1")).toBe(true);
    expect(rememberDraftTurn(storage, "bag:room:0")).toBe(false);
    expect(rememberDraftTurn(storage, "bag:room:0", "pick:1")).toBe(true);
  });
});
