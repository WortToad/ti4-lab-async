import { List, SimpleGrid, Stack, Text } from "@mantine/core";
import { FleetComposition } from "~/types";
import { UnitSymbol } from "~/draft/bag/UnitDetails";
import type { UnitColor } from "~/draft/bag/visuals";

type Props = {
  fleetComposition: FleetComposition;
  title?: string;
  showTitle?: boolean;
  color?: UnitColor;
};

export function StartingUnitsTable({
  fleetComposition,
  title = "Starting Units",
  showTitle = true,
  color,
}: Props) {
  const unitOrder = [
    { key: "flagship", name: "Flagship" },
    { key: "warsun", name: "War Sun" },
    { key: "dreadnought", name: "Dreadnought" },
    { key: "carrier", name: "Carrier" },
    { key: "infantry", name: "Infantry" },
    { key: "destroyer", name: "Destroyer" },
    { key: "cruiser", name: "Cruiser" },
    { key: "spacedock", name: "Space Dock" },
    { key: "fighter", name: "Fighter" },
    { key: "pds", name: "PDS" },
    { key: "mech", name: "Mech" },
  ] as const;

  const units = unitOrder
    .map(({ key, name }) => {
      const count = fleetComposition[key];
      if (!count) return null;
      let pluralized: string = name;
      if (name === "Infantry" || name === "PDS") {
        pluralized = name;
      } else if (name === "War Sun") {
        pluralized = count > 1 ? "War Suns" : "War Sun";
      } else {
        pluralized = count > 1 ? `${name}s` : name;
      }
      return { key, label: `${count} ${pluralized}` };
    })
    .filter((unit) => unit !== null);

  const leftColumn = units.filter((_, idx) => idx % 2 === 0);
  const rightColumn = units.filter((_, idx) => idx % 2 === 1);

  return (
    <Stack gap="xs">
      {showTitle && (
        <Text size="xs" fw={600} c="dimmed">
          {title}
        </Text>
      )}
      <SimpleGrid cols={2} spacing={4}>
        <List size="xs" spacing={2}>
          {leftColumn.map((unit) => (
            <List.Item
              key={unit.key}
              icon={<UnitSymbol unit={unit.key} size={24} color={color} />}
            >
              {unit.label}
            </List.Item>
          ))}
        </List>
        <List size="xs" spacing={2}>
          {rightColumn.map((unit) => (
            <List.Item
              key={unit.key}
              icon={<UnitSymbol unit={unit.key} size={24} color={color} />}
            >
              {unit.label}
            </List.Item>
          ))}
        </List>
      </SimpleGrid>
    </Stack>
  );
}
