import { expect, test } from "vitest";
import {
  applyRawAction,
  createRawDraft,
  RawDraftError,
  rawReferenceFaction,
  rawSplicePool,
  undoRawAction,
  validateRawSettings,
  type RawAction,
  type RawSettings,
} from "./engine";

const settings: RawSettings = {
  mode: "twilightsFall",
  pok: true,
  te: true,
  players: Array.from({ length: 4 }, (_, id) => ({
    id,
    name: `Player ${id + 1}`,
  })),
};

test("rejects unsupported settings and player identities before creating a room", () => {
  for (const invalid of [
    null,
    {},
    { ...settings, mode: "milty" },
    { ...settings, te: false },
    { ...settings, pok: "true" },
    { ...settings, shuffleSeats: "true" },
    { ...settings, players: settings.players.slice(0, 2) },
    {
      ...settings,
      players: settings.players.map((player) => ({ ...player, id: 0 })),
    },
    {
      ...settings,
      players: [{ id: -1, name: "Player" }, ...settings.players.slice(1)],
    },
    {
      ...settings,
      players: [{ id: 0, name: " " }, ...settings.players.slice(1)],
    },
    { ...settings, layout: "standard8p" },
  ]) {
    expect(() => validateRawSettings(invalid)).toThrow(RawDraftError);
  }
});

test("invalid actions cannot mutate private hands, history, or revision", () => {
  const state = createRawDraft(settings, () => 0.5);
  const before = structuredClone(state);
  for (const invalid of [
    null,
    [],
    { playerId: 999, type: "pickReference", factionId: "arborec" },
    { playerId: "0", type: "pickReference", factionId: "arborec" },
    { playerId: 0, type: "unknown" },
    { playerId: 0, type: "pickReference", factionId: "not-a-faction" },
    {
      playerId: 0,
      type: "choosePriority",
      factionId: state.references[0].hand[0],
    },
    { playerId: 0, type: "chooseFaction", factionId: "arborec" },
    { playerId: 0, type: "placeSystem", systemId: "19", position: "1" },
  ]) {
    expect(() => applyRawAction(state, invalid as RawAction)).toThrow(
      RawDraftError,
    );
    expect(state).toEqual(before);
  }
  expect(() => undoRawAction(state)).toThrow("no RAW setup action");
  expect(state).toEqual(before);
});

test("reference picks and priority commitments stay private through the reveal and undo", () => {
  let state = createRawDraft(settings, () => 0.5);
  while (state.phase === "referenceDraft") {
    const id = state.order.find((player) => !state.references[player].ready)!;
    const chosen = state.references[id].hand[0];
    const before = structuredClone(state);
    const picked = applyRawAction(state, {
      type: "pickReference",
      playerId: id,
      factionId: chosen,
    });
    expect(state).toEqual(before);
    expect(picked.log.join(" ")).not.toContain(
      rawReferenceFaction(chosen).name,
    );
    state = picked;
  }
  expect(state.phase).toBe("priority");
  const originalOrder = [...state.order];
  const selected = Object.fromEntries(
    originalOrder.map((id) => [id, state.references[id].drafted[0]]),
  );
  for (const id of originalOrder.slice(0, -1)) {
    state = applyRawAction(state, {
      type: "choosePriority",
      playerId: id,
      factionId: selected[id],
    });
    expect(state.priorities).toEqual({});
    expect(state.speaker).toBe(-1);
    expect(state.order).toEqual(originalOrder);
    expect(state.log.join(" ")).not.toContain(
      rawReferenceFaction(selected[id]).name,
    );
  }
  const beforeReveal = structuredClone(state);
  const last = originalOrder.at(-1)!;
  state = applyRawAction(state, {
    type: "choosePriority",
    playerId: last,
    factionId: selected[last],
  });
  expect(state.priorities).toEqual(selected);
  expect(state.order).toEqual(
    [...originalOrder].sort(
      (a, b) =>
        rawReferenceFaction(selected[a]).priorityOrder! -
        rawReferenceFaction(selected[b]).priorityOrder!,
    ),
  );
  expect(state.speaker).toBe(state.order[0]);
  const revealed = structuredClone(state);
  const undone = undoRawAction(state);
  expect(state).toEqual(revealed);
  expect(undone).toEqual({ ...beforeReveal, revision: state.revision + 1 });
  expect(undone.priorities).toEqual({});
  expect(undone.hands).toEqual({});
  expect(undone.references[last].priority).toBeUndefined();
});

test("starting splice cards enforce category quotas and reveal only after every player commits", () => {
  let state = createRawDraft(settings, () => 0.5);
  state.phase = "spliceKeep";
  const pool = rawSplicePool();
  const abilities = pool
    .filter((item) => item.category === "TECH")
    .slice(0, 3)
    .map((item) => item.id);
  const upgrades = pool
    .filter((item) => item.category === "UNIT")
    .slice(0, 2)
    .map((item) => item.id);
  const genomes = pool
    .filter((item) => item.category === "AGENT")
    .slice(0, 2)
    .map((item) => item.id);
  const drafted = [...abilities, ...upgrades, ...genomes];
  const kept = [abilities[0], abilities[1], upgrades[0], genomes[0]];
  for (const id of state.order)
    state.splice[id] = { hand: [], drafted: [...drafted], ready: false };
  const before = structuredClone(state);
  for (const itemIds of [
    [abilities[0], abilities[0], upgrades[0], genomes[0]],
    [...abilities, upgrades[0]],
    [abilities[0], abilities[1], upgrades[0], "AGENT:not-in-hand"],
    kept.slice(0, 3),
  ]) {
    expect(() =>
      applyRawAction(state, { type: "keepSplice", playerId: 0, itemIds }),
    ).toThrow(RawDraftError);
    expect(state).toEqual(before);
  }
  for (const id of state.order.slice(0, -1)) {
    state = applyRawAction(state, {
      type: "keepSplice",
      playerId: id,
      itemIds: kept,
    });
    expect(state.phase).toBe("spliceKeep");
    for (const item of kept) expect(state.log.join(" ")).not.toContain(item);
  }
  state = applyRawAction(state, {
    type: "keepSplice",
    playerId: state.order.at(-1)!,
    itemIds: kept,
  });
  expect(state.phase).toBe("complete");
  const undone = undoRawAction(state);
  expect(undone.phase).toBe("spliceKeep");
  expect(undone.splice[state.order.at(-1)!].kept).toBeUndefined();
});
