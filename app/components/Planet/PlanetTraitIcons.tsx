import { SymbolHelp } from "~/components/SymbolHelp";
import type { PlanetTrait } from "~/types";
import { appPath } from "~/utils/appUrl";
import classes from "./PlanetSummary.module.css";

const traitNames: Record<PlanetTrait, string> = {
  CULTURAL: "Cultural",
  HAZARDOUS: "Hazardous",
  INDUSTRIAL: "Industrial",
};

export function PlanetTraitIcons({
  traits = [],
  showHelp = true,
}: {
  traits?: PlanetTrait[];
  showHelp?: boolean;
}) {
  if (!traits.length) {
    return (
      <SymbolHelp label="No planet trait" disabled={!showHelp}>
        <span
          className={classes.noTrait}
          aria-label="No planet trait"
          role="img"
        >
          —
        </span>
      </SymbolHelp>
    );
  }

  return (
    <span
      className={classes.traits}
      role="group"
      aria-label={traits.map((trait) => traitNames[trait]).join(" / ")}
    >
      {traits.map((trait) => (
        <SymbolHelp
          key={trait}
          label={traitNames[trait]}
          description={`${traitNames[trait]} planet trait`}
          disabled={!showHelp}
        >
          <img
            src={appPath(`/symbols/traits/${trait.toLowerCase()}.png`)}
            alt={traitNames[trait]}
            width={20}
            height={20}
            className={classes.traitIcon}
          />
        </SymbolHelp>
      ))}
    </span>
  );
}
