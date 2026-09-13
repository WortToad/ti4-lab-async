import { appPath } from "~/utils/appUrl";
import { Box, Group, Paper, Stack, Text } from "@mantine/core";
import { MahactKingReference as MahactKingReferenceData } from "~/data/mahactKingReferences";
import { Faction } from "~/types";
import { UnitDetails } from "~/draft/bag/UnitDetails";
import { GameTerm } from "~/components/GameTerm";

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
                ff="var(--mantine-font-family)"
                lh={1.2}
                style={{ overflowWrap: "anywhere" }}
              >
                {faction.name}
              </Text>
            </Box>
          </Group>
          <Text size="sm" fw={600} c="var(--command-text-body)">
            <GameTerm term="commodities">{`${reference.commodities} commodities`}</GameTerm>
          </Text>
        </Group>

        <MahactKingUnits reference={reference} />
      </Stack>
    </Paper>
  );
}

export function MahactKingUnits({
  reference,
}: {
  reference: MahactKingReferenceData;
}) {
  return (
    <Stack gap="sm">
      {reference.units.map((unit) => (
        <Paper key={unit.type} withBorder radius="sm" p="sm">
          <UnitDetails
            name={unit.name}
            color={reference.unitColor}
            unit={{
              type: unit.type.toLowerCase(),
              stats: unit.stats,
              abilities: unit.traits,
              text: unit.ability,
            }}
          />
        </Paper>
      ))}
    </Stack>
  );
}
