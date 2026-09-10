import { Box, Group, SegmentedControl } from "@mantine/core";
import { IconPalette } from "@tabler/icons-react";
import { useSafeOutletContext } from "~/useSafeOutletContext";

export function OriginalArtToggle() {
  const { originalArt, setOriginalArt } = useSafeOutletContext();
  return (
    <Box>
      <SegmentedControl
        onChange={(value) => setOriginalArt(value === "original")}
        value={originalArt ? "original" : "simplified"}
        color="blue"
        data={[
          { label: "Originals", value: "original" },
          {
            label: (
              <Group gap="xs">
                <IconPalette size={16} />
                <span>Simplified</span>
              </Group>
            ),
            value: "simplified",
          },
        ]}
      />
    </Box>
  );
}
