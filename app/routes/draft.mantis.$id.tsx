import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useState } from "react";
import {
  data,
  Link,
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Map as DraftMap, MAP_INTERACTIONS } from "~/components/Map";
import { SystemTileCard } from "~/components/SystemTileCard";
import { OriginalArtToggle } from "~/components/OriginalArtToggle";
import { FactionIcon } from "~/components/icons/FactionIcon";
import { Section, SectionTitle } from "~/components/Section";
import { factions as allFactions, playerColors } from "~/data/factionData";
import { factionSystems, systemData } from "~/data/systemData";
import { DraftableSpeakerOrder } from "~/routes/draft.$id/components/DraftableSpeakerOrder";
import { FactionReference } from "~/routes/draft.$id/components/FactionHelpInfo";
import { PlayerChip } from "~/routes/draft.$id/components/PlayerChip";
import { SelectableCard, type PlayerColor } from "~/ui";
import {
  applyMantisAction,
  canDraftMantisFaction,
  canMantisMulligan,
  countMantisTiles,
  KELERES_HOMES,
  mantisActivePlayer,
  mantisBuildTurn,
  mantisChosenHome,
  mantisHomeChoices,
  needsMantisDiscard,
  undoMantisAction,
  type MantisAction,
  type MantisSnapshot,
  type KeleresHome,
} from "~/draft/mantis/engine";
import {
  getMantisRoom,
  mantisCookie,
  mantisAdminCookie,
  readMantisAdminToken,
  mantisTokenHash,
  newMantisToken,
  readMantisToken,
  saveMantisRoom,
  type MantisRoomData,
} from "~/drizzle/mantisDraft.server";
import { LobbyPanel, type LobbyOperation } from "~/draft/LobbyPanel";
import { DraftTurnStatus } from "~/draft/DraftTurnStatus";
import { useLobbyRefresh } from "~/hooks/useLobbyRefresh";
import { createOrderedLoader } from "~/hooks/orderedLoader";
import { syncBagMapIdentity } from "~/draft/bag/bagDraft.server";
import { MapBuildDiagram } from "~/draft/mantis/MapBuildDiagram";
import { db } from "~/drizzle/config.server";
import type { LobbyView } from "~/draft/lobby";
import {
  openBackup,
  playerName,
  sealBackup,
  validRecoveryToken,
} from "~/draft/lobby.server";
import {
  encodeAsyncMapString,
  encodeTtpgMapString,
} from "~/mapgen/utils/externalMapStringCodec";

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

const keleresHeroes: Record<KeleresHome, { name: string; summary: string }> = {
  mentak: {
    name: "Harka Leeds",
    summary: "Draw three action cards with component actions.",
  },
  xxcha: {
    name: "Odlynn Myrr",
    summary:
      "Cast extra votes and gain trade goods and command tokens from players who abstain or vote against your predicted outcome.",
  },
  argent: {
    name: "Kuuasi Aun Jalatai",
    summary:
      "Bring your flagship and two cruisers or destroyers into a space combat in a system with a planet you control.",
  },
};
export function headers() {
  return privateHeaders;
}

const loadClientDraft =
  createOrderedLoader<Awaited<ReturnType<typeof loader>>["data"]>();

export function clientLoader({
  request,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  return loadClientDraft(new URL(request.url).pathname, () =>
    serverLoader<typeof loader>(),
  );
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const [cookie, adminToken] = await Promise.all([
    readMantisToken(params.id!, request),
    readMantisAdminToken(params.id!, request),
  ]);
  const record = getMantisRoom(params.id!);
  const hash = cookie ? mantisTokenHash(cookie) : "";
  const isHost =
    !!adminToken && mantisTokenHash(adminToken) === record.hostTokenHash;
  const ownPlayers = Object.entries(record.room.claims)
    .filter(([, token]) => token === hash)
    .map(([id]) => Number(id));
  let upgraded = false;
  if (isHost && !record.room.lobby.adminUuid) {
    record.room.lobby.adminUuid = adminToken;
    upgraded = true;
  }
  for (const id of ownPlayers) {
    if (!record.room.lobby.seatKeys[id] && cookie) {
      record.room.lobby.seatKeys[id] = cookie;
      upgraded = true;
    }
  }
  if (upgraded) {
    saveMantisRoom(record.id, record.revision, record.room);
    record.revision++;
  }
  const { history, ...snapshot } = record.room.draft;
  // Picks and kept tiles are public in Mantis. Draw selection is private until placed.
  const draft: MantisSnapshot | null = record.room.lobby.started
    ? {
        ...snapshot,
        hands: Object.fromEntries(
          Object.entries(snapshot.hands).map(([id, tiles]) => [
            id,
            [...tiles].sort(),
          ]),
        ),
        drawnTile: ownPlayers.includes(mantisActivePlayer(snapshot) ?? -1)
          ? snapshot.drawnTile
          : undefined,
        log: snapshot.log.map((entry) =>
          entry.replace(
            /mulliganed tile .* and drew .*\.$/,
            "used a mulligan.",
          ),
        ),
      }
    : null;
  const lobby: LobbyView = {
    started: record.room.lobby.started,
    paused: record.room.lobby.paused,
    slots: snapshot.players.map((player) => ({
      id: player.id,
      name: player.name,
      claimed: !!record.room.claims[player.id],
      ...(isHost ? { uuid: record.room.lobby.seatKeys[player.id] } : {}),
    })),
    ownUuid: ownPlayers.length
      ? (record.room.lobby.seatKeys[ownPlayers[0]] ?? cookie)
      : undefined,
    ...(isHost
      ? {
          adminUuid: record.room.lobby.adminUuid ?? adminToken,
          checkpoints: [
            ...(record.room.lobby.checkpoints ?? []).map(
              ({ id, label, createdAt }) => ({ id, label, createdAt }),
            ),
            ...history.map((state, index) => ({
              id: String(index),
              label:
                state.phase === "draft"
                  ? `Round ${Math.floor(state.pickNumber / state.players.length) + 1}, before pick ${state.pickNumber + 1}`
                  : `${state.phase === "build" ? "Map building" : state.phase === "home" ? "Choose Keleres home" : "Discard extras"}: before action ${index + 1}`,
              createdAt: `Action ${index + 1}`,
            })),
          ],
        }
      : {}),
  };
  const responseHeaders = new Headers(privateHeaders);
  if (isHost)
    responseHeaders.append(
      "Set-Cookie",
      await mantisAdminCookie(record.id).serialize(adminToken),
    );
  return data(
    {
      id: record.id,
      revision: record.revision,
      draft,
      lobby,
      canUndo: history.length > 0,
      isHost,
      ownPlayers,
      claimedPlayers: Object.keys(record.room.claims).map(Number),
    },
    { headers: responseHeaders },
  );
}

function renamePlayer(room: MantisRoomData, id: number, name: string) {
  const rename = (draft: MantisSnapshot) => {
    const player = draft.players.find((player) => player.id === id);
    if (player) player.name = name;
    const configured = draft.settings.players.find(
      (player) => player.id === id,
    );
    if (configured) configured.name = name;
  };
  rename(room.draft);
  room.draft.history.forEach(rename);
}

function checkpoint(room: MantisRoomData, label: string) {
  const saved = {
    id: newMantisToken(),
    label,
    createdAt: new Date().toISOString(),
    draft: structuredClone(room.draft),
  };
  room.lobby.checkpoints = [saved, ...(room.lobby.checkpoints ?? [])].slice(
    0,
    20,
  );
}

function checkpointDraft(room: MantisRoomData, id: string) {
  const saved = room.lobby.checkpoints?.find((entry) => entry.id === id);
  if (saved) return structuredClone(saved.draft);
  const index = Number(id);
  const state =
    /^\d+$/.test(id) && Number.isInteger(index)
      ? room.draft.history[index]
      : undefined;
  if (!state) throw new Error("Choose an available saved turn or round.");
  return {
    ...structuredClone(state),
    history: structuredClone(room.draft.history.slice(0, index)),
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const [storedToken, adminToken] = await Promise.all([
      readMantisToken(params.id!, request),
      readMantisAdminToken(params.id!, request),
    ]);
    const record = getMantisRoom(params.id!);
    const hash = storedToken ? mantisTokenHash(storedToken) : "";
    const isHost =
      !!adminToken && mantisTokenHash(adminToken) === record.hostTokenHash;
    const intent = String(form.get("intent"));
    const playerId = Number(form.get("playerId"));
    const responseHeaders = new Headers(privateHeaders);
    let issuedPlayerToken: string | undefined;
    const success = async (exportState?: string) => {
      if (isHost)
        responseHeaders.append(
          "Set-Cookie",
          await mantisAdminCookie(record.id).serialize(adminToken),
        );
      if (issuedPlayerToken)
        responseHeaders.append(
          "Set-Cookie",
          await mantisCookie(record.id).serialize(issuedPlayerToken),
        );
      return data(
        { success: true, error: null, exportState },
        { headers: responseHeaders },
      );
    };
    if (intent === "recover") {
      const uuid = String(form.get("recoveryId") ?? "")
        .trim()
        .toLowerCase();
      if (!validRecoveryToken(uuid)) throw new Error("Enter your saved UUID.");
      const recoveryHash = mantisTokenHash(uuid);
      const hostRecovery = recoveryHash === record.hostTokenHash;
      if (
        !hostRecovery &&
        !Object.values(record.room.claims).includes(recoveryHash)
      )
        throw new Error(
          "This UUID does not belong to a player or admin in this lobby.",
        );
      responseHeaders.append(
        "Set-Cookie",
        await (
          hostRecovery ? mantisAdminCookie(record.id) : mantisCookie(record.id)
        ).serialize(uuid),
      );
      return success();
    }
    if (
      !["join", "export"].includes(intent) &&
      Number(form.get("revision")) !== record.revision
    )
      throw new Error(
        "Another player changed the draft. Wait for the latest state and try again.",
      );
    if (intent === "join") {
      issuedPlayerToken = db.transaction(
        () => {
          const current = getMantisRoom(record.id);
          if (Object.values(current.room.claims).includes(hash))
            throw new Error("You already have a slot in this lobby.");
          const player = [...current.room.draft.players]
            .sort((a, b) => a.id - b.id)
            .find((p) => !current.room.claims[p.id]);
          if (!player) throw new Error("This lobby is full.");
          const name = playerName(form.get("name"));
          const token = newMantisToken();
          current.room.claims[player.id] = mantisTokenHash(token);
          current.room.lobby.seatKeys[player.id] = token;
          renamePlayer(current.room, player.id, name);
          saveMantisRoom(current.id, current.revision, current.room);
          if (current.room.draft.bagDraftId)
            syncBagMapIdentity(
              current.room.draft.bagDraftId,
              current.id,
              player.id,
              { uuid: token, name },
            );
          return token;
        },
        { behavior: "immediate" },
      );
      return success();
    }
    if (intent === "pick") {
      if (!hash || record.room.claims[playerId] !== hash)
        throw new Error("Join as this player before making a pick.");
      if (!record.room.lobby.started)
        throw new Error("The admin must start the draft after everyone joins.");
      if (record.room.lobby.paused)
        throw new Error(
          "The draft is paused. Wait for the admin to resume it.",
        );
      const pick = JSON.parse(String(form.get("action"))) as MantisAction;
      if (!pick || typeof pick !== "object")
        throw new Error("Invalid draft action.");
      record.room.draft = applyMantisAction(record.room.draft, playerId, pick);
    } else {
      if (!isHost)
        throw new Error(
          "Only the draft host can manage or restore this lobby.",
        );
      if (intent === "start") {
        if (record.room.lobby.started)
          throw new Error("The draft has already started.");
        if (record.room.draft.players.some((p) => !record.room.claims[p.id]))
          throw new Error("Every slot must be claimed before starting.");
        record.room.lobby.started = true;
      } else if (intent === "pause" || intent === "resume") {
        if (!record.room.lobby.started)
          throw new Error("Start the draft first.");
        if (
          intent === "resume" &&
          record.room.draft.players.some((p) => !record.room.claims[p.id])
        )
          throw new Error("Fill every released slot before resuming.");
        record.room.lobby.paused = intent === "pause";
      } else if (intent === "undo") {
        if (!record.room.draft.history.length)
          throw new Error("There is no action to undo.");
        checkpoint(record.room, "Recovery: before undo");
        const names = record.room.draft.players.map(({ id, name }) => ({
          id,
          name,
        }));
        record.room.draft = undoMantisAction(record.room.draft);
        names.forEach(({ id, name }) => renamePlayer(record.room, id, name));
        record.room.lobby.paused = true;
      } else if (intent === "checkpoint") {
        checkpoint(record.room, "Manual checkpoint");
      } else if (intent === "restore") {
        const state = checkpointDraft(
          record.room,
          String(form.get("checkpointId") ?? ""),
        );
        checkpoint(record.room, "Recovery: before restoring a checkpoint");
        const names = record.room.draft.players.map(({ id, name }) => ({
          id,
          name,
        }));
        record.room.draft = state;
        names.forEach(({ id, name }) => renamePlayer(record.room, id, name));
        record.room.lobby.paused = true;
      } else if (intent === "export") {
        const selected = String(form.get("checkpointId") ?? "");
        return success(
          sealBackup("mantis", record.id, record.room.lobby.backupSecret, {
            draft: selected
              ? checkpointDraft(record.room, selected)
              : record.room.draft,
            started: record.room.lobby.started,
          }),
        );
      } else if (intent === "import") {
        const saved = openBackup<{
          draft: MantisRoomData["draft"];
          started: boolean;
        }>(
          "mantis",
          record.id,
          record.room.lobby.backupSecret,
          String(form.get("state") ?? ""),
        );
        if (
          !saved.draft ||
          !Array.isArray(saved.draft.players) ||
          saved.draft.players.length !== record.room.draft.players.length ||
          saved.draft.players.some(
            (p) =>
              !record.room.draft.players.some((current) => current.id === p.id),
          )
        )
          throw new Error(
            "This saved state does not match the players in this lobby.",
          );
        const names = record.room.draft.players.map(({ id, name }) => ({
          id,
          name,
        }));
        checkpoint(record.room, "Recovery: before importing a save");
        record.room.draft = saved.draft;
        names.forEach(({ id, name }) => renamePlayer(record.room, id, name));
        record.room.lobby.started = saved.started;
        record.room.lobby.paused = saved.started;
      } else if (["release", "rotate", "rename"].includes(intent)) {
        if (!record.room.draft.players.some((p) => p.id === playerId))
          throw new Error("Choose a player slot.");
        if (intent === "rename")
          renamePlayer(record.room, playerId, playerName(form.get("name")));
        else if (intent === "release") {
          delete record.room.claims[playerId];
          delete record.room.lobby.seatKeys[playerId];
          if (record.room.lobby.started) record.room.lobby.paused = true;
        } else {
          if (!record.room.claims[playerId])
            throw new Error("This slot has not been claimed yet.");
          const token = newMantisToken();
          record.room.claims[playerId] = mantisTokenHash(token);
          record.room.lobby.seatKeys[playerId] = token;
        }
      } else throw new Error("Unknown draft action.");
    }
    db.transaction(
      () => {
        saveMantisRoom(record.id, record.revision, record.room);
        if (
          record.room.draft.bagDraftId &&
          ["release", "rotate", "rename"].includes(intent)
        ) {
          syncBagMapIdentity(
            record.room.draft.bagDraftId,
            record.id,
            playerId,
            {
              uuid: record.room.lobby.seatKeys[playerId],
              name: record.room.draft.players.find((p) => p.id === playerId)!
                .name,
            },
          );
        }
      },
      { behavior: "immediate" },
    );
    return success();
  } catch (error) {
    if (error instanceof Response) throw error;
    return data(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update the draft.",
        exportState: undefined,
      },
      { status: 400, headers: privateHeaders },
    );
  }
}

export default function MantisRoom() {
  const room = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useLobbyRefresh();
  const lobbyOperation = (operation: LobbyOperation) => {
    const { type, ...fields } = operation;
    fetcher.submit(
      {
        intent: type,
        revision: String(room.revision),
        ...Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [
            key === "uuid" ? "recoveryId" : key,
            String(value),
          ]),
        ),
      },
      { method: "post" },
    );
  };
  return (
    <>
      <Container size="xl" pt="lg">
        <LobbyPanel
          lobby={room.lobby}
          mode="mantis"
          lobbyId={room.id}
          ownPlayerId={room.ownPlayers[0]}
          isAdmin={room.isHost}
          busy={fetcher.state !== "idle"}
          error={fetcher.data?.error}
          onOperation={lobbyOperation}
          exportState={fetcher.data?.exportState}
        />
      </Container>
      {room.draft && <ActiveMantisRoom room={{ ...room, draft: room.draft }} />}
    </>
  );
}

type LoadedMantisRoom = ReturnType<typeof useLoaderData<typeof loader>>;
function ActiveMantisRoom({
  room,
}: {
  room: Omit<LoadedMantisRoom, "draft"> & { draft: MantisSnapshot };
}) {
  const { draft } = room;
  const fetcher = useFetcher<typeof action>();
  const [confirmation, setConfirmation] = useState<MantisAction | null>(null);
  const activeId = mantisActivePlayer(draft);
  const active = draft.players.find((p) => p.id === activeId);
  const playerId = room.ownPlayers[0];
  const controlled = playerId !== undefined;
  const busy = fetcher.state !== "idle";
  const canPick =
    controlled &&
    !busy &&
    !room.lobby.paused &&
    (draft.phase === "discard"
      ? needsMantisDiscard(draft, playerId)
      : playerId === activeId);
  const buildTurn =
    draft.phase === "build" ? mantisBuildTurn(draft) : undefined;

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
        : confirmation?.type === "home"
          ? factionSystems[confirmation.factionId].id
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
        : confirmation?.type === "home"
          ? `Choose the ${allFactions[confirmation.factionId].name} home and ${keleresHeroes[confirmation.factionId].name} as your Keleres hero?`
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
        {playerId !== undefined && (
          <DraftTurnStatus
            roomKey={`mantis:${room.id}`}
            playerId={playerId}
            paused={room.lobby.paused}
            complete={draft.phase === "complete"}
            pending={
              draft.phase !== "complete" &&
              (draft.phase === "discard"
                ? needsMantisDiscard(draft, playerId)
                : activeId === playerId)
                ? {
                    key: `${draft.phase}:${draft.pickNumber}:${draft.hands[playerId]?.length ?? 0}`,
                    label:
                      draft.phase === "home"
                        ? "Choose your Keleres home system"
                        : draft.phase === "discard"
                          ? "Discard your extra tiles"
                          : draft.phase === "build"
                            ? "Place your drawn tile"
                            : "Make your next pick",
                  }
                : undefined
            }
          />
        )}
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
          </Group>
        </Group>
        {draft.phase === "home" && (
          <Section>
            <Title order={3}>Choose a Keleres home and hero</Title>
            <Text size="sm" mt="xs" mb="md">
              Choose an unplayed faction’s home system and its Keleres hero.
              {KELERES_HOMES.filter(
                (id) => !mantisHomeChoices(draft).includes(id),
              ).length > 0 &&
                ` Already in play: ${KELERES_HOMES.filter(
                  (id) => !mantisHomeChoices(draft).includes(id),
                )
                  .map((id) => allFactions[id].name)
                  .join(", ")}.`}
            </Text>
            {mantisHomeChoices(draft).length === 0 ? (
              <Alert
                color="red"
                title="This saved draft has no legal Keleres home"
              >
                Mentak, Xxcha, and Argent were all drafted. The admin can use
                Recovery &amp; access to restore a turn before the conflicting
                faction pick. Existing tile placements are preserved until then.
              </Alert>
            ) : (
              <SimpleGrid
                cols={{ base: 1, sm: mantisHomeChoices(draft).length }}
              >
                {mantisHomeChoices(draft).map((factionId) => {
                  return (
                    <Stack key={factionId} align="center" gap="sm">
                      <Text fw={600}>{allFactions[factionId].name}</Text>
                      <SystemTileCard
                        systemId={factionSystems[factionId].id}
                        radius={85}
                      />
                      <Text size="sm" fw={600}>
                        {keleresHeroes[factionId].name}
                      </Text>
                      <Text size="sm">{keleresHeroes[factionId].summary}</Text>
                      <Button
                        disabled={!canPick}
                        onClick={() => pick({ type: "home", factionId })}
                      >
                        {`Choose ${allFactions[factionId].name} home`}
                      </Button>
                    </Stack>
                  );
                })}
              </SimpleGrid>
            )}
          </Section>
        )}
        <Text>
          {draft.factionLabels
            ? "Build the map with the tiles, home systems, and speaker order from your completed bag draft. "
            : "Public snake draft → resolve your home and discard extras → build your own slice. "}
          Your kept tiles fill your own section of the shared map. On each
          placement turn, the builder randomly draws from your remaining hand; a
          mulligan draws a different tile and leaves the original in your hand
          to place later. When only one position is available and no mulligan
          can be used, the tile is placed automatically and recorded in the
          draft log. The admin can undo these placements like any other action.
        </Text>
        {draft.phase !== "complete" && (
          <Accordion variant="contained">
            <Accordion.Item value="tile-placement">
              <Accordion.Control>
                How your tiles build the shared map
              </Accordion.Control>
              <Accordion.Panel>
                <MapBuildDiagram
                  playerCount={draft.players.length}
                  playerSeat={
                    playerId === undefined ? undefined : draft.seats[playerId]
                  }
                  source={draft.bagDraftId ? "kept" : "pool"}
                  draftBlues={3 + draft.settings.extraBlues}
                  draftReds={2 + draft.settings.extraReds}
                  mulligans={draft.settings.mulligans}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
        <Group>
          <Badge size="lg">{draft.phase}</Badge>
          <Text fw={600}>
            {draft.phase === "complete"
              ? "Draft and map complete"
              : draft.phase === "discard"
                ? "All players: discard down to 3 blue and 2 red tiles"
                : draft.phase === "home"
                  ? `${active?.name ?? "Keleres"} is choosing a home system`
                  : `${active?.name ?? "Waiting"} ${draft.phase === "draft" ? "is drafting" : "is building"}`}
          </Text>
        </Group>
        {fetcher.data?.error && <Alert color="red">{fetcher.data.error}</Alert>}
        <Alert
          color={
            room.lobby.paused ? "orange.3" : canPick ? "success.4" : "sky.4"
          }
          title={
            draft.phase === "complete"
              ? "Ready to play"
              : room.lobby.paused
                ? "Draft paused"
                : canPick
                  ? "Your turn"
                  : controlled
                    ? "Waiting for other players"
                    : "Watching the draft"
          }
        >
          {room.lobby.paused
            ? "The admin is resolving an issue. Picks will resume when the admin resumes the draft."
            : draft.phase === "draft"
              ? "On each turn, choose one faction, one speaker position, or one tile. By the end, you need one faction, one speaker position, and your full quota of blue and red tiles. The order reverses each round."
              : draft.phase === "home"
                ? "Keleres chooses the home system and hero of an unplayed Mentak, Xxcha, or Argent faction before map building."
                : draft.phase === "discard"
                  ? "Keep exactly 3 blue and 2 red tiles. Everyone can remove their extras at the same time. Map building begins automatically when all hands are ready."
                  : draft.phase === "build"
                    ? "The active player draws one tile privately, then places it in a highlighted space. Each player's five tiles become their own section of the map. A mulligan redraws without losing the previous tile."
                    : "Your factions, speaker positions, and map are ready. Copy a map string below to set up your game."}
        </Alert>
        <Group gap="xs" aria-label="Mantis draft stages">
          {[
            "Draft faction + speaker + tiles",
            "Choose Keleres home",
            "Discard extras",
            "Build map",
            "Play",
          ].map((label, index) => (
            <Badge
              key={label}
              variant={
                ["draft", "home", "discard", "build", "complete"][index] ===
                draft.phase
                  ? "filled"
                  : "light"
              }
            >
              {index + 1}. {label}
            </Badge>
          ))}
        </Group>
        <Text size="sm">
          Draft order:{" "}
          {draft.order
            .map((id) => draft.players.find((p) => p.id === id)?.name)
            .join(" → ")}{" "}
          (reverses each round)
        </Text>
        <Table.ScrollContainer
          minWidth={650}
          type="native"
          tabIndex={0}
          role="region"
          aria-label="Player status — scroll to see all columns"
        >
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Player</Table.Th>
                <Table.Th>Faction</Table.Th>
                <Table.Th>Speaker / seat</Table.Th>
                <Table.Th>
                  {draft.phase === "build" || draft.phase === "complete"
                    ? "Tiles left to place"
                    : "Drafted tiles"}
                </Table.Th>
                <Table.Th>Mulligans</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {draft.players.map((p) => (
                <Table.Tr
                  key={p.id}
                  className="command-player-row"
                  data-own={p.id === playerId || undefined}
                >
                  <Table.Td fw={p.id === activeId ? 700 : 400}>
                    {p.name}
                    {p.id === playerId ? " (you)" : ""}
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
                    {mantisChosenHome(draft, p.id) && (
                      <Text size="xs" c="dimmed">
                        {allFactions[mantisChosenHome(draft, p.id)!].name} home
                        · {keleresHeroes[mantisChosenHome(draft, p.id)!].name}
                      </Text>
                    )}
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
        {controlled &&
          hand.length > 0 &&
          (draft.phase === "draft" || draft.phase === "build") && (
            <Section>
              <SectionTitle
                title={
                  draft.phase === "draft"
                    ? "Your drafted tiles"
                    : "Your remaining tiles"
                }
              />
              <Text size="sm" mb="sm">
                {draft.phase === "draft"
                  ? "Review your picks while choosing what to draft next."
                  : "These tiles still need to be placed. A mulligan draws another tile from this hand; your current draw stays available for a later turn."}
              </Text>
              <Group gap="sm">
                {hand.map((id) => (
                  <Stack key={id} gap={4} align="center">
                    <SystemTileCard
                      systemId={id}
                      radius={55}
                      selected={draft.drawnTile === id}
                    />
                    {draft.drawnTile === id && (
                      <Badge variant="light">Current draw</Badge>
                    )}
                  </Stack>
                ))}
              </Group>
            </Section>
          )}
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
                    canPick &&
                    !draft.chosenFactions[playerId!] &&
                    canDraftMantisFaction(draft, id);
                  const blocksKeleres =
                    !claimedBy && !canDraftMantisFaction(draft, id);
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
                      body={
                        <>
                          {blocksKeleres && (
                            <Text c="orange" size="sm" p="sm">
                              Unavailable: Keleres needs an unplayed Mentak,
                              Xxcha, or Argent home.
                            </Text>
                          )}
                          <FactionReference faction={faction} />
                        </>
                      }
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
              <Title order={3}>
                {draft.drawnTile
                  ? "Your drawn tile"
                  : "Waiting for the active player to place a tile"}
              </Title>
              {draft.drawnTile && (
                <SystemTileCard systemId={draft.drawnTile} radius={60} />
              )}
              <Button
                disabled={!canPick || !canMantisMulligan(draft, playerId!)}
                onClick={() => pick({ type: "mulligan" })}
              >
                Mulligan
              </Button>
            </Group>
            <Text>
              Place the drawn tile in a highlighted position in your section of
              the map. Everyone fills their one stage 1 position before moving
              to the two stage 2 positions, then the two stage 3 positions. The
              highlighted spaces follow your map layout. Within each group, the
              player with the most empty spaces places next, with ties resolved
              in speaker order.
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
            {draft.map.some(
              (tile) => tile.type === "SYSTEM" && tile.systemId === "17",
            ) && (
              <Alert title="Creuss home system">
                Creuss Gate (17) occupies the galaxy position. Place Creuss (51)
                off the board.
              </Alert>
            )}
            {draft.map.some(
              (tile) => tile.type === "SYSTEM" && tile.systemId === "94",
            ) && (
              <Alert title="Crimson Rebellion home system">
                The Sorrow (94) occupies the galaxy position. Place Ahk Creuxx
                (118) off the board.
              </Alert>
            )}
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
    </Container>
  );
}
