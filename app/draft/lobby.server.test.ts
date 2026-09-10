import { describe, expect, it } from "vitest";
import {
  newBackupSecret,
  openBackup,
  sealBackup,
  validRecoveryToken,
} from "./lobby.server";

describe("private recovery saves", () => {
  it("round trips state without exposing hands or recovery credentials", () => {
    const secret = newBackupSecret();
    const state = {
      hands: { 0: ["hidden-ability"], 1: ["secret-tile"] },
      round: 7,
    };
    const saved = sealBackup("bag", "room-a", secret, state);
    expect(saved).not.toContain("hidden-ability");
    expect(saved).not.toContain("secret-tile");
    expect(saved).not.toContain(secret);
    expect(openBackup("bag", "room-a", secret, saved)).toEqual(state);
    expect(() => openBackup("bag", "room-b", secret, saved)).toThrow(
      /another lobby/,
    );
    expect(() => openBackup("raw", "room-a", secret, saved)).toThrow(
      /another lobby/,
    );
    expect(() => openBackup("bag", "room-a", newBackupSecret(), saved)).toThrow(
      /damaged/,
    );
    const edited = JSON.parse(saved);
    edited.data = "AAAA" + edited.data.slice(4);
    expect(() =>
      openBackup("bag", "room-a", secret, JSON.stringify(edited)),
    ).toThrow(/damaged/);
  });
  it("rejects malformed and oversized saves", () => {
    const secret = newBackupSecret();
    for (const value of ["null", "{}", "nope", "[]"])
      expect(() => openBackup("raw", "room", secret, value)).toThrow();
    expect(() =>
      openBackup("raw", "room", secret, "x".repeat(8 * 1024 * 1024 + 1)),
    ).toThrow(/8 MB/);
  });
  it("accepts UUIDs and previous 64-character recovery tokens only", () => {
    expect(validRecoveryToken("6f88b4bc-6e1c-4d07-b18c-1e3d07719de4")).toBe(
      true,
    );
    expect(validRecoveryToken("a".repeat(64))).toBe(true);
    for (const value of ["admin", "", {}, "G".repeat(64)])
      expect(validRecoveryToken(value)).toBe(false);
  });
});
