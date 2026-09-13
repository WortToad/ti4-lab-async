import { PlanetValueIcons } from "./PlanetValueIcons";
import { LegendaryIcon } from "~/components/icons/LegendaryIcon";
import { TechIcon } from "~/components/icons/TechIcon";
import { SpaceStationIcon } from "~/components/icons/SpaceStationIcon";
import type { Planet } from "~/types";
import { PlanetTraitIcons } from "./PlanetTraitIcons";
import classes from "./PlanetSummary.module.css";

/** The same planet identity and symbols in the system database and drafts. */
export function PlanetSummary({ planet }: { planet: Planet }) {
  return (
    <span className={classes.summary}>
      <span className={classes.identity}>
        <PlanetTraitIcons traits={planet.trait} />
        <span className={classes.name}>{planet.name}</span>
      </span>
      <span className={classes.symbols}>
        <PlanetValueIcons
          resources={planet.resources}
          influence={planet.influence}
        />
        {planet.tech?.map((tech) => (
          <TechIcon key={tech} techSpecialty={tech} size={20} specialty />
        ))}
        {planet.legendary && <LegendaryIcon />}
        {planet.tradeStation && <SpaceStationIcon />}
      </span>
    </span>
  );
}
