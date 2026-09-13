import { ResourceIcon } from "./ResourceIcon";
import { SmallNumberHex } from "~/components/Hex/SmallNumberHex";
import { SymbolHelp } from "~/components/SymbolHelp";

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
    <SymbolHelp
      label={label}
      description={`${label}. Yellow: resources. Blue: influence.`}
    >
      <span
        aria-hidden
        style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        <ResourceIcon value={resources} size={size} />
        <SmallNumberHex value={influence} size={size} />
      </span>
    </SymbolHelp>
  );
}
