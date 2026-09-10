import { afterEach, expect, test, vi } from "vitest";
import { generateMap, generateSlices } from "../miltyeq/sliceGenerator";
import {
  coreGenerateMap,
  coreRerollSlice,
  hasHighQualityAdjacent,
  hasPathToMecatol,
  checkFirstTileToMecatolIsSafe,
} from "./sliceGenerator";
import { getSystemPool } from "~/utils/system";
import { generatorTestSettings, seedRandom } from "./generationTestUtils";
import {
  hasAdjacentSliceAnomalies,
  isAlpha,
  isBeta,
  isLegendary,
} from "../helpers/sliceGeneration";
import { miltySystemTiers } from "~/data/miltyTileTiers";
import { SLICE_SHAPES } from "../sliceShapes";
import { calculateSliceValue, getSliceValueConfig } from "~/stats";
import { systemData } from "~/data/systemData";
import { SliceGenerationConfig } from "../types";

afterEach(() => vi.restoreAllMocks());

const impossible: [string, SliceGenerationConfig][] = [
  [
    "even the richest tiles cannot reach the minimum",
    { minSliceValue: 100, maxSliceValue: 200 },
  ],
  [
    "available tiles cannot meet minimum resources",
    { minOptimalResources: 100 },
  ],
  [
    "available tiles cannot meet minimum influence",
    { minOptimalInfluence: 100 },
  ],
  ["minimum exceeds maximum value", { minSliceValue: 11, maxSliceValue: 10 }],
  [
    "minimum exceeds maximum legendary count",
    { minLegendaries: 2, maxLegendaries: 1 },
  ],
  ["more safe paths than slices", { safePathToMecatol: 7 }],
  ["more safe centers than slices", { centerTileNotEmpty: 7 }],
  ["more adjacent high tiles than slices", { highQualityAdjacent: 7 }],
  ["more alpha tiles than slices can accept", { numAlphas: 7 }],
];

test.each(impossible)(
  "rejects impossible global requirements without random retries: %s",
  (_, config) => {
    const random = seedRandom(42, true);
    expect(
      generateSlices(6, getSystemPool(["base", "pok"]), config),
    ).toBeUndefined();
    expect(random).not.toHaveBeenCalled();
  },
);

test.each([1, 42, 1337])(
  "preserves configured global, value and layout requirements (seed %i)",
  (seed) => {
    seedRandom(seed);
    const config = {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      maxLegendaries: 1,
      minSliceValue: 6,
      maxSliceValue: 10,
      minOptimalResources: 2,
      minOptimalInfluence: 3,
      safePathToMecatol: 3,
      centerTileNotEmpty: 3,
      highQualityAdjacent: 3,
      mecatolPathSystemIndices: [1, 3],
    };
    const slices = generateSlices(6, getSystemPool(["base", "pok"]), config);
    expect(slices).toHaveLength(6);
    const all = slices!.flat().map((id) => systemData[id]);
    expect(all.filter(isAlpha).length).toBeGreaterThanOrEqual(2);
    expect(all.filter(isBeta).length).toBeGreaterThanOrEqual(2);
    expect(all.filter(isLegendary)).toHaveLength(1);
    expect(
      slices!.filter((slice) => hasPathToMecatol(slice, [1, 3])).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      slices!.filter((slice) => checkFirstTileToMecatolIsSafe(slice, 1)).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      slices!.filter((slice) => hasHighQualityAdjacent(slice, miltySystemTiers))
        .length,
    ).toBeGreaterThanOrEqual(3);
    for (const slice of slices!) {
      expect(hasAdjacentSliceAnomalies(slice, SLICE_SHAPES.milty_eq)).toBe(
        false,
      );
      const systems = slice.map((id) => systemData[id]);
      const value = calculateSliceValue(
        systems,
        getSliceValueConfig(undefined, [], [1, 3]),
      );
      expect(value).toBeGreaterThanOrEqual(6);
      expect(value).toBeLessThanOrEqual(10);
      expect(
        systems.reduce(
          (sum, system) =>
            sum + system.optimalSpend.resources + system.optimalSpend.flex,
          0,
        ),
      ).toBeGreaterThanOrEqual(2);
      expect(
        systems.reduce(
          (sum, system) =>
            sum + system.optimalSpend.influence + system.optimalSpend.flex,
          0,
        ),
      ).toBeGreaterThanOrEqual(3);
    }
  },
);

test("counts actual home-adjacent positions instead of the equidistant tile", () => {
  expect(
    hasHighQualityAdjacent(["high", "low", "low", "low"], {
      high: "high",
      low: "low",
    }),
  ).toBe(true);
  expect(
    hasHighQualityAdjacent(["low", "low", "low", "high"], {
      high: "high",
      low: "low",
    }),
  ).toBe(false);
});

test("rejects a complete map pool shortage before invoking its slice generator", () => {
  const generate = vi.fn();
  expect(
    coreGenerateMap(
      generatorTestSettings,
      getSystemPool(["base", "pok"]).slice(0, 29),
      0,
      generate,
    ),
  ).toBeUndefined();
  expect(generate).not.toHaveBeenCalled();
});

test("a single-slice reroll keeps required wormholes and draft-wide layout counts", () => {
  seedRandom(42);
  const settings = {
    ...generatorTestSettings,
    sliceGenerationConfig: {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      maxLegendaries: 3,
      safePathToMecatol: 6,
      centerTileNotEmpty: 6,
      highQualityAdjacent: 6,
      mecatolPathSystemIndices: [1, 3],
    },
  };
  const generated = generateMap(settings, getSystemPool(["base", "pok"]))!;
  const slices = generated.slices;
  expect(slices).toHaveLength(6);
  const index = slices.findIndex((slice) =>
    slice.some((id) => isAlpha(systemData[id])),
  );
  const result = coreRerollSlice(settings, generated.map, slices, index);
  expect(result?.valid).toBe(true);
  const rerolled = slices.map((slice, idx) =>
    idx === index ? result!.slice : slice,
  );
  expect(
    rerolled.flat().filter((id) => isAlpha(systemData[id])).length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    rerolled.every(
      (slice) =>
        hasPathToMecatol(slice, [1, 3]) &&
        checkFirstTileToMecatolIsSafe(slice, 1) &&
        hasHighQualityAdjacent(slice, miltySystemTiers),
    ),
  ).toBe(true);
});
