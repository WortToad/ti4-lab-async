import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router";
import { Map as DraftMap, MAP_INTERACTIONS } from "~/components/Map";
import { SystemTileCard } from "~/components/SystemTileCard";
import { StartingUnitsTable } from "~/components/StartingUnitsTable";
import { factions, twilightsFallFactionIds } from "~/data/factionData";
import { BagItemCard, bagCategoryLabel } from "~/draft/bag/BagComponents";
import {
  rawActivePlayer,
  rawFactionPool,
  rawHomeChoices,
  rawLegalPositions,
  rawSplicePool,
  type RawAction,
  type RawPhase,
} from "~/draft/raw/engine";
import { rawReferenceFaction } from "~/draft/raw/referenceCards";
import { loadRawRoom, actRawRoom } from "~/drizzle/rawDraft.server";
import {
  encodeAsyncMapString,
  encodeTtpgMapString,
} from "~/mapgen/utils/externalMapStringCodec";
import { NewDraftReferenceCard } from "~/routes/draft.new/components/NewDraftReferenceCard";
import type { FactionId } from "~/types";
import { LobbyPanel, type LobbyOperation } from "~/draft/LobbyPanel";

export const loader = loadRawRoom;
export const action = actRawRoom;

const phases: Record<RawPhase, { title: string; instructions: string }> = {
  factions: {
    title: "Choose factions",
    instructions:
      "Each player chooses a faction. Once everyone has chosen, the system tiles are dealt privately and galaxy construction begins.",
  },
  referenceDraft: {
    title: "Draft faction reference cards",
    instructions:
      "Choose one card to keep facedown. Once everyone is ready, pass the remaining cards to the left. Choose again, then receive the final card.",
  },
  priority: {
    title: "Choose priority cards",
    instructions:
      "Choose one of your three cards. Everyone reveals simultaneously; the lowest priority number becomes speaker and the other players sit clockwise in increasing priority order.",
  },
  mapPreplace: {
    title: "Place the extra systems",
    instructions:
      "The speaker places these extra tiles next to Mecatol Rex before players start placing their dealt hands.",
  },
  map: {
    title: "Build the galaxy",
    instructions:
      "Choose any tile from your hand and place it in a highlighted position. Fill the innermost unfinished ring first. Placement starts with the speaker, goes clockwise, then reverses each round with the end player placing twice.",
  },
  homes: {
    title: "Choose home systems",
    instructions:
      "Starting with the speaker and proceeding clockwise, choose one remaining faction card for your home system. Your final card determines your starting units.",
  },
  kings: {
    title: "Choose Mahact kings",
    instructions:
      "Starting with the player to the right of the speaker and proceeding counterclockwise, each player chooses a Mahact king. The speaker chooses last.",
  },
  splice: {
    title: "Inaugural splice",
    instructions:
      "Choose one card, then pass right when everyone is ready. Draft three abilities, two unit upgrades and two genomes. Players with no eligible card pass automatically.",
  },
  spliceKeep: {
    title: "Choose starting capabilities",
    instructions:
      "Keep two abilities, one unit upgrade and one genome from your drafted cards. Everyone reveals their starting cards simultaneously when all players finish.",
  },
  complete: {
    title: "Setup complete",
    instructions:
      "Your factions and galaxy are ready. Export the map and setup results below.",
  },
};

const spliceCards = rawSplicePool();
const spliceById = new Map(spliceCards.map((item) => [item.id, item]));
const spliceLimits: Record<string, number> = { TECH: 3, AGENT: 2, UNIT: 2 };
const keepLimits: Record<string, number> = { TECH: 2, AGENT: 1, UNIT: 1 };
const factionName = (id?: FactionId) => (id ? (factions[id]?.name ?? id) : "—");

type RawRoomData = Awaited<ReturnType<typeof loader>>["data"];

export default function RawRoom() {
  const room = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        revalidator.state === "idle" &&
        fetcher.state === "idle"
      )
        void revalidator.revalidate();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [revalidator, fetcher.state]);
  const operation = (op: LobbyOperation) => {
    const { type, ...extra } = op;
    const intent =
      type === "restore"
        ? "restoreCheckpoint"
        : type === "import"
          ? "importState"
          : type === "undo"
            ? "undoAction"
            : type;
    fetcher.submit(
      {
        intent,
        revision: String(room.revision),
        ...Object.fromEntries(
          Object.entries(extra).map(([k, v]) => [k, String(v)]),
        ),
      },
      { method: "post" },
    );
  };
  return (
    <Stack gap="lg">
      <Container size="xl" w="100%" py="lg" className="ph-no-capture">
        <LobbyPanel
          lobby={room.lobby}
          mode="raw"
          lobbyId={room.id}
          ownPlayerId={room.ownPlayers[0]}
          isAdmin={room.isHost}
          busy={fetcher.state !== "idle"}
          error={fetcher.data?.error}
          exportState={fetcher.data?.backup ?? undefined}
          onOperation={operation}
        />
      </Container>
      {room.draft && <RawGame room={{ ...room, draft: room.draft }} />}
    </Stack>
  );
}

function RawGame({
  room,
}: {
  room: RawRoomData & { draft: NonNullable<RawRoomData["draft"]> };
}) {
  const { draft } = room;
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [undoOpen, setUndoOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const activeId = rawActivePlayer(draft);
  const playerId = room.ownPlayers[0];
  const player = draft.players.find((entry) => entry.id === playerId);
  const controlled = playerId !== undefined;
  const busy = fetcher.state !== "idle";
  const canAct =
    controlled &&
    !busy &&
    !room.lobby.paused &&
    (activeId === undefined || activeId === playerId) &&
    draft.phase !== "complete";
  const hand =
    playerId === undefined
      ? []
      : draft.phase === "mapPreplace"
        ? draft.preplace
        : (draft.hands[playerId] ?? []);
  const reference =
    playerId === undefined ? undefined : draft.references[playerId];
  const splice = playerId === undefined ? undefined : draft.splice[playerId];
  const tile =
    selectedTile && hand.includes(selectedTile) ? selectedTile : null;
  const positions =
    tile && playerId !== undefined && canAct
      ? rawLegalPositions(draft, playerId, tile)
      : [];
  const mapPhase = draft.phase === "map" || draft.phase === "mapPreplace";
  const details =
    draft.phase === "homes" && draft.settings.mode === "base"
      ? {
          title: "Choose the Keleres home system",
          instructions:
            "Choose an available unplayed home system for the Council Keleres.",
        }
      : phases[draft.phase];
  const referenceOptions =
    draft.phase === "homes" && playerId !== undefined
      ? rawHomeChoices(draft, playerId)
      : draft.phase === "referenceDraft"
        ? (reference?.hand ?? [])
        : (reference?.drafted ?? []);
  const referenceAction =
    draft.phase === "referenceDraft"
      ? "pickReference"
      : draft.phase === "priority"
        ? "choosePriority"
        : "chooseHome";
  const ready =
    draft.phase === "factions"
      ? !!draft.factions[playerId!]
      : draft.phase === "referenceDraft" || draft.phase === "priority"
        ? room.referenceReady[playerId!]
        : draft.phase === "splice" || draft.phase === "spliceKeep"
          ? room.spliceReady[playerId!]
          : false;

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        revalidator.state === "idle" &&
        fetcher.state === "idle"
      )
        revalidator.revalidate();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [revalidator, fetcher.state]);

  useEffect(() => {
    setSelectedTile(null);
    setKept([]);
  }, [playerId, draft.phase, room.revision]);

  const submit = (intent: string, extra: Record<string, string> = {}) => {
    fetcher.submit(
      {
        intent,
        revision: String(room.revision),
        playerId: String(playerId),
        ...extra,
      },
      { method: "post" },
    );
  };
  const pick = (choice: RawAction) => {
    if (!canAct) return;
    submit("pick", { action: JSON.stringify(choice) });
  };
  const place = (position: number) => {
    if (tile && playerId !== undefined)
      pick({ type: "placeSystem", playerId, systemId: tile, position });
  };
  const keepValid =
    Object.entries(keepLimits).every(
      ([category, count]) =>
        kept.filter((id) => spliceById.get(id)?.category === category)
          .length === count,
    ) && kept.length === 4;

  return (
    <Container size="xl" py="lg" className="ph-no-capture">
      <Stack gap="lg">
        <Anchor component={Link} to="/draft/prechoice" size="sm">
          ← All draft formats
        </Anchor>
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2">
              {draft.settings.mode === "twilightsFall"
                ? "Twilight’s Fall"
                : "TI4"}{" "}
              · Rules as written
            </Title>
            <Text size="sm" c="dimmed">
              Official starting draft and galaxy construction
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setShareMessage(
                    "Room link copied. Players can choose their name and join.",
                  );
                } catch {
                  setShareMessage(
                    "Share this page’s address with your players.",
                  );
                }
              }}
            >
              Copy invite link
            </Button>
            {room.isHost && (
              <Button
                color="red"
                variant="light"
                disabled={busy || !room.canUndo}
                onClick={() => setUndoOpen(true)}
              >
                Undo last action
              </Button>
            )}
          </Group>
        </Group>
        {shareMessage && <Text size="sm">{shareMessage}</Text>}
        {fetcher.data?.error && <Alert color="red">{fetcher.data.error}</Alert>}
        <Paper withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Group>
              <Badge>
                {draft.phase === "complete" ? "Complete" : "In progress"}
              </Badge>
              <Title order={2} size="h3">
                {details.title}
              </Title>
            </Group>
            <Text size="sm">{details.instructions}</Text>
            {activeId !== undefined && (
              <Text fw={600}>
                {draft.players.find((entry) => entry.id === activeId)?.name}’s
                turn
              </Text>
            )}
            {controlled && ready && (
              <Text c="teal" size="sm">
                Your choice is submitted. Waiting for the other players.
              </Text>
            )}
          </Stack>
        </Paper>
        {!controlled && draft.phase !== "complete" && (
          <Text size="sm" c="dimmed">
            Join the lobby above, or rejoin with your UUID, to see your
            private hand and make choices. Spectators can watch the shared map.
          </Text>
        )}
        <Table.ScrollContainer minWidth={650}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Player</Table.Th>
                <Table.Th>Seat / speaker</Table.Th>
                <Table.Th>
                  {draft.settings.mode === "twilightsFall"
                    ? "Priority / king"
                    : "Faction"}
                </Table.Th>
                <Table.Th>Tiles left</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {draft.players.map((entry) => {
                const pendingSeats =
                  draft.phase === "referenceDraft" ||
                  draft.phase === "priority";
                const isReady =
                  draft.phase === "factions"
                    ? !!draft.factions[entry.id]
                    : draft.phase === "referenceDraft" ||
                        draft.phase === "priority"
                      ? room.referenceReady[entry.id]
                      : draft.phase === "splice" || draft.phase === "spliceKeep"
                        ? room.spliceReady[entry.id]
                        : false;
                return (
                  <Table.Tr key={entry.id}>
                    <Table.Td fw={entry.id === activeId ? 700 : 400}>
                      {entry.name}
                    </Table.Td>
                    <Table.Td>
                      {pendingSeats
                        ? "Pending priority reveal"
                        : draft.speaker === entry.id
                          ? "Speaker (1)"
                          : draft.order.indexOf(entry.id) + 1}
                    </Table.Td>
                    <Table.Td>
                      {draft.settings.mode === "twilightsFall" ? (
                        <>
                          {factionName(draft.priorities[entry.id])}
                          {draft.kings[entry.id] && (
                            <Text size="xs">
                              {factionName(draft.kings[entry.id])}
                            </Text>
                          )}
                        </>
                      ) : (
                        factionName(draft.factions[entry.id])
                      )}
                    </Table.Td>
                    <Table.Td>{room.handCounts[entry.id] ?? 0}</Table.Td>
                    <Table.Td>
                      {draft.phase === "complete"
                        ? "Complete"
                        : entry.id === activeId
                          ? "Your turn"
                          : isReady
                            ? "Ready"
                            : "—"}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {draft.phase === "factions" && (
          <Stack gap="sm">
            <Title order={3}>Factions</Title>
            <Group gap="xs">
              {rawFactionPool(draft.settings).map((id) => (
                <Button
                  key={id}
                  variant="light"
                  disabled={
                    !canAct ||
                    ready ||
                    Object.values(draft.factions).includes(id)
                  }
                  onClick={() =>
                    pick({
                      type: "chooseFaction",
                      playerId: playerId!,
                      factionId: id,
                    })
                  }
                >
                  {factionName(id)}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
        {controlled &&
          ["referenceDraft", "priority", "homes"].includes(draft.phase) && (
            <Stack>
              <Title order={3}>{player?.name}’s faction cards</Title>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {referenceOptions.map((id) => (
                  <Stack key={id} gap="xs">
                    <NewDraftReferenceCard
                      faction={rawReferenceFaction(id, draft.settings.pok)}
                    />
                    {id === "keleres" && (
                      <Text size="sm">
                        As a home-system card, Keleres draws a random unused
                        faction card and uses that home system.
                      </Text>
                    )}
                    <Button
                      variant="light"
                      disabled={!canAct || (draft.phase !== "homes" && ready)}
                      onClick={() =>
                        pick({
                          type: referenceAction,
                          playerId: playerId!,
                          factionId: id,
                        })
                      }
                    >
                      {draft.phase === "priority"
                        ? "Use for priority"
                        : draft.phase === "homes"
                          ? "Use for home system"
                          : "Keep this card"}
                    </Button>
                  </Stack>
                ))}
              </SimpleGrid>
              {draft.phase === "referenceDraft" &&
                !!reference?.drafted.length && (
                  <Text size="sm">
                    Kept so far: {reference.drafted.map(factionName).join(", ")}
                  </Text>
                )}
            </Stack>
          )}
        {draft.phase === "kings" && (
          <Stack gap="sm">
            <Title order={3}>Mahact kings</Title>
            <Group>
              {twilightsFallFactionIds.map((id) => (
                <Button
                  key={id}
                  variant="light"
                  disabled={!canAct || Object.values(draft.kings).includes(id)}
                  onClick={() =>
                    pick({
                      type: "chooseKing",
                      playerId: playerId!,
                      factionId: id,
                    })
                  }
                >
                  {factionName(id)}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
        {mapPhase && controlled && (
          <Stack gap="sm">
            <Title order={3}>
              {draft.phase === "mapPreplace"
                ? "Extra systems"
                : `${player?.name}’s tile hand`}
            </Title>
            <Text size="sm">
              Select a tile, then choose a highlighted map position. Matching
              wormholes and anomalies cannot be adjacent to their counterparts
              unless your remaining tiles leave no other option.
            </Text>
            <Group gap="sm">
              {hand.map((id) => (
                <Button
                  key={id}
                  variant={tile === id ? "light" : "transparent"}
                  h="auto"
                  p={4}
                  disabled={!canAct}
                  aria-label={`Select tile ${id}`}
                  aria-pressed={tile === id}
                  onClick={() => setSelectedTile(id)}
                >
                  <SystemTileCard systemId={id} radius={55} />
                </Button>
              ))}
            </Group>
            {tile && (
              <Text size="sm" fw={600}>
                {positions.length
                  ? `Tile ${tile} selected · choose one of ${positions.length} legal positions.`
                  : "This tile has no legal position. Choose another tile from your hand."}
              </Text>
            )}
          </Stack>
        )}
        {!["factions", "referenceDraft", "priority"].includes(draft.phase) && (
          <Stack gap="sm">
            <Box w="100%" maw={850} style={{ aspectRatio: "1 / 1" }} mx="auto">
              <DraftMap
                id="raw-map"
                map={draft.map}
                modifiableMapTiles={positions}
                ringHighlightTiles={positions}
                disabled={!canAct || !mapPhase || !tile}
                interactions={{
                  ...MAP_INTERACTIONS.draftBuild,
                  droppable: false,
                  allowSystemDelete: false,
                  allowSystemSelect: false,
                }}
                onSelectSystemTile={(position) => place(position.idx)}
              />
            </Box>
            {!!positions.length && (
              <Group gap="xs" aria-label="Legal map positions">
                {positions.map((position) => (
                  <Button
                    key={position}
                    variant="light"
                    size="xs"
                    disabled={busy}
                    onClick={() => place(position)}
                  >
                    Place at {position}
                  </Button>
                ))}
              </Group>
            )}
          </Stack>
        )}
        {controlled &&
          splice &&
          (draft.phase === "splice" || draft.phase === "spliceKeep") && (
            <Stack>
              <Title order={3}>
                {player?.name}’s{" "}
                {draft.phase === "splice" ? "splice hand" : "drafted cards"}
              </Title>
              <Group>
                {Object.entries(
                  draft.phase === "splice" ? spliceLimits : keepLimits,
                ).map(([category, count]) => (
                  <Badge key={category} variant="light">
                    {bagCategoryLabel(
                      category as "TECH" | "AGENT" | "UNIT",
                      "inaugural_splice",
                    )}
                    :{" "}
                    {
                      (draft.phase === "splice" ? splice.drafted : kept).filter(
                        (id) => spliceById.get(id)?.category === category,
                      ).length
                    }
                    /{count}
                  </Badge>
                ))}
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {(draft.phase === "splice" ? splice.hand : splice.drafted).map(
                  (id) => {
                    const item = spliceById.get(id);
                    if (!item) return null;
                    const atLimit =
                      splice.drafted.filter(
                        (drafted) =>
                          spliceById.get(drafted)?.category === item.category,
                      ).length >= spliceLimits[item.category];
                    return (
                      <Stack key={id} gap="xs">
                        <BagItemCard
                          item={item}
                          note={bagCategoryLabel(
                            item.category,
                            "inaugural_splice",
                          )}
                          selected={kept.includes(id)}
                          disabled={!canAct || ready}
                          onSelect={
                            draft.phase === "spliceKeep"
                              ? (selected) =>
                                  setKept((current) =>
                                    selected
                                      ? [...current, id]
                                      : current.filter((entry) => entry !== id),
                                  )
                              : undefined
                          }
                        />
                        {draft.phase === "splice" && (
                          <Button
                            variant="light"
                            disabled={!canAct || ready || atLimit}
                            onClick={() =>
                              pick({
                                type: "pickSplice",
                                playerId: playerId!,
                                itemId: id,
                              })
                            }
                          >
                            Keep {item.name}
                          </Button>
                        )}
                      </Stack>
                    );
                  },
                )}
              </SimpleGrid>
              {draft.phase === "spliceKeep" && (
                <Button
                  disabled={!canAct || ready || !keepValid}
                  onClick={() =>
                    pick({
                      type: "keepSplice",
                      playerId: playerId!,
                      itemIds: kept,
                    })
                  }
                >
                  Confirm starting cards
                </Button>
              )}
              {draft.phase === "splice" && !!splice.drafted.length && (
                <Text size="sm">
                  Drafted so far:{" "}
                  {splice.drafted
                    .map((id) => spliceById.get(id)?.name ?? id)
                    .join(", ")}
                </Text>
              )}
            </Stack>
          )}
        {draft.phase === "complete" && (
          <Stack>
            <Title order={3}>Setup results</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {draft.order.map((id) => (
                <Paper key={id} withBorder p="md" radius="md">
                  <Stack gap="xs">
                    <Title order={4}>
                      {draft.players.find((entry) => entry.id === id)?.name}
                      {id === draft.speaker ? " · Speaker" : ""}
                    </Title>
                    <Text size="sm">
                      {draft.settings.mode === "twilightsFall"
                        ? factionName(draft.kings[id])
                        : factionName(draft.factions[id])}
                    </Text>
                    {!!draft.tradeGoods[id] && (
                      <Text size="sm">
                        Starting trade goods: {draft.tradeGoods[id]}
                      </Text>
                    )}
                    {draft.settings.mode === "base" &&
                      draft.factions[id] === "keleres" && (
                        <Text size="sm">
                          Home system: {factionName(draft.homes[id])}
                        </Text>
                      )}
                    {["creuss", "crimson"].includes(draft.homes[id]) && (
                      <Text size="sm">
                        {draft.homes[id] === "creuss"
                          ? "Place Creuss (51) off the board; Creuss Gate (17) is on the map."
                          : "Place Ahk Creuxx (118) off the board; The Sorrow (94) is on the map."}
                        {draft.settings.mode === "twilightsFall" &&
                          " Take the matching permanent Echo card."}
                      </Text>
                    )}
                    {draft.settings.mode === "twilightsFall" && (
                      <>
                        <Text size="sm">
                          Home system: {factionName(draft.homes[id])}
                        </Text>
                        <Text size="sm">
                          Starting units: {factionName(draft.fleets[id])}
                        </Text>
                        {rawReferenceFaction(
                          draft.fleets[id],
                          draft.settings.pok,
                        ).fleetComposition && (
                          <StartingUnitsTable
                            fleetComposition={
                              rawReferenceFaction(
                                draft.fleets[id],
                                draft.settings.pok,
                              ).fleetComposition!
                            }
                            showTitle={false}
                          />
                        )}
                        {draft.splice[id]?.kept?.map((itemId) => {
                          const item = spliceById.get(itemId);
                          return item ? (
                            <BagItemCard
                              key={itemId}
                              item={item}
                              note={bagCategoryLabel(
                                item.category,
                                "inaugural_splice",
                              )}
                            />
                          ) : null;
                        })}
                      </>
                    )}
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
            <Textarea
              label="Async map string"
              readOnly
              value={encodeAsyncMapString(draft.map)}
              autosize
            />
            <Textarea
              label="Tabletop Playground map string"
              readOnly
              value={encodeTtpgMapString(draft.map)}
              autosize
            />
            <Button
              variant="light"
              onClick={() => {
                const results = {
                  format: "ti4-raw",
                  version: 1,
                  settings: draft.settings,
                  players: draft.players,
                  order: draft.order,
                  speaker: draft.speaker,
                  map: draft.map,
                  factions: draft.factions,
                  priorities: draft.priorities,
                  homes: draft.homes,
                  fleets: draft.fleets,
                  startingUnits: Object.fromEntries(
                    draft.order.map((id) => [
                      id,
                      rawReferenceFaction(draft.fleets[id], draft.settings.pok)
                        .fleetComposition,
                    ]),
                  ),
                  kings: draft.kings,
                  tradeGoods: draft.tradeGoods,
                  startingCards: Object.fromEntries(
                    draft.order.map((id) => [id, draft.splice[id]?.kept ?? []]),
                  ),
                  log: draft.log,
                };
                const blob = new Blob([JSON.stringify(results, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `raw-${room.id}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download setup results
            </Button>
          </Stack>
        )}
        <details>
          <summary>Setup log ({draft.log.length} actions)</summary>
          <Stack gap={4} mt="sm">
            {draft.log.map((entry, index) => (
              <Text key={index} size="sm">
                {entry}
              </Text>
            ))}
          </Stack>
        </details>
      </Stack>
      <Modal
        opened={undoOpen}
        onClose={() => setUndoOpen(false)}
        title="Undo the last action?"
        centered
      >
        <Stack>
          <Text size="sm">
            This restores the previous choices, hands and map for everyone.
          </Text>
          <Group justify="end">
            <Button variant="subtle" onClick={() => setUndoOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                submit("undo");
                setUndoOpen(false);
              }}
            >
              Undo
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
