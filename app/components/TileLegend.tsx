import {
  Box,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconListDetails } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ResourceIcon } from "~/components/Planet/ResourceIcon";
import { SmallNumberHex } from "~/components/Hex/SmallNumberHex";
import { PlanetTraitDot } from "~/components/Planet/PlanetTraitDot";
import { PlanetStatsPill } from "~/components/Slice/PlanetStatsPill";
import { TechIcon, techLabels } from "~/components/icons/TechIcon";
import { LegendaryIcon } from "~/components/icons/LegendaryIcon";
import { TradeStationIcon } from "~/components/icons/TradeStationIcon";
import { Wormhole } from "~/components/features/Wormhole";
import { AnomalyImage } from "~/components/features/AnomalyImage";
import { GravityRift } from "~/components/features/GravityRift";
import type {
  Anomaly,
  PlanetTrait,
  TechSpecialty,
  Wormhole as WormholeType,
} from "~/types";

function Entry({
  symbol,
  children,
}: {
  symbol: ReactNode;
  children: ReactNode;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Box
        w={44}
        h={44}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {symbol}
      </Box>
      <Text size="sm">{children}</Text>
    </Group>
  );
}

const traits: PlanetTrait[] = ["CULTURAL", "HAZARDOUS", "INDUSTRIAL"];
const wormholes: WormholeType[] = [
  "ALPHA",
  "BETA",
  "GAMMA",
  "DELTA",
  "EPSILON",
];
const anomalies: [Anomaly, string][] = [
  ["ASTEROID_FIELD", "Asteroid field"],
  ["NEBULA", "Nebula"],
  ["SUPERNOVA", "Supernova"],
  ["GRAVITY_RIFT", "Gravity rift"],
  ["ENTROPIC_SCAR", "Entropic scar"],
];

export function TileLegend() {
  const [opened, { open, close }] = useDisclosure();
  return (
    <>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        leftSection={<IconListDetails size={14} />}
        onClick={open}
      >
        Legend
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        title="Tile symbol legend"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Hover, focus, or tap a symbol on a tile card to see its name.
          </Text>
          <Stack gap={4}>
            <Text fw={700}>Planet values and traits</Text>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={4}>
              <Entry symbol={<ResourceIcon value={3} size={28} />}>
                Resources (yellow)
              </Entry>
              <Entry symbol={<SmallNumberHex value={2} size={28} />}>
                Influence (blue)
              </Entry>
              {traits.map((trait) => (
                <Entry
                  key={trait}
                  symbol={<PlanetTraitDot traits={[trait]} showHelp={false} />}
                >
                  {trait[0] + trait.slice(1).toLowerCase()} planet
                </Entry>
              ))}
              <Entry symbol={<PlanetTraitDot showHelp={false} />}>
                No planet trait (gray)
              </Entry>
              <Entry
                symbol={
                  <PlanetTraitDot
                    traits={["INDUSTRIAL", "CULTURAL"]}
                    showHelp={false}
                  />
                }
              >
                Multiple traits (split colors)
              </Entry>
            </SimpleGrid>
          </Stack>
          <Stack gap={4}>
            <Text fw={700}>Technology specialties</Text>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={4}>
              {(Object.keys(techLabels) as TechSpecialty[]).map((tech) => (
                <Entry
                  key={tech}
                  symbol={
                    <TechIcon techSpecialty={tech} size={26} showHelp={false} />
                  }
                >
                  {techLabels[tech]}
                </Entry>
              ))}
            </SimpleGrid>
          </Stack>
          <Stack gap={4}>
            <Text fw={700}>System features</Text>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={4}>
              {wormholes.map((wormhole) => (
                <Entry
                  key={wormhole}
                  symbol={
                    <Wormhole wormhole={wormhole} size={28} showHelp={false} />
                  }
                >
                  {wormhole[0] + wormhole.slice(1).toLowerCase()} wormhole
                </Entry>
              ))}
              <Entry symbol={<LegendaryIcon size={26} showHelp={false} />}>
                Legendary planet
              </Entry>
              <Entry symbol={<TradeStationIcon size={26} showHelp={false} />}>
                Trade station
              </Entry>
              {anomalies.map(([anomaly, label]) => (
                <Entry
                  key={anomaly}
                  symbol={
                    anomaly === "GRAVITY_RIFT" ? (
                      <Box style={{ transform: "scale(0.65)" }}>
                        <GravityRift />
                      </Box>
                    ) : (
                      <svg
                        width={40}
                        height={40}
                        viewBox="-20 -20 40 40"
                        aria-hidden
                      >
                        <AnomalyImage anomaly={anomaly} radius={20} />
                      </svg>
                    )
                  }
                >
                  {label}
                </Entry>
              ))}
            </SimpleGrid>
          </Stack>
          <Stack gap="xs">
            <Text fw={700}>Tile statistics</Text>
            <Text size="sm">
              <b>SV</b> — System value using standard slice scoring, before
              map-position adjustments.
            </Text>
            <Group gap="xs">
              <PlanetStatsPill
                resources={3}
                influence={2}
                flex={1}
                size="xs"
                compact
              />
              <Text size="sm">Resources / influence / flex</Text>
            </Group>
            <Text size="sm">
              <b>Opt</b> — Optimal spend. Flex can be spent as either resources
              or influence; the number in parentheses is the total.
            </Text>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}
