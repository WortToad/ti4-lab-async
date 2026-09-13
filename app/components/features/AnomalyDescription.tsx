import { Group, Stack, Text } from "@mantine/core";
import { AnomalyIcon } from "~/components/icons/AnomalyIcon";
import { anomalyDetails } from "~/data/anomalies";
import type { Anomaly } from "~/types";

export function AnomalyDescription({ anomaly }: { anomaly: Anomaly }) {
  const { label, description } = anomalyDetails[anomaly];
  return (
    <Stack gap={4} w="100%">
      <Group gap="xs" wrap="nowrap" align="center">
        <AnomalyIcon anomaly={anomaly} showHelp={false} />
        <Text size="sm" c="orange" fw={600}>
          {label}
        </Text>
      </Group>
      <Text size="sm" pl="calc(32px + var(--mantine-spacing-xs))">
        {description}
      </Text>
    </Stack>
  );
}
