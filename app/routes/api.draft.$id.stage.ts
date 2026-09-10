import { ActionFunctionArgs, data } from "react-router";
import { withBaseDraftLock } from "~/draft/baseDraftLock.server";
import {
  projectBaseDraft,
  readBaseViewer,
  requireBasePlayer,
  saveBaseCheckpoint,
} from "~/drizzle/baseDraftLobby.server";
import {
  clearStagedSelections,
  draftById,
  getDraftStagedSelections,
  getStagedSelections,
  updateDraft,
  upsertStagedSelection,
  transactBaseDraft,
} from "~/drizzle/baseDraftMutations.server";
import {
  Draft,
  FactionId,
  SimultaneousPickType,
  PlayerId,
  PRIORITY_PHASE,
  HOME_PHASE,
} from "~/types";
import { broadcastDraftUpdate } from "~/websocket/broadcast.server";
import {
  TEXAS_REDRAW_VALUE,
  applyTexasFactionCommit,
  applyTexasTileCommit,
} from "~/draft/texas/texasDraft";

function applySimultaneousCommit(
  draft: Draft,
  phase: SimultaneousPickType,
  selections: { playerId: PlayerId; value: string }[],
) {
  if (phase === "texasFaction") {
    const resolved = applyTexasFactionCommit(draft, selections);
    return { selections: resolved };
  }

  if (
    phase === "texasBlueKeep1" ||
    phase === "texasBlueKeep2" ||
    phase === "texasRedKeep"
  ) {
    applyTexasTileCommit(draft, phase, selections);
    return { selections };
  }

  return { selections };
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

  const { playerId, value, phase } = (await request.json()) as {
    playerId: PlayerId;
    value: string;
    phase: SimultaneousPickType;
  };

  if (
    !Number.isInteger(playerId) ||
    typeof value !== "string" ||
    !value ||
    value.length > 120 ||
    !phase
  ) {
    return data(
      { success: false, error: "Player ID, phase, and value are required" },
      { status: 400 },
    );
  }

  await requireBasePlayer(id, request, playerId);
  const viewer = await readBaseViewer(id, request);
  return transactBaseDraft(id, viewer, { playerId: playerId }, () => {
    const existingDraft = draftById(id);
    if (!existingDraft)
      return data(
        { success: false, error: "Draft not found" },
        { status: 404 },
      );
    const draft = JSON.parse(existingDraft.data as string) as Draft;

    const currentPick = draft.pickOrder[draft.selections.length];
    const isLegacyPhase =
      (phase === "priorityValue" && currentPick === PRIORITY_PHASE) ||
      (phase === "homeSystem" && currentPick === HOME_PHASE);

    if (
      !isLegacyPhase &&
      (typeof currentPick !== "object" ||
        currentPick.kind !== "simultaneous" ||
        currentPick.phase !== phase)
    ) {
      return data(
        { success: false, error: "Not in simultaneous selection phase" },
        { status: 400 },
      );
    }

    if (!draft.players.some((player) => player.id === playerId))
      return data(
        { success: false, error: "Choose your own player slot." },
        { status: 400 },
      );
    if (phase === "priorityValue" || phase === "homeSystem") {
      const packSelection = [...draft.selections]
        .reverse()
        .find(
          (selection) =>
            selection.type === "SELECT_REFERENCE_CARD_PACK" &&
            selection.playerId === playerId,
        );
      const pack =
        packSelection?.type === "SELECT_REFERENCE_CARD_PACK"
          ? draft.availableReferenceCardPacks?.[packSelection.packIdx]
          : undefined;
      if (!pack?.includes(value as FactionId))
        return data(
          {
            success: false,
            error: "Choose a faction from your own reference card pack.",
          },
          { status: 400 },
        );
      if (phase === "homeSystem") {
        const priority = [...draft.selections]
          .reverse()
          .find(
            (selection) =>
              selection.type === "COMMIT_PRIORITY_VALUES" ||
              (selection.type === "COMMIT_SIMULTANEOUS" &&
                selection.phase === "priorityValue"),
          );
        const chosen =
          priority?.type === "COMMIT_PRIORITY_VALUES"
            ? priority.selections.find(
                (selection) => selection.playerId === playerId,
              )?.priorityValueFactionId
            : priority?.type === "COMMIT_SIMULTANEOUS"
              ? priority.selections.find(
                  (selection) => selection.playerId === playerId,
                )?.value
              : undefined;
        if (!chosen || chosen === value)
          return data(
            {
              success: false,
              error:
                "Choose a home system card different from your committed priority card.",
            },
            { status: 400 },
          );
      }
    }
    const texas = draft.texasDraft;
    if (
      phase === "texasFaction" &&
      !texas?.factionOptions?.[playerId]?.includes(value as FactionId) &&
      !(
        value === TEXAS_REDRAW_VALUE &&
        draft.settings.texasAllowFactionRedraw !== false
      )
    )
      return data(
        { success: false, error: "Choose a faction offered in your hand." },
        { status: 400 },
      );
    if (
      ["texasBlueKeep1", "texasBlueKeep2", "texasRedKeep"].includes(phase) &&
      !texas?.tileHands?.[phase === "texasRedKeep" ? "red" : "blue"]?.[
        playerId
      ]?.includes(value)
    )
      return data(
        { success: false, error: "Choose a tile offered in your hand." },
        { status: 400 },
      );
    saveBaseCheckpoint(id, `Before staged pick · ${phase}`);
    upsertStagedSelection(id, phase, playerId, value);

    const stagingState = getStagedSelections(id, phase);
    const allPlayersReady = draft.players.every(
      (player) => stagingState[player.id] !== undefined,
    );

    if (allPlayersReady) {
      const selections = draft.players.map((player) => ({
        playerId: player.id,
        value: stagingState[player.id],
      }));

      const { selections: resolvedSelections } = applySimultaneousCommit(
        draft,
        phase,
        selections,
      );

      draft.selections.push({
        type: "COMMIT_SIMULTANEOUS",
        phase,
        selections: resolvedSelections,
      });

      clearStagedSelections(id, phase);
      updateDraft(id, draft, existingDraft.data as string);
    }

    const latestDraft = draftById(id);
    const latestDraftData = JSON.parse(latestDraft!.data as string) as Draft;
    const stagedSelections = getDraftStagedSelections(id);
    const payload = { ...latestDraftData, stagedSelections };

    return data({
      success: true,
      allPlayersReady: !!allPlayersReady,
      draft: projectBaseDraft(payload, playerId),
    });
  });
}
