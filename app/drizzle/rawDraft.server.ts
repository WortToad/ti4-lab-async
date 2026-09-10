import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  createCookie,
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  applyRawAction,
  createRawDraft,
  undoRawAction,
  type RawSettings,
  type RawState,
} from "~/draft/raw/engine";
import { db } from "./config.server";
import { rawDrafts } from "./schema.server";

type RoomData = { draft: RawState; claims: Record<number, string> };

export const rawTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newRawToken = () => randomBytes(32).toString("hex");
export const rawCookie = (id: string) =>
  createCookie(`raw-${id}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/draft/raw",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

export async function readRawToken(
  id: string,
  request: Request,
): Promise<string | undefined> {
  try {
    const token = await rawCookie(id).parse(request.headers.get("Cookie"));
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
      ? token
      : undefined;
  } catch {
    return undefined;
  }
}

export function createRawRoom(settings: RawSettings) {
  const draft = createRawDraft(settings);
  const id = randomUUID();
  const token = newRawToken();
  db.insert(rawDrafts)
    .values({
      id,
      data: JSON.stringify({ draft, claims: {} } satisfies RoomData),
      revision: 0,
      hostTokenHash: rawTokenHash(token),
    })
    .run();
  return { id, token };
}

export function getRawRoom(id: string) {
  const row = db.select().from(rawDrafts).where(eq(rawDrafts.id, id)).get();
  if (!row)
    throw new Response("Rules as written draft not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return { ...row, room: JSON.parse(row.data) as RoomData };
}

export function saveRawRoom(id: string, revision: number, room: RoomData) {
  const result = db
    .update(rawDrafts)
    .set({ data: JSON.stringify(room), revision: revision + 1 })
    .where(and(eq(rawDrafts.id, id), eq(rawDrafts.revision, revision)))
    .run();
  if (result.changes !== 1)
    throw new Error("Another player changed the draft. Refresh and try again.");
}

export async function loadRawRoom({ request, params }: LoaderFunctionArgs) {
  const record = getRawRoom(params.id!);
  const token = await readRawToken(record.id, request);
  const hash = token ? rawTokenHash(token) : "";
  const isHost = hash === record.hostTokenHash;
  const ownPlayers = Object.entries(record.room.claims)
    .filter(([, ownerHash]) => ownerHash === hash)
    .map(([id]) => Number(id));
  const canReadPlayer = (id: number) => isHost || ownPlayers.includes(id);
  const state = record.room.draft;
  const privatePlayers = <T>(values: Record<number, T>) =>
    Object.fromEntries(
      Object.entries(values).filter(([id]) => canReadPlayer(Number(id))),
    ) as Record<number, T>;

  // List public fields explicitly so future state additions stay private by default.
  const draft = {
    version: state.version,
    settings: state.settings,
    revision: state.revision,
    phase: state.phase,
    players: state.players,
    order: state.order,
    speaker: state.speaker,
    map: state.map,
    turn: state.turn,
    factions: state.factions,
    referenceRound: state.referenceRound,
    priorities: state.priorities,
    homes: state.homes,
    fleets: state.fleets,
    kings: state.kings,
    spliceRound: state.spliceRound,
    tradeGoods: state.tradeGoods,
    log: state.log,
    hands: privatePlayers(state.hands),
    preplace: canReadPlayer(state.speaker) ? state.preplace : [],
    references: privatePlayers(state.references),
    splice:
      state.phase === "complete"
        ? Object.fromEntries(
            Object.entries(state.splice).map(([id, hand]) => [
              id,
              canReadPlayer(Number(id))
                ? hand
                : { hand: [], drafted: [], ready: true, kept: hand.kept },
            ]),
          )
        : privatePlayers(state.splice),
  };
  return data(
    {
      id: record.id,
      revision: record.revision,
      draft,
      canUndo: state.history.length > 0,
      isHost,
      ownPlayers,
      claimedPlayers: Object.keys(record.room.claims).map(Number),
      handCounts: Object.fromEntries(
        state.players.map(({ id }) => [id, state.hands[id]?.length ?? 0]),
      ),
      preplaceCount: state.preplace.length,
      referenceHandCounts: Object.fromEntries(
        state.players.map(({ id }) => [
          id,
          state.references[id]?.hand.length ?? 0,
        ]),
      ),
      referenceReady: Object.fromEntries(
        state.players.map(({ id }) => [
          id,
          state.references[id]?.ready ?? false,
        ]),
      ),
      spliceHandCounts: Object.fromEntries(
        state.players.map(({ id }) => [id, state.splice[id]?.hand.length ?? 0]),
      ),
      spliceReady: Object.fromEntries(
        state.players.map(({ id }) => [id, state.splice[id]?.ready ?? false]),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function actRawRoom({ request, params }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const record = getRawRoom(params.id!);
    const submittedRevision = form.get("revision");
    if (
      typeof submittedRevision !== "string" ||
      !/^\d+$/.test(submittedRevision) ||
      Number(submittedRevision) !== record.revision
    )
      throw new Error(
        "Another player changed the draft. Wait for the latest state and try again.",
      );
    const storedToken = await readRawToken(record.id, request);
    const hash = storedToken ? rawTokenHash(storedToken) : "";
    const isHost = hash === record.hostTokenHash;
    const intent = String(form.get("intent"));
    const submittedPlayerId = form.get("playerId");
    const playerId =
      typeof submittedPlayerId === "string" && /^\d+$/.test(submittedPlayerId)
        ? Number(submittedPlayerId)
        : NaN;
    if (intent === "join" || intent === "release" || intent === "pick") {
      if (!record.room.draft.players.some((player) => player.id === playerId))
        throw new Error("Choose a player in the draft.");
    }
    if (intent === "join") {
      if (record.room.claims[playerId] && record.room.claims[playerId] !== hash)
        throw new Error("That player has already joined.");
      const token = storedToken ?? newRawToken();
      record.room.claims[playerId] = rawTokenHash(token);
      saveRawRoom(record.id, record.revision, record.room);
      return data(
        { success: true, error: null },
        {
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": await rawCookie(record.id).serialize(token),
          },
        },
      );
    }
    if (intent === "undo") {
      if (!isHost) throw new Error("Only the draft host can undo actions.");
      record.room.draft = undoRawAction(record.room.draft);
    } else if (intent === "release") {
      if (!isHost) throw new Error("Only the host can release a player slot.");
      delete record.room.claims[playerId];
    } else if (intent === "pick") {
      if (!isHost && (!hash || record.room.claims[playerId] !== hash))
        throw new Error("Join as this player before making a pick.");
      let pick: Parameters<typeof applyRawAction>[1];
      try {
        pick = JSON.parse(String(form.get("action")));
      } catch {
        throw new Error("Invalid draft action.");
      }
      if (!pick || typeof pick !== "object" || Array.isArray(pick))
        throw new Error("Invalid draft action.");
      if (pick.playerId !== playerId)
        throw new Error("The draft action must be for the player you control.");
      record.room.draft = applyRawAction(record.room.draft, pick);
    } else throw new Error("Unknown draft action.");
    saveRawRoom(record.id, record.revision, record.room);
    return data(
      { success: true, error: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    return data(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update the draft.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
