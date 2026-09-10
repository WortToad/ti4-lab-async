import { createContext } from "react";

/** Managed lobbies use server credentials instead of the legacy admin switch. */
export const LobbyIdentityContext = createContext<{
  managed: boolean;
  isAdmin: boolean;
  paused: boolean;
} | null>(null);
