import { beforeEach, describe, expect, it } from "vitest";
import { useMapBuilder } from "./mapBuilderStore";
import { getTileCount } from "./utils/hexCoordinates";
import { mapConfigs } from "./mapgen/mapConfigs";

const initial = useMapBuilder.getInitialState();
beforeEach(() => useMapBuilder.setState(initial, true));

describe("map editing recovery", () => {
  it("undoes and redoes a reset together with its map dimensions", () => {
    const {
      setRingCount,
      addSystemToMap,
      clearMap,
      undo,
      redo,
      addHomeSystem,
    } = initial.actions;
    setRingCount(5);
    addSystemToMap(80, "19");
    const edited = useMapBuilder.getState().state.map;
    clearMap();
    expect(useMapBuilder.getState().state.ringCount).toBe(
      mapConfigs[initial.state.mapConfigId].mapSize,
    );
    expect(useMapBuilder.getState().state.map.length).toBe(
      getTileCount(useMapBuilder.getState().state.ringCount),
    );
    undo();
    expect(useMapBuilder.getState().state.map).toEqual(edited);
    expect(useMapBuilder.getState().state.ringCount).toBe(5);
    redo();
    expect(() => addHomeSystem()).not.toThrow();
  });

  it("restores removed game sets and their systems in one undo", () => {
    initial.actions.addSystemToMap(1, "59");
    const previous = useMapBuilder.getState().state;
    initial.actions.setGameSets(["base"]);
    expect(useMapBuilder.getState().state.map[1].type).toBe("OPEN");
    initial.actions.undo();
    expect(useMapBuilder.getState().state.map).toEqual(previous.map);
    expect(useMapBuilder.getState().state.gameSets).toEqual(previous.gameSets);
    expect(useMapBuilder.getState().systemPool).toEqual(previous.systemPool);
  });

  it("does not record hovering or opening the picker, and discards redo after a new edit", () => {
    const { addSystemToMap, undo, setHoveredHomeIdx, openPlanetFinderForMap } =
      initial.actions;
    addSystemToMap(1, "19");
    setHoveredHomeIdx(2);
    openPlanetFinderForMap(3);
    expect(useMapBuilder.getState().past).toHaveLength(1);
    undo();
    expect(useMapBuilder.getState().planetFinderModal).toBeNull();
    expect(useMapBuilder.getState().future).toHaveLength(1);
    addSystemToMap(2, "20");
    expect(useMapBuilder.getState().future).toHaveLength(0);
  });

  it("protects the center and ignores invalid drop targets", () => {
    const { addSystemToMap, swapTiles, toggleTileClosed, setRingCount } =
      initial.actions;
    addSystemToMap(0, "19");
    addSystemToMap(1, "18");
    addSystemToMap(999, "19");
    swapTiles(1, 999);
    toggleTileClosed(999);
    setRingCount(2.5);
    expect(useMapBuilder.getState().state.map).toEqual(initial.state.map);
    expect(useMapBuilder.getState().past).toHaveLength(0);
  });

  it("reuses a missing home seat without duplicating another player's number", () => {
    const home = initial.state.map.find(
      (tile) => tile.type === "HOME" && tile.seat === 0,
    )!;
    initial.actions.addSystemToMap(home.idx, "19");
    initial.actions.addHomeSystem();
    const seats = useMapBuilder
      .getState()
      .state.map.flatMap((tile) => (tile.type === "HOME" ? [tile.seat] : []));
    expect(new Set(seats).size).toBe(seats.length);
    expect(seats).toContain(0);
  });

  it("bounds undo history while retaining the most recent edits", () => {
    for (let i = 0; i < 60; i++) initial.actions.toggleTileClosed(1);
    expect(useMapBuilder.getState().past).toHaveLength(50);
  });

  it("preserves redo when restoring unchanged saved work and starts fresh for a new shared map", () => {
    const { addSystemToMap, undo, loadDecodedMap } = initial.actions;
    addSystemToMap(1, "19");
    undo();
    const before = useMapBuilder.getState();
    loadDecodedMap(
      structuredClone(before.state.map),
      before.state.ringCount,
      [...before.state.gameSets],
      before.state.mapConfigId,
      false,
    );
    expect(useMapBuilder.getState().past).toHaveLength(0);
    expect(useMapBuilder.getState().future).toEqual(before.future);
    const changed = structuredClone(before.state.map);
    changed[1] = { ...changed[1], type: "SYSTEM", systemId: "20" };
    loadDecodedMap(
      changed,
      before.state.ringCount,
      [...before.state.gameSets],
      before.state.mapConfigId,
      false,
    );
    expect(useMapBuilder.getState().past).toHaveLength(0);
    expect(useMapBuilder.getState().future).toHaveLength(0);
  });

  it.each(["__proto__", "constructor"])(
    "ignores inherited layout IDs: %s",
    (layout) => {
      initial.actions.loadDecodedMap(
        initial.state.map,
        initial.state.ringCount,
        initial.state.gameSets,
        layout,
      );
      expect(useMapBuilder.getState().state.mapConfigId).toBe(
        initial.state.mapConfigId,
      );
      expect(() => initial.actions.clearMap()).not.toThrow();
    },
  );
});
