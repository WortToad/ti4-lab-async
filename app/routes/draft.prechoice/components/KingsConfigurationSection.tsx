import { Box, Button, Group, MultiSelect, Stack, Text } from "@mantine/core";
import { IconCrown } from "@tabler/icons-react";
import { ConfigSection } from "~/components/ConfigSection";
import { useDraftSetup } from "../store";
import { factions, twilightsFallFactionIds } from "~/data/factionData";
import type { FactionId } from "~/types";

export function KingsConfigurationSection() {
  const kings = useDraftSetup((state) => state.kings);
  const playerCount = useDraftSetup((state) => state.player.players.length);
  const kingOptions = twilightsFallFactionIds.map((id) => ({
    value: id,
    label: factions[id].name,
  }));

  return (
    <ConfigSection title="Kings" icon={<IconCrown size={12} />}>
      <Box
        py={6}
        style={{
          borderBottom: "1px dashed var(--mantine-color-default-border)",
        }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              Kings in Pool
            </Text>
            <Text size="xs" c="dimmed">
              Mahact kings available for drafting
            </Text>
          </Box>
          <Group gap={2}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={
                kings.numKings <=
                Math.max(playerCount, kings.prioritizedKings.length)
              }
              onClick={() => kings.setNumKings(kings.numKings - 1)}
            >
              -
            </Button>
            <Text size="sm" fw={600} miw={24} ta="center" c="purple.3">
              {kings.numKings}
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={kings.numKings >= 8 - kings.bannedKings.length}
              onClick={() => kings.setNumKings(kings.numKings + 1)}
            >
              +
            </Button>
          </Group>
        </Group>
      </Box>
      <Stack gap="sm" py="sm">
        <MultiSelect
          label="Banned kings"
          size="xs"
          data={kingOptions}
          value={kings.bannedKings}
          onChange={(ids) => kings.setBannedKings(ids as FactionId[])}
        />
        <MultiSelect
          label="Prioritized kings"
          description="These kings are always included in the pool."
          size="xs"
          data={kingOptions.filter(
            (option) => !kings.bannedKings.includes(option.value),
          )}
          value={kings.prioritizedKings}
          onChange={(ids) => kings.setPrioritizedKings(ids as FactionId[])}
        />
        {8 - kings.bannedKings.length < playerCount && (
          <Text size="xs" c="red">
            Unban more kings to leave at least one per player.
          </Text>
        )}
      </Stack>
    </ConfigSection>
  );
}
