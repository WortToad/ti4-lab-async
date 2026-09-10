import { describe, expect, it } from "vitest";
import { getBagPendingAction, getBasePendingAction } from "./turn";
import { rememberDraftTurn } from "./turnNotifications";
import { HOME_PHASE, PRIORITY_PHASE, type Draft } from "~/types";
import type { BagDraftView } from "./bag/types";

const draft = {
  players: [
    { id: 0, name: "Alice" },
    { id: 1, name: "Bob" },
  ],
  settings: {},
  selections: [],
  pickOrder: [0, 1, 1, 0],
} as unknown as Draft;

describe("pending draft actions", () => {
  it("only identifies a participant's own turn and distinguishes consecutive picks", () => {
    expect(getBasePendingAction(draft, 0)?.key).toBe("0:pick");
    expect(getBasePendingAction(draft, 1)).toBeUndefined();
    expect(getBasePendingAction(draft)).toBeUndefined();
    expect(getBasePendingAction(draft, 99)).toBeUndefined();
    const later = { ...draft, selections: [{}] } as Draft;
    const next = { ...draft, selections: [{}, {}] } as Draft;
    expect(getBasePendingAction(later, 1)?.key).not.toEqual(
      getBasePendingAction(next, 1)?.key,
    );
  });

  it.each([
    "priorityValue",
    "homeSystem",
    "texasFaction",
    "texasBlueKeep1",
    "texasBlueKeep2",
    "texasRedKeep",
  ] as const)(
    "waits after a submitted %s choice without waiting for the other players",
    (phase) => {
      const simultaneous: Draft = {
        ...draft,
        pickOrder: [{ kind: "simultaneous", phase }],
      };
      expect(getBasePendingAction(simultaneous, 0)).toBeDefined();
      simultaneous.stagedSelections = { [phase]: { 0: "chosen" } };
      expect(getBasePendingAction(simultaneous, 0)).toBeUndefined();
      expect(getBasePendingAction(simultaneous, 1)).toBeDefined();
    },
  );

  it.each([PRIORITY_PHASE, HOME_PHASE])(
    "supports legacy simultaneous marker %i",
    (marker) => {
      expect(
        getBasePendingAction({ ...draft, pickOrder: [marker] }, 0),
      ).toBeDefined();
    },
  );

  it("does not report completed drafts as pending", () => {
    expect(
      getBasePendingAction({ ...draft, pickOrder: [] }, 0),
    ).toBeUndefined();
  });

  it("tracks bag ready and assembly confirmation independently of other players", () => {
    const view = {
      phase: "drafting",
      round: 2,
      lobby: { paused: false },
      privateSeat: { id: 0, ready: false, picksRequired: 2, finished: false },
    } as BagDraftView;
    expect(getBagPendingAction(view)?.key).toBe("drafting:2");
    view.privateSeat!.ready = true;
    expect(getBagPendingAction(view)).toBeUndefined();
    view.phase = "assembling";
    expect(getBagPendingAction(view)?.key).toBe("assembling");
    view.privateSeat!.finished = true;
    expect(getBagPendingAction(view)).toBeUndefined();
    view.privateSeat!.finished = false;
    view.lobby.paused = true;
    expect(getBagPendingAction(view)).toBeUndefined();
    expect(
      getBagPendingAction({ ...view, privateSeat: undefined }),
    ).toBeUndefined();
  });
});

describe("turn alert deduplication", () => {
  it("survives reload, isolates identities and notifies when an action returns after waiting", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    expect(rememberDraftTurn(storage, "bag:one:0", "round:2")).toBe(true);
    expect(rememberDraftTurn(storage, "bag:one:0", "round:2")).toBe(false);
    expect(rememberDraftTurn(storage, "bag:one:1", "round:2")).toBe(true);
    expect(rememberDraftTurn(storage, "bag:two:0", "round:2")).toBe(true);
    expect(rememberDraftTurn(storage, "bag:one:0")).toBe(false);
    expect(rememberDraftTurn(storage, "bag:one:0", "round:2")).toBe(true);
    expect(rememberDraftTurn(storage, "bag:one:0", "round:3")).toBe(true);
  });
});
