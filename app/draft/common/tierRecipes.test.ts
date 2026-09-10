import { afterEach, expect, test, vi } from "vitest";
import { createSliceTierSampler } from "./tierRecipes";
import { getSystemPool } from "~/utils/system";
import { groupSystemsByTier } from "../helpers/sliceGeneration";
import { miltySystemTiers } from "~/data/miltyTileTiers";
import { seedRandom } from "./generationTestUtils";

afterEach(() => vi.restoreAllMocks());

test("avoids the twenty-high-tier recipe when only twelve high tiles exist", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const systems = groupSystemsByTier(
    getSystemPool(["base", "pok"]),
    miltySystemTiers,
  );
  expect(systems.high).toHaveLength(12);
  const sample = createSliceTierSampler(10, systems, [
    { weight: 2, value: ["red", "red", "high", "high"] },
    { weight: 3, value: ["red", "high", "med", "low"] },
  ]);
  expect(sample).toBeDefined();
  const tiers = sample!().flat();
  for (const tier of ["high", "med", "low", "red"] as const) {
    expect(tiers.filter((value) => value === tier).length).toBeLessThanOrEqual(
      systems[tier].length,
    );
  }
  expect(tiers).toHaveLength(40);
});

test("rejects insufficient total supply without sampling", () => {
  const random = seedRandom(1, true);
  expect(
    createSliceTierSampler(3, { high: ["19"], med: [], low: [], red: ["39"] }, [
      { weight: 1, value: ["high", "red"] },
    ]),
  ).toBeUndefined();
  expect(random).not.toHaveBeenCalled();
});

test("rejects a forced tier shortage even when total supply is sufficient", () => {
  const random = seedRandom(1, true);
  expect(
    createSliceTierSampler(
      2,
      { high: ["19"], med: ["20", "21", "22"], low: [], red: ["39", "40"] },
      [{ weight: 1, value: ["high", "red"] }],
    ),
  ).toBeUndefined();
  expect(random).not.toHaveBeenCalled();
});

test("looks ahead so an early weighted choice cannot strand later slices", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const sample = createSliceTierSampler(
    2,
    { high: ["19", "20"], med: [], low: ["21", "22"], red: [] },
    [
      { weight: 10, value: ["high", "high", "low"] },
      { weight: 1, value: ["high", "low"] },
    ],
  );
  expect(sample!()).toEqual([
    ["high", "low"],
    ["high", "low"],
  ]);
});
