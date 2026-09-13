import { beforeEach, describe, expect, it } from "vitest";
import { seedRandom } from "~/draft/common/generationTestUtils";
import { draftConfig } from "~/draft/draftConfig";
import { systemData } from "~/data/systemData";
import { getSystemPool } from "~/utils/system";
import { generateMapFromConfig, mapConfigs } from "./mapConfigs";
import { autoCompleteMap } from "./utils/mapCompletion";
import { improveBalance } from "./utils/improveBalance";
import { countMapLegalityViolations } from "./utils/mapLegality";
import { calculateBalanceGap, getAllSliceValues } from "./utils/sliceScoring";
import { decodeMapString, encodeMapString } from "./utils/mapStringCodec";
import { buildPresetDraftState } from "./utils/presetDraft";
import {
  buildPresetMap,
  extractSlicesFromMap,
  mapConfigToCompatibleDraftTypes,
} from "./utils/mapToDraft";

beforeEach(() => seedRandom(913));
const gameSets = ["base", "pok", "te"] as const;

describe("every galaxy editor layout", () => {
  it.each(Object.values(mapConfigs))(
    "generates, balances, shares and prepares a faction draft on $name",
    (config) => {
      const empty = generateMapFromConfig(config);
      const original = structuredClone(empty);
      const pool = getSystemPool([...gameSets]);
      const map = autoCompleteMap(empty, pool)!;
      expect(map).not.toBeNull();
      expect(empty).toEqual(original);
      expect(map.some((tile) => tile.type === "OPEN")).toBe(false);
      expect(map.filter((tile) => tile.type === "HOME")).toHaveLength(
        config.numPlayers,
      );
      for (const tile of empty.filter((tile) => tile.type !== "OPEN"))
        expect(map[tile.idx]).toEqual(tile);
      const systems = map.flatMap((tile) =>
        tile.type === "SYSTEM" && systemData[tile.systemId].type !== "HYPERLANE"
          ? [tile.systemId]
          : [],
      );
      expect(new Set(systems).size).toBe(systems.length);
      systems
        .filter((id) => id !== "18")
        .forEach((id) => expect(pool).toContain(id));

      const snapshot = structuredClone(map);
      const improved = improveBalance(map);
      expect(map).toEqual(snapshot);
      if (improved) {
        expect(calculateBalanceGap(getAllSliceValues(improved))).toBeLessThan(
          calculateBalanceGap(getAllSliceValues(map)),
        );
        expect(countMapLegalityViolations(improved)).toBeLessThanOrEqual(
          countMapLegalityViolations(map),
        );
        expect(
          improved
            .flatMap((tile) => (tile.type === "SYSTEM" ? [tile.systemId] : []))
            .sort(),
        ).toEqual(
          map
            .flatMap((tile) => (tile.type === "SYSTEM" ? [tile.systemId] : []))
            .sort(),
        );
        for (const tile of empty.filter((tile) => tile.type !== "OPEN"))
          expect(improved[tile.idx]).toEqual(tile);
      }
      const decoded = decodeMapString(encodeMapString(improved ?? map))!;
      expect(decoded.ringCount).toBe(config.mapSize);
      expect(encodeMapString(decoded.map)).toBe(
        encodeMapString(improved ?? map),
      );
      const draft = buildPresetDraftState({
        map: decoded.map,
        mapConfigId: config.id,
        gameSets: [...gameSets],
        playerCount: config.numPlayers,
      });
      expect(draft.ok).toBe(true);
      if (draft.ok) {
        expect(draft.value.players).toHaveLength(config.numPlayers);
        expect(draft.value.settings.presetMap).toEqual(decoded.map);
        expect(draft.value.settings.draftGameMode).toBe("presetMap");
      }
    },
  );

  it.each(
    Object.entries(mapConfigToCompatibleDraftTypes).flatMap(([id, types]) =>
      types.map((type) => ({ id, type })),
    ),
  )(
    "extracts complete, nonoverlapping $type slices from $id",
    ({ id, type }) => {
      const config = mapConfigs[id];
      const map = autoCompleteMap(
        generateMapFromConfig(config),
        getSystemPool([...gameSets]),
      )!;
      const { slices, sliceTileIndices } = extractSlicesFromMap(
        map,
        config,
        draftConfig[type],
      );
      expect(slices).toHaveLength(config.numPlayers);
      for (const slice of slices)
        expect(slice).toHaveLength(draftConfig[type].numSystemsInSlice);
      expect(sliceTileIndices.size).toBe(slices.flat().length);
      expect(new Set(slices.flat()).size).toBe(slices.flat().length);
      for (const id of slices.flat())
        expect(["BLUE", "RED"]).toContain(systemData[id].type);
      const preset = buildPresetMap(map, sliceTileIndices);
      expect(preset.filter((tile) => tile.type === "OPEN")).toHaveLength(
        slices.flat().length,
      );
      for (const tile of map.filter((tile) => !sliceTileIndices.has(tile.idx)))
        expect(preset[tile.idx]).toEqual(tile);
    },
  );
});
