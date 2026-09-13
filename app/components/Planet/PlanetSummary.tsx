import { PlanetValueIcons } from "./PlanetValueIcons";
import { LegendaryIcon } from "~/components/icons/LegendaryIcon";
import { TechIcon } from "~/components/icons/TechIcon";
import { TradeStationIcon } from "~/components/icons/TradeStationIcon";
import type { Planet, PlanetTrait } from "~/types";
import classes from "./PlanetSummary.module.css";

const traitColors: Record<PlanetTrait, string> = {
  CULTURAL: "var(--mantine-color-blue-5)",
  HAZARDOUS: "var(--mantine-color-red-5)",
  INDUSTRIAL: "var(--mantine-color-green-5)",
};

/** The same planet identity and symbols in the system database and drafts. */
export function PlanetSummary({ planet }: { planet: Planet }) {
  const traits = planet.trait ?? [];
  const traitLabel = traits.length
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
    <span className={classes.summary}>
      <span className={classes.identity}>
        <span
          className={classes.traitDot}
          style={{ background }}
          role="img"
          aria-label={traitLabel}
          title={traitLabel}
        />
        <span className={classes.name}>{planet.name}</span>
      </span>
      <span className={classes.symbols}>
        <PlanetValueIcons
          resources={planet.resources}
          influence={planet.influence}
        />
        {planet.tech?.map((tech) => (
          <TechIcon key={tech} techSpecialty={tech} size={20} />
        ))}
        {planet.legendary && <LegendaryIcon />}
        {planet.tradeStation && <TradeStationIcon />}
      </span>
    </span>
  );
}
