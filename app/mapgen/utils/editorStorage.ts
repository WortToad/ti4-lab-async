import type { GameSet, Map } from "~/types";
import { mapConfigs } from "../mapConfigs";
import { decodeMapString, encodeMapString } from "./mapStringCodec";

export const MAP_EDITOR_STORAGE_KEY = "ti4:map-editor:v1";

type SavedMap = { map: Map; gameSets: GameSet[]; mapConfigId: string };
const gameSets: GameSet[] = [
  "base",
  "pok",
  "te",
  "unchartedstars",
  "discordant",
  "discordantexp",
  "drahn",
  "twilightsFall",
];

export function readSavedMap(source: string | null) {
  try {
    const raw = window.sessionStorage.getItem(MAP_EDITOR_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // An explicit shared link takes precedence over unrelated local work.
    if (source && saved.source !== source) return null;
    if (typeof saved.mapString !== "string" || !Array.isArray(saved.gameSets))
      return null;
    if (!saved.gameSets.every((set: GameSet) => gameSets.includes(set)))
      return null;
    if (
      typeof saved.mapConfigId !== "string" ||
      !Object.hasOwn(mapConfigs, saved.mapConfigId)
    )
      return null;
    const decoded = decodeMapString(saved.mapString);
    if (!decoded) return null;
    return {
      ...decoded,
      source: typeof saved.source === "string" ? saved.source : null,
      gameSets: saved.gameSets as GameSet[],
      mapConfigId: saved.mapConfigId,
    };
  } catch {
    return null;
  }
}

export function saveMap(state: SavedMap, source: string | null): boolean {
  try {
    window.sessionStorage.setItem(
      MAP_EDITOR_STORAGE_KEY,
      JSON.stringify({
        source,
        mapString: encodeMapString(state.map),
        gameSets: state.gameSets,
        mapConfigId: state.mapConfigId,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
