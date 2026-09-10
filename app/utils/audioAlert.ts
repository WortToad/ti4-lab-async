const AUDIO_ALERT_PREFERENCE_KEY = "draft:audioAlert:enabled";
const AUDIO_ALERT_CONSENT_KEY = "draft:audioAlert:consentGiven";

/**
 * Get whether the user has given consent for audio alerts
 */
export function hasAudioAlertConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUDIO_ALERT_CONSENT_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Get whether audio alerts are enabled
 */
export function isAudioAlertEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!hasAudioAlertConsent()) return false;
  try {
    return localStorage.getItem(AUDIO_ALERT_PREFERENCE_KEY) !== "false";
  } catch {
    return false;
  }
}

/**
 * Set whether audio alerts are enabled
 */
export function setAudioAlertEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUDIO_ALERT_CONSENT_KEY, "true");
    localStorage.setItem(
      AUDIO_ALERT_PREFERENCE_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    /* Preferences remain optional when storage is unavailable. */
  }
}

/**
 * Mark that the user has given consent (shows the prompt)
 */
export function markAudioAlertConsentGiven(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUDIO_ALERT_CONSENT_KEY, "true");
  } catch {
    /* Storage is optional. */
  }
}
