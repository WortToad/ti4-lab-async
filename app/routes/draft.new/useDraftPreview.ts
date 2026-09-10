import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { draftStore } from "~/draftStore";
import {
  readDraftPreview,
  removeDraftPreview,
  saveDraftPreview,
} from "./previewStorage";

export function useDraftPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = useRef(location.state);
  const previewId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const state = initialState.current;
    const actions = draftStore.getState().actions;
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = undefined;
    }
    const recovered = storage
      ? readDraftPreview(storage, state?.draftPreviewId)
      : undefined;

    if (state?.savedDraftState) {
      previewId.current = crypto.randomUUID();
      actions.initializeDraftFromSavedState(state.savedDraftState);
    } else if (state?.draftSettings && state?.players) {
      previewId.current = crypto.randomUUID();
      actions.initializeDraft(state.draftSettings, state.players, {
        discord: state.discordData,
      });
      if (
        !["presetMap", "texasStyle"].includes(
          state.draftSettings.draftGameMode,
        ) &&
        draftStore.getState().draft.slices.length === 0
      ) {
        actions.reset();
        navigate("/draft/prechoice", {
          replace: true,
          state: { invalidDraftParameters: true },
        });
        return;
      }
    } else if (recovered) {
      previewId.current = recovered.id;
      actions.initializeDraftFromSavedState(recovered.draft);
    } else {
      navigate("/draft/prechoice", { replace: true });
      return;
    }

    const save = () => {
      const { initialized, draft } = draftStore.getState();
      if (!initialized || !previewId.current) return;
      const stored =
        storage && saveDraftPreview(storage, previewId.current, draft);
      try {
        window.history.replaceState(
          {
            ...window.history.state,
            usr: stored
              ? { draftPreviewId: previewId.current }
              : { savedDraftState: draft },
          },
          "",
        );
      } catch {
        /* The preview stays usable when browser storage is unavailable. */
      }
    };
    save();
    const unsubscribe = draftStore.subscribe((state, previous) => {
      if (state.draft !== previous.draft) save();
    });
    return () => {
      unsubscribe();
      actions.reset();
    };
  }, [navigate]);

  return () => {
    if (!previewId.current) return;
    try {
      removeDraftPreview(window.sessionStorage, previewId.current);
    } catch {
      return;
    }
  };
}
