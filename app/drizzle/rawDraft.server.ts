import { createHash, randomUUID } from "node:crypto";
import { appPath } from "~/utils/appUrl";
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
import type { LobbyView } from "~/draft/lobby";
import {
  newBackupSecret,
  openBackup,
  playerName,
  sealBackup,
  validRecoveryToken,
} from "~/draft/lobby.server";

type RawCheckpoint = {
  id: string;
  label: string;
  createdAt: string;
  draft: RawState;
  started: boolean;
};
type RawLobby = {
  started: boolean;
  paused: boolean;
  seatKeys: Record<number, string>;
  adminUuid?: string;
  backupSecret: string;
  checkpoints: RawCheckpoint[];
};
type RoomData = {
  draft: RawState;
  claims: Record<number, string>;
  lobby: RawLobby;
};
const makeLobby = (started: boolean, adminUuid?: string): RawLobby => ({
  started,
  paused: false,
  seatKeys: {},
  adminUuid,
  backupSecret: newBackupSecret(),
  checkpoints: [],
});
const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
function checkpoint(room: RoomData, label: string) {
  room.lobby.checkpoints.push({
    id: randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    draft: structuredClone(room.draft),
    started: room.lobby.started,
  });
  if (room.lobby.checkpoints.length > 250) room.lobby.checkpoints.shift();
}

export const rawTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newRawToken = () => randomUUID();
export const rawCookie = (id: string, role: "player" | "admin" = "player") =>
  createCookie(role === "admin" ? `raw-admin-${id}` : `raw-${id}`, {
    httpOnly: true,
    sameSite: "lax",
    path: appPath("/draft/raw"),
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

export async function readRawToken(
  id: string,
  request: Request,
  role: "player" | "admin" = "player",
): Promise<string | undefined> {
  try {
    const token = await rawCookie(id, role).parse(
      request.headers.get("Cookie"),
    );
    return validRecoveryToken(token) ? token : undefined;
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
      data: JSON.stringify({
        draft,
        claims: {},
        lobby: makeLobby(false, token),
      } satisfies RoomData),
      revision: 0,
      hostTokenHash: rawTokenHash(token),
    })
    .run();
  return { id, token };
}

export function getRawRoom(
  id: string,
): typeof rawDrafts.$inferSelect & { room: RoomData } {
  const row = db.select().from(rawDrafts).where(eq(rawDrafts.id, id)).get();
  if (!row)
    throw new Response("Rules as written draft not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const room = JSON.parse(row.data) as RoomData;
  if (!room.lobby) {
    room.lobby = makeLobby(true);
    const migrated = db
      .update(rawDrafts)
      .set({ data: JSON.stringify(room) })
      .where(
        and(
          eq(rawDrafts.id, id),
          eq(rawDrafts.revision, row.revision),
          eq(rawDrafts.data, row.data),
        ),
      )
      .run();
    if (!migrated.changes) return getRawRoom(id);
  }
  return { ...row, room };
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
  const adminToken = await readRawToken(record.id, request, "admin");
  const isHost =
    hash === record.hostTokenHash ||
    (!!adminToken && rawTokenHash(adminToken) === record.hostTokenHash);
  const ownPlayers = Object.entries(record.room.claims)
    .filter(([, ownerHash]) => ownerHash === hash)
    .map(([id]) => Number(id));
  const canReadPlayer = (id: number) => ownPlayers.includes(id);
  // Upgrade legacy cookie-only owners without granting any new access.
  let upgraded = false;
  if (isHost && !record.room.lobby.adminUuid) {
    record.room.lobby.adminUuid = adminToken ?? token;
    upgraded = true;
  }
  for (const id of ownPlayers)
    if (!record.room.lobby.seatKeys[id] && token) {
      record.room.lobby.seatKeys[id] = token;
      upgraded = true;
    }
  if (upgraded) {
    const migrated = db
      .update(rawDrafts)
      .set({ data: JSON.stringify(record.room) })
      .where(
        and(
          eq(rawDrafts.id, record.id),
          eq(rawDrafts.revision, record.revision),
          eq(rawDrafts.data, record.data),
        ),
      )
      .run();
    if (!migrated.changes) upgraded = false;
  }
  const lobby: LobbyView = {
    started: record.room.lobby.started,
    paused: record.room.lobby.paused,
    slots: [...record.room.draft.players]
      .sort((a, b) => a.id - b.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        claimed: !!record.room.claims[p.id],
        ...(isHost ? { uuid: record.room.lobby.seatKeys[p.id] } : {}),
      })),
    ownUuid: ownPlayers.length ? token : undefined,
    ...(isHost
      ? {
          adminUuid: record.room.lobby.adminUuid,
          checkpoints: record.room.lobby.checkpoints.map(
            ({ id, label, createdAt }) => ({ id, label, createdAt }),
          ),
        }
      : {}),
  };
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
      draft: lobby.started ? draft : null,
      lobby,
      canUndo: state.history.length > 0,
      isHost,
      ownPlayers,
      claimedPlayers: Object.keys(record.room.claims).map(Number),
      handCounts: Object.fromEntries(
        state.players.map(({ id }) => [id, state.hands[id]?.length ?? 0]),
      ),
      preplaceCount: lobby.started ? state.preplace.length : 0,
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
    { headers: privateHeaders },
  );
}

export function findRawRecovery(
  uuid: string,
): { id: string; role: "player" | "admin" } | undefined {
  if (!validRecoveryToken(uuid)) return undefined;
  const hash = rawTokenHash(uuid);
  for (const row of db.select().from(rawDrafts).all()) {
    if (row.hostTokenHash === hash) return { id: row.id, role: "admin" };
    const room = JSON.parse(row.data) as RoomData;
    if (Object.values(room.claims).includes(hash))
      return { id: row.id, role: "player" };
  }
}

export async function actRawRoom({ request, params }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const storedToken = await readRawToken(params.id!, request);
    const adminToken = await readRawToken(params.id!, request, "admin");
    const hash = storedToken ? rawTokenHash(storedToken) : "";
    const intent = String(form.get("intent"));
    const playerId = Number(form.get("playerId"));
    const result = db.transaction(
      () => {
        const record = getRawRoom(params.id!);
        const { room } = record;
        const isHost =
          hash === record.hostTokenHash ||
          (!!adminToken && rawTokenHash(adminToken) === record.hostTokenHash);
        if (intent === "recover") {
          const uuid = String(form.get("uuid") ?? "")
            .trim()
            .toLowerCase();
          if (!validRecoveryToken(uuid))
            throw new Error("Enter your saved recovery UUID.");
          const recoveryHash = rawTokenHash(uuid);
          const role: "player" | "admin" | undefined =
            recoveryHash === record.hostTokenHash
              ? "admin"
              : Object.values(room.claims).includes(recoveryHash)
                ? "player"
                : undefined;
          if (!role)
            throw new Error(
              "That UUID does not belong to this lobby. Ask the admin to recover your slot.",
            );
          return { uuid, role };
        }
        if (intent === "export") {
          if (!isHost)
            throw new Error("Only the admin can export recovery saves.");
          const checkpointId = String(form.get("checkpointId") ?? "");
          const saved = checkpointId
            ? room.lobby.checkpoints.find((p) => p.id === checkpointId)
            : { draft: room.draft, started: room.lobby.started };
          if (!saved)
            throw new Error("That checkpoint is no longer available.");
          return {
            backup: sealBackup(
              "raw",
              record.id,
              room.lobby.backupSecret,
              saved,
            ),
          };
        }
        if (
          intent !== "join" &&
          Number(form.get("revision")) !== record.revision
        )
          throw new Error(
            "Another player changed the draft. Wait for the latest state and try again.",
          );
        let token: string | undefined;
        if (intent === "join") {
          if (Object.values(room.claims).includes(hash))
            throw new Error(
              "You already have a slot. Rejoin with your saved UUID.",
            );
          const player = [...room.draft.players]
            .sort((a, b) => a.id - b.id)
            .find((p) => !room.claims[p.id]);
          if (!player) throw new Error("This lobby is full.");
          player.name = playerName(form.get("name"));
          room.draft.settings.players.find((p) => p.id === player.id)!.name =
            player.name;
          token = newRawToken();
          room.claims[player.id] = rawTokenHash(token);
          room.lobby.seatKeys[player.id] = token;
        } else if (intent === "pick") {
          if (!hash || room.claims[playerId] !== hash)
            throw new Error("Join as this player before making a pick.");
          if (!room.lobby.started)
            throw new Error("Wait for the admin to start the draft.");
          if (room.lobby.paused)
            throw new Error(
              "The admin paused this draft. Wait for it to resume.",
            );
          const pick = JSON.parse(String(form.get("action"))) as Parameters<
            typeof applyRawAction
          >[1];
          if (
            !pick ||
            typeof pick !== "object" ||
            Array.isArray(pick) ||
            pick.playerId !== playerId
          )
            throw new Error("Choose a valid action for your own player.");
          checkpoint(
            room,
            `Before turn ${room.draft.turn + 1} · ${room.draft.phase}`,
          );
          room.draft = applyRawAction(room.draft, pick);
        } else {
          if (!isHost) throw new Error("Only the admin can manage the lobby.");
          if (intent === "start") {
            if (room.lobby.started)
              throw new Error("The draft has already started.");
            if (!room.draft.players.every((p) => room.claims[p.id]))
              throw new Error("Every slot must be claimed before starting.");
            checkpoint(room, "Before starting the draft");
            room.lobby.started = true;
          } else if (intent === "pause" || intent === "resume") {
            if (!room.lobby.started) throw new Error("Start the draft first.");
            if (
              intent === "resume" &&
              !room.draft.players.every((p) => room.claims[p.id])
            )
              throw new Error("Fill every released slot before resuming.");
            room.lobby.paused = intent === "pause";
          } else if (
            intent === "release" ||
            intent === "rotate" ||
            intent === "rename"
          ) {
            const player = room.draft.players.find((p) => p.id === playerId);
            if (!player) throw new Error("Choose a valid slot.");
            if (intent === "rename") {
              player.name = playerName(form.get("name"));
              room.draft.settings.players.find((p) => p.id === playerId)!.name =
                player.name;
            } else if (intent === "release") {
              delete room.claims[playerId];
              delete room.lobby.seatKeys[playerId];
              if (room.lobby.started) room.lobby.paused = true;
            } else {
              if (!room.claims[playerId])
                throw new Error("That slot has not been claimed.");
              const uuid = newRawToken();
              room.claims[playerId] = rawTokenHash(uuid);
              room.lobby.seatKeys[playerId] = uuid;
            }
          } else if (intent === "checkpoint") {
            checkpoint(
              room,
              `Saved checkpoint · ${room.draft.phase} · turn ${room.draft.turn + 1}`,
            );
          } else if (intent === "undo" || intent === "undoAction") {
            checkpoint(room, "Recovery point before undo");
            room.draft = undoRawAction(room.draft);
            room.lobby.paused = true;
          } else if (
            intent === "restoreCheckpoint" ||
            intent === "importState"
          ) {
            const saved =
              intent === "importState"
                ? openBackup<{ draft: RawState; started: boolean }>(
                    "raw",
                    record.id,
                    room.lobby.backupSecret,
                    String(form.get("state")),
                  )
                : room.lobby.checkpoints.find(
                    (p) => p.id === String(form.get("checkpointId")),
                  );
            if (
              !saved ||
              saved.draft.players.length !== room.draft.players.length
            )
              throw new Error("Choose a save from this lobby.");
            checkpoint(room, "Recovery point before restoring a save");
            const revision = room.draft.revision;
            const names = Object.fromEntries(
              room.draft.players.map((p) => [p.id, p.name]),
            );
            room.draft = structuredClone(saved.draft);
            room.draft.revision = revision + 1;
            for (const p of room.draft.players) p.name = names[p.id];
            for (const p of room.draft.settings.players) p.name = names[p.id];
            room.lobby.started = saved.started;
            room.lobby.paused = saved.started;
          } else throw new Error("Unknown draft action.");
        }
        saveRawRoom(record.id, record.revision, room);
        return { uuid: token, role: "player" as const };
      },
      { behavior: "immediate" },
    );
    const headers = new Headers(privateHeaders);
    if (
      result.uuid &&
      intent === "join" &&
      storedToken &&
      !adminToken &&
      rawTokenHash(storedToken) === getRawRoom(params.id!).hostTokenHash
    )
      headers.append(
        "Set-Cookie",
        await rawCookie(params.id!, "admin").serialize(storedToken),
      );
    if (result.uuid)
      headers.append(
        "Set-Cookie",
        await rawCookie(params.id!, result.role).serialize(result.uuid),
      );
    return data(
      { success: true, error: null, backup: result.backup ?? null },
      { headers },
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
        backup: null,
      },
      { status: 400, headers: privateHeaders },
    );
  }
}
