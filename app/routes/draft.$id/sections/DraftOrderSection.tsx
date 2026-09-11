import { useContext } from "react";
import { LobbyIdentityContext } from "~/draft/LobbyIdentity";
import { appPath } from "~/utils/appUrl";
import { ActionIcon, Box, Button, Group, Stack } from "@mantine/core";
import { SectionTitle } from "~/components/Section";
import { DraftOrder } from "../components/DraftOrder";
import { useDraft } from "~/draftStore";
import { useHydratedDraft } from "~/hooks/useHydratedDraft";
import { useSyncDraft } from "~/hooks/useSyncDraft";
import { ExportDraftState } from "../components/ExportDraftState";
import { useSafeOutletContext } from "~/useSafeOutletContext";
import { AdminPasswordModal } from "../components/AdminPasswordModal";
import { useAdminControls } from "../components/useAdminControls";
import { Link } from "react-router";
import {
  IconPlayerPlay,
  IconShare,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { LabArtToggleButton } from "~/components/LabArtToggleButton";

export function DraftOrderSection() {
  const managedLobby = useContext(LobbyIdentityContext)?.managed;
  const { originalArt, setOriginalArt } = useSafeOutletContext();
  const {
    adminMode,
    pickForAnyone,
    setPickForAnyone,
    showPickForAnyoneControl,
    showUndoLastSelection,
    passwordModalOpen,
    setPasswordModalOpen,
    handleAdminPasswordSubmit,
    handleAdminToggle,
  } = useAdminControls();

  const replayMode = useDraft((state) => state.replayMode);
  const draftUrl = useDraft((state) => state.draftUrl);
  const { undoLastPick } = useSyncDraft();
  const { hydratedPlayers, currentPick } = useHydratedDraft();
  const pickOrder = useDraft((state) => state.draft.pickOrder);
  const selections = useDraft((state) => state.draft.selections);

  const handleUndo = async () => {
    if (confirm("Are you sure you want to undo the last selection?")) {
      await undoLastPick();
    }
  };

  const ControlBar = (
    <Group gap="xs" wrap="wrap">
      <Button
        component="a"
        href={appPath(`/draft/${draftUrl}.png`)}
        target="_blank"
        rel="noreferrer"
        size="compact-xs"
        variant="default"
        leftSection={<IconShare size={12} />}
      >
        Share
      </Button>

      <LabArtToggleButton
        originalArt={originalArt}
        onToggle={() => setOriginalArt(!originalArt)}
      />

      {/* Other view controls */}
      <Group gap={4}>
        <ActionIcon
          component={Link}
          to={`/draft/${draftUrl}/replay`}
          size="sm"
          variant="default"
          color="gray"
          disabled={selections.length === 0}
          title="Watch replay"
          onClick={(e: React.MouseEvent) =>
            selections.length === 0 && e.preventDefault()
          }
        >
          <IconPlayerPlay size={14} />
        </ActionIcon>
      </Group>

      {/* Admin controls - only show when not in replay mode */}
      {!replayMode && (
        <>
          <Group gap={4}>
            {/* Admin mode toggle */}
            {!managedLobby && (
              <Button
                size="compact-xs"
                variant={adminMode ? "outline" : "default"}
                color="imperial"
                aria-pressed={adminMode}
                onClick={handleAdminToggle}
                title="Toggle admin mode"
              >
                Admin
              </Button>
            )}

            {/* Pick for anyone - only when allowed */}
            {showPickForAnyoneControl && (
              <Button
                size="compact-xs"
                variant={pickForAnyone ? "outline" : "default"}
                color="imperial"
                aria-pressed={pickForAnyone}
                onClick={() => setPickForAnyone(!pickForAnyone)}
                title="Pick for any player"
              >
                Pick Any
              </Button>
            )}
          </Group>

          {/* Destructive/admin actions */}
          {(showUndoLastSelection || adminMode) && (
            <Group gap={4}>
              {showUndoLastSelection && (
                <Button
                  size="compact-xs"
                  variant="outline"
                  color="orange.3"
                  leftSection={<IconArrowBackUp size={12} />}
                  onClick={handleUndo}
                  disabled={selections.length === 0}
                  title="Undo last selection"
                >
                  Undo
                </Button>
              )}
              {adminMode && <ExportDraftState />}
            </Group>
          )}
        </>
      )}
    </Group>
  );

  return (
    <Stack>
      <AdminPasswordModal
        opened={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSubmit={handleAdminPasswordSubmit}
      />

      <SectionTitle title="Draft Order">
        <Box visibleFrom="xs">{ControlBar}</Box>
      </SectionTitle>

      {/* Mobile control bar - below title */}
      <Box hiddenFrom="xs">{ControlBar}</Box>

      <DraftOrder
        players={hydratedPlayers}
        pickOrder={pickOrder}
        currentPick={currentPick}
      />
    </Stack>
  );
}
