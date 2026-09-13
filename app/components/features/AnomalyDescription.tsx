import { Group, Text } from "@mantine/core";
import { AnomalyIcon } from "~/components/icons/AnomalyIcon";
import { anomalyDetails } from "~/data/anomalies";
import type { Anomaly } from "~/types";

export function AnomalyDescription({ anomaly }: { anomaly: Anomaly }) {
  const { label, description } = anomalyDetails[anomaly];
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start" w="100%">
      <AnomalyIcon anomaly={anomaly} showHelp={false} />
      <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
        <Text span inherit c="orange" fw={600}>
          {label}
        </Text>
        {" — "}
        {description}
      </Text>
    </Group>
  );
}
