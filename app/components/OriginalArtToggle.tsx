import { Box, Group, SegmentedControl } from "@mantine/core";
import { IconPalette } from "@tabler/icons-react";
import { useSafeOutletContext } from "~/useSafeOutletContext";

export function OriginalArtToggle() {
  const { originalArt, setOriginalArt } = useSafeOutletContext();
  return (
    <Box style={{ flexShrink: 0 }}>
      <SegmentedControl
        aria-label="Tile artwork"
        onChange={(value) => setOriginalArt(value === "original")}
        value={originalArt ? "original" : "simplified"}
        color="blue"
        styles={{ label: { whiteSpace: "nowrap" } }}
        data={[
          { label: "Originals", value: "original" },
          {
            label: (
              <Group gap={6} wrap="nowrap" justify="center">
                <IconPalette size={16} style={{ flexShrink: 0 }} />
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
