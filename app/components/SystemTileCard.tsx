import { useId, type CSSProperties } from "react";
import { Text } from "@mantine/core";
import { Surface } from "~/ui";
import type { PlayerColor } from "~/ui";
import type { SystemId } from "~/types";
import { RawSystemTile } from "~/components/tiles/SystemTile";
import { SelectionOverlay } from "~/components/SelectionOverlay";
import { FaceDownTile } from "~/components/tiles/FaceDownTile";
import { OriginalArtTile } from "~/components/tiles/OriginalArtTile";
import { systemData } from "~/data/systemData";
import { useSafeOutletContext } from "~/useSafeOutletContext";
import { appPath } from "~/utils/appUrl";
import { SystemTileStats } from "~/components/SystemTileStats";

type Props = {
  systemId: SystemId;
  radius: number;
  selected?: boolean;
  selectedColor?: PlayerColor;
  padding?: number;
  borderRadius?: string;
  hideValues?: boolean;
  showOverlay?: boolean;
  overlaySize?: "sm" | "md";
  faceDown?: boolean;
  faceDownColor?: "blue" | "red";
  originalArt?: boolean;
  /** Original artwork override, also used when simplified tile data is absent. */
  imagePath?: string;
  showStats?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

export function SystemTileCard({
  systemId,
  radius,
  selected = false,
  selectedColor = "green",
  padding = 8,
  borderRadius = "var(--mantine-radius-md)",
  hideValues = false,
  showOverlay = false,
  overlaySize = "sm",
  faceDown = false,
  faceDownColor = "blue",
  originalArt: originalArtOverride,
  imagePath,
  showStats = true,
  onClick,
  style,
}: Props) {
  const { originalArt: preferredOriginalArt } = useSafeOutletContext();
  const originalArt = originalArtOverride ?? preferredOriginalArt;
  const normalizedSystemId = /^\d+$/.test(systemId)
    ? String(Number(systemId))
    : systemId;
  const instanceId = useId();
  const mapId = `system-tile-card-${instanceId}`;
  const tile = {
    idx: 0,
    type: "SYSTEM" as const,
    systemId: normalizedSystemId,
    position: { x: 0, y: 0 },
  };
  const isInteractive = !!onClick;

  return (
    <Surface
      variant={isInteractive && !selected ? "interactive" : "card"}
      color={selected ? selectedColor : undefined}
      onClick={onClick}
      style={{
        padding,
        borderRadius,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: isInteractive ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {faceDown ? (
        <FaceDownTile mapId={mapId} radius={radius} color={faceDownColor} />
      ) : !systemData[normalizedSystemId] ? (
        imagePath ? (
          <img
            src={appPath(imagePath)}
            alt={`System ${systemId}`}
            width={radius * 2}
            height={radius * 2}
            style={{ objectFit: "contain" }}
          />
        ) : (
          <Text
            size="sm"
            c="dimmed"
            style={{
              width: radius * 2,
              minHeight: radius * 2,
              alignContent: "center",
              textAlign: "center",
            }}
          >
            System {systemId}
          </Text>
        )
      ) : originalArt ? (
        <OriginalArtTile
          mapId={mapId}
          tile={tile}
          radius={radius}
          imagePath={imagePath}
          hoverEffects={false}
        />
      ) : (
        <RawSystemTile
          mapId={mapId}
          tile={tile}
          hideValues={hideValues}
          radius={radius}
          disablePopover={true}
        />
      )}
      {showStats &&
        !hideValues &&
        !faceDown &&
        systemData[normalizedSystemId] && (
          <SystemTileStats system={systemData[normalizedSystemId]} />
        )}
      {showOverlay && (
        <SelectionOverlay
          visible={selected}
          size={overlaySize}
          showBadge={false}
        />
      )}
    </Surface>
  );
}
