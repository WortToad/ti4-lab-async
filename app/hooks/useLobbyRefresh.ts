import { useEffect, useRef } from "react";
import { useFetchers, useRevalidator } from "react-router";
import { useSocket } from "~/socketContext";
import { browserAlertsEnabled } from "~/draft/turnNotifications";
import { isAudioAlertEnabled } from "~/utils/audioAlert";

export function useLobbyRefresh(enabled = true) {
  const revalidator = useRevalidator();
  const fetchers = useFetchers();
  const submitting = fetchers.some((fetcher) => fetcher.state !== "idle");
  const socket = useSocket();
  const pending = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const shouldRefresh = () =>
      navigator.onLine !== false &&
      (document.visibilityState === "visible" || browserAlertsEnabled() || isAudioAlertEnabled());
    const refresh = () => {
      if (!shouldRefresh()) return;
      if (submitting || revalidator.state !== "idle") {
        pending.current = true;
        return;
      }
      pending.current = false;
      void revalidator.revalidate();
    };
    if (pending.current && !submitting && revalidator.state === "idle")
      refresh();
    const timer = window.setInterval(() => {
      if (!submitting && revalidator.state === "idle") refresh();
    }, 3000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    socket?.on("connect", refresh);
    socket?.on("draftChanged", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      socket?.off("connect", refresh);
      socket?.off("draftChanged", refresh);
    };
  }, [enabled, submitting, revalidator, socket]);
}
