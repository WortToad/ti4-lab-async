import { ActionFunctionArgs, data } from "react-router";
import { withBaseDraftLock } from "~/draft/baseDraftLock.server";
import {
  projectBaseDraft,
  readBaseViewer,
  requireBaseAdmin,
  saveBaseCheckpoint,
} from "~/drizzle/baseDraftLobby.server";
import {
  clearStagedSelections,
  draftById,
  getDraftStagedSelections,
  updateDraft,
  transactBaseDraft,
} from "~/drizzle/baseDraftMutations.server";
import { Draft, SimultaneousPickType } from "~/types";
import { broadcastDraftUpdate } from "~/websocket/broadcast.server";
import { rebuildTexasDraftState } from "~/draft/texas/texasDraft";

type UndoPhaseBody = {
  phase: SimultaneousPickType;
  expectedSelectionCount?: number;
};

function applyTexasUndo(
  draft: Draft,
  removedSelection?: Draft["selections"][number],
) {
  if (draft.settings.draftGameMode !== "texasStyle" || !removedSelection) {
    return;
  }

  if (removedSelection.type === "PLACE_TILE" && draft.texasDraft?.playerTiles) {
    const mapTile = draft.presetMap[removedSelection.mapIdx];
    if (mapTile) {
      draft.presetMap[removedSelection.mapIdx] = {
        idx: mapTile.idx,
        position: mapTile.position,
        type: "OPEN",
      };
    }
    draft.texasDraft.playerTiles[removedSelection.playerId] = [
      ...(draft.texasDraft.playerTiles[removedSelection.playerId] ?? []),
      removedSelection.systemId,
    ];
  }

  if (
    removedSelection.type === "COMMIT_SIMULTANEOUS" &&
    (removedSelection.phase === "texasBlueKeep1" ||
      removedSelection.phase === "texasBlueKeep2" ||
      removedSelection.phase === "texasRedKeep" ||
      removedSelection.phase === "texasFaction")
  ) {
    rebuildTexasDraftState(draft);
  }
}

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

  const body = (await request.json()) as UndoPhaseBody;

  if (!body?.phase) {
    return data(
      { success: false, error: "Phase is required" },
      { status: 400 },
    );
  }

  await requireBaseAdmin(id, request);
  const viewer = await readBaseViewer(id, request);
  return transactBaseDraft(id, viewer, { admin: true }, () => {
    const existingDraft = draftById(id);
    if (!existingDraft) {
      return data(
        { success: false, error: "Draft not found" },
        { status: 404 },
      );
    }

    const draft = JSON.parse(existingDraft.data as string) as Draft;

    if (
      body.expectedSelectionCount !== undefined &&
      body.expectedSelectionCount !== draft.selections.length
    ) {
      return data(
        {
          success: false,
          error: "out_of_sync",
          message:
            "Draft state has changed. Please refresh to see the current state before undoing.",
          serverSelectionCount: draft.selections.length,
          expectedSelectionCount: body.expectedSelectionCount,
        },
        { status: 409 },
      );
    }

    saveBaseCheckpoint(id, `Before rewinding phase · ${body.phase}`);
    clearStagedSelections(id, body.phase);

    let removedSelection: Draft["selections"][number] | undefined;
    if (draft.selections.length > 0) {
      removedSelection = draft.selections.pop();
    }

    applyTexasUndo(draft, removedSelection);

    if (removedSelection) {
      updateDraft(id, draft, existingDraft.data as string);
    }

    const latestDraft = draftById(id);
    const latestDraftData = JSON.parse(latestDraft!.data as string) as Draft;
    const stagedSelections = getDraftStagedSelections(id);
    const payload = { ...latestDraftData, stagedSelections };

    return data({
      success: true,
      removedSelection: removedSelection
        ? { type: removedSelection.type }
        : undefined,
      draft: projectBaseDraft(payload, viewer.playerId),
      newSelectionCount: payload.selections.length,
    });
  });
}
