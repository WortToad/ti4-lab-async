import { Tile } from "~/types";
import { SystemTile } from "./tiles/SystemTile";
import { EmptyTile } from "./tiles/EmptyTile";
import { ClosedTile } from "./tiles/ClosedTile";
import { useContext, useEffect, useState, useMemo, type JSX } from "react";
import { getHexPosition } from "~/utils/positioning";
import { MecatolTile } from "./tiles/MecatolTile";
import { HomeTile } from "./tiles/HomeTile";
import { ActionIcon } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import "./MapTile.css";
import { MapContext } from "~/contexts/MapContext";
import { OriginalArtTile } from "./tiles/OriginalArtTile";
import { useSafeOutletContext } from "~/useSafeOutletContext";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CoreSliceData } from "~/hooks/useCoreSliceValues";
import type { SliceValueBreakdown } from "~/hooks/useSliceValueBreakdown";
import type { TileContribution, SliceStats } from "~/mapgen/utils/sliceScoring";
import { ContributionBadge } from "./tiles/ContributionBadge";
import { getSafeWindow } from "~/hooks/useWindowDimensions";

type Props = {
  mapId: string;
  tile: Tile;
  modifiable?: boolean;
  droppable?: boolean;
  hoverEffects?: boolean;
  ringHighlight?: boolean;
  homeSelectable?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  sliceValue?: number;
  sliceStats?: SliceStats;
  sliceBreakdown?: SliceValueBreakdown;
  coreSliceData?: CoreSliceData;
  tileContribution?: TileContribution;
  isHomeHovered?: boolean;
  hoveredHomeIdx?: number | null;
  onHomeHover?: (idx: number | null) => void;
  closeTileMode?: boolean;
};
const MECATOL_REX_ID = "18";

export function MapTile(props: Props) {
  const { originalArt } = useSafeOutletContext();
  const [hovered, setHovered] = useState(false);
  const {
    tile,
    tile: { position },
    modifiable = false,
    droppable = false,
    hoverEffects = true,
    ringHighlight = false,
    onSelect,
    onDelete,
    tileContribution,
    hoveredHomeIdx,
    onHomeHover,
    closeTileMode = false,
  } = props;
  const { radius, gap, hOffset, wOffset, disabled } = useContext(MapContext);
  const canSelect =
    !disabled &&
    !!onSelect &&
    (tile.type !== "HOME" || !!props.homeSelectable) &&
    !(closeTileMode && tile.idx === 0);
  const editable =
    canSelect && (modifiable || closeTileMode || tile.type === "OPEN");
  const { x, y } = getHexPosition(position.x, position.y, radius, gap);

  const {
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `${props.mapId}-${tile.idx}-draggable`,
    data: { tile },
    disabled:
      disabled ||
      (!modifiable && !droppable) ||
      (tile.type !== "SYSTEM" && tile.type !== "HOME") ||
      isTouchDevice(),
  });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `${props.mapId}-${tile.idx}-droppable`,
    data: { tile },
    disabled: !(modifiable || droppable) || isTouchDevice(),
  });

  useEffect(() => {
    setHovered(false);
  }, [isOver, isDragging]);

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableNodeRef(node);
    setDroppableNodeRef(node);
  };

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 2 : undefined,
      }
    : undefined;

  // Convert sliceBreakdown to coreSliceData format if provided
  const derivedCoreSliceData: CoreSliceData | undefined = useMemo(() => {
    if (props.coreSliceData) return props.coreSliceData;
    if (props.sliceBreakdown) {
      return {
        value: props.sliceBreakdown.total,
        systems: [],
        breakdown: props.sliceBreakdown,
      };
    }
    return undefined;
  }, [props.coreSliceData, props.sliceBreakdown]);

  let Tile: JSX.Element | null;

  switch (tile.type) {
    case "HOME":
      Tile = (
        <HomeTile
          mapId={props.mapId}
          tile={tile}
          selectable={canSelect}
          sliceValue={props.sliceValue}
          sliceStats={props.sliceStats}
          coreSliceData={derivedCoreSliceData}
          onHomeHover={onHomeHover}
        />
      );
      break;
    case "SYSTEM":
      Tile = originalArt ? (
        <OriginalArtTile
          {...props}
          tile={tile}
          hoverEffects={
            hoverEffects &&
            !modifiable &&
            !droppable &&
            !closeTileMode &&
            !isDragging
          }
        />
      ) : (
        <SystemTile
          {...props}
          tile={tile}
          disablePopover={isDragging || editable}
        />
      );
      break;
    case "OPEN":
      Tile = (
        <EmptyTile
          {...props}
          tile={tile}
          onSelect={undefined}
          isOver={isOver}
          ringHighlight={ringHighlight}
          hoverEffects={hoverEffects}
        />
      );
      break;
    case "CLOSED":
      Tile = (
        <ClosedTile
          mapId={props.mapId}
          tileIdx={tile.idx}
          closeTileMode={closeTileMode}
        />
      );
      break;
  }

  if (
    !originalArt &&
    tile.type === "SYSTEM" &&
    tile.systemId === MECATOL_REX_ID
  ) {
    Tile = (
      <MecatolTile
        {...props}
        tile={tile}
        disablePopover={isDragging || editable}
      />
    );
  }

  // Show overlay on modifiable tiles when hovered or being dropped on
  // HOME tiles are draggable/droppable but don't show the modification overlay
  // Don't show overlay when in close tile mode
  const showOverlay =
    modifiable &&
    hoverEffects &&
    !closeTileMode &&
    tile.type !== "HOME" &&
    tile.type !== "CLOSED" &&
    (hovered || tile.type === "OPEN" || isOver);

  // Determine if tile should be dimmed when a home is being hovered
  // Dim if: hoveredHomeIdx is set AND this tile has no contribution to that home
  // Don't dim: the hovered home itself, tiles that contribute
  const isHomeHoverActive =
    hoveredHomeIdx !== null && hoveredHomeIdx !== undefined;
  const isThisTheHoveredHome =
    tile.type === "HOME" && tile.idx === hoveredHomeIdx;
  const shouldDim =
    isHomeHoverActive && !isThisTheHoveredHome && !tileContribution;

  // Show contribution badge if tile has partial contribution (equidistantCount > 1)
  const showContributionBadge =
    isHomeHoverActive &&
    tileContribution &&
    tileContribution.equidistantCount > 1;

  // Cursor style for close tile mode
  const cursorStyle =
    closeTileMode && tile.type !== "HOME" && tile.idx !== 0
      ? { cursor: "crosshair" }
      : undefined;

  return (
    <>
      <div
        ref={setNodeRef}
        className={[shouldDim ? "tile-dimmed" : undefined, "map-tile-button"]
          .filter(Boolean)
          .join(" ")}
        style={{
          position: "absolute",
          width: radius * 2,
          height: radius * 2,
          left: x + wOffset,
          top: y + hOffset,
          ...dragStyle,
          ...cursorStyle,
        }}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setHovered(false);
        }}
        {...listeners}
      >
        <div inert={editable ? true : undefined}>{Tile}</div>

        {/* Contribution badge for equidistant tiles */}
        {showContributionBadge && tileContribution && (
          <ContributionBadge percentage={tileContribution.percentage} />
        )}

        {canSelect && (
          <button
            type="button"
            className="tile-edit-target"
            aria-label={
              closeTileMode
                ? `${tile.type === "CLOSED" ? "Open" : "Close"} map space ${tile.idx}`
                : tile.type === "SYSTEM"
                  ? `Replace system ${tile.systemId} at position ${tile.idx}`
                  : tile.type === "HOME"
                    ? `Choose seat ${tile.seat === undefined ? tile.idx : tile.seat + 1}`
                    : `Add system at position ${tile.idx}`
            }
            style={{ width: radius * 2, height: radius * 2 }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            onKeyDown={(event) => {
              if (event.key === "Delete" && tile.type === "SYSTEM") {
                event.preventDefault();
                event.stopPropagation();
                onDelete?.();
              }
            }}
          >
            {showOverlay && !isDragging && !isOver && (
              <IconPlus
                className="tile-add-icon"
                size={24}
                aria-hidden="true"
              />
            )}
          </button>
        )}
        {editable &&
          tile.type === "SYSTEM" &&
          hovered &&
          !isDragging &&
          !closeTileMode && (
            <ActionIcon
              className="tile-delete-target"
              color="red.8"
              variant="filled"
              aria-label={`Remove system ${tile.systemId} at position ${tile.idx}`}
              style={{
                position: "absolute",
                top: radius * 1.2,
                left: radius - 18,
                zIndex: 3,
              }}
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.();
              }}
            >
              <IconTrash size={18} aria-hidden="true" />
            </ActionIcon>
          )}
      </div>
    </>
  );
}

function isTouchDevice() {
  const safeWindow = getSafeWindow();
  if (!safeWindow) return false;
  return (
    "ontouchstart" in safeWindow ||
    (safeWindow.navigator?.maxTouchPoints ?? 0) > 0
  );
}
