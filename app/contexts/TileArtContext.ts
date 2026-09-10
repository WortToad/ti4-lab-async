import { createContext } from "react";

export const TileArtContext = createContext<{
  originalArt: boolean;
  setOriginalArt: (originalArt: boolean) => void;
} | null>(null);
