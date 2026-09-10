import { draftConfig } from "~/draft/draftConfig";
import type { Draft } from "~/types";
import { appPath } from "~/utils/appUrl";

type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const prefix = `ti4:draft-preview:${appPath("/draft/new")}:v1:`;
const latestKey = `${prefix}latest`;

export function readDraftPreview(
  storage: PreviewStorage,
  requestedId?: string,
) {
  try {
    const id = requestedId ?? storage.getItem(latestKey);
    if (!id) return undefined;
    const raw = storage.getItem(`${prefix}${id}`);
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw);
    const draft = snapshot.draft as Draft | undefined;
    if (
      snapshot.version !== 1 ||
      !draft?.settings ||
      !(draft.settings.type in draftConfig) ||
      !Array.isArray(draft.settings.factionGameSets) ||
      !Array.isArray(draft.settings.tileGameSets) ||
      !Array.isArray(draft.players) ||
      !Array.isArray(draft.availableFactions) ||
      !Array.isArray(draft.slices) ||
      !Array.isArray(draft.presetMap) ||
      !Array.isArray(draft.selections) ||
      !Array.isArray(draft.pickOrder)
    )
      return undefined;
    return { id, draft };
  } catch {
    return undefined;
  }
}

export function saveDraftPreview(
  storage: PreviewStorage,
  id: string,
  draft: Draft,
) {
  try {
    storage.setItem(`${prefix}${id}`, JSON.stringify({ version: 1, draft }));
    storage.setItem(latestKey, id);
    return true;
  } catch {
    return false;
  }
}

export function removeDraftPreview(storage: PreviewStorage, id: string) {
  try {
    storage.removeItem(`${prefix}${id}`);
    if (storage.getItem(latestKey) === id) storage.removeItem(latestKey);
  } catch {
    // Storage availability must not prevent entering a created lobby.
  }
}
