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
      className="command-state-panel"
      style={{
        position: "sticky",
        top: "calc(var(--app-shell-header-height, 48px) + 8px)",
        zIndex: 20,
      }}
    >
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Stack gap={2} style={{ flex: "1 1 180px", minWidth: 0 }}>
          <Text size="md" fw={700} role="status">
            {status}
          </Text>
          {detail && (
            <Text size="sm" style={{ overflowWrap: "anywhere" }}>
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
