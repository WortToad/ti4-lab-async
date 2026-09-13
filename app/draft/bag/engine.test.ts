import { describe, expect, it } from "vitest";
import {
  applyBagAction,
  assemblyOptions,
  createBagState,
  draftableItems,
  getBagSetupError,
  keptBagItems,
  requiredBagPicks,
} from "./engine";
import { bagMapBuildError, bagToMantisState } from "./bagToMantis";
import {
  applyMantisAction,
  mantisBuildTurn,
  undoMantisAction,
} from "../mantis/engine";
import {
  encodeAsyncMapString,
  decodeAsyncMapString,
  encodeTtpgMapString,
  decodeTtpgMapString,
} from "~/mapgen/utils/externalMapStringCodec";
import { BAG_VARIANTS, getBagRules, isTwilightsFallBag } from "./rules";
import type { BagDraftState, BagSeat, CreateBagDraftInput } from "./types";

const input: CreateBagDraftInput = {
  variant: "franken",
  players: ["Alice", "Bob", "Carol"],
  shufflePlayers: false,
};
const random = () => 0.42;

function picks(state: BagDraftState, seat: BagSeat) {
  const result: string[] = [];
  const required = requiredBagPicks(state, seat);
  while (result.length < required)
    result.push(draftableItems(state, seat, result)[0]);
  return result;
}

function finishDraft(state: BagDraftState) {
  let next = state;
  for (let i = 0; i < 1000 && next.phase === "drafting"; i++) {
    const seat = next.seats.find((player) => !player.ready)!;
    expect(seat).toBeDefined();
    next = applyBagAction(next, seat.id, {
      action: "pick",
      round: next.round,
      itemIds: picks(next, seat),
    });
  }
  expect(next.phase).toBe("assembling");
  return next;
}

function finalPicks(state: BagDraftState, seat: BagSeat) {
  const options = assemblyOptions(state, seat);
  return Object.entries(state.rules.keepLimits).flatMap(([category, limit]) =>
    options
      .filter(
        (item) =>
          item.category === category &&
          !["TECH:wavelength", "TECH:antimatter"].includes(item.id),
      )
      .slice(0, limit)
      .map((item) => item.id),
  );
}

describe("bag draft rules", () => {
  it("reports an impossible FrankenDraz setup before dealing and clears it when the pool fits", () => {
    const settings: CreateBagDraftInput = {
      ...input,
      variant: "frankendraz",
      players: ["A", "B", "C", "D", "E", "F"],
    };
    expect(getBagSetupError(settings)).toContain("need 36 items");
    expect(getBagSetupError(settings)).toContain("only 30 are available");
    expect(() => createBagState(settings)).toThrow(getBagSetupError(settings));
    expect(
      getBagSetupError({ ...settings, includeDiscordantStars: true }),
    ).toBeUndefined();
    expect(
      getBagSetupError({ ...settings, players: settings.players.slice(0, 5) }),
    ).toBeUndefined();
    expect(
      getBagSetupError({
        ...settings,
        categoryLimits: { FACTION: { draft: 5, keep: 0 } },
      }),
    ).toBeUndefined();
    expect(settings.categoryLimits).toBeUndefined();
  });

  it("preflights custom tile counts, banned cards, priorities and invalid keep counts", () => {
    expect(
      getBagSetupError({
        ...input,
        variant: "standard_bag_draft",
        players: Array.from({ length: 8 }, (_, index) => `Player ${index + 1}`),
        categoryLimits: { BLUETILE: { draft: 12, keep: 3 } },
      }),
    ).toMatch(/Blue tile: need 96/);
    expect(
      getBagSetupError({
        ...input,
        variant: "frankendraz",
        priorityFactions: ["hacan"],
        bannedItemIds: ["FACTION:hacan"],
      }),
    ).toMatch(/Prioritized factions/);
    expect(
      getBagSetupError({
        ...input,
        categoryLimits: { ABILITY: { draft: 1, keep: 2 } },
      }),
    ).toMatch(/keep limit cannot exceed/);
  });

  it.each(BAG_VARIANTS)(
    "accepts an available $name pool during setup without dealing it",
    ({ id }) => {
      expect(getBagSetupError({ ...input, variant: id })).toBeUndefined();
    },
  );

  it("requires the keep count, reduced only when fewer choices are available", () => {
    const state = createBagState(input, random);
    state.phase = "assembling";
    state.rules.keepLimits = { ABILITY: 2 };
    state.seats[0].hand = ["ABILITY:star_forge", "ABILITY:telepathic"];
    expect(() =>
      applyBagAction(state, 0, {
        action: "assemble",
        itemIds: ["ABILITY:telepathic"],
      }),
    ).toThrow("Choose 2 Faction ability before finishing.");

    state.seats[0].hand = ["ABILITY:telepathic"];
    expect(() =>
      applyBagAction(state, 0, { action: "assemble", itemIds: [] }),
    ).toThrow("Choose 1 Faction ability before finishing.");
    expect(
      applyBagAction(state, 0, {
        action: "assemble",
        itemIds: ["ABILITY:telepathic"],
      }).seats[0].finished,
    ).toBe(true);
  });

  it("requires retaining the parent of an optional swap", () => {
    const state = createBagState(input, random);
    state.phase = "assembling";
    state.rules.keepLimits = { ABILITY: 1, MECH: 1 };
    state.seats[0].hand = [
      "ABILITY:star_forge",
      "ABILITY:telepathic",
      "MECH:sol_mech",
    ];
    expect(() =>
      applyBagAction(state, 0, {
        action: "assemble",
        itemIds: ["ABILITY:telepathic", "MECH:muaat_mech"],
      }),
    ).toThrow(/requires keeping/);
    const result = applyBagAction(state, 0, {
      action: "assemble",
      itemIds: ["ABILITY:star_forge", "MECH:muaat_mech"],
    });
    expect(result.seats[0].finished).toBe(true);
  });

  it("automatically includes companion components and hides disabled monument swaps", () => {
    const state = createBagState(input, random);
    state.phase = "assembling";
    state.rules.keepLimits = { ABILITY: 1, HERO: 1 };
    state.seats[0].hand = ["ABILITY:amalgamation"];
    expect(
      assemblyOptions(state, state.seats[0]).some(
        (item) => item.category === "MONUMENT",
      ),
    ).toBe(false);
    const result = applyBagAction(state, 0, {
      action: "assemble",
      itemIds: ["ABILITY:amalgamation", "HERO:cabalhero"],
    });
    expect(
      keptBagItems(result, result.seats[0]).map((item) => item.id),
    ).toContain("ABILITY:devour");
  });

  it("matches Twilight’s Fall and Inaugural Splice quotas", () => {
    const tf = getBagRules({ variant: "twilights_fall" });
    expect(Object.values(tf.draftLimits).reduce((a, b) => a + b, 0)).toBe(18);
    expect(tf.keepLimits).toMatchObject({
      TECH: 2,
      AGENT: 1,
      UNIT: 1,
      MAHACTKING: 1,
    });
    expect(getBagRules({ variant: "inaugural_splice" })).toEqual({
      draftLimits: { TECH: 3, AGENT: 2, UNIT: 2 },
      keepLimits: { TECH: 2, AGENT: 1, UNIT: 1 },
      firstBagPicks: 1,
      laterBagPicks: 1,
    });
  });

  it.each(BAG_VARIANTS)(
    "completes $name without losing or duplicating dealt items",
    ({ id }) => {
      const initial = createBagState({ ...input, variant: id }, random);
      const dealt = initial.seats.flatMap((seat) => seat.bag).sort();
      expect(new Set(dealt).size).toBe(dealt.length);
      let state = finishDraft(initial);
      expect(state.seats.flatMap((seat) => seat.hand).sort()).toEqual(dealt);
      for (const seat of state.seats) {
        for (const [category, limit] of Object.entries(
          state.rules.draftLimits,
        )) {
          expect(
            seat.hand.filter((item) => item.startsWith(`${category}:`)),
          ).toHaveLength(limit);
        }
        state = applyBagAction(state, seat.id, {
          action: "assemble",
          itemIds: finalPicks(state, seat),
        });
      }
      expect(state.phase).toBe("complete");
      for (const seat of state.seats)
        expect(keptBagItems(state, seat).length).toBeGreaterThan(0);
      expect(initial.phase).toBe("drafting");
      expect(initial.seats.every((seat) => seat.hand.length === 0)).toBe(true);
    },
  );

  it.each(
    BAG_VARIANTS.flatMap((variant) =>
      [3, 4, 5, 6, 7, 8].map((count) => ({ ...variant, count })),
    ),
  )(
    "finishes $name with $count players through its map handoff and export",
    ({ id, count }) => {
      let bag = finishDraft(
        createBagState(
          {
            ...input,
            variant: id,
            players: Array.from(
              { length: count },
              (_, index) => `Player ${index + 1}`,
            ),
            // Large Franken pools need additional faction components.
            includeDiscordantStars: true,
          },
          random,
        ),
      );
      for (const seat of bag.seats) {
        bag = applyBagAction(bag, seat.id, {
          action: "assemble",
          itemIds: finalPicks(bag, seat),
        });
      }
      expect(bag.phase).toBe("complete");
      if (id === "inaugural_splice") {
        expect(bagMapBuildError(bag)).toMatch(/does not include map tiles/);
        return;
      }
      expect(bagMapBuildError(bag)).toBeUndefined();
      const savedBag = structuredClone(bag);
      let map = bagToMantisState(bag, random);
      const tiles = Object.values(map.hands).flat().sort();
      expect(tiles).toHaveLength(count * 5);
      const fixed = map.map.filter((tile) => tile.type !== "OPEN");
      let turns = 0;
      while (map.phase === "build") {
        const turn = mantisBuildTurn(map)!;
        expect(turn.positions.length).toBeGreaterThan(0);
        const before = structuredClone(map);
        map = applyMantisAction(
          map,
          turn.playerId,
          { type: "place", mapIdx: turn.positions[0] },
          random,
        );
        // Reload serialized state between every turn, as a persisted room does.
        map = JSON.parse(JSON.stringify(map));
        if (turns === 0) {
          const restored = undoMantisAction(map);
          expect(restored.map).toEqual(before.map);
          expect(restored.hands).toEqual(before.hands);
          expect(restored.drawnTile).toBe(before.drawnTile);
        }
        expect(++turns).toBeLessThanOrEqual(count * 5);
      }
      expect(map.phase).toBe("complete");
      expect(Object.values(map.hands).flat()).toEqual([]);
      expect(map.map.some((tile) => tile.type === "OPEN")).toBe(false);
      for (const tile of fixed) expect(map.map[tile.idx]).toEqual(tile);
      const placed = map.map.flatMap((tile) =>
        tile.type === "SYSTEM" && tiles.includes(tile.systemId)
          ? [tile.systemId]
          : [],
      );
      expect(placed.sort()).toEqual(tiles);
      for (const [encode, decode] of [
        [encodeAsyncMapString, decodeAsyncMapString],
        [encodeTtpgMapString, decodeTtpgMapString],
      ] as const) {
        const decoded = decode(encode(map.map));
        expect(decoded).not.toBeNull();
        // External formats encode closed spaces as -1 and homes as 0;
        // verify system positions/rotations and stable external serialization.
        expect(encode(decoded!.map)).toBe(encode(map.map));
        for (const tile of map.map.filter((tile) => tile.type === "SYSTEM")) {
          const restored = decoded!.map[tile.idx];
          expect(restored).toMatchObject({
            type: "SYSTEM",
            systemId: tile.systemId,
          });
          expect(
            restored.type === "SYSTEM" ? (restored.rotation ?? 0) : null,
          ).toBe(tile.rotation ?? 0);
        }
      }
      expect(bag).toEqual(savedBag);
    },
  );

  it("rejects exhausted pools instead of silently dealing incomplete bags", () => {
    expect(() =>
      createBagState({
        ...input,
        variant: "frankendraz",
        players: Array.from({ length: 8 }, (_, i) => `Player ${i}`),
      }),
    ).toThrow(/need 48/);
  });

  it("includes prioritized faction packages and rejects conflicting priorities", () => {
    const settings: CreateBagDraftInput = {
      ...input,
      variant: "frankendraz",
      priorityFactions: ["hacan"],
    };
    const state = createBagState(settings, random);
    expect(state.seats.flatMap((seat) => seat.bag)).toContain("FACTION:hacan");
    expect(() =>
      createBagState({ ...settings, bannedFactions: ["hacan"] }, random),
    ).toThrow(/Prioritized factions/);
  });

  it("honors bans, source packs, disabled map drafting, and custom picks", () => {
    const bannedItem = createBagState(input, random).seats[0].bag[0];
    const state = createBagState(
      {
        ...input,
        includeThundersEdge: false,
        includeTiles: false,
        bannedFactions: ["hacan"],
        bannedItemIds: [bannedItem],
        firstBagPicks: 1,
      },
      random,
    );
    expect(state.rules.draftLimits.BLUETILE).toBeUndefined();
    expect(state.rules.draftLimits.BREAKTHROUGH).toBeUndefined();
    expect(state.seats.flatMap((seat) => seat.bag)).not.toContain(bannedItem);
    expect(requiredBagPicks(state, state.seats[0])).toBe(1);
  });

  it("rejects invalid settings and forged or repeated selections", () => {
    expect(() => createBagState({ ...input, players: [" ", "Bob"] })).toThrow(
      /name/,
    );
    expect(() => createBagState({ ...input, firstBagPicks: 0 })).toThrow(
      /whole number/,
    );
    const state = createBagState(input, random);
    const selected = picks(state, state.seats[0]);
    expect(() =>
      applyBagAction(state, 0, {
        action: "pick",
        round: 0,
        itemIds: [selected[0], selected[0], selected[0]],
      }),
    ).toThrow(/twice/);
    expect(() =>
      applyBagAction(state, 0, {
        action: "pick",
        round: 0,
        itemIds: state.seats[1].bag.slice(0, 3),
      }),
    ).toThrow(/unavailable/);
    expect(() =>
      applyBagAction(state, undefined, {
        action: "pick",
        round: 0,
        itemIds: selected,
      }),
    ).toThrow(/private/);
  });

  it("waits for everyone, supports undo before passing, and rejects stale picks", () => {
    const initial = createBagState(input, random);
    let state = applyBagAction(initial, 0, {
      action: "pick",
      round: 0,
      itemIds: picks(initial, initial.seats[0]),
    });
    expect(state.round).toBe(0);
    expect(state.seats[0].ready).toBe(true);
    state = applyBagAction(state, 0, { action: "undo", round: 0 });
    expect(state.seats[0].hand).toEqual([]);
    expect([...state.seats[0].bag].sort()).toEqual(
      [...initial.seats[0].bag].sort(),
    );
    for (const player of initial.seats)
      state = applyBagAction(state, player.id, {
        action: "pick",
        round: 0,
        itemIds: picks(state, state.seats[player.id]),
      });
    expect(state.round).toBe(1);
    expect(() =>
      applyBagAction(state, 0, { action: "pick", round: 0, itemIds: [] }),
    ).toThrow(/passed/);
    expect(() =>
      applyBagAction(state, 0, { action: "undo", round: 0 }),
    ).toThrow(/passed/);
    expect(() =>
      applyBagAction(state, undefined, {
        action: "undoRound",
        revision: state.revision,
      }),
    ).toThrow(/host/);
    const undone = applyBagAction(
      state,
      undefined,
      { action: "undoRound", revision: state.revision },
      true,
    );
    expect(undone.seats).toEqual(initial.seats);
    expect(undone.round).toBe(0);
  });

  it("expands FrankenDraz packages into components and enforces keep limits", () => {
    const state = finishDraft(
      createBagState({ ...input, variant: "frankendraz" }, random),
    );
    const seat = state.seats[0];
    const options = assemblyOptions(state, seat);
    expect(options.some((item) => item.category === "FACTION")).toBe(false);
    expect(options.some((item) => item.category === "ABILITY")).toBe(true);
    expect(() =>
      applyBagAction(state, seat.id, {
        action: "assemble",
        itemIds: options.map((item) => item.id),
      }),
    ).toThrow(/at most/);
    expect(() =>
      applyBagAction(state, seat.id, { action: "assemble", itemIds: [] }),
    ).toThrow(/Choose/);
  });

  it.each(["twilights_fall", "inaugural_splice"] as const)(
    "allows generic technologies to replace genomes or units in %s",
    (variant) => {
      const state = finishDraft(createBagState({ ...input, variant }, random));
      expect(isTwilightsFallBag(variant)).toBe(true);
      const selected = finalPicks(state, state.seats[0]).filter(
        (id) => !id.startsWith("AGENT:") && !id.startsWith("UNIT:"),
      );
      selected.push("TECH:wavelength", "TECH:antimatter");
      const next = applyBagAction(state, 0, {
        action: "assemble",
        itemIds: selected,
      });
      expect(next.seats[0].finished).toBe(true);
      expect(() =>
        applyBagAction(state, 0, {
          action: "assemble",
          itemIds: [...finalPicks(state, state.seats[0]), "TECH:wavelength"],
        }),
      ).toThrow(/replace/);
    },
  );
});
