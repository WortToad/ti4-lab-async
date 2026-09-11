import { Hex } from "../Hex";
import { PlayerDemoTile as TPlayerDemoTile } from "~/types";
import { useContext } from "react";
import { MapContext } from "~/contexts/MapContext";
import { Text } from "@mantine/core";

import classes from "./Tiles.module.css";

type Props = {
  tile: TPlayerDemoTile;
  title: string;
  color: string;
};

export function PlayerDemoTile({ tile, title, color }: Props) {
  const { radius } = useContext(MapContext);
  return (
    <Hex
      id={`player-demo-${tile.playerNumber}-${tile.idx}`}
      radius={radius}
      colorClass={classes[color]}
      showBorder={tile.playerNumber === 6}
    >
      {tile.isHomeSystem && (
        <Text
          fz={Math.min(24, radius * 0.38)}
          ff="var(--font-display)"
          fw={600}
          bg="#071321"
          px={5}
          py={2}
          style={{ zIndex: 1, whiteSpace: "nowrap" }}
          className={classes.title}
        >
          {title}
        </Text>
      )}
    </Hex>
  );
}
