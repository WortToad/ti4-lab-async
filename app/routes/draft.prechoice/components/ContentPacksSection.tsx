import { ConfigSection } from "~/components/ConfigSection";
import { Checkbox, Group, Stack, Text } from "@mantine/core";
import { IconBox } from "@tabler/icons-react";
import { useDraftSetup } from "../store";

type ContentRowProps = {
  label: string;
  tilesChecked: boolean;
  factionsChecked: boolean;
  onTilesChange: (checked: boolean) => void;
  onFactionsChange: (checked: boolean) => void;
  dimmed?: boolean;
};

function ContentRow({
  label,
  tilesChecked,
  factionsChecked,
  onTilesChange,
  onFactionsChange,
}: ContentRowProps) {
  return (
    <div
      style={{
        paddingBlock: 14,
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <Text fw={600} size="sm" mb="xs">
        {label}
      </Text>
      <Group gap="xl">
        <Checkbox
          size="md"
          label="System tiles"
          aria-label={`${label} system tiles`}
          checked={tilesChecked}
          onChange={(event) => onTilesChange(event.currentTarget.checked)}
        />
        <Checkbox
          size="md"
          label="Factions"
          aria-label={`${label} factions`}
          checked={factionsChecked}
          onChange={(event) => onFactionsChange(event.currentTarget.checked)}
        />
      </Group>
    </div>
  );
}

export function ContentPacksSection() {
  const content = useDraftSetup((state) => state.content);
  const {
    withBaseTiles,
    withBaseFactions,
    withPokTiles,
    withPokFactions,
    withTETiles,
    withTEFactions,
    withDiscordantTiles,
    withDiscordantFactions,
  } = content.flags;

  return (
    <ConfigSection title="Game content" icon={<IconBox size={20} />}>
      <Text c="dimmed" size="sm">
        Include the systems and factions your table owns.
      </Text>
      {/* Content rows */}
      <Stack gap={0}>
        <ContentRow
          label="Base Game"
          tilesChecked={withBaseTiles}
          factionsChecked={withBaseFactions}
          onTilesChange={content.setWithBaseTiles}
          onFactionsChange={content.setWithBaseFactions}
        />
        <ContentRow
          label="Prophecy of Kings"
          tilesChecked={withPokTiles}
          factionsChecked={withPokFactions}
          onTilesChange={content.setWithPokTiles}
          onFactionsChange={content.setWithPokFactions}
        />
        <ContentRow
          label="Thunder's Edge"
          tilesChecked={withTETiles}
          factionsChecked={withTEFactions}
          onTilesChange={content.setWithTETiles}
          onFactionsChange={content.setWithTEFactions}
        />
        <ContentRow
          label="Discordant Stars"
          tilesChecked={withDiscordantTiles}
          factionsChecked={withDiscordantFactions}
          onTilesChange={content.setWithDiscordantTiles}
          onFactionsChange={content.setWithDiscordantFactions}
        />
      </Stack>
    </ConfigSection>
  );
}
