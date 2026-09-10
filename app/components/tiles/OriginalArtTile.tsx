import { appPath } from "~/utils/appUrl";
import { useContext, useState } from "react";
import { Hex } from "../Hex";
import type { SystemTile } from "~/types";
import { MapContext } from "~/contexts/MapContext";
import { systemData } from "~/data/systemData";
import { RawSystemTile } from "./SystemTile";

import classes from "./Tiles.module.css";

type Props = {
  mapId: string;
  tile: SystemTile;
  radius?: number;
  imagePath?: string;
  hoverEffects?: boolean;
  children?: React.ReactNode;
};

export function OriginalArtTile({
  mapId,
  tile,
  radius: radiusOverride,
  imagePath,
  hoverEffects = true,
  children,
}: Props) {
  const { radius: mapRadius } = useContext(MapContext);
  const radius = radiusOverride ?? mapRadius;
  const system = systemData[tile.systemId];
  const [isHovered, setIsHovered] = useState(false);
  const [failedImagePath, setFailedImagePath] = useState<string>();
  const artworkPath = imagePath ?? `/tiles/ST_${system.id}.png`;

  if (failedImagePath === artworkPath) {
    return (
      <div className={classes.tileWrapper}>
        <RawSystemTile
          mapId={mapId}
          tile={tile}
          radius={radius}
          disablePopover
        />
        {children && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${classes.tileWrapper} ${hoverEffects && isHovered ? classes.hovered : ""}`}
      style={{
        transform: tile.rotation ? `rotate(${tile.rotation}deg)` : undefined,
      }}
    >
      <Hex
        id={`${mapId}-${system.id}`}
        radius={radius}
        image={
          <image
            href={appPath(artworkPath)}
            {...{ onError: () => setFailedImagePath(artworkPath) }}
            x={-radius}
            y={-radius}
            width={radius * 2}
            height={radius * 2}
          />
        }
      >
        {children}
      </Hex>
      <div
        style={{
          position: "absolute",
          backgroundColor: "transparent",
          width: `${radius * 1.75}px`,
          height: `${radius * 1.75}px`,
          top: `${radius * 0.125}px`,
          left: `${radius * 0.125}px`,
          borderRadius: "50%",
        }}
        onMouseEnter={hoverEffects ? () => setIsHovered(true) : undefined}
        onMouseLeave={hoverEffects ? () => setIsHovered(false) : undefined}
      />
    </div>
  );
}
