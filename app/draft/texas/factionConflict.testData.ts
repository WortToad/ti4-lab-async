import type { Draft, FactionId } from "~/types";

export function texasFactionConflictFixture(): Draft {
  const factions: FactionId[] = [
    "keleres",
    "mentak",
    "xxcha",
    "argent",
    "hacan",
  ];
  const alternatives: FactionId[] = [
    "sol",
    "barony",
    "saar",
    "jolnar",
    "sardakk",
  ];
  const factionOptions = Object.fromEntries(
    factions.map((faction, playerId) => [
      playerId,
      [faction, alternatives[playerId]],
    ]),
  );
  return {
    settings: {
      type: "milty5p",
      draftGameMode: "texasStyle",
      factionGameSets: ["base", "pok"],
      tileGameSets: ["base", "pok"],
      numFactions: 12,
      numSlices: 0,
      draftSpeaker: false,
      randomizeMap: false,
      randomizeSlices: false,
      allowEmptyTiles: true,
      allowHomePlanetSearch: false,
      texasFactionHandSize: 2,
      texasAllowFactionRedraw: true,
    },
    players: factions.map((_, id) => ({ id, name: `Player ${id}` })),
    integrations: {},
    availableFactions: [...factions, ...alternatives, "naalu", "yssaril"],
    slices: [],
    presetMap: [
      {
        idx: 0,
        type: "SYSTEM",
        systemId: "18",
        position: { x: 0, y: 0 },
      },
      { idx: 1, type: "OPEN", position: { x: 0, y: -1 } },
    ],
    pickOrder: [
      { kind: "simultaneous", phase: "texasFaction" },
      { kind: "simultaneous", phase: "texasBlueKeep1" },
      { kind: "simultaneous", phase: "texasBlueKeep2" },
      { kind: "simultaneous", phase: "texasRedKeep" },
      0,
    ],
    selections: [
      {
        type: "COMMIT_SIMULTANEOUS",
        phase: "texasFaction",
        selections: factions.map((value, playerId) => ({ playerId, value })),
      },
    ],
    texasDraft: {
      seatOrder: [2, 0, 4, 1, 3],
      seatAssignments: { 2: 0, 0: 1, 4: 2, 1: 3, 3: 4 },
      speakerId: 2,
      factionOptions,
      initialFactionOptions: structuredClone(factionOptions),
      factionDrawPile: ["naalu", "yssaril"],
      initialFactionDrawPile: ["naalu", "yssaril"],
      tileHands: {
        blue: { 0: ["19", "20", "21"], 1: ["22", "23", "24"] },
        red: {},
      },
      initialTileHands: {
        blue: { 0: ["19", "20", "21"], 1: ["22", "23", "24"] },
        red: {},
      },
      tileKeeps: { blue: {}, red: {} },
      playerTiles: { 0: ["19", "20", "21", "39", "40"] },
    },
  };
}
