import { getHexPosition } from "~/utils/positioning";
import classes from "./MapBuildDiagram.module.css";

type TileColor = "blue" | "red" | "violet" | "gray" | "yellow";

// Standard Milty section facing upward, matching milty.seatTilePlacement[3].
// The builder fills slice indices [4], then [1, 3], then [0, 2].
const sectionTiles: { q: number; r: number; label: string; color: TileColor }[] = [
  { q: 0, r: -3, label: "M", color: "yellow" },
  { q: 0, r: -2, label: "1", color: "violet" },
  { q: 0, r: -1, label: "2", color: "violet" },
  { q: -1, r: -1, label: "2", color: "violet" },
  { q: -1, r: 0, label: "3", color: "violet" },
  { q: 1, r: -1, label: "3", color: "violet" },
  { q: 0, r: 0, label: "H", color: "gray" },
];

function Tile({
  x,
  y,
  label,
  color,
}: {
  x: number;
  y: number;
  label: string;
  color: TileColor;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon
        points="24,0 12,-20.785 -12,-20.785 -24,0 -12,20.785 12,20.785"
        fill={`var(--mantine-color-${color}-light)`}
        stroke={`var(--mantine-color-${color}-5)`}
        strokeWidth="2"
      />
      <text textAnchor="middle" dominantBaseline="central" fill="currentColor">
        {label}
      </text>
    </g>
  );
}

/** Shared by bag drafts and Mantis, which use the same tile-placement phase. */
export function MapBuildDiagram({
  draftBlues = 3,
  draftReds = 2,
  source = "bags",
  mulligans = 1,
}: {
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
          <svg viewBox="0 0 240 230" aria-hidden="true" className={classes.art}>
            <text x="120" y="17" textAnchor="middle" fill="currentColor">
              Mecatol Rex
            </text>
            {sectionTiles.map(({ q, r, label, color }) => {
              const { x, y } = getHexPosition(q, r, 24, 2);
              return (
                <Tile
                  key={`${q},${r}`}
                  x={120 + x}
                  y={178 + y}
                  label={label}
                  color={color}
                />
              );
            })}
            <text x="120" y="225" textAnchor="middle" fill="currentColor">
              Your home (separate)
            </text>
          </svg>
          <span>
            Draw one of your remaining tiles at random each turn. Place it in a
            highlighted space in your section. Everyone completes stage 1
            before stage 2, then stage 3.
          </span>
          <span>
            {mulligans > 0 ? (
              <>
                <strong>Optional mulligan.</strong> Each player gets {mulligans}{" "}
                {mulligans === 1 ? "mulligan" : "mulligans"} for the entire map
                build. Before placing your drawn tile, press <strong>Mulligan</strong>{" "}
                to draw a different tile at random from your remaining hand.
                The original stays in your hand to place later. You keep your
                turn and the same highlighted spaces. You need at least two
                unplaced tiles and a mulligan left.
              </>
            ) : (
              <>
                <strong>Mulligans are disabled for this draft.</strong> Place
                the tile you draw each turn.
              </>
            )}
          </span>
          <span>
            Six-player example: home → 2 → 1 → Mecatol Rex form a straight line.
            Numbers mark placement stages. Other player counts can use a
            different layout; follow the highlighted spaces on your map.
          </span>
        </li>
      </ol>
    </div>
  );
}
