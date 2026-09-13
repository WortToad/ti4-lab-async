import { DraftSettings, GameSet, Map } from "~/types";
import { mapConfigToCompatibleDraftTypes } from "./mapToDraft";
import { mapConfigs } from "../mapConfigs";
import { draftConfig } from "~/draft/draftConfig";

type PresetDraftState = {
  settings: DraftSettings;
  players: { id: number; name: string }[];
};

type PresetDraftBuildResult =
  | { ok: true; value: PresetDraftState }
  | { ok: false; error: string };

export function buildPresetDraftState(input: {
  map: Map;
  mapConfigId: string;
  gameSets: GameSet[];
  playerCount: number;
}): PresetDraftBuildResult {
  const compatibleTypes = mapConfigToCompatibleDraftTypes[input.mapConfigId];
  if (!Object.hasOwn(mapConfigs, input.mapConfigId)) {
    return { ok: false, error: "This map type doesn't support draft creation" };
  }

  if (input.playerCount <= 0) {
    return { ok: false, error: "Add home systems before starting a draft" };
  }

  // Preset drafts retain the complete galaxy; they do not need a layout
  // whose slice offsets match the editor's home positions.
  const selectedDraftType =
    compatibleTypes?.[0] ??
    Object.values(draftConfig).find(
      (config) => config.numPlayers === input.playerCount,
    )?.type;
  if (!selectedDraftType) {
    return { ok: false, error: "This map type doesn't support draft creation" };
  }

  const settings: DraftSettings = {
    type: selectedDraftType,
    factionGameSets: input.gameSets,
    tileGameSets: input.gameSets,
    draftSpeaker: true,
    allowHomePlanetSearch: false,
    numFactions: Math.max(6, input.playerCount),
    numSlices: input.playerCount,
    randomizeMap: false,
    randomizeSlices: false,
    draftPlayerColors: false,
    allowEmptyTiles: false,
    draftGameMode: "presetMap",
    presetMap: input.map,
  };

  return {
    ok: true,
    value: {
      settings,
      players: Array(input.playerCount)
        .fill(null)
        .map((_, i) => ({ id: i, name: "" })),
    },
  };
}
