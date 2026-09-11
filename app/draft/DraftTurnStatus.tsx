import {
  Button,
  Group,
  Paper,
  Popover,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import {
  IconBell,
  IconBolt,
  IconCheck,
  IconClock,
  IconPlayerPause,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { appPath } from "~/utils/appUrl";
import { isAudioAlertEnabled, setAudioAlertEnabled } from "~/utils/audioAlert";
import {
  playNotificationSound,
  requestNotificationPermission,
  showNotification,
} from "~/utils/notifications";
import {
  browserAlertsEnabled,
  rememberDraftTurn,
  setBrowserAlertsEnabled,
} from "./turnNotifications";
import type { PendingDraftAction } from "./turn";
import { StatusPill } from "~/ui/StatusPill";

export function DraftTurnStatus({
  roomKey,
  playerId,
  pending,
  paused = false,
  complete = false,
}: {
  roomKey: string;
  playerId: number;
  pending?: PendingDraftAction;
  paused?: boolean;
  complete?: boolean;
}) {
  const [sound, setSound] = useState(false);
  const [browser, setBrowser] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const last = useRef<string | undefined>(undefined);
  const actionKey = !paused && !complete ? pending?.key : undefined;
  const label = actionKey ? pending?.label : undefined;
  const identity = `${roomKey}:${playerId}`;

  useEffect(() => {
    const refreshPreferences = () => {
      setSound(isAudioAlertEnabled());
      setBrowser(browserAlertsEnabled());
    };
    refreshPreferences();
    window.addEventListener("storage", refreshPreferences);
    window.addEventListener("focus", refreshPreferences);
    return () => {
      window.removeEventListener("storage", refreshPreferences);
      window.removeEventListener("focus", refreshPreferences);
    };
  }, []);

  useEffect(() => {
    const current = `${identity}:${actionKey ?? "waiting"}`;
    if (last.current === current) return;
    last.current = current;
    let notify = !!actionKey;
    try {
      notify = rememberDraftTurn(sessionStorage, identity, actionKey);
    } catch {
      /* In-memory deduplication still works. */
    }
    if (!notify) return;
    playNotificationSound();
    if (browserAlertsEnabled() && document.visibilityState === "hidden") {
      showNotification("Your turn to draft", {
        body: label,
        icon: appPath("/brand/ti4-draft-command-gold.png"),
        badge: appPath("/brand/ti4-draft-command-gold.png"),
        tag: `draft-turn:${identity}`,
        data: { url: window.location.href },
      });
    }
  }, [identity, actionKey, label]);

  useEffect(() => {
    if (!actionKey) return;
    const original = document.title;
    const title = `Your turn · ${original}`;
    document.title = title;
    return () => {
      if (document.title === title) document.title = original;
    };
  }, [identity, actionKey]);

  const toggleBrowser = async (enabled: boolean) => {
    if (!enabled) {
      setBrowserAlertsEnabled(false);
      const stillEnabled = browserAlertsEnabled();
      setBrowser(stillEnabled);
      setPermissionMessage(
        stillEnabled
          ? "Your browser could not save this preference. Allow site storage and try again."
          : "",
      );
      return;
    }
    const permission = await requestNotificationPermission();
    const allowed = permission === "granted";
    setBrowserAlertsEnabled(allowed);
    const saved = browserAlertsEnabled();
    setBrowser(saved);
    setPermissionMessage(
      allowed
        ? saved
          ? ""
          : "Your browser could not save this preference. Allow site storage and try again."
        : "Browser alerts are unavailable or blocked. You can allow notifications in this site's browser settings.",
    );
  };

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      className="command-state-panel"
      data-state={
        complete || actionKey ? "success" : paused ? "warning" : "waiting"
      }
    >
      <Group justify="space-between" gap="sm">
        <Group gap="sm" style={{ flex: "1 1 220px" }}>
          <StatusPill
            tone={
              complete || actionKey ? "success" : paused ? "warning" : "neutral"
            }
            prominent
            icon={
              complete ? (
                <IconCheck size={18} aria-hidden="true" />
              ) : paused ? (
                <IconPlayerPause size={18} aria-hidden="true" />
              ) : actionKey ? (
                <IconBolt size={18} aria-hidden="true" />
              ) : (
                <IconClock size={18} aria-hidden="true" />
              )
            }
          >
            {complete
              ? "Complete"
              : paused
                ? "Paused"
                : actionKey
                  ? "Your turn"
                  : "Waiting"}
          </StatusPill>
          <Text size="md" fw={600} role="status">
            {complete
              ? "Your draft is complete."
              : paused
                ? "The admin has paused play."
                : (label ?? "Waiting for the other players.")}
          </Text>
        </Group>
        <Popover
          width={280}
          position="bottom-end"
          withinPortal
          trapFocus
          returnFocus
        >
          <Popover.Target>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconBell size={20} aria-hidden="true" />}
            >
              Turn alerts
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <Switch
                label="Sound alerts"
                checked={sound}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked;
                  setAudioAlertEnabled(enabled);
                  setSound(isAudioAlertEnabled());
                  if (enabled) playNotificationSound();
                }}
              />
              <Switch
                label="Browser notifications"
                checked={browser}
                onChange={(event) =>
                  void toggleBrowser(event.currentTarget.checked)
                }
              />
              <Text size="xs" c="dimmed">
                Alerts apply to your pending choices, including simultaneous
                rounds. Keep this tab open to receive them.
              </Text>
              {permissionMessage && (
                <Text size="xs" c="orange" role="status">
                  {permissionMessage}
                </Text>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
      <audio
        id="notificationSound"
        src={appPath("/chime.mp3")}
        preload="auto"
        aria-hidden="true"
      >
        <track kind="captions" />
      </audio>
    </Paper>
  );
}
