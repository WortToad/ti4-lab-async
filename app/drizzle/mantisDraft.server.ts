import { createHash, randomUUID } from "node:crypto";
import { appPath } from "~/utils/appUrl";
import { and, eq } from "drizzle-orm";
import { createCookie } from "react-router";
import { db } from "./config.server";
import { mantisDrafts } from "./schema.server";
import { newBackupSecret, validRecoveryToken } from "~/draft/lobby.server";
import {
  createMantisDraft,
  type MantisSettings,
  type MantisState,
} from "~/draft/mantis/engine";

export type MantisRoomData = {
  draft: MantisState;
  claims: Record<number, string>;
  lobby: {
    started: boolean;
    paused: boolean;
    seatKeys: Record<number, string>;
    adminUuid?: string;
    backupSecret: string;
    checkpoints?: {
      id: string;
      label: string;
      createdAt: string;
      draft: MantisState;
    }[];
  };
};
export const mantisTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newMantisToken = () => randomUUID();
const roomCookie = (name: string) =>
  createCookie(name, {
    httpOnly: true,
    sameSite: "lax",
    path: appPath("/draft/mantis"),
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
export const mantisCookie = (id: string) => roomCookie(`mantis-${id}`);
export const mantisAdminCookie = (id: string) =>
  roomCookie(`mantis-admin-${id}`);

export async function readMantisToken(
  id: string,
  request: Request,
): Promise<string | undefined> {
  try {
    const token = await mantisCookie(id).parse(request.headers.get("Cookie"));
    return validRecoveryToken(token) ? token : undefined;
  } catch {
    return undefined;
  }
}

export async function readMantisAdminToken(id: string, request: Request) {
  try {
    const token = await mantisAdminCookie(id).parse(
      request.headers.get("Cookie"),
    );
    if (validRecoveryToken(token)) return token;
  } catch {
    /* Ignore invalid cookies. */
  }
  // Older rooms used one cookie for either the host or a player.
  return readMantisToken(id, request);
}

export function createMantisRoom(settings: MantisSettings) {
  return insertMantisRoom(createMantisDraft(settings), {}, {}, false);
}

export function createMantisRoomFromState(
  draft: MantisState,
  claims: Record<number, string> = {},
  access: { seatKeys?: Record<number, string>; adminUuid?: string } = {},
) {
  return insertMantisRoom(draft, claims, access, true);
}

function insertMantisRoom(
  draft: MantisState,
  claims: Record<number, string>,
  access: { seatKeys?: Record<number, string>; adminUuid?: string },
  started: boolean,
) {
  const id = randomUUID();
  const token = access.adminUuid ?? newMantisToken();
  const lobby: MantisRoomData["lobby"] = {
    started,
    paused: false,
    seatKeys: access.seatKeys ?? {},
    adminUuid: token,
    backupSecret: newBackupSecret(),
  };
  db.insert(mantisDrafts)
    .values({
      id,
      data: JSON.stringify({ draft, claims, lobby } satisfies MantisRoomData),
      revision: 0,
      hostTokenHash: mantisTokenHash(token),
    })
    .run();
  return { id, token };
}

export function getMantisRoom(id: string) {
  const row = db
    .select()
    .from(mantisDrafts)
    .where(eq(mantisDrafts.id, id))
    .get();
  if (!row) throw new Response("Mantis draft not found", { status: 404 });
  const room = JSON.parse(row.data) as MantisRoomData;
  if (!room.lobby) {
    room.lobby = {
      started: true,
      paused: false,
      seatKeys: {},
      backupSecret: newBackupSecret(),
    };
    const migrated = db
      .update(mantisDrafts)
      .set({ data: JSON.stringify(room) })
      .where(
        and(
          eq(mantisDrafts.id, id),
          eq(mantisDrafts.revision, row.revision),
          eq(mantisDrafts.data, row.data),
        ),
      )
      .run();
    if (!migrated.changes) return getMantisRoom(id);
  }
  return { ...row, room };
}

export function findMantisRecovery(
  uuid: string,
):
  | { id: string; token: string; role: "player" | "admin"; playerId?: number }
  | undefined {
  if (!validRecoveryToken(uuid)) return undefined;
  const hash = mantisTokenHash(uuid);
  for (const row of db.select().from(mantisDrafts).all()) {
    if (row.hostTokenHash === hash)
      return { id: row.id, token: uuid, role: "admin" };
    const room = JSON.parse(row.data) as MantisRoomData;
    const player = Object.entries(room.claims).find(
      ([, claim]) => claim === hash,
    );
    if (player)
      return {
        id: row.id,
        token: uuid,
        role: "player",
        playerId: Number(player[0]),
      };
  }
  return undefined;
}

export const findMantisLobby = findMantisRecovery;

export function saveMantisRoom(
  id: string,
  revision: number,
  room: MantisRoomData,
) {
  const result = db
    .update(mantisDrafts)
    .set({ data: JSON.stringify(room), revision: revision + 1 })
    .where(and(eq(mantisDrafts.id, id), eq(mantisDrafts.revision, revision)))
    .run();
  if (result.changes !== 1)
    throw new Error("Another player changed the draft. Refresh and try again.");
}
