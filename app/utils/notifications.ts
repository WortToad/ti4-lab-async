import { isAudioAlertEnabled } from "./audioAlert";

export function requestNotificationPermission() {
  if (
    "Notification" in window &&
    navigator.serviceWorker &&
    Notification.permission === "default"
  ) {
    // Browsers can reject permission requests without a user gesture.
    void Notification.requestPermission().catch(() => {});
  }
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
