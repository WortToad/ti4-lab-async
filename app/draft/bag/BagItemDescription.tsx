import { Fragment } from "react";
import { Text } from "@mantine/core";
import { PlanetValueIcons } from "~/components/Planet/PlanetValueIcons";
import { Wormhole } from "~/components/features/Wormhole";
import { TechIcon } from "~/components/icons/TechIcon";
import { GameTerms } from "~/components/GameTerm";
import type { TechSpecialty, Wormhole as WormholeType } from "~/types";
import classes from "./BagComponents.module.css";

// Keep the catalog's wording, punctuation and line breaks around each symbol.
const descriptionSymbol =
  /\((\d+)\/(\d+)\)|\b((alpha|beta|gamma|delta|epsilon) wormholes?)\b|\b((biotic|cybernetic|propulsion|warfare) technology specialty)\b|\b(prerequisites?:[ \t]*)([RGBY]+)\b/gi;

const prerequisiteTech: Record<string, TechSpecialty> = {
  R: "WARFARE",
  G: "BIOTIC",
  B: "PROPULSION",
  Y: "CYBERNETIC",
};

export function BagItemDescription({
  description,
  planetStats = false,
}: {
  description: string;
  planetStats?: boolean;
}) {
  const matches = [...description.matchAll(descriptionSymbol)];
  let previousEnd = 0;

  return (
    <Text component="div" size="sm" className={classes.rules}>
      {matches.map((match) => {
        const preceding = description.slice(previousEnd, match.index);
        previousEnd = match.index + match[0].length;
        const [
          ,
          resources,
          influence,
          wormholePhrase,
          wormhole,
          techPhrase,
          tech,
          prerequisiteLabel,
          prerequisites,
        ] = match;

        return (
          <Fragment key={match.index}>
            <GameTerms>{preceding}</GameTerms>
            {prerequisites ? (
              <>
                {prerequisiteLabel}
                <span className={classes.inlineSymbols}>
                  {[...prerequisites.toUpperCase()].map((code, index) => (
                    <TechIcon
                      key={index}
                      techSpecialty={prerequisiteTech[code]}
                      size={20}
                    />
                  ))}
                </span>
              </>
            ) : resources !== undefined && planetStats ? (
              <PlanetValueIcons
                resources={Number(resources)}
                influence={Number(influence)}
              />
            ) : wormholePhrase || techPhrase ? (
              <>
                {wormholePhrase ?? techPhrase}{" "}
                <span className={classes.inlineSymbols}>
                  {wormhole ? (
                    <Wormhole
                      wormhole={wormhole.toUpperCase() as WormholeType}
                      size={22}
                      fontSize={16}
                    />
                  ) : (
                    <TechIcon
                      techSpecialty={tech.toUpperCase() as TechSpecialty}
                      size={18}
                      specialty
                    />
                  )}
                </span>
              </>
            ) : (
              match[0]
            )}
          </Fragment>
        );
      })}
      <GameTerms>{description.slice(previousEnd)}</GameTerms>
    </Text>
  );
}
