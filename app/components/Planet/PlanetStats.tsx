import { Box, Group, Text } from "@mantine/core";

type Props = {
  legendary?: boolean;
  resources: number;
  influence: number;
  fontSize?: string;
};

export function PlanetStats({
  resources,
  influence,
  fontSize = "25px",
}: Props) {
  return (
    <Group
      gap={3}
      wrap="nowrap"
      role="img"
      aria-label={`${resources} resources, ${influence} influence`}
      style={{ zIndex: 1 }}
    >
      <Box
        bg="#e1bb72"
        px={3}
        style={{ borderRadius: 3, border: "1px solid #071321" }}
      >
        <Text size={fontSize} lh={1.25} fw={700} c="#071321">
          {resources}
        </Text>
      </Box>
      <Box
        bg="#82c7ed"
        px={3}
        style={{ borderRadius: 3, border: "1px solid #071321" }}
      >
        <Text size={fontSize} lh={1.25} fw={700} c="#071321">
          {influence}
        </Text>
      </Box>
    </Group>
  );
}
