import { isAudioAlertEnabled } from "./audioAlert";

export async function requestNotificationPermission() {
  if (!("Notification" in window) || !navigator.serviceWorker) return "denied";
  if (
    "Notification" in window &&
    navigator.serviceWorker &&
    Notification.permission === "default"
  ) {
    // Browsers can reject permission requests without a user gesture.
    return Notification.requestPermission().catch(() => "denied" as const);
  }
  return typeof Notification === "undefined"
    ? "denied"
    : Notification.permission;
}

export function showNotification(title: string, options: NotificationOptions) {
  if (
    "Notification" in window &&
    Notification.permission === "granted" &&
    navigator.serviceWorker
  ) {
    // Permission may be revoked while the service worker is becoming ready.
    void navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => {});
  }
}

export function playNotificationSound() {
  if (!isAudioAlertEnabled()) return;
  const audio = document.getElementById("notificationSound");
  if (audio instanceof HTMLMediaElement) void audio.play().catch(() => {});
}
