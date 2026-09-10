import {
  Alert,
  Box,
  Button,
  Flex,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { DiscordData, Draft, DraftSettings } from "~/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { DemoMap } from "~/components/DemoMap";
import { LobbyRecovery } from "~/draft/LobbyRecovery";
import { SectionTitle } from "~/components/Section";
import { LobbyPlayerCount } from "~/draft/LobbyPlayerCount";
import { makeLobbyPlayers, parseLobbyPlayerCount } from "~/draft/lobbySetup";
import {
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
  LoaderFunctionArgs,
  Link,
} from "react-router";
import { IconFile, IconInfoCircle, IconPlayerPlay } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import {
  SliceSettingsModal,
  DEFAULT_SLICE_SETTINGS,
  SliceGenerationSettings,
  SliceSettingsFormatType,
} from "~/components/SliceSettingsModal";
import { useDraftSetup } from "./store";
import { MAPS, ChoosableDraftType } from "./maps";
import { ReferenceCardPacksConfigurationSection } from "./components/ReferenceCardPacksConfigurationSection";
import { SlicesConfigurationSection } from "./components/SlicesConfigurationSection";
import { KingsConfigurationSection } from "./components/KingsConfigurationSection";
import { DraftConfigurationPanel } from "./components/DraftConfigurationPanel";
import { useDraftSettingsBuilder, useDraftNavigation } from "./hooks";
import { buildTexasDraft } from "~/draft/texas/buildTexasDraft";
import { getTexasSetupErrors } from "~/draft/texas/validation";
import { ContentPacksSection } from "./components/ContentPacksSection";
import { MinorFactionsInfoModal } from "./components/MinorFactionsInfoModal";
import { SavedStateModal } from "./components/SavedStateModal";
import { MapStyleSelector } from "./components/MapStyleSelector";
import { SeededMapBanner } from "./components/SeededMapBanner";
import { decodeSeededMapData } from "~/mapgen/utils/mapToDraft";
import { DraftFormatDescription } from "./components/DraftFormatDescription";
import { getMaxAvailableSlices } from "./utils";
import buttonClasses from "~/ui/buttons.module.css";
import classes from "./prechoice.module.css";
import { twilightsFallFactionIds } from "~/data/factionData";
import {
  parseReferenceCardPacks,
  validateTwilightsFallSettings,
} from "~/draft/twilightsFall/pools";

export default function DraftPrechoice() {
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setupError, setSetupError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const { discordData, mapSlicesString, selectedDraftType } =
    useLoaderData<typeof loader>();
  const [hoveredMapType, setHoveredMapType] = useState<
    ChoosableDraftType | undefined
  >();

  const player = useDraftSetup((state) => state.player);
  const setPlayers = useDraftSetup((state) => state.player.setPlayers);
  const map = useDraftSetup((state) => state.map);
  const slices = useDraftSetup((state) => state.slices);
  const draftMode = useDraftSetup((state) => state.draftMode);
  const setDraftMode = useDraftSetup((state) => state.setDraftMode);
  const referenceCardPacks = useDraftSetup((state) => state.referenceCardPacks);
  const kings = useDraftSetup((state) => state.kings);
  const content = useDraftSetup((state) => state.content);
  const format = useDraftSetup((state) => state.format);
  const texas = useDraftSetup((state) => state.texas);
  const faction = useDraftSetup((state) => state.faction);
  const multidraft = useDraftSetup((state) => state.multidraft);

  const [sliceSettings, setSliceSettings] = useState<
    Record<SliceSettingsFormatType, SliceGenerationSettings>
  >({
    milty: DEFAULT_SLICE_SETTINGS.milty,
    miltyeq: DEFAULT_SLICE_SETTINGS.miltyeq,
    heisen: DEFAULT_SLICE_SETTINGS.heisen,
  });

  const [activeSettingsFormat, setActiveSettingsFormat] =
    useState<SliceSettingsFormatType>("milty");

  // Initialize players from Discord data if available
  const discordDataInitialized = useRef(false);
  const requestedPlayerCount = searchParams.get("playerCount");
  useEffect(() => {
    if (discordDataInitialized.current) return;
    if (discordData?.players) {
      setPlayers(
        makeLobbyPlayers(
          parseLobbyPlayerCount(String(discordData.players.length)),
        ),
      );
    } else if (requestedPlayerCount !== null) {
      setPlayers(makeLobbyPlayers(parseLobbyPlayerCount(requestedPlayerCount)));
    }
    discordDataInitialized.current = true;
  }, [discordData, requestedPlayerCount, setPlayers]);

  // Initialize from seeded map URL param (one-time on mount)
  const seededMapInitialized = useRef(false);
  useEffect(() => {
    if (mapSlicesString && !seededMapInitialized.current) {
      const seededData = decodeSeededMapData(mapSlicesString);
      if (seededData) {
        // Set player count based on slice count
        const sliceCount = seededData.slices.length;
        const currentPlayerCount = player.players.length;
        if (sliceCount !== currentPlayerCount) {
          setPlayers(makeLobbyPlayers(sliceCount));
        }

        // Set map type to selected type from URL, or first compatible type
        const draftTypeToUse =
          selectedDraftType &&
          seededData.compatibleDraftTypes.includes(
            selectedDraftType as ChoosableDraftType,
          )
            ? (selectedDraftType as ChoosableDraftType)
            : seededData.compatibleDraftTypes[0];

        if (draftTypeToUse) {
          map.setSelectedMapType(draftTypeToUse as ChoosableDraftType);
        }

        // Set slice count
        slices.setNumSlices(sliceCount);

        seededMapInitialized.current = true;
      }
    }
  }, [mapSlicesString, selectedDraftType, player, setPlayers, map, slices]);

  const mapType = hoveredMapType ?? map.selectedMapType;
  const playerCount = player.players.length;

  const tileGameSets = useMemo(() => {
    if (draftMode === "twilightFalls") {
      return ["base", "pok", "te"] as const;
    }

    return content.getTileGameSets();
  }, [content, draftMode]);

  const maxSlices = useMemo(
    () =>
      Math.max(
        playerCount,
        getMaxAvailableSlices(
          map.selectedMapType,
          [...tileGameSets],
          !!faction.minorFactionsMode,
        ),
      ),
    [faction.minorFactionsMode, map.selectedMapType, playerCount, tileGameSets],
  );

  const { buildDraftSettings } = useDraftSettingsBuilder(sliceSettings);
  const { navigateToDraft } = useDraftNavigation(discordData);
  const texasSettings: DraftSettings = {
    ...buildDraftSettings(),
    draftGameMode: "texasStyle",
    draftSpeaker: false,
    draftPlayerColors: false,
    allowHomePlanetSearch: false,
    allowEmptyTiles: false,
    modifiers: { banFactions: { numFactions: 1 } },
    texasFactionHandSize: texas.factionHandSize,
    texasAllowFactionRedraw: texas.allowRedraw,
    randomizeMap: false,
    randomizeSlices: false,
  };
  const texasErrors =
    draftMode === "texasStyle"
      ? getTexasSetupErrors(texasSettings, playerCount)
      : [];

  const handlePlayerCountChange = (count: number) => {
    player.setCount(count);
    const next = new URLSearchParams(searchParams);
    next.set("playerCount", String(count));
    next.delete("mapSlices");
    next.delete("draftType");
    setSearchParams(next, { replace: true });
  };

  const handleMapTypeSelect = (mapType: ChoosableDraftType) => {
    // Clear seeded map params from URL when map type changes
    if (searchParams.has("mapSlices")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("mapSlices");
      newParams.delete("draftType");
      setSearchParams(newParams, { replace: true });
    }
    map.setSelectedMapType(mapType);
  };

  const handleDraftModeChange = (value: string | null) => {
    if (!value) return;
    setDraftMode(value as "base" | "twilightFalls" | "texasStyle");
  };

  const handleContinue = () => {
    setSetupError(null);
    if (draftMode === "twilightFalls") {
      try {
        const draftType = map.selectedMapType;
        const presetPacks = parseReferenceCardPacks(
          referenceCardPacks.presetPackages,
        );

        const twilightsFallSettings: DraftSettings = {
          type: draftType,
          nucleusStyle: draftType.startsWith("heisen"),
          numFactions: kings.numKings, // Configurable number of kings
          numKings: kings.numKings,
          allowedFactions: twilightsFallFactionIds.filter(
            (id) => !kings.bannedKings.includes(id),
          ),
          requiredFactions: kings.prioritizedKings,
          factionGameSets: ["twilightsFall"], // Only Mahact Kings faction set
          tileGameSets: ["base", "pok", "te"],
          numSlices: Number(slices.numSlices),
          numReferenceCardPacks:
            presetPacks?.length ?? referenceCardPacks.numReferenceCardPacks,
          bannedReferenceCardFactions: referenceCardPacks.bannedFactions,
          presetReferenceCardPacks: presetPacks,
          randomizeMap: true,
          randomizeSlices: true,
          draftSpeaker: false,
          showMonumentImagesInFactionInfo:
            format.showMonumentImagesInFactionInfo,
          allowHomePlanetSearch: false,
          allowEmptyTiles: false,
          draftPlayerColors: false,
          minorFactionsMode: undefined,
          draftGameMode: "twilightsFall",
        };
        validateTwilightsFallSettings(
          twilightsFallSettings,
          player.players.length,
        );

        navigate("/draft/new", {
          state: {
            draftSettings: twilightsFallSettings,
            players: player.players,
            discordData,
          },
        });
      } catch (error) {
        setSetupError(
          error instanceof Error
            ? error.message
            : "Invalid Twilight's Fall setup.",
        );
      }
    } else if (draftMode === "texasStyle") {
      try {
        const draft = buildTexasDraft({
          settings: texasSettings,
          players: player.players,
          integrations: { discord: discordData },
        });
        submit(draft, {
          method: "POST",
          encType: "application/json",
          action: "/draft/new",
        });
      } catch (error) {
        setSetupError(
          error instanceof Error
            ? error.message
            : "Unable to prepare Texas. Check the selected content and player count.",
        );
      }
    } else {
      // Base draft mode - use normal settings
      const draftSettings = buildDraftSettings();
      navigateToDraft(draftSettings);
    }
  };

  const [
    minorFactionsOpened,
    { open: openMinorFactions, close: closeMinorFactions },
  ] = useDisclosure(false);

  const [savedStateOpened, { open: openSavedState, close: closeSavedState }] =
    useDisclosure(false);

  const [savedStateJson, setSavedStateJson] = useState("");

  const handleContinueFromSavedState = () => {
    setTemplateError(null);
    try {
      const savedState = JSON.parse(savedStateJson);
      if (savedState?.format === "ti4-lobby-save") {
        throw new Error(
          "This is a lobby backup. Rejoin the original lobby and import it from Admin controls to restore progress.",
        );
      }
      if (
        !savedState?.settings ||
        !MAPS[savedState.settings.type as ChoosableDraftType] ||
        !Array.isArray(savedState.players) ||
        savedState.players.length < 3 ||
        savedState.players.length > 8 ||
        !Array.isArray(savedState.slices) ||
        !Array.isArray(savedState.presetMap) ||
        !Array.isArray(savedState.availableFactions)
      ) {
        throw new Error(
          "Paste an exported draft template containing its settings, players, map, slices and faction pool.",
        );
      }
      const savedPlayerCount = savedState.players.length;
      const adjustedPlayers = makeLobbyPlayers(savedPlayerCount);
      const template =
        savedState.settings.draftGameMode === "texasStyle"
          ? buildTexasDraft({
              settings: savedState.settings,
              players: adjustedPlayers,
              integrations: { discord: discordData },
            })
          : savedState;

      navigate("/draft/new", {
        state: {
          savedDraftState: {
            ...template,
            integrations: { discord: discordData },
            players: adjustedPlayers,
            selections: [],
            pickOrder: [],
            stagedSelections: undefined,
            playerFactionPool: undefined,
            bannedFactions: undefined,
          } as Draft,
        },
      });
    } catch (error) {
      setTemplateError(
        error instanceof SyntaxError
          ? "This is not valid JSON. Copy the full exported draft template and try again."
          : error instanceof Error
            ? error.message
            : "Unable to read this draft template.",
      );
    }
  };

  const [
    sliceSettingsOpened,
    { open: openSliceSettings, close: closeSliceSettings },
  ] = useDisclosure(false);

  const handleOpenSettings = (formatType: SliceSettingsFormatType) => {
    setActiveSettingsFormat(formatType);
    openSliceSettings();
  };

  return (
    <>
      <SliceSettingsModal
        opened={sliceSettingsOpened}
        formatType={activeSettingsFormat}
        settings={sliceSettings[activeSettingsFormat]}
        onClose={closeSliceSettings}
        onSave={(newSettings) => {
          setSliceSettings((prev) => ({
            ...prev,
            [activeSettingsFormat]: newSettings,
          }));
        }}
      />

      <SavedStateModal
        opened={savedStateOpened}
        savedStateJson={savedStateJson}
        onClose={closeSavedState}
        onSavedStateChange={setSavedStateJson}
        onContinue={handleContinueFromSavedState}
        error={templateError}
      />

      <MinorFactionsInfoModal
        opened={minorFactionsOpened}
        onClose={closeMinorFactions}
      />

      <div className={classes.grid}>
        <div className={classes.col12}>
          <Title order={1}>Create a draft lobby</Title>
          <Text c="dimmed" mt="xs">
            Prepare the draft, share one link, and start when everyone has
            joined.
          </Text>
        </div>
        <div className={classes.col12}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Paper withBorder radius="md" p="md">
              <LobbyPlayerCount
                count={playerCount}
                onChange={handlePlayerCountChange}
              />
            </Paper>
            <LobbyRecovery />
          </SimpleGrid>
        </div>
        {setupError && (
          <div className={classes.col12}>
            <Alert color="red">{setupError}</Alert>
          </div>
        )}
        <div className={classes.col12}>
          <Group justify="space-between" gap="sm" mb="sm">
            <Text size="sm" c="dimmed">
              Choose a draft format or build the galaxy using the official setup
              rules.
            </Text>
            <Group gap="xs">
              <Button
                component={Link}
                to={`/draft/raw/new?mode=${draftMode === "twilightFalls" ? "twilightsFall" : "base"}&playerCount=${playerCount}`}
                variant="light"
              >
                Rules as written (RAW)
              </Button>
              <Button
                component={Link}
                to={`/draft/bag/new?playerCount=${playerCount}`}
                variant="light"
              >
                Bag / Franken / Twilight’s Fall
              </Button>
              <Button
                component={Link}
                to={`/draft/mantis/new?playerCount=${playerCount}`}
                variant="light"
              >
                Mantis draft
              </Button>
              <Button
                component={Link}
                to={`/draft/minimilty/new?playerCount=${playerCount}`}
                variant="light"
              >
                Mini-Milty (base game)
              </Button>
            </Group>
          </Group>
        </div>
        {mapSlicesString && (
          <div className={classes.col12}>
            <SeededMapBanner />
          </div>
        )}
        {location.state?.invalidDraftParameters && (
          <div className={classes.col12}>
            <Alert
              variant="light"
              color="red"
              title="Invalid Draft Parameters"
              icon={<IconInfoCircle />}
            >
              Could not generate a draft with the given parameters. Please try
              different minimal/total optimal values.
            </Alert>
          </div>
        )}
        <div className={classes.colLeft}>
          <Flex align="center" direction="column">
            <Box w="100%">
              <SectionTitle title="Map layout" />
            </Box>
            <Flex
              w="100%"
              gap="md"
              align="flex-start"
              direction={{ base: "column", xs: "row" }}
            >
              <MapStyleSelector
                playerCount={player.players.length}
                selectedMapType={map.selectedMapType}
                onMapTypeHover={setHoveredMapType}
                onMapTypeSelect={handleMapTypeSelect}
                onOpenSettings={handleOpenSettings}
                onOpenMinorFactionsInfo={openMinorFactions}
              />
              <Box flex={1} w="100%" miw={0} pos="relative" mt="sm">
                <Box
                  flex={1}
                  pos="relative"
                  mah="1000px"
                  mb="lg"
                  visibleFrom="xs"
                >
                  {mapType && (
                    <DemoMap
                      id="prechoice-map"
                      map={MAPS[mapType].map}
                      titles={MAPS[mapType].titles}
                      padding={0}
                    />
                  )}
                </Box>
                <DraftFormatDescription
                  mapType={mapType}
                  data={MAPS[mapType].descriptionData}
                  title={MAPS[mapType].title}
                />
              </Box>
            </Flex>
          </Flex>
        </div>

        <div className={`${classes.col12} ${classes.hiddenFromXs}`}>
          <Box flex={1} pos="relative" mah="1000px" mt="lg">
            {mapType && (
              <DemoMap
                id="prechoice-map"
                map={MAPS[mapType].map}
                titles={MAPS[mapType].titles}
                padding={0}
              />
            )}
          </Box>
        </div>

        <div className={classes.colRight}>
          <Stack>
            <Stack>
              <SectionTitle title="Draft rules" />
              <Tabs
                value={draftMode}
                onChange={handleDraftModeChange}
                variant="pills"
              >
                <Tabs.List mb="md">
                  <Tabs.Tab value="base">Standard</Tabs.Tab>
                  <Tabs.Tab value="twilightFalls">
                    Twilight&apos;s Fall packs
                  </Tabs.Tab>
                  <Tabs.Tab value="texasStyle">Texas Style</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="base">
                  <DraftConfigurationPanel maxSlices={maxSlices} />
                </Tabs.Panel>

                <Tabs.Panel value="twilightFalls">
                  <Stack gap="sm">
                    <Button
                      component={Link}
                      to={`/draft/raw/new?mode=twilightsFall&playerCount=${playerCount}`}
                      variant="light"
                    >
                      Official starting draft and map building (RAW)
                    </Button>
                    <Alert
                      color="blue"
                      title="Simplified Configuration"
                      variant="light"
                    >
                      <Text size="xs">
                        Players pick a &quot;reference card pack&quot; during
                        the snake draft. After drafting, choose home system,
                        faction, and priority from your pack.
                      </Text>
                    </Alert>

                    <div className={classes.twoColGrid}>
                      <SlicesConfigurationSection maxSlices={maxSlices} />
                      <ReferenceCardPacksConfigurationSection />
                    </div>
                    <div className={classes.twoColGrid}>
                      <KingsConfigurationSection />
                    </div>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="texasStyle">
                  <Stack gap="sm">
                    <Alert
                      color="blue"
                      title="Texas Style Draft"
                      variant="light"
                    >
                      <Text size="xs">
                        Randomized seating and speaker, faction bans,
                        simultaneous faction selection, and a pass-based tile
                        draft before the galaxy build.
                      </Text>
                    </Alert>

                    <div className={classes.twoColGrid}>
                      <TexasStyleSettings
                        factionHandSize={texas.factionHandSize}
                        allowRedraw={texas.allowRedraw}
                        onChangeHandSize={texas.setFactionHandSize}
                        onToggleRedraw={texas.setAllowRedraw}
                      />
                    </div>
                    <ContentPacksSection />
                    {texasErrors.length > 0 && (
                      <Alert
                        color="orange"
                        title="Adjust the Texas pool"
                        role="alert"
                      >
                        <Stack gap="xs">
                          {texasErrors.map((error) => (
                            <Text size="sm" key={error}>
                              {error}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>

            <Button
              size="lg"
              onClick={handleContinue}
              leftSection={<IconPlayerPlay />}
              className={buttonClasses.primaryCta}
              loading={navigation.state !== "idle"}
              disabled={texasErrors.length > 0}
            >
              {draftMode === "texasStyle"
                ? "Create shared lobby"
                : draftMode === "base" && multidraft.isMultidraft
                  ? `Create ${multidraft.numDrafts} lobbies`
                  : "Preview draft"}
            </Button>
            <Group>
              <Button
                size="md"
                flex={1}
                onClick={openSavedState}
                variant="outline"
                color="purple.3"
                leftSection={<IconFile />}
              >
                Use a draft template
              </Button>
            </Group>
          </Stack>
        </div>
      </div>
    </>
  );
}

export const loader = async (args: LoaderFunctionArgs) => {
  let discordData: DiscordData | undefined;
  const discordString = new URL(args.request.url).searchParams.get("discord");

  if (discordString) {
    discordData = JSON.parse(atob(discordString)) as DiscordData;
  }

  // Parse seeded map data from URL param
  const mapSlicesString = new URL(args.request.url).searchParams.get(
    "mapSlices",
  );

  // Parse selected draft type from URL param
  const selectedDraftType = new URL(args.request.url).searchParams.get(
    "draftType",
  );

  return {
    discordData,
    mapSlicesString,
    selectedDraftType,
  };
};

type TexasStyleSettingsProps = {
  factionHandSize: number;
  allowRedraw: boolean;
  onChangeHandSize: (num: number) => void;
  onToggleRedraw: (v: boolean) => void;
};

function TexasStyleSettings({
  factionHandSize,
  allowRedraw,
  onChangeHandSize,
  onToggleRedraw,
}: TexasStyleSettingsProps) {
  return (
    <Stack gap="sm">
      <NumberInput
        label="Factions dealt per player"
        description="Deal 2 or 3 factions to each player before selection."
        min={2}
        max={3}
        value={factionHandSize}
        onChange={(value) => onChangeHandSize(Number(value) || 2)}
      />
      <Switch
        label="Allow redraw"
        description="Players can return their dealt factions and draw one they must play."
        checked={allowRedraw}
        onChange={(event) => onToggleRedraw(event.currentTarget.checked)}
      />
    </Stack>
  );
}
