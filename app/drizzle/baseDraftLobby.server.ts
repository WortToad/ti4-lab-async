import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createCookie } from "react-router";
import { db } from "./config.server";
import {
  baseDraftLobbies,
  drafts,
  draftStagedSelections,
} from "./schema.server";
import type { Draft } from "~/types";
import type { LobbyView } from "~/draft/lobby";
import type { LobbyOperation } from "~/draft/LobbyPanel";
import {
  newBackupSecret,
  openBackup,
  playerName,
  sealBackup,
  validRecoveryToken,
} from "~/draft/lobby.server";
import { appPath } from "~/utils/appUrl";

type Snapshot = {
  draft: Draft;
  started: boolean;
  paused: boolean;
  staged: (typeof draftStagedSelections.$inferSelect)[];
};
type Checkpoint = {
  id: string;
  label: string;
  createdAt: string;
  state: Snapshot;
  undoable?: boolean;
};
export type BaseLobby = {
  started: boolean;
  paused: boolean;
  adminUuid: string;
  secret: string;
  slots: { id: number; name: string; uuid?: string }[];
  checkpoints: Checkpoint[];
  revision: number;
};
export const baseCookie = (id: string, role: "player" | "admin" = "player") =>
  createCookie(`ti4-base-${role}-${id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: appPath("/"),
    maxAge: 60 * 60 * 24 * 365,
  });

export function createBaseLobby(id: string, draft: Draft) {
  const lobby: BaseLobby = {
    started: false,
    paused: false,
    adminUuid: randomUUID(),
    secret: newBackupSecret(),
    slots: draft.players.map(({ id, name }) => ({ id, name })),
    checkpoints: [],
    revision: 0,
  };
  db.insert(baseDraftLobbies)
    .values({ id, data: JSON.stringify(lobby), revision: 0 })
    .run();
  return lobby.adminUuid;
}
export function getBaseLobby(id: string): BaseLobby | undefined {
  const row = db
    .select()
    .from(baseDraftLobbies)
    .where(eq(baseDraftLobbies.id, id))
    .get();
  return row
    ? ({ ...JSON.parse(row.data), revision: row.revision } as BaseLobby)
    : undefined;
}
export function findBaseRecovery(uuid: string) {
  if (!validRecoveryToken(uuid)) return undefined;
  for (const row of db.select().from(baseDraftLobbies).all()) {
    const lobby = JSON.parse(row.data) as BaseLobby;
    if (lobby.adminUuid === uuid) return { id: row.id, role: "admin" as const };
    if (lobby.slots.some((s) => s.uuid === uuid))
      return { id: row.id, role: "player" as const };
  }
  return undefined;
}
export async function readBaseViewer(id: string, request: Request) {
  const lobby = getBaseLobby(id);
  const parse = async (role: "admin" | "player") => {
    try {
      return await baseCookie(id, role).parse(request.headers.get("Cookie"));
    } catch {
      return undefined;
    }
  };
  const [uuid, adminUuid] = await Promise.all([
    parse("player"),
    parse("admin"),
  ]);
  const slot = validRecoveryToken(uuid)
    ? lobby?.slots.find((s) => s.uuid === uuid)
    : undefined;
  const isAdmin = !!lobby && lobby.adminUuid === adminUuid;
  return {
    isAdmin,
    playerId: slot?.id,
    uuid: slot?.uuid,
    adminUuid: isAdmin ? lobby?.adminUuid : undefined,
  };
}
export async function requireBasePlayer(
  id: string,
  request: Request,
  playerId: number,
) {
  const lobby = getBaseLobby(id);
  if (!lobby) return;
  if (!lobby.started || lobby.paused)
    throw new Response(
      lobby.paused
        ? "The draft is paused."
        : "The admin has not started the draft yet.",
      { status: 409 },
    );
  if ((await readBaseViewer(id, request)).playerId !== playerId)
    throw new Response("Rejoin your own slot to make this pick.", {
      status: 403,
    });
}
export async function requireBaseAdmin(id: string, request: Request) {
  if (getBaseLobby(id) && !(await readBaseViewer(id, request)).isAdmin)
    throw new Response("Only the lobby admin can change previous turns.", {
      status: 403,
    });
}
export function baseLobbyView(
  lobby: BaseLobby,
  viewer: Awaited<ReturnType<typeof readBaseViewer>>,
): LobbyView {
  return {
    started: lobby.started,
    paused: lobby.paused,
    slots: [...lobby.slots]
      .sort((a, b) => a.id - b.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        claimed: !!s.uuid,
        ...(viewer.isAdmin && s.uuid ? { uuid: s.uuid } : {}),
      })),
    ownUuid: viewer.uuid,
    adminUuid: viewer.adminUuid,
    checkpoints: viewer.isAdmin
      ? lobby.checkpoints
          .map(({ id, label, createdAt }) => ({ id, label, createdAt }))
          .reverse()
      : undefined,
  };
}

/** Always project by player ownership; admin status never grants private cards. */
export function projectBaseDraft(draft: Draft, playerId?: number): Draft {
  const result = structuredClone(draft);
  delete result.settings.adminPassword;
  const own = <T>(values: Record<number, T> | undefined): Record<number, T> =>
    playerId !== undefined && values?.[playerId] !== undefined
      ? { [playerId]: values[playerId] }
      : {};
  if (result.stagedSelections)
    for (const phase of Object.keys(
      result.stagedSelections,
    ) as (keyof NonNullable<Draft["stagedSelections"]>)[]) {
      result.stagedSelections[phase] = Object.fromEntries(
        Object.entries(result.stagedSelections[phase] ?? {}).map(
          ([id, value]) => [id, Number(id) === playerId ? value : "__ready__"],
        ),
      );
    }
  if (result.texasDraft) {
    const texas = result.texasDraft;
    texas.factionOptions = own(texas.factionOptions);
    delete texas.factionDrawPile;
    delete texas.initialFactionDrawPile;
    delete texas.initialFactionOptions;
    delete texas.initialTileHands;
    if (texas.tileHands)
      texas.tileHands = {
        blue: own(texas.tileHands.blue),
        red: own(texas.tileHands.red),
      };
    if (texas.tileKeeps)
      texas.tileKeeps = {
        blue: own(texas.tileKeeps.blue),
        red: own(texas.tileKeeps.red),
      };
    texas.playerTiles = own(texas.playerTiles);
    result.selections = result.selections.map((selection) =>
      selection.type === "COMMIT_SIMULTANEOUS" &&
      ["texasBlueKeep1", "texasBlueKeep2", "texasRedKeep"].includes(
        selection.phase,
      )
        ? {
            ...selection,
            selections: selection.selections.filter(
              (s) => s.playerId === playerId,
            ),
          }
        : selection,
    );
  }
  return result;
}

function persist(id: string, lobby: BaseLobby) {
  const changed = db
    .update(baseDraftLobbies)
    .set({ data: JSON.stringify(lobby), revision: lobby.revision + 1 })
    .where(
      and(
        eq(baseDraftLobbies.id, id),
        eq(baseDraftLobbies.revision, lobby.revision),
      ),
    )
    .run();
  if (changed.changes !== 1)
    throw new Response("The lobby changed. Refresh and try again.", {
      status: 409,
    });
  lobby.revision++;
}
function snapshot(id: string, lobby: BaseLobby): Snapshot {
  const row = db.select().from(drafts).where(eq(drafts.id, id)).get();
  if (!row) throw new Response("Draft not found", { status: 404 });
  return {
    draft: JSON.parse(row.data as string),
    started: lobby.started,
    paused: lobby.paused,
    staged: db
      .select()
      .from(draftStagedSelections)
      .where(eq(draftStagedSelections.draftId, id))
      .all(),
  };
}
function checkpoint(
  id: string,
  lobby: BaseLobby,
  label: string,
  undoable = false,
) {
  lobby.checkpoints.push({
    id: randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    state: snapshot(id, lobby),
    undoable,
  });
  if (lobby.checkpoints.length > 150)
    lobby.checkpoints.splice(0, lobby.checkpoints.length - 150);
}
export function saveBaseCheckpoint(id: string, label: string) {
  const lobby = getBaseLobby(id);
  if (!lobby) return;
  checkpoint(id, lobby, label, true);
  persist(id, lobby);
}
function restore(id: string, lobby: BaseLobby, state: Snapshot) {
  if (
    !state?.draft ||
    state.draft.players.length !== lobby.slots.length ||
    !state.draft.players.every((p) => lobby.slots.some((s) => s.id === p.id))
  )
    throw new Error("The saved players do not match this lobby.");
  const draft = structuredClone(state.draft);
  draft.players = draft.players.map((p) => ({
    ...p,
    name: lobby.slots.find((s) => s.id === p.id)!.name,
  }));
  const count = draft.selections.length;
  db.update(drafts)
    .set({
      data: JSON.stringify(draft),
      isComplete: count === draft.pickOrder.length,
      selectionsCount: count,
      progressPercent: draft.pickOrder.length
        ? (100 * count) / draft.pickOrder.length
        : 0,
      imageUrl: null,
      incompleteImageUrl: null,
    })
    .where(eq(drafts.id, id))
    .run();
  db.delete(draftStagedSelections)
    .where(eq(draftStagedSelections.draftId, id))
    .run();
  for (const selection of state.staged)
    db.insert(draftStagedSelections)
      .values({ ...selection, draftId: id })
      .run();
  lobby.started = state.started;
  lobby.paused = state.started;
}
export async function mutateBaseLobby(
  id: string,
  request: Request,
  operation: LobbyOperation,
  expectedRevision?: number,
) {
  const viewer = await readBaseViewer(id, request);
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  return db.transaction(() => {
    const lobby = getBaseLobby(id);
    if (!lobby)
      throw new Error("This older draft does not have a managed lobby.");
    if (
      expectedRevision !== undefined &&
      !["join", "recover", "export"].includes(operation.type) &&
      expectedRevision !== lobby.revision
    )
      throw new Response(
        "The lobby changed. Try again with its latest state.",
        { status: 409 },
      );
    let issued: { uuid: string; role: "player" | "admin" } | undefined;
    let backup: string | undefined;
    const slot =
      "playerId" in operation
        ? lobby.slots.find((s) => s.id === operation.playerId)
        : undefined;
    if (operation.type === "recover") {
      const uuid = operation.uuid.trim().toLowerCase();
      if (!validRecoveryToken(uuid))
        throw new Error("Enter a valid recovery UUID.");
      if (uuid === lobby.adminUuid) issued = { uuid, role: "admin" };
      else if (lobby.slots.some((s) => s.uuid === uuid))
        issued = { uuid, role: "player" };
      else
        throw new Error(
          "That UUID does not belong to this lobby. Ask the admin for your UUID.",
        );
    } else if (operation.type === "join") {
      if (viewer.playerId !== undefined)
        throw new Error("You already have a slot in this lobby.");
      if (!slot || slot.uuid)
        throw new Error("That slot has been taken. Choose an available slot.");
      slot.name = playerName(operation.name);
      slot.uuid = randomUUID();
      issued = { uuid: slot.uuid, role: "player" };
    } else {
      if (!viewer.isAdmin)
        throw new Response("Only the admin can manage this lobby.", {
          status: 403,
        });
      switch (operation.type) {
        case "start":
          if (lobby.started) throw new Error("The draft has already started.");
          if (lobby.slots.some((s) => !s.uuid))
            throw new Error("Every player must join before you start.");
          checkpoint(id, lobby, "Before starting", true);
          lobby.started = true;
          break;
        case "pause":
          lobby.paused = true;
          break;
        case "resume":
          if (lobby.slots.some((s) => !s.uuid))
            throw new Error("Fill all slots before resuming.");
          lobby.paused = false;
          break;
        case "checkpoint":
          checkpoint(
            id,
            lobby,
            `Saved at turn ${snapshot(id, lobby).draft.selections.length + 1}`,
          );
          break;
        case "release":
          if (!slot) throw new Error("Choose a player.");
          delete slot.uuid;
          if (lobby.started) lobby.paused = true;
          break;
        case "rotate":
          if (!slot?.uuid) throw new Error("Choose a joined player.");
          slot.uuid = randomUUID();
          break;
        case "rename":
          if (!slot) throw new Error("Choose a player.");
          slot.name = playerName(operation.name);
          break;
        case "undo": {
          const saved = [...lobby.checkpoints]
            .reverse()
            .find((saved) => saved.undoable);
          if (!saved) throw new Error("There are no earlier actions to undo.");
          checkpoint(id, lobby, "Before undoing action");
          saved.undoable = false;
          restore(id, lobby, saved.state);
          break;
        }
        case "restore": {
          const saved = lobby.checkpoints.find(
            (c) => c.id === operation.checkpointId,
          );
          if (!saved)
            throw new Error("This checkpoint is no longer available.");
          checkpoint(id, lobby, "Before restoring checkpoint");
          lobby.checkpoints.forEach((saved) => {
            saved.undoable = false;
          });
          restore(id, lobby, saved.state);
          break;
        }
        case "export": {
          const state = operation.checkpointId
            ? lobby.checkpoints.find((c) => c.id === operation.checkpointId)
                ?.state
            : snapshot(id, lobby);
          if (!state) throw new Error("Choose an available checkpoint.");
          backup = sealBackup("base", id, lobby.secret, state);
          break;
        }
        case "import": {
          const saved = openBackup<Snapshot>(
            "base",
            id,
            lobby.secret,
            operation.state,
          );
          checkpoint(id, lobby, "Before importing save");
          lobby.checkpoints.forEach((saved) => {
            saved.undoable = false;
          });
          restore(id, lobby, saved);
          break;
        }
        default:
          throw new Error("Unknown lobby operation.");
      }
    }
    if (operation.type !== "recover" && operation.type !== "export") {
      const row = db.select().from(drafts).where(eq(drafts.id, id)).get()!;
      const draft = JSON.parse(row.data as string) as Draft;
      draft.players = draft.players.map((p) => ({
        ...p,
        name: lobby.slots.find((s) => s.id === p.id)!.name,
      }));
      db.update(drafts)
        .set({
          data: JSON.stringify(draft),
          playerNames: draft.players.map((p) => p.name).join(", "),
          playerNamesSearch: draft.players
            .map((p) => p.name)
            .join(", ")
            .toLowerCase(),
        })
        .where(eq(drafts.id, id))
        .run();
      persist(id, lobby);
    }
    return { issued, backup, headers };
  });
}
