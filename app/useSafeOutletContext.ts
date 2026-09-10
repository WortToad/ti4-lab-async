import { useOutletContext } from "react-router";
import { DraftOrderContext } from "./routes/draft/route";
import { useContext } from "react";
import { LobbyIdentityContext } from "./draft/LobbyIdentity";
import { TileArtContext } from "./contexts/TileArtContext";

export function useSafeOutletContext(): DraftOrderContext {
  const context = useOutletContext<DraftOrderContext>();
  const lobby = useContext(LobbyIdentityContext);
  const tileArt = useContext(TileArtContext);

  if (context)
    return lobby?.managed
      ? {
          ...context,
          ...tileArt,
          adminMode: false,
          pickForAnyone: false,
          setAdminMode: () => {},
          setPickForAnyone: () => {},
        }
      : { ...context, ...tileArt };
  return {
    adminMode: false,
    pickForAnyone: false,
    originalArt: true,
    accessibleColors: false,
    setOriginalArt: () => {},
    setAdminMode: () => {},
    setPickForAnyone: () => {},
    setAccessibleColors: () => {},
    ...tileArt,
  };
}
