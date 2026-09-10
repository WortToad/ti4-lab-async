import { Badge, Group, SegmentedControl, Stack, Text } from "@mantine/core";

export function LobbyPlayerCount({
  count,
  onChange,
  min = 3,
  max = 8,
  description = "Everyone enters their own name when they join. Share the lobby link, then start when everyone is ready.",
}: {
  count: number;
  onChange?: (count: number) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="sm">
        <Text size="sm" fw={600}>
          {onChange ? "Number of players" : "Your lobby"}
        </Text>
        <Badge variant="light">{count} players</Badge>
      </Group>
      {onChange && (
        <SegmentedControl
          aria-label="Number of players"
          fullWidth
          value={String(count)}
          onChange={(value) => onChange(Number(value))}
          data={Array.from({ length: max - min + 1 }, (_, index) => ({
            value: String(min + index),
            label: String(min + index),
          }))}
        />
      )}
      <Text size="sm" c="dimmed">
        {description}
      </Text>
    </Stack>
  );
}
