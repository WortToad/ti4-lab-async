import { Badge, Box, Button, Group } from "@mantine/core";
import { PlayerChip } from "./PlayerChip";
import { HydratedPlayer } from "~/types";

type Props = {
  player?: HydratedPlayer;
  isMinor?: boolean;
  disabled?: boolean;
  selectTitle?: string;
  onSelect?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSelectMinor?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function PlayerChipOrSelect({
  player,
  isMinor = false,
  disabled = false,
  selectTitle,
  onSelect,
  onSelectMinor,
}: Props) {
  const selectText = selectTitle || "Select";
  if (!player && !onSelect && !onSelectMinor) return null;

  return (
    <Box px="sm" pb="sm">
      {player && (
        <Group gap={2}>
          {isMinor && (
            <Badge size="xs" color="pink.3" variant="light">
              Minor Faction
            </Badge>
          )}
          <PlayerChip player={player} />
        </Group>
      )}
      {!player && (
        <Group gap={4}>
          {onSelectMinor && (
            <Button
              size="compact-xs"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectMinor(event);
              }}
              disabled={disabled}
              variant="outline"
              color="pink.3"
            >
              Minor
            </Button>
          )}
          {onSelect && (
            <Button
              size="compact-xs"
              variant="outline"
              color="imperial"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(event);
              }}
              disabled={disabled}
            >
              {onSelectMinor ? "Main" : selectText}
            </Button>
          )}
        </Group>
      )}
    </Box>
  );
}
