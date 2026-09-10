import {
  Alert,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useContext, useState } from "react";
import { useDraft } from "~/draftStore";
import { useDraftApiMutation } from "~/hooks/useDraftApiMutation";
import { factions } from "~/data/factionData";
import { factionSystems } from "~/data/systemData";
import { SystemTileCard } from "~/components/SystemTileCard";
import { LobbyIdentityContext } from "./LobbyIdentity";
import {
  getBaseKeleresSetup,
  keleresHeroNames,
  type KeleresHomeFaction,
} from "./keleres";

export function KeleresHomeSetup() {
  const draft = useDraft((state) => state.draft);
  const draftId = useDraft((state) => state.draftId);
  const selectedPlayer = useDraft((state) => state.selectedPlayer);
  const lobby = useContext(LobbyIdentityContext);
  const mutation = useDraftApiMutation();
  const [confirmation, setConfirmation] = useState<KeleresHomeFaction | null>(
    null,
  );
  const [error, setError] = useState("");
  const setup = getBaseKeleresSetup(draft);
  if (!setup?.ready) return null;
  const player = draft.players.find((p) => p.id === setup.playerId)!;
  const owns = selectedPlayer === player.id;
  if (setup.chosen)
    return (
      <Alert color="teal" title="Keleres home selected">
        {player.name}: {factions[setup.chosen].name} home ·{" "}
        {keleresHeroNames[setup.chosen]}. The admin can undo this home choice
        before changing it.
      </Alert>
    );
  return (
    <Stack>
      <Paper withBorder p="md" radius="md">
        <Stack>
          <Title order={2}>Choose the Keleres home and hero</Title>
          <Text>
            {owns ? "Choose" : `${player.name} chooses`} an unplayed Mentak,
            Xxcha, or Argent home and its Keleres hero to finish the map.
            Drafted minor factions also occupy their home tiles.
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          {setup.choices.length === 0 ? (
            <Alert color="red">
              This saved draft uses all three Keleres homes. The admin can
              restore a checkpoint before the conflicting faction pick from
              Manage lobby, or undo picks until a different faction can be
              selected. Existing picks are preserved until then.
            </Alert>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: setup.choices.length }}>
              {setup.choices.map((home) => (
                <Stack key={home} align="center">
                  <Text fw={600}>{factions[home].name}</Text>
                  <SystemTileCard
                    systemId={factionSystems[home].id}
                    radius={75}
                  />
                  <Text size="sm">Hero: {keleresHeroNames[home]}</Text>
                  <Button
                    disabled={!owns || mutation.busy || lobby?.paused}
                    onClick={() => setConfirmation(home)}
                  >
                    Choose {factions[home].name} home
                  </Button>
                </Stack>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Paper>
      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title="Confirm Keleres home"
        centered
      >
        {confirmation && (
          <Stack>
            <Text>
              Choose the {factions[confirmation].name} home and{" "}
              {keleresHeroNames[confirmation]} as your hero?
            </Text>
            <Group justify="center">
              <SystemTileCard
                systemId={factionSystems[confirmation].id}
                radius={85}
              />
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmation(null)}>
                Cancel
              </Button>
              <Button
                loading={mutation.busy}
                onClick={async () => {
                  const result = await mutation.submit(
                    `/api/draft/${draftId}/keleres-home`,
                    {
                      playerId: player.id,
                      home: confirmation,
                      expectedSelectionCount: draft.selections.length,
                    },
                  );
                  setError(
                    result.success
                      ? ""
                      : (result.error ?? "Could not choose your home."),
                  );
                  setConfirmation(null);
                }}
              >
                Confirm home
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
