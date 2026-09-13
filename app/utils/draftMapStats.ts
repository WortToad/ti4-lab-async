import { systemData } from "~/data/systemData";
import type { Map, SystemIds, SystemStats } from "~/types";
import { systemStats } from "~/utils/system";

export function calculateMapStats(slices: SystemIds[], presetMap: Map) {
  const stats: SystemStats[] = [];
  slices.forEach((slice) => {
    slice.forEach((t) => {
      stats.push(systemStats(systemData[t]));
    });
  });
  presetMap.forEach((t, idx) => {
    if (idx === 0) return;
    if (t.type !== "SYSTEM") return;
    stats.push(systemStats(systemData[t.systemId]));
  });

  return stats.reduce(
    (acc, s) => {
      acc.totalResources += s.totalResources;
      acc.totalInfluence += s.totalInfluence;
      acc.totalTech = acc.totalTech.concat(s.totalTech).sort();
      acc.redTraits += s.redTraits;
      acc.greenTraits += s.greenTraits;
      acc.blueTraits += s.blueTraits;
      acc.totalLegendary += s.totalLegendary;

      if (s.systemType === "RED") {
        acc.redTiles++;
      } else if (s.systemType === "BLUE") {
        acc.blueTiles++;
      }

      return acc;
    },
    {
      redTiles: 0,
      blueTiles: 0,
      totalResources: 0,
      totalInfluence: 0,
      totalTech: [] as string[],
      totalLegendary: 0,
      redTraits: 0,
      greenTraits: 0,
      blueTraits: 0,
    },
  );
}
