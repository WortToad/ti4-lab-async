import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createCookie } from "react-router";
import { eq, sql } from "drizzle-orm";
import { db } from "~/drizzle/config.server";
import { bagDrafts } from "~/drizzle/schema.server";
import {
  createMantisRoomFromState,
  getMantisRoom,
  mantisTokenHash,
  saveMantisRoom,
} from "~/drizzle/mantisDraft.server";
import { appPath } from "~/utils/appUrl";
import {
  newBackupSecret,
  openBackup,
  playerName,
  sealBackup,
  validRecoveryToken,
} from "../lobby.server";
import { bagMapBuildError, bagToMantisState } from "./bagToMantis";
import {
  applyBagAction,
  assemblyOptions,
  BagDraftError,
  createBagState,
  draftableItems,
  keptBagItems,
  requiredBagPicks,
  resolveBagItem,
} from "./engine";
import type {
  BagDraftAction,
  BagDraftState,
  BagDraftView,
  CreateBagDraftInput,
} from "./types";

type SavedState = {
  state: BagDraftState;
  started: boolean;
  paused: boolean;
  mapDraft?: import("~/draft/mantis/engine").MantisState;
};
type Checkpoint = {
  id: string;
  label: string;
  createdAt: string;
  saved: SavedState;
};
type Credentials = {
  adminHash: string;
  adminUuid?: string;
  seatKeys: Record<number, string>;
  mapHostToken?: string;
  lobby?: {
    started: boolean;
    paused: boolean;
    backupSecret: string;
    checkpoints: Checkpoint[];
    undo: string[];
  };
};
const digest = (key: string) => createHash("sha256").update(key).digest("hex");
function matches(key: string, hash: string) {
  return (
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(Buffer.from(digest(key), "hex"), Buffer.from(hash, "hex"))
  );
}
export const bagCookie = (id: string, role: "player" | "admin" = "player") =>
  createCookie(`bag-${role}-${id}`, {
    httpOnly: true,
    sameSite: "lax",
    path: appPath("/draft/bag"),
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
export async function readBagToken(
  id: string,
  request: Request,
  role: "player" | "admin" = "player",
) {
  try {
    const token: unknown = await bagCookie(id, role).parse(
      request.headers.get("Cookie"),
    );
    return validRecoveryToken(token) ? token : undefined;
  } catch {
    return undefined;
  }
}
function authenticate(
  credentials: Credentials,
  key?: string,
  adminKey?: string,
) {
  const isAdmin = !!(
    (adminKey && matches(adminKey, credentials.adminHash)) ||
    (key && matches(key, credentials.adminHash))
  );
  const playerId = key
    ? Object.entries(credentials.seatKeys).find(([, value]) =>
        matches(key, digest(value)),
      )?.[0]
    : undefined;
  if (key && !isAdmin && playerId === undefined)
    throw new Response(
      "This recovery UUID is no longer valid. Ask the admin to recover your slot.",
      { status: 403 },
    );
  return {
    isAdmin,
    playerId: playerId === undefined ? undefined : Number(playerId),
  };
}
function getRecord(id: string) {
  const record = db.select().from(bagDrafts).where(eq(bagDrafts.id, id)).get();
  if (!record) throw new Response("Bag draft not found.", { status: 404 });
  return record;
}
function loadBagDraft(id: string, key?: string, adminKey?: string) {
  const record = getRecord(id);
  const credentials = JSON.parse(record.credentials) as Credentials;
  const needsMigration = !credentials.lobby;
  // Existing rooms keep their active state and their existing personal keys.
  credentials.lobby ??= {
    started: true,
    paused: false,
    backupSecret: newBackupSecret(),
    checkpoints: [],
    undo: [],
  };
  return {
    state: JSON.parse(record.data) as BagDraftState,
    credentials,
    viewer: authenticate(credentials, key, adminKey),
    needsMigration,
  };
}
function saveBagDraft(
  id: string,
  state: BagDraftState,
  credentials: Credentials,
) {
  db.update(bagDrafts)
    .set({
      data: JSON.stringify(state),
      credentials: JSON.stringify(credentials),
      revision: state.revision,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(bagDrafts.id, id))
    .run();
}
function snapshot(state: BagDraftState, credentials: Credentials): SavedState {
  return {
    state: structuredClone(state),
    ...(state.mapRoomId
      ? { mapDraft: structuredClone(getMantisRoom(state.mapRoomId).room.draft) }
      : {}),
    started: credentials.lobby!.started,
    paused: credentials.lobby!.paused,
  };
}
function checkpoint(
  state: BagDraftState,
  credentials: Credentials,
  label: string,
  undo = true,
) {
  const lobby = credentials.lobby!;
  const point: Checkpoint = {
    id: randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    saved: snapshot(state, credentials),
  };
  lobby.checkpoints.push(point);
  if (undo) lobby.undo.push(point.id);
  if (lobby.checkpoints.length > 250) {
    const removed = lobby.checkpoints.shift()!;
    lobby.undo = lobby.undo.filter((id) => id !== removed.id);
  }
  return point;
}
function attachMapRoom(
  id: string,
  state: BagDraftState,
  credentials: Credentials,
) {
  if (
    !credentials.lobby!.started ||
    state.mapRoomId ||
    state.phase !== "complete" ||
    bagMapBuildError(state)
  )
    return false;
  const map = bagToMantisState(state);
  map.bagDraftId = id;
  const claims = Object.fromEntries(
    Object.entries(credentials.seatKeys).map(([seatId, key]) => [
      seatId,
      digest(key),
    ]),
  );
  const room = createMantisRoomFromState(map, claims, {
    seatKeys: credentials.seatKeys,
    adminUuid: credentials.adminUuid,
  });
  state.mapRoomId = room.id;
  credentials.mapHostToken = room.token;
  return true;
}
export async function createBagDraft(input: CreateBagDraftInput) {
  const state = createBagState(input);
  const id = randomUUID();
  const adminToken = randomUUID();
  const credentials: Credentials = {
    adminHash: digest(adminToken),
    adminUuid: adminToken,
    seatKeys: {},
    lobby: {
      started: false,
      paused: false,
      backupSecret: newBackupSecret(),
      checkpoints: [],
      undo: [],
    },
  };
  db.insert(bagDrafts)
    .values({
      id,
      data: JSON.stringify(state),
      credentials: JSON.stringify(credentials),
    })
    .run();
  return { id, adminToken };
}
export function projectBagDraft(
  id: string,
  state: BagDraftState,
  viewer: { isAdmin: boolean; playerId?: number },
): BagDraftView {
  const seat = state.seats.find((player) => player.id === viewer.playerId);
  return {
    id,
    settings: state.settings,
    rules: state.rules,
    phase: state.phase,
    round: state.round,
    revision: state.revision,
    viewer,
    lobby: {
      started: true,
      paused: false,
      slots: state.seats.map((seat) => ({
        id: seat.id,
        name: seat.name,
        claimed: true,
      })),
    },
    players: state.seats.map((player) => ({
      id: player.id,
      name: player.name,
      ready: player.ready,
      finished: player.finished,
      draftedCount: player.hand.length,
      ...(state.phase === "complete"
        ? { keptItems: keptBagItems(state, player) }
        : {}),
    })),
    ...(seat
      ? {
          privateSeat: {
            id: seat.id,
            bag:
              state.phase === "drafting"
                ? seat.bag.map((id) => resolveBagItem(id, state.settings))
                : [],
            hand: seat.hand.map((id) => resolveBagItem(id, state.settings)),
            assemblyOptions:
              state.phase !== "drafting" ? assemblyOptions(state, seat) : [],
            keptItemIds: seat.keptItemIds,
            roundPicks: seat.roundPicks,
            ready: seat.ready,
            finished: seat.finished,
            canUndo: state.phase === "drafting" && seat.roundPicks.length > 0,
            picksRequired: seat.ready ? 0 : requiredBagPicks(state, seat),
            draftableItemIds:
              state.phase === "drafting" && !seat.ready
                ? draftableItems(state, seat)
                : [],
          },
        }
      : {}),
    canUndoRound:
      !state.mapRoomId &&
      viewer.isAdmin &&
      state.history.length > 0 &&
      state.revision > 0,
    mapBuildError: state.mapRoomId ? undefined : bagMapBuildError(state),
    mapRoomId: state.mapRoomId,
  };
}
export async function getBagDraftView(
  id: string,
  key?: string,
  adminKey?: string,
) {
  let saved = loadBagDraft(id, key, adminKey);
  if (
    saved.needsMigration ||
    (saved.credentials.lobby!.started &&
      saved.state.phase === "complete" &&
      !saved.state.mapRoomId &&
      !bagMapBuildError(saved.state))
  ) {
    saved = db.transaction(
      () => {
        const latest = loadBagDraft(id, key, adminKey);
        const attached = attachMapRoom(id, latest.state, latest.credentials);
        if (attached) latest.state.revision++;
        if (attached || latest.needsMigration)
          saveBagDraft(id, latest.state, latest.credentials);
        return latest;
      },
      { behavior: "immediate" },
    );
  }
  const { state, credentials, viewer } = saved;
  const lobby = credentials.lobby!;
  const view = projectBagDraft(id, state, viewer);
  view.lobby = {
    started: lobby.started,
    paused: lobby.paused,
    slots: [...state.seats]
      .sort((a, b) => a.id - b.id)
      .map((seat) => ({
        id: seat.id,
        name: seat.name,
        claimed: !!credentials.seatKeys[seat.id],
        ...(viewer.isAdmin && credentials.seatKeys[seat.id]
          ? { uuid: credentials.seatKeys[seat.id] }
          : {}),
      })),
    ...(viewer.playerId !== undefined
      ? { ownUuid: credentials.seatKeys[viewer.playerId] }
      : {}),
    ...(viewer.isAdmin
      ? {
          adminUuid: credentials.adminUuid,
          checkpoints: lobby.checkpoints.map(({ id, label, createdAt }) => ({
            id,
            label,
            createdAt,
          })),
        }
      : {}),
  };
  if (!lobby.started) {
    view.phase = "lobby";
    view.round = 0;
    view.players = view.lobby.slots.map((seat) => ({
      id: seat.id,
      name: seat.name,
      ready: false,
      finished: false,
      draftedCount: 0,
    }));
    delete view.privateSeat;
    delete view.mapRoomId;
    delete view.mapBuildError;
    view.canUndoRound = false;
  }
  return view;
}
export async function joinBagDraft(
  id: string,
  name: string,
  key?: string,
) {
  return db.transaction(
    () => {
      const { state, credentials, viewer } = loadBagDraft(id, key);
      if (viewer.playerId !== undefined)
        throw new Error(
          "You already have a slot in this lobby. Use your saved UUID to rejoin it.",
        );
      const seat = [...state.seats]
        .sort((a, b) => a.id - b.id)
        .find((seat) => !credentials.seatKeys[seat.id]);
      if (!seat) throw new Error("This lobby is full.");
      seat.name = playerName(name);
      const uuid = randomUUID();
      credentials.seatKeys[seat.id] = uuid;
      for (const round of state.history)
        for (const player of round.seats)
          if (player.id === seat.id) player.name = seat.name;
      syncMapIdentity(state, credentials, seat.id, seat.name);
      state.revision++;
      saveBagDraft(id, state, credentials);
      return { uuid };
    },
    { behavior: "immediate" },
  );
}
export async function recoverBagDraft(
  id: string,
  uuid: string,
): Promise<{ role: "player" | "admin" }> {
  if (!validRecoveryToken(uuid))
    throw new Error("Enter your saved recovery UUID.");
  const { viewer } = loadBagDraft(id, uuid);
  return { role: viewer.isAdmin ? "admin" : "player" };
}
export function findBagLobby(
  uuid: string,
): { id: string; role: "player" | "admin" } | undefined {
  if (!validRecoveryToken(uuid)) return undefined;
  for (const row of db
    .select({ id: bagDrafts.id, credentials: bagDrafts.credentials })
    .from(bagDrafts)
    .all()) {
    const credentials = JSON.parse(row.credentials) as Credentials;
    if (matches(uuid, credentials.adminHash))
      return { id: row.id, role: "admin" };
    if (Object.values(credentials.seatKeys).includes(uuid))
      return { id: row.id, role: "player" };
  }
}
export async function getBagMapAccess(
  id: string,
  key?: string,
  adminKey?: string,
) {
  const { state, credentials, viewer } = loadBagDraft(id, key, adminKey);
  if (!state.mapRoomId) return undefined;
  if (viewer.isAdmin && !credentials.mapHostToken)
    throw new BagDraftError("The map room's host credentials are missing.");
  return {
    id: state.mapRoomId,
    token:
      viewer.playerId !== undefined
        ? credentials.seatKeys[viewer.playerId]
        : undefined,
    adminToken: viewer.isAdmin ? credentials.mapHostToken : undefined,
  };
}
function syncMapIdentity(
  state: BagDraftState,
  credentials: Credentials,
  playerId: number,
  name?: string,
) {
  if (!state.mapRoomId) return;
  const map = getMantisRoom(state.mapRoomId);
  const uuid = credentials.seatKeys[playerId];
  if (uuid) map.room.claims[playerId] = mantisTokenHash(uuid);
  else delete map.room.claims[playerId];
  if (map.room.lobby) {
    if (uuid) map.room.lobby.seatKeys[playerId] = uuid;
    else delete map.room.lobby.seatKeys[playerId];
  }
  if (name) {
    for (const p of map.room.draft.players)
      if (p.id === playerId) p.name = name;
    for (const p of map.room.draft.settings.players)
      if (p.id === playerId) p.name = name;
  }
  saveMantisRoom(map.id, map.revision, map.room);
}
function restore(
  state: BagDraftState,
  credentials: Credentials,
  saved: SavedState,
) {
  const next = structuredClone(saved.state);
  if (
    next.version !== 1 ||
    next.seats.length !== state.seats.length ||
    next.seats.some((s) => !state.seats.some((p) => p.id === s.id))
  )
    throw new Error("The saved slots do not match this lobby.");
  for (const seat of next.seats)
    seat.name = state.seats.find((p) => p.id === seat.id)!.name;
  for (const round of next.history)
    for (const seat of round.seats)
      seat.name = state.seats.find((p) => p.id === seat.id)!.name;
  // Keep previous map progress recoverable, but pause it while returning to bags.
  if (state.mapRoomId && state.mapRoomId !== next.mapRoomId) {
    const map = getMantisRoom(state.mapRoomId);
    if (map.room.lobby) map.room.lobby.paused = true;
    saveMantisRoom(map.id, map.revision, map.room);
  }
  if (next.mapRoomId && saved.mapDraft) {
    const map = getMantisRoom(next.mapRoomId);
    map.room.draft = structuredClone(saved.mapDraft);
    for (const player of map.room.draft.players)
      player.name =
        state.seats.find((s) => s.id === player.id)?.name ?? player.name;
    map.room.lobby.paused = true;
    saveMantisRoom(map.id, map.revision, map.room);
  }
  credentials.lobby!.started = saved.started;
  credentials.lobby!.paused = saved.started;
  next.revision = state.revision + 1;
  return next;
}
export async function exportBagDraft(
  id: string,
  key?: string,
  adminKey?: string,
  checkpointId?: string,
) {
  return db.transaction(
    () => {
      const { state, credentials, viewer } = loadBagDraft(id, key, adminKey);
      if (!viewer.isAdmin)
        throw new Response("Only the admin can export recovery saves.", {
          status: 403,
        });
      const saved = checkpointId
        ? credentials.lobby!.checkpoints.find((p) => p.id === checkpointId)
            ?.saved
        : snapshot(state, credentials);
      if (!saved) throw new Error("That checkpoint is no longer available.");
      saveBagDraft(id, state, credentials);
      return sealBackup("bag", id, credentials.lobby!.backupSecret, saved);
    },
    { behavior: "immediate" },
  );
}
export async function mutateBagDraft(
  id: string,
  key: string | undefined,
  action: BagDraftAction,
  adminKey?: string,
) {
  db.transaction(
    () => {
      const { state, credentials, viewer } = loadBagDraft(id, key, adminKey);
      if (!action || typeof action !== "object")
        throw new Error("Choose a draft action.");
      const lobby = credentials.lobby!;
      let next = state;
      const personal = ["pick", "undo", "assemble", "reopen"].includes(
        action.action,
      );
      if (!personal) {
        if (!viewer.isAdmin)
          throw new Response("Only the admin can manage this lobby.", {
            status: 403,
          });
        if (!("revision" in action) || action.revision !== state.revision)
          throw new Error(
            "The lobby changed. Wait for the latest state and try again.",
          );
      } else if (viewer.playerId === undefined)
        throw new Response(
          "Join the lobby or rejoin with your UUID before drafting.",
          { status: 403 },
        );
      if (action.action === "start") {
        if (lobby.started) throw new Error("This draft has already started.");
        if (!state.seats.every((s) => credentials.seatKeys[s.id]))
          throw new Error("Every slot must be claimed before starting.");
        checkpoint(state, credentials, "Before starting the draft");
        if (state.settings.shufflePlayers !== false) {
          for (let index = state.seats.length - 1; index > 0; index--) {
            const target = randomInt(index + 1);
            [state.seats[index], state.seats[target]] = [
              state.seats[target],
              state.seats[index],
            ];
          }
          state.history = [
            { round: state.round, seats: structuredClone(state.seats) },
          ];
        }
        lobby.started = true;
      } else if (action.action === "pause" || action.action === "resume") {
        if (!lobby.started) throw new Error("Start the draft first.");
        if (
          action.action === "resume" &&
          !state.seats.every((s) => credentials.seatKeys[s.id])
        )
          throw new Error("Fill every released slot before resuming.");
        lobby.paused = action.action === "pause";
      } else if (action.action === "checkpoint") {
        checkpoint(
          state,
          credentials,
          `Saved checkpoint · ${state.phase} · round ${state.round + 1}`,
          false,
        );
      } else if (
        action.action === "release" ||
        action.action === "rotate" ||
        action.action === "rename"
      ) {
        const seat = state.seats.find((s) => s.id === action.playerId);
        if (!seat) throw new Error("Choose a valid slot.");
        if (action.action === "rename") seat.name = playerName(action.name);
        else if (action.action === "release") {
          delete credentials.seatKeys[seat.id];
          if (lobby.started) lobby.paused = true;
        } else {
          if (!credentials.seatKeys[seat.id])
            throw new Error("That slot has not been claimed.");
          credentials.seatKeys[seat.id] = randomUUID();
        }
        syncMapIdentity(state, credentials, seat.id, seat.name);
      } else if (action.action === "undoAction") {
        const pointId = lobby.undo.pop();
        const point = lobby.checkpoints.find((p) => p.id === pointId);
        if (!point) throw new Error("There is no action to undo.");
        checkpoint(state, credentials, "Recovery point before undo", false);
        next = restore(state, credentials, point.saved);
      } else if (
        action.action === "restoreCheckpoint" ||
        action.action === "importState"
      ) {
        const saved =
          action.action === "importState"
            ? openBackup<SavedState>(
                "bag",
                id,
                lobby.backupSecret,
                action.state,
              )
            : lobby.checkpoints.find((p) => p.id === action.checkpointId)
                ?.saved;
        if (!saved) throw new Error("That checkpoint is no longer available.");
        checkpoint(
          state,
          credentials,
          "Recovery point before restoring a save",
        );
        next = restore(state, credentials, saved);
      } else {
        if (!lobby.started)
          throw new Error(
            "Wait for everyone to join and the admin to start the draft.",
          );
        if (lobby.paused && personal)
          throw new Error(
            "The admin paused this draft. Wait for it to resume.",
          );
        checkpoint(
          state,
          credentials,
          `Before ${action.action} · ${state.phase} · round ${state.round + 1}`,
        );
        next = applyBagAction(state, viewer.playerId, action, viewer.isAdmin);
      }
      if (next === state) next.revision++;
      attachMapRoom(id, next, credentials);
      saveBagDraft(id, next, credentials);
    },
    { behavior: "immediate" },
  );
  return getBagDraftView(id, key, adminKey);
}

/** Keep a transferred player's recovery identity the same in both lobby links. */
export function syncBagMapIdentity(
  bagDraftId: string,
  mapRoomId: string,
  playerId: number,
  identity: { uuid?: string; name: string },
) {
  db.transaction(
    () => {
      const { state, credentials } = loadBagDraft(bagDraftId);
      if (state.mapRoomId !== mapRoomId) return;
      const seat = state.seats.find((s) => s.id === playerId);
      if (!seat)
        throw new Error("The linked bag lobby does not contain that slot.");
      if (identity.uuid) credentials.seatKeys[playerId] = identity.uuid;
      else {
        delete credentials.seatKeys[playerId];
        credentials.lobby!.paused = true;
      }
      seat.name = playerName(identity.name);
      for (const round of state.history)
        for (const player of round.seats)
          if (player.id === playerId) player.name = seat.name;
      state.revision++;
      saveBagDraft(bagDraftId, state, credentials);
    },
    { behavior: "immediate" },
  );
}
