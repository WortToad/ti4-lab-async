import { factions, twilightsFallFactionIds } from "~/data/factionData";
import { mapStringOrder } from "~/data/mapStringOrder";
import {
  draftableSystemIds,
  factionSystems,
  systemData,
  thunderSystemIds,
} from "~/data/systemData";
import type { FactionId, Map } from "~/types";
import { getFactionPool } from "~/utils/factions";
import { buildHexGraph, getAdjacentPositions } from "~/utils/hexDistance";
import { getRawLayouts } from "./layouts";
import { rawReferenceCardPool, rawReferenceFaction } from "./referenceCards";
import { rawSplicePool } from "./spliceCards";
import type {
  RawAction,
  RawLayout,
  RawSettings,
  RawSnapshot,
  RawState,
} from "./types";

export * from "./types";
export { getRawLayouts } from "./layouts";
export { rawReferenceCardPool, rawReferenceFaction } from "./referenceCards";
export { rawSplicePool } from "./spliceCards";

export class RawDraftError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RawDraftError(message);
}

function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function rawFactionPool(settings: Pick<RawSettings, "pok" | "te">) {
  return getFactionPool([
    "base",
    ...(settings.pok ? (["pok"] as const) : []),
    ...(settings.te ? (["te"] as const) : []),
  ])
    .filter((id) => id !== "keleres" || settings.te)
    .concat(settings.te && !settings.pok ? ["keleres"] : []);
}

export function validateRawSettings(
  value: unknown,
): asserts value is RawSettings {
  assert(
    value && typeof value === "object",
    "RAW setup settings are required.",
  );
  const settings = value as RawSettings;
  assert(
    settings.mode === "base" || settings.mode === "twilightsFall",
    "Choose normal TI4 or Twilight's Fall.",
  );
  assert(
    typeof settings.pok === "boolean" && typeof settings.te === "boolean",
    "Expansion settings must be enabled or disabled.",
  );
  assert(
    settings.shuffleSeats === undefined ||
      typeof settings.shuffleSeats === "boolean",
    "Invalid seating setting.",
  );
  assert(
    settings.mode !== "twilightsFall" || settings.te,
    "Twilight's Fall requires Thunder's Edge.",
  );
  assert(Array.isArray(settings.players), "Enter player names.");
  assert(
    settings.players.length >= 3 &&
      settings.players.length <= (settings.pok ? 8 : 6),
    "RAW galaxy building supports 3–6 players, or 3–8 with Prophecy of Kings.",
  );
  assert(
    settings.players.every(
      (player) =>
        player &&
        Number.isInteger(player.id) &&
        player.id >= 0 &&
        player.id <= 7 &&
        typeof player.name === "string" &&
        player.name.trim().length > 0 &&
        player.name.trim().length <= 60,
    ),
    "Every player needs a unique numeric ID and a name of 1–60 characters.",
  );
  assert(
    new Set(settings.players.map((player) => player.id)).size ===
      settings.players.length,
    "Player IDs must be unique.",
  );
  assert(
    settings.layout === undefined ||
      getRawLayouts(settings).some((layout) => layout.id === settings.layout),
    "This rulebook layout is unavailable for the selected players and expansions.",
  );
}

function layoutFor(settings: RawSettings): RawLayout {
  const layouts = getRawLayouts(settings);
  const layout =
    layouts.find((item) => item.id === settings.layout) ?? layouts[0];
  assert(layout, "No rulebook galaxy layout is available.");
  return layout;
}

function makeMap(layout: RawLayout, order: number[]): Map {
  return mapStringOrder
    .slice(0, layout.rings === 3 ? 37 : 61)
    .map((position, idx) => {
      if (idx === 0) return { idx, position, type: "SYSTEM", systemId: "18" };
      if (layout.closed.includes(idx)) return { idx, position, type: "CLOSED" };
      const seat = layout.homes.indexOf(idx);
      if (seat !== -1)
        return { idx, position, type: "HOME", seat, playerId: order[seat] };
      const preset = layout.preset[idx];
      if (preset) return { idx, position, type: "SYSTEM", ...preset };
      return { idx, position, type: "OPEN" };
    });
}

export function createRawDraft(
  settings: RawSettings,
  random = Math.random,
): RawState {
  validateRawSettings(settings);
  const players = settings.players.map((player) => ({
    ...player,
    name: player.name.trim(),
  }));
  const initialOrder = (
    settings.shuffleSeats ? shuffled(players, random) : players
  ).map((p) => p.id);
  const speakerIndex =
    settings.mode === "base" ? Math.floor(random() * players.length) : 0;
  const order = [
    ...initialOrder.slice(speakerIndex),
    ...initialOrder.slice(0, speakerIndex),
  ];
  const layout = layoutFor(settings);
  const state: RawState = {
    version: 1,
    settings: { ...settings, players, layout: layout.id },
    revision: 0,
    history: [],
    phase: settings.mode === "base" ? "factions" : "referenceDraft",
    players,
    order,
    speaker: settings.mode === "base" ? order[0] : -1,
    map: makeMap(layout, order),
    hands: {},
    preplace: [],
    turn: 0,
    factions: {},
    references: {},
    referenceRound: 1,
    referenceDeck: [],
    priorities: {},
    homes: {},
    fleets: {},
    kings: {},
    splice: {},
    spliceRound: 0,
    tradeGoods: {},
    log: [
      settings.mode === "base"
        ? "The speaker was determined at random. Choose factions."
        : "Three faction reference cards were dealt to each player. Keep one and pass left.",
    ],
  };
  if (settings.mode === "twilightsFall") {
    const deck = shuffled(rawReferenceCardPool, random);
    for (const id of order)
      state.references[id] = {
        hand: deck.splice(0, 3),
        drafted: [],
        ready: false,
      };
    state.referenceDeck = deck;
  }
  return state;
}

type TurnState = Pick<
  RawState,
  "phase" | "order" | "speaker" | "turn" | "factions" | "homes" | "settings"
>;

export function rawActivePlayer(state: TurnState): number | undefined {
  if (state.phase === "mapPreplace") return state.speaker;
  if (state.phase === "map") {
    const leg = Math.floor(state.turn / state.order.length);
    const offset = state.turn % state.order.length;
    return state.order[
      leg % 2 === 0 ? offset : state.order.length - 1 - offset
    ];
  }
  if (state.phase === "homes")
    return state.settings.mode === "base"
      ? state.order.find(
          (id) => state.factions[id] === "keleres" && !state.homes[id],
        )
      : state.order[state.turn];
  if (state.phase === "kings") return [...state.order].reverse()[state.turn];
  return undefined;
}

export function rawHomeChoices(
  state: Pick<RawState, "settings" | "factions" | "references">,
  playerId: number,
): FactionId[] {
  if (state.settings.mode === "twilightsFall")
    return state.references[playerId]?.drafted ?? [];
  if (state.factions[playerId] !== "keleres") return [];
  return (
    [
      "mentak",
      "xxcha",
      ...(state.settings.pok ? ["argent"] : []),
    ] as FactionId[]
  ).filter((id) => !Object.values(state.factions).includes(id));
}

type PlacementState = TurnState &
  Pick<RawSnapshot, "map" | "hands" | "preplace">;

function ring(position: { x: number; y: number }): number {
  return Math.max(
    Math.abs(position.x),
    Math.abs(position.y),
    Math.abs(position.x + position.y),
  );
}

/** Enforces the inner ring and both adjacency rules across the entire current hand. */
export function rawLegalPositions(
  state: PlacementState,
  playerId: number,
  systemId: string,
): number[] {
  if (
    !["map", "mapPreplace"].includes(state.phase) ||
    rawActivePlayer(state) !== playerId
  )
    return [];
  const hand =
    state.phase === "mapPreplace"
      ? state.preplace
      : (state.hands[playerId] ?? []);
  if (!hand.includes(systemId) || !systemData[systemId]) return [];
  const open = state.map.filter((tile) => tile.type === "OPEN");
  if (!open.length) return [];
  const innerRing =
    state.phase === "mapPreplace"
      ? 1
      : Math.min(...open.map((tile) => ring(tile.position)));
  const positions = open
    .filter((tile) => ring(tile.position) === innerRing)
    .map((tile) => tile.idx);
  const graph = buildHexGraph(state.map, { includeOpenTiles: true });
  const legal = (id: string, position: number) => {
    const system = systemData[id];
    return getAdjacentPositions(graph, position).every((neighbor) => {
      const tile = state.map[neighbor];
      if (tile.type !== "SYSTEM") return true;
      const other = systemData[tile.systemId];
      return (
        !(system.anomalies.length && other.anomalies.length) &&
        !system.wormholes.some((wormhole) => other.wormholes.includes(wormhole))
      );
    });
  };
  const strict = positions.filter((position) => legal(systemId, position));
  if (strict.length) return strict;
  // A player cannot invoke the exception simply by selecting a difficult tile
  // while another tile in their hand can satisfy the placement rules.
  if (hand.some((id) => positions.some((position) => legal(id, position))))
    return [];
  return positions;
}

function startMap(state: RawState) {
  const layout = layoutFor(state.settings);
  const pool = [
    ...draftableSystemIds.filter(
      (id) => state.settings.pok || Number(id) <= 50,
    ),
    ...(state.settings.te ? thunderSystemIds : []),
  ];
  const blue = shuffled(pool.filter((id) => systemData[id].type === "BLUE"));
  const red = shuffled(pool.filter((id) => systemData[id].type === "RED"));
  assert(
    blue.length >= layout.blue * state.order.length + (layout.extraBlue ?? 0),
    "Not enough blue-backed system tiles for this layout.",
  );
  assert(
    red.length >= layout.red * state.order.length + (layout.extraRed ?? 0),
    "Not enough red-backed system tiles for this layout.",
  );
  state.map = makeMap(layout, state.order);
  for (const id of state.order)
    state.hands[id] = [
      ...blue.splice(0, layout.blue),
      ...red.splice(0, layout.red),
    ];
  state.preplace = [
    ...blue.splice(0, layout.extraBlue ?? 0),
    ...red.splice(0, layout.extraRed ?? 0),
  ];
  const dealtCount =
    Object.values(state.hands).flat().length + state.preplace.length;
  assert(
    state.map.filter((tile) => tile.type === "OPEN").length === dealtCount,
    "The rulebook layout does not match its system tile deal.",
  );
  state.phase = state.preplace.length ? "mapPreplace" : "map";
  state.turn = 0;
  state.log.push(
    state.preplace.length
      ? "System tiles were dealt. The speaker places the extra tiles next to Mecatol first."
      : "System tiles were dealt. Build each ring in snake order, starting with the speaker.",
  );
}

function attachHome(state: RawState, playerId: number, home: FactionId) {
  const position = layoutFor(state.settings).homes[
    state.order.indexOf(playerId)
  ];
  const system = factionSystems[home];
  const systemId =
    home === "creuss" ? "17" : home === "crimson" ? "94" : system?.id;
  if (systemId)
    state.map[position] = { ...state.map[position], type: "SYSTEM", systemId };
  if (home === "creuss" || home === "crimson")
    state.log.push(
      `${playerName(state, playerId)} uses ${home === "creuss" ? "Creuss Gate (17) and off-board Creuss (51)" : "The Sorrow (94) and off-board Ahk Creuxx (118)"}${state.settings.mode === "twilightsFall" ? ", with its permanent Echo card" : ""}. Place the home system off the board; the gate occupies its galaxy position.`,
    );
}

function finishMap(state: RawState) {
  const layout = layoutFor(state.settings);
  state.order.forEach((id, seat) => {
    const amount = layout.tradeGoods?.[seat] ?? 0;
    if (amount) state.tradeGoods[id] = amount;
  });
  if (Object.keys(state.tradeGoods).length)
    state.log.push(
      "The five-player map's disadvantaged home positions receive their rulebook trade goods.",
    );
  state.turn = 0;
  if (state.settings.mode === "twilightsFall") {
    state.phase = "homes";
    state.log.push(
      "The galaxy is complete. Choose home systems clockwise, starting with the speaker.",
    );
  } else {
    for (const id of state.order) attachHome(state, id, state.homes[id]);
    state.phase = "complete";
    state.log.push(
      "Factions and galaxy are ready. Continue the remaining tabletop setup steps in the rules reference.",
    );
  }
}

function playerName(state: Pick<RawSnapshot, "players">, id: number): string {
  return state.players.find((player) => player.id === id)!.name;
}

function snapshot(state: RawState): RawSnapshot {
  const current: Partial<RawState> = { ...state };
  delete current.history;
  delete current.settings;
  delete current.version;
  delete current.revision;
  return structuredClone(current) as RawSnapshot;
}

const spliceLimits: Record<string, number> = { TECH: 3, UNIT: 2, AGENT: 2 };
const keepLimits: Record<string, number> = { TECH: 2, UNIT: 1, AGENT: 1 };
function category(id: string): string {
  return id.split(":", 1)[0];
}

export function rawSpliceChoices(
  state: Pick<RawSnapshot, "splice">,
  playerId: number,
): string[] {
  const seat = state.splice[playerId];
  if (!seat || seat.ready) return [];
  return seat.hand.filter(
    (id) =>
      seat.drafted.filter((picked) => category(picked) === category(id))
        .length < spliceLimits[category(id)],
  );
}

function startSplice(state: RawState) {
  const pool = rawSplicePool(state.settings.pok);
  const decks = Object.fromEntries(
    Object.keys(spliceLimits).map((type) => [
      type,
      shuffled(
        pool.filter((item) => item.category === type).map((item) => item.id),
      ),
    ]),
  );
  for (const id of state.order)
    state.splice[id] = {
      hand: Object.entries(spliceLimits).flatMap(([type, count]) =>
        decks[type].splice(0, count),
      ),
      drafted: [],
      ready: false,
    };
  state.phase = "splice";
  state.spliceRound = 1;
  state.turn = 0;
  state.log.push(
    "The inaugural splice begins: keep one card, then pass right. Draft three abilities, two upgrades, and two genomes.",
  );
}

function advanceSplice(state: RawState) {
  // Forced passes are automatic, including players who have filled their quotas.
  // A hand may need multiple passes before reaching somebody who can keep a card.
  for (let attempt = 0; attempt <= state.order.length; attempt++) {
    for (const id of state.order)
      if (!state.splice[id].ready && !rawSpliceChoices(state, id).length)
        state.splice[id].ready = true;
    if (!state.order.every((id) => state.splice[id].ready)) return;
    if (state.order.every((id) => state.splice[id].drafted.length === 7)) {
      state.phase = "spliceKeep";
      for (const id of state.order) state.splice[id].ready = false;
      state.log.push(
        "The splice is complete. Privately keep two abilities, one upgrade, and one genome; reveal together.",
      );
      return;
    }
    const hands = state.order.map((id) => state.splice[id].hand);
    state.order.forEach((id, index) => {
      // Pass right/counterclockwise: receive from the next clockwise seat.
      state.splice[id].hand = hands[(index + 1) % hands.length];
      state.splice[id].ready = false;
    });
    state.spliceRound++;
  }
  throw new RawDraftError(
    "The splice cannot advance because no player can keep the remaining cards.",
  );
}

/** Validates and applies a single action without mutating the supplied state. */
export function applyRawAction(state: RawState, value: RawAction): RawState {
  assert(value && typeof value === "object", "A draft action is required.");
  const action = value as RawAction;
  assert(
    Number.isInteger(action.playerId) &&
      state.players.some((player) => player.id === action.playerId),
    "Unknown player.",
  );
  assert(state.phase !== "complete", "This RAW setup is complete.");
  const next = structuredClone(state);
  const id = action.playerId;
  const name = playerName(state, id);
  switch (action.type) {
    case "chooseFaction": {
      assert(
        next.phase === "factions",
        "Factions cannot be chosen at this stage.",
      );
      assert(!next.factions[id], "You have already chosen a faction.");
      assert(
        rawFactionPool(next.settings).includes(action.factionId),
        "That faction is unavailable with these expansions.",
      );
      assert(
        !Object.values(next.factions).includes(action.factionId),
        "That faction has already been chosen.",
      );
      next.factions[id] = action.factionId;
      const keleres = next.order.find(
        (player) => next.factions[player] === "keleres",
      );
      assert(
        keleres === undefined || rawHomeChoices(next, keleres).length,
        "The Council Keleres needs an unplayed Mentak, Xxcha, or Argent home system.",
      );
      if (action.factionId !== "keleres") next.homes[id] = action.factionId;
      next.fleets[id] = action.factionId;
      next.log.push(`${name} chose ${factions[action.factionId].name}.`);
      if (next.order.every((player) => next.factions[player])) {
        if (keleres !== undefined) {
          next.phase = "homes";
          next.log.push(
            "The Council Keleres chooses an unplayed faction's home system before galaxy building.",
          );
        } else startMap(next);
      }
      break;
    }
    case "pickReference": {
      assert(
        next.phase === "referenceDraft",
        "Reference cards cannot be drafted at this stage.",
      );
      const seat = next.references[id];
      assert(!seat.ready, "Wait for the other players to choose.");
      assert(
        seat.hand.includes(action.factionId),
        "Choose a reference card from your hand.",
      );
      seat.hand = seat.hand.filter((card) => card !== action.factionId);
      seat.drafted.push(action.factionId);
      seat.ready = true;
      next.log.push(`${name} kept a faction reference card facedown.`);
      if (next.order.every((player) => next.references[player].ready)) {
        const hands = next.order.map((player) => next.references[player].hand);
        next.order.forEach((player, index) => {
          next.references[player].hand =
            hands[(index - 1 + hands.length) % hands.length];
          next.references[player].ready = false;
        });
        next.referenceRound++;
        if (next.referenceRound === 3) {
          for (const player of next.order) {
            next.references[player].drafted.push(
              ...next.references[player].hand,
            );
            next.references[player].hand = [];
          }
          next.phase = "priority";
          next.log.push(
            "The last cards were passed left and kept. Privately choose a priority card for the simultaneous reveal.",
          );
        }
      }
      break;
    }
    case "choosePriority": {
      assert(
        next.phase === "priority",
        "Priority cards cannot be chosen at this stage.",
      );
      const seat = next.references[id];
      assert(!seat.ready, "Your priority card is already committed.");
      assert(
        seat.drafted.includes(action.factionId),
        "Choose one of your three reference cards.",
      );
      seat.priority = action.factionId;
      seat.ready = true;
      next.log.push(`${name} committed a priority card facedown.`);
      if (next.order.every((player) => next.references[player].ready)) {
        for (const player of next.order) {
          const hand = next.references[player];
          next.priorities[player] = hand.priority!;
          hand.drafted = hand.drafted.filter((card) => card !== hand.priority);
          hand.ready = false;
        }
        next.order.sort(
          (a, b) =>
            rawReferenceFaction(next.priorities[a]).priorityOrder! -
            rawReferenceFaction(next.priorities[b]).priorityOrder!,
        );
        next.speaker = next.order[0];
        next.log.push(
          "Priority cards were revealed. The lowest number is speaker; seating runs clockwise in ascending priority order.",
        );
        startMap(next);
      }
      break;
    }
    case "placeSystem": {
      assert(Number.isInteger(action.position), "Choose a valid map position.");
      assert(
        rawLegalPositions(next, id, action.systemId).includes(action.position),
        "That tile cannot be placed there: check your turn, the inner ring, anomalies, and matching wormholes.",
      );
      next.map[action.position] = {
        ...next.map[action.position],
        type: "SYSTEM",
        systemId: action.systemId,
      };
      next.log.push(
        `${name} placed system ${action.systemId} at position ${action.position}.`,
      );
      if (next.phase === "mapPreplace") {
        next.preplace = next.preplace.filter(
          (tile) => tile !== action.systemId,
        );
        if (!next.preplace.length) next.phase = "map";
      } else {
        next.hands[id] = next.hands[id].filter(
          (tile) => tile !== action.systemId,
        );
        next.turn++;
        if (next.order.every((player) => !next.hands[player].length))
          finishMap(next);
      }
      break;
    }
    case "chooseHome": {
      assert(
        next.phase === "homes" && rawActivePlayer(next) === id,
        "It is not your turn to choose a home system.",
      );
      assert(
        rawHomeChoices(next, id).includes(action.factionId),
        "Choose an available home system reference card.",
      );
      let home = action.factionId;
      if (next.settings.mode === "twilightsFall") {
        if (home === "keleres") {
          const replacement = next.referenceDeck.shift();
          assert(
            replacement,
            "No unused faction card remains for the Keleres home system.",
          );
          home = replacement;
        }
        next.fleets[id] = next.references[id].drafted.find(
          (card) => card !== action.factionId,
        )!;
      }
      next.homes[id] = home;
      next.log.push(
        `${name} chose ${factions[home].name}'s home system${action.factionId === "keleres" && next.settings.mode === "twilightsFall" ? " by drawing Keleres' random unused replacement card" : ""}.`,
      );
      if (next.settings.mode === "base") startMap(next);
      else {
        attachHome(next, id, home);
        next.turn++;
        if (next.turn === next.order.length) {
          next.phase = "kings";
          next.turn = 0;
          next.log.push(
            "Choose Mahact kings counterclockwise from the speaker's right; the speaker chooses last.",
          );
        }
      }
      break;
    }
    case "chooseKing": {
      assert(
        next.phase === "kings" && rawActivePlayer(next) === id,
        "It is not your turn to choose a Mahact king.",
      );
      assert(
        twilightsFallFactionIds.includes(action.factionId),
        "Choose a Mahact king.",
      );
      assert(
        !Object.values(next.kings).includes(action.factionId),
        "That Mahact king has already been chosen.",
      );
      next.kings[id] = action.factionId;
      next.log.push(`${name} chose ${factions[action.factionId].name}.`);
      next.turn++;
      if (next.turn === next.order.length) startSplice(next);
      break;
    }
    case "pickSplice": {
      assert(
        next.phase === "splice",
        "The inaugural splice is not accepting picks.",
      );
      assert(
        rawSpliceChoices(next, id).includes(action.itemId),
        "Choose a card from your hand without exceeding three abilities, two upgrades, or two genomes.",
      );
      const seat = next.splice[id];
      seat.hand = seat.hand.filter((item) => item !== action.itemId);
      seat.drafted.push(action.itemId);
      seat.ready = true;
      next.log.push(`${name} kept a splice card facedown.`);
      advanceSplice(next);
      break;
    }
    case "keepSplice": {
      assert(
        next.phase === "spliceKeep",
        "Starting cards cannot be selected at this stage.",
      );
      const seat = next.splice[id];
      assert(!seat.ready, "Your starting cards are already committed.");
      assert(
        Array.isArray(action.itemIds) &&
          action.itemIds.length === 4 &&
          new Set(action.itemIds).size === 4,
        "Keep exactly four distinct cards.",
      );
      assert(
        action.itemIds.every((item) => seat.drafted.includes(item)),
        "Keep cards from your own drafted cards.",
      );
      assert(
        Object.entries(keepLimits).every(
          ([type, count]) =>
            action.itemIds.filter((item) => category(item) === type).length ===
            count,
        ),
        "Keep two abilities, one unit upgrade, and one genome.",
      );
      seat.kept = [...action.itemIds];
      seat.ready = true;
      next.log.push(`${name} committed their starting cards facedown.`);
      if (next.order.every((player) => next.splice[player].ready)) {
        next.phase = "complete";
        next.log.push(
          "All starting cards were revealed simultaneously. Twilight's Fall draft and galaxy setup are complete.",
        );
      }
      break;
    }
    default:
      throw new RawDraftError("Unknown RAW draft action.");
  }
  next.history.push(snapshot(state));
  next.revision++;
  return next;
}

export function undoRawAction(state: RawState): RawState {
  assert(state.history.length, "There is no RAW setup action to undo.");
  const previous = structuredClone(state.history[state.history.length - 1]);
  return {
    ...previous,
    version: 1,
    settings: structuredClone(state.settings),
    revision: state.revision + 1,
    history: structuredClone(state.history.slice(0, -1)),
  };
}
