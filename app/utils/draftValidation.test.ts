import { describe, expect, it } from "vitest";
import { buildMiniMiltySettings } from "~/draft/minimilty/buildMiniMilty";
import { buildTexasDraft } from "~/draft/texas/buildTexasDraft";
import { draftStore } from "~/draftStore";
import { getFactionPool } from "~/utils/factions";
import type { Draft } from "~/types";
import { getDraftValidationErrors } from "./draftValidation";

function miniMiltyDraft(): Draft {
  const players = Array.from({ length: 4 }, (_, id) => ({
    id,
    name: `Player ${id}`,
  }));
  const settings = buildMiniMiltySettings({ players });
  return {
    settings,
    players,
    availableFactions: settings.allowedFactions!.slice(0, settings.numFactions),
    slices: [],
    presetMap: settings.presetMap!,
    integrations: {},
    selections: [],
    pickOrder: [],
  };
}

describe("draft preparation validation", () => {
  it("accepts a complete Mini-Milty map without slices and catches an edited empty tile", () => {
    const draft = miniMiltyDraft();
    expect(getDraftValidationErrors(draft)).toEqual([]);
    const index = draft.presetMap.findIndex(
      (tile) => tile.type === "SYSTEM" && tile.idx !== 0,
    );
    const tile = draft.presetMap[index];
    draft.presetMap[index] = {
      idx: tile.idx,
      position: tile.position,
      type: "OPEN",
    };
    expect(getDraftValidationErrors(draft)).toContain("Map has empty tiles");
    draft.settings.allowEmptyTiles = true;
    expect(getDraftValidationErrors(draft)).toEqual([]);
  });

  it("checks generated factions instead of trusting the configured count", () => {
    const draft = miniMiltyDraft();
    draft.availableFactions = draft.availableFactions.slice(0, 3);
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("at least 4 factions"),
    );
    draft.availableFactions.push(draft.availableFactions[0]);
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("pool contains 3"),
    );
  });

  it("reserves enough factions for shared minor pools and individual faction bags", () => {
    const draft = miniMiltyDraft();
    draft.settings.minorFactionsInSharedPool = true;
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("at least 8 factions"),
    );
    draft.settings.minorFactionsInSharedPool = false;
    draft.settings.numPreassignedFactions = 3;
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("at least 12 factions"),
    );
  });

  it("catches a separate minor pool that leaves a player without a faction", () => {
    const draft = miniMiltyDraft();
    draft.settings.numMinorFactions = 4;
    draft.availableMinorFactions = getFactionPool(["base"]).slice(5, 8);
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("minor faction pool needs at least 4"),
    );
  });

  it("accepts a small preview with bans from a larger source, and rejects an undersized source", () => {
    const draft = miniMiltyDraft();
    draft.settings.modifiers = { banFactions: { numFactions: 1 } };
    expect(getDraftValidationErrors(draft)).toEqual([]);
    draft.settings.allowedFactions = draft.availableFactions;
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("faction source needs"),
    );
  });

  it("does not count Keleres as a playable separate minor faction", () => {
    const draft = miniMiltyDraft();
    draft.settings.numMinorFactions = 4;
    draft.availableMinorFactions = [
      ...getFactionPool(["base"]).slice(5, 8),
      "keleres",
    ];
    expect(getDraftValidationErrors(draft)).toContainEqual(
      expect.stringContaining("minor faction pool needs at least 4"),
    );
  });

  it("does not mistake an unfinished Texas map for a failed slice generator", () => {
    const draft = miniMiltyDraft();
    const texas = buildTexasDraft({
      settings: {
        ...draft.settings,
        draftGameMode: "texasStyle",
        modifiers: { banFactions: { numFactions: 1 } },
      },
      players: draft.players,
      integrations: {},
    });
    expect(texas.slices).toEqual([]);
    expect(texas.presetMap.some((tile) => tile.type === "OPEN")).toBe(true);
    expect(getDraftValidationErrors(texas)).toEqual([]);
  });

  it("catches a missing slice even when empty map tiles are allowed", () => {
    const draft = miniMiltyDraft();
    draft.settings.draftGameMode = undefined;
    draft.settings.allowEmptyTiles = true;
    draftStore.getState().actions.initializeDraftFromSavedState(draft);
    expect(getDraftValidationErrors(draftStore.getState().draft)).toContain(
      "The slice pool needs at least one slice for each player.",
    );
  });
});
