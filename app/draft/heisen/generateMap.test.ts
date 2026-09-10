import { afterEach, expect, test, vi } from "vitest";
import { systemData } from "~/data/systemData";
import { getSystemPool } from "~/utils/system";
import { generateMap } from "./generateMap";
import {
  expectCompleteMap,
  generatorTestSettings,
  seedRandom,
} from "../common/generationTestUtils";
import { hasAdjacentAnomalies } from "../common/sliceGenerator";

afterEach(() => vi.restoreAllMocks());

test.each([1, 2, 3, 7, 19, 42, 1337, 20260910])(
  "generates a complete balanced Nucleus map (seed %i)",
  (seed) => {
    seedRandom(seed);
    const settings = { ...generatorTestSettings, type: "heisen" as const };
    const pool = getSystemPool(settings.tileGameSets);
    const result = generateMap(settings, pool);
    expectCompleteMap(result, settings, pool);
    const locations = Object.fromEntries(
      result!.map
        .filter((tile) => tile.type === "SYSTEM")
        .map((tile) => [tile.idx, tile.systemId]),
    );
    expect(hasAdjacentAnomalies(locations)).toBe(false);
  },
);

test.each([1, 42, 1337])(
  "generates a complete eight-player Nucleus map (seed %i)",
  (seed) => {
    seedRandom(seed);
    const settings = {
      ...generatorTestSettings,
      type: "heisen8p" as const,
      numSlices: 8,
    };
    const pool = getSystemPool(settings.tileGameSets);
    expectCompleteMap(generateMap(settings, pool), settings, pool);
  },
);

test("rejects insufficient Nucleus supply before random retries", () => {
  const random = seedRandom(42, true);
  expect(
    generateMap(
      { ...generatorTestSettings, type: "heisen" },
      getSystemPool(["base", "pok"]).slice(0, 29),
    ),
  ).toBeUndefined();
  expect(random).not.toHaveBeenCalled();
});

test("rejects impossible Nucleus slice values before map retries", () => {
  const random = seedRandom(42, true);
  expect(
    generateMap(
      {
        ...generatorTestSettings,
        type: "heisen",
        sliceGenerationConfig: { minSliceValue: 100, maxSliceValue: 200 },
      },
      getSystemPool(["base", "pok"]),
    ),
  ).toBeUndefined();
  expect(random).not.toHaveBeenCalled();
});

test("honors a configured zero-legendary Nucleus map", () => {
  seedRandom(42);
  const settings = {
    ...generatorTestSettings,
    type: "heisen" as const,
    sliceGenerationConfig: { minLegendaries: 0, maxLegendaries: 0 },
  };
  const pool = getSystemPool(["base", "pok"]);
  const result = generateMap(settings, pool);
  expectCompleteMap(result, settings, pool);
  const systems = [
    ...result!.slices.flat(),
    ...result!.map
      .filter((tile) => tile.type === "SYSTEM")
      .map((tile) => tile.systemId),
  ];
  expect(
    systems.filter((id) =>
      systemData[id].planets.some((planet) => planet.legendary),
    ),
  ).toHaveLength(0);
});
