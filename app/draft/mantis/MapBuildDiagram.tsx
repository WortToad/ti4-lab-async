import { useState, type CSSProperties } from "react";
import { hexSides, hexVertices } from "~/components/Hex/hexUtils";
import { HyperlaneLine } from "~/components/Hex/HyperlaneLine";
import { systemData } from "~/data/systemData";
import { draftConfig } from "~/draft/draftConfig";
import { generateEmptyMap } from "~/utils/map";
import { getHexPosition } from "~/utils/positioning";
import { MANTIS_MAPS } from "./engine";
import classes from "./MapBuildDiagram.module.css";

const seatColors = [
  "violet",
  "teal",
  "orange",
  "pink",
  "blue",
  "lime",
  "red",
  "cyan",
] as const;
type TileColor = (typeof seatColors)[number] | "gray" | "yellow";

// The builder fills slice indices [4], then [1, 3], then [0, 2].
const placementStages = [3, 2, 3, 2, 1];
const tileSides = hexSides(hexVertices(24));

function Tile({
  x,
  y,
  label,
  color,
  title,
  hyperlanes,
  rotation = 0,
  dimmed = false,
}: {
  x: number;
  y: number;
  label: string;
  color: TileColor;
  title?: string;
  hyperlanes?: number[][];
  rotation?: number;
  dimmed?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={dimmed ? 0.2 : 1}>
      {title && <title>{title}</title>}
      <polygon
        points="24,0 12,-20.785 -12,-20.785 -24,0 -12,20.785 12,20.785"
        fill={`var(--mantine-color-${color}-light)`}
        stroke={`var(--mantine-color-${color}-5)`}
        strokeWidth="2"
      />
      {hyperlanes && (
        <g transform={`rotate(${rotation})`}>
          {hyperlanes.map(([start, end], index) => (
            <HyperlaneLine
              key={index}
              p1={tileSides[start]}
              p2={tileSides[end]}
              color="var(--mantine-color-blue-4)"
            />
          ))}
        </g>
      )}
      <text textAnchor="middle" dominantBaseline="central" fill="currentColor">
        {label}
      </text>
    </g>
  );
}

function PlacementMap({
  playerCount,
  playerSeat,
}: {
  playerCount: number;
  playerSeat?: number;
}) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(
    playerSeat ?? 0,
  );
  const mapType = MANTIS_MAPS[playerCount];
  if (!mapType) return null;
  const config = draftConfig[mapType];
  const map = generateEmptyMap(config);
  const stages = new Map<string, { stage: number; seat: number }>();
  config.homeIdxInMapString.forEach((homeIndex, seat) => {
    const home = map[homeIndex].position;
    config.seatTilePlacement[seat].forEach(([x, y], index) => {
      stages.set(`${home.x + x},${home.y + y}`, {
        stage: placementStages[index],
        seat,
      });
    });
  });
  const tiles = map.filter((tile) => tile.type !== "CLOSED");
  const positions = tiles.map((tile) =>
    getHexPosition(tile.position.x, tile.position.y, 24, 2),
  );
  const minX = Math.min(...positions.map(({ x }) => x)) - 27;
  const minY = Math.min(...positions.map(({ y }) => y)) - 24;
  const width = Math.max(...positions.map(({ x }) => x)) + 27 - minX;
  const height = Math.max(...positions.map(({ y }) => y)) + 24 - minY;

  return (
    <figure className={classes.mapFigure}>
      <svg
        viewBox={`${minX} ${minY} ${width} ${height}`}
        role="img"
        aria-label={`${playerCount}-player map placement stages`}
        className={classes.mapArt}
      >
        {tiles.map((tile, index) => {
          const placement = stages.get(`${tile.position.x},${tile.position.y}`);
          const seat =
            tile.type === "HOME"
              ? config.homeIdxInMapString.indexOf(tile.idx)
              : placement?.seat;
          const dimmed =
            selectedSeat !== null &&
            seat !== undefined &&
            seat !== selectedSeat;
          const hyperlanes =
            tile.type === "SYSTEM"
              ? systemData[tile.systemId]?.hyperlanes
              : undefined;
          const label =
            tile.idx === 0
              ? "M"
              : tile.type === "HOME"
                ? `H${seat! + 1}`
                : placement && !dimmed
                  ? String(placement.stage)
                  : "";
          const title =
            tile.idx === 0
              ? "Mecatol Rex"
              : tile.type === "HOME"
                ? `Seat ${config.homeIdxInMapString.indexOf(tile.idx) + 1} home`
                : placement
                  ? `Seat ${placement.seat + 1}, stage ${placement.stage}, map position ${tile.idx}`
                  : "Fixed hyperlane";
          return (
            <Tile
              key={tile.idx}
              {...positions[index]}
              label={label}
              color={
                tile.idx === 0
                  ? "yellow"
                  : seat !== undefined
                    ? seatColors[seat]
                    : "gray"
              }
              title={title}
              dimmed={dimmed}
              hyperlanes={hyperlanes}
              rotation={tile.type === "SYSTEM" ? tile.rotation : undefined}
            />
          );
        })}
      </svg>
      <div
        className={classes.sliceControls}
        role="group"
        aria-label="View a player's slice"
      >
        <button
          type="button"
          className={classes.seatButton}
          aria-pressed={selectedSeat === null}
          onClick={() => setSelectedSeat(null)}
        >
          All slices
        </button>
        {config.homeIdxInMapString.map((_, seat) => (
          <button
            key={seat}
            type="button"
            className={classes.seatButton}
            style={
              {
                "--slice-color": `var(--mantine-color-${seatColors[seat]}-5)`,
              } as CSSProperties
            }
            aria-pressed={selectedSeat === seat}
            onClick={() => setSelectedSeat(seat)}
          >
            <span className={classes.seatSwatch} aria-hidden />
            Seat {seat + 1}
            {seat === playerSeat ? " (you)" : ""}
          </button>
        ))}
      </div>
      <figcaption>
        <p className={classes.sliceExplanation} aria-live="polite">
          {selectedSeat === null
            ? "Each color links a numbered home to its five placement spaces."
            : `Seat ${selectedSeat + 1}: home H${selectedSeat + 1} and the five matching spaces form this player’s slice. Place tiles only in this slice’s numbered spaces.`}
        </p>
        {playerCount}-player map · H: home · M: Mecatol Rex
        {Object.keys(config.presetTiles).length > 0 && (
          <span>Blue lines: fixed hyperlanes</span>
        )}
      </figcaption>
    </figure>
  );
}

/** Shared by bag drafts and Mantis, which use the same tile-placement phase. */
export function MapBuildDiagram({
  playerCount,
  playerSeat,
  draftBlues = 3,
  draftReds = 2,
  source = "bags",
  mulligans = 1,
}: {
  playerCount: number;
  playerSeat?: number;
  draftBlues?: number;
  draftReds?: number;
  source?: "bags" | "pool" | "kept";
  mulligans?: number;
}) {
  const hasExtras = draftBlues > 3 || draftReds > 2;
  return (
    <div className={classes.diagram}>
      <ol
        className={classes.flow}
        aria-label="From drafted tiles to the shared map"
      >
        <li className={classes.step}>
          <strong>
            {source === "kept"
              ? "1. Bring your drafted tiles"
              : "1. Collect your tiles"}
          </strong>
          <svg viewBox="0 0 240 185" aria-hidden="true" className={classes.art}>
            <rect
              x="29"
              y="29"
              width="182"
              height="126"
              rx="16"
              className={classes.bag}
            />
            <Tile x={92} y={79} label="B" color="blue" />
            <Tile x={145} y={79} label="R" color="red" />
            <path d="M120 114v35m-8-8 8 8 8-8" className={classes.arrow} />
            <text x="120" y="177" textAnchor="middle" fill="currentColor">
              Your collection
            </text>
          </svg>
          <span>
            {source === "kept"
              ? "Your confirmed map tiles carry over from the bag draft: 3 blue + 2 red per player."
              : `Pick individual tiles from ${source === "bags" ? "passing bags" : "the public pool"}: ${draftBlues} blue + ${draftReds} red per player.`}
          </span>
        </li>
        <li className={classes.step}>
          <strong>2. Keep your five</strong>
          <svg viewBox="0 0 240 185" aria-hidden="true" className={classes.art}>
            <Tile x={65} y={68} label="B" color="blue" />
            <Tile x={120} y={68} label="B" color="blue" />
            <Tile x={175} y={68} label="B" color="blue" />
            <Tile x={93} y={117} label="R" color="red" />
            <Tile x={148} y={117} label="R" color="red" />
            <text x="120" y="177" textAnchor="middle" fill="currentColor">
              Your map-building hand
            </text>
          </svg>
          <span>
            {hasExtras ? "Choose exactly" : "Keep all"} 3 blue + 2 red.
            {hasExtras ? " Discard the extras." : ""} These same five tiles go
            into your own hand for map building.
          </span>
        </li>
        <li className={classes.step}>
          <strong>3. Place them on the map</strong>
          <PlacementMap
            key={`${playerCount}:${playerSeat}`}
            playerCount={playerCount}
            playerSeat={playerSeat}
          />
          <span>
            Draw one of your remaining tiles at random each turn. Place it in a
            highlighted space in your section. Fill your one space marked 1,
            then your two spaces marked 2, then your two spaces marked 3.
            Everyone completes each stage before the next stage begins.
          </span>
          <span>
            {mulligans > 0 ? (
              <>
                <strong>Optional mulligan.</strong> Each player gets {mulligans}{" "}
                {mulligans === 1 ? "mulligan" : "mulligans"} for the entire map
                build. Before placing your drawn tile, press{" "}
                <strong>Mulligan</strong> to draw a different tile at random
                from your remaining hand. The original stays in your hand to
                place later. You keep your turn and the same highlighted spaces.
                You need at least two unplaced tiles and a mulligan left.
              </>
            ) : (
              <>
                <strong>Mulligans are disabled for this draft.</strong> Place
                the tile you draw each turn.
              </>
            )}
          </span>
        </li>
      </ol>
    </div>
  );
}
