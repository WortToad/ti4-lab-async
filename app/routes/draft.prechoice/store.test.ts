import { afterEach, describe, expect, it } from "vitest";
import { useDraftSetup } from "./store";
import { MAPS, type ChoosableDraftType } from "./maps";

const initial = useDraftSetup.getState();
afterEach(() => useDraftSetup.setState(initial, true));

describe("setting up a lobby by player count", () => {
  it.each([
    ["heisen", 7, "heisen7p"],
    ["heisen", 3, "heisen3p"],
    ["miltyeq", 8, "miltyeq8p"],
    ["miltyeq", 4, "miltyeq4p"],
    ["milty", 5, "milty5p"],
  ] as [ChoosableDraftType, number, ChoosableDraftType][])(
    "keeps the %s format when changing to %i players",
    (type, count, expected) => {
      useDraftSetup.getState().map.setSelectedMapType(type);
      useDraftSetup.getState().player.setCount(count);
      const state = useDraftSetup.getState();
      expect(state.map.selectedMapType).toBe(expected);
      expect(state.player.players).toHaveLength(count);
      expect(state.slices.numSlices).toBeGreaterThanOrEqual(count);
      expect(state.faction.numFactions).toBeGreaterThanOrEqual(count);
    },
  );

  it("uses a compatible layout if the current family cannot support the group", () => {
    useDraftSetup.getState().map.setSelectedMapType("miltyeq");
    useDraftSetup.getState().player.setCount(3);
    const state = useDraftSetup.getState();
    expect(MAPS[state.map.selectedMapType].playerCount).toBe(3);
    expect(state.player.players.map((player) => player.id)).toEqual([0, 1, 2]);
  });

  it.each([0, 2, 9, 5.5, NaN])("rejects unsupported count %s", (count) => {
    useDraftSetup.getState().player.setCount(count);
    expect(useDraftSetup.getState().player.players).toHaveLength(6);
  });
});
