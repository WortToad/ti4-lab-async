import { Button } from "@mantine/core";
import { IconPhoto, IconPhotoOff } from "@tabler/icons-react";

type Props = {
  originalArt: boolean;
  onToggle: () => void;
};

export function LabArtToggleButton({ originalArt, onToggle }: Props) {
  return (
    <Button
      size="compact-xs"
      variant="filled"
      color={originalArt ? "orange" : "violet"}
      style={{ flexShrink: 0 }}
      styles={{ label: { whiteSpace: "nowrap" } }}
      leftSection={
        originalArt ? <IconPhoto size={14} /> : <IconPhotoOff size={14} />
      }
      onClick={onToggle}
      aria-label={
        originalArt ? "Switch to simplified tiles" : "Switch to original art"
      }
      title={
        originalArt ? "Switch to simplified tiles" : "Switch to original art"
      }
    >
      {originalArt ? "Originals" : "Simplified"}
    </Button>
  );
}
