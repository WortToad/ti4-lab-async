import classes from "./MapBuildDiagram.module.css";

function Tile({
  x,
  y,
  label,
  color,
}: {
  x: number;
  y: number;
  label: string;
  color: "blue" | "red" | "violet" | "gray";
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon
        points="0,-25 22,-12.5 22,12.5 0,25 -22,12.5 -22,-12.5"
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
}: {
  draftBlues?: number;
  draftReds?: number;
  source?: "bags" | "pool" | "kept";
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
            <Tile x={120} y={52} label="1" color="violet" />
            <Tile x={93} y={99} label="2" color="violet" />
            <Tile x={147} y={99} label="2" color="violet" />
            <Tile x={66} y={146} label="3" color="violet" />
            <Tile x={174} y={146} label="3" color="violet" />
            <Tile x={120} y={184} label="H" color="gray" />
            <text x="120" y="225" textAnchor="middle" fill="currentColor">
              Your home (separate)
            </text>
          </svg>
          <span>
            Draw one of your remaining tiles at random each turn. Place it in a
            highlighted space in your section: inner first (1), then middle (2),
            then outer (3). Placement stages shown schematically.
          </span>
        </li>
      </ol>
    </div>
  );
}
