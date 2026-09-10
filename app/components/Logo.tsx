import { appPath } from "~/utils/appUrl";
import { Group, Text } from "@mantine/core";

import classes from "./Logo.module.css";

export function Logo() {
  return (
    <Group align="center" gap="xs" className={classes.logo}>
      <img
        src={appPath("/ti4toad.png?v=3")}
        width={36}
        height={36}
        style={{ objectFit: "contain" }}
        alt="TI4Toad logo"
      />
      <Text
        fw={700}
        size="sm"
        style={{
          fontFamily: "Orbitron",
          letterSpacing: "0.05em",
        }}
      >
        TI4Toad
      </Text>
    </Group>
  );
}
