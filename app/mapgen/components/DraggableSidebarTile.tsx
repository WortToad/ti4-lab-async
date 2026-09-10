import { Box, Card, Text, alpha } from "@mantine/core";
import { useDraggable } from "@dnd-kit/core";
import { RawSystemTile } from "~/components/tiles/SystemTile";
import { systemData } from "~/data/systemData";
import { OriginalArtTile } from "~/components/tiles/OriginalArtTile";
import { SystemTileStats } from "~/components/SystemTileStats";
import { useSafeOutletContext } from "~/useSafeOutletContext";

type Props = {
  systemId: string;
  rotation?: number;
  selected?: boolean;
  showStats?: boolean;
  onSelect?: (systemId: string) => void;
};

export function DraggableSidebarTile({
  systemId,
  rotation,
  selected = false,
  showStats = false,
  onSelect,
}: Props) {
  const { originalArt } = useSafeOutletContext();
  const tileRadius = 60;
  const tileWidth = tileRadius * 2;
  const tileHeight = tileRadius * 2;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${systemId}-${rotation ?? 0}`,
    data: { systemId, rotation },
  });

  const system = systemData[systemId];
  const isRedSystem = system?.type === "RED";

  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isRedSystem
          ? alpha("var(--mantine-color-red-8)", 0.15)
          : undefined,
        borderColor: selected
          ? "var(--mantine-color-green-6)"
          : isRedSystem
            ? alpha("var(--mantine-color-red-8)", 0.3)
            : undefined,
        borderWidth: selected ? 3 : undefined,
        borderStyle: selected ? "solid" : undefined,
        cursor: onSelect ? "pointer" : undefined,
      }}
      onClick={onSelect ? () => onSelect(systemId) : undefined}
    >
      <Box
        ref={setNodeRef}
        style={{
          position: "relative",
          width: tileWidth,
          height: tileHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto",
          cursor: "grab",
        }}
        {...listeners}
        {...attributes}
      >
        {originalArt ? (
          <OriginalArtTile
            mapId="sidebar"
            tile={{
              idx: 0,
              type: "SYSTEM",
              systemId,
              rotation,
              position: { x: 0, y: 0 },
            }}
            radius={tileRadius}
            hoverEffects={false}
          />
        ) : (
          <RawSystemTile
            mapId="sidebar"
            tile={{
              idx: 0,
              type: "SYSTEM",
              systemId: systemId,
              rotation,
              position: { x: 0, y: 0 },
            }}
            radius={tileRadius}
            disablePopover={true}
          />
        )}
      </Box>
      {showStats && system && <SystemTileStats system={system} />}
      {rotation !== undefined && (
        <Text size="xs" c="dimmed" ta="center" mt={6}>
          Rotation {rotation}°
        </Text>
      )}
    </Card>
  );
}
