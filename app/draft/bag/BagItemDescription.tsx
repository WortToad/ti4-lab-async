import { Fragment } from "react";
import { Text } from "@mantine/core";
import { SmallNumberHex } from "~/components/Hex/SmallNumberHex";
import { ResourceIcon } from "~/components/Planet/ResourceIcon";
import { Wormhole } from "~/components/features/Wormhole";
import { TechIcon } from "~/components/icons/TechIcon";
import type { TechSpecialty, Wormhole as WormholeType } from "~/types";
import classes from "./BagComponents.module.css";

// Keep the catalog's wording, punctuation and line breaks around each symbol.
const descriptionSymbol =
  /\((\d+)\/(\d+)\)|\b((alpha|beta|gamma|delta|epsilon) wormholes?)\b|\b((biotic|cybernetic|propulsion|warfare) technology specialty)\b/gi;

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
        ] = match;

        return (
          <Fragment key={match.index}>
            {preceding}
            {resources !== undefined && planetStats ? (
              <div
                role="img"
                aria-label={`${resources} resources, ${influence} influence`}
                title={`${resources} resources, ${influence} influence`}
                className={classes.inlineStats}
              >
                <div aria-hidden className={classes.inlineSymbols}>
                  <ResourceIcon value={Number(resources)} size={22} />
                  <SmallNumberHex value={Number(influence)} size={22} />
                </div>
              </div>
            ) : wormholePhrase || techPhrase ? (
              <>
                {wormholePhrase ?? techPhrase}{" "}
                <div aria-hidden className={classes.inlineSymbols}>
                  {wormhole ? (
                    <Wormhole
                      wormhole={wormhole.toUpperCase() as WormholeType}
                      size={22}
                      fontSize={12}
                    />
                  ) : (
                    <TechIcon
                      techSpecialty={tech.toUpperCase() as TechSpecialty}
                      size={18}
                    />
                  )}
                </div>
              </>
            ) : (
              match[0]
            )}
          </Fragment>
        );
      })}
      {description.slice(previousEnd)}
    </Text>
  );
}
