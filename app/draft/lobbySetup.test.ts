import { describe, expect, it } from "vitest";
import { parseLobbyPlayerCount } from "./lobbySetup";

describe("carrying group size between draft formats", () => {
  it("retains compatible counts and clamps to the chosen format's range", () => {
    expect(parseLobbyPlayerCount("4", 3, 8)).toBe(4);
    expect(parseLobbyPlayerCount("8", 3, 6)).toBe(6);
    expect(parseLobbyPlayerCount("3", 4, 8)).toBe(4);
  });
  it.each([undefined, null, "", "nope", "4.5", "Infinity", "0"])(
    "uses the format default for an invalid or missing query: %s",
    (query) => {
      expect(parseLobbyPlayerCount(query, 3, 8)).toBe(6);
    },
  );
});
