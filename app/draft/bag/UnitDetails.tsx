import { Badge, Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconRocket } from "@tabler/icons-react";
import { appPath } from "~/utils/appUrl";
import type { BagDraftItem } from "./definitions";
import { unitIconPath, unitLabel, type UnitColor } from "./visuals";
import { BagItemDescription } from "./BagItemDescription";
import classes from "./BagComponents.module.css";

export function UnitSymbol({
  unit,
  size = 38,
  color,
}: {
  unit: string;
  size?: number;
  color?: UnitColor;
}) {
  const path = unitIconPath(unit, color);
  return path ? (
    <img
      src={appPath(path)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ objectFit: "contain", flexShrink: 0 }}
      loading="lazy"
    />
  ) : (
    <IconRocket size={size} stroke={1.5} aria-hidden />
  );
}

export function UnitDetails({
  unit,
  name,
  showText = true,
  color,
}: {
  unit: NonNullable<BagDraftItem["unit"]>;
  name?: string;
  showText?: boolean;
  color?: UnitColor;
}) {
  return (
    <Stack
      component="section"
      aria-label={
        name ? `${unitLabel(unit.type)}: ${name}` : unitLabel(unit.type)
      }
      gap="sm"
    >
      <Group gap="sm" wrap="nowrap">
        <UnitSymbol unit={unit.type} color={color} />
        <Stack gap={2} miw={0}>
          <Text
            size={name ? "xs" : "sm"}
            c={name ? "dimmed" : undefined}
            fw={600}
          >
            {unitLabel(unit.type)}
          </Text>
          {name && (
            <Text fw={600} className={classes.name}>
              {name}
            </Text>
          )}
        </Stack>
      </Group>
      {unit.stats.length > 0 && (
        <SimpleGrid
          type="container"
          cols={{ base: 2, "18rem": unit.stats.length > 2 ? 4 : 2 }}
          spacing={6}
        >
          {unit.stats.map((stat) => (
            <Box key={stat.label} className={classes.stat}>
              <Text fw={700} size="lg" lh={1.2}>
                {stat.value}
              </Text>
              <Text size="xs" c="dimmed">
                {stat.label}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      )}
      {unit.abilities.length > 0 && (
        <Group gap={6}>
          {unit.abilities.map((ability) => (
            <Badge
              key={ability}
              variant="light"
              color="gray"
              className={classes.trait}
            >
              {ability}
            </Badge>
          ))}
        </Group>
      )}
      {showText && unit.text && <BagItemDescription description={unit.text} />}
    </Stack>
  );
}
