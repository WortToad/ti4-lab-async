import { SimpleGrid, Stack, Text } from "@mantine/core";
import { factions as allFactions } from "~/data/factionData";
import { Section, SectionTitle } from "~/components/Section";
import { DraftableFaction } from "../components/DraftableFaction";
import { useDraft } from "~/draftStore";
import { useHydratedDraft } from "~/hooks/useHydratedDraft";
import { useSyncDraft } from "~/hooks/useSyncDraft";
import { canCompleteFactionDraft } from "~/draft/factionFeasibility";

export function DraftableMinorFactionsSection() {
  const draft = useDraft((state) => state.draft);
  const factions = useDraft((state) => state.draft.availableMinorFactions);
  const { selectMinorFaction } = useDraft((state) => state.draftActions);
  const { hydratedPlayers, currentlyPicking, activePlayer } =
    useHydratedDraft();

  const { syncDraft } = useSyncDraft();
  const canSelect =
    currentlyPicking &&
    !!activePlayer &&
    activePlayer.minorFaction === undefined;

  if (!factions) return null;
  return (
    <Section>
      <SectionTitle title="Available Minor Factions" />
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 3, xl: 4 }}>
        {factions.map((factionId) => {
          const blocked =
            factionId === "keleres" ||
            !canCompleteFactionDraft(draft, {
              type: "SELECT_MINOR_FACTION",
              playerId: activePlayer?.id ?? -1,
              minorFactionId: factionId,
            });
          const player = hydratedPlayers.find(
            (p) => p.minorFaction === factionId,
          );
          return (
            <Stack key={factionId} gap={4}>
              <DraftableFaction
                key={factionId}
                player={player}
                disabled={!!player || blocked}
                faction={allFactions[factionId]}
                onSelect={
                  canSelect && !blocked
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
              {!player && blocked && (
                <Text size="xs" c="orange">
                  {factionId === "keleres"
                    ? "Keleres has no fixed home and cannot be a minor faction."
                    : "Unavailable: preserve enough legal faction picks and an unplayed Keleres home."}
                </Text>
              )}
            </Stack>
          );
        })}
      </SimpleGrid>
    </Section>
  );
}
