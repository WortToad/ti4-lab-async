import { describe, expect, it } from "vitest";
import { twilightsFallFactionIds } from "~/data/factionData";
import { systemData } from "~/data/systemData";
import {
  applyRawAction,
  createRawDraft,
  getRawLayouts,
  rawActivePlayer,
  rawFactionPool,
  rawHomeChoices,
  rawLegalPositions,
  rawReferenceFaction,
  rawSpliceChoices,
  rawSplicePool,
  type RawSettings,
  type RawState,
} from "./engine";

const settings = (
  players = 3,
  overrides: Partial<RawSettings> = {},
): RawSettings => ({
  players: Array.from({ length: players }, (_, id) => ({
    id,
    name: `Player ${id}`,
  })),
  mode: "base",
  pok: false,
  te: false,
  ...overrides,
});

function chooseFactions(state: RawState): RawState {
  const pool = rawFactionPool(state.settings).filter((id) => id !== "keleres");
  return state.players.reduce(
    (current, player, index) =>
      applyRawAction(current, {
        type: "chooseFaction",
        playerId: player.id,
        factionId: pool[index],
      }),
    state,
  );
}

function buildGalaxy(state: RawState): RawState {
  let next = state;
  let actions = 0;
  while (["map", "mapPreplace"].includes(next.phase)) {
    const playerId = rawActivePlayer(next)!;
    const hand =
      next.phase === "mapPreplace" ? next.preplace : next.hands[playerId];
    const systemId = hand.find(
      (id) => rawLegalPositions(next, playerId, id).length,
    )!;
    expect(systemId, `no legal placement at turn ${next.turn}`).toBeDefined();
    const position = rawLegalPositions(next, playerId, systemId)[0];
    next = applyRawAction(next, {
      type: "placeSystem",
      playerId,
      systemId,
      position,
    });
    expect(++actions).toBeLessThan(65);
  }
  return next;
}

function finishReferences(state: RawState): RawState {
  let next = state;
  while (next.phase === "referenceDraft") {
    const playerId = next.order.find((id) => !next.references[id].ready)!;
    next = applyRawAction(next, {
      type: "pickReference",
      playerId,
      factionId: next.references[playerId].hand[0],
    });
  }
  return next;
}

describe("official RAW galaxy layouts", () => {
  const combinations = [
    { pok: false, te: false },
    { pok: true, te: false },
    { pok: false, te: true },
    { pok: true, te: true },
  ];
  for (const expansions of combinations) {
    for (let count = 3; count <= (expansions.pok ? 8 : 6); count++) {
      for (const layout of getRawLayouts(settings(count, expansions))) {
        it(`deals and completely builds ${layout.id} with ${JSON.stringify(expansions)}`, () => {
          const initial = chooseFactions(
            createRawDraft(
              settings(count, { ...expansions, layout: layout.id }),
            ),
          );
          for (const hand of Object.values(initial.hands)) {
            expect(
              hand.filter((id) => systemData[id].type === "BLUE"),
            ).toHaveLength(layout.blue);
            expect(
              hand.filter((id) => systemData[id].type === "RED"),
            ).toHaveLength(layout.red);
            if (!expansions.pok)
              expect(
                hand.some((id) => Number(id) >= 59 && Number(id) <= 82),
              ).toBe(false);
            if (!expansions.te)
              expect(hand.some((id) => Number(id) >= 92)).toBe(false);
          }
          const dealt = [
            ...Object.values(initial.hands).flat(),
            ...initial.preplace,
          ];
          expect(new Set(dealt).size).toBe(dealt.length);
          expect(initial.preplace).toHaveLength(
            (layout.extraBlue ?? 0) + (layout.extraRed ?? 0),
          );
          const complete = buildGalaxy(initial);
          expect(complete.phase).toBe("complete");
          expect(complete.map.some((tile) => tile.type === "OPEN")).toBe(false);
          expect(Object.values(complete.hands).flat()).toEqual([]);
          if (layout.id === "standard5p") {
            expect(complete.tradeGoods[complete.order[0]]).toBe(2);
            expect(complete.tradeGoods[complete.order[1]]).toBe(4);
            expect(complete.tradeGoods[complete.order[2]]).toBe(2);
          }
        });
      }
    }
  }

  it("uses endpoint double turns and never opens an outer ring early", () => {
    let state = chooseFactions(createRawDraft(settings(), () => 0));
    const turns: number[] = [];
    for (let i = 0; i < 7; i++) {
      const playerId = rawActivePlayer(state)!;
      turns.push(playerId);
      const tile = state.hands[playerId].find(
        (id) => rawLegalPositions(state, playerId, id).length,
      )!;
      const legal = rawLegalPositions(state, playerId, tile);
      expect(
        legal.every((position) =>
          i < 6 ? position <= 6 : position >= 7 && position <= 18,
        ),
      ).toBe(true);
      state = applyRawAction(state, {
        type: "placeSystem",
        playerId,
        systemId: tile,
        position: legal[0],
      });
    }
    expect(turns).toEqual([0, 1, 2, 2, 1, 0, 0]);
  });

  it.each([
    ["44", "45"],
    ["39", "26"],
  ])(
    "permits adjacent %s and %s only when no tile in the hand offers a legal option",
    (neighbor, constrained) => {
      const state = chooseFactions(createRawDraft(settings(), () => 0));
      for (const idx of [3, 4, 5, 6])
        state.map[idx] = { ...state.map[idx], type: "CLOSED" };
      state.map[2] = { ...state.map[2], type: "SYSTEM", systemId: neighbor };
      state.hands[0] = [constrained, "46"];
      expect(rawLegalPositions(state, 0, constrained)).toEqual([]);
      expect(rawLegalPositions(state, 0, "46")).toEqual([1]);
      state.hands[0] = [constrained];
      expect(rawLegalPositions(state, 0, constrained)).toEqual([1]);
    },
  );

  it("exports Creuss Gate and The Sorrow in the galaxy while keeping their home planets off the board", () => {
    let state = createRawDraft(settings(3, { te: true }), () => 0);
    for (const [playerId, factionId] of (
      ["creuss", "crimson", "sol"] as const
    ).entries())
      state = applyRawAction(state, {
        type: "chooseFaction",
        playerId,
        factionId,
      });
    state = buildGalaxy(state);
    const homes = getRawLayouts(state.settings)[0].homes;
    expect(state.map[homes[0]]).toMatchObject({
      type: "SYSTEM",
      systemId: "17",
    });
    expect(state.map[homes[1]]).toMatchObject({
      type: "SYSTEM",
      systemId: "94",
    });
    expect(
      state.map.some(
        (tile) =>
          tile.type === "SYSTEM" && ["51", "118"].includes(tile.systemId),
      ),
    ).toBe(false);
    expect(
      state.log.some((entry) => entry.includes("off-board Creuss (51)")),
    ).toBe(true);
    expect(
      state.log.some((entry) => entry.includes("off-board Ahk Creuxx (118)")),
    ).toBe(true);
  });

  it("resolves normal Keleres' unplayed home choice before dealing galaxy tiles", () => {
    let state = createRawDraft(settings(3, { te: true }), () => 0);
    for (const [playerId, factionId] of (
      ["keleres", "mentak", "sol"] as const
    ).entries())
      state = applyRawAction(state, {
        type: "chooseFaction",
        playerId,
        factionId,
      });
    expect(state.phase).toBe("homes");
    expect(state.hands).toEqual({});
    expect(rawActivePlayer(state)).toBe(0);
    expect(rawHomeChoices(state, 0)).toEqual(["xxcha"]);
    state = applyRawAction(state, {
      type: "chooseHome",
      playerId: 0,
      factionId: "xxcha",
    });
    expect(state.phase).toBe("map");
    state = buildGalaxy(state);
    expect(state.factions[0]).toBe("keleres");
    expect(state.homes[0]).toBe("xxcha");
  });
});

describe("Twilight's Fall RAW starting draft", () => {
  it("passes reference cards left twice and withholds priority reveal until everyone commits", () => {
    let state = createRawDraft(
      settings(3, { mode: "twilightsFall", te: true }),
      () => 0,
    );
    const original = structuredClone(state.references);
    for (const id of state.order)
      state = applyRawAction(state, {
        type: "pickReference",
        playerId: id,
        factionId: state.references[id].hand[0],
      });
    expect(state.references[1].hand).toEqual(original[0].hand.slice(1));
    expect(state.references[2].hand).toEqual(original[1].hand.slice(1));
    expect(state.references[0].hand).toEqual(original[2].hand.slice(1));
    state = finishReferences(state);
    expect(state.phase).toBe("priority");
    expect(state.references[0].drafted).toEqual([
      original[0].hand[0],
      original[2].hand[1],
      original[1].hand[2],
    ]);
    state = applyRawAction(state, {
      type: "choosePriority",
      playerId: 0,
      factionId: state.references[0].drafted[0],
    });
    expect(state.priorities).toEqual({});
    expect(state.phase).toBe("priority");
    for (const id of [1, 2])
      state = applyRawAction(state, {
        type: "choosePriority",
        playerId: id,
        factionId: state.references[id].drafted[0],
      });
    const values = state.order.map(
      (id) => rawReferenceFaction(state.priorities[id]).priorityOrder!,
    );
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(state.speaker).toBe(state.order[0]);
    expect(state.phase).toBe("map");
    expect(Object.keys(state.homes)).toHaveLength(0);
  });

  it.each([false, true])(
    "completes galaxy, clockwise homes, reverse kings, and the complete simultaneous splice (PoK %s)",
    (pok) => {
      let state = finishReferences(
        createRawDraft(settings(3, { mode: "twilightsFall", te: true, pok })),
      );
      for (const id of state.order)
        state = applyRawAction(state, {
          type: "choosePriority",
          playerId: id,
          factionId: state.references[id].drafted[0],
        });
      state = buildGalaxy(state);
      expect(state.phase).toBe("homes");
      for (const id of state.order) {
        expect(rawActivePlayer(state)).toBe(id);
        const hand = state.references[id].drafted;
        state = applyRawAction(state, {
          type: "chooseHome",
          playerId: id,
          factionId: hand[0],
        });
        expect(state.fleets[id]).toBe(hand[1]);
      }
      expect(state.phase).toBe("kings");
      for (const [index, id] of [...state.order].reverse().entries()) {
        expect(rawActivePlayer(state)).toBe(id);
        state = applyRawAction(state, {
          type: "chooseKing",
          playerId: id,
          factionId: twilightsFallFactionIds[index],
        });
      }
      expect(state.phase).toBe("splice");
      const originalHands = structuredClone(state.splice);
      for (const id of state.order) {
        const card = state.splice[id].hand[0];
        state = applyRawAction(state, {
          type: "pickSplice",
          playerId: id,
          itemId: card,
        });
      }
      expect(state.splice[state.order[0]].hand).toEqual(
        originalHands[state.order[1]].hand.slice(1),
      );
      let actions = 0;
      while (state.phase === "splice") {
        const id = state.order.find(
          (player) => rawSpliceChoices(state, player).length,
        )!;
        expect(id).toBeDefined();
        state = applyRawAction(state, {
          type: "pickSplice",
          playerId: id,
          itemId: rawSpliceChoices(state, id)[0],
        });
        expect(++actions).toBeLessThan(30);
      }
      expect(state.phase).toBe("spliceKeep");
      for (const [index, id] of state.order.entries()) {
        const drafted = state.splice[id].drafted;
        expect(drafted.filter((card) => card.startsWith("TECH:"))).toHaveLength(
          3,
        );
        expect(drafted.filter((card) => card.startsWith("UNIT:"))).toHaveLength(
          2,
        );
        expect(
          drafted.filter((card) => card.startsWith("AGENT:")),
        ).toHaveLength(2);
        const itemIds = [
          ...drafted.filter((card) => card.startsWith("TECH:")).slice(0, 2),
          drafted.find((card) => card.startsWith("UNIT:"))!,
          drafted.find((card) => card.startsWith("AGENT:"))!,
        ];
        state = applyRawAction(state, {
          type: "keepSplice",
          playerId: id,
          itemIds,
        });
        expect(state.phase).toBe(
          index === state.order.length - 1 ? "complete" : "spliceKeep",
        );
      }
    },
  );

  it("contains the physical 87/31/31 decks and applies the exact no-PoK exclusions", () => {
    const pool = rawSplicePool();
    expect(pool.filter((card) => card.category === "TECH")).toHaveLength(87);
    expect(pool.filter((card) => card.category === "UNIT")).toHaveLength(31);
    expect(pool.filter((card) => card.category === "AGENT")).toHaveLength(31);
    expect(rawSplicePool(false)).toHaveLength(141);
    expect(new Set(pool.map((card) => card.id)).size).toBe(149);
  });

  it("automatically passes quota-blocked hands until each remaining card reaches an eligible player", () => {
    const state = createRawDraft(
      settings(3, { mode: "twilightsFall", te: true }),
      () => 0,
    );
    const pool = rawSplicePool();
    const tech = pool
      .filter((item) => item.category === "TECH")
      .map((item) => item.id);
    const unit = pool
      .filter((item) => item.category === "UNIT")
      .map((item) => item.id);
    const genome = pool
      .filter((item) => item.category === "AGENT")
      .map((item) => item.id);
    state.phase = "splice";
    state.spliceRound = 6;
    state.splice = {
      0: {
        drafted: [...tech.slice(0, 3), unit[0], genome[0]],
        hand: [unit[4], tech[8]],
        ready: false,
      },
      1: {
        drafted: [
          ...tech.slice(3, 5),
          ...unit.slice(1, 3),
          ...genome.slice(1, 3),
        ],
        hand: [unit[5]],
        ready: false,
      },
      2: {
        drafted: [...tech.slice(5, 8), unit[3], ...genome.slice(3, 5)],
        hand: [genome[5]],
        ready: false,
      },
    };
    const advanced = applyRawAction(state, {
      type: "pickSplice",
      playerId: 0,
      itemId: unit[4],
    });
    expect(advanced.spliceRound).toBe(8);
    expect(rawSpliceChoices(advanced, 0)).toEqual([genome[5]]);
    expect(rawSpliceChoices(advanced, 1)).toEqual([tech[8]]);
    expect(rawSpliceChoices(advanced, 2)).toEqual([unit[5]]);
  });
});
