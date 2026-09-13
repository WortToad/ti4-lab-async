import { ResourceIcon } from "./ResourceIcon";
import { SmallNumberHex } from "~/components/Hex/SmallNumberHex";

/** Shared planet values for system search results and draft descriptions. */
export function PlanetValueIcons({
  resources,
  influence,
  size = 24,
}: {
  resources: number;
  influence: number;
  size?: number;
}) {
  const label = `${resources} resources, ${influence} influence`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ display: "inline-flex", flexShrink: 0, verticalAlign: "middle" }}
    >
      <span
        aria-hidden
        style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        <ResourceIcon value={resources} size={size} />
        <SmallNumberHex value={influence} size={size} />
      </span>
    </span>
  );
}
