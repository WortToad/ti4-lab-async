import { describe, expect, it } from "vitest";
import { getBagDraftItem } from "./catalog";
import type { BagDraftView } from "./types";
import {
  defaultBagSelection,
  getBagSelectionConfig,
  restorePendingBagSelection,
  serializePendingBagSelection,
  validatePendingBagSelection,
  type BagSelectionConfig,
} from "./pendingSelections";

const ability = getBagDraftItem("ABILITY:star_forge")!;
const otherAbility = getBagDraftItem("ABILITY:telepathic")!;
const mech = getBagDraftItem("MECH:sol_mech")!;
const replacement = getBagDraftItem("MECH:muaat_mech")!;
const config: BagSelectionConfig = {
  phase: "drafting",
  round: 1,
  variant: "franken",
  items: [ability, otherAbility, mech],
  baseIds: [],
  legalIds: [ability.id, otherAbility.id, mech.id],
  handIds: [],
  committedIds: [],
  limits: { ABILITY: 2, MECH: 2 },
  required: 2,
};
const assembling: BagSelectionConfig = {
  ...config,
  phase: "assembling",
  items: [...config.items, replacement],
  baseIds: config.items.map((item) => item.id),
  limits: { ABILITY: 1, MECH: 1 },
};

describe("pending bag choices", () => {
  it("restores a partial selection from the same player and bag", () => {
    const saved = serializePendingBagSelection("owner-a", config, [mech.id]);
    expect(restorePendingBagSelection(saved, "owner-a", config)).toEqual([
      mech.id,
    ]);
    expect(saved).not.toContain("recovery");
  });

  it("keeps an intentionally cleared selection empty", () => {
    const forced = { ...config, legalIds: [ability.id, mech.id] };
    expect(defaultBagSelection(forced)).toEqual(forced.legalIds);
    expect(
      restorePendingBagSelection(
        serializePendingBagSelection("a", forced, []),
        "a",
        forced,
      ),
    ).toEqual([]);
  });

  it("does not restore another player's or a rotated identity's private choices", () => {
    const saved = serializePendingBagSelection("owner-a", config, [mech.id]);
    expect(restorePendingBagSelection(saved, "owner-b", config)).toEqual([]);
  });

  it.each([
    { ...config, round: 2 },
    { ...config, items: [otherAbility, mech] },
    { ...config, handIds: ["ABILITY:other"] },
    { ...config, legalIds: [otherAbility.id] },
    { ...config, limits: { ABILITY: 1, MECH: 1 } },
    assembling,
  ])(
    "discards choices after the phase, round, hand or rules change",
    (next) => {
      const saved = serializePendingBagSelection("a", config, [
        ability.id,
        mech.id,
      ]);
      expect(restorePendingBagSelection(saved, "a", next)).toEqual(
        defaultBagSelection(next),
      );
    },
  );

  it("recovers from missing, malformed or unknown-version data", () => {
    for (const raw of [null, "invalid", "{}", '{"version":99}', "[]"])
      expect(restorePendingBagSelection(raw, "a", config)).toEqual([]);
  });

  it("removes unknown, duplicate, illegal and over-limit picks", () => {
    expect(
      validatePendingBagSelection(config, [
        "missing",
        mech.id,
        mech.id,
        ability.id,
        otherAbility.id,
      ]),
    ).toEqual([mech.id, ability.id]);
    expect(
      validatePendingBagSelection({ ...config, required: 1 }, [
        ability.id,
        mech.id,
      ]),
    ).toEqual([ability.id]);
    expect(
      validatePendingBagSelection(config, [ability.id, otherAbility.id]),
    ).toEqual([ability.id]);
    expect(
      validatePendingBagSelection(
        { ...config, handIds: ["MECH:a", "MECH:b"] },
        [mech.id],
      ),
    ).toEqual([]);
    expect(validatePendingBagSelection(config, "not-an-array")).toEqual([]);
  });

  it("preserves valid assembly replacements but drops ones without their granting component", () => {
    const saved = serializePendingBagSelection("a", assembling, [
      ability.id,
      replacement.id,
    ]);
    expect(restorePendingBagSelection(saved, "a", assembling)).toEqual([
      ability.id,
      replacement.id,
    ]);
    expect(
      validatePendingBagSelection(assembling, [
        otherAbility.id,
        replacement.id,
      ]),
    ).toEqual([otherAbility.id]);
    expect(
      validatePendingBagSelection(assembling, [
        ability.id,
        otherAbility.id,
        mech.id,
        replacement.id,
      ]),
    ).toEqual([ability.id, mech.id]);
  });

  it("preserves Twilight's Fall generic substitutions without counting them against the drafted technology limit", () => {
    const technology = getBagDraftItem("TECH:wavelength")!;
    const tf = {
      ...assembling,
      variant: "twilights_fall" as const,
      items: [...assembling.items, technology],
      limits: { ...assembling.limits, TECH: 0 },
    };
    expect(
      validatePendingBagSelection(tf, [otherAbility.id, technology.id]),
    ).toEqual([otherAbility.id, technology.id]);
  });
});

describe("private bag selection context", () => {
  const view: BagDraftView = {
    id: "room",
    settings: { variant: "franken" },
    rules: {
      draftLimits: config.limits,
      keepLimits: assembling.limits,
      firstBagPicks: 2,
      laterBagPicks: 1,
    },
    phase: "drafting",
    round: 1,
    revision: 7,
    lobby: {
      started: true,
      paused: false,
      slots: [],
      ownUuid: "player-secret",
    },
    players: [],
    viewer: { isAdmin: false, playerId: 0 },
    canUndoRound: false,
    privateSeat: {
      id: 0,
      bag: config.items,
      hand: [],
      assemblyOptions: [],
      assemblyBaseItemIds: [],
      keptItemIds: [],
      roundPicks: [],
      ready: false,
      finished: false,
      canUndo: false,
      picksRequired: 2,
      draftableItemIds: config.legalIds,
    },
  };

  it("does not include names or recovery credentials in saved context", () => {
    const context = JSON.stringify(getBagSelectionConfig(view));
    expect(context).not.toContain("player-secret");
    expect(getBagSelectionConfig({ ...view, revision: 8 })).toEqual(
      getBagSelectionConfig(view),
    );
  });

  it("does not load or persist selections for spectators, admins without a seat, or released identities", () => {
    expect(
      getBagSelectionConfig({ ...view, privateSeat: undefined }),
    ).toBeNull();
    expect(
      getBagSelectionConfig({ ...view, viewer: { isAdmin: true } }),
    ).toBeNull();
    expect(
      getBagSelectionConfig({
        ...view,
        lobby: { ...view.lobby, ownUuid: undefined },
      }),
    ).toBeNull();
    expect(
      getBagSelectionConfig({
        ...view,
        viewer: { isAdmin: false, playerId: 1 },
      }),
    ).toBeNull();
  });

  it("clears pending selections when picks are committed or assembly finishes", () => {
    expect(
      getBagSelectionConfig({
        ...view,
        privateSeat: { ...view.privateSeat!, ready: true },
      }),
    ).toBeNull();
    expect(
      getBagSelectionConfig({
        ...view,
        phase: "assembling",
        privateSeat: { ...view.privateSeat!, finished: true },
      }),
    ).toBeNull();
    expect(getBagSelectionConfig({ ...view, phase: "complete" })).toBeNull();
    expect(getBagSelectionConfig({ ...view, phase: "lobby" })).toBeNull();
  });
});
