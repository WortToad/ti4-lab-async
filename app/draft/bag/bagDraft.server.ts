import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "~/drizzle/config.server";
import { bagDrafts } from "~/drizzle/schema.server";
import { systemData } from "~/data/systemData";
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

type Credentials = { adminHash: string; seatKeys: Record<number, string> };

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
      viewer.isAdmin && state.history.length > 0 && state.revision > 0,
    canBuildMap:
      viewer.isAdmin &&
      state.phase === "complete" &&
      state.seats.length >= 4 &&
      state.seats.length <= 8 &&
      state.seats.every((player) => {
        const items = keptBagItems(state, player);
        const tiles = items.filter(
          (item) => item.category === "BLUETILE" || item.category === "REDTILE",
        );
        return (
          items.filter((item) => item.category === "BLUETILE").length === 3 &&
          items.filter((item) => item.category === "REDTILE").length === 2 &&
          tiles.every((item) => item.systemId && systemData[item.systemId])
        );
      }),
  };
}

export async function getCompletedBagDraft(
  id: string,
  key?: string,
): Promise<BagDraftState> {
  const record = getRecord(id);
  const viewer = authenticate(
    JSON.parse(record.credentials) as Credentials,
    key,
  );
  if (!viewer.isAdmin)
    throw new Response("Only the host can start the map build.", {
      status: 403,
    });
  const state = JSON.parse(record.data) as BagDraftState;
  if (state.phase !== "complete")
    throw new BagDraftError(
      "Finish choosing everyone's components before building the map.",
    );
  return state;
}

export async function getBagDraftView(id: string, key?: string) {
  const record = getRecord(id);
  const credentials = JSON.parse(record.credentials) as Credentials;
  const viewer = authenticate(credentials, key);
  const state = JSON.parse(record.data) as BagDraftState;
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
  // Each transition is computed from the latest server state and committed with
  // compare-and-swap, so simultaneous confirmations cannot overwrite each other.
  for (let attempt = 0; attempt < 5; attempt++) {
    const record = getRecord(id);
    const viewer = authenticate(
      JSON.parse(record.credentials) as Credentials,
      key,
    );
    if (!viewer.isAdmin && viewer.playerId === undefined)
      throw new Response("Use your private player link to draft.", {
        status: 403,
      });
    const state = JSON.parse(record.data) as BagDraftState;
    const next = applyBagAction(state, viewer.playerId, action, viewer.isAdmin);
    const result = db
      .update(bagDrafts)
      .set({
        data: JSON.stringify(next),
        revision: next.revision,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(bagDrafts.id, id), eq(bagDrafts.revision, record.revision)))
      .run();
    if (result.changes > 0) return getBagDraftView(id, key);
  }
  throw new BagDraftError(
    "Other players changed the draft at the same time. Please try your selection again.",
  );
}
