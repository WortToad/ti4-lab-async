import { useOutletContext } from "react-router";
import { DraftOrderContext } from "./routes/draft/route";
import { useContext } from "react";
import { LobbyIdentityContext } from "./draft/LobbyIdentity";

export function useSafeOutletContext(): DraftOrderContext {
  const context = useOutletContext<DraftOrderContext>();
  const lobby = useContext(LobbyIdentityContext);

  if (context)
    return lobby?.managed
      ? {
          ...context,
          adminMode: false,
          pickForAnyone: false,
          setAdminMode: () => {},
          setPickForAnyone: () => {},
        }
      : context;
  return {
    adminMode: false,
    pickForAnyone: false,
    originalArt: true,
    accessibleColors: false,
    setOriginalArt: () => {},
    setAdminMode: () => {},
    setPickForAnyone: () => {},
    setAccessibleColors: () => {},
  };
}
