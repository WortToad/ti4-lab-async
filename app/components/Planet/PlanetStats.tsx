import { Box, Group, Text, DEFAULT_THEME } from "@mantine/core";

type Props = {
  legendary?: boolean;
  resources: number;
  influence: number;
  fontSize?: string;
};

export function PlanetStats({
  legendary,
  resources,
  influence,
  fontSize = "25px",
}: Props) {
  if (legendary) {
    return (
      <Group
        gap={3}
        wrap="nowrap"
        role="img"
        aria-label={`${resources} resources, ${influence} influence`}
        style={{ zIndex: 1 }}
      >
        <Box
          bg={DEFAULT_THEME.colors.yellow[6]}
          style={{ borderRadius: 8 }}
          px={2}
          py={2}
        >
          <Text size={fontSize} lh={1.55} fw="bolder" c="white">
            {resources}
          </Text>
        </Box>
        <Box
          bg={DEFAULT_THEME.colors.blue[6]}
          style={{ borderRadius: 8 }}
          px={2}
          py={2}
        >
          <Text size={fontSize} lh={1.55} c="white" fw="bolder">
            {influence}
          </Text>
        </Box>
      </Group>
    );
  }
  return (
    <Group
      gap={3}
      wrap="nowrap"
      role="img"
      aria-label={`${resources} resources, ${influence} influence`}
      style={{ zIndex: 1 }}
    >
      <Text
        size={fontSize}
        lh={1.55}
        fw="bolder"
        style={{
          color: "#edff00",
          WebkitTextStroke: "2px #40578a5e",
          paintOrder: "stroke fill",
        }}
      >
        {resources}
      </Text>
      <Text
        size={fontSize}
        lh={1.55}
        c={DEFAULT_THEME.colors.blue[9]}
        fw="bolder"
      >
        {influence}
      </Text>
    </Group>
  );
}
