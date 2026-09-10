import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appPath } from "~/utils/appUrl";
import { and, eq } from "drizzle-orm";
import { createCookie } from "react-router";
import { db } from "./config.server";
import { mantisDrafts } from "./schema.server";
import {
  createMantisDraft,
  type MantisSettings,
  type MantisState,
} from "~/draft/mantis/engine";

type RoomData = { draft: MantisState; claims: Record<number, string> };
export const mantisTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newMantisToken = () => randomBytes(32).toString("hex");
export const mantisCookie = (id: string) =>
  createCookie(`mantis-${id}`, {
    httpOnly: true,
    sameSite: "lax",
    path: appPath("/draft/mantis"),
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

export async function readMantisToken(
  id: string,
  request: Request,
): Promise<string | undefined> {
  try {
    const token = await mantisCookie(id).parse(request.headers.get("Cookie"));
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
      ? token
      : undefined;
  } catch {
    return undefined;
  }
}

export function createMantisRoom(settings: MantisSettings) {
  return createMantisRoomFromState(createMantisDraft(settings));
}

export function createMantisRoomFromState(draft: MantisState) {
  const id = randomUUID();
  const token = newMantisToken();
  db.insert(mantisDrafts)
    .values({
      id,
      data: JSON.stringify({ draft, claims: {} } satisfies RoomData),
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
  return { ...row, room: JSON.parse(row.data) as RoomData };
}

export function saveMantisRoom(id: string, revision: number, room: RoomData) {
  const result = db
    .update(mantisDrafts)
    .set({ data: JSON.stringify(room), revision: revision + 1 })
    .where(and(eq(mantisDrafts.id, id), eq(mantisDrafts.revision, revision)))
    .run();
  if (result.changes !== 1)
    throw new Error("Another player changed the draft. Refresh and try again.");
}
