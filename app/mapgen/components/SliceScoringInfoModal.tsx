import { Box, List, Modal, Stack, Text, Title } from "@mantine/core";

type Props = {
  opened: boolean;
  onClose: () => void;
};

export function SliceScoringInfoModal({ opened, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Slice Scoring & Balance"
      size="lg"
    >
      <Stack gap="xl">
        <Box>
          <Title order={3} size="h4" mb="md">
            How Slice Scoring Works
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            Each starting position (slice) is scored based on nearby systems:
          </Text>
          <Stack gap="md">
            <Box bg="dark.6" p="md" style={{ borderRadius: "8px" }}>
              <Title order={4} size="h5" mb="sm">
                System Value Calculation
              </Title>
              <List size="sm" spacing="xs">
                <List.Item>Sum of all planet resources + influence</List.Item>
                <List.Item>+1 bonus per tech specialty</List.Item>
                <List.Item>+1 bonus for legendary planets</List.Item>
                <List.Item>+2 bonus for entropic scar</List.Item>
              </List>
            </Box>

            <Box bg="dark.6" p="md" style={{ borderRadius: "8px" }}>
              <Title order={4} size="h5" mb="sm">
                Distance Weighting
              </Title>
              <List size="sm" spacing="xs">
                <List.Item>
                  Adjacent tiles (distance 1): Full value (1.0×)
                </List.Item>
                <List.Item>Distance 2 tiles: Half value (0.5×)</List.Item>
                <List.Item>Distance 3 tiles: Quarter value (0.25×)</List.Item>
              </List>
            </Box>

            <Box bg="dark.6" p="md" style={{ borderRadius: "8px" }}>
              <Title order={4} size="h5" mb="sm">
                Slice Score
              </Title>
              <Text size="sm">
                Sum of all weighted system values within 3 spaces of the home
                system
              </Text>
            </Box>

            <Box bg="dark.6" p="md" style={{ borderRadius: "8px" }}>
              <Title order={4} size="h5" mb="sm">
                Balance Gap
              </Title>
              <Text size="sm">
                Difference between highest and lowest slice scores
              </Text>
            </Box>
          </Stack>
        </Box>

        <Box>
          <Title order={3} size="h4" mb="md">
            How Improve Balance Works
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            The algorithm reduces the balance gap by swapping systems:
          </Text>
          <List size="sm" spacing="sm">
            <List.Item>
              Identifies all swappable systems (excludes Mecatol Rex and home
              positions)
            </List.Item>
            <List.Item>
              Tries swapping pairs of systems to find improvements
            </List.Item>
            <List.Item>
              Checks map legality after each swap (no adjacent matching
              wormholes, no adjacent anomalies)
            </List.Item>
            <List.Item>
              Applies the first swap that reduces the balance gap
            </List.Item>
            <List.Item>
              Run multiple times to iteratively improve balance
            </List.Item>
          </List>
        </Box>
      </Stack>
    </Modal>
  );
}
