import { ActionFunctionArgs, data } from "react-router";
import { withBaseDraftLock } from "~/draft/baseDraftLock.server";
import {
  projectBaseDraft,
  readBaseViewer,
  requireBasePlayer,
  saveBaseCheckpoint,
} from "~/drizzle/baseDraftLobby.server";
import {
  deleteStagedSelection,
  draftById,
  getDraftStagedSelections,
  transactBaseDraft,
} from "~/drizzle/baseDraftMutations.server";
import { Draft, PlayerId, SimultaneousPickType } from "~/types";
import { broadcastDraftUpdate } from "~/websocket/broadcast.server";

type UndoPickBody = {
  phase: SimultaneousPickType;
  playerId: PlayerId;
};

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
export function headers() {
  return privateHeaders;
}

export async function action(args: ActionFunctionArgs) {
  try {
    const result = await withBaseDraftLock(args.params.id ?? "", () =>
      handleAction(args),
    );
    if ("draft" in result.data)
      await broadcastDraftUpdate(args.params.id!, result.data.draft);
    return data(result.data, { ...result.init, headers: privateHeaders });
  } catch (error) {
    return data(
      {
        success: false,
        error:
          error instanceof Response
            ? await error.text()
            : error instanceof Error
              ? error.message
              : "Unable to save this draft. Refresh and try again.",
      },
      {
        status: error instanceof Response ? error.status : 400,
        headers: privateHeaders,
      },
    );
  }
}

async function handleAction({ request, params }: ActionFunctionArgs) {
  const { id } = params;
  if (!id) {
    return data(
      { success: false, error: "Draft ID is required" },
      { status: 400 },
    );
  }

  const body = (await request.json()) as UndoPickBody;

  if (!body?.phase || body.playerId === undefined) {
    return data(
      { success: false, error: "Phase and player ID are required" },
      { status: 400 },
    );
  }

  await requireBasePlayer(id, request, body.playerId);
  const viewer = await readBaseViewer(id, request);
  return transactBaseDraft(id, viewer, { playerId: body.playerId }, () => {
    const existingDraft = draftById(id);
    if (!existingDraft) {
      return data(
        { success: false, error: "Draft not found" },
        { status: 404 },
      );
    }

    saveBaseCheckpoint(id, `Before removing staged pick · ${body.phase}`);
    deleteStagedSelection(id, body.phase, body.playerId);

    const latestDraft = draftById(id);
    const latestDraftData = JSON.parse(latestDraft!.data as string) as Draft;
    const stagedSelections = getDraftStagedSelections(id);
    const payload = { ...latestDraftData, stagedSelections };

    return data({
      success: true,
      draft: projectBaseDraft(payload, body.playerId),
      newSelectionCount: payload.selections.length,
    });
  });
}
