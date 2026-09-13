import { Group, Stack, Text } from "@mantine/core";
import { IconInfoCircleFilled } from "@tabler/icons-react";
import { PlanetStatsPill } from "~/components/Slice/PlanetStatsPill";
import { SystemFeatures } from "~/components/Slice/SliceFeatures";
import { calculateSliceValue } from "~/stats";
import type { System } from "~/types";
import { SymbolHelp } from "~/components/SymbolHelp";

/** Tile values use the same scoring as slices, before a map position is known. */
export function SystemTileStats({ system }: { system: System }) {
  const value = calculateSliceValue([system]);
  const optimal = system.optimalSpend;
  const total = optimal.resources + optimal.influence + optimal.flex;

  return (
    <Stack gap={6} align="center" w="100%" mt={4}>
      <SymbolHelp
        label={`System value ${value}`}
        description="System value uses standard slice scoring, before any shared-position or path-to-Mecatol adjustments."
      >
        <Group gap={5} aria-label={`System value ${value}`}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            SV
          </Text>
          <Text size="sm" fw={700} c="yellow.5">
            {Number.isInteger(value) ? value : value.toFixed(1)}
          </Text>
          <IconInfoCircleFilled size={14} color="var(--mantine-color-dimmed)" />
        </Group>
      </SymbolHelp>
      <SymbolHelp
        label={`Optimal spend: ${optimal.resources} resources, ${optimal.influence} influence, ${optimal.flex} flex; ${total} total`}
        description="Optimal spend: resources / influence / flex. Flex can be spent as either resources or influence."
      >
        <Group
          gap={4}
          justify="center"
          aria-label={`Optimal spend: ${optimal.resources} resources, ${optimal.influence} influence, ${optimal.flex} flex; ${total} total`}
        >
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            Opt
          </Text>
          <PlanetStatsPill {...optimal} size="xs" compact />
          <Text size="xs" c="dimmed">
            ({total})
          </Text>
        </Group>
      </SymbolHelp>
      <SystemFeatures systems={[system]} />
    </Stack>
  );
}
