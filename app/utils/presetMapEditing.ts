import { systemData } from "~/data/systemData";
import type { Draft } from "~/types";

export function getPresetMapEditableTiles(
  draft: Pick<Draft, "presetMap" | "settings">,
) {
  const original = draft.settings.presetMap ?? draft.presetMap;
  return original
    .filter((tile) => {
      if (tile.idx === 0) return false;
      if (tile.type === "OPEN") return true;
      if (tile.type !== "SYSTEM") return false;
      if (tile.systemId === "18") return false;
      const type = systemData[tile.systemId]?.type;
      return type === "BLUE" || type === "RED";
    })
    .map((tile) => tile.idx);
}
