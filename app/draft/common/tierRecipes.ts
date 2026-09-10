import { ChoosableTier, SliceChoice, TieredSystems } from "../types";
import { weightedChoice } from "../helpers/randomization";

const TIERS: ChoosableTier[] = ["high", "med", "low", "red"];

/** Select only recipes whose remaining slices can still be filled from the pool. */
export function createSliceTierSampler(
  sliceCount: number,
  systems: TieredSystems,
  choices: SliceChoice[],
): (() => ChoosableTier[][]) | undefined {
  if (!Number.isInteger(sliceCount) || sliceCount < 1) return undefined;

  const options = choices
    .filter((choice) => choice.weight > 0)
    .map((choice) => ({
      ...choice,
      counts: TIERS.map(
        (tier) => choice.value.filter((value) => value === tier).length,
      ),
    }));
  if (!options.length) return undefined;
  const available = TIERS.map((tier) => systems[tier].length);
  const minimums = TIERS.map((_, idx) =>
    Math.min(...options.map((option) => option.counts[idx])),
  );
  const minimumSize = Math.min(...options.map((option) => option.value.length));
  const memo = new Map<string, boolean>();
  const subtract = (pool: number[], counts: number[]) =>
    pool.map((count, idx) => count - counts[idx]);

  const canFill = (remaining: number, pool: number[]): boolean => {
    if (pool.some((count) => count < 0)) return false;
    if (remaining === 0) return true;
    if (pool.some((count, idx) => count < minimums[idx] * remaining))
      return false;
    if (pool.reduce((sum, count) => sum + count, 0) < minimumSize * remaining)
      return false;
    const key = `${remaining}:${pool.join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const possible = options.some((option) =>
      canFill(remaining - 1, subtract(pool, option.counts)),
    );
    memo.set(key, possible);
    return possible;
  };

  if (!canFill(sliceCount, available)) return undefined;

  return () => {
    let remainingPool = [...available];
    return Array.from({ length: sliceCount }, (_, idx) => {
      const possible = options.filter((option) =>
        canFill(sliceCount - idx - 1, subtract(remainingPool, option.counts)),
      );
      const chosen = weightedChoice(
        possible.map((option) => ({ weight: option.weight, value: option })),
      );
      remainingPool = subtract(remainingPool, chosen.counts);
      return [...chosen.value];
    });
  };
}
