import { useFetcher } from "react-router";
import { createContext, useContext, useEffect } from "react";
import { draftStore } from "~/draftStore";
import { notifications } from "@mantine/notifications";
import { FactionId, PlayerId, SimultaneousPickType } from "~/types";
import { useDraftApiMutation } from "./useDraftApiMutation";

type UndoResult = { success: boolean; removedSelection?: unknown };

type SyncDraftContextValue = {
  syncDraft: () => Promise<void>;
  stagePriorityValue: (_: PlayerId, __: FactionId) => Promise<void>;
  stageHomeSystem: (_: PlayerId, __: FactionId) => Promise<void>;
  stageSimultaneousPick: (
    _: SimultaneousPickType,
    __: PlayerId,
    ___: string,
  ) => Promise<void>;
  undoStagedPick: (
    _: SimultaneousPickType,
    __: PlayerId,
  ) => Promise<UndoResult>;
  undoSimultaneousPhase: (_: SimultaneousPickType) => Promise<UndoResult>;
  undoLastPick: () => Promise<UndoResult>;
  syncing: boolean;
};

export function useSyncDraft() {
  const {
    syncDraft,
    syncing,
    stagePriorityValue,
    stageHomeSystem,
    stageSimultaneousPick,
    undoStagedPick,
    undoSimultaneousPhase,
    undoLastPick,
  } = useContext(SyncDraftContext);
  return {
    syncDraft,
    syncing,
    stagePriorityValue,
    stageHomeSystem,
    stageSimultaneousPick,
    undoStagedPick,
    undoSimultaneousPhase,
    undoLastPick,
  };
}

export function useSyncDraftFetcher() {
  const fetcher = useFetcher({ key: "sync-draft" });
  const mutation = useDraftApiMutation();

  useEffect(() => {
    const data = fetcher.data as {
      success: boolean;
      error?: string;
      message?: string;
      discordError?: boolean;
      discordMessage?: string;
      serverSelectionCount?: number;
      clientSelectionCount?: number;
    };

    if (data?.success === false) {
      // Handle out-of-sync error specifically
      if (data.error === "out_of_sync") {
        notifications.show({
          id: "out-of-sync-error",
          title: "Draft Out of Sync",
          message: `${data.message} (Server: ${data.serverSelectionCount} picks, Your client: ${data.clientSelectionCount} picks). Refreshing...`,
          color: "orange",
          autoClose: 3000,
        });
        // Delay refresh slightly so user sees the notification
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // Other errors - just reload
        window.location.reload();
      }
    }
  }, [fetcher.data]);

  const stageSimultaneousPick = async (
    phase: SimultaneousPickType,
    playerId: PlayerId,
    value: string,
  ) => {
    const { draftId } = draftStore.getState();
    if (!draftId) return;

    const result = await mutation.submit(`/api/draft/${draftId}/stage`, {
      playerId,
      value,
      phase,
    });

    if (!result.success) {
      const error = result;
      console.error("Failed to stage pick:", error);
      notifications.show({
        title: "Error",
        message: error.error || "Failed to stage selection",
        color: "red",
      });
      return;
    }
  };

  return {
    syncDraft: async () => {
      const { draft, draftId } = draftStore.getState();
      if (!draft || !draftId) return;

      fetcher.submit(
        { id: draftId, draft },
        { method: "POST", encType: "application/json" },
      );
    },
    stagePriorityValue: async (playerId: PlayerId, factionId: FactionId) => {
      await stageSimultaneousPick("priorityValue", playerId, factionId);
    },
    stageHomeSystem: async (playerId: PlayerId, factionId: FactionId) => {
      await stageSimultaneousPick("homeSystem", playerId, factionId);
    },
    stageSimultaneousPick,
    undoStagedPick: async (phase: SimultaneousPickType, playerId: PlayerId) => {
      const { draftId } = draftStore.getState();
      if (!draftId) return { success: false };

      const result = await mutation.submit(
        `/api/draft/${draftId}/simultaneous-undo-pick`,
        { phase, playerId },
      );

      if (!result.success) {
        const error = result;
        console.error("Failed to undo staged pick:", error);
        notifications.show({
          title: "Error",
          message: error.error || "Failed to undo staged pick",
          color: "red",
        });
        return { success: false };
      }

      notifications.show({
        title: "Pick Undone",
        message: "The staged pick has been removed.",
        color: "green",
        autoClose: 3000,
      });
      return { success: true };
    },
    undoSimultaneousPhase: async (phase: SimultaneousPickType) => {
      const { draftId, draft } = draftStore.getState();
      if (!draftId || !draft) return { success: false };

      const expectedSelectionCount = draft.selections.length;

      const result = await mutation.submit(
        `/api/draft/${draftId}/simultaneous-undo-phase`,
        { phase, expectedSelectionCount },
      );

      if (!result.success) {
        const error = result;
        console.error("Failed to undo phase:", error);

        if (error.error === "out_of_sync") {
          notifications.show({
            title: "Cannot Undo - Out of Sync",
            message: `${error.message} Refreshing...`,
            color: "orange",
            autoClose: 3000,
          });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          notifications.show({
            title: "Error",
            message: error.error || "Failed to undo phase",
            color: "red",
          });
        }
        return { success: false };
      }

      notifications.show({
        title: "Phase Undone",
        message: "The simultaneous phase has been cleared.",
        color: "green",
        autoClose: 3000,
      });
      return { success: true, removedSelection: result.removedSelection };
    },
    undoLastPick: async () => {
      const { draftId, draft } = draftStore.getState();
      if (!draftId || !draft) return { success: false };

      const expectedSelectionCount = draft.selections.length;

      const result = await mutation.submit(`/api/draft/${draftId}/undo`, {
        expectedSelectionCount,
      });

      if (!result.success) {
        const error = result;
        console.error("Failed to undo:", error);

        if (error.error === "out_of_sync") {
          notifications.show({
            title: "Cannot Undo - Out of Sync",
            message: `${error.message} Refreshing...`,
            color: "orange",
            autoClose: 3000,
          });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          notifications.show({
            title: "Error",
            message: error.error || "Failed to undo last pick",
            color: "red",
          });
        }
        return { success: false };
      }

      notifications.show({
        title: "Pick Undone",
        message: "The last selection has been removed.",
        color: "green",
        autoClose: 3000,
      });
      return { success: true, removedSelection: result.removedSelection };
    },
    syncing: fetcher.state !== "idle" || mutation.busy,
  };
}

export const SyncDraftContext = createContext<SyncDraftContextValue>({
  syncDraft: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stagePriorityValue: async (_: PlayerId, __: FactionId) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stageHomeSystem: async (_: PlayerId, __: FactionId) => {},
  stageSimultaneousPick: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  undoStagedPick: async (_: SimultaneousPickType, __: PlayerId) => ({
    success: false,
  }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  undoSimultaneousPhase: async (_: SimultaneousPickType) => ({
    success: false,
  }),
  undoLastPick: async () => ({ success: false }),
  syncing: false,
});
