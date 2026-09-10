import { Box, Group, Text } from "@mantine/core";
import classes from "./PlanetStatsPill.module.css";

type Props = {
  resources: number;
  influence: number;
  flex?: number;
  size?: "xs" | "sm" | "md" | "lg";
  compact?: boolean;
};

export function PlanetStatsPill({
  resources,
  influence,
  flex,
  size = "sm",
  compact = false,
}: Props) {
  return (
    <Group gap={2} className={compact ? classes.compact : undefined}>
      <Box className={classes.resources} px={compact ? 5 : "xs"}>
        <Text fw={600} size={size} className={classes.text}>
          {resources}
        </Text>
      </Box>
      <Box
        className={`${classes.influence} ${flex === undefined ? classes.withBorder : ""}`}
        px={compact ? 5 : "xs"}
      >
        <Text fw={600} size={size} className={classes.text}>
          {influence}
        </Text>
      </Box>
      {flex !== undefined ? (
        <Box className={classes.flex} px={compact ? 5 : "xs"}>
          <Text fw={600} size={size} className={classes.text}>
            {flex}
          </Text>
        </Box>
      ) : undefined}
    </Group>
  );
}
