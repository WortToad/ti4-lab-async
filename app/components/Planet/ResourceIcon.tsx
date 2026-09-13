import { appPath } from "~/utils/appUrl";
import { Box, Text } from "@mantine/core";

type Props = {
  value: number;
  size?: number; // total square size in px
};

export function ResourceIcon({ value, size = 20 }: Props) {
  return (
    <Box
      component="span"
      pos="relative"
      w={size}
      h={size}
      role="img"
      aria-label={`${value} resources`}
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <Box
        component="span"
        w={size}
        h={size}
        bg="var(--command-resources, #f1d22e)"
        style={{
          display: "block",
          maskImage: `url("${appPath("/symbols/resources.png")}")`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        }}
      />
      <Text
        component="span"
        fz="sm"
        fw="bold"
        c="#071321"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -55%)",
          lineHeight: 1,
        }}
      >
        {value}
      </Text>
    </Box>
  );
}
