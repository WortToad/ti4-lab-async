import {
  Alert,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useContext, useState } from "react";
import { useDraft } from "~/draftStore";
import { factions } from "~/data/factionData";
import { useDraftApiMutation } from "~/hooks/useDraftApiMutation";
import { useSyncDraft } from "~/hooks/useSyncDraft";
import { AdminPasswordModal } from "~/routes/draft.$id/components/AdminPasswordModal";
import { DraftableFaction } from "~/routes/draft.$id/components/DraftableFaction";
import { useAdminControls } from "~/routes/draft.$id/components/useAdminControls";
import { LobbyIdentityContext } from "../LobbyIdentity";
import { getSelectedFactions } from "../keleres";
import {
  canRedrawTexasConflictingFaction,
  getTexasFactionConflict,
  getTexasFactionReplacementOptions,
} from "./factionConflict";
import { TEXAS_REDRAW_VALUE } from "./texasDraft";
import type { FactionId } from "~/types";

export function TexasFactionConflict() {
  const draft = useDraft((store) => store.draft);
  const draftId = useDraft((store) => store.draftId);
  const selectedPlayer = useDraft((store) => store.selectedPlayer);
  const lobby = useContext(LobbyIdentityContext);
  const mutation = useDraftApiMutation();
  const { undoLastPick, syncing } = useSyncDraft();
  const {
    adminMode,
    showUndoLastSelection,
    passwordModalOpen,
    setPasswordModalOpen,
    handleAdminPasswordSubmit,
    handleAdminToggle,
  } = useAdminControls();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState("");
  const conflict = getTexasFactionConflict(draft);
  if (!conflict) return null;
  const { primary } = getSelectedFactions(draft.selections);
  const affected =
    selectedPlayer !== undefined &&
    conflict.affectedPlayerIds.includes(selectedPlayer);
  const options = affected
    ? getTexasFactionReplacementOptions(draft, selectedPlayer)
    : [];
  const canRedraw =
    affected &&
    (draft.texasDraft?.canRedrawFactionConflict ??
      canRedrawTexasConflictingFaction(draft, selectedPlayer));
  const currentFaction =
    selectedPlayer !== undefined ? primary[selectedPlayer] : undefined;
  const disabled = mutation.busy || syncing || lobby?.paused;

  return (
    <Stack maw={1100} mx="auto" w="100%" p="md">
      <Title order={1} size="h2">
        Resolve the revealed faction conflict
      </Title>
      <Alert color="orange" title="Keleres needs an unused home faction">
        These revealed choices leave no available Mentak, Xxcha, or Argent home
        for Keleres. One affected player can choose a legal replacement to
        continue.
      </Alert>
      <Text size="sm">
        Seats, drafted tiles, and existing map placements are kept. Only the
        player who confirms a replacement changes faction.
      </Text>
      <Stack gap={4}>
        {conflict.affectedPlayerIds.map((id) => (
          <Text key={id} size="sm">
            {draft.players.find((player) => player.id === id)?.name}:{" "}
            {factions[primary[id]].name}
          </Text>
        ))}
      </Stack>
      {error && (
        <Alert role="alert" color="red">
          {error}
        </Alert>
      )}
      {affected && currentFaction ? (
        <>
          <Title order={2} size="h3">
            Your replacement choices
          </Title>
          <Text size="sm">
            You currently have {factions[currentFaction].name}. These unused
            alternatives from your original hand resolve the conflict. You can
            also keep your faction if another affected player changes theirs.
          </Text>
          {options.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {options.map((factionId) => (
                <DraftableFaction
                  key={factionId}
                  faction={factions[factionId]}
                  selectTitle="Choose replacement"
                  disabled={disabled}
                  onSelect={() => setConfirmation(factionId)}
                />
              ))}
            </SimpleGrid>
          )}
          {canRedraw && (
            <Button
              variant="light"
              disabled={disabled}
              onClick={() => setConfirmation(TEXAS_REDRAW_VALUE)}
            >
              Draw a legal replacement faction
            </Button>
          )}
          {options.length === 0 && !canRedraw && (
            <Alert color="blue">
              Your hand has no legal replacement. Another affected player can
              resolve the conflict from their own hand.
            </Alert>
          )}
        </>
      ) : (
        <Text>
          Waiting for an affected player to choose a replacement from their own
          account.
        </Text>
      )}
      <Text size="xs" c="dimmed">
        If the configured faction pool offers nobody a legal replacement, the
        admin will need to restore and revise that setup.
      </Text>
      {!lobby?.managed && (
        <Group>
          <Button variant="subtle" onClick={handleAdminToggle}>
            {adminMode ? "Exit admin mode" : "Admin"}
          </Button>
          {showUndoLastSelection && (
            <Button
              variant="light"
              color="orange"
              disabled={disabled}
              onClick={async () => {
                if (
                  confirm("Are you sure you want to undo the last selection?")
                )
                  await undoLastPick();
              }}
            >
              Undo last pick
            </Button>
          )}
          <AdminPasswordModal
            opened={passwordModalOpen}
            onClose={() => setPasswordModalOpen(false)}
            onSubmit={handleAdminPasswordSubmit}
          />
        </Group>
      )}
      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title="Confirm replacement faction"
        centered
      >
        {confirmation && currentFaction && (
          <Stack>
            <Text>
              {confirmation === TEXAS_REDRAW_VALUE
                ? `Replace ${factions[currentFaction].name} with a fresh legal faction from the draw pile? You must keep the faction drawn.`
                : `Replace ${factions[currentFaction].name} with ${factions[confirmation as FactionId].name}?`}
            </Text>
            <Text size="sm">
              All tile picks and map placements are preserved.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmation(null)}>
                Cancel
              </Button>
              <Button
                loading={mutation.busy}
                disabled={lobby?.paused}
                onClick={async () => {
                  const result = await mutation.submit(
                    `/api/draft/${draftId}/texas-faction-recovery`,
                    {
                      playerId: selectedPlayer ?? -1,
                      value: confirmation,
                      expectedFaction: currentFaction,
                      expectedSelectionCount: draft.selections.length,
                    },
                  );
                  setError(
                    result.success
                      ? ""
                      : (result.error ??
                          "Could not change your faction. Try again."),
                  );
                  setConfirmation(null);
                }}
              >
                Confirm replacement
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
