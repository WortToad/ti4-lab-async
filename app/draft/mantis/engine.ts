import { draftConfig } from "~/draft/draftConfig";
import { systemData, factionSystems } from "~/data/systemData";
import { getFactionPool } from "~/utils/factions";
import { getSystemPool } from "~/utils/system";
import { generateEmptyMap } from "~/utils/map";
import type {
  DraftType,
  FactionId,
  GameSet,
  Map,
  Player,
  SystemId,
} from "~/types";

export const MANTIS_MAPS: Partial<Record<number, DraftType>> = {
  3: "milty3p",
  4: "milty4p",
  5: "milty5p",
  6: "milty",
  7: "milty7p",
  8: "milty8p",
};

export type MantisSettings = {
  players: Player[];
  tileGameSets: GameSet[];
  factionGameSets: GameSet[];
  numFactions: number;
  extraBlues: number;
  extraReds: number;
  mulligans: number;
  bannedFactions?: FactionId[];
  requiredFactions?: FactionId[];
  draftOrder?: number[];
};

export type MantisSnapshot = {
  settings: MantisSettings;
  mapType: DraftType;
  phase: "draft" | "discard" | "build" | "complete";
  players: Player[];
  order: number[];
  pickNumber: number;
  pool: SystemId[];
  factions: FactionId[];
  hands: Record<number, SystemId[]>;
  chosenFactions: Record<number, FactionId>;
  factionLabels?: Record<number, string>;
  bagDraftId?: string;
  seats: Record<number, number>;
  discarded: SystemId[];
  mulligansUsed: Record<number, number>;
  map: Map;
  drawnTile?: SystemId;
  log: string[];
};

export type MantisState = MantisSnapshot & { history: MantisSnapshot[] };
export type MantisAction =
  | { type: "tile"; tileId: string }
  | { type: "faction"; factionId: FactionId }
  | { type: "seat"; seat: number }
  | { type: "discard"; tileId: string }
  | { type: "place"; mapIdx: number }
  | { type: "mulligan" };

type Random = () => number;

function shuffled<T>(values: T[], random: Random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function integer(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
}

export function createMantisDraft(
  settings: MantisSettings,
  random: Random = Math.random,
): MantisState {
  const count = settings.players.length;
  integer(count, 4, 8, "Player count");
  integer(settings.extraBlues, 0, 2, "Extra blue tiles");
  integer(settings.extraReds, 0, 2, "Extra red tiles");
  integer(settings.mulligans, 0, 3, "Mulligans");
  if (
    new Set(settings.players.map((p) => p.id)).size !== count ||
    settings.players.some((p) => !Number.isInteger(p.id))
  ) {
    throw new Error("Players must have unique numeric IDs.");
  }
  const ids = settings.players.map((p) => p.id);
  if (
    settings.draftOrder &&
    (settings.draftOrder.length !== count ||
      new Set(settings.draftOrder).size !== count ||
      settings.draftOrder.some((id) => !ids.includes(id)))
  ) {
    throw new Error("Draft order must include each player exactly once.");
  }
  const factionPool = getFactionPool(settings.factionGameSets).filter(
    (id) => !settings.bannedFactions?.includes(id),
  );
  integer(settings.numFactions, count, factionPool.length, "Faction pool size");
  const required = [...new Set(settings.requiredFactions ?? [])];
  if (
    required.length > settings.numFactions ||
    required.some((id) => !factionPool.includes(id))
  ) {
    throw new Error(
      "Required factions must be available and fit the faction pool.",
    );
  }
  const mapType = MANTIS_MAPS[count]!;
  const map = generateEmptyMap(draftConfig[mapType]);
  const used = new Set(
    map.flatMap((t) => (t.type === "SYSTEM" ? [t.systemId] : [])),
  );
  const systems = getSystemPool(settings.tileGameSets).filter(
    (id) => !used.has(id),
  );
  const blues = shuffled(
    systems.filter((id) => systemData[id]?.type === "BLUE"),
    random,
  );
  const reds = shuffled(
    systems.filter((id) => systemData[id]?.type === "RED"),
    random,
  );
  const blueCount = count * (3 + settings.extraBlues);
  const redCount = count * (2 + settings.extraReds);
  if (blues.length < blueCount || reds.length < redCount) {
    throw new Error(
      `This setup needs ${blueCount} blue and ${redCount} red tiles; the selected sets have ${blues.length} blue and ${reds.length} red. Enable more tile sets or reduce extras.`,
    );
  }
  return {
    settings: structuredClone(settings),
    mapType,
    phase: "draft",
    players: settings.players.map((p, i) => ({
      id: p.id,
      name: p.name.trim().slice(0, 60) || `Player ${i + 1}`,
    })),
    order: settings.draftOrder
      ? [...settings.draftOrder]
      : shuffled(ids, random),
    pickNumber: 0,
    pool: [...blues.slice(0, blueCount), ...reds.slice(0, redCount)],
    factions: [
      ...required,
      ...shuffled(
        factionPool.filter((id) => !required.includes(id)),
        random,
      ).slice(0, settings.numFactions - required.length),
    ],
    hands: Object.fromEntries(ids.map((id) => [id, []])),
    chosenFactions: {},
    seats: {},
    discarded: [],
    mulligansUsed: Object.fromEntries(ids.map((id) => [id, 0])),
    map,
    log: [],
    history: [],
  };
}

export function createMantisMapBuild(
  input: {
    players: Player[];
    hands: Record<number, SystemId[]>;
    homeSystems?: Record<number, SystemId>;
    seatOrder: number[];
    factionLabels?: Record<number, string>;
    mulligans?: number;
  },
  random: Random = Math.random,
): MantisState {
  const count = input.players.length;
  integer(count, 3, 8, "Player count");
  const ids = input.players.map((player) => player.id);
  if (new Set(ids).size !== count || ids.some((id) => !Number.isInteger(id)))
    throw new Error("Players must have unique numeric IDs.");
  if (
    input.seatOrder.length !== count ||
    new Set(input.seatOrder).size !== count ||
    input.seatOrder.some((id) => !ids.includes(id))
  )
    throw new Error("Seat order must include every player exactly once.");
  const mulligans = input.mulligans ?? 1;
  integer(mulligans, 0, 3, "Mulligans");
  const allTiles = ids.flatMap((id) => input.hands[id] ?? []);
  if (new Set(allTiles).size !== allTiles.length)
    throw new Error("Drafted map tiles must be unique.");
  for (const id of ids) {
    const tiles = input.hands[id] ?? [];
    if (
      tiles.length !== 5 ||
      tiles.filter((tile) => systemData[tile]?.type === "BLUE").length !== 3 ||
      tiles.filter((tile) => systemData[tile]?.type === "RED").length !== 2
    )
      throw new Error(
        "Map building requires each player to have exactly 3 blue and 2 red tiles.",
      );
  }
  const mapType = MANTIS_MAPS[count]!;
  const map = generateEmptyMap(draftConfig[mapType]);
  const settings: MantisSettings = {
    players: input.players,
    tileGameSets: [],
    factionGameSets: [],
    numFactions: count,
    extraBlues: 0,
    extraReds: 0,
    mulligans,
  };
  for (let seat = 0; seat < count; seat++) {
    const id = input.seatOrder[seat];
    const homeSystem = input.homeSystems?.[id];
    const idx = draftConfig[mapType].homeIdxInMapString[seat];
    if (homeSystem) {
      if (!systemData[homeSystem] || systemData[homeSystem].type !== "GREEN")
        throw new Error(`Unknown home system: ${homeSystem}.`);
      map[idx] = { ...map[idx], type: "SYSTEM", systemId: homeSystem };
    } else map[idx] = { ...map[idx], type: "HOME", playerId: id, seat };
  }
  const state: MantisState = {
    settings: structuredClone(settings),
    players: structuredClone(input.players),
    mapType,
    phase: "build",
    order: [...input.seatOrder],
    pickNumber: 0,
    pool: [],
    factions: [],
    hands: structuredClone(input.hands),
    chosenFactions: {},
    factionLabels: input.factionLabels,
    seats: Object.fromEntries(input.seatOrder.map((id, seat) => [id, seat])),
    discarded: [],
    mulligansUsed: Object.fromEntries(ids.map((id) => [id, 0])),
    map,
    log: ["Map building started from a completed bag draft."],
    history: [],
  };
  drawTile(state, random);
  return state;
}

export function countMantisTiles(
  state: MantisSnapshot,
  playerId: number,
  color: "BLUE" | "RED",
) {
  return (
    state.hands[playerId]?.filter((id) => systemData[id]?.type === color)
      .length ?? 0
  );
}

export function needsMantisDiscard(state: MantisSnapshot, playerId: number) {
  return (
    countMantisTiles(state, playerId, "BLUE") > 3 ||
    countMantisTiles(state, playerId, "RED") > 2
  );
}

export function mantisBuildTurn(
  state: MantisSnapshot,
): { playerId: number; positions: number[] } | undefined {
  const config = draftConfig[state.mapType];
  for (const indices of [[4], [1, 3], [0, 2]]) {
    let next: { playerId: number; positions: number[] } | undefined;
    for (let seat = 0; seat < state.players.length; seat++) {
      const player = state.players.find((p) => state.seats[p.id] === seat);
      if (!player) continue;
      const home = state.map[config.homeIdxInMapString[seat]];
      const positions = indices
        .map((index) => {
          const [x, y] = config.seatTilePlacement[seat][index];
          return state.map.find(
            (t) =>
              t.position.x === home.position.x + x &&
              t.position.y === home.position.y + y,
          );
        })
        .filter((t) => t?.type === "OPEN")
        .map((t) => t!.idx);
      if (positions.length > (next?.positions.length ?? 0))
        next = { playerId: player.id, positions };
    }
    if (next) return next;
  }
  return undefined;
}

export function mantisActivePlayer(state: MantisSnapshot): number | undefined {
  if (state.phase === "build") return mantisBuildTurn(state)?.playerId;
  if (state.phase !== "draft") return undefined;
  const round = Math.floor(state.pickNumber / state.order.length);
  const index = state.pickNumber % state.order.length;
  return state.order[round % 2 === 0 ? index : state.order.length - index - 1];
}

function drawTile(state: MantisState, random: Random, exclude?: string) {
  const turn = mantisBuildTurn(state);
  if (!turn) {
    state.phase = "complete";
    state.drawnTile = undefined;
    return;
  }
  const choices = state.hands[turn.playerId].filter((id) => id !== exclude);
  if (!choices.length) throw new Error("No tile is available to draw.");
  state.drawnTile = choices[Math.floor(random() * choices.length)];
}

function beginBuild(state: MantisState, random: Random) {
  state.phase = "build";
  const config = draftConfig[state.mapType];
  for (const player of state.players) {
    const index = config.homeIdxInMapString[state.seats[player.id]];
    const system = factionSystems[state.chosenFactions[player.id]];
    if (system)
      state.map[index] = {
        ...state.map[index],
        type: "SYSTEM",
        systemId: system.id,
      };
  }
  drawTile(state, random);
}

export function applyMantisAction(
  original: MantisState,
  playerId: number,
  action: MantisAction,
  random: Random = Math.random,
): MantisState {
  if (!original.players.some((p) => p.id === playerId))
    throw new Error("Choose a player in this draft.");
  const state = structuredClone(original);
  const { history, ...before } = original;
  const player = state.players.find((p) => p.id === playerId)!;
  let message = "";
  if (state.phase === "draft") {
    if (mantisActivePlayer(state) !== playerId)
      throw new Error("It is another player's turn.");
    if (action.type === "tile") {
      if (!state.pool.includes(action.tileId))
        throw new Error("That tile has already been drafted.");
      const color = systemData[action.tileId]?.type;
      const quota =
        color === "BLUE"
          ? 3 + state.settings.extraBlues
          : 2 + state.settings.extraReds;
      if (
        (color !== "BLUE" && color !== "RED") ||
        countMantisTiles(state, playerId, color) >= quota
      )
        throw new Error(
          "You have already drafted your quota of this tile color.",
        );
      state.pool = state.pool.filter((id) => id !== action.tileId);
      state.hands[playerId].push(action.tileId);
      message = `${player.name} drafted tile ${action.tileId}.`;
    } else if (action.type === "faction") {
      if (
        state.chosenFactions[playerId] ||
        !state.factions.includes(action.factionId) ||
        Object.values(state.chosenFactions).includes(action.factionId)
      )
        throw new Error("That faction cannot be drafted.");
      state.chosenFactions[playerId] = action.factionId;
      message = `${player.name} drafted ${action.factionId}.`;
    } else if (action.type === "seat") {
      integer(action.seat, 0, state.players.length - 1, "Seat");
      if (
        state.seats[playerId] !== undefined ||
        Object.values(state.seats).includes(action.seat)
      )
        throw new Error("That speaker position cannot be drafted.");
      state.seats[playerId] = action.seat;
      message = `${player.name} drafted speaker position ${action.seat + 1}.`;
    } else throw new Error("Draft a tile, faction, or speaker position.");
    state.pickNumber++;
    if (
      state.pickNumber ===
      state.players.length *
        (7 + state.settings.extraBlues + state.settings.extraReds)
    ) {
      if (state.players.some((p) => needsMantisDiscard(state, p.id)))
        state.phase = "discard";
      else beginBuild(state, random);
    }
  } else if (state.phase === "discard") {
    if (
      action.type !== "discard" ||
      !state.hands[playerId].includes(action.tileId)
    )
      throw new Error("Choose one of your extra tiles to discard.");
    const color = systemData[action.tileId].type;
    if (
      (color !== "BLUE" && color !== "RED") ||
      countMantisTiles(state, playerId, color) <= (color === "BLUE" ? 3 : 2)
    )
      throw new Error("Keep exactly 3 blue tiles and 2 red tiles.");
    state.hands[playerId] = state.hands[playerId].filter(
      (id) => id !== action.tileId,
    );
    state.discarded.push(action.tileId);
    message = `${player.name} discarded tile ${action.tileId}.`;
    if (!state.players.some((p) => needsMantisDiscard(state, p.id)))
      beginBuild(state, random);
  } else if (state.phase === "build") {
    const turn = mantisBuildTurn(state);
    if (turn?.playerId !== playerId)
      throw new Error("It is another player's turn to build.");
    if (action.type === "mulligan") {
      if (
        state.mulligansUsed[playerId] >= state.settings.mulligans ||
        state.hands[playerId].length < 2
      )
        throw new Error("No mulligan is available.");
      const previous = state.drawnTile;
      state.mulligansUsed[playerId]++;
      drawTile(state, random, previous);
      message = `${player.name} mulliganed tile ${previous} and drew ${state.drawnTile}.`;
    } else if (action.type === "place") {
      if (
        !turn.positions.includes(action.mapIdx) ||
        !state.drawnTile ||
        !state.hands[playerId].includes(state.drawnTile)
      )
        throw new Error(
          "Place the drawn tile in one of your highlighted positions.",
        );
      const tileId = state.drawnTile;
      state.map[action.mapIdx] = {
        ...state.map[action.mapIdx],
        type: "SYSTEM",
        systemId: tileId,
      };
      state.hands[playerId] = state.hands[playerId].filter(
        (id) => id !== tileId,
      );
      message = `${player.name} placed tile ${tileId} at map position ${action.mapIdx}.`;
      drawTile(state, random);
    } else throw new Error("Place the drawn tile or use a mulligan.");
  } else throw new Error("This draft is complete.");
  state.log.push(message);
  state.history = [...history, structuredClone(before)];
  return state;
}

export function undoMantisAction(state: MantisState): MantisState {
  const previous = state.history.at(-1);
  if (!previous) throw new Error("There is no action to undo.");
  return { ...structuredClone(previous), history: state.history.slice(0, -1) };
}
