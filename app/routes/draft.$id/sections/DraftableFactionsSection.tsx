import { Badge, Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { factions as allFactions, playerColors } from "~/data/factionData";
import { Section, SectionTitle } from "~/components/Section";
import { DraftableFaction } from "../components/DraftableFaction";
import { useDraft } from "~/draftStore";
import { useHydratedDraft } from "~/hooks/useHydratedDraft";
import { useSyncDraft } from "~/hooks/useSyncDraft";
import { FactionId, PlayerId } from "~/types";
import { Surface, PlayerColor } from "~/ui";
import { canCompleteFactionDraft } from "~/draft/factionFeasibility";

export function DraftableFactionsSection() {
  const playerFactionPool = useDraft((state) => state.draft.playerFactionPool);

  return (
    <Section>
      <SectionTitle title="Available Factions" />
      <Box pt={4}>
        {!!playerFactionPool && (
          <GroupedFactionSelection playerFactionPools={playerFactionPool} />
        )}
        {!playerFactionPool && <PoolFactionSelection />}
      </Box>
    </Section>
  );
}

function PoolFactionSelection() {
  const draft = useDraft((state) => state.draft);
  const factions = useDraft((state) => state.draft.availableFactions);
  const minorFactionsInSharedPool = useDraft(
    (state) => state.draft.settings.minorFactionsInSharedPool,
  );
  const { selectFaction, selectMinorFaction } = useDraft(
    (state) => state.draftActions,
  );
  const { hydratedPlayers, currentlyPicking, activePlayer } =
    useHydratedDraft();

  const { syncDraft } = useSyncDraft();
  const canSelect =
    currentlyPicking && !!activePlayer && activePlayer.faction === undefined;
  const canSelectMinor =
    currentlyPicking &&
    !!activePlayer &&
    activePlayer.minorFaction === undefined;

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 3, xl: 4 }}>
      {factions.map((factionId) => {
        const primaryCandidate = {
          type: "SELECT_FACTION" as const,
          playerId: activePlayer?.id ?? -1,
          factionId,
        };
        const minorCandidate = {
          type: "SELECT_MINOR_FACTION" as const,
          playerId: activePlayer?.id ?? -1,
          minorFactionId: factionId,
        };
        const primaryBlocked = !canCompleteFactionDraft(
          draft,
          primaryCandidate,
        );
        const minorBlocked =
          factionId === "keleres" ||
          !canCompleteFactionDraft(draft, minorCandidate);
        const blocked =
          !(canSelect && !primaryBlocked) &&
          !(canSelectMinor && minorFactionsInSharedPool && !minorBlocked);
        const player = hydratedPlayers.find(
          (p) => p.faction === factionId || p.minorFaction === factionId,
        );

        return (
          <Stack key={factionId} gap={4}>
            <DraftableFaction
              key={factionId}
              player={player}
              disabled={!!player || blocked}
              faction={allFactions[factionId]}
              onSelect={
                canSelect && !primaryBlocked
                  ? () => {
                      if (
                        confirm(
                          `Selecting faction ${allFactions[factionId].name}`,
                        )
                      ) {
                        selectFaction(activePlayer.id, factionId);
                        syncDraft();
                      }
                    }
                  : undefined
              }
              onSelectMinor={
                canSelectMinor && minorFactionsInSharedPool && !minorBlocked
                  ? () => {
                      if (
                        confirm(
                          `Selecting minor faction ${allFactions[factionId].name}`,
                        )
                      ) {
                        selectMinorFaction(activePlayer.id, factionId);
                        syncDraft();
                      }
                    }
                  : undefined
              }
            />
            {!player &&
              currentlyPicking &&
              blocked &&
              (primaryBlocked || minorBlocked) && (
                <Text size="xs" c="orange">
                  Unavailable: preserve an unplayed Keleres home and enough
                  fixed homes for minor picks.
                </Text>
              )}
            {!player &&
              factionId === "keleres" &&
              minorFactionsInSharedPool && (
                <Text size="xs" c="dimmed">
                  Keleres can be your main faction, but has no fixed minor home.
                </Text>
              )}
          </Stack>
        );
      })}
    </SimpleGrid>
  );
}

type GroupedFactionSelectionProps = {
  playerFactionPools: Record<PlayerId, FactionId[]>;
};

function GroupedFactionSelection({
  playerFactionPools,
}: GroupedFactionSelectionProps) {
  const draft = useDraft((state) => state.draft);
  const { hydratedPlayers, currentlyPicking, activePlayer } =
    useHydratedDraft();
  const { selectFaction } = useDraft((state) => state.draftActions);
  const { syncDraft } = useSyncDraft();
  const canSelect =
    currentlyPicking && !!activePlayer && activePlayer.faction === undefined;

  return Object.entries(playerFactionPools).map(([playerId, factions]) => {
    const player = hydratedPlayers.find((p) => p.id === Number(playerId))!;
    const color = playerColors[player.id] as PlayerColor;
    return (
      <Stack key={playerId} gap="xs" style={{ position: "relative" }}>
        {!player.faction && (
          <Badge
            color={color}
            size="md"
            style={{ position: "absolute", right: 0 }}
          >
            {player.name}
          </Badge>
        )}

        <Surface
          variant={!player.faction ? "badge" : "flat"}
          color={!player.faction ? color : undefined}
        >
          <Group p="md">
            {factions.map((factionId) => {
              const candidate = {
                type: "SELECT_FACTION" as const,
                playerId: player.id,
                factionId,
              };
              const blocked = !canCompleteFactionDraft(draft, candidate);
              return (
                <Box miw="250px" key={factionId}>
                  <DraftableFaction
                    key={factionId}
                    player={player.faction === factionId ? player : undefined}
                    disabled={
                      blocked ||
                      (!!player.faction && player.faction !== factionId)
                    }
                    faction={allFactions[factionId]}
                    onSelect={
                      canSelect && player.id === activePlayer.id && !blocked
                        ? () => {
                            if (
                              confirm(
                                `Selecting faction ${allFactions[factionId].name}`,
                              )
                            ) {
                              selectFaction(activePlayer.id, factionId);
                              syncDraft();
                            }
                          }
                        : undefined
                    }
                  />
                  {!player.faction && blocked && (
                    <Text size="xs" c="orange">
                      Unavailable: preserve an unplayed Keleres home and enough
                      fixed homes for minor picks.
                    </Text>
                  )}
                </Box>
              );
            })}
          </Group>
        </Surface>
      </Stack>
    );
  });
}
