import { Group, Text } from "@mantine/core";
import { playerColors } from "~/data/factionData";
import type { DraftOrderEntry } from "./draftOrderUtils";

import classes from "~/components/Surface.module.css";
import draftClasses from "./DraftOrder.module.css";

type Props = {
  entry: DraftOrderEntry;
  compact?: boolean;
  chipSize?: "sm" | "md";
};

export function DraftOrderChip({
  entry,
  compact = false,
  chipSize = "md",
}: Props) {
  const padding = compact ? 6 : "xs";
  const textSize = compact ? "xs" : "sm";
  const gap = compact ? "xs" : "xs";

  return (
    <Group
      className={[
        classes.surface,
        draftClasses[playerColors[entry.player.id]],
        entry.isActive ? draftClasses.active : "",
        entry.isPassed ? draftClasses.passed : "",
      ].join(" ")}
      p={padding}
      gap={gap}
      miw={0}
      maw="100%"
      data-active={entry.isActive ? "true" : undefined}
      style={{
        borderRadius:
          chipSize === "sm" ? "var(--mantine-radius-sm)" : undefined,
        flexShrink: compact ? 0 : undefined,
      }}
    >
      <Text
        size={textSize}
        fw={600}
        lh={1.4}
        style={{ overflowWrap: "anywhere" }}
      >
        {entry.player.name}
      </Text>
    </Group>
  );
}
