import { Badge, Box, MantineSize } from "@mantine/core";
import { playerColors } from "~/data/factionData";
import { Player } from "~/types";
import classes from "./PlayerChip.module.css";

type Props = {
  player: Player;
  size?: "sm" | "md" | "lg" | "xl";
  visibleFrom?: MantineSize;
  hiddenFrom?: MantineSize;
  /** Use compact mode for names inside home tiles. */
  compact?: boolean;
};

export function PlayerChip({
  player,
  size = "md",
  visibleFrom,
  hiddenFrom,
  compact = false,
}: Props) {
  const color = playerColors[player.id];

  // Preserve the full name in the accessible label when the tile is narrow.
  if (compact) {
    return (
      <Box
        className={classes.compactChip}
        visibleFrom={visibleFrom}
        hiddenFrom={hiddenFrom}
        data-color={color}
        title={player.name}
        aria-label={player.name}
        style={{
          ["--chip-color" as string]: `var(--mantine-color-${color}-filled)`,
          ["--chip-color-light" as string]: `var(--mantine-color-${color}-light)`,
        }}
      >
        <span className={classes.compactText}>{player.name}</span>
      </Box>
    );
  }

  return (
    <Badge
      color={color}
      size={size}
      visibleFrom={visibleFrom}
      hiddenFrom={hiddenFrom}
    >
      {player.name}
    </Badge>
  );
}
