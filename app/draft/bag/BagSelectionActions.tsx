import { Group, Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export function BagSelectionActions({
  status,
  detail,
  children,
}: {
  status: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      shadow="sm"
      style={{
        position: "sticky",
        top: "calc(var(--app-shell-header-height, 48px) + 8px)",
        zIndex: 20,
        background: "var(--mantine-color-body)",
      }}
    >
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Stack gap={2} style={{ flex: "1 1 180px", minWidth: 0 }}>
          <Text size="sm" fw={600} role="status">
            {status}
          </Text>
          {detail && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {detail}
            </Text>
          )}
        </Stack>
        <Group gap="xs" wrap="wrap">
          {children}
        </Group>
      </Group>
    </Paper>
  );
}
