import { appPath } from "~/utils/appUrl";
import {
  Badge,
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { MahactKingReference as MahactKingReferenceData } from "~/data/mahactKingReferences";
import { Faction } from "~/types";

type Props = {
  faction: Faction;
  reference: MahactKingReferenceData;
};

export function MahactKingReference({ faction, reference }: Props) {
  return (
    <Paper
      withBorder
      radius="md"
      p={{ base: "md", sm: "lg" }}
      maw={900}
      mx="auto"
      style={{ borderTop: `4px solid ${reference.accent}` }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Group gap="md" wrap="nowrap" miw={0}>
            <Box
              component="img"
              src={appPath(faction.iconPath)}
              alt=""
              aria-hidden
              w={{ base: 42, sm: 54 }}
              h={{ base: 42, sm: 54 }}
              style={{ objectFit: "contain", flexShrink: 0 }}
            />
            <Box miw={0}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts="0.08em">
                Mahact King
              </Text>
              <Text
                fz={{ base: "lg", sm: "xl" }}
                fw={700}
                ff="var(--font-display)"
                lh={1.2}
                style={{ overflowWrap: "anywhere" }}
              >
                {faction.name}
              </Text>
            </Box>
          </Group>
          <Text size="sm" fw={600} c="var(--command-text-body)">
            {reference.commodities} commodities
          </Text>
        </Group>

        {reference.units.map((unit) => (
          <Paper
            key={unit.type}
            withBorder
            radius="sm"
            p={{ base: "sm", sm: "md" }}
          >
            <Stack gap="sm">
              <Group gap="xs" align="center">
                <Badge variant="light" color="gray" size="lg">
                  {unit.type}
                </Badge>
                <Text fw={700} fz={{ base: "md", sm: "lg" }}>
                  {unit.name}
                </Text>
              </Group>

              <Text size="sm" lh={1.5}>
                {unit.ability}
              </Text>

              <Group gap={6}>
                {unit.traits.map((trait) => (
                  <Badge key={trait} variant="light" color="gray" size="sm">
                    {trait}
                  </Badge>
                ))}
              </Group>

              <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs">
                {unit.stats.map((stat) => (
                  <Paper
                    key={stat.label}
                    withBorder
                    radius="sm"
                    py="xs"
                    px="sm"
                    ta="center"
                    bg="var(--mantine-color-body)"
                  >
                    <Text fw={700} fz={{ base: "lg", sm: "xl" }} lh={1.1}>
                      {stat.value}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      tt="uppercase"
                      fw={600}
                      lts="0.04em"
                    >
                      {stat.label}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
