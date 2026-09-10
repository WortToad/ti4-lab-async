import {
  Box,
  Button,
  Group,
  MultiSelect,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconCards } from "@tabler/icons-react";
import { ConfigSection } from "~/components/ConfigSection";
import { useDraftSetup } from "../store";
import {
  referenceCardFactionPool,
  parseReferenceCardPacks,
} from "~/draft/twilightsFall/pools";
import { factions } from "~/data/factionData";
import type { FactionId } from "~/types";

export function ReferenceCardPacksConfigurationSection() {
  const referenceCardPacks = useDraftSetup((state) => state.referenceCardPacks);
  const playerCount = useDraftSetup((state) => state.player.players.length);
  const maxPacks = Math.floor(
    (referenceCardFactionPool.length -
      referenceCardPacks.bannedFactions.length) /
      3,
  );
  let presetError: string | undefined;
  let presetCount: number | undefined;
  try {
    const preset = parseReferenceCardPacks(referenceCardPacks.presetPackages);
    presetCount = preset?.length;
    if (preset) {
      const ids = preset.flat();
      if (preset.length < playerCount)
        presetError = `Provide at least ${playerCount} packs.`;
      else if (new Set(ids).size !== ids.length)
        presetError = "Each reference card may appear only once.";
      else if (ids.some((id) => referenceCardPacks.bannedFactions.includes(id)))
        presetError = "A preset pack contains a banned faction.";
    }
  } catch (error) {
    presetError =
      error instanceof Error ? error.message : "Invalid preset packs.";
  }

  return (
    <ConfigSection
      title="Reference Cards"
      icon={<IconCards size={12} />}
      color="orange"
    >
      <Box
        py={6}
        style={{
          borderBottom: "1px dashed var(--mantine-color-default-border)",
        }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              Card Packs
            </Text>
            <Text size="xs" c="dimmed">
              Each pack has 3 factions (max {maxPacks})
            </Text>
          </Box>
          <Group gap={2}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={
                !!referenceCardPacks.presetPackages.trim() ||
                referenceCardPacks.numReferenceCardPacks <= playerCount
              }
              onMouseDown={() =>
                referenceCardPacks.setNumReferenceCardPacks(
                  referenceCardPacks.numReferenceCardPacks - 1,
                )
              }
            >
              -
            </Button>
            <Text size="sm" fw={600} miw={24} ta="center" c="purple.3">
              {presetCount ?? referenceCardPacks.numReferenceCardPacks}
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={
                !!referenceCardPacks.presetPackages.trim() ||
                referenceCardPacks.numReferenceCardPacks >= maxPacks
              }
              onMouseDown={() =>
                referenceCardPacks.setNumReferenceCardPacks(
                  referenceCardPacks.numReferenceCardPacks + 1,
                )
              }
            >
              +
            </Button>
          </Group>
        </Group>
      </Box>
      <Stack gap="sm" py="sm">
        <MultiSelect
          label="Banned reference cards"
          size="xs"
          searchable
          data={referenceCardFactionPool.map((id) => ({
            value: id,
            label: `${factions[id].name} (${id})`,
          }))}
          value={referenceCardPacks.bannedFactions}
          onChange={(ids) =>
            referenceCardPacks.setBannedFactions(ids as FactionId[])
          }
        />
        <Textarea
          label="Preset reference packs"
          description="Optional: 3 faction IDs separated by commas per pack. Separate packs with a newline or semicolon."
          placeholder="sol,hacan,arborec;barony,xxcha,yin"
          size="xs"
          minRows={3}
          autosize
          value={referenceCardPacks.presetPackages}
          onChange={(event) =>
            referenceCardPacks.setPresetPackages(event.currentTarget.value)
          }
          error={presetError}
        />
        {maxPacks < playerCount && (
          <Text size="xs" c="red">
            Unban more reference cards to leave 3 cards per player.
          </Text>
        )}
      </Stack>
    </ConfigSection>
  );
}
