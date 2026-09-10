import { expect, it } from "vitest";
import { autoCompleteMap } from "./mapCompletion";
import { generateMapFromConfig, mapConfigs } from "../mapConfigs";
import type { Map } from "~/types";

it("excludes existing systems and duplicate pool entries when filling a partial map", () => {
  const map: Map = generateMapFromConfig(mapConfigs.milty6p).map((tile) =>
    tile.idx === 0
      ? tile
      : { idx: tile.idx, position: tile.position, type: "CLOSED" },
  );
  map[1] = { ...map[1], type: "SYSTEM", systemId: "19" };
  map[2] = { ...map[2], type: "OPEN" };
  const result = autoCompleteMap(map, ["19", "19", "20", "20"]);
  expect(result?.[1]).toMatchObject({ systemId: "19" });
  expect(result?.[2]).toMatchObject({ systemId: "20" });
  expect(map[2].type).toBe("OPEN");
});

it("reports insufficient supply without returning a partially filled map or changing the input", () => {
  const map = generateMapFromConfig(mapConfigs.milty6p);
  const original = structuredClone(map);
  expect(autoCompleteMap(map, ["19", "19"])).toBeNull();
  expect(map).toEqual(original);
});
