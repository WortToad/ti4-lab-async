import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { useDimensions } from "~/hooks/useDimensions";
import { getBoundedMapHeight } from "~/utils/positioning";
import { useWindowDimensions } from "~/hooks/useWindowDimensions";
import { Map, MAP_INTERACTIONS } from "~/components/Map";
import { SectionTitle } from "~/components/Section";
import { IconDice6Filled } from "@tabler/icons-react";
import { useDraft } from "~/draftStore";
import { useDraftConfig } from "~/hooks/useDraftConfig";
import { useFullMapStats } from "~/hooks/useFullMapStats";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Tile } from "~/types";
import { systemData } from "~/data/systemData";
import { useCoreSliceValues } from "~/hooks/useCoreSliceValues";
import { getPresetMapEditableTiles } from "~/utils/presetMapEditing";

export function MapSection() {
  const config = useDraftConfig();
  const map = useDraft((state) => state.draft.presetMap);
  const draftType = useDraft((state) => state.draft.settings.type);
  const settings = useDraft((state) => state.draft.settings);
  const isPresetMap = settings.draftGameMode === "presetMap";
  const isMiniMilty = settings.presetMapFormat === "miniMilty";
  const editableTiles = isPresetMap
    ? getPresetMapEditableTiles({ settings, presetMap: map })
    : config.modifiableMapTiles;
  const sliceValueModifiers = useDraft(
    (state) => state.draft.settings.sliceGenerationConfig?.sliceValueModifiers,
  );
  const {
    randomizeMap,
    clearMap,
    removeSystemFromMap,
    addSystemToMap,
    openPlanetFinderForMap,
  } = useDraft((state) => state.actions);
  const stats = useFullMapStats();

  const showCoreSliceStats = draftType === "heisen";
  const coreSliceData = useCoreSliceValues(map, sliceValueModifiers);

  const { ref, width } = useDimensions<HTMLDivElement>();
  const { height: windowHeight } = useWindowDimensions();
  const height = getBoundedMapHeight(width, windowHeight - 150);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || !event.active.data.current || !event.over.data.current)
      return;
    const [, originTileIdx] = (event.active!.id as string).split("-");
    const [, destTileIdx] = (event.over!.id as string).split("-");

    const destTile: Tile = event.over!.data.current!.tile;
    const originTile: Tile = event.active!.data.current!.tile;

    if (destTile.type !== "SYSTEM") return;
    if (originTile.type !== "SYSTEM") return;
    if (
      !editableTiles.includes(destTile.idx) ||
      !editableTiles.includes(originTile.idx)
    )
      return;

    const originSystem = systemData[originTile.systemId];
    const destinationSystem = systemData[destTile.systemId];

    removeSystemFromMap(parseInt(originTileIdx));
    removeSystemFromMap(parseInt(destTileIdx));
    addSystemToMap(parseInt(destTileIdx), originSystem);
    addSystemToMap(parseInt(originTileIdx), destinationSystem);
  };

  const delayedPointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const sensors = useSensors(delayedPointerSensor);

  return (
    <div style={{ position: "sticky", width: "auto", top: 88 }}>
      <SectionTitle title="Full Map">
        <Group gap={2}>
          {(isMiniMilty ||
            (!isPresetMap &&
              config.allowIndependentMapRandomization !== false)) && (
            <Button
              size="xs"
              onClick={randomizeMap}
              bg="gray"
              aria-label={isMiniMilty ? "Regenerate map" : "Randomize map"}
            >
              <IconDice6Filled size={20} />
              {isMiniMilty && "Regenerate map"}
            </Button>
          )}
          {(!isPresetMap || settings.presetMap) && (
            <Button
              size="xs"
              onClick={clearMap}
              color={isPresetMap ? "gray" : "red"}
            >
              {isPresetMap ? "Reset map" : "Clear"}
            </Button>
          )}
        </Group>
      </SectionTitle>
      <Box
        ref={ref}
        style={{
          height,
          width: "calc(100% - 8px)",
          marginInline: 4,
          position: "relative",
        }}
        mt="md"
      >
        {stats && (
          <Stack pos="absolute" top={0} right={0} gap={1} visibleFrom="xs">
            <Text size="sm" ta="right">
              Blue/Red: {stats.blueTiles}/{stats.redTiles}
            </Text>
            <Text size="sm" ta="right">
              Resources/Influence: {stats.totalResources}/{stats.totalInfluence}
            </Text>
            <Text size="sm" ta="right">
              Tech: {stats.totalTech}
            </Text>
            <Text size="sm" ta="right">
              Traits R/G/B: {stats.redTraits}/{stats.greenTraits}/
              {stats.blueTraits}
            </Text>
          </Stack>
        )}
        <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
          <Map
            id="fullmap"
            map={map}
            modifiableMapTiles={editableTiles}
            interactions={MAP_INTERACTIONS.draftBuild}
            onSelectSystemTile={(t) => openPlanetFinderForMap(t.idx)}
            onDeleteSystemTile={(t) => removeSystemFromMap(t.idx)}
            coreSliceData={showCoreSliceStats ? coreSliceData : undefined}
          />
        </DndContext>
      </Box>
    </div>
  );
}
