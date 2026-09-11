import { Button, Grid, SimpleGrid, Stack, Text } from "@mantine/core";
import { CurrentPickBanner } from "../components/CurrentPickBanner";
import { DraftOrderSection } from "./DraftOrderSection";
import { SectionTitle } from "~/components/Section";
import { useDraft } from "~/draftStore";
import { DraftableFaction } from "../components/DraftableFaction";
import { factions as allFactions } from "~/data/factionData";
import { useMemo } from "react";
import { useSyncDraft } from "~/hooks/useSyncDraft";
import { useHydratedDraft } from "~/hooks/useHydratedDraft";
import { PlayerInputSection } from "~/routes/draft.new/components/PlayerInputSection";
import {
  getFactionBanError,
  getFactionBanSource,
} from "~/utils/factionSourceValidation";
import { useSafeOutletContext } from "~/useSafeOutletContext";

export function BanPhase() {
  const { adminMode } = useSafeOutletContext();
  const draft = useDraft((state) => state.draft);
  const players = draft.players;
  const { banFaction } = useDraft((state) => state.draftActions);
  const { updatePlayerName } = useDraft((state) => state.actions);
  const sortedFactionPool = useMemo(() => {
    return getFactionBanSource({
      settings: draft.settings,
      availableMinorFactions: draft.availableMinorFactions,
    }).sort((a, b) => {
      const aFaction = allFactions[a];
      const bFaction = allFactions[b];
      return aFaction.name.localeCompare(bFaction.name);
    });
  }, [draft.settings, draft.availableMinorFactions]);

  const { syncDraft, syncing } = useSyncDraft();

  const { currentlyPicking, hydratedPlayers, activePlayer } =
    useHydratedDraft();
  const canSelect = currentlyPicking && !!activePlayer;

  return (
    <>
      <Stack gap="sm" mb="60" mt="lg">
        <CurrentPickBanner
          title={`It's ${activePlayer?.name}'s turn to ban!`}
        />
        <div style={{ height: 15 }} />
      </Stack>
      <Grid gutter="xl">
        <Grid.Col span={12}>
          <DraftOrderSection />
        </Grid.Col>
        <Grid.Col span={12}>
          <SectionTitle title="Ban Phase" />
          <SimpleGrid
            type="container"
            cols={{ base: 1, "440px": 2, "700px": 3, "960px": 4 }}
            spacing="xs"
            mt="md"
          >
            {sortedFactionPool.map((factionId) => {
              const player = hydratedPlayers.find((p) =>
                p.bannedFactions?.includes(factionId),
              );
              const banError = player
                ? undefined
                : getFactionBanError(draft, factionId);
              return (
                <Stack key={factionId} gap={4}>
                  <DraftableFaction
                    player={player}
                    disabled={!!player || !!banError || syncing}
                    selectTitle={"Ban"}
                    faction={allFactions[factionId]}
                    onSelect={
                      canSelect && !player && !banError && !syncing
                        ? () => {
                            if (
                              confirm(
                                `Banning faction ${allFactions[factionId].name}`,
                              )
                            ) {
                              banFaction(activePlayer.id, factionId);
                              syncDraft();
                            }
                          }
                        : undefined
                    }
                  />
                  {banError && (
                    <Text size="xs" c="dimmed">
                      {banError}
                    </Text>
                  )}
                </Stack>
              );
            })}
          </SimpleGrid>
        </Grid.Col>
        {adminMode && (
          <Grid.Col offset={6} span={6} order={{ base: 7 }}>
            <PlayerInputSection
              players={players}
              onChangeName={(playerIdx, name) => {
                updatePlayerName(playerIdx, name);
              }}
            />
            <Button mt="lg" onClick={syncDraft} loading={syncing}>
              Save
            </Button>
          </Grid.Col>
        )}
      </Grid>
    </>
  );
}
