import { afterEach, expect, test, vi } from "vitest";
import { generateMap, generateSlices } from "./sliceGenerator";
import { getSystemPool } from "~/utils/system";
import {
  expectCompleteMap,
  generatorTestSettings,
  seedRandom,
} from "../common/generationTestUtils";
import { systemData } from "~/data/systemData";
import { isAlpha, isBeta, isLegendary } from "../helpers/sliceGeneration";

afterEach(() => vi.restoreAllMocks());

for (const numSlices of [6, 8, 10]) {
  test.each([1, 2, 3, 7, 19, 42, 1337, 20260910])(
    `generates complete unique maps with ${numSlices} slices (seed %i)`,
    (seed) => {
      seedRandom(seed);
      const settings = { ...generatorTestSettings, numSlices };
      const pool = getSystemPool(settings.tileGameSets);
      const result = generateMap(settings, pool);
      expectCompleteMap(result, settings, pool);
      const systems = result!.slices.flat().map((id) => systemData[id]);
      expect(systems.filter(isAlpha).length).toBeGreaterThanOrEqual(2);
      expect(systems.filter(isBeta).length).toBeGreaterThanOrEqual(2);
      expect(systems.filter(isLegendary).length).toBeGreaterThanOrEqual(1);
    },
  );
}

test.each([1, 19, 42, 1337])(
  "generates with every expansion enabled (seed %i)",
  (seed) => {
    seedRandom(seed);
    const settings = {
      ...generatorTestSettings,
      tileGameSets: [
        "base",
        "pok",
        "discordant",
        "discordantexp",
        "unchartedstars",
      ] as const,
    };
    const mutableSettings = {
      ...settings,
      tileGameSets: [...settings.tileGameSets],
    };
    const pool = getSystemPool(mutableSettings.tileGameSets);
    expectCompleteMap(
      generateMap(mutableSettings, pool),
      mutableSettings,
      pool,
    );
  },
);

test("rejects a pool too small to fill both slices and the fixed map without sampling", () => {
  const random = seedRandom(42, true);
  expect(
    generateMap(
      generatorTestSettings,
      getSystemPool(["base", "pok"]).slice(0, 25),
    ),
  ).toBeUndefined();
  expect(random).not.toHaveBeenCalled();
});

test("rejects a missing wormhole supply before shuffling tiles", () => {
  const random = seedRandom(42, true);
  const pool = getSystemPool(["base", "pok"]).filter(
    (id) => !isAlpha(systemData[id]),
  );
  expect(generateSlices(6, pool)).toBeUndefined();
  expect(random).not.toHaveBeenCalled();
});
