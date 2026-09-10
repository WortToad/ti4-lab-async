import { describe, expect, test } from "vitest";
import { factionSystems } from "~/data/systemData";
import { draftConfig } from "~/draft/draftConfig";
import type { DraftSelection, FactionId, SystemTile } from "~/types";
import {
  canCompleteFactionDraft,
  getOccupiedFactionHomes,
  type FactionDraft,
} from "./factionFeasibility";

function fixture(): FactionDraft {
  return {
    settings: {
      type: "milty4p",
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
    players: Array.from({ length: 4 }, (_, id) => ({ id, name: `${id}` })),
    selections: [],
    availableFactions: ["keleres", "mentak", "xxcha", "sol"],
    slices: [],
    presetMap: [],
  };
}

function primary(playerId: number, factionId: FactionId): DraftSelection {
  return { type: "SELECT_FACTION", playerId, factionId };
}

function home(faction: FactionId, idx = 0): SystemTile {
  return {
    idx,
    type: "SYSTEM",
    systemId: factionSystems[faction].id,
    position: { x: 0, y: 0 },
  };
}

describe("faction completion feasibility", () => {
  test("accepts tight pools with a free host, but rejects mandatory Keleres and all three hosts", () => {
    const draft = fixture();
    expect(canCompleteFactionDraft(draft)).toBe(true);
    draft.availableFactions = ["keleres", "mentak", "xxcha", "argent"];
    expect(canCompleteFactionDraft(draft)).toBe(false);
    draft.availableFactions.push("sol");
    expect(canCompleteFactionDraft(draft)).toBe(true);
  });

  test("accepts omitting Keleres even when no host is free", () => {
    const draft = fixture();
    draft.availableFactions = ["keleres", "mentak", "xxcha", "argent", "sol"];
    draft.selections = [
      primary(0, "mentak"),
      primary(1, "xxcha"),
      primary(2, "argent"),
    ];
    expect(canCompleteFactionDraft(draft)).toBe(true);
    expect(canCompleteFactionDraft(draft, primary(3, "keleres"))).toBe(false);
    expect(canCompleteFactionDraft(draft, primary(3, "sol"))).toBe(true);
  });

  test("keeps the last main pick available for Keleres in a full shared pool", () => {
    const draft = fixture();
    draft.settings.minorFactionsInSharedPool = true;
    draft.availableFactions = [
      "keleres",
      "sol",
      "hacan",
      "barony",
      "yin",
      "naalu",
      "nekro",
      "yssaril",
    ];
    expect(canCompleteFactionDraft(draft)).toBe(true);
    draft.selections = [
      primary(0, "sol"),
      primary(1, "hacan"),
      primary(2, "barony"),
    ];
    expect(canCompleteFactionDraft(draft, primary(3, "yin"))).toBe(false);
    expect(canCompleteFactionDraft(draft, primary(3, "keleres"))).toBe(true);
    expect(
      canCompleteFactionDraft(draft, {
        type: "SELECT_MINOR_FACTION",
        playerId: 3,
        minorFactionId: "keleres",
      }),
    ).toBe(false);
  });

  test("checks mandatory host conflicts across separate main and minor pools", () => {
    const draft = fixture();
    draft.settings.numMinorFactions = 4;
    draft.availableMinorFactions = ["argent", "hacan", "barony", "yin"];
    expect(canCompleteFactionDraft(draft)).toBe(false);
    draft.availableMinorFactions.push("naalu");
    expect(canCompleteFactionDraft(draft)).toBe(true);
    expect(
      canCompleteFactionDraft(draft, {
        type: "SELECT_MINOR_FACTION",
        playerId: 0,
        minorFactionId: "argent",
      }),
    ).toBe(false);
  });

  test("matches shared identities across overlapping separate pools", () => {
    const draft = fixture();
    draft.settings.numMinorFactions = 4;
    draft.availableFactions = ["sol", "hacan", "barony", "yin"];
    draft.availableMinorFactions = ["sol", "hacan", "barony", "yin"];
    expect(canCompleteFactionDraft(draft)).toBe(false);
    draft.availableMinorFactions.push("naalu", "nekro", "yssaril", "mentak");
    expect(canCompleteFactionDraft(draft)).toBe(true);
  });

  test("honors private hands and rejects a pick that strands another player's only option", () => {
    const draft = fixture();
    draft.availableFactions = ["keleres", "sol", "hacan", "barony"];
    draft.playerFactionPool = {
      0: ["keleres", "sol"],
      1: ["sol"],
      2: ["hacan"],
      3: ["barony"],
    };
    expect(canCompleteFactionDraft(draft)).toBe(true);
    expect(canCompleteFactionDraft(draft, primary(0, "sol"))).toBe(false);
    expect(canCompleteFactionDraft(draft, primary(0, "keleres"))).toBe(true);
  });

  test("reassigns overlapping choices when a greedy assignment would fail", () => {
    const draft = fixture();
    draft.playerFactionPool = {
      0: ["sol", "hacan"],
      1: ["hacan", "barony"],
      2: ["sol", "hacan"],
      3: ["yin"],
    };
    expect(canCompleteFactionDraft(draft)).toBe(true);
    draft.playerFactionPool[1] = ["sol", "hacan"];
    expect(canCompleteFactionDraft(draft)).toBe(false);
  });

  test("uses committed Texas factions and current hands without reading private staged choices", () => {
    const draft = fixture();
    draft.settings.draftGameMode = "texasStyle";
    draft.texasDraft = {
      seatOrder: [0, 1, 2, 3],
      seatAssignments: { 0: 0, 1: 1, 2: 2, 3: 3 },
      speakerId: 0,
      factionOptions: {
        0: ["keleres"],
        1: ["mentak"],
        2: ["xxcha"],
        3: ["argent"],
      },
    };
    expect(canCompleteFactionDraft(draft)).toBe(false);
    draft.texasDraft.factionOptions![3].push("sol");
    expect(canCompleteFactionDraft(draft)).toBe(true);
    draft.selections = [
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasFaction",
        selections: [
          { playerId: 0, value: "keleres" },
          { playerId: 1, value: "mentak" },
          { playerId: 2, value: "xxcha" },
          { playerId: 3, value: "argent" },
        ],
      },
    ];
    expect(canCompleteFactionDraft(draft)).toBe(false);
  });

  test("ignores Twilight's Fall's independent faction-component rules", () => {
    const draft = fixture();
    draft.settings.draftGameMode = "twilightsFall";
    draft.availableFactions = [];
    expect(canCompleteFactionDraft(draft)).toBe(true);
  });
});

describe("prepared faction home occupancy", () => {
  test("counts fixed minor home systems but ignores normal-map main home previews", () => {
    const draft = fixture();
    draft.presetMap = [home("argent")];
    expect(getOccupiedFactionHomes(draft)).toEqual(["argent"]);
    expect(canCompleteFactionDraft(draft)).toBe(false);
    const homeIdx = draftConfig.milty4p.homeIdxInMapString[0];
    draft.presetMap = Array.from({ length: homeIdx + 1 }, (_, idx) => ({
      type: "OPEN",
      idx,
      position: { x: 0, y: 0 },
    }));
    draft.presetMap[homeIdx] = home("mentak", homeIdx);
    draft.selections = [primary(0, "mentak")];
    expect(getOccupiedFactionHomes(draft)).toEqual([]);
    expect(canCompleteFactionDraft(draft)).toBe(true);
  });

  test("counts selected extra slices and prospective picks, but not unused extras or home previews", () => {
    const draft = fixture();
    draft.slices = Array.from({ length: 5 }, (_, index) => ({
      name: `${index}`,
      tiles: [home("mentak")],
    }));
    draft.slices[4].tiles.push(home("argent", 1));
    expect(getOccupiedFactionHomes(draft)).toEqual([]);
    expect(canCompleteFactionDraft(draft)).toBe(true);
    const selection: DraftSelection = {
      type: "SELECT_SLICE",
      playerId: 0,
      sliceIdx: 4,
    };
    expect(getOccupiedFactionHomes(draft, selection)).toEqual(["argent"]);
    expect(canCompleteFactionDraft(draft, selection)).toBe(false);
    expect(draft.selections).toEqual([]);
  });

  test("counts all mandatory slices in an exactly sized pool", () => {
    const draft = fixture();
    draft.slices = Array.from({ length: 4 }, (_, index) => ({
      name: `${index}`,
      tiles: [home("mentak")],
    }));
    draft.slices[3].tiles.push(home("argent", 1));
    expect(getOccupiedFactionHomes(draft)).toEqual(["argent"]);
    expect(canCompleteFactionDraft(draft)).toBe(false);
  });

  test("preset maps use only their fixed systems, not unused slice metadata", () => {
    const draft = fixture();
    draft.settings.draftGameMode = "presetMap";
    draft.slices = [
      { name: "unused", tiles: [home("mentak"), home("argent", 1)] },
    ];
    draft.selections = [{ type: "SELECT_SLICE", playerId: 0, sliceIdx: 0 }];
    expect(getOccupiedFactionHomes(draft)).toEqual([]);
    draft.presetMap = [home("argent")];
    expect(canCompleteFactionDraft(draft)).toBe(false);
  });
});
