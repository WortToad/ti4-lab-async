import { describe, expect, test, vi } from "vitest";
import { createStore } from "jotai/vanilla";
import { draftStore } from "~/draftStore";
import {
  hydratePlayers,
  hydratedMapStringsAtom,
} from "~/hooks/useHydratedDraft";
import { factionSystems } from "~/data/systemData";
import { draftConfig } from "~/draft/draftConfig";
import { generateEmptyMap } from "~/utils/map";
import { getDraftValidationErrors } from "~/utils/draftValidation";
import { getBasePendingAction } from "./turn";
import { createDraftOrder } from "~/utils/draftOrder.server";
import * as randomization from "./helpers/randomization";
import type { Draft, FactionId } from "~/types";
import {
  chooseBaseKeleresHome,
  getBaseKeleresSetup,
  hasKeleresHomeConflict,
} from "./keleres";

function fixture(): Draft {
  return {
    settings: {
      type: "milty4p",
      draftGameMode: "presetMap",
      factionGameSets: ["base", "pok"],
      tileGameSets: ["base", "pok"],
      numFactions: 4,
      numSlices: 4,
      draftSpeaker: false,
      randomizeMap: false,
      randomizeSlices: false,
      allowEmptyTiles: true,
      allowHomePlanetSearch: false,
    },
    integrations: {},
    players: Array.from({ length: 4 }, (_, id) => ({
      id,
      name: `Player ${id}`,
    })),
    availableFactions: ["keleres", "mentak", "xxcha", "sol"],
    slices: [],
    presetMap: generateEmptyMap(draftConfig.milty4p),
    pickOrder: [0, 1, 2, 3, 3, 2, 1, 0],
    selections: ["keleres", "mentak", "xxcha", "sol"]
      .map((factionId, playerId) => ({
        type: "SELECT_FACTION",
        playerId,
        factionId: factionId as FactionId,
      }))
      .concat([]) as Draft["selections"],
  };
}
function completed() {
  const draft = fixture();
  for (const playerId of [3, 2, 1, 0])
    draft.selections.push({ type: "SELECT_SEAT", playerId, seatIdx: playerId });
  return draft;
}

describe("base Keleres map setup", () => {
  test("waits for completed draft picks and allows only the owner's legal home", () => {
    expect(() => chooseBaseKeleresHome(fixture(), 0, "argent")).toThrow(
      "Finish all",
    );
    const draft = completed();
    expect(getBaseKeleresSetup(draft)).toMatchObject({
      playerId: 0,
      choices: ["argent"],
      ready: true,
    });
    expect(() => chooseBaseKeleresHome(draft, 1, "argent")).toThrow(
      "Only the Keleres",
    );
    expect(() => chooseBaseKeleresHome(draft, 0, "mentak")).toThrow("unplayed");
    const chosen = chooseBaseKeleresHome(draft, 0, "argent");
    expect(getBasePendingAction(draft, 0)?.key).toBe("keleres-home");
    expect(getBasePendingAction(draft, 1)).toBeUndefined();
    expect(getBasePendingAction(chosen, 0)).toBeUndefined();
    expect(getBaseKeleresSetup(chosen)?.chosen).toBe("argent");
    expect(chosen.selections).toEqual(draft.selections);
    expect(() => chooseBaseKeleresHome(chosen, 0, "argent")).toThrow(
      "already chosen",
    );
  });
  test("includes committed Texas factions and occupied minor homes, without reading private staged values", () => {
    const draft = completed();
    draft.settings.draftGameMode = "texasStyle";
    draft.selections = [
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasFaction",
        selections: [
          { playerId: 0, value: "keleres" },
          { playerId: 1, value: "mentak" },
          { playerId: 2, value: "sol" },
          { playerId: 3, value: "hacan" },
        ],
      },
      { type: "SELECT_MINOR_FACTION", playerId: 1, minorFactionId: "xxcha" },
    ];
    draft.pickOrder = [{ kind: "simultaneous", phase: "texasFaction" }, 1];
    draft.stagedSelections = { texasFaction: { 3: "argent" } };
    expect(getBaseKeleresSetup(draft)?.choices).toEqual(["argent"]);
    const next = chooseBaseKeleresHome(draft, 0, "argent");
    expect(
      hydratePlayers(next.players, next.selections).find((p) => p.id === 0),
    ).toMatchObject({ faction: "keleres", homeSystemFactionId: "argent" });
    draft.settings.draftGameMode = "twilightsFall";
    expect(getBaseKeleresSetup(draft)).toBeUndefined();
  });
  test("withholds unresolved map exports and fills the selected home in both formats", () => {
    const draft = completed();
    const atoms = createStore();
    const unsubscribe = atoms.sub(hydratedMapStringsAtom, () => {});
    draftStore
      .getState()
      .draftActions.hydrate("test-keleres", "test-keleres", draft);
    expect(atoms.get(hydratedMapStringsAtom)).toEqual({ ttpg: "", async: "" });
    const chosen = chooseBaseKeleresHome(draft, 0, "argent");
    draftStore.getState().draftActions.update("test-keleres", chosen);
    for (const encoded of Object.values(atoms.get(hydratedMapStringsAtom))) {
      expect(
        encoded.split(" ")[draftConfig.milty4p.homeIdxInMapString[0] - 1],
      ).toBe(factionSystems.argent.id);
    }
    unsubscribe();
  });
  test("final homes exclude physical minor homes but ignore unselected extra slices", () => {
    const draft = completed();
    draft.presetMap[1] = {
      ...draft.presetMap[1],
      type: "SYSTEM",
      systemId: factionSystems.argent.id,
    };
    expect(getBaseKeleresSetup(draft)?.choices).toEqual([]);
    expect(() => chooseBaseKeleresHome(draft, 0, "argent")).toThrow("unplayed");
    draft.settings.draftGameMode = undefined;
    draft.slices = Array.from({ length: 5 }, (_, index) => ({
      name: `Slice ${index}`,
      tiles:
        index === 4
          ? [draft.presetMap[0], draft.presetMap[1]]
          : [draft.presetMap[0]],
    }));
    draft.presetMap[1] = { ...draft.presetMap[1], type: "OPEN" };
    expect(getBaseKeleresSetup(draft)?.choices).toEqual(["argent"]);
    draft.selections.push({ type: "SELECT_SLICE", playerId: 0, sliceIdx: 4 });
    expect(getBaseKeleresSetup(draft)?.choices).toEqual([]);
  });
  test("redeals a forced private quartet before publishing a playable lobby", () => {
    const draft = fixture();
    draft.settings.draftGameMode = undefined;
    draft.settings.numPreassignedFactions = 1;
    draft.availableFactions = ["keleres", "mentak", "xxcha", "argent", "sol"];
    let deals = 0;
    const shuffle = vi
      .spyOn(randomization, "shuffle")
      .mockImplementation(<T>(array: T[], limit?: number): T[] => {
        if (typeof array[0] === "string" && ++deals > 1)
          return [array[0], array[1], array[2], array[4], array[3]];
        return array.slice(0, limit);
      });
    try {
      const dealt = createDraftOrder(draft);
      expect(deals).toBe(2);
      expect(dealt.playerFactionPool).toEqual({
        0: ["keleres"],
        1: ["mentak"],
        2: ["xxcha"],
        3: ["sol"],
      });
    } finally {
      shuffle.mockRestore();
    }
  });
  test("rejects forced conflicting pools and detects recoverable existing conflicts", () => {
    const draft = completed();
    draft.availableFactions = ["keleres", "mentak", "xxcha", "argent"];
    expect(
      getDraftValidationErrors({ ...draft, selections: [] }).join(" "),
    ).toContain("Increase the faction pool");
    draft.availableFactions.push("sol");
    draft.settings.numFactions = 5;
    expect(
      getDraftValidationErrors({ ...draft, selections: [] }).join(" "),
    ).not.toContain("Increase the faction pool");
    draft.selections[3] = {
      type: "SELECT_FACTION",
      playerId: 3,
      factionId: "argent",
    };
    expect(hasKeleresHomeConflict(draft.selections)).toBe(true);
    expect(getBaseKeleresSetup(draft)?.choices).toEqual([]);
    draft.players[0].homeSystemFactionId = "argent";
    expect(getBaseKeleresSetup(draft)?.chosen).toBeUndefined();
    expect(
      hydratePlayers(draft.players, draft.selections)[0].homeSystemFactionId,
    ).toBeUndefined();
  });
});
