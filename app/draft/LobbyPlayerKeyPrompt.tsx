import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCheck, IconCopy, IconDownload } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export function LobbyPlayerKeyPrompt({
  uuid,
  playerName,
  lobbyUrl,
  storageKey,
  onDownload,
}: {
  uuid: string;
  playerName?: string;
  lobbyUrl: string;
  storageKey: string;
  onDownload: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const clipboard = useClipboard({ timeout: 3000 });
  const noticeKey = `${storageKey}:player-key-notice`;

  useEffect(() => {
    try {
      if (localStorage.getItem(noticeKey) === uuid) return;
    } catch {
      // Players still need their key when browser storage is unavailable.
    }
    setOpened(true);
  }, [noticeKey, uuid]);

  const dismiss = () => {
    try {
      localStorage.setItem(noticeKey, uuid);
    } catch {
      // Dismiss for this visit even if the browser cannot remember it.
    }
    setOpened(false);
  };

  return (
    <Modal
      opened={opened}
      onClose={dismiss}
      title="Save your private key"
      size="md"
      classNames={{ content: "ph-no-capture" }}
    >
      <Stack gap="md">
        {playerName && <Text fw={600}>You’re playing as {playerName}.</Text>}
        <Text>
          Save this key to return to your place in this lobby on another device
          or after clearing your browser data. Use it as your recovery code when
          rejoining a draft.
        </Text>
        <Textarea
          label="Private key (recovery code)"
          value={uuid}
          readOnly
          autosize
          minRows={2}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
          styles={{
            input: { fontFamily: "monospace", overflowWrap: "anywhere" },
          }}
        />
        <Text size="sm" c="dimmed">
          Keep this key private. Anyone with it can act as you in this lobby.
          Share the lobby’s invite link with other players instead.
        </Text>
        {clipboard.error && (
          <Alert color="orange" role="alert">
            Your browser could not copy the key. Select it above and copy it
            manually, or download a copy below.
          </Alert>
        )}
        <Group grow>
          <Button
            leftSection={
              clipboard.copied ? (
                <IconCheck size={20} aria-hidden="true" />
              ) : (
                <IconCopy size={20} aria-hidden="true" />
              )
            }
            onClick={() => {
              clipboard.reset();
              clipboard.copy(uuid);
            }}
          >
            {clipboard.copied ? "Copied" : "Copy private key"}
          </Button>
          <Button
            variant="default"
            leftSection={<IconDownload size={20} aria-hidden="true" />}
            disabled={!lobbyUrl}
            onClick={() => {
              onDownload();
              setDownloaded(true);
            }}
          >
            Download key
          </Button>
        </Group>
        <Text size="sm" role="status" mih={24}>
          {clipboard.copied
            ? "Private key copied."
            : downloaded
              ? "Your key file download has started."
              : ""}
        </Text>
        <Text size="sm" c="dimmed">
          You can find this key again under Recovery &amp; access in the lobby.
        </Text>
        <Button variant="light" onClick={dismiss} fullWidth>
          Continue to lobby
        </Button>
      </Stack>
    </Modal>
  );
}
