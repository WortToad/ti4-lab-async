import { afterEach, describe, expect, it } from "vitest";
import { draftStore, randomizeFactions } from "./draftStore";
import type { Draft } from "./types";
import { getFactionPool } from "./utils/factions";

const factions = getFactionPool(["base", "pok"]);

function prepareDraft(
  playerCount: number,
  count: number,
  settings: Partial<Draft["settings"]> = {},
) {
  const draft = structuredClone(draftStore.getState().draft);
  draft.settings = {
    ...draft.settings,
    factionGameSets: ["base", "pok"],
    numFactions: count,
    ...settings,
  };
  draft.players = Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `Player ${id}`,
  }));
  draft.availableFactions = factions.slice(0, count);
  draftStore.getState().actions.initializeDraftFromSavedState(draft);
  return draftStore.getState().actions;
}

afterEach(() => draftStore.getState().actions.reset());

describe("live draft refresh", () => {
  function liveDraft() {
    const draft = structuredClone(draftStore.getState().draft);
    draft.settings.factionGameSets = ["base"];
    draft.settings.tileGameSets = ["base"];
    draft.players = [
      { id: 0, name: "Alice" },
      { id: 1, name: "Bob" },
    ];
    draft.pickOrder = [0, 1, 1, 0];
    draft.selections = [
      { type: "SELECT_FACTION", playerId: 0, factionId: "hacan" },
      { type: "SELECT_FACTION", playerId: 1, factionId: "sol" },
    ];
    return draft;
  }

  it("preserves selected player and open controls while accepting new server settings and choices", () => {
    const original = liveDraft();
    const store = draftStore.getState();
    store.draftActions.hydrate("room", "room-url", original);
    store.draftActions.setSelectedPlayer(1);
    store.actions.openPlanetFinderForMap(4);
    const next = {
      ...original,
      settings: {
        ...original.settings,
        factionGameSets: [
          "base",
          "pok",
        ] as Draft["settings"]["factionGameSets"],
      },
      stagedSelections: { homeSystem: { 1: "sol" } },
    };
    store.draftActions.update("room", next);
    expect(draftStore.getState().draft).toEqual(next);
    expect(draftStore.getState().selectedPlayer).toBe(1);
    expect(draftStore.getState().planetFinderModal).toEqual({
      mode: "map",
      tileIdx: 4,
    });
    expect(draftStore.getState().factionPool).toEqual(
      getFactionPool(["base", "pok"]),
    );
    store.draftActions.update("different-room", original);
    expect(draftStore.getState().draft).toEqual(next);
  });

  it("preserves the replay position, follows changed live history, and restores live selections when exiting", () => {
    const original = liveDraft();
    const store = draftStore.getState();
    store.draftActions.hydrate("room", "room-url", original);
    store.replayActions.enableReplayMode();
    store.replayActions.stepForward();
    const next: Draft = {
      ...original,
      selections: [
        ...original.selections,
        { type: "SELECT_SLICE", playerId: 1, sliceIdx: 0 },
      ],
    };
    store.draftActions.update("room", next);
    expect(draftStore.getState().replayMode).toBe(true);
    expect(draftStore.getState().replayIndex).toBe(1);
    expect(draftStore.getState().draft.selections).toEqual(
      next.selections.slice(0, 1),
    );
    expect(draftStore.getState().replaySelections).toEqual(next.selections);
    store.replayActions.jumpToEnd();
    store.draftActions.update("room", original);
    expect(draftStore.getState().replayIndex).toBe(2);
    store.replayActions.jumpToStart();
    store.replayActions.disableReplayMode();
    expect(draftStore.getState().draft.selections).toEqual(original.selections);
    expect(draftStore.getState().replaySelections).toBeUndefined();
  });
});

describe("draft faction pool editing", () => {
  it.each([3, 4, 5, 6, 7, 8])(
    "keeps the separate minor pool at its %i-player minimum",
    (count) => {
      const actions = prepareDraft(count, count, {
        numMinorFactions: count + 2,
      });
      const minorPool = factions.slice(count, count * 2 + 2);
      const draft = structuredClone(draftStore.getState().draft);
      draft.availableMinorFactions = minorPool;
      draftStore.setState({ draft });

      actions.removeLastMinorFaction();
      actions.removeMinorFaction(minorPool[0]);
      expect(draftStore.getState().draft.availableMinorFactions).toHaveLength(count);
      actions.removeLastMinorFaction();
      actions.removeMinorFaction(minorPool[1]);
      expect(draftStore.getState().draft.availableMinorFactions).toHaveLength(count);
      expect(draftStore.getState().draft.settings.numMinorFactions).toBe(count);
    },
  );

  it("does not decrement the minor count when removing a faction outside its pool", () => {
    const actions = prepareDraft(3, 3, { numMinorFactions: 4 });
    const draft = structuredClone(draftStore.getState().draft);
    draft.availableMinorFactions = factions.slice(3, 7);
    draftStore.setState({ draft });
    actions.removeMinorFaction(factions[0]);
    expect(draftStore.getState().draft.settings.numMinorFactions).toBe(4);
    expect(draftStore.getState().draft.availableMinorFactions).toHaveLength(4);
  });

  it("excludes Keleres from minor-only pools and refuses to add an undefined minor when the pool is exhausted", () => {
    const actions = prepareDraft(3, 3, { numMinorFactions: 1 });
    draftStore.setState({ factionPool: ["hacan", "sol", "xxcha", "keleres"] });
    const draft = structuredClone(draftStore.getState().draft);
    draft.availableFactions = ["hacan", "sol", "xxcha"];
    draft.availableMinorFactions = [];
    draftStore.setState({ draft });
    actions.randomizeMinorFactions();
    expect(draftStore.getState().draft.availableMinorFactions).toEqual([]);
    actions.addRandomMinorFaction();
    expect(draftStore.getState().draft.availableMinorFactions).toEqual([]);
    expect(draftStore.getState().draft.settings.numMinorFactions).toBe(1);
    actions.addRandomFaction();
    expect(draftStore.getState().draft.availableFactions).toContain("keleres");
  });

  it.each([3, 4, 5, 6, 7, 8])(
    "keeps a %i-player pool large enough while allowing smaller games to use fewer than six",
    (count) => {
      const actions = prepareDraft(count, count + 1);
      actions.removeLastFaction();
      expect(draftStore.getState().draft.availableFactions).toHaveLength(count);
      actions.removeFaction(factions[0]);
      actions.removeLastFaction();
      expect(draftStore.getState().draft.availableFactions).toHaveLength(count);
    },
  );

  it.each([{ minorFactionsInSharedPool: true }, { numPreassignedFactions: 2 }])(
    "preserves all players' faction choices with %j",
    (settings) => {
      const actions = prepareDraft(4, 9, settings);
      actions.removeLastFaction();
      actions.removeLastFaction();
      actions.removeFaction(factions[0]);
      expect(draftStore.getState().draft.availableFactions).toHaveLength(8);
    },
  );

  it("retains a prioritized faction when removing the last card or clicking its remove action", () => {
    const prioritized = factions[5];
    const actions = prepareDraft(4, 6, { requiredFactions: [prioritized] });
    actions.removeFaction(prioritized);
    expect(draftStore.getState().draft.availableFactions).toHaveLength(6);
    actions.removeLastFaction();
    expect(draftStore.getState().draft.availableFactions).toContain(
      prioritized,
    );
    expect(draftStore.getState().draft.availableFactions).not.toContain(
      factions[4],
    );
    actions.removeFaction("redKing");
    expect(draftStore.getState().draft.settings.numFactions).toBe(5);
  });

  it("does not put banned priorities back into the pool after the ban phase", () => {
    prepareDraft(4, 5, {
      requiredFactions: [factions[0]],
      modifiers: { banFactions: { numFactions: 1 } },
    });
    for (let player = 0; player < 4; player++) {
      draftStore.getState().draftActions.banFaction(player, factions[player]);
    }
    const draft = draftStore.getState().draft;
    expect(draft.selections).toHaveLength(4);
    expect(draft.availableFactions).toHaveLength(5);
    for (const banned of factions.slice(0, 4))
      expect(draft.availableFactions).not.toContain(banned);
  });

  it("deduplicates priorities while retaining the requested number of unique choices", () => {
    const pool = randomizeFactions(5, factions, [factions[0], factions[0]]);
    expect(pool).toHaveLength(5);
    expect(new Set(pool).size).toBe(5);
    expect(pool).toContain(factions[0]);
  });
});
