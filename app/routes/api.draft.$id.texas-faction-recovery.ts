import { data, type ActionFunctionArgs } from "react-router";
import { withBaseDraftLock } from "~/draft/baseDraftLock.server";
import { getSelectedFactions } from "~/draft/keleres";
import { replaceTexasConflictingFaction } from "~/draft/texas/factionConflict";
import {
  projectBaseDraft,
  readBaseViewer,
  requireBasePlayer,
} from "~/drizzle/baseDraftLobby.server";
import {
  draftById,
  getDraftStagedSelections,
  transactBaseDraft,
  updateDraft,
} from "~/drizzle/baseDraftMutations.server";
import type { Draft } from "~/types";
import { broadcastDraftUpdate } from "~/websocket/broadcast.server";

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
export function headers() {
  return privateHeaders;
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const id = params.id;
    if (!id) throw new Response("Draft not found", { status: 404 });
    const { playerId, value, expectedSelectionCount, expectedFaction } =
      await request.json();
    if (
      !Number.isInteger(playerId) ||
      typeof value !== "string" ||
      !value ||
      value.length > 120 ||
      !Number.isInteger(expectedSelectionCount) ||
      expectedSelectionCount < 0 ||
      typeof expectedFaction !== "string"
    )
      throw new Error("Choose a replacement for your own revealed faction.");
    await requireBasePlayer(id, request, playerId);
    const viewer = await readBaseViewer(id, request);
    const draft = await withBaseDraftLock(id, async () =>
      transactBaseDraft(id, viewer, { playerId }, () => {
        const row = draftById(id);
        if (!row) throw new Response("Draft not found", { status: 404 });
        const current = JSON.parse(row.data as string) as Draft;
        const { primary } = getSelectedFactions(current.selections);
        if (
          expectedSelectionCount !== current.selections.length ||
          expectedFaction !== primary[playerId]
        )
          throw new Response(
            "The draft changed. Review the latest faction choices before trying again.",
            { status: 409 },
          );
        const next = replaceTexasConflictingFaction(current, playerId, value);
        updateDraft(id, next, row.data as string);
        return { ...next, stagedSelections: getDraftStagedSelections(id) };
      }),
    );
    await broadcastDraftUpdate(id, draft);
    return data(
      { success: true, draft: projectBaseDraft(draft, playerId) },
      { headers: privateHeaders },
    );
  } catch (error) {
    return data(
      {
        success: false,
        error:
          error instanceof Response
            ? await error.text()
            : error instanceof Error
              ? error.message
              : "Could not replace the conflicting faction. Please try again.",
      },
      {
        status: error instanceof Response ? error.status : 400,
        headers: privateHeaders,
      },
    );
  }
}
