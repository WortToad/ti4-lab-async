import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MAP_EDITOR_STORAGE_KEY, readSavedMap, saveMap } from "./editorStorage";
import { generateMapFromConfig, mapConfigs } from "../mapConfigs";
import { encodeMapString } from "./mapStringCodec";

const data = new globalThis.Map<string, string>();
const storage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
};
const saved = {
  map: generateMapFromConfig(mapConfigs.milty5p),
  gameSets: ["base", "pok"] as const,
  mapConfigId: "milty5p",
};
beforeEach(() => {
  data.clear();
  vi.stubGlobal("window", { sessionStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

it("restores the map layout and enabled content even when none of that content has been placed", () => {
  expect(saveMap({ ...saved, gameSets: [...saved.gameSets] }, null)).toBe(true);
  const result = readSavedMap(null)!;
  expect(encodeMapString(result.map)).toBe(encodeMapString(saved.map));
  expect(result.gameSets).toEqual(saved.gameSets);
  expect(result.mapConfigId).toBe("milty5p");
  expect(result.ringCount).toBe(3);
});

it("keeps edits to the current shared map on refresh but honors a different incoming map", () => {
  saveMap({ ...saved, gameSets: [...saved.gameSets] }, "shared-map-one");
  expect(readSavedMap("shared-map-one")).not.toBeNull();
  expect(readSavedMap("shared-map-two")).toBeNull();
  expect(readSavedMap(null)).not.toBeNull();
});

it("ignores corrupt saved settings and tolerates unavailable storage", () => {
  storage.setItem(MAP_EDITOR_STORAGE_KEY, "{broken");
  expect(readSavedMap(null)).toBeNull();
  vi.stubGlobal("window", {
    get sessionStorage() {
      throw new Error("blocked");
    },
  });
  expect(readSavedMap(null)).toBeNull();
  expect(saveMap({ ...saved, gameSets: [...saved.gameSets] }, null)).toBe(
    false,
  );
});
