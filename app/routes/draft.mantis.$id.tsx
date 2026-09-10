import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  data,
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Map as DraftMap, MAP_INTERACTIONS } from "~/components/Map";
import { SystemTileCard } from "~/components/SystemTileCard";
import { OriginalArtToggle } from "~/components/OriginalArtToggle";
import { FactionIcon } from "~/components/icons/FactionIcon";
import { Section, SectionTitle } from "~/components/Section";
import { factions as allFactions, playerColors } from "~/data/factionData";
import { systemData } from "~/data/systemData";
import { DraftableSpeakerOrder } from "~/routes/draft.$id/components/DraftableSpeakerOrder";
import { FactionReference } from "~/routes/draft.$id/components/FactionHelpInfo";
import { PlayerChip } from "~/routes/draft.$id/components/PlayerChip";
import { SelectableCard, type PlayerColor } from "~/ui";
import {
  applyMantisAction,
  countMantisTiles,
  mantisActivePlayer,
  mantisBuildTurn,
  needsMantisDiscard,
  undoMantisAction,
  type MantisAction,
} from "~/draft/mantis/engine";
import {
  getMantisRoom,
  mantisCookie,
  mantisTokenHash,
  newMantisToken,
  readMantisToken,
  saveMantisRoom,
} from "~/drizzle/mantisDraft.server";
import {
  encodeAsyncMapString,
  encodeTtpgMapString,
} from "~/mapgen/utils/externalMapStringCodec";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const record = getMantisRoom(params.id!);
  const cookie = await readMantisToken(record.id, request);
  const hash = typeof cookie === "string" ? mantisTokenHash(cookie) : "";
  const { history, ...draft } = record.room.draft;
  return data(
    {
      id: record.id,
      revision: record.revision,
      draft,
      canUndo: history.length > 0,
      isHost: hash === record.hostTokenHash,
      ownPlayers: Object.entries(record.room.claims)
        .filter(([, token]) => token === hash)
        .map(([id]) => Number(id)),
      claimedPlayers: Object.keys(record.room.claims).map(Number),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const record = getMantisRoom(params.id!);
    if (Number(form.get("revision")) !== record.revision)
      throw new Error(
        "Another player changed the draft. Wait for the latest state and try again.",
      );
    const storedToken = await readMantisToken(record.id, request);
    const hash =
      typeof storedToken === "string" ? mantisTokenHash(storedToken) : "";
    const isHost = hash === record.hostTokenHash;
    const intent = String(form.get("intent"));
    const playerId = Number(form.get("playerId"));
    if (intent === "join") {
      if (!record.room.draft.players.some((p) => p.id === playerId))
        throw new Error("Choose a player in the draft.");
      if (record.room.claims[playerId] && record.room.claims[playerId] !== hash)
        throw new Error("That player has already joined.");
      const token =
        typeof storedToken === "string" ? storedToken : newMantisToken();
      record.room.claims[playerId] = mantisTokenHash(token);
      saveMantisRoom(record.id, record.revision, record.room);
      return data(
        { success: true, error: null },
        {
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": await mantisCookie(record.id).serialize(token),
          },
        },
      );
    }
    if (intent === "undo") {
      if (!isHost) throw new Error("Only the draft host can undo actions.");
      record.room.draft = undoMantisAction(record.room.draft);
    } else if (intent === "release") {
      if (!isHost) throw new Error("Only the host can release a player slot.");
      delete record.room.claims[playerId];
    } else if (intent === "pick") {
      if (!isHost && (!hash || record.room.claims[playerId] !== hash))
        throw new Error("Join as this player before making a pick.");
      const pick = JSON.parse(String(form.get("action"))) as MantisAction;
      if (!pick || typeof pick !== "object")
        throw new Error("Invalid draft action.");
      record.room.draft = applyMantisAction(record.room.draft, playerId, pick);
    } else throw new Error("Unknown draft action.");
    saveMantisRoom(record.id, record.revision, record.room);
    return data(
      { success: true, error: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    return data(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update the draft.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export default function MantisRoom() {
  const room = useLoaderData<typeof loader>();
  const { draft } = room;
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<MantisAction | null>(null);
  const [undoConfirmation, setUndoConfirmation] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const activeId = mantisActivePlayer(draft);
  const active = draft.players.find((p) => p.id === activeId);
  const playerId =
    selectedPlayer !== null
      ? Number(selectedPlayer)
      : (room.ownPlayers[0] ?? (room.isHost ? activeId : undefined));
  const controlled =
    playerId !== undefined &&
    (room.isHost || room.ownPlayers.includes(playerId));
  const busy = fetcher.state !== "idle";
  const canPick =
    controlled && !busy && (draft.phase === "discard" || playerId === activeId);
  const buildTurn =
    draft.phase === "build" ? mantisBuildTurn(draft) : undefined;

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
  const pick = (action: MantisAction) => {
    if (!canPick) return;
    setConfirmation(action);
  };
  const hand = playerId === undefined ? [] : (draft.hands[playerId] ?? []);
  const confirmationTile =
    confirmation?.type === "tile" || confirmation?.type === "discard"
      ? confirmation.tileId
      : confirmation?.type === "place"
        ? draft.drawnTile
        : undefined;
  const confirmationFaction =
    confirmation?.type === "faction"
      ? allFactions[confirmation.factionId]
      : undefined;
  const actionLabel =
    confirmation?.type === "tile"
      ? `Draft tile ${confirmation.tileId}?`
      : confirmation?.type === "faction"
        ? `Draft ${allFactions[confirmation.factionId]?.name}?`
        : confirmation?.type === "seat"
          ? `Draft speaker position ${confirmation.seat + 1}?`
          : confirmation?.type === "discard"
            ? `Discard tile ${confirmation.tileId}?`
            : confirmation?.type === "place"
              ? `Place tile ${draft.drawnTile} at position ${confirmation.mapIdx}?`
              : "Use a mulligan to draw a different tile?";

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>
            {draft.factionLabels ? "Your drafted map" : "Mantis draft"}
          </Title>
          <Group>
            {draft.bagDraftId && (
              <Button
                component={Link}
                to={`/draft/bag/${draft.bagDraftId}?results=1`}
                variant="light"
              >
                View drafted factions
              </Button>
            )}
            <OriginalArtToggle />
            <Button
              variant="light"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setShareMessage("Draft link copied");
                } catch {
                  setShareMessage(
                    "Share this page's address with your players.",
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
                disabled={!room.canUndo || busy}
                onClick={() => setUndoConfirmation(true)}
              >
                Undo last action
              </Button>
            )}
          </Group>
        </Group>
        {shareMessage && <Text size="sm">{shareMessage}</Text>}
        <Text>
          {draft.factionLabels
            ? "Build the map with the tiles, home systems, and speaker order from your completed bag draft. "
            : "Public snake draft → discard extras → build your own slice. "}
          Map building draws from your hand at random; a mulligan keeps the
          original tile in your hand.
        </Text>
        <Group>
          <Badge size="lg">{draft.phase}</Badge>
          <Text fw={600}>
            {draft.phase === "complete"
              ? "Draft and map complete"
              : draft.phase === "discard"
                ? "All players: discard down to 3 blue and 2 red tiles"
                : `${active?.name ?? "Waiting"} ${draft.phase === "draft" ? "is drafting" : "is building"}`}
          </Text>
        </Group>
        {fetcher.data?.error && <Alert color="red">{fetcher.data.error}</Alert>}
        <Group align="end">
          <Select
            label={room.isHost ? "Host: act for player" : "Your player"}
            placeholder={
              room.isHost && active
                ? `Follow turn: ${active.name}`
                : "Choose your name"
            }
            clearable
            value={selectedPlayer}
            onChange={setSelectedPlayer}
            data={draft.players.map((p) => ({
              value: String(p.id),
              label: `${p.name}${room.claimedPlayers.includes(p.id) && !room.ownPlayers.includes(p.id) ? " (joined)" : ""}`,
            }))}
          />
          {!controlled && playerId !== undefined && (
            <Button
              disabled={busy || room.claimedPlayers.includes(playerId)}
              onClick={() => submit("join")}
            >
              Join as {draft.players.find((p) => p.id === playerId)?.name}
            </Button>
          )}
          {room.isHost &&
            playerId !== undefined &&
            room.claimedPlayers.includes(playerId) && (
              <Button
                variant="subtle"
                color="red"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Release this player slot so someone else can join?",
                    )
                  )
                    submit("release");
                }}
              >
                Release player slot
              </Button>
            )}
        </Group>
        {!room.isHost && !controlled && (
          <Text size="sm" c="dimmed">
            Choose your name and join to make picks. You can also watch the
            draft.
          </Text>
        )}
        <Text size="sm">
          Draft order:{" "}
          {draft.order
            .map((id) => draft.players.find((p) => p.id === id)?.name)
            .join(" → ")}{" "}
          (reverses each round)
        </Text>
        <Table.ScrollContainer minWidth={650}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Player</Table.Th>
                <Table.Th>Faction</Table.Th>
                <Table.Th>Speaker / seat</Table.Th>
                <Table.Th>Tiles</Table.Th>
                <Table.Th>Mulligans</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {draft.players.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={p.id === activeId ? 700 : 400}>
                    {p.name}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {allFactions[draft.chosenFactions[p.id]] && (
                        <FactionIcon
                          faction={draft.chosenFactions[p.id]}
                          style={{ width: 28, height: 28, flexShrink: 0 }}
                        />
                      )}
                      <Text size="sm">
                        {allFactions[draft.chosenFactions[p.id]]?.name ??
                          draft.factionLabels?.[p.id] ??
                          "—"}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {draft.seats[p.id] === undefined
                      ? "—"
                      : draft.seats[p.id] === 0
                        ? "Speaker (1)"
                        : draft.seats[p.id] + 1}
                  </Table.Td>
                  <Table.Td>
                    {countMantisTiles(draft, p.id, "BLUE")} blue,{" "}
                    {countMantisTiles(draft, p.id, "RED")} red
                  </Table.Td>
                  <Table.Td>
                    {draft.mulligansUsed[p.id]} / {draft.settings.mulligans}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {draft.phase === "draft" && (
          <>
            <Section>
              <SectionTitle title="Factions" />
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {draft.factions.map((id) => {
                  const faction = allFactions[id];
                  const claimedBy = draft.players.find(
                    (player) => draft.chosenFactions[player.id] === id,
                  );
                  const available =
                    canPick && !draft.chosenFactions[playerId!] && !claimedBy;
                  const selectFaction = () =>
                    pick({ type: "faction", factionId: id });
                  return (
                    <SelectableCard
                      key={id}
                      selected={!!claimedBy}
                      selectedColor={
                        claimedBy
                          ? (playerColors[claimedBy.id] as PlayerColor)
                          : undefined
                      }
                      onSelect={available ? selectFaction : undefined}
                      header={
                        <Group p="sm" gap="sm" wrap="nowrap">
                          <FactionIcon
                            faction={id}
                            style={{ width: 36, height: 36, flexShrink: 0 }}
                          />
                          <Text size="sm" ff="heading" fw={600} flex={1}>
                            {faction.name}
                          </Text>
                          {claimedBy ? (
                            <PlayerChip player={claimedBy} size="sm" />
                          ) : (
                            <Button
                              size="compact-xs"
                              disabled={!available}
                              onClick={(event) => {
                                event.stopPropagation();
                                selectFaction();
                              }}
                            >
                              Select
                            </Button>
                          )}
                        </Group>
                      }
                      body={<FactionReference faction={faction} />}
                    />
                  );
                })}
              </SimpleGrid>
            </Section>
            <Section>
              <SectionTitle title="Speaker positions" />
              <SimpleGrid cols={{ base: 2, xs: 3, md: draft.players.length }}>
                {draft.players.map((_, seat) => (
                  <DraftableSpeakerOrder
                    key={seat}
                    speakerOrder={
                      seat === 0
                        ? "Speaker"
                        : ["", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][
                            seat
                          ]
                    }
                    player={draft.players.find(
                      (player) => draft.seats[player.id] === seat,
                    )}
                    canSelectSpeakerOrder={
                      canPick && draft.seats[playerId!] === undefined
                    }
                    disabled={!canPick}
                    onSelect={() => pick({ type: "seat", seat })}
                  />
                ))}
              </SimpleGrid>
            </Section>
            {(["BLUE", "RED"] as const).map((color) => (
              <Section key={color}>
                <SectionTitle
                  title={`${color === "BLUE" ? "Blue" : "Red"} tiles`}
                />
                <Text size="sm">
                  Draft{" "}
                  {color === "BLUE"
                    ? 3 + draft.settings.extraBlues
                    : 2 + draft.settings.extraReds}{" "}
                  per player.
                </Text>
                <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 6, xl: 7 }}>
                  {draft.pool
                    .filter((id) => systemData[id]?.type === color)
                    .map((id) => (
                      <Button
                        key={id}
                        variant="transparent"
                        h="auto"
                        p={0}
                        aria-label={`Draft tile ${id}`}
                        disabled={
                          !canPick ||
                          countMantisTiles(draft, playerId!, color) >=
                            (color === "BLUE"
                              ? 3 + draft.settings.extraBlues
                              : 2 + draft.settings.extraReds)
                        }
                        onClick={() => pick({ type: "tile", tileId: id })}
                      >
                        <SystemTileCard systemId={id} radius={55} />
                      </Button>
                    ))}
                </SimpleGrid>
              </Section>
            ))}
          </>
        )}
        {draft.phase === "discard" && controlled && (
          <Stack>
            <Title order={3}>Your tiles</Title>
            <Text>
              {needsMantisDiscard(draft, playerId!)
                ? "Choose extra tiles to discard."
                : "Your hand is ready. Waiting for the other players."}
            </Text>
            <Group>
              {hand.map((id) => (
                <Button
                  key={id}
                  variant="transparent"
                  h="auto"
                  p={0}
                  disabled={
                    !canPick ||
                    countMantisTiles(
                      draft,
                      playerId!,
                      systemData[id]?.type === "BLUE" ? "BLUE" : "RED",
                    ) <= (systemData[id]?.type === "BLUE" ? 3 : 2)
                  }
                  onClick={() => pick({ type: "discard", tileId: id })}
                  aria-label={`Discard tile ${id}`}
                >
                  <SystemTileCard systemId={id} radius={55} />
                </Button>
              ))}
            </Group>
          </Stack>
        )}
        {draft.phase === "build" && (
          <Stack>
            <Group>
              <Title order={3}>Drawn tile</Title>
              {draft.drawnTile && (
                <SystemTileCard systemId={draft.drawnTile} radius={60} />
              )}
              <Button
                disabled={
                  !canPick ||
                  draft.mulligansUsed[playerId!] >= draft.settings.mulligans ||
                  hand.length < 2
                }
                onClick={() => pick({ type: "mulligan" })}
              >
                Mulligan
              </Button>
            </Group>
            <Text>
              Place the drawn tile in a highlighted position. Each player fills
              the inner ring, then their two middle positions, then their two
              outer positions.
            </Text>
          </Stack>
        )}
        {(draft.phase === "build" || draft.phase === "complete") && (
          <Box w="100%" maw={850} style={{ aspectRatio: "1 / 1" }} mx="auto">
            <DraftMap
              id="mantis-map"
              map={draft.map}
              modifiableMapTiles={canPick ? (buildTurn?.positions ?? []) : []}
              ringHighlightTiles={buildTurn?.positions ?? []}
              disabled={!canPick}
              interactions={{
                ...MAP_INTERACTIONS.texasBuild,
                droppable: false,
              }}
              onSelectSystemTile={(tile) =>
                pick({ type: "place", mapIdx: tile.idx })
              }
            />
          </Box>
        )}
        {draft.phase === "complete" && (
          <Stack>
            <Textarea
              label="Async Discord map string"
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
                const blob = new Blob([JSON.stringify(draft, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `mantis-${room.id}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download draft results
            </Button>
          </Stack>
        )}
        <details>
          <summary>Draft log ({draft.log.length} actions)</summary>
          <Stack gap={4} mt="sm">
            {draft.log.map((entry, i) => (
              <Text key={i} size="sm">
                {i + 1}. {entry}
              </Text>
            ))}
          </Stack>
        </details>
      </Stack>
      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title="Confirm choice"
        centered
      >
        <Stack>
          <Text>{actionLabel}</Text>
          {confirmationTile && (
            <Group justify="center">
              <SystemTileCard systemId={confirmationTile} radius={100} />
            </Group>
          )}
          {confirmationFaction && (
            <Stack align="center" gap="sm">
              <FactionIcon
                faction={confirmationFaction.id}
                style={{ width: 64, height: 64 }}
              />
              <FactionReference faction={confirmationFaction} />
            </Stack>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              disabled={!canPick}
              onClick={() => {
                if (confirmation)
                  submit("pick", { action: JSON.stringify(confirmation) });
                setConfirmation(null);
              }}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={undoConfirmation}
        onClose={() => setUndoConfirmation(false)}
        title="Undo last action"
        centered
      >
        <Stack>
          <Text>Restore the draft to before the most recent action?</Text>
          <Button
            color="red"
            onClick={() => {
              submit("undo");
              setUndoConfirmation(false);
            }}
          >
            Undo
          </Button>
        </Stack>
      </Modal>
    </Container>
  );
}
