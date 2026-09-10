import { afterEach, expect, vi } from "vitest";
import { draftConfig } from "../draftConfig";
import { DraftSettings, Map, SystemIds } from "~/types";

afterEach(() => vi.unstubAllGlobals());

export function seedRandom(seed: number, trackCalls = false) {
  let value = seed >>> 0;
  const random = () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  if (trackCalls) return vi.spyOn(Math, "random").mockImplementation(random);
  vi.stubGlobal("Math", Object.create(Math, { random: { value: random } }));
  return undefined;
}

export function expectCompleteMap(
  result: { map: Map; slices: SystemIds[]; valid?: boolean } | undefined,
  settings: DraftSettings,
  pool: string[],
) {
  expect(result).toBeDefined();
  expect(result?.valid).toBe(true);
  const config = draftConfig[settings.type];
  expect(result!.slices).toHaveLength(settings.numSlices);
  result!.slices.forEach((slice) =>
    expect(slice).toHaveLength(config.numSystemsInSlice),
  );
  const mapIds = config.modifiableMapTiles.map((idx) => {
    const tile = result!.map[idx];
    expect(tile.type).toBe("SYSTEM");
    return tile.type === "SYSTEM" ? tile.systemId : undefined;
  });
  const allIds = [...result!.slices.flat(), ...mapIds];
  expect(new Set(allIds).size).toBe(allIds.length);
  allIds.forEach((id) => expect(pool).toContain(id));
}

export const generatorTestSettings: DraftSettings = {
  type: "miltyeq",
  factionGameSets: ["base", "pok"],
  tileGameSets: ["base", "pok"],
  draftSpeaker: false,
  allowEmptyTiles: false,
  allowHomePlanetSearch: false,
  numFactions: 6,
  numSlices: 6,
  randomizeMap: false,
  randomizeSlices: false,
};
