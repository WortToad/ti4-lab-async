import { describe, expect, it } from "vitest";
import { draftConfig } from "../draftConfig";
import type { DraftType } from "../types";
import { systemData } from "~/data/systemData";
import { mapStringOrder } from "~/data/mapStringOrder";
import { getSystemPool } from "~/utils/system";
import { generateEmptyMap, hydrateDemoMap } from "~/utils/map";
import { botPositionToIndex } from "./index";
import { generateTemplateNucleusSlices } from "./nucleusSlices";
import { calculateSliceValue, getSliceValueConfig } from "~/stats";
import { getMaxAvailableSlices } from "~/routes/draft.prechoice/utils";

const variants = [
  "milty3p",
  "heisen3p",
  "heisen4p",
  "heisen5p",
  "heisen7p",
] as const satisfies readonly DraftType[];

describe("additional async bot layouts", () => {
  it("honors Nucleus slice value settings and rejects insufficient pools", () => {
    const slices = generateTemplateNucleusSlices(
      4,
      getSystemPool(["base", "pok"]),
      {
        minSliceValue: 4,
        maxSliceValue: 8,
      },
    );
    expect(slices).toHaveLength(4);
    for (const slice of slices!) {
      const value = calculateSliceValue(
        slice.map((id) => systemData[id]),
        getSliceValueConfig(undefined, [], [1]),
      );
      expect(value).toBeGreaterThanOrEqual(4);
      expect(value).toBeLessThanOrEqual(8);
    }
    expect(generateTemplateNucleusSlices(4, ["19", "20"])).toBeUndefined();
  });
  it("converts bot ring positions to map-string positions", () => {
    expect(botPositionToIndex("000")).toBe(0);
    expect(botPositionToIndex("101")).toBe(1);
    expect(botPositionToIndex("201")).toBe(7);
    expect(botPositionToIndex("301")).toBe(19);
    expect(botPositionToIndex("424")).toBe(60);
  });

  it.each(variants)(
    "%s reserves shared map tiles when limiting the slice pool",
    (type) => {
      const config = draftConfig[type];
      const maximum = getMaxAvailableSlices(type, ["base", "pok"], false);
      const required =
        maximum * config.numSystemsInSlice + config.modifiableMapTiles.length;
      expect(required).toBeLessThanOrEqual(
        getSystemPool(["base", "pok"]).length,
      );
      expect(maximum).toBeGreaterThanOrEqual(config.numPlayers);
    },
  );

  it.each(variants)(
    "%s has a complete layout without overlapping slices",
    (type) => {
      const config = draftConfig[type];
      const assigned = [
        0,
        ...config.homeIdxInMapString,
        ...config.modifiableMapTiles,
        ...config.closedMapTiles,
        ...Object.keys(config.presetTiles).map(Number),
      ];
      expect(config.homeIdxInMapString).toHaveLength(config.numPlayers);
      for (const [seat, offsets] of Object.entries(config.seatTilePlacement)) {
        expect(offsets).toHaveLength(config.numSystemsInSlice);
        const home = mapStringOrder[config.homeIdxInMapString[Number(seat)]];
        for (const [x, y] of offsets) {
          const index = mapStringOrder.findIndex(
            (position) =>
              position.x === home.x + x && position.y === home.y + y,
          );
          expect(index).toBeGreaterThan(0);
          assigned.push(index);
        }
      }
      const emptyMap = generateEmptyMap(config);
      expect(new Set(assigned).size).toBe(assigned.length);
      expect(assigned).toHaveLength(emptyMap.length);
      expect(hydrateDemoMap(config)).toHaveLength(emptyMap.length);
      for (const preset of Object.values(config.presetTiles)) {
        expect(systemData[preset.systemId], preset.systemId).toBeDefined();
        expect((preset.rotation ?? 0) % 60).toBe(0);
      }
    },
  );

  it.each(variants)(
    "%s generates complete unique map and slice selections",
    (type) => {
      const config = draftConfig[type];
      for (let attempt = 0; attempt < 8; attempt++) {
        const generated = config.generateMap?.(
          {
            type,
            numSlices: config.numPlayers,
            numFactions: config.numPlayers,
            factionGameSets: ["base", "pok"],
            tileGameSets: ["base", "pok"],
            draftSpeaker: type.startsWith("heisen"),
            allowEmptyTiles: false,
            allowHomePlanetSearch: false,
            randomizeMap: true,
            randomizeSlices: true,
            sliceGenerationConfig: {
              numAlphas: 1,
              numBetas: 1,
              minLegendaries: 0,
            },
          },
          getSystemPool(["base", "pok"]),
        );
        expect(generated).toBeDefined();
        expect(generated!.slices).toHaveLength(config.numPlayers);
        expect(
          generated!.slices.every(
            (slice) => slice.length === config.numSystemsInSlice,
          ),
        ).toBe(true);
        const ids = generated!.slices.flat();
        for (const index of config.modifiableMapTiles) {
          const tile = generated!.map[index];
          expect(tile.type).toBe("SYSTEM");
          if (tile.type === "SYSTEM") ids.push(tile.systemId);
        }
        expect(ids.every((id) => !!systemData[id])).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
      }
    },
  );
});
