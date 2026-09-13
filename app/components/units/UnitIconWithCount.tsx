import { appPath } from "~/utils/appUrl";
import { Box, Image, Text } from "@mantine/core";
import styles from "./UnitIconWithCount.module.css";
import { unitIconPath, type UnitColor } from "~/draft/bag/visuals";

type Props = {
  unit: string; // filename without extension, e.g. "carrier"
  count: number;
  size?: number; // square px
  color?: UnitColor;
};

export function UnitIconWithCount({ unit, count, size = 28, color }: Props) {
  const src = unitIconPath(unit, color) ?? `/units/${unit}.png`;
  return (
    <Box
      className={styles.iconWrapper}
      w={size}
      h={size}
      style={{ display: "inline-block" }}
    >
      <Image src={appPath(src)} w={size} h={size} alt={unit} fit="contain" />
      <Text className={styles.count} fz={Math.max(16, Math.round(size * 0.6))}>
        {count}
      </Text>
    </Box>
  );
}
