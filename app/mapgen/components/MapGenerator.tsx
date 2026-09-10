import { appUrl, appPath } from "~/utils/appUrl";
import {
  AppShell,
  Box,
  Button,
  Group,
  Text,
  Modal,
  ActionIcon,
  Select,
  MultiSelect,
  TextInput,
  Textarea,
  Alert,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { ClientOnly } from "remix-utils/client-only";
import { Map, MAP_INTERACTIONS } from "~/components/Map";
import { MainAppShell } from "~/components/MainAppShell";
import { RawSystemTile } from "~/components/tiles/SystemTile";
import { OriginalArtTile } from "~/components/tiles/OriginalArtTile";
import { OriginalArtToggle } from "~/components/OriginalArtToggle";
import { TileArtContext } from "~/contexts/TileArtContext";
import { useSafeOutletContext } from "~/useSafeOutletContext";
import { useState, useMemo, useEffect } from "react";
import { Tile, GameSet, Map as GalaxyMap } from "~/types";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMapBuilder } from "~/mapBuilderStore";
import { MapBuilderPlanetFinder } from "~/components/MapBuilderPlanetFinder";
import {
  IconRefresh,
  IconTrash,
  IconArrowsShuffle,
  IconShare,
  IconPhoto,
  IconWand,
  IconMinus,
  IconPlus,
  IconHexagonOff,
  IconFileExport,
  IconArrowBackUp,
  IconArrowForwardUp,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { draftConfig } from "~/draft/draftConfig";
import {
  mapConfigToCompatibleDraftTypes,
  extractSlicesFromMap,
  buildPresetMap,
  encodeSeededMapData,
  SeededMapData,
} from "../utils/mapToDraft";
import { autoCompleteMap } from "../utils/mapCompletion";
import { useMapStats } from "../utils/mapStats";
import { encodeMapString, decodeMapString } from "../utils/mapStringCodec";
import {
  encodeAsyncMapString,
  decodeAsyncMapString,
  encodeTtpgMapString,
  decodeTtpgMapString,
  type ExternalMapStringFormat,
} from "../utils/externalMapStringCodec";
import {
  getAllSliceValues,
  getAllSliceStats,
  getAllSliceBreakdowns,
  calculateBalanceGap,
  getAllTileContributions,
} from "../utils/sliceScoring";
import { improveBalance } from "../utils/improveBalance";
import { TileSidebar } from "./TileSidebar";
import { SliceScoringInfoModal } from "./SliceScoringInfoModal";
import { MapStatsOverlay } from "./MapStatsOverlay";
import { systemData } from "~/data/systemData";
import { ShareMapModal } from "./ShareMapModal";
import { mapConfigs } from "~/mapgen/mapConfigs";
import { DraftTypeSelectionModal } from "./DraftTypeSelectionModal";
import { MapStringImportExportModal } from "./MapStringImportExportModal";
import { DraftType } from "~/draft/types";
import { buildPresetDraftState } from "../utils/presetDraft";
import { readSavedMap, saveMap } from "../utils/editorStorage";
import { countMapLegalityViolations } from "../utils/mapLegality";

function MapGeneratorContent() {
  const { originalArt } = useSafeOutletContext();
  const DragTile = originalArt ? OriginalArtTile : RawSystemTile;
  const navigate = useNavigate();
  const location = useLocation();
  const [savedLocally, setSavedLocally] = useState(true);
  const map = useMapBuilder((state) => state.state.map);
  const systemPool = useMapBuilder((state) => state.state.systemPool);
  const mapConfigId = useMapBuilder((state) => state.state.mapConfigId);
  const gameSets = useMapBuilder((state) => state.state.gameSets);
  const ringCount = useMapBuilder((state) => state.state.ringCount);
  const hoveredHomeIdx = useMapBuilder((state) => state.state.hoveredHomeIdx);
  const closeTileMode = useMapBuilder((state) => state.state.closeTileMode);
  const canUndo = useMapBuilder((state) => state.past.length > 0);
  const canRedo = useMapBuilder((state) => state.future.length > 0);
  const {
    undo,
    redo,
    addSystemToMap,
    removeSystemFromMap,
    swapTiles,
    openPlanetFinderForMap,
    clearMap,
    setMap,
    setGameSets,
    setMapConfig,
    setRingCount,
    setHoveredHomeIdx,
    toggleCloseTileMode,
    toggleTileClosed,
    addHomeSystem,
    removeHomeSystem,
    loadDecodedMap,
  } = useMapBuilder((state) => state.actions);
  const stats = useMapStats();

  // Calculate player count from HOME tiles
  const playerCount = useMemo(
    () => map.filter((tile) => tile.type === "HOME").length,
    [map],
  );

  // Calculate slice values, stats, breakdowns, tile contributions, and balance gap
  const sliceValues = useMemo(
    () => getAllSliceValues(map, undefined, undefined, ringCount),
    [map, ringCount],
  );
  const sliceStats = useMemo(() => getAllSliceStats(map), [map]);
  const sliceBreakdowns = useMemo(
    () => getAllSliceBreakdowns(map, undefined, ringCount),
    [map, ringCount],
  );
  const tileContributions = useMemo(() => getAllTileContributions(map), [map]);
  const balanceGap = useMemo(
    () => calculateBalanceGap(sliceValues),
    [sliceValues],
  );

  const duplicateHyperlanes = useMemo(() => {
    const counts = new globalThis.Map<string, number>();
    map.forEach((tile) => {
      if (tile.type !== "SYSTEM") return;
      const system = systemData[tile.systemId];
      if (system?.type !== "HYPERLANE") return;
      counts.set(tile.systemId, (counts.get(tile.systemId) ?? 0) + 1);
    });
    return Array.from(counts.entries()).filter(([, count]) => count > 1);
  }, [map]);

  const [infoOpened, { open: openInfo, close: closeInfo }] =
    useDisclosure(false);
  const [shareOpened, { open: openShare, close: closeShare }] =
    useDisclosure(false);
  const [draftTypeOpened, { open: openDraftType, close: closeDraftType }] =
    useDisclosure(false);
  const [mapStringsOpened, { open: openMapStrings, close: closeMapStrings }] =
    useDisclosure(false);
  const [publishOpened, { open: openPublish, close: closePublish }] =
    useDisclosure(false);
  const [compatibleDraftTypes, setCompatibleDraftTypes] = useState<DraftType[]>(
    [],
  );
  const [publishName, setPublishName] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishAuthor, setPublishAuthor] = useState("");
  const [publishing, setPublishing] = useState(false);
  const mapString = useMemo(() => {
    return encodeMapString(map);
  }, [map]);

  const externalMapStrings = useMemo(
    () => ({
      ttpg: encodeTtpgMapString(map),
      async: encodeAsyncMapString(map),
    }),
    [map],
  );

  const hasSystems = useMemo(() => {
    return map.some((tile) => tile.type === "SYSTEM" && tile.idx !== 0);
  }, [map]);

  const shareUrl = useMemo(() => {
    const encoded = encodeMapString(map);
    return appUrl(
      `/map-generator?map=${encodeURIComponent(encoded)}&layout=${encodeURIComponent(mapConfigId)}`,
    );
  }, [map, mapConfigId]);

  const imageUrl = useMemo(() => {
    const encoded = encodeMapString(map);
    return appUrl(`/map-generator.png?map=${encodeURIComponent(encoded)}`);
  }, [map]);

  // Check if map is complete (no OPEN tiles)
  const isMapComplete = useMemo(() => {
    return !map.some((tile) => tile.type === "OPEN");
  }, [map]);

  // Make all tiles except Mecatol Rex and closed tiles modifiable.
  const modifiableMapTiles = Array.from(
    { length: map.length },
    (_, i) => i,
  ).filter((i) => i !== 0 && map[i]?.type !== "CLOSED");

  const handleRandomize = () => {
    // Prepare a candidate without destroying the current map on failure.
    const partialMap: GalaxyMap = map.map((tile) =>
      tile.type === "SYSTEM" &&
      tile.idx !== 0 &&
      systemData[tile.systemId]?.type !== "HYPERLANE"
        ? { idx: tile.idx, position: tile.position, type: "OPEN" }
        : tile,
    );
    const completedMap = autoCompleteMap(partialMap, systemPool);
    if (completedMap) {
      setMap(completedMap);
      const violations = countMapLegalityViolations(completedMap);
      if (violations > 0)
        notifications.show({
          title: "Map generated with adjacent hazards",
          message:
            "Some anomalies or matching wormholes are adjacent. Adjust those tiles or randomize again if your setup requires separation.",
          color: "yellow",
        });
    } else {
      notifications.show({
        title: "Randomization failed",
        message:
          "There are not enough available systems to fill this map. Add a game set, reduce the ring count, or close unused spaces. Your previous map is preserved.",
        color: "yellow",
      });
    }
  };

  const handleImproveBalance = () => {
    const improvedMap = improveBalance(map);
    if (improvedMap) {
      setMap(improvedMap);
    }
  };

  const handleImportMapString = (
    mapString: string,
    format: ExternalMapStringFormat,
  ): boolean => {
    const formatLabel = format === "ttpg" ? "TTPG" : "Async";
    if (!mapString.trim()) {
      notifications.show({
        title: "Invalid input",
        message: `Please enter a ${formatLabel} map string`,
        color: "red",
      });
      return false;
    }

    const decoded =
      format === "ttpg"
        ? decodeTtpgMapString(mapString)
        : decodeAsyncMapString(mapString);
    if (!decoded) {
      notifications.show({
        title: "Invalid input",
        message: `This is not a valid ${formatLabel} map string`,
        color: "red",
      });
      return false;
    }

    loadDecodedMap(decoded.map, decoded.ringCount, decoded.gameSets, mapConfigId);

    const systemsPlaced = decoded.map.filter(
      (tile) => tile.type === "SYSTEM" && tile.idx !== 0,
    ).length;

    notifications.show({
      title: "Map imported",
      message: `Imported ${systemsPlaced} systems from ${formatLabel}`,
      color: "green",
    });
    return true;
  };

  const handleCreateDraft = () => {
    const compatibleTypes = mapConfigToCompatibleDraftTypes[mapConfigId];
    if (!compatibleTypes || compatibleTypes.length === 0) {
      notifications.show({
        title: "Unsupported",
        message: "This map type doesn't support draft creation",
        color: "red",
      });
      return;
    }

    // If multiple compatible types, show selection modal
    if (compatibleTypes.length > 1) {
      setCompatibleDraftTypes(compatibleTypes);
      openDraftType();
      return;
    }

    // Single compatible type - navigate directly
    navigateToDraft(compatibleTypes[0]);
  };

  const handleCreatePresetDraft = () => {
    const result = buildPresetDraftState({
      map,
      mapConfigId,
      gameSets,
      playerCount,
    });

    if (!result.ok) {
      const isMissingPlayers = result.error.includes("home systems");
      notifications.show({
        title: isMissingPlayers ? "Missing players" : "Unsupported",
        message: result.error,
        color: isMissingPlayers ? "yellow" : "red",
      });
      return;
    }

    navigate("/draft/new", {
      state: {
        draftSettings: result.value.settings,
        players: result.value.players,
        discordData: undefined,
      },
    });
  };

  const navigateToDraft = (selectedDraftType: DraftType) => {
    const compatibleTypes = mapConfigToCompatibleDraftTypes[mapConfigId];
    const config = draftConfig[selectedDraftType];
    const mapConfig = mapConfigs[mapConfigId];
    const { slices, sliceTileIndices } = extractSlicesFromMap(
      map,
      mapConfig,
      config,
    );
    const presetMap = buildPresetMap(map, sliceTileIndices);

    const seededData: SeededMapData = {
      slices,
      presetMap,
      mapConfigId,
      // Pass all compatible types so user can switch between them in prechoice
      compatibleDraftTypes: compatibleTypes,
      gameSets,
    };

    const encoded = encodeSeededMapData(seededData);
    // Include the selected draft type in the URL so prechoice uses it
    navigate(
      `/draft/prechoice?mapSlices=${encoded}&draftType=${selectedDraftType}`,
    );
  };

  const handleDraftTypeSelect = (draftType: DraftType) => {
    closeDraftType();
    navigateToDraft(draftType);
  };

  const handlePublish = async () => {
    if (!isMapComplete) {
      notifications.show({
        title: "Map incomplete",
        message: "Complete the map before publishing.",
        color: "yellow",
      });
      return;
    }

    const name = publishName.trim();
    const description = publishDescription.trim();
    const author = publishAuthor.trim();

    if (!name || !description || !author) {
      notifications.show({
        title: "Missing details",
        message: "Name, description, and author are required.",
        color: "red",
      });
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch(appPath("/api/preset-maps"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          author,
          mapString,
          mapConfigId,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result?.slug) {
        notifications.show({
          title: "Publish failed",
          message: result?.error ?? "Unable to publish map.",
          color: "red",
        });
        return;
      }

      // Navigate to the published map page
      navigate(`/maps/${result.slug}`);
    } catch {
      notifications.show({
        title: "Publish failed",
        message:
          "Could not reach the server. Your map and publishing details are preserved; check your connection and try again.",
        color: "red",
      });
    } finally {
      setPublishing(false);
    }
  };

  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [activeSystemRotation, setActiveSystemRotation] = useState<
    number | undefined
  >(undefined);

  // Restore edits on refresh, including edits made after opening a shared map.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let mapParam = params.get("map");
    let saved = readSavedMap(mapParam);
    const decoded = !saved && mapParam ? decodeMapString(mapParam) : null;
    if (mapParam && !saved && !decoded) {
      notifications.show({
        id: "map-link-error",
        title: "Map link could not be loaded",
        message:
          "The map string is invalid. Check that you copied the complete link. Your saved map is preserved.",
        color: "red",
      });
      saved = readSavedMap(null);
      mapParam = saved?.source ?? null;
    }
    if (saved) {
      loadDecodedMap(
        saved.map,
        saved.ringCount,
        saved.gameSets,
        saved.mapConfigId,
        false,
      );
    } else if (decoded) {
      loadDecodedMap(
        decoded.map,
        decoded.ringCount,
        decoded.gameSets,
        params.get("layout") ?? undefined,
        false,
      );
    }
    setSavedLocally(saveMap(useMapBuilder.getState().state, mapParam));
    return useMapBuilder.subscribe((next, previous) => {
      if (
        next.state.map !== previous.state.map ||
        next.state.gameSets !== previous.state.gameSets ||
        next.state.mapConfigId !== previous.state.mapConfigId
      ) {
        setSavedLocally(saveMap(next.state, mapParam));
      }
    });
  }, [loadDecodedMap, location.search]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    if (activeId.startsWith("sidebar-")) {
      const systemId = event.active.data.current?.systemId;
      const rotation = event.active.data.current?.rotation;
      setActiveSystemId(systemId || null);
      setActiveSystemRotation(rotation);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSystemId(null);
    setActiveSystemRotation(undefined);

    if (!event.over) return;

    const activeId = event.active.id as string;
    const originTile: Tile | undefined = event.active.data.current?.tile;
    const destTile: Tile | undefined = event.over.data.current?.tile;

    // Sidebar to map drag
    if (activeId.startsWith("sidebar-")) {
      const systemId = event.active.data.current?.systemId;
      const rotation = event.active.data.current?.rotation;
      if (!systemId || !destTile) return;

      // Sidebar tiles can drop on OPEN, SYSTEM, or HOME tiles
      if (
        destTile.type !== "OPEN" &&
        destTile.type !== "SYSTEM" &&
        destTile.type !== "HOME"
      )
        return;
      if (destTile.type === "SYSTEM" && destTile.systemId === "18") return;

      addSystemToMap(destTile.idx, systemId, rotation);
      return;
    }

    // Tile-to-tile swap (map tiles only)
    if (!originTile || !destTile) return;

    // Protect Mecatol Rex (index 0)
    if (originTile.idx === 0 || destTile.idx === 0) return;

    // Only allow swapping draggable types (SYSTEM, HOME) with valid drop targets (SYSTEM, HOME, OPEN)
    const draggableTypes = ["SYSTEM", "HOME"];
    const droppableTypes = ["SYSTEM", "HOME", "OPEN"];

    if (!draggableTypes.includes(originTile.type)) return;
    if (!droppableTypes.includes(destTile.type)) return;

    // Don't allow dropping on Mecatol Rex
    if (destTile.type === "SYSTEM" && destTile.systemId === "18") return;

    // Use swapTiles for all tile-to-tile swaps
    swapTiles(originTile.idx, destTile.idx);
  };

  const delayedPointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const sensors = useSensors(delayedPointerSensor);

  const tileRadius = 60;

  return (
    <>
      <SliceScoringInfoModal opened={infoOpened} onClose={closeInfo} />
      <ShareMapModal
        mapString={mapString}
        shareUrl={shareUrl}
        opened={shareOpened}
        onClose={closeShare}
      />
      <DraftTypeSelectionModal
        opened={draftTypeOpened}
        compatibleTypes={compatibleDraftTypes}
        onClose={closeDraftType}
        onSelect={handleDraftTypeSelect}
      />
      <Modal
        opened={publishOpened}
        onClose={closePublish}
        title="Publish Map"
        centered
      >
        <Group gap="sm" mb="md" grow>
          <TextInput
            label="Name"
            placeholder="Map name"
            value={publishName}
            onChange={(e) => setPublishName(e.currentTarget.value)}
          />
          <TextInput
            label="Author"
            placeholder="Your name"
            value={publishAuthor}
            onChange={(e) => setPublishAuthor(e.currentTarget.value)}
          />
        </Group>
        <Textarea
          label="Description"
          placeholder="What makes this map special?"
          minRows={4}
          value={publishDescription}
          onChange={(e) => setPublishDescription(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closePublish}>
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            loading={publishing}
            disabled={!isMapComplete}
          >
            Publish
          </Button>
        </Group>
      </Modal>
      <MapStringImportExportModal
        exportStrings={
          hasSystems ? externalMapStrings : { ttpg: "", async: "" }
        }
        opened={mapStringsOpened}
        onClose={closeMapStrings}
        onImport={handleImportMapString}
      />

      <MapBuilderPlanetFinder />
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveSystemId(null);
          setActiveSystemRotation(undefined);
        }}
        sensors={sensors}
      >
        {duplicateHyperlanes.length > 0 && (
          <Box
            pos="fixed"
            bottom={12}
            right={12}
            style={{ zIndex: 2000, maxWidth: 320 }}
          >
            <Alert color="yellow" variant="light" radius="md">
              <Text size="xs">
                Duplicate hyperlanes detected. Physical maps may be limited to
                one copy per tile.
              </Text>
            </Alert>
          </Box>
        )}
        <AppShell
          navbar={{
            width: 250,
            breakpoint: "md",
            collapsed: { mobile: true },
          }}
          padding={0}
        >
          <AppShell.Navbar p={0} visibleFrom="sm">
            <TileSidebar />
          </AppShell.Navbar>
          <AppShell.Main p={0} h="calc(100vh - 60px)" mih="calc(100vh - 60px)">
            <Box bg="dark.7" px="sm" py={8}>
              <Group gap="sm" wrap="wrap">
                <OriginalArtToggle />
                <Select
                  data={Object.values(mapConfigs).map((config) => ({
                    value: config.id,
                    label: config.name,
                  }))}
                  value={mapConfigId}
                  aria-label="Map layout"
                  onChange={(value) => {
                    if (value && mapConfigs[value]) {
                      setMapConfig(value);
                    }
                  }}
                  size="xs"
                  w={140}
                />
                <MultiSelect
                  data={[
                    { value: "base", label: "Base" },
                    { value: "pok", label: "PoK" },
                    { value: "te", label: "Thunder's Edge" },
                    { value: "unchartedstars", label: "Uncharted Stars" },
                  ]}
                  value={gameSets}
                  aria-label="Game sets"
                  onChange={(value) => setGameSets(value as GameSet[])}
                  placeholder="Game Sets"
                  size="xs"
                  w={160}
                  checkIconPosition="right"
                />
                <Group gap={4}>
                  <ActionIcon
                    aria-label="Remove outer ring"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setRingCount(ringCount - 1)}
                    disabled={ringCount <= 2}
                  >
                    <IconMinus size={14} />
                  </ActionIcon>
                  <Text size="xs" c="dimmed" w={50} ta="center">
                    {ringCount} rings
                  </Text>
                  <ActionIcon
                    aria-label="Add outer ring"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setRingCount(ringCount + 1)}
                    disabled={ringCount >= 5}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                </Group>
                <Button
                  leftSection={<IconFileExport size={14} />}
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={openMapStrings}
                >
                  Map Strings
                </Button>
                <Group gap={4}>
                  <ActionIcon
                    aria-label="Remove home system"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={removeHomeSystem}
                    disabled={playerCount <= 1}
                  >
                    <IconMinus size={14} />
                  </ActionIcon>
                  <Text size="xs" c="dimmed" w={55} ta="center">
                    {playerCount} players
                  </Text>
                  <ActionIcon
                    aria-label="Add home system"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={addHomeSystem}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                </Group>
                <ActionIcon
                  variant={closeTileMode ? "filled" : "subtle"}
                  color={closeTileMode ? "red" : "gray"}
                  size="sm"
                  onClick={toggleCloseTileMode}
                  title="Close tile tool"
                  aria-label="Close tile tool"
                  aria-pressed={closeTileMode}
                >
                  <IconHexagonOff size={16} />
                </ActionIcon>
                <Button
                  leftSection={<IconRefresh size={14} />}
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={handleRandomize}
                >
                  Randomize
                </Button>
                <Button
                  leftSection={<IconArrowsShuffle size={14} />}
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={handleImproveBalance}
                  disabled={balanceGap === 0}
                >
                  Balance
                </Button>
                <Button
                  leftSection={<IconTrash size={14} />}
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={clearMap}
                >
                  Reset
                </Button>
                <Group gap={4}>
                  <Tooltip label="Undo map edit">
                    <ActionIcon
                      aria-label="Undo map edit"
                      variant="subtle"
                      color="gray"
                      onClick={undo}
                      disabled={!canUndo}
                    >
                      <IconArrowBackUp size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Redo map edit">
                    <ActionIcon
                      aria-label="Redo map edit"
                      variant="subtle"
                      color="gray"
                      onClick={redo}
                      disabled={!canRedo}
                    >
                      <IconArrowForwardUp size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                {balanceGap > 0 && (
                  <Button
                    variant="subtle"
                    color="yellow"
                    size="xs"
                    onClick={openInfo}
                    aria-label="Explain map balance"
                  >
                    Gap: {balanceGap.toFixed(1)}
                  </Button>
                )}
                <Box style={{ marginLeft: "auto" }}>
                  <Group gap="xs">
                    <Button
                      leftSection={<IconShare size={14} />}
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={openShare}
                    >
                      Share
                    </Button>
                    <Button
                      leftSection={<IconPhoto size={14} />}
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => window.open(imageUrl, "_blank")}
                      disabled={!isMapComplete}
                    >
                      Image
                    </Button>
                    <Button
                      variant="light"
                      color="blue"
                      size="xs"
                      onClick={handleCreateDraft}
                      disabled={!isMapComplete}
                    >
                      Slice Draft
                    </Button>
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => navigate("/draft/raw/new")}
                    >
                      Build a RAW galaxy
                    </Button>
                    <Button
                      leftSection={<IconWand size={14} />}
                      variant="filled"
                      color="blue"
                      size="xs"
                      onClick={handleCreatePresetDraft}
                      disabled={!isMapComplete}
                    >
                      Preset Draft
                    </Button>
                    <Button
                      variant="light"
                      color="teal"
                      size="xs"
                      onClick={openPublish}
                      disabled={!isMapComplete}
                    >
                      Publish
                    </Button>
                  </Group>
                </Box>
              </Group>
              <Text size="xs" c={savedLocally ? "dimmed" : "yellow"} mt={4}>
                {savedLocally
                  ? "Map edits are saved in this tab. Undo restores the previous edit, including resets."
                  : "This browser could not save your edits. Use Share or Map Strings to keep a copy before leaving."}
              </Text>
            </Box>
            <Box
              w="100%"
              pos="relative"
              p="md"
              style={{
                aspectRatio: "740 / 800",
                maxHeight: "calc(100vh - 140px)",
                maxWidth: "100%",
              }}
            >
              {/* Desktop: Overlay on map */}
              {stats && (
                <Box visibleFrom="sm">
                  <MapStatsOverlay stats={stats} />
                </Box>
              )}
              <Map
                id="map-generator"
                modifiableMapTiles={modifiableMapTiles}
                map={map}
                disabled={false}
                interactions={MAP_INTERACTIONS.mapGenerator}
                onSelectSystemTile={(tile) => openPlanetFinderForMap(tile.idx)}
                onDeleteSystemTile={(tile) => removeSystemFromMap(tile.idx)}
                sliceValues={sliceValues}
                sliceStats={sliceStats}
                sliceBreakdowns={sliceBreakdowns}
                tileContributions={tileContributions}
                hoveredHomeIdx={hoveredHomeIdx}
                onHomeHover={setHoveredHomeIdx}
                closeTileMode={closeTileMode}
                onToggleTileClosed={toggleTileClosed}
              />
            </Box>

            {/* Mobile: Stats below map */}
            {stats && (
              <Box hiddenFrom="sm" p="md" mt="lg" bg="dark.8">
                <MapStatsOverlay stats={stats} mobile />
              </Box>
            )}
          </AppShell.Main>
        </AppShell>
        <DragOverlay dropAnimation={null}>
          {activeSystemId ? (
            <DragTile
              mapId="drag-overlay"
              tile={{
                idx: 0,
                type: "SYSTEM",
                systemId: activeSystemId,
                rotation: activeSystemRotation,
                position: { x: 0, y: 0 },
              }}
              radius={tileRadius}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

export default function MapGenerator() {
  const [originalArt, setOriginalArt] = useState(false);

  return (
    <TileArtContext.Provider value={{ originalArt, setOriginalArt }}>
      <MainAppShell>
        <ClientOnly fallback={<Box w="100%" h="calc(100vh - 60px)" />}>
          {() => <MapGeneratorContent />}
        </ClientOnly>
      </MainAppShell>
    </TileArtContext.Provider>
  );
}
