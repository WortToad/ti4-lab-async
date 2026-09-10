import { afterEach, expect, test, vi } from "vitest";
import {
  prepareMultidraft,
  prepareMultidraftDraft,
} from "./prepareDraft.server";
import { draftConfig } from "~/draft/draftConfig";
import { makeLobbyPlayers } from "~/draft/lobbySetup";
import {
  generatorTestSettings,
  seedRandom,
} from "~/draft/common/generationTestUtils";
import { generateEmptyMap } from "~/utils/map";
import { getFactionPool } from "~/utils/factions";
import { getSystemPool } from "~/utils/system";
import { factions } from "~/data/factionData";
import { systemIdsInSlice } from "~/utils/slice";
import type { DraftSettings } from "~/types";

afterEach(() => vi.restoreAllMocks());

const players = makeLobbyPlayers(4);
const pool = getSystemPool(["base", "pok"]);
const presetSlices = Array.from({ length: 4 }, (_, idx) =>
  pool.slice(idx * 5, idx * 5 + 5),
);
const settings: DraftSettings = {
  ...generatorTestSettings,
  type: "milty4p",
  numSlices: 4,
  numFactions: 4,
  presetSlices,
  presetMap: generateEmptyMap(draftConfig.milty4p),
};

test("every lobby respects faction exclusions, priorities and expansion quotas", () => {
  seedRandom(42);
  const expansion = getFactionPool(["discordant"]).slice(0, 3);
  const input: DraftSettings = {
    ...settings,
    factionGameSets: ["base", "pok", "discordant"],
    allowedFactions: ["arborec", "hacan", "sol", ...expansion],
    requiredFactions: ["hacan", expansion[0], "creuss"],
    factionStratification: { "base|pok": 2, "discordant|discordantexp": 2 },
  };
  const before = structuredClone(input);
  const drafts = prepareMultidraft(input, players, 3);
  expect(drafts).toHaveLength(3);
  for (const draft of drafts) {
    expect(draft.availableFactions).toHaveLength(4);
    expect(draft.availableFactions).toContain("hacan");
    expect(draft.availableFactions).toContain(expansion[0]);
    expect(draft.availableFactions).not.toContain("creuss");
    expect(
      draft.availableFactions.filter((id) => factions[id].set === "base"),
    ).toHaveLength(2);
    expect(
      draft.availableFactions.filter((id) => factions[id].set === "discordant"),
    ).toHaveLength(2);
  }
  expect(input).toEqual(before);
});

test("uses the supplied slice and map template for every lobby without regenerating", () => {
  const generator = vi.spyOn(draftConfig.milty4p, "generateSlices");
  const drafts = prepareMultidraft(settings, players, 2);
  for (const draft of drafts) {
    expect(draft.slices.map(systemIdsInSlice).flat().sort()).toEqual(
      presetSlices.flat().sort(),
    );
    expect(draft.presetMap).toEqual(settings.presetMap);
  }
  expect(generator).not.toHaveBeenCalled();
});

test("rejects prepared pools using the same validator as single-lobby creation", () => {
  expect(() =>
    prepareMultidraft({ ...settings, allowedFactions: ["hacan"] }, players, 2),
  ).toThrow("pool contains 1");
});

test("rejects a malformed batch count before generating anything", () => {
  const generator = vi.spyOn(draftConfig.milty4p, "generateSlices");
  for (const count of [NaN, 0, 1, 2.5, 10])
    expect(() => prepareMultidraft(settings, players, count)).toThrow(
      "between 2 and 9",
    );
  expect(generator).not.toHaveBeenCalled();
});

test("prepares Texas directly with complete tile/faction hands and redraw validation", () => {
  seedRandom(42);
  const draft = prepareMultidraftDraft(
    {
      ...settings,
      draftGameMode: "texasStyle",
      texasFactionHandSize: 3,
      texasAllowFactionRedraw: false,
    },
    players,
  );
  expect(draft.slices).toEqual([]);
  for (const player of players)
    expect(draft.texasDraft?.factionOptions?.[player.id]).toHaveLength(3);
});
