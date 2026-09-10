import { describe, expect, test } from "vitest";
import { systemData } from "~/data/systemData";
import {
  applyMantisAction,
  countMantisTiles,
  createMantisDraft,
  createMantisMapBuild,
  mantisActivePlayer,
  mantisBuildTurn,
  undoMantisAction,
  type MantisSettings,
  type MantisState,
} from "./engine";

function settings(players = 6): MantisSettings {
  return {
    players: Array.from({ length: players }, (_, id) => ({
      id,
      name: `Player ${id + 1}`,
    })),
    tileGameSets: ["base", "pok", "te", "discordant", "discordantexp"],
    factionGameSets: ["base", "pok", "te"],
    numFactions: players + 1,
    extraBlues: 0,
    extraReds: 0,
    mulligans: 1,
    draftOrder: Array.from({ length: players }, (_, id) => id),
  };
}

function draftAll(state: MantisState): MantisState {
  while (state.phase === "draft") {
    const id = mantisActivePlayer(state)!;
    if (!state.chosenFactions[id]) {
      state = applyMantisAction(
        state,
        id,
        {
          type: "faction",
          factionId: state.factions.find(
            (f) => !Object.values(state.chosenFactions).includes(f),
          )!,
        },
        () => 0,
      );
    } else if (state.seats[id] === undefined) {
      const seat = state.players.findIndex(
        (_, index) => !Object.values(state.seats).includes(index),
      );
      state = applyMantisAction(state, id, { type: "seat", seat }, () => 0);
    } else {
      const tileId = state.pool.find((tile) => {
        const color = systemData[tile]?.type;
        return color === "BLUE"
          ? countMantisTiles(state, id, "BLUE") < 3 + state.settings.extraBlues
          : countMantisTiles(state, id, "RED") < 2 + state.settings.extraReds;
      })!;
      state = applyMantisAction(state, id, { type: "tile", tileId }, () => 0);
    }
  }
  return state;
}

describe("Mantis draft", () => {
  test("continues completed bag hands into map building without redrafting", () => {
    const drafted = draftAll(createMantisDraft(settings(4), () => 0));
    const state = createMantisMapBuild(
      {
        players: drafted.players,
        hands: drafted.hands,
        seatOrder: [3, 2, 1, 0],
        homeSystems: { 0: "1" },
        factionLabels: { 0: "Custom Franken faction" },
      },
      () => 0,
    );
    expect(state.phase).toBe("build");
    expect(state.hands).toEqual(drafted.hands);
    expect(state.seats[3]).toBe(0);
    expect(state.drawnTile).toBe(state.hands[3][0]);
    expect(
      state.map.some((tile) => tile.type === "SYSTEM" && tile.systemId === "1"),
    ).toBe(true);
    expect(() =>
      createMantisMapBuild({
        players: drafted.players,
        hands: { ...drafted.hands, 0: [] },
        seatOrder: [3, 2, 1, 0],
      }),
    ).toThrow("exactly 3 blue");
  });
  test.each([4, 5, 6, 7, 8])(
    "completes an entire %i-player draft and fills every map slot",
    (count) => {
      let state = draftAll(createMantisDraft(settings(count), () => 0.25));
      expect(state.phase).toBe("build");
      expect(new Set(Object.values(state.seats)).size).toBe(count);
      expect(new Set(Object.values(state.chosenFactions)).size).toBe(count);
      const allTiles = Object.values(state.hands).flat();
      expect(new Set(allTiles).size).toBe(5 * count);
      let placed = 0;
      while (state.phase === "build") {
        const turn = mantisBuildTurn(state)!;
        expect(turn.positions.length).toBeGreaterThan(0);
        state = applyMantisAction(
          state,
          turn.playerId,
          { type: "place", mapIdx: turn.positions[0] },
          () => 0,
        );
        placed++;
        if (placed > 5 * count) throw new Error("Build failed to finish");
      }
      expect(state.phase).toBe("complete");
      expect(placed).toBe(5 * count);
      expect(state.map.filter((tile) => tile.type === "OPEN")).toHaveLength(0);
      expect(Object.values(state.hands).flat()).toHaveLength(0);
      for (const tileId of allTiles)
        expect(
          state.map.filter(
            (tile) => tile.type === "SYSTEM" && tile.systemId === tileId,
          ),
        ).toHaveLength(1);
    },
  );

  test("enforces the snake order and color quotas", () => {
    let state = createMantisDraft(settings(4), () => 0);
    expect(() =>
      applyMantisAction(state, 1, { type: "seat", seat: 0 }),
    ).toThrow("another player's turn");
    const order: number[] = [];
    for (let i = 0; i < 8; i++) {
      const id = mantisActivePlayer(state)!;
      order.push(id);
      state = applyMantisAction(state, id, {
        type: "tile",
        tileId: state.pool.find((tile) => systemData[tile].type === "RED")!,
      });
    }
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect(() =>
      applyMantisAction(state, 0, {
        type: "tile",
        tileId: state.pool.find((tile) => systemData[tile].type === "RED")!,
      }),
    ).toThrow();
    expect(state.pickNumber).toBe(8);
  });

  test("extras must be discarded to the exact blue/red quotas", () => {
    let state = draftAll(
      createMantisDraft(
        { ...settings(4), extraBlues: 1, extraReds: 1 },
        () => 0,
      ),
    );
    expect(state.phase).toBe("discard");
    for (const p of state.players) {
      for (const color of ["BLUE", "RED"] as const) {
        const tileId = state.hands[p.id].find(
          (id) => systemData[id].type === color,
        )!;
        state = applyMantisAction(
          state,
          p.id,
          { type: "discard", tileId },
          () => 0,
        );
      }
      if (state.phase === "discard") {
        expect(() =>
          applyMantisAction(state, p.id, {
            type: "discard",
            tileId: state.hands[p.id][0],
          }),
        ).toThrow("Keep exactly");
      }
    }
    expect(state.phase).toBe("build");
    expect(state.discarded).toHaveLength(8);
  });

  test("mulligans draw a different owned tile, preserve the hand, and cannot exceed their limit", () => {
    const initial = draftAll(createMantisDraft(settings(4), () => 0));
    const id = mantisActivePlayer(initial)!;
    const next = applyMantisAction(initial, id, { type: "mulligan" }, () => 0);
    expect(next.drawnTile).not.toBe(initial.drawnTile);
    expect(next.hands[id]).toEqual(initial.hands[id]);
    expect(() => applyMantisAction(next, id, { type: "mulligan" })).toThrow(
      "No mulligan",
    );
    const undone = undoMantisAction(next);
    expect(undone).toEqual(initial);
  });

  test("rejects another player's map position and preserves state after invalid actions", () => {
    const state = draftAll(createMantisDraft(settings(4), () => 0));
    const turn = mantisBuildTurn(state)!;
    const otherPosition = state.map.find(
      (tile) => tile.type === "OPEN" && !turn.positions.includes(tile.idx),
    )!.idx;
    expect(() =>
      applyMantisAction(state, turn.playerId, {
        type: "place",
        mapIdx: otherPosition,
      }),
    ).toThrow("highlighted positions");
    expect(state.drawnTile).toBeDefined();
    expect(state.phase).toBe("build");
  });

  test("validates supply, faction filters, and explicit player order", () => {
    expect(() =>
      createMantisDraft({
        ...settings(8),
        tileGameSets: ["base"],
        extraBlues: 2,
      }),
    ).toThrow("needs");
    expect(() =>
      createMantisDraft({ ...settings(4), draftOrder: [0, 0, 1, 2] }),
    ).toThrow("each player");
    expect(() =>
      createMantisDraft({
        ...settings(4),
        bannedFactions: ["sol"],
        requiredFactions: ["sol"],
      }),
    ).toThrow("Required factions");
    const state = createMantisDraft({
      ...settings(4),
      bannedFactions: ["sol"],
      requiredFactions: ["hacan"],
    });
    expect(state.factions).not.toContain("sol");
    expect(state.factions).toContain("hacan");
  });
});
