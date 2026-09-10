import { systemData } from "~/data/systemData";
import { calculateSliceValue, getSliceValueConfig } from "~/stats";
import type { SystemId } from "~/types";
import { generateSlices } from "../heisen/generateMap";
import type { SliceGenerationConfig } from "../types";

export function generateTemplateNucleusSlices(
  count: number,
  availableSystems: SystemId[],
  config: SliceGenerationConfig = {},
) {
  if (availableSystems.length < count * 3) return undefined;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const slices = generateSlices(count, availableSystems, config);
    if (!slices) return undefined;
    const valid = slices.every((slice) => {
      if (slice.length !== 3 || slice.some((id) => !systemData[id]))
        return false;
      const systems = slice.map((id) => systemData[id]);
      const value = calculateSliceValue(
        systems,
        getSliceValueConfig(config.sliceValueModifiers, [], [1]),
      );
      const resources = systems.reduce(
        (sum, system) =>
          sum + system.optimalSpend.resources + system.optimalSpend.flex,
        0,
      );
      const influence = systems.reduce(
        (sum, system) =>
          sum + system.optimalSpend.influence + system.optimalSpend.flex,
        0,
      );
      return (
        (config.minSliceValue === undefined || value >= config.minSliceValue) &&
        (config.maxSliceValue === undefined || value <= config.maxSliceValue) &&
        (config.minOptimalResources === undefined ||
          resources >= config.minOptimalResources) &&
        (config.minOptimalInfluence === undefined ||
          influence >= config.minOptimalInfluence)
      );
    });
    if (valid) return slices;
  }
  return undefined;
}
