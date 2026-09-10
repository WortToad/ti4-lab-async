import { data, type ActionFunctionArgs } from "react-router";
import { withBaseDraftLock } from "~/draft/baseDraftLock.server";
import { chooseBaseKeleresHome } from "~/draft/keleres";
import {
  projectBaseDraft,
  readBaseViewer,
  requireBasePlayer,
} from "~/drizzle/baseDraftLobby.server";
import {
  draftById,
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
    const id = params.id!;
    const { playerId, home, expectedSelectionCount } = await request.json();
    if (!Number.isInteger(playerId) || typeof home !== "string")
      throw new Error("Choose your Keleres home system.");
    await requireBasePlayer(id, request, playerId);
    const viewer = await readBaseViewer(id, request);
    const draft = await withBaseDraftLock(id, async () =>
      transactBaseDraft(id, viewer, { playerId }, () => {
        const row = draftById(id);
        if (!row) throw new Response("Draft not found", { status: 404 });
        const current = JSON.parse(row.data as string) as Draft;
        if (expectedSelectionCount !== current.selections.length)
          throw new Response(
            "The draft changed. Refresh before choosing your home.",
            { status: 409 },
          );
        const next = chooseBaseKeleresHome(current, playerId, home);
        updateDraft(id, next, row.data as string);
        return next;
      }),
    );
    await broadcastDraftUpdate(id, draft);
    return data(
      { success: true, draft: projectBaseDraft(draft, viewer.playerId) },
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
              : "Could not choose the home system.",
      },
      {
        status: error instanceof Response ? error.status : 400,
        headers: privateHeaders,
      },
    );
  }
}
