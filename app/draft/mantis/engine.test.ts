import { describe, expect, test } from "vitest";
import { factionSystems, systemData } from "~/data/systemData";
import { draftConfig } from "~/draft/draftConfig";
import { getFactionPool } from "~/utils/factions";
import {
  applyMantisAction,
  canDraftMantisFaction,
  countMantisTiles,
  createMantisDraft,
  createMantisMapBuild,
  mantisActivePlayer,
  mantisBuildTurn,
  mantisHomeChoices,
  mantisPendingHomePlayer,
  normalizeMantisState,
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
          factionId: state.factions.find((f) =>
            canDraftMantisFaction(state, f),
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
  test.each([
    ["creuss", "51", "17"],
    ["crimson", "118", "94"],
  ] as const)(
    "uses the %s gate in the galaxy for standalone and imported map builds",
    (factionId, offBoardHome, gate) => {
      const drafted = draftAll(
        createMantisDraft(
          { ...settings(4), requiredFactions: [factionId] },
          () => 0,
        ),
      );
      expect(drafted.chosenFactions[0]).toBe(factionId);
      const homePosition =
        draftConfig[drafted.mapType].homeIdxInMapString[drafted.seats[0]];
      expect(drafted.map[homePosition]).toMatchObject({
        type: "SYSTEM",
        systemId: gate,
      });
      const imported = createMantisMapBuild(
        {
          players: drafted.players,
          hands: drafted.hands,
          seatOrder: [0, 1, 2, 3],
          homeSystems: { 0: offBoardHome },
        },
        () => 0,
      );
      const importedHome = draftConfig[imported.mapType].homeIdxInMapString[0];
      expect(imported.map[importedHome]).toMatchObject({
        type: "SYSTEM",
        systemId: gate,
      });
      for (const state of [drafted, imported])
        expect(
          state.map.some(
            (tile) => tile.type === "SYSTEM" && tile.systemId === offBoardHome,
          ),
        ).toBe(false);
      expect(imported.hands).toEqual(drafted.hands);
    },
  );

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
  test.each([
    ["creuss", "51", "17"],
    ["crimson", "118", "94"],
  ] as const)(
    "repairs saved %s home positions on load and undo while preserving other map tiles",
    (factionId, offBoard, gate) => {
      const state = draftAll(
        createMantisDraft(
          { ...settings(4), requiredFactions: [factionId] },
          () => 0,
        ),
      );
      const idx = draftConfig[state.mapType].homeIdxInMapString[state.seats[0]];
      state.map[idx] = {
        ...state.map[idx],
        type: "SYSTEM",
        systemId: offBoard,
      };
      const originalMap = structuredClone(state.map);
      const repaired = normalizeMantisState(state);
      expect(repaired.map[idx]).toMatchObject({
        type: "SYSTEM",
        systemId: gate,
      });
      expect(repaired.map.filter((tile) => tile.idx !== idx)).toEqual(
        originalMap.filter((tile) => tile.idx !== idx),
      );
      expect(state.map).toEqual(originalMap);
      expect(normalizeMantisState(repaired)).toBe(repaired);
      const { history, ...snapshot } = state;
      expect(
        undoMantisAction({ ...repaired, history: [...history, snapshot] }).map,
      ).toEqual(repaired.map);
    },
  );
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
      expect(placed).toBe(4 * count);
      expect(
        state.log.filter((entry) => entry.includes("automatically")),
      ).toHaveLength(count);
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
    let initial = draftAll(createMantisDraft(settings(4), () => 0));
    // Reach the two-position stage, where spending a mulligan still leaves
    // a placement decision and must not automatically consume a tile.
    for (let i = 0; i < 4; i++) {
      const turn = mantisBuildTurn(initial)!;
      initial = applyMantisAction(
        initial,
        turn.playerId,
        { type: "place", mapIdx: turn.positions[0] },
        () => 0,
      );
    }
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

  test("automatically places forced tiles, stops at a decision, and can undo each placement", () => {
    const initial = draftAll(
      createMantisDraft({ ...settings(4), mulligans: 0 }, () => 0),
    );
    expect(Object.values(initial.hands).flat()).toHaveLength(16);
    expect(mantisBuildTurn(initial)?.positions).toHaveLength(2);
    expect(
      initial.log.slice(-4).every((entry) => entry.includes("automatically")),
    ).toBe(true);
    const undone = undoMantisAction(initial);
    expect(Object.values(undone.hands).flat()).toHaveLength(17);
    expect(mantisBuildTurn(undone)?.positions).toHaveLength(1);
    expect(normalizeMantisState(undone)).toEqual(undone);
    const turn = mantisBuildTurn(undone)!;
    expect(
      applyMantisAction(
        undone,
        turn.playerId,
        { type: "place", mapIdx: turn.positions[0] },
        () => 0,
      ).map,
    ).toEqual(initial.map);
  });

  test("does not auto-place a single-position turn while a mulligan remains", () => {
    const initial = draftAll(createMantisDraft(settings(4), () => 0));
    expect(Object.values(initial.hands).flat()).toHaveLength(20);
    expect(mantisBuildTurn(initial)?.positions).toHaveLength(1);
    const id = mantisActivePlayer(initial)!;
    const next = applyMantisAction(initial, id, { type: "mulligan" }, () => 0);
    expect(next.hands[id]).toContain(initial.drawnTile);
    expect(next.hands[id]).toHaveLength(4);
    expect(next.log.at(-1)).toContain("automatically");
    const undoPlacement = undoMantisAction(next);
    expect(undoPlacement.hands[id]).toEqual(initial.hands[id]);
    expect(undoPlacement.drawnTile).not.toBe(initial.drawnTile);
    expect(undoPlacement.mulligansUsed[id]).toBe(1);
    expect(undoMantisAction(undoPlacement)).toEqual(initial);
  });

  test("Keleres chooses an unplayed home and hero before building, with recoverable and undoable choices", () => {
    const initial = draftAll(
      createMantisDraft(
        {
          ...settings(4),
          requiredFactions: ["keleres", "mentak", "xxcha", "sol"],
        },
        () => 0,
      ),
    );
    expect(initial.phase).toBe("home");
    expect(mantisActivePlayer(initial)).toBe(0);
    expect(mantisHomeChoices(initial)).toEqual(["argent"]);
    expect(() =>
      applyMantisAction(initial, 1, { type: "home", factionId: "argent" }),
    ).toThrow("Only the Keleres player");
    expect(() =>
      applyMantisAction(initial, 0, { type: "home", factionId: "mentak" }),
    ).toThrow("unplayed");
    expect(() =>
      applyMantisAction(initial, 0, { type: "place", mapIdx: 1 }),
    ).toThrow("unplayed");
    const next = applyMantisAction(
      JSON.parse(JSON.stringify(initial)),
      0,
      { type: "home", factionId: "argent" },
      () => 0,
    );
    expect(next.phase).toBe("build");
    expect(next.chosenHomes?.[0]).toBe("argent");
    expect(
      next.map[draftConfig[next.mapType].homeIdxInMapString[next.seats[0]]],
    ).toMatchObject({ type: "SYSTEM", systemId: factionSystems.argent.id });
    expect(undoMantisAction(next)).toEqual(initial);
    expect(next.log.at(-1)).toContain("home system and hero");
  });

  test("Keleres home choice preserves extra-tile discards", () => {
    let state = draftAll(
      createMantisDraft(
        {
          ...settings(4),
          requiredFactions: ["keleres", "mentak", "xxcha", "sol"],
          extraBlues: 1,
        },
        () => 0,
      ),
    );
    state = applyMantisAction(
      state,
      0,
      { type: "home", factionId: "argent" },
      () => 0,
    );
    expect(state.phase).toBe("discard");
    expect(state.drawnTile).toBeUndefined();
    expect(
      Object.values(state.hands).every((tiles) => tiles.length === 6),
    ).toBe(true);
  });

  test.each(["mentak", "xxcha", "argent"] as const)(
    "offers the unplayed %s home even when it is not in the draft pool",
    (factionId) => {
      const state = draftAll(
        createMantisDraft(
          {
            ...settings(4),
            numFactions: 4,
            requiredFactions: ["keleres", "sol", "hacan", "barony"],
          },
          () => 0,
        ),
      );
      expect(mantisHomeChoices(state)).toEqual(["mentak", "xxcha", "argent"]);
      const next = applyMantisAction(
        state,
        0,
        { type: "home", factionId },
        () => 0,
      );
      expect(next.phase).toBe("build");
      expect(next.chosenHomes?.[0]).toBe(factionId);
      const idx = draftConfig[next.mapType].homeIdxInMapString[next.seats[0]];
      expect(next.map[idx]).toMatchObject({
        type: "SYSTEM",
        systemId: factionSystems[factionId].id,
      });
      next.map[idx] = { ...state.map[idx] };
      const restored = normalizeMantisState(next);
      expect(restored.map[idx]).toMatchObject({
        type: "SYSTEM",
        systemId: factionSystems[factionId].id,
      });
      expect(restored.chosenHomes?.[0]).toBe(factionId);
    },
  );

  test("replaces an optional pool faction when drawing it would leave Keleres no home", () => {
    const configuration = settings(4);
    const requiredFactions = ["keleres", "mentak", "xxcha"] as const;
    const pool = createMantisDraft(
      {
        ...configuration,
        numFactions: 4,
        requiredFactions: [...requiredFactions],
        bannedFactions: getFactionPool(configuration.factionGameSets).filter(
          (id) => ![...requiredFactions, "argent", "sol"].includes(id),
        ),
      },
      () => 0,
    ).factions;
    expect(pool).toEqual(["keleres", "mentak", "xxcha", "sol"]);
  });

  test("prevents selecting all Keleres home factions and rejects pools that force the conflict", () => {
    const requiredFactions = ["keleres", "mentak", "xxcha", "argent"] as const;
    expect(() =>
      createMantisDraft({
        ...settings(4),
        numFactions: 4,
        requiredFactions: [...requiredFactions],
      }),
    ).toThrow("Increase the faction pool");
    let state = createMantisDraft(
      { ...settings(4), requiredFactions: [...requiredFactions] },
      () => 0,
    );
    for (const factionId of requiredFactions.slice(0, 3))
      state = applyMantisAction(
        state,
        mantisActivePlayer(state)!,
        { type: "faction", factionId },
        () => 0,
      );
    expect(canDraftMantisFaction(state, "argent")).toBe(false);
    expect(() =>
      applyMantisAction(state, 3, { type: "faction", factionId: "argent" }),
    ).toThrow("Keleres must retain");
    const alternative = state.factions.find((id) =>
      canDraftMantisFaction(state, id),
    )!;
    expect(alternative).toBeDefined();
    expect(
      applyMantisAction(state, 3, { type: "faction", factionId: alternative })
        .chosenFactions[3],
    ).toBe(alternative);
    state.chosenFactions = { 0: "mentak", 1: "xxcha", 2: "argent" };
    expect(canDraftMantisFaction(state, "keleres")).toBe(false);
  });

  test("legacy completed Keleres maps resume home choice without losing placed tiles", () => {
    let state = draftAll(
      createMantisDraft(
        {
          ...settings(4),
          requiredFactions: ["keleres", "mentak", "xxcha", "sol"],
        },
        () => 0,
      ),
    );
    state = applyMantisAction(
      state,
      0,
      { type: "home", factionId: "argent" },
      () => 0,
    );
    while (state.phase === "build") {
      const turn = mantisBuildTurn(state)!;
      state = applyMantisAction(
        state,
        turn.playerId,
        { type: "place", mapIdx: turn.positions[0] },
        () => 0,
      );
    }
    expect(state.phase).toBe("complete");
    expect(normalizeMantisState(state)).toBe(state);
    delete state.chosenHomes;
    expect(normalizeMantisState(state)).toBe(state);
    const idx = draftConfig[state.mapType].homeIdxInMapString[state.seats[0]];
    state.map[idx] = {
      idx,
      position: state.map[idx].position,
      type: "HOME",
      playerId: 0,
      seat: state.seats[0],
    };
    const originalMap = structuredClone(state.map);
    expect(normalizeMantisState(state).phase).toBe("home");
    expect(mantisPendingHomePlayer(state)).toBe(0);
    const repaired = applyMantisAction(
      state,
      0,
      { type: "home", factionId: "argent" },
      () => 0,
    );
    expect(repaired.phase).toBe("complete");
    expect(repaired.map.filter((tile) => tile.idx !== idx)).toEqual(
      originalMap.filter((tile) => tile.idx !== idx),
    );
    const undone = undoMantisAction(repaired);
    expect(undone.phase).toBe("home");
    expect(undone.map).toEqual(originalMap);
    state.chosenFactions[3] = "argent";
    expect(normalizeMantisState(state).phase).toBe("home");
    expect(mantisHomeChoices(state)).toEqual([]);
    expect(() =>
      applyMantisAction(state, 0, { type: "home", factionId: "argent" }),
    ).toThrow("unplayed");
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
