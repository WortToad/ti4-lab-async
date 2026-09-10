import {
  Accordion,
  Alert,
  Badge,
  Button,
  CopyButton,
  FileInput,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { LobbyView } from "./lobby";
import { appUrl } from "~/utils/appUrl";

export type LobbyOperation =
  | { type: "join"; name: string }
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
            <Button size="xs" variant="light" onClick={copy}>
              {copied ? "Copied" : "Copy UUID"}
            </Button>
          )}
        </CopyButton>
        <Button
          size="xs"
          variant="subtle"
          onClick={() =>
            downloadLobbyFile(
              `${title}\n${uuid}\n\nLobby: ${lobbyUrl}\nKeep this UUID private. It grants access to your lobby role.\n`,
              fileName,
            )
          }
        >
          Save UUID file
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
  busy = false,
  error,
  exportState,
  onOperation,
}: LobbyPanelProps) {
  const [name, setName] = useState("");
  const [uuid, setUuid] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    operation: LobbyOperation;
  } | null>(null);
  const [lobbyUrl, setLobbyUrl] = useState("");
  const recovered = useRef(new Set<string>());
  const downloaded = useRef<string | null>(null);
  const storageKey = `ti4-lobby:${mode}:${lobbyId}`;
  const lobbyPath =
    mode === "base" ? `/draft/${lobbyId}` : `/draft/${mode}/${lobbyId}`;
  const joined = lobby.slots.filter((s) => s.claimed).length;
  const allJoined = joined === lobby.slots.length && joined > 0;
  const ownSlot = lobby.slots.find((s) => s.id === ownPlayerId);

  useEffect(() => {
    setLobbyUrl(appUrl(lobbyPath));
  }, [lobbyPath]);
  useEffect(() => {
    try {
      if (lobby.ownUuid)
        localStorage.setItem(`${storageKey}:player`, lobby.ownUuid);
      if (lobby.adminUuid)
        localStorage.setItem(`${storageKey}:admin`, lobby.adminUuid);
      if (busy) return;
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
  }, [
    storageKey,
    lobby.ownUuid,
    lobby.adminUuid,
    ownPlayerId,
    isAdmin,
    busy,
    onOperation,
  ]);
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
  const slotLabel = (id: number) =>
    `Slot ${lobby.slots.findIndex((s) => s.id === id) + 1}`;
  return (
    <Paper withBorder p="md" radius="md" className="ph-no-capture">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>
            {lobby.started ? "Lobby & recovery" : "Join the lobby"}
          </Title>
          <Group gap="xs">
            <Badge
              color={lobby.paused ? "orange" : lobby.started ? "green" : "blue"}
            >
              {lobby.paused
                ? "Paused"
                : lobby.started
                  ? "Draft started"
                  : `${joined} / ${lobby.slots.length} joined`}
            </Badge>
            {isAdmin && <Badge variant="outline">Admin</Badge>}
          </Group>
        </Group>
        {!lobby.started && (
          <Alert title="Everyone joins here" color="blue">
            Enter your name and join. Save your recovery UUID, then wait for the
            admin to start. Seating and draft order stay hidden until then.
          </Alert>
        )}
        {lobby.paused && (
          <Alert color="orange" title="The admin has paused the draft">
            Picks are on hold. You can still return to your slot; the admin will
            resume when everyone is ready.
          </Alert>
        )}
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group align="end" wrap="wrap">
          <TextInput
            label="Share this lobby link with everyone"
            value={lobbyUrl}
            readOnly
            style={{ flex: "1 1 240px" }}
            onFocus={(event) => event.currentTarget.select()}
          />
          <CopyButton value={lobbyUrl}>
            {({ copied, copy }) => (
              <Button variant="light" onClick={copy} disabled={!lobbyUrl}>
                {copied ? "Link copied" : "Copy lobby link"}
              </Button>
            )}
          </CopyButton>
        </Group>
        {!lobby.started && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {lobby.slots.map((s) => (
              <Paper key={s.id} withBorder p="sm">
                <Group justify="space-between">
                  <Text fw={600}>
                    {s.claimed ? s.name : "Waiting for a player"}
                  </Text>
                  <Badge color={s.claimed ? "green" : "gray"} variant="light">
                    {s.id === ownPlayerId
                      ? "You"
                      : s.claimed
                        ? "Joined"
                        : "Available"}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}
        {ownPlayerId === undefined && !allJoined && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && !allJoined && name.trim())
                onOperation({
                  type: "join",
                  name: name.trim(),
                });
            }}
          >
            <Stack gap="sm">
              <Text fw={600}>
                {isAdmin ? "Playing too? Join the lobby" : "Join the lobby"}
              </Text>
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
            </Stack>
          </form>
        )}
        {ownPlayerId !== undefined && (
          <Alert
            title={`You joined as ${ownSlot?.name || slotLabel(ownPlayerId)}`}
            color="green"
          >
            <Stack gap="sm">
              <Text size="sm">
                {lobby.started
                  ? "Your player view appears below."
                  : "You are ready. The admin can start once everyone has joined."}
              </Text>
              {lobby.ownUuid && (
                <RecoveryKey
                  uuid={lobby.ownUuid}
                  title="Save your player recovery UUID"
                  lobbyUrl={lobbyUrl}
                  fileName={`ti4-${mode}-player-${lobbyId}.txt`}
                />
              )}
              <Text size="sm">
                Keep this UUID private. It restores your slot on another device,
                from this link or “Rejoin a lobby” on the main page. This
                browser also remembers it automatically.
              </Text>
            </Stack>
          </Alert>
        )}
        {storageError && (
          <Alert color="orange">
            This browser could not save your UUID locally. Copy or download it
            before leaving.
          </Alert>
        )}
        {(ownPlayerId === undefined || !isAdmin) && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (uuid.trim()) {
                recovered.current.add(uuid.trim());
                onOperation({ type: "recover", uuid: uuid.trim() });
              }
            }}
          >
            <Group align="end">
              <TextInput
                label="Already joined? Rejoin with your UUID"
                description="Use your saved player or admin UUID on a new device."
                placeholder="Paste your recovery UUID"
                autoComplete="off"
                value={uuid}
                onChange={(event) => setUuid(event.currentTarget.value)}
                style={{ flex: "1 1 250px" }}
                required
              />
              <Button
                type="submit"
                variant="light"
                disabled={busy || !uuid.trim()}
              >
                Rejoin
              </Button>
            </Group>
          </form>
        )}
        {isAdmin && (
          <>
            {!lobby.started && (
              <Stack gap="xs">
                <Button
                  disabled={busy || !allJoined}
                  onClick={() => onOperation({ type: "start" })}
                >
                  Start draft
                </Button>
                <Text size="sm" c="dimmed">
                  {allJoined
                    ? "Everyone has joined. Starting reveals the draft and its order."
                    : `Waiting for ${lobby.slots.length - joined} more player${lobby.slots.length - joined === 1 ? "" : "s"} before you can start.`}
                </Text>
              </Stack>
            )}
            <Accordion variant="contained">
              <Accordion.Item value="admin">
                <Accordion.Control>Admin controls & recovery</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <Text size="sm">
                      Manage the lobby and repair mistakes here. These controls
                      do not reveal private hands or unrevealed picks. Join
                      above if you are also playing.
                    </Text>
                    {lobby.adminUuid && (
                      <RecoveryKey
                        uuid={lobby.adminUuid}
                        title="Save your admin recovery UUID"
                        lobbyUrl={lobbyUrl}
                        fileName={`ti4-${mode}-admin-${lobbyId}.txt`}
                      />
                    )}
                    <Text fw={600}>Player recovery</Text>
                    <Text size="sm" c="dimmed">
                      Give each player only their own UUID. Replacing a UUID
                      invalidates their old one; they will need the replacement
                      to rejoin.
                    </Text>
                    {lobby.slots
                      .filter((s) => s.claimed)
                      .map((s) => (
                        <Paper key={s.id} withBorder p="sm">
                          <Stack gap="xs">
                            <Text fw={600}>
                              {slotLabel(s.id)} · {s.name}
                            </Text>
                            {s.uuid && (
                              <Group gap="xs">
                                <Text
                                  size="xs"
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
                                      size="xs"
                                      variant="light"
                                      onClick={copy}
                                    >
                                      {copied ? "Copied" : "Copy UUID"}
                                    </Button>
                                  )}
                                </CopyButton>
                              </Group>
                            )}
                            <Group gap="xs">
                              <Button
                                variant="subtle"
                                size="xs"
                                disabled={busy}
                                onClick={() =>
                                  confirm(
                                    "Replace player UUID?",
                                    `${s.name} will need their new UUID to rejoin. Their picks and slot are preserved.`,
                                    { type: "rotate", playerId: s.id },
                                  )
                                }
                              >
                                Replace UUID
                              </Button>
                              {
                                <Button
                                  variant="subtle"
                                  color="red"
                                  size="xs"
                                  disabled={busy}
                                  onClick={() =>
                                    confirm(
                                      "Release this slot?",
                                      `${s.name}'s UUID will stop working and another player can join in their place. An active draft pauses until the replacement is ready.`,
                                      { type: "release", playerId: s.id },
                                    )
                                  }
                                >
                                  Release slot
                                </Button>
                              }
                            </Group>
                          </Stack>
                        </Paper>
                      ))}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (renameId !== null && renameName.trim())
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
                          onChange={setRenameId}
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
                          style={{ flex: "1 1 160px" }}
                        />
                        <Button
                          type="submit"
                          variant="light"
                          disabled={
                            busy || renameId === null || !renameName.trim()
                          }
                        >
                          Rename
                        </Button>
                      </Group>
                    </form>
                    {lobby.started && (
                      <>
                        <Group>
                          <Button
                            color={lobby.paused ? "green" : "orange"}
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
                            variant="light"
                            disabled={busy}
                            onClick={() => onOperation({ type: "checkpoint" })}
                          >
                            Save checkpoint
                          </Button>
                          <Button
                            color="orange"
                            variant="light"
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
                          earlier point to repeat a turn or round. Picks already
                          seen by players cannot be made secret again.
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
                            variant="light"
                            color="orange"
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
                      </>
                    )}
                    <Text fw={600}>Save files</Text>
                    <Text size="sm">
                      Exports are encrypted to keep private hands hidden. Import
                      them back into this same lobby to recover a saved state.
                      Keep a downloaded copy before making major changes.
                    </Text>
                    <Group>
                      <Button
                        variant="light"
                        disabled={busy}
                        onClick={() => onOperation({ type: "export" })}
                      >
                        Export current state
                      </Button>
                      {checkpointId && (
                        <Button
                          variant="subtle"
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
                      disabled={busy}
                      clearable
                      onChange={async (file) => {
                        setFileError(null);
                        if (!file) return;
                        if (file.size > 8 * 1024 * 1024) {
                          setFileError("Choose a save file smaller than 8 MB.");
                          return;
                        }
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
                        }
                      }}
                    />
                    {fileError && <Alert color="red">{fileError}</Alert>}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </>
        )}
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
              color="orange"
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
