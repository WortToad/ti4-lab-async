import { SymbolHelp } from "~/components/SymbolHelp";
import type { PlanetTrait } from "~/types";
import classes from "./PlanetSummary.module.css";

const traitColors: Record<PlanetTrait, string> = {
  CULTURAL: "var(--mantine-color-blue-5)",
  HAZARDOUS: "var(--mantine-color-red-5)",
  INDUSTRIAL: "var(--mantine-color-green-5)",
};

export function PlanetTraitDot({
  traits = [],
  showHelp = true,
}: {
  traits?: PlanetTrait[];
  showHelp?: boolean;
}) {
  const label = traits.length
    ? traits.map((trait) => trait[0] + trait.slice(1).toLowerCase()).join(" / ")
    : "No planet trait";
  const colors = traits.map((trait) => traitColors[trait]);
  const background =
    colors.length > 1
      ? `linear-gradient(90deg, ${colors
          .map(
            (color, index) =>
              `${color} ${(index * 100) / colors.length}% ${((index + 1) * 100) / colors.length}%`,
          )
          .join(", ")})`
      : (colors[0] ?? "var(--mantine-color-gray-5)");

  return (
    <SymbolHelp
      label={label}
      description={traits.length ? `${label} planet trait` : label}
      disabled={!showHelp}
    >
      <span
        className={classes.traitDot}
        style={{ background }}
        role="img"
        aria-label={label}
      />
    </SymbolHelp>
  );
}
