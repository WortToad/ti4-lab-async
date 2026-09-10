import { describe, expect, it } from "vitest";
import { factionSystems } from "~/data/systemData";
import { getBaseKeleresSetup, getSelectedFactions } from "../keleres";
import { TEXAS_REDRAW_VALUE } from "./texasDraft";
import {
  canRedrawTexasConflictingFaction,
  getTexasFactionConflict,
  getTexasFactionReplacementOptions,
  replaceTexasConflictingFaction,
} from "./factionConflict";
import { texasFactionConflictFixture } from "./factionConflict.testData";

describe("revealed Texas faction recovery", () => {
  it("detects the public quartet and never consults private staged choices", () => {
    const draft = texasFactionConflictFixture();
    expect(getTexasFactionConflict(draft)).toEqual({
      keleresPlayerId: 0,
      affectedPlayerIds: [0, 1, 2, 3],
    });
    draft.selections = [];
    draft.stagedSelections = {
      texasFaction: {
        0: "keleres",
        1: "mentak",
        2: "xxcha",
        3: "argent",
        4: "hacan",
      },
    };
    expect(getTexasFactionConflict(draft)).toBeUndefined();
    expect(getTexasFactionReplacementOptions(draft, 0)).toEqual([]);
    expect(canRedrawTexasConflictingFaction(draft, 0)).toBe(false);
  });

  it("offers only the involved player's own alternatives that resolve the conflict", () => {
    const draft = texasFactionConflictFixture();
    expect(getTexasFactionReplacementOptions(draft, 0)).toEqual(["sol"]);
    expect(getTexasFactionReplacementOptions(draft, 1)).toEqual(["barony"]);
    expect(getTexasFactionReplacementOptions(draft, 4)).toEqual([]);
    expect(() => replaceTexasConflictingFaction(draft, 4, "sardakk")).toThrow(
      "involved",
    );
    expect(() => replaceTexasConflictingFaction(draft, 0, "barony")).toThrow(
      "original hand",
    );
    expect(() => replaceTexasConflictingFaction(draft, 0, "keleres")).toThrow(
      "original hand",
    );
    expect(() => replaceTexasConflictingFaction(draft, 0, "mentak")).toThrow(
      "original hand",
    );
    draft.texasDraft!.factionOptions![0] = [
      "keleres",
      "mentak",
      "__proto__" as "sol",
    ];
    expect(getTexasFactionReplacementOptions(draft, 0)).toEqual([]);
  });

  it("preserves completed legacy tile picks, map placements, seats and turn counts", () => {
    const draft = texasFactionConflictFixture();
    draft.selections.push(
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasBlueKeep1",
        selections: [{ playerId: 0, value: "19" }],
      },
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasBlueKeep2",
        selections: [{ playerId: 0, value: "20" }],
      },
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasRedKeep",
        selections: [{ playerId: 0, value: "39" }],
      },
      { type: "PLACE_TILE", playerId: 0, mapIdx: 1, systemId: "19" },
    );
    draft.presetMap[1] = {
      ...draft.presetMap[1],
      type: "SYSTEM",
      systemId: "19",
    };
    draft.players[0].homeSystemFactionId = "mentak";
    const original = structuredClone(draft);
    const next = replaceTexasConflictingFaction(draft, 1, "barony");
    expect(draft).toEqual(original);
    expect(next.selections).toHaveLength(draft.selections.length);
    expect(next.selections.slice(1)).toEqual(draft.selections.slice(1));
    expect(next.presetMap).toEqual(draft.presetMap);
    expect(next.texasDraft).toEqual(draft.texasDraft);
    expect(next.pickOrder).toEqual(draft.pickOrder);
    expect(next.players[0].homeSystemFactionId).toBeUndefined();
    expect(getBaseKeleresSetup(next)).toMatchObject({
      ready: true,
      choices: ["mentak"],
      chosen: undefined,
    });
    expect(next.selections[0]).toMatchObject({
      factionReplacements: [
        {
          playerId: 1,
          previousFactionId: "mentak",
          factionId: "barony",
          redrawn: false,
        },
      ],
    });
    expect(() => replaceTexasConflictingFaction(next, 2, "saar")).toThrow(
      "already been resolved",
    );
  });

  it("rejects a replacement that leaves its physical host occupied on the map", () => {
    const draft = texasFactionConflictFixture();
    draft.presetMap[1] = {
      ...draft.presetMap[1],
      type: "SYSTEM",
      systemId: factionSystems.mentak.id,
    };
    // Mentak's home remains physically present independently of picks.
    expect(getTexasFactionReplacementOptions(draft, 1)).toEqual([]);
  });

  it("draws one legal fresh reserve faction only after explicit recovery", () => {
    const draft = texasFactionConflictFixture();
    draft.texasDraft!.factionOptions![0] = ["keleres"];
    draft.texasDraft!.factionDrawPile = ["yssaril", "mentak", "sol"];
    expect(getTexasFactionReplacementOptions(draft, 0)).toEqual([]);
    expect(canRedrawTexasConflictingFaction(draft, 0)).toBe(true);
    const next = replaceTexasConflictingFaction(draft, 0, TEXAS_REDRAW_VALUE);
    expect(getSelectedFactions(next.selections).primary[0]).toBe("yssaril");
    expect(next.texasDraft!.factionDrawPile).toEqual(["mentak", "sol"]);
    expect(next.selections[0]).toMatchObject({
      factionReplacements: [
        {
          playerId: 0,
          previousFactionId: "keleres",
          factionId: "yssaril",
          redrawn: true,
        },
      ],
    });
    expect(draft.texasDraft!.factionDrawPile).toEqual([
      "yssaril",
      "mentak",
      "sol",
    ]);
  });

  it("rejects disabled or exhausted fresh redraw without modifying the draft", () => {
    const draft = texasFactionConflictFixture();
    draft.settings.texasAllowFactionRedraw = false;
    expect(canRedrawTexasConflictingFaction(draft, 0)).toBe(false);
    expect(() =>
      replaceTexasConflictingFaction(draft, 0, TEXAS_REDRAW_VALUE),
    ).toThrow("no legal fresh faction");
    draft.settings.texasAllowFactionRedraw = true;
    draft.texasDraft!.factionDrawPile = ["mentak", "sol"];
    expect(canRedrawTexasConflictingFaction(draft, 0)).toBe(false);
    expect(() =>
      replaceTexasConflictingFaction(draft, 0, TEXAS_REDRAW_VALUE),
    ).toThrow("no legal fresh faction");
  });
});
