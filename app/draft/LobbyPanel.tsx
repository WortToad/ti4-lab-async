import {
  Accordion,
  Alert,
  Button,
  Collapse,
  CopyButton,
  FileInput,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconDeviceFloppy,
  IconDownload,
  IconKey,
  IconLink,
  IconPlayerPause,
  IconPlayerPlay,
  IconRestore,
  IconSettings,
  IconShield,
  IconUserMinus,
} from "@tabler/icons-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { LobbyView } from "./lobby";
import { LobbyPlayerKeyPrompt } from "./LobbyPlayerKeyPrompt";
import { appUrl } from "~/utils/appUrl";
import { StatusPill } from "~/ui/StatusPill";
import classes from "./LobbyPanel.module.css";
import { useMounted } from "@mantine/hooks";

export type LobbyOperation =
  | { type: "join"; name: string; discordPlayerId?: number }
  | { type: "recover"; uuid: string }
  | { type: "start" | "pause" | "resume" | "undo" | "checkpoint" }
  | { type: "rename"; playerId: number; name: string }
  | { type: "release" | "rotate"; playerId: number }
  | { type: "restore"; checkpointId: string }
  | { type: "export"; checkpointId?: string }
  | { type: "import"; state: string };

export type LobbyPanelProps = {
  lobby: LobbyView;
  mode: "bag" | "mantis" | "raw" | "base";
  lobbyId: string;
  ownPlayerId?: number;
  isAdmin: boolean;
  busy?: boolean;
  error?: string | null;
  exportState?: string | null;
  playerOverview?: ReactNode;
  children?: ReactNode;
  adminActions?: ReactNode;
  onOperation: (operation: LobbyOperation) => void;
};

export function downloadLobbyFile(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RecoveryKey({
  uuid,
  title,
  lobbyUrl,
  fileName,
}: {
  uuid: string;
  title: string;
  lobbyUrl: string;
  fileName: string;
}) {
  return (
    <Stack gap="xs">
      <Text fw={600}>{title}</Text>
      <Text
        size="sm"
        style={{ overflowWrap: "anywhere", fontFamily: "monospace" }}
        aria-label={title}
      >
        {uuid}
      </Text>
      <Group gap="xs">
        <CopyButton value={uuid}>
          {({ copied, copy }) => (
            <Button
              size="sm"
              variant="default"
              leftSection={<IconKey size={20} aria-hidden="true" />}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy recovery code"}
            </Button>
          )}
        </CopyButton>
        <Button
          size="sm"
          variant="default"
          leftSection={<IconDownload size={20} aria-hidden="true" />}
          onClick={() =>
            downloadLobbyFile(
              `${title}\n${uuid}\n\nLobby: ${lobbyUrl}\nKeep this recovery code private. It grants access to your lobby role.\n`,
              fileName,
            )
          }
        >
          Download recovery code
        </Button>
      </Group>
    </Stack>
  );
}

export function LobbyPanel({
  lobby,
  mode,
  lobbyId,
  ownPlayerId,
  isAdmin,
  busy: pending = false,
  error,
  exportState,
  playerOverview,
  children,
  adminActions,
  onOperation,
}: LobbyPanelProps) {
  // Server-rendered controls must wait for their event handlers before accepting
  // input; otherwise hydration can erase a name entered on a slow connection.
  const mounted = useMounted();
  const busy = pending || !mounted;
  const [name, setName] = useState("");
  const [discordPlayerId, setDiscordPlayerId] = useState<string | null>(null);
  const [uuid, setUuid] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    operation: LobbyOperation;
  } | null>(null);
  const [lobbyUrl, setLobbyUrl] = useState("");
  const [detailsOpened, setDetailsOpened] = useState(false);
  const detailsId = useId();
  const playersHeadingId = useId();
  const recovered = useRef(new Set<string>());
  const downloaded = useRef<string | null>(null);
  const resetImportFile = useRef<() => void>(null);
  const storageKey = `ti4-lobby:${mode}:${lobbyId}`;
  const lobbyPath =
    mode === "base" ? `/draft/${lobbyId}` : `/draft/${mode}/${lobbyId}`;
  const joined = lobby.slots.filter((s) => s.claimed).length;
  const allJoined = joined === lobby.slots.length && joined > 0;
  const ownSlot = lobby.slots.find((s) => s.id === ownPlayerId);
  const canCollapse = lobby.started && ownPlayerId !== undefined && !isAdmin;
  const showDetails = !canCollapse || detailsOpened;

  useEffect(() => {
    setLobbyUrl(appUrl(lobbyPath));
  }, [lobbyPath]);
  useEffect(() => {
    let failed = false;
    for (const [role, key] of [
      ["player", lobby.ownUuid],
      ["admin", lobby.adminUuid],
    ]) {
      if (!key) continue;
      try {
        localStorage.setItem(`${storageKey}:${role}`, key);
      } catch {
        failed = true;
      }
    }
    setStorageError(failed);
  }, [storageKey, lobby.ownUuid, lobby.adminUuid]);
  useEffect(() => {
    if (busy) return;
    // A full storage quota can block writes while saved recovery codes remain readable.
    try {
      const savedAdmin = !isAdmin
        ? localStorage.getItem(`${storageKey}:admin`)
        : null;
      const savedPlayer =
        ownPlayerId === undefined
          ? localStorage.getItem(`${storageKey}:player`)
          : null;
      const saved = [savedAdmin, savedPlayer].find(
        (key) => key && !recovered.current.has(key),
      );
      if (saved) {
        recovered.current.add(saved);
        onOperation({ type: "recover", uuid: saved });
      }
    } catch {
      setStorageError(true);
    }
  }, [storageKey, ownPlayerId, isAdmin, busy, onOperation]);
  useEffect(() => {
    if (exportState && downloaded.current !== exportState) {
      downloaded.current = exportState;
      downloadLobbyFile(
        exportState,
        `ti4-${mode}-${lobbyId}-${Date.now()}.ti4-state.json`,
      );
    }
  }, [exportState, mode, lobbyId]);

  const confirm = (
    title: string,
    description: string,
    operation: LobbyOperation,
  ) => setConfirmation({ title, description, operation });
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      className="ph-no-capture command-lobby"
    >
      {lobby.ownUuid && (
        <LobbyPlayerKeyPrompt
          key={`${storageKey}:${lobby.ownUuid}`}
          uuid={lobby.ownUuid}
          playerName={ownSlot?.name}
          lobbyUrl={lobbyUrl}
          storageKey={storageKey}
          onDownload={() =>
            downloadLobbyFile(
              `TI4 Draft Command — player private key\nPlayer: ${ownSlot?.name || "Joined player"}\n\n${lobby.ownUuid}\n\nLobby: ${lobbyUrl}\nUse this key as your recovery code to rejoin your draft.\nKeep it private. Anyone with it can act as you in this lobby.\n`,
              `ti4-${mode}-player-${lobbyId}.txt`,
            )
          }
        />
      )}
      <Stack gap="lg">
        <div className={classes.header}>
          <Stack gap="xs" align="flex-start" className={classes.heading}>
            <Title order={mode === "bag" ? 2 : 1} size="h2">
              {lobby.started ? "Lobby" : "Draft lobby"}
            </Title>
            {lobby.started && !lobby.paused && (
              <StatusPill tone="success">Draft started</StatusPill>
            )}
          </Stack>
          <Group gap="sm" className={classes.actions}>
            <CopyButton value={lobbyUrl}>
              {({ copied, copy }) => (
                <Button
                  size="sm"
                  variant={
                    !lobby.started && (isAdmin || ownSlot)
                      ? "filled"
                      : "default"
                  }
                  color={copied ? "success.4" : "sky.4"}
                  leftSection={
                    copied ? (
                      <IconCheck size={20} aria-hidden="true" />
                    ) : (
                      <IconLink size={20} aria-hidden="true" />
                    )
                  }
                  onClick={copy}
                  disabled={!lobbyUrl}
                >
                  {copied ? "Link copied" : "Copy invite link"}
                </Button>
              )}
            </CopyButton>
            {canCollapse && (
              <Button
                variant="default"
                leftSection={<IconSettings size={20} aria-hidden="true" />}
                size="sm"
                aria-expanded={showDetails}
                aria-controls={detailsId}
                onClick={() => setDetailsOpened((opened) => !opened)}
              >
                {showDetails ? "Hide details" : "Lobby details"}
              </Button>
            )}
          </Group>
        </div>
        {!lobby.started && !ownSlot && (
          <Text size="sm" c="dimmed">
            {isAdmin
              ? "Share the invite link with your group. If you’re playing too, enter your name below."
              : "Enter your name to join. The admin starts the draft once everyone is here."}
          </Text>
        )}
        {lobby.paused && (
          <Alert
            color="orange.3"
            icon={<IconPlayerPause size={24} />}
            title="The admin has paused the draft"
          >
            Picks are on hold. You can still rejoin; the admin will resume when
            everyone is ready.
          </Alert>
        )}
        {error && (
          <Alert
            color="red.3"
            icon={<IconAlertTriangle size={24} />}
            title="Action could not be completed"
            role="alert"
          >
            {error}
          </Alert>
        )}
        {storageError && (
          <Alert
            color="orange.3"
            icon={<IconAlertTriangle size={24} />}
            title="Save your recovery code"
          >
            {lobby.ownUuid || lobby.adminUuid
              ? "This browser could not save a backup of your access. Copy or download your recovery code from Recovery & access before leaving."
              : "This browser could not restore saved access automatically. If you already joined, paste your recovery code below."}
          </Alert>
        )}
        {playerOverview ?? (
          <section
            className={classes.players}
            aria-labelledby={playersHeadingId}
          >
            <Group justify="space-between" gap="sm">
              <Title
                id={playersHeadingId}
                order={mode === "bag" ? 3 : 2}
                size="h3"
                className={classes.playersHeading}
              >
                Players
              </Title>
              <span
                className={classes.joined}
                data-complete={allJoined || undefined}
                aria-live="polite"
                aria-atomic="true"
              >
                <span>
                  <strong>{joined}</strong> / {lobby.slots.length}
                </span>
                joined
              </span>
            </Group>
            <div className={classes.playerCapacity} aria-hidden="true">
              {lobby.slots.map((slot, index) => (
                <span
                  key={slot.id}
                  data-filled={index < joined || undefined}
                  data-complete={allJoined || undefined}
                />
              ))}
            </div>
            {joined > 0 ? (
              <ul className={classes.playerList}>
                {lobby.slots
                  .filter((player) => player.claimed)
                  .map((player) => (
                    <li
                      key={player.id}
                      className={classes.playerCard}
                      data-own={player.id === ownPlayerId || undefined}
                    >
                      <div className={classes.playerIdentity}>
                        <span className={classes.playerName}>
                          <span className={classes.playerNameText}>
                            {player.name}
                          </span>
                          {isAdmin && player.id === ownPlayerId && (
                            <span
                              className={classes.adminIcon}
                              role="img"
                              aria-label="Admin"
                              title="Admin"
                            >
                              <IconShield size={18} aria-hidden="true" />
                            </span>
                          )}
                        </span>
                        {player.id === ownPlayerId && (
                          <span className={classes.you}>You</span>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <Text size="sm" c="dimmed" className={classes.emptyPlayers}>
                No players have joined yet.
              </Text>
            )}
          </section>
        )}
        <Collapse expanded={showDetails} id={detailsId}>
          <Stack gap="lg">
            {ownPlayerId === undefined && !allJoined && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy && !allJoined && name.trim())
                    onOperation({
                      type: "join",
                      name: name.trim(),
                      ...(discordPlayerId !== null
                        ? { discordPlayerId: Number(discordPlayerId) }
                        : {}),
                    });
                }}
              >
                <Stack gap="sm">
                  <Group align="end">
                    <TextInput
                      label="Your name"
                      value={name}
                      onChange={(event) => setName(event.currentTarget.value)}
                      maxLength={60}
                      required
                      autoComplete="nickname"
                      style={{ flex: "1 1 180px" }}
                      disabled={busy || allJoined}
                    />
                    <Button
                      type="submit"
                      disabled={busy || !name.trim() || allJoined}
                    >
                      Join lobby
                    </Button>
                  </Group>
                  {!!lobby.discordPlayers?.length && (
                    <Select
                      label="Discord notifications (optional)"
                      description="Choose your Discord account to receive turn notifications, or leave this blank to join with your name only."
                      placeholder="Choose your Discord account"
                      value={discordPlayerId}
                      onChange={setDiscordPlayerId}
                      data={lobby.discordPlayers.map((player) => ({
                        value: String(player.id),
                        label: player.name,
                      }))}
                      clearable
                      searchable
                      disabled={busy}
                    />
                  )}
                </Stack>
              </form>
            )}
            {ownPlayerId === undefined && allJoined && (
              <Text size="sm" c="dimmed">
                Everyone has joined. You can watch the draft, or restore your
                access below if you’re already playing.
              </Text>
            )}
            <Accordion variant="contained">
              <Accordion.Item value="recovery">
                <Accordion.Control>
                  {ownPlayerId !== undefined || isAdmin
                    ? "Recovery & access"
                    : "Already joined? Restore access"}
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {lobby.ownUuid && (
                      <RecoveryKey
                        uuid={lobby.ownUuid}
                        title="Your player recovery code"
                        lobbyUrl={lobbyUrl}
                        fileName={`ti4-${mode}-player-${lobbyId}.txt`}
                      />
                    )}
                    {lobby.adminUuid && (
                      <RecoveryKey
                        uuid={lobby.adminUuid}
                        title="Your admin recovery code"
                        lobbyUrl={lobbyUrl}
                        fileName={`ti4-${mode}-admin-${lobbyId}.txt`}
                      />
                    )}
                    {(lobby.ownUuid || lobby.adminUuid) && (
                      <Text size="sm" c="dimmed">
                        Keep recovery codes private. Use them here or on the
                        homepage to restore access on another device.
                      </Text>
                    )}
                    {(ownPlayerId === undefined || !isAdmin) && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!busy && uuid.trim()) {
                            recovered.current.add(uuid.trim());
                            onOperation({ type: "recover", uuid: uuid.trim() });
                          }
                        }}
                      >
                        <Group align="end">
                          <TextInput
                            label={
                              ownPlayerId !== undefined
                                ? "Restore admin access"
                                : isAdmin
                                  ? "Restore player access"
                                  : "Recovery code"
                            }
                            description="Paste your saved code to return to the same player or admin role."
                            placeholder="Paste your recovery code"
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            maxLength={128}
                            value={uuid}
                            onChange={(event) =>
                              setUuid(event.currentTarget.value)
                            }
                            style={{ flex: "1 1 250px" }}
                            required
                          />
                          <Button
                            type="submit"
                            variant="default"
                            disabled={busy || !uuid.trim()}
                          >
                            Rejoin
                          </Button>
                        </Group>
                      </form>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            {isAdmin && (
              <>
                {!lobby.started && (
                  <div className={classes.startRow}>
                    <Text size="sm" className={classes.startInstruction}>
                      {allJoined
                        ? "Start to reveal the draft and its order."
                        : "All players must join before you can start."}
                    </Text>
                    <Button
                      color="imperial"
                      leftSection={
                        <IconPlayerPlay size={20} aria-hidden="true" />
                      }
                      disabled={busy || !allJoined}
                      onClick={() => onOperation({ type: "start" })}
                    >
                      Start draft
                    </Button>
                  </div>
                )}
                <Accordion
                  variant="contained"
                  className="command-admin-controls"
                >
                  <Accordion.Item value="admin">
                    <Accordion.Control
                      icon={<IconShield size={24} aria-hidden="true" />}
                    >
                      Admin controls
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <Text size="sm">
                          Manage the lobby and repair mistakes here. These
                          controls do not reveal private hands or unrevealed
                          picks.
                          {ownPlayerId === undefined &&
                            " Join above if you are also playing."}
                        </Text>
                        {lobby.started && (
                          <Stack gap="md" className="command-admin-section">
                            <Title
                              order={3}
                              className="command-admin-section-title"
                            >
                              Draft controls
                            </Title>
                            <Group>
                              {adminActions}
                              <Button
                                variant={lobby.paused ? "filled" : "outline"}
                                color={lobby.paused ? "imperial" : "orange.3"}
                                leftSection={
                                  lobby.paused ? (
                                    <IconPlayerPlay
                                      size={20}
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <IconPlayerPause
                                      size={20}
                                      aria-hidden="true"
                                    />
                                  )
                                }
                                disabled={busy || (lobby.paused && !allJoined)}
                                onClick={() =>
                                  onOperation({
                                    type: lobby.paused ? "resume" : "pause",
                                  })
                                }
                              >
                                {lobby.paused ? "Resume draft" : "Pause draft"}
                              </Button>
                              <Button
                                variant="default"
                                leftSection={
                                  <IconDeviceFloppy
                                    size={20}
                                    aria-hidden="true"
                                  />
                                }
                                disabled={busy}
                                onClick={() =>
                                  onOperation({ type: "checkpoint" })
                                }
                              >
                                Save checkpoint
                              </Button>
                              <Button
                                color="orange.3"
                                leftSection={
                                  <IconArrowBackUp
                                    size={20}
                                    aria-hidden="true"
                                  />
                                }
                                variant="outline"
                                disabled={busy || !lobby.checkpoints?.length}
                                onClick={() =>
                                  confirm(
                                    "Undo the latest action?",
                                    "The draft returns to the state before its most recent action. Let players know so they can make their picks again.",
                                    { type: "undo" },
                                  )
                                }
                              >
                                Undo latest action
                              </Button>
                            </Group>
                            <Text size="sm" c="dimmed">
                              Checkpoints are also saved during play. Restore an
                              earlier point to repeat a turn or round. Picks
                              already seen by players cannot be made secret
                              again.
                            </Text>
                            <Group align="end">
                              <Select
                                label="Saved checkpoint"
                                placeholder="Choose a previous state"
                                data={(lobby.checkpoints ?? []).map((c) => ({
                                  value: c.id,
                                  label: `${c.label} · ${c.createdAt}`,
                                }))}
                                value={checkpointId}
                                onChange={setCheckpointId}
                                searchable
                                style={{ flex: "1 1 240px" }}
                              />
                              <Button
                                variant="outline"
                                color="orange.3"
                                leftSection={
                                  <IconRestore size={20} aria-hidden="true" />
                                }
                                disabled={busy || !checkpointId}
                                onClick={() =>
                                  checkpointId &&
                                  confirm(
                                    "Restore this checkpoint?",
                                    "The current draft will be replaced and paused for review. A recovery checkpoint is kept before the change.",
                                    { type: "restore", checkpointId },
                                  )
                                }
                              >
                                Restore checkpoint
                              </Button>
                            </Group>
                          </Stack>
                        )}
                        <Stack gap="md" className="command-admin-section">
                          <Title
                            order={3}
                            className="command-admin-section-title"
                          >
                            Players & recovery
                          </Title>
                          <Text size="sm" c="dimmed">
                            Give each player only their own recovery code.
                            Replacing a code invalidates their old one; they
                            will need the replacement to rejoin.
                          </Text>
                          {lobby.slots
                            .filter((s) => s.claimed)
                            .map((s) => (
                              <Paper key={s.id} withBorder p="sm">
                                <Stack gap="xs">
                                  <Text fw={600}>{s.name}</Text>
                                  {s.uuid && (
                                    <Group gap="xs">
                                      <Text
                                        size="sm"
                                        style={{
                                          overflowWrap: "anywhere",
                                          fontFamily: "monospace",
                                          flex: "1 1 240px",
                                        }}
                                      >
                                        {s.uuid}
                                      </Text>
                                      <CopyButton value={s.uuid}>
                                        {({ copied, copy }) => (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            leftSection={
                                              <IconKey
                                                size={20}
                                                aria-hidden="true"
                                              />
                                            }
                                            onClick={copy}
                                          >
                                            {copied
                                              ? "Copied"
                                              : "Copy recovery code"}
                                          </Button>
                                        )}
                                      </CopyButton>
                                    </Group>
                                  )}
                                  <Group gap="xs">
                                    <Button
                                      variant="outline"
                                      color="orange.3"
                                      leftSection={
                                        <IconKey size={20} aria-hidden="true" />
                                      }
                                      size="sm"
                                      disabled={busy}
                                      onClick={() =>
                                        confirm(
                                          "Replace player recovery code?",
                                          `${s.name} will need their new recovery code to rejoin. Their picks are preserved.`,
                                          { type: "rotate", playerId: s.id },
                                        )
                                      }
                                    >
                                      Replace recovery code
                                    </Button>
                                    {
                                      <Button
                                        variant="outline"
                                        color="red.3"
                                        leftSection={
                                          <IconUserMinus
                                            size={20}
                                            aria-hidden="true"
                                          />
                                        }
                                        size="sm"
                                        disabled={busy}
                                        onClick={() =>
                                          confirm(
                                            "Replace this player?",
                                            `${s.name}'s recovery code will stop working and another player can join in their place. Their picks are preserved. An active draft pauses until the replacement is ready.`,
                                            { type: "release", playerId: s.id },
                                          )
                                        }
                                      >
                                        Replace player
                                      </Button>
                                    }
                                  </Group>
                                </Stack>
                              </Paper>
                            ))}
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (
                                !busy &&
                                renameId !== null &&
                                renameName.trim()
                              )
                                onOperation({
                                  type: "rename",
                                  playerId: Number(renameId),
                                  name: renameName.trim(),
                                });
                            }}
                          >
                            <Group align="end">
                              <Select
                                label="Rename player"
                                value={renameId}
                                onChange={(value) => {
                                  setRenameId(value);
                                  setRenameName(
                                    lobby.slots.find(
                                      (slot) => String(slot.id) === value,
                                    )?.name ?? "",
                                  );
                                }}
                                disabled={busy}
                                data={lobby.slots
                                  .filter((s) => s.claimed)
                                  .map((s) => ({
                                    value: String(s.id),
                                    label: s.name,
                                  }))}
                                style={{ flex: "1 1 160px" }}
                              />
                              <TextInput
                                label="New name"
                                value={renameName}
                                onChange={(event) =>
                                  setRenameName(event.currentTarget.value)
                                }
                                maxLength={60}
                                disabled={busy || renameId === null}
                                style={{ flex: "1 1 160px" }}
                              />
                              <Button
                                type="submit"
                                variant="default"
                                disabled={
                                  busy ||
                                  renameId === null ||
                                  !renameName.trim()
                                }
                              >
                                Rename
                              </Button>
                            </Group>
                          </form>
                        </Stack>
                        <Stack gap="md" className="command-admin-section">
                          <Title
                            order={3}
                            className="command-admin-section-title"
                          >
                            Save files
                          </Title>
                          <Text size="sm">
                            Exports are encrypted to keep private hands hidden.
                            Import them back into this same lobby to recover a
                            saved state. Keep a downloaded copy before making
                            major changes.
                          </Text>
                          <Group>
                            <Button
                              variant="default"
                              leftSection={
                                <IconDownload size={20} aria-hidden="true" />
                              }
                              disabled={busy}
                              onClick={() => onOperation({ type: "export" })}
                            >
                              Export current state
                            </Button>
                            {checkpointId && (
                              <Button
                                variant="default"
                                disabled={busy}
                                onClick={() =>
                                  onOperation({ type: "export", checkpointId })
                                }
                              >
                                Export selected checkpoint
                              </Button>
                            )}
                          </Group>
                          <FileInput
                            label="Import a saved state"
                            placeholder="Choose a .ti4-state.json file"
                            accept=".json,application/json,text/plain"
                            disabled={busy || readingFile}
                            description={
                              readingFile ? "Reading save file…" : undefined
                            }
                            value={null}
                            resetRef={resetImportFile}
                            onChange={async (file) => {
                              resetImportFile.current?.();
                              setFileError(null);
                              if (!file) return;
                              if (file.size > 8 * 1024 * 1024) {
                                setFileError(
                                  "Choose a save file smaller than 8 MB.",
                                );
                                return;
                              }
                              setReadingFile(true);
                              try {
                                const state = await file.text();
                                confirm(
                                  "Import this saved state?",
                                  `Restore ${file.name} in this lobby, paused for review. A recovery checkpoint is kept before the change.`,
                                  { type: "import", state },
                                );
                              } catch {
                                setFileError(
                                  "The save file could not be read. Try selecting it again.",
                                );
                              } finally {
                                setReadingFile(false);
                              }
                            }}
                          />
                          {fileError && (
                            <Alert color="red.3" title="Import failed">
                              {fileError}
                            </Alert>
                          )}
                        </Stack>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </>
            )}
          </Stack>
        </Collapse>
        {children}
      </Stack>
      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={confirmation?.title}
        centered
      >
        <Stack>
          <Text>{confirmation?.description}</Text>
          <Group justify="end">
            <Button variant="default" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              color={
                confirmation?.operation.type === "release"
                  ? "red.3"
                  : "orange.3"
              }
              disabled={busy}
              onClick={() => {
                if (confirmation) onOperation(confirmation.operation);
                setConfirmation(null);
              }}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
