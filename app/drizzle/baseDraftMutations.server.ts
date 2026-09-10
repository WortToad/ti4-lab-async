import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./config.server";
import { drafts, draftStagedSelections } from "./schema.server";
import { getBaseLobby, type readBaseViewer } from "./baseDraftLobby.server";
import type { Draft, SimultaneousPickType } from "~/types";
export { updateDraft } from "./draft.server";

type Viewer = Awaited<ReturnType<typeof readBaseViewer>>;

/** Keep draft, staged picks, and recovery checkpoints in one SQLite commit. */
export function transactBaseDraft<T>(
  id: string,
  viewer: Viewer,
  access: { admin: true } | { playerId: number },
  operation: () => T,
): T {
  return db.transaction(
    () => {
      const lobby = getBaseLobby(id);
      if (lobby) {
        if ("admin" in access) {
          if (!viewer.isAdmin || viewer.adminUuid !== lobby.adminUuid)
            throw new Response(
              "Only the lobby admin can change previous turns.",
              { status: 403 },
            );
        } else {
          if (!lobby.started || lobby.paused)
            throw new Response(
              lobby.paused
                ? "The draft is paused."
                : "The admin has not started the draft yet.",
              { status: 409 },
            );
          if (
            viewer.playerId !== access.playerId ||
            !viewer.uuid ||
            lobby.slots.find((slot) => slot.id === access.playerId)?.uuid !==
              viewer.uuid
          )
            throw new Response("Rejoin your own slot to make this pick.", {
              status: 403,
            });
        }
      }
      return operation();
    },
    { behavior: "immediate" },
  );
}

export function draftById(id: string) {
  return db.select().from(drafts).where(eq(drafts.id, id)).get();
}
export function upsertStagedSelection(
  draftId: string,
  phase: SimultaneousPickType,
  playerId: number,
  value: string,
) {
  db.insert(draftStagedSelections)
    .values({ id: randomUUID(), draftId, phase, playerId, value })
    .onConflictDoUpdate({
      target: [
        draftStagedSelections.draftId,
        draftStagedSelections.phase,
        draftStagedSelections.playerId,
      ],
      set: { value },
    })
    .run();
}
export function getStagedSelections(
  draftId: string,
  phase: SimultaneousPickType,
): Record<number, string> {
  return Object.fromEntries(
    db
      .select()
      .from(draftStagedSelections)
      .where(
        and(
          eq(draftStagedSelections.draftId, draftId),
          eq(draftStagedSelections.phase, phase),
        ),
      )
      .all()
      .map((row) => [row.playerId, row.value]),
  );
}
export function getDraftStagedSelections(
  draftId: string,
): NonNullable<Draft["stagedSelections"]> {
  const result: NonNullable<Draft["stagedSelections"]> = {};
  for (const row of db
    .select()
    .from(draftStagedSelections)
    .where(eq(draftStagedSelections.draftId, draftId))
    .all())
    (result[row.phase as SimultaneousPickType] ??= {})[row.playerId] =
      row.value;
  return result;
}
export function clearStagedSelections(
  draftId: string,
  phase: SimultaneousPickType,
) {
  db.delete(draftStagedSelections)
    .where(
      and(
        eq(draftStagedSelections.draftId, draftId),
        eq(draftStagedSelections.phase, phase),
      ),
    )
    .run();
}
export function deleteStagedSelection(
  draftId: string,
  phase: SimultaneousPickType,
  playerId: number,
) {
  db.delete(draftStagedSelections)
    .where(
      and(
        eq(draftStagedSelections.draftId, draftId),
        eq(draftStagedSelections.phase, phase),
        eq(draftStagedSelections.playerId, playerId),
      ),
    )
    .run();
}
