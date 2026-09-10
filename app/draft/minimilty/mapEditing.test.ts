import { afterEach, describe, expect, it, vi } from "vitest";
import { draftStore } from "~/draftStore";
import { systemData } from "~/data/systemData";
import { draftConfig } from "~/draft/draftConfig";
import { getDraftValidationErrors } from "~/utils/draftValidation";
import { getPresetMapEditableTiles } from "~/utils/presetMapEditing";
import { buildMiniMiltySettings } from "./buildMiniMilty";

function prepare(count: number) {
  const players = Array.from({ length: count }, (_, id) => ({
    id,
    name: `Slot ${id + 1}`,
  }));
  draftStore.getState().actions.initializeDraft(
    buildMiniMiltySettings({ players }, () => 0.5),
    players,
    {},
  );
  return draftStore.getState();
}

afterEach(() => {
  draftStore.getState().actions.reset();
  vi.restoreAllMocks();
});

describe("prepared map editing", () => {
  it.each([3, 4, 5, 6])(
    "regenerates a complete %i-player Mini-Milty board with the required tile mix",
    (count) => {
      const original = structuredClone(prepare(count).draft);
      vi.spyOn(Math, "random").mockReturnValue(0.15);
      draftStore.getState().actions.randomizeMap();
      const rerolled = draftStore.getState().draft;
      expect(rerolled.presetMap).not.toEqual(original.presetMap);
      expect(rerolled.settings).toEqual(original.settings);
      expect(rerolled.availableFactions).toEqual(original.availableFactions);
      expect(getDraftValidationErrors(rerolled)).toEqual([]);
      const editable = getPresetMapEditableTiles(rerolled);
      expect(editable).toHaveLength(count * 5);
      expect(editable).not.toContain(0);
      const config = draftConfig[rerolled.settings.type];
      config.homeIdxInMapString.forEach((homeIndex, seat) => {
        const home = rerolled.presetMap[homeIndex];
        const systems = config.seatTilePlacement[seat].map(([x, y]) => {
          const tile = rerolled.presetMap.find(
            (tile) =>
              tile.position.x === home.position.x + x &&
              tile.position.y === home.position.y + y,
          )!;
          if (tile.type !== "SYSTEM") throw new Error("Missing player system");
          return systemData[tile.systemId];
        });
        expect(systems.filter((system) => system.type === "BLUE")).toHaveLength(
          3,
        );
        expect(systems.filter((system) => system.type === "RED")).toHaveLength(
          2,
        );
      });
      const ids = rerolled.presetMap.flatMap((tile) =>
        tile.type === "SYSTEM" && editable.includes(tile.idx)
          ? [tile.systemId]
          : [],
      );
      expect(new Set(ids).size).toBe(count * 5);
      draftStore.getState().actions.clearMap();
      expect(draftStore.getState().draft.presetMap).toEqual(original.presetMap);
    },
  );

  it("allows replacing a removed preset tile and resetting all edits to the original map", () => {
    const { draft, actions } = prepare(4);
    const original = structuredClone(draft.presetMap);
    const editable = getPresetMapEditableTiles(draft);
    const index = editable[0];
    const tile = original[index];
    if (tile.type !== "SYSTEM") throw new Error("Missing tile");
    actions.removeSystemFromMap(index);
    expect(getPresetMapEditableTiles(draftStore.getState().draft)).toContain(
      index,
    );
    expect(getDraftValidationErrors(draftStore.getState().draft)).toContain(
      "Map has empty tiles",
    );
    actions.addSystemToMap(index, systemData[tile.systemId]);
    expect(getDraftValidationErrors(draftStore.getState().draft)).toEqual([]);
    actions.removeSystemFromMap(index);
    actions.clearMap();
    expect(draftStore.getState().draft.presetMap).toEqual(original);
    expect(draftStore.getState().draft.settings.presetMap).toEqual(original);
  });

  it("preserves an imported preset instead of sending it through the slice generator", () => {
    const imported = structuredClone(prepare(4).draft);
    delete imported.settings.presetMapFormat;
    draftStore.getState().actions.initializeDraftFromSavedState(imported);
    draftStore.getState().actions.randomizeMap();
    expect(draftStore.getState().draft.presetMap).toEqual(imported.presetMap);
    expect(getPresetMapEditableTiles(draftStore.getState().draft)).toHaveLength(
      20,
    );
  });
});
