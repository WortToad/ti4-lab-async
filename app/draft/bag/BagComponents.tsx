import { Badge, Checkbox, Group, Paper, Stack, Text } from "@mantine/core";
import {
  CATEGORY_LABELS,
  type BagDraftItem,
  type BagItemCategory,
} from "./definitions";
import type { BagVariant } from "./types";

const sourceNames: Record<string, string> = {
  base: "Base game",
  pok: "Prophecy of Kings",
  thunders_edge: "Thunder’s Edge",
  twilight: "Twilight’s Fall",
  twilight_ds: "Twilight’s Fall · Discordant Stars",
  ds: "Discordant Stars",
  blue_reverie: "Blue Reverie",
  theodisi: "Lost Legacies",
  monuments: "Monuments",
  franken: "Franken",
};

export function bagCategoryLabel(
  category: BagItemCategory,
  variant: BagVariant,
) {
  if (variant === "twilights_fall" || variant === "inaugural_splice") {
    if (category === "TECH") return "Abilities";
    if (category === "AGENT") return "Genomes";
    if (category === "UNIT") return "Unit upgrades";
  }
  return CATEGORY_LABELS[category] ?? category;
}

export function BagItemCard({
  item,
  selected,
  disabled,
  onSelect,
  note,
}: {
  item: BagDraftItem;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (selected: boolean) => void;
  note?: string;
}) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={
        selected
          ? {
              borderColor: "var(--mantine-primary-color-filled)",
              background: "var(--mantine-primary-color-light)",
            }
          : undefined
      }
    >
      <Stack gap="xs">
        {onSelect ? (
          <Checkbox
            checked={selected ?? false}
            disabled={disabled}
            onChange={(event) => onSelect(event.currentTarget.checked)}
            label={
              <Text fw={600} size="sm">
                {item.name}
              </Text>
            }
            styles={{ label: { cursor: disabled ? "not-allowed" : "pointer" } }}
          />
        ) : (
          <Text fw={600} size="sm">
            {item.name}
          </Text>
        )}
        <Group gap={6}>
          {item.factionName && (
            <Badge size="xs" variant="light" color="gray">
              {item.factionName}
            </Badge>
          )}
          {item.source && (
            <Badge size="xs" variant="outline" color="gray">
              {sourceNames[item.source] ?? item.source.replaceAll("_", " ")}
            </Badge>
          )}
        </Group>
        {item.description && (
          <Text size="xs" style={{ whiteSpace: "pre-line" }}>
            {item.description}
          </Text>
        )}
        {note && (
          <Text size="xs" c="dimmed">
            {note}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
