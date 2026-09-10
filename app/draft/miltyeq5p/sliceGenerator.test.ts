import { afterEach, test, vi } from "vitest";
import { getSystemPool } from "~/utils/system";
import { generateMap } from "../miltyeq/sliceGenerator";
import {
  expectCompleteMap,
  generatorTestSettings,
  seedRandom,
} from "../common/generationTestUtils";

afterEach(() => vi.restoreAllMocks());

test.each([1, 2, 3, 7, 19, 42, 1337, 20260910])(
  "fills ten-slice five-player drafts without exhausting a tier (seed %i)",
  (seed) => {
    seedRandom(seed);
    const settings = {
      ...generatorTestSettings,
      type: "miltyeq5p" as const,
      numSlices: 10,
    };
    const pool = getSystemPool(settings.tileGameSets);
    expectCompleteMap(generateMap(settings, pool), settings, pool);
  },
);

test.each([1, 19, 42, 1337])(
  "fills expansion ten-slice five-player drafts (seed %i)",
  (seed) => {
    seedRandom(seed);
    const settings = {
      ...generatorTestSettings,
      type: "miltyeq5p" as const,
      numSlices: 10,
      tileGameSets: [
        ...generatorTestSettings.tileGameSets,
        "unchartedstars" as const,
      ],
    };
    const pool = getSystemPool(settings.tileGameSets);
    expectCompleteMap(generateMap(settings, pool), settings, pool);
  },
);
