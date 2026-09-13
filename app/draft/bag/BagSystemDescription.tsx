import { Badge, Group, Stack, Text } from "@mantine/core";
import { PlanetSummary } from "~/components/Planet/PlanetSummary";
import { Wormhole } from "~/components/features/Wormhole";
import { systemData } from "~/data/systemData";
import type {
  Planet,
  PlanetTrait,
  TechSpecialty,
  Wormhole as WormholeType,
} from "~/types";
import { BagItemDescription } from "./BagItemDescription";
import classes from "./BagComponents.module.css";

const planetLine = /^(.+?) \((\d+)\/(\d+)\)(?:\s+—\s+(.*))?$/;
const planetMetadata =
  /^(Cultural|Hazardous|Industrial|Faction|(?:Biotic|Cybernetic|Propulsion|Warfare) technology specialty)(?:;\s*|$)/i;
const wormholeLine = /^(alpha|beta|gamma|delta|epsilon) wormhole$/i;
const anomalyLine = /^(Asteroid field|Nebula|Supernova|Gravity rift|Scar)$/i;
const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");
const databasePlanets = Object.values(systemData).flatMap(
  (system) => system.planets,
);

function readPlanet(line: string, systemId: string) {
  const match = line.match(planetLine);
  if (!match) return undefined;

  const [, name, resources, influence, extra = ""] = match;
  const trait: PlanetTrait[] = [];
  const tech: TechSpecialty[] = [];
  let explanation = extra;
  // Only consume leading metadata: semicolons within abilities remain intact.
  let metadata;
  while ((metadata = explanation.match(planetMetadata))) {
    const value = metadata[1];
    if (/technology specialty$/i.test(value)) {
      tech.push(value.split(" ")[0].toUpperCase() as TechSpecialty);
    } else if (value.toLowerCase() !== "faction") {
      trait.push(value.toUpperCase() as PlanetTrait);
    }
    explanation = explanation.slice(metadata[0].length);
  }

  const normalizedId = /^\d+$/.test(systemId)
    ? String(Number(systemId))
    : systemId;
  const matchesName = (planet: Planet) =>
    normalizeName(planet.name) === normalizeName(name);
  // Bot aliases and off-map home planets may use a different system ID.
  const knownPlanet =
    systemData[normalizedId]?.planets.find(matchesName) ??
    databasePlanets.find(
      (planet) =>
        matchesName(planet) &&
        planet.resources === Number(resources) &&
        planet.influence === Number(influence),
    );
  const planet: Planet = knownPlanet ?? {
    name,
    resources: Number(resources),
    influence: Number(influence),
    trait,
    tech,
    legendary: Boolean(explanation),
  };

  return { planet, explanation };
}

export function BagSystemDescription({
  description,
  systemId,
}: {
  description: string;
  systemId: string;
}) {
  const planets: NonNullable<ReturnType<typeof readPlanet>>[] = [];
  const features: string[] = [];
  const notes: string[] = [];
  for (const line of description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)) {
    const planet = readPlanet(line, systemId);
    if (planet) planets.push(planet);
    else if (
      wormholeLine.test(line) ||
      anomalyLine.test(line) ||
      line === "Empty system"
    )
      features.push(line);
    else notes.push(line);
  }

  return (
    <Stack gap="sm">
      {planets.length > 0 && (
        <Stack
          component="ul"
          gap={0}
          className={classes.planetList}
          aria-label="Planets"
        >
          {planets.map(({ planet, explanation }) => (
            <Text
              component="li"
              key={planet.name}
              size="sm"
              className={classes.planetRow}
            >
              <PlanetSummary planet={planet} />
              {explanation && (
                <span className={classes.planetExplanation}>
                  {" "}
                  — {explanation}
                </span>
              )}
            </Text>
          ))}
        </Stack>
      )}
      {features.length > 0 && (
        <Group
          gap="xs"
          className={classes.systemFeatures}
          role="group"
          aria-label="System features"
        >
          {features.map((feature) => {
            const wormhole = feature.match(wormholeLine);
            return wormhole ? (
              <Group key={feature} gap={6} wrap="nowrap">
                <Wormhole
                  wormhole={wormhole[1].toUpperCase() as WormholeType}
                  size={24}
                />
                <Text size="sm">{feature}</Text>
              </Group>
            ) : (
              <Badge
                key={feature}
                color={anomalyLine.test(feature) ? "orange" : "gray"}
                variant="light"
                className={classes.trait}
              >
                {feature}
              </Badge>
            );
          })}
        </Group>
      )}
      {notes.map((note, index) => (
        <BagItemDescription key={index} description={note} />
      ))}
    </Stack>
  );
}
