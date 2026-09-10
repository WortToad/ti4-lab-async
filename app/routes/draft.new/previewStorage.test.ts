import { afterEach, describe, expect, it } from "vitest";
import { buildMiniMiltySettings } from "~/draft/minimilty/buildMiniMilty";
import { draftStore } from "~/draftStore";
import {
  readDraftPreview,
  removeDraftPreview,
  saveDraftPreview,
} from "./previewStorage";

function storage() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}

function prepare() {
  const players = Array.from({ length: 4 }, (_, id) => ({
    id,
    name: `Slot ${id + 1}`,
  }));
  draftStore
    .getState()
    .actions.initializeDraft(buildMiniMiltySettings({ players }), players, {});
  return draftStore.getState();
}

afterEach(() => draftStore.getState().actions.reset());

describe("recoverable draft previews", () => {
  it("restores customized pools and map edits after the in-memory draft is reset", () => {
    const saved = storage();
    const { actions } = prepare();
    actions.removeLastFaction();
    const draft = draftStore.getState().draft;
    const tile = draft.presetMap.find(
      (tile) => tile.type === "SYSTEM" && tile.idx !== 0,
    )!;
    actions.removeSystemFromMap(tile.idx);
    const customized = structuredClone(draftStore.getState().draft);
    expect(saveDraftPreview(saved, "working-preview", customized)).toBe(true);
    actions.reset();
    const recovered = readDraftPreview(saved, "working-preview")!;
    actions.initializeDraftFromSavedState(recovered.draft);
    expect(draftStore.getState().draft).toEqual(customized);
    expect(draftStore.getState().draft.presetMap[tile.idx].type).toBe("OPEN");
    expect(readDraftPreview(saved)?.id).toBe("working-preview");
  });

  it("keeps history entries separate and removes only the successfully created preview", () => {
    const saved = storage();
    const { draft } = prepare();
    saveDraftPreview(saved, "first", draft);
    draftStore.getState().actions.removeLastFaction();
    saveDraftPreview(saved, "second", draftStore.getState().draft);
    expect(
      readDraftPreview(saved, "first")!.draft.availableFactions,
    ).toHaveLength(5);
    expect(
      readDraftPreview(saved, "second")!.draft.availableFactions,
    ).toHaveLength(4);
    removeDraftPreview(saved, "first");
    expect(readDraftPreview(saved)?.id).toBe("second");
    expect(readDraftPreview(saved, "first")).toBeUndefined();
    removeDraftPreview(saved, "second");
    expect(readDraftPreview(saved)).toBeUndefined();
  });

  it("ignores corrupt saved state and keeps storage failures recoverable", () => {
    const saved = storage();
    const { draft } = prepare();
    saveDraftPreview(saved, "first", draft);
    const snapshotKey = [...saved.entries.keys()].find((key) =>
      key.endsWith(":first"),
    )!;
    saved.setItem(snapshotKey, "{broken");
    expect(readDraftPreview(saved)).toBeUndefined();
    saved.setItem(
      snapshotKey,
      JSON.stringify({ version: 1, draft: { settings: {} } }),
    );
    expect(readDraftPreview(saved)).toBeUndefined();
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(saveDraftPreview(blocked, "first", draft)).toBe(false);
    expect(readDraftPreview(blocked)).toBeUndefined();
    expect(() => removeDraftPreview(blocked, "first")).not.toThrow();
  });
});
