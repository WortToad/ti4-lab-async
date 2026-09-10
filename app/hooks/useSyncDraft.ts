import { useFetcher, useRevalidator } from "react-router";
import { createContext, useContext, useEffect, useRef } from "react";
import { draftStore } from "~/draftStore";
import { notifications } from "@mantine/notifications";
import { FactionId, PlayerId, SimultaneousPickType } from "~/types";
import { useDraftApiMutation } from "./useDraftApiMutation";

type UndoResult = { success: boolean; removedSelection?: unknown };

type SyncResult = {
  success: boolean;
  error?: string;
  message?: string;
};

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
  const fetcher = useFetcher<SyncResult>({ key: "sync-draft" });
  const revalidator = useRevalidator();
  const mutation = useDraftApiMutation();
  const handledResult = useRef<SyncResult | undefined>(undefined);

  useEffect(() => {
    const data = fetcher.data;
    if (fetcher.state !== "idle" || !data || handledResult.current === data)
      return;
    handledResult.current = data;
    if (data.success !== false) return;

    const outOfSync = data.error === "out_of_sync";
    notifications.show({
      id: "draft-sync-error",
      title: outOfSync ? "The draft has changed" : "Could not save your choice",
      message: outOfSync
        ? "Another action changed the draft. Updating the board so you can review your next choice."
        : data.message ||
          data.error ||
          "Your choice could not be saved. Please try again.",
      color: outOfSync ? "orange" : "red",
      autoClose: 6000,
    });
    // Rejected actions may skip automatic loader revalidation. Restore the
    // authoritative board without discarding open controls or replay position.
    void revalidator.revalidate();
  }, [fetcher.data, fetcher.state, revalidator]);

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

      try {
        await fetcher.submit(
          { id: draftId, draft },
          { method: "POST", encType: "application/json" },
        );
      } catch {
        notifications.show({
          id: "draft-sync-error",
          title: "Could not save your choice",
          message:
            "Check your connection and wait for the board to update before trying again.",
          color: "red",
          autoClose: 6000,
        });
      }
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
            message:
              "Another action changed the draft. Updating the board; review it before trying undo again.",
            color: "orange",
            autoClose: 6000,
          });
          void revalidator.revalidate();
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
            message:
              "Another action changed the draft. Updating the board; review it before trying undo again.",
            color: "orange",
            autoClose: 6000,
          });
          void revalidator.revalidate();
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
