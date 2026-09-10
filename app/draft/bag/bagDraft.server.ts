import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "~/drizzle/config.server";
import { bagDrafts } from "~/drizzle/schema.server";
import { createMantisRoomFromState } from "~/drizzle/mantisDraft.server";
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

type Credentials = {
  adminHash: string;
  seatKeys: Record<number, string>;
  mapHostToken?: string;
};

function digest(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function matches(key: string, hash: string) {
  return timingSafeEqual(
    Buffer.from(digest(key), "hex"),
    Buffer.from(hash, "hex"),
  );
}

function authenticate(credentials: Credentials, key?: string) {
  if (!key) return { isAdmin: false, playerId: undefined };
  if (matches(key, credentials.adminHash))
    return { isAdmin: true, playerId: undefined };
  for (const [playerId, seatKey] of Object.entries(credentials.seatKeys)) {
    if (matches(key, digest(seatKey)))
      return { isAdmin: false, playerId: Number(playerId) };
  }
  throw new Response(
    "This private link is invalid. Use the spectator link or ask your host for your player link.",
    { status: 403 },
  );
}

function getRecord(id: string) {
  const record = db.select().from(bagDrafts).where(eq(bagDrafts.id, id)).get();
  if (!record) throw new Response("Bag draft not found.", { status: 404 });
  return record;
}

function loadBagDraft(id: string, key?: string) {
  const record = getRecord(id);
  const credentials = JSON.parse(record.credentials) as Credentials;
  return {
    state: JSON.parse(record.data) as BagDraftState,
    credentials,
    viewer: authenticate(credentials, key),
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

function attachMapRoom(
  id: string,
  state: BagDraftState,
  credentials: Credentials,
) {
  if (state.mapRoomId || state.phase !== "complete" || bagMapBuildError(state))
    return false;
  const map = bagToMantisState(state);
  map.bagDraftId = id;
  const claims = Object.fromEntries(
    Object.entries(credentials.seatKeys).map(([seatId, key]) => [
      seatId,
      digest(key),
    ]),
  );
  const room = createMantisRoomFromState(map, claims);
  state.mapRoomId = room.id;
  credentials.mapHostToken = room.token;
  return true;
}

export async function createBagDraft(input: CreateBagDraftInput) {
  const state = createBagState(input);
  const id = randomUUID();
  const adminToken = randomBytes(32).toString("hex");
  const credentials: Credentials = {
    adminHash: digest(adminToken),
    seatKeys: Object.fromEntries(
      state.seats.map((seat) => [seat.id, randomBytes(32).toString("hex")]),
    ),
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
  const mapBuildError = state.mapRoomId ? undefined : bagMapBuildError(state);
  return {
    id,
    settings: state.settings,
    rules: state.rules,
    phase: state.phase,
    round: state.round,
    revision: state.revision,
    viewer,
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
    mapBuildError,
    mapRoomId: state.mapRoomId,
  };
}

export async function getBagMapAccess(id: string, key?: string) {
  const { state, credentials, viewer } = loadBagDraft(id, key);
  if (!state.mapRoomId) return undefined;
  if (viewer.isAdmin && !credentials.mapHostToken)
    throw new BagDraftError("The map room's host credentials are missing.");
  return {
    id: state.mapRoomId,
    token: viewer.isAdmin
      ? credentials.mapHostToken
      : viewer.playerId !== undefined
        ? credentials.seatKeys[viewer.playerId]
        : undefined,
  };
}

export async function getBagDraftView(id: string, key?: string) {
  let saved = loadBagDraft(id, key);
  if (
    saved.state.phase === "complete" &&
    !saved.state.mapRoomId &&
    !bagMapBuildError(saved.state)
  ) {
    saved = db.transaction(
      () => {
        const latest = loadBagDraft(id, key);
        if (attachMapRoom(id, latest.state, latest.credentials)) {
          latest.state.revision++;
          saveBagDraft(id, latest.state, latest.credentials);
        }
        return latest;
      },
      { behavior: "immediate" },
    );
  }
  const { state, credentials, viewer } = saved;
  const view = projectBagDraft(id, state, viewer);
  if (viewer.isAdmin) {
    view.seatLinks = state.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      path: `/draft/bag/${id}?key=${credentials.seatKeys[seat.id]}`,
    }));
  }
  return view;
}

export async function mutateBagDraft(
  id: string,
  key: string | undefined,
  action: BagDraftAction,
) {
  db.transaction(
    () => {
      const { state, credentials, viewer } = loadBagDraft(id, key);
      if (!viewer.isAdmin && viewer.playerId === undefined)
        throw new Response("Use your private player link to draft.", {
          status: 403,
        });
      const next = applyBagAction(
        state,
        viewer.playerId,
        action,
        viewer.isAdmin,
      );
      attachMapRoom(id, next, credentials);
      saveBagDraft(id, next, credentials);
    },
    { behavior: "immediate" },
  );
  return getBagDraftView(id, key);
}
