import { describe, expect, it } from "vitest";
import {
  applyBagAction,
  assemblyOptions,
  createBagState,
  draftableItems,
  keptBagItems,
  requiredBagPicks,
} from "./engine";
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
