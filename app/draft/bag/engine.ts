import {
  CATEGORY_LABELS,
  getBagDraftItem,
  getBagDraftPool,
  getFactionComponents,
  type BagDraftItem,
  type BagItemCategory,
} from "./catalog";
import { BAG_VARIANTS, getBagRules, isTwilightsFallBag } from "./rules";
import type {
  BagDraftAction,
  BagDraftState,
  BagSeat,
  BagSettings,
  CreateBagDraftInput,
} from "./types";

export class BagDraftError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BagDraftError(message);
}

function integer(value: unknown, min: number, max: number, label: string) {
  assert(
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max,
    `${label} must be a whole number between ${min} and ${max}.`,
  );
}

export function validateBagInput(
  input: unknown,
): asserts input is CreateBagDraftInput {
  assert(input && typeof input === "object", "Draft settings are required.");
  const value = input as CreateBagDraftInput;
  assert(
    BAG_VARIANTS.some((variant) => variant.id === value.variant),
    "Unknown bag draft variant.",
  );
  assert(Array.isArray(value.players), "Player names are required.");
  integer(value.players.length, 2, 8, "Player count");
  assert(
    value.players.every(
      (name) =>
        typeof name === "string" &&
        name.trim().length > 0 &&
        name.trim().length <= 60,
    ),
    "Each player needs a name of 1–60 characters.",
  );
  for (const key of [
    "includeDiscordantStars",
    "includeThundersEdge",
    "includeBlueReverie",
    "includeLostLegacies",
    "includeTiles",
    "includeMonuments",
    "shufflePlayers",
  ] as const) {
    assert(
      value[key] === undefined || typeof value[key] === "boolean",
      `Invalid ${key} setting.`,
    );
  }
  if (value.firstBagPicks !== undefined)
    integer(value.firstBagPicks, 1, 20, "First bag picks");
  if (value.laterBagPicks !== undefined)
    integer(value.laterBagPicks, 1, 20, "Later bag picks");
  for (const key of [
    "bannedItemIds",
    "bannedFactions",
    "priorityFactions",
  ] as const) {
    assert(
      value[key] === undefined ||
        (Array.isArray(value[key]) &&
          value[key]!.length <= 3000 &&
          value[key]!.every((id) => typeof id === "string" && id.length < 150)),
      `Invalid ${key} list.`,
    );
  }
  if (value.categoryLimits !== undefined) {
    assert(
      value.categoryLimits &&
        typeof value.categoryLimits === "object" &&
        !Array.isArray(value.categoryLimits),
      "Invalid category limits.",
    );
    const defaults = getBagRules({
      variant: value.variant,
      includeMonuments: true,
    });
    for (const [category, limit] of Object.entries(value.categoryLimits)) {
      const key = category as BagItemCategory;
      assert(
        key in defaults.draftLimits || key in defaults.keepLimits,
        `The ${category} category is not part of this draft variant.`,
      );
      assert(limit && typeof limit === "object", `Invalid ${category} limits.`);
      integer(limit.draft, 0, 12, `${category} draft limit`);
      integer(limit.keep, 0, 12, `${category} keep limit`);
      assert(
        value.variant === "frankendraz" || limit.keep <= limit.draft,
        `The ${category} keep limit cannot exceed its draft limit.`,
      );
      if (key === "DRAFTORDER" || key === "MAHACTKING")
        assert(
          limit.draft <= 1,
          `Only one ${CATEGORY_LABELS[key]} can be drafted per player.`,
        );
    }
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function resolveBagItem(
  id: string,
  settings: BagSettings,
): BagDraftItem {
  if (id.startsWith("DRAFTORDER:")) {
    const order = Number(id.split(":")[1]);
    return {
      id,
      category: "DRAFTORDER",
      name: `Speaker order ${order}`,
      description:
        order === 1
          ? "You are the starting speaker."
          : `You are ${order} in speaker order.`,
      source: "base",
      pools: ["franken", "twilights_fall"],
    };
  }
  const item = getBagDraftItem(id, {
    twilightsFall: isTwilightsFallBag(settings.variant),
  });
  assert(item, `Unknown draft item: ${id}.`);
  return item;
}

function categoryOf(id: string): BagItemCategory {
  return id.split(":")[0] as BagItemCategory;
}

function count(items: string[], category: BagItemCategory) {
  return items.filter((id) => categoryOf(id) === category).length;
}

export function createBagState(
  input: CreateBagDraftInput,
  random = Math.random,
): BagDraftState {
  validateBagInput(input);
  const { players, ...configuration } = input;
  const settings: BagSettings = {
    includeTiles: true,
    includeThundersEdge: true,
    ...configuration,
  };
  const rules = getBagRules(settings);
  assert(
    Object.values(rules.draftLimits).some((limit) => limit > 0),
    "Enable at least one draft category.",
  );
  const banned = new Set(settings.bannedItemIds);
  const factions = new Set(settings.bannedFactions);
  const pool = getBagDraftPool({
    ...settings,
    twilightsFall: isTwilightsFallBag(settings.variant),
  }).filter(
    (item) =>
      !banned.has(item.id) && (!item.faction || !factions.has(item.faction)),
  );
  const names =
    settings.shufflePlayers === false ? players : shuffle(players, random);
  const seats: BagSeat[] = names.map((name, id) => ({
    id,
    name: name.trim(),
    bag: [],
    hand: [],
    roundPicks: [],
    ready: false,
    keptItemIds: [],
    finished: false,
  }));
  for (const [rawCategory, limit] of Object.entries(rules.draftLimits)) {
    if (limit === 0) continue;
    const category = rawCategory as BagItemCategory;
    let available =
      category === "DRAFTORDER"
        ? seats.map((seat) => `DRAFTORDER:${seat.id + 1}`)
        : [
            ...new Set(
              pool
                .filter((item) => item.category === category)
                .map((item) => item.id),
            ),
          ];
    available = shuffle(available, random);
    if (category === "FACTION" && settings.priorityFactions?.length) {
      const priority = new Set(
        settings.priorityFactions.map((id) => `FACTION:${id}`),
      );
      assert(
        priority.size <= limit * seats.length &&
          [...priority].every((id) => available.includes(id)),
        "Prioritized factions must be enabled, unbanned, and fit in the faction pool.",
      );
      available = [
        ...available.filter((id) => priority.has(id)),
        ...available.filter((id) => !priority.has(id)),
      ];
    }
    const required = limit * seats.length;
    assert(
      available.length >= required,
      `${CATEGORY_LABELS[category]}: need ${required} items (${limit} × ${seats.length} players), but only ${available.length} are available. Enable another content pack, remove bans, or reduce the category count.`,
    );
    const dealt = shuffle(available.slice(0, required), random);
    seats.forEach((seat, index) =>
      seat.bag.push(...dealt.slice(index * limit, (index + 1) * limit)),
    );
  }
  const state: BagDraftState = {
    version: 1,
    settings,
    rules,
    seats,
    phase: "drafting",
    round: 0,
    revision: 0,
    history: [],
  };
  state.history.push({ round: 0, seats: structuredClone(seats) });
  return state;
}

export function draftableItems(
  state: BagDraftState,
  seat: BagSeat,
  selected: string[] = [],
) {
  return seat.bag.filter((id) => {
    const category = categoryOf(id);
    if (selected.includes(id)) return false;
    if (
      count([...seat.hand, ...selected], category) >=
      (state.rules.draftLimits[category] ?? 0)
    )
      return false;
    return (
      category === "FACTION" ||
      !selected.some((chosen) => categoryOf(chosen) === category)
    );
  });
}

export function requiredBagPicks(state: BagDraftState, seat: BagSeat) {
  const available = draftableItems(state, seat);
  const categories = new Set(available.map(categoryOf));
  const factions = Math.min(
    count(available, "FACTION"),
    (state.rules.draftLimits.FACTION ?? 0) - count(seat.hand, "FACTION"),
  );
  const possible =
    categories.size - (categories.has("FACTION") ? 1 : 0) + factions;
  return Math.min(
    seat.hand.length === 0
      ? state.rules.firstBagPicks
      : state.rules.laterBagPicks,
    possible,
  );
}

function assemblyBaseItems(
  state: BagDraftState,
  seat: BagSeat,
): BagDraftItem[] {
  return seat.hand.flatMap((id) => {
    if (
      categoryOf(id) === "FACTION" &&
      state.settings.variant === "frankendraz"
    ) {
      return getFactionComponents(
        id.slice("FACTION:".length),
        state.settings,
      ).filter((item) => !state.settings.bannedItemIds?.includes(item.id));
    }
    return [resolveBagItem(id, state.settings)];
  });
}

export function assemblyOptions(
  state: BagDraftState,
  seat: BagSeat,
): BagDraftItem[] {
  const base = assemblyBaseItems(state, seat);
  const options = new Map(base.map((item) => [item.id, item]));
  if (!isTwilightsFallBag(state.settings.variant)) {
    const addSwaps = (item: BagDraftItem) => {
      for (const swap of item.optionalSwaps ?? []) {
        if (options.has(swap) || state.settings.bannedItemIds?.includes(swap))
          continue;
        const component = resolveBagItem(swap, state.settings);
        if (
          component.category === "MONUMENT" &&
          !state.settings.includeMonuments
        )
          continue;
        if (
          component.category === "BREAKTHROUGH" &&
          state.settings.includeThundersEdge === false
        )
          continue;
        options.set(swap, component);
        addSwaps(component);
      }
    };
    base.forEach(addSwaps);
  } else {
    for (const id of ["TECH:wavelength", "TECH:antimatter"])
      options.set(id, resolveBagItem(id, state.settings));
  }
  return [...options.values()];
}

const genericTechs = new Set(["TECH:wavelength", "TECH:antimatter"]);

export function keptBagItems(
  state: BagDraftState,
  seat: BagSeat,
): BagDraftItem[] {
  const result = new Map(
    seat.keptItemIds.map((id) => [id, resolveBagItem(id, state.settings)]),
  );
  if (!isTwilightsFallBag(state.settings.variant)) {
    const addComponents = (item: BagDraftItem) => {
      for (const id of item.additionalComponents ?? []) {
        if (result.has(id)) continue;
        const component = resolveBagItem(id, state.settings);
        result.set(id, component);
        addComponents(component);
      }
    };
    [...result.values()].forEach(addComponents);
  }
  return [...result.values()];
}

function beginAssembly(state: BagDraftState) {
  state.phase = "assembling";
  for (const seat of state.seats) {
    seat.roundPicks = [];
    seat.ready = false;
    const options = assemblyOptions(state, seat);
    seat.keptItemIds = [];
    for (const [rawCategory, limit] of Object.entries(state.rules.keepLimits)) {
      const candidates = options.filter(
        (item) => item.category === rawCategory && !genericTechs.has(item.id),
      );
      if (candidates.length <= limit)
        seat.keptItemIds.push(...candidates.map((item) => item.id));
    }
  }
}

function passWhenReady(state: BagDraftState) {
  for (const seat of state.seats) {
    if (requiredBagPicks(state, seat) === 0) seat.ready = true;
  }
  if (!state.seats.every((seat) => seat.ready)) return;
  if (state.seats.every((seat) => seat.bag.length === 0)) {
    beginAssembly(state);
    return;
  }
  // Skip exhausted bags until someone can choose again. A complete circulation
  // without a legal pick means only unusable leftovers remain.
  for (let pass = 0; pass < state.seats.length; pass++) {
    const bags = state.seats.map((seat) => seat.bag);
    state.round++;
    state.seats.forEach((seat, index) => {
      seat.bag = bags[(index + 1) % bags.length];
      seat.roundPicks = [];
      seat.ready = requiredBagPicks(state, seat) === 0;
    });
    if (state.seats.some((seat) => !seat.ready)) {
      state.history.push({
        round: state.round,
        seats: structuredClone(state.seats),
      });
      return;
    }
  }
  beginAssembly(state);
}

function chooseFinalItems(
  state: BagDraftState,
  seat: BagSeat,
  itemIds: string[],
) {
  assert(
    state.phase === "assembling",
    "This draft is not at the faction assembly stage.",
  );
  assert(!seat.finished, "Reopen your faction before changing its components.");
  const options = assemblyOptions(state, seat);
  const allowed = new Set(options.map((item) => item.id));
  assert(
    itemIds.every((id) => allowed.has(id)),
    "You can only keep components from your drafted hand.",
  );
  const tf = isTwilightsFallBag(state.settings.variant);
  if (!tf) {
    const base = assemblyBaseItems(state, seat);
    const reachable = new Set(base.map((item) => item.id));
    const visited = new Set<string>();
    const visit = (item: BagDraftItem) => {
      if (visited.has(item.id)) return;
      visited.add(item.id);
      for (const id of item.additionalComponents ?? [])
        visit(resolveBagItem(id, state.settings));
      for (const id of item.optionalSwaps ?? []) {
        reachable.add(id);
        if (itemIds.includes(id)) visit(resolveBagItem(id, state.settings));
      }
    };
    base.filter((item) => itemIds.includes(item.id)).forEach(visit);
    assert(
      itemIds.every((id) => reachable.has(id)),
      "An optional swap requires keeping the component that grants it.",
    );
  }
  const genericCount = tf
    ? itemIds.filter((id) => genericTechs.has(id)).length
    : 0;
  const chosen = itemIds.filter((id) => !tf || !genericTechs.has(id));
  let replaceableSlots = 0;
  for (const category of Object.keys(CATEGORY_LABELS) as BagItemCategory[]) {
    const limit = state.rules.keepLimits[category] ?? 0;
    const availableCount = options.filter(
      (item) =>
        item.category === category && (!tf || !genericTechs.has(item.id)),
    ).length;
    const required = Math.min(limit, availableCount);
    const selected = count(chosen, category);
    assert(
      selected <= limit,
      `Keep at most ${limit} ${CATEGORY_LABELS[category]}.`,
    );
    if (tf && ["TECH", "AGENT", "UNIT"].includes(category)) {
      replaceableSlots += required - selected;
    } else {
      assert(
        selected === required,
        `Choose ${required} ${CATEGORY_LABELS[category]} before finishing.`,
      );
    }
  }
  assert(
    genericCount === replaceableSlots,
    "Each generic technology must replace one of your two abilities, one genome, or one unit upgrade.",
  );
  seat.keptItemIds = itemIds;
  seat.finished = true;
  if (state.seats.every((player) => player.finished)) state.phase = "complete";
}

export function applyBagAction(
  state: BagDraftState,
  playerId: number | undefined,
  action: BagDraftAction,
  isAdmin = false,
): BagDraftState {
  assert(action && typeof action === "object", "An action is required.");
  const next = structuredClone(state);
  if (action.action === "undoRound") {
    assert(isAdmin, "Only the host can undo a round.");
    assert(
      action.revision === next.revision,
      "The draft changed. Refresh before undoing a round.",
    );
    assert(next.history.length > 0, "There is no round to undo.");
    const current = next.history[next.history.length - 1];
    const hasPicks = next.seats.some((seat) => seat.roundPicks.length > 0);
    if (
      next.phase === "drafting" &&
      current.round === next.round &&
      !hasPicks &&
      next.history.length > 1
    )
      next.history.pop();
    const snapshot = next.history[next.history.length - 1];
    next.round = snapshot.round;
    next.seats = structuredClone(snapshot.seats);
    next.phase = "drafting";
    next.revision++;
    return next;
  }
  const seat = next.seats.find((player) => player.id === playerId);
  assert(seat, "Use your private player link to make a selection.");
  if ("itemIds" in action) {
    assert(
      Array.isArray(action.itemIds) &&
        action.itemIds.length <= 200 &&
        action.itemIds.every((id) => typeof id === "string"),
      "Invalid item selection.",
    );
    assert(
      new Set(action.itemIds).size === action.itemIds.length,
      "An item cannot be selected twice.",
    );
  }
  switch (action.action) {
    case "pick": {
      assert(
        next.phase === "drafting" && action.round === next.round,
        "These bags have already passed. Refresh for your current bag.",
      );
      assert(!seat.ready, "Your picks are already confirmed for this bag.");
      assert(
        action.itemIds.length === requiredBagPicks(next, seat),
        `Choose ${requiredBagPicks(next, seat)} items from this bag.`,
      );
      const selected: string[] = [];
      for (const id of action.itemIds) {
        assert(
          draftableItems(next, seat, selected).includes(id),
          "This item is unavailable, its category is full, or you have already picked this category from this bag.",
        );
        selected.push(id);
      }
      seat.bag = seat.bag.filter((id) => !selected.includes(id));
      seat.hand.push(...selected);
      seat.roundPicks = selected;
      seat.ready = true;
      passWhenReady(next);
      break;
    }
    case "undo": {
      assert(
        next.phase === "drafting" && action.round === next.round,
        "The bags have passed. Ask the host to undo the round.",
      );
      assert(
        seat.roundPicks.length > 0,
        "There are no picks to undo in this bag.",
      );
      seat.hand = seat.hand.filter((id) => !seat.roundPicks.includes(id));
      seat.bag.push(...seat.roundPicks);
      seat.roundPicks = [];
      seat.ready = false;
      break;
    }
    case "assemble":
      chooseFinalItems(next, seat, action.itemIds);
      break;
    case "reopen":
      assert(
        next.phase === "assembling" || next.phase === "complete",
        "The component draft has not finished.",
      );
      seat.finished = false;
      next.phase = "assembling";
      break;
    default:
      throw new BagDraftError("Unknown draft action.");
  }
  next.revision++;
  return next;
}
