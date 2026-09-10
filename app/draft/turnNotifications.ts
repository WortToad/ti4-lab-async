const BROWSER_ALERTS_KEY = "draft:browserAlerts:enabled";

export function browserAlertsEnabled() {
  try {
    return (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      localStorage.getItem(BROWSER_ALERTS_KEY) === "true"
    );
  } catch {
    return false;
  }
}

export function setBrowserAlertsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(BROWSER_ALERTS_KEY, String(enabled));
  } catch {
    /* Optional preference. */
  }
}

export function rememberDraftTurn(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  identity: string,
  actionKey?: string,
) {
  const key = `draft:lastAlert:${identity}`;
  if (!actionKey) {
    storage.removeItem(key);
    return false;
  }
  if (storage.getItem(key) === actionKey) return false;
  storage.setItem(key, actionKey);
  return true;
}
