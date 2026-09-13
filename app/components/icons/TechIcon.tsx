import { appPath } from "~/utils/appUrl";
import { TechSpecialty } from "~/types";
import { SymbolHelp } from "~/components/SymbolHelp";

export const techLabels: Record<TechSpecialty, string> = {
  BIOTIC: "Biotic (green)",
  CYBERNETIC: "Cybernetic (yellow)",
  WARFARE: "Warfare (red)",
  PROPULSION: "Propulsion (blue)",
};

const techIcon: Record<TechSpecialty, string> = {
  BIOTIC: "/biotic.webp",
  CYBERNETIC: "/cybernetic.webp",
  WARFARE: "/warfare.webp",
  PROPULSION: "/propulsion.webp",
};

type Props = {
  techSpecialty: TechSpecialty;
  size?: number;
  specialty?: boolean;
  showHelp?: boolean;
};

export function TechIcon({
  techSpecialty,
  size = 20,
  specialty = false,
  showHelp = true,
}: Props) {
  const label = `${techLabels[techSpecialty]} ${specialty ? "technology specialty" : "technology"}`;
  return (
    <SymbolHelp label={label} disabled={!showHelp}>
      <img
        src={appPath(techIcon[techSpecialty])}
        style={{ width: size }}
        alt={techSpecialty}
      />
    </SymbolHelp>
  );
}
