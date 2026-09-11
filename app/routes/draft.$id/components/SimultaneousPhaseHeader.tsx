import { useContext } from "react";
import { LobbyIdentityContext } from "~/draft/LobbyIdentity";
import { Box, Button, Group, Text, MantineColor, Tooltip } from "@mantine/core";
import { IconArrowBackUp } from "@tabler/icons-react";

type SimultaneousPhaseHeaderProps = {
  phaseName: string;
  phaseColor: MantineColor;
  description: string;
  adminMode: boolean;
  onAdminToggle: () => void;
  showPickForAnyoneControl: boolean;
  pickForAnyone: boolean;
  onTogglePickForAnyone: () => void;
  showUndo: boolean;
  onUndoPick: () => void;
  onUndoPhase: () => void;
  undoPickDisabled: boolean;
  undoPhaseDisabled: boolean;
  showPickAnyWarning?: boolean;
};

export function SimultaneousPhaseHeader({
  phaseName,
  phaseColor,
  description,
  adminMode,
  onAdminToggle,
  showPickForAnyoneControl,
  pickForAnyone,
  onTogglePickForAnyone,
  showUndo,
  onUndoPick,
  onUndoPhase,
  undoPickDisabled,
  undoPhaseDisabled,
  showPickAnyWarning = false,
}: SimultaneousPhaseHeaderProps) {
  const managedLobby = useContext(LobbyIdentityContext)?.managed;
  return (
    <Box
      style={{
        borderBottom: "1px solid var(--mantine-color-dark-4)",
      }}
    >
      <Group justify="space-between" align="center" px="md" py="sm">
        <Group gap="sm">
          <Text
            size="sm"
            fw={600}
            style={{
              letterSpacing: "0.04em",
              color: `var(--mantine-color-${phaseColor}-4)`,
            }}
          >
            {phaseName}
          </Text>
          <Text size="sm">{description}</Text>
        </Group>
        <Group gap={4}>
          {!managedLobby && (
            <Button
              size="sm"
              variant={adminMode ? "filled" : "default"}
              color={adminMode ? "violet" : "gray"}
              onClick={onAdminToggle}
            >
              Admin
            </Button>
          )}
          {showPickForAnyoneControl && (
            <Tooltip
              label="Reveals hidden information. Use with caution."
              color="orange"
              withArrow
              position="bottom"
              disabled={!showPickAnyWarning}
            >
              <Button
                size="sm"
                variant={pickForAnyone ? "filled" : "default"}
                color={
                  pickForAnyone
                    ? showPickAnyWarning
                      ? "orange"
                      : "violet"
                    : "gray"
                }
                onClick={onTogglePickForAnyone}
              >
                Pick Any
              </Button>
            </Tooltip>
          )}
          {showUndo && (
            <>
              <Button
                size="sm"
                variant="outline"
                color="orange.3"
                leftSection={<IconArrowBackUp size={20} />}
                onClick={onUndoPick}
                disabled={undoPickDisabled}
              >
                Undo Pick
              </Button>
              <Button
                size="sm"
                variant="outline"
                color="orange.3"
                leftSection={<IconArrowBackUp size={20} />}
                onClick={onUndoPhase}
                disabled={undoPhaseDisabled}
              >
                Undo Phase
              </Button>
            </>
          )}
        </Group>
      </Group>
    </Box>
  );
}
