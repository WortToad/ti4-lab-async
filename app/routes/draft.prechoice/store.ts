import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  Player,
  GameSet,
  FactionId,
  FactionStratification,
  MinorFactionsMode,
} from "~/types";
import { getFactionCount } from "~/data/factionData";
import { MAPS, mapForPlayerCount, type ChoosableDraftType } from "./maps";
import { makeLobbyPlayers } from "~/draft/lobbySetup";
import { getFactionPool } from "~/utils/factions";
import { notifications } from "@mantine/notifications";
import {
  validateFactionState,
  calculateFactionConstraints,
  FACTION_DEFAULTS,
  type FactionConstraints,
  type FactionNotification,
} from "./validation";
import { filterFactionList, getMaxAvailableSlices } from "./utils";
import { referenceCardFactionPool } from "~/draft/twilightsFall/pools";

type ContentFlags = {
  // Base game
  withBaseTiles: boolean;
  withBaseFactions: boolean;
  // Prophecy of Kings
  withPokTiles: boolean;
  withPokFactions: boolean;
  // Thunder's Edge
  withTETiles: boolean;
  withTEFactions: boolean;
  // Discordant Stars
  withDiscordantTiles: boolean;
  withDiscordantFactions: boolean;
  // Legacy flags for compatibility
  excludeBaseFactions: boolean;
  excludePokFactions: boolean;
  withDiscordant: boolean;
  withDiscordantExp: boolean;
  withUnchartedStars: boolean;
  withDrahn: boolean;
  withTE: boolean;
};

const showFactionNotifications = (notifs: FactionNotification[]) => {
  if (notifs.length === 0) return;

  const message = notifs.map((n) => n.message).join("\n");
  notifications.show({
    message,
    color: "blue",
  });
};

export type DraftMode = "base" | "twilightFalls" | "texasStyle";

type DraftSetupStore = {
  draftMode: DraftMode;
  setDraftMode: (mode: DraftMode) => void;
  validateSetup: () => void;
  player: {
    players: Player[];
    setCount: (count: number) => void;
    setPlayers: (players: Player[]) => void;
  };
  map: {
    selectedMapType: ChoosableDraftType;
    setSelectedMapType: (mapType: ChoosableDraftType) => void;
  };
  slices: {
    numSlices: number;
    setNumSlices: (num: number) => void;
  };
  referenceCardPacks: {
    numReferenceCardPacks: number;
    setNumReferenceCardPacks: (num: number) => void;
    bannedFactions: FactionId[];
    setBannedFactions: (factions: FactionId[]) => void;
    presetPackages: string;
    setPresetPackages: (value: string) => void;
  };
  kings: {
    numKings: number;
    setNumKings: (num: number) => void;
    bannedKings: FactionId[];
    prioritizedKings: FactionId[];
    setBannedKings: (kings: FactionId[]) => void;
    setPrioritizedKings: (kings: FactionId[]) => void;
  };
  texas: {
    factionHandSize: number;
    allowRedraw: boolean;
    setFactionHandSize: (num: number) => void;
    setAllowRedraw: (v: boolean) => void;
  };
  content: {
    flags: ContentFlags;
    // New granular setters
    setWithBaseTiles: (v: boolean) => void;
    setWithBaseFactions: (v: boolean) => void;
    setWithPokTiles: (v: boolean) => void;
    setWithPokFactions: (v: boolean) => void;
    setWithTETiles: (v: boolean) => void;
    setWithTEFactions: (v: boolean) => void;
    setWithDiscordantTiles: (v: boolean) => void;
    setWithDiscordantFactions: (v: boolean) => void;
    // Legacy setters (kept for compatibility)
    setExcludeBaseFactions: (v: boolean) => void;
    setExcludePokFactions: (v: boolean) => void;
    setWithDiscordantExp: (v: boolean) => void;
    setWithUnchartedStars: (v: boolean) => void;
    setWithDrahn: (v: boolean) => void;
    setWithTE: (v: boolean) => void;
    toggleDiscordantStars: () => void;
    getTileGameSets: () => GameSet[];
    getFactionGameSets: () => GameSet[];
  };
  format: {
    draftSpeaker: boolean;
    banFactions: boolean;
    draftPlayerColors: boolean;
    allowEmptyTiles: boolean;
    allowHomePlanetSearch: boolean;
    showMonumentImagesInFactionInfo: boolean;
    setDraftSpeaker: (v: boolean) => void;
    setBanFactions: (v: boolean) => void;
    setDraftPlayerColors: (v: boolean) => void;
    setAllowEmptyTiles: (v: boolean) => void;
    setAllowHomePlanetSearch: (v: boolean) => void;
    setShowMonumentImagesInFactionInfo: (v: boolean) => void;
  };
  multidraft: {
    isMultidraft: boolean;
    numDrafts: number;
    setIsMultidraft: (v: boolean) => void;
    setNumDrafts: (num: number) => void;
  };
  faction: {
    numFactions: number;
    minorFactionsMode: MinorFactionsMode | undefined;
    preassignedFactions: number | undefined;
    allowedFactions: FactionId[] | undefined;
    requiredFactions: FactionId[] | undefined;
    stratifiedConfig: FactionStratification | undefined;

    setNumFactions: (num: number) => void;
    incrementNumFactions: () => void;
    decrementNumFactions: () => void;
    toggleMinorFactions: () => void;
    setMinorFactionsMode: (mode: "random" | "shared" | "separate") => void;
    incrementMinorFactions: () => void;
    decrementMinorFactions: () => void;
    togglePreassignedFactions: () => void;
    incrementPreassignedFactions: (increment?: number) => void;
    decrementPreassignedFactions: (decrement?: number) => void;
    resetSettings: () => void;
    setStratification: (
      allowed: FactionId[] | undefined,
      required: FactionId[] | undefined,
      stratified: FactionStratification | undefined,
    ) => void;

    getMaxFactionCount: () => number;
    getFactionConstraints: () => FactionConstraints;
    getFactionBudget: () => {
      maxAvailable: number;
      usedByRegular: number;
      usedByMinor: number;
      remaining: number;
    };
  };
};

export const useDraftSetup = create<DraftSetupStore>()(
  immer((set, get) => {
    const getCurrentTileGameSets = (state: DraftSetupStore): GameSet[] => {
      if (state.draftMode === "twilightFalls") {
        return ["base", "pok", "te"];
      }

      return get().content.getTileGameSets();
    };

    const applyFactionValidation = () => {
      set((state) => {
        const playerCount = state.player.players.length;
        const maxFactionCount = getFactionCount(
          get().content.getFactionGameSets(),
        );
        const currentGameSets = get().content.getFactionGameSets();

        const result = validateFactionState(
          playerCount,
          maxFactionCount,
          currentGameSets,
          {
            numFactions: state.faction.numFactions,
            minorFactionsMode: state.faction.minorFactionsMode,
            preassignedFactions: state.faction.preassignedFactions,
            stratifiedConfig: state.faction.stratifiedConfig,
          },
        );

        state.faction.numFactions = result.numFactions;
        state.faction.stratifiedConfig = result.stratifiedConfig;
        state.faction.preassignedFactions = result.preassignedFactions;
        state.faction.minorFactionsMode = result.minorFactionsMode;

        if (result.notifications.length > 0) {
          showFactionNotifications(result.notifications);
        }
      });
    };

    const setAndValidate = (fn: (state: DraftSetupStore) => void) => {
      set(fn);
      get().validateSetup();
    };

    return {
      draftMode: "base" as DraftMode,

      setDraftMode: (mode: DraftMode) =>
        setAndValidate((state) => {
          state.draftMode = mode;

          // When switching to Twilight's Fall, set reference card packs to player count
          if (mode === "twilightFalls") {
            const playerCount = state.player.players.length;
            state.referenceCardPacks.numReferenceCardPacks = playerCount;
            // Default to all 8 kings
            state.kings.numKings = 8;
          }
        }),

      validateSetup: () => {
        set((state) => {
          const playerCount = state.player.players.length;

          if (state.slices.numSlices < playerCount) {
            state.slices.numSlices = playerCount;
          }

          // Update reference card packs default to player count if it's less
          if (state.referenceCardPacks.numReferenceCardPacks < playerCount) {
            state.referenceCardPacks.numReferenceCardPacks = playerCount;
          }
          const maxReferencePacks = Math.floor(
            (referenceCardFactionPool.length -
              state.referenceCardPacks.bannedFactions.length) /
              3,
          );
          if (
            state.referenceCardPacks.numReferenceCardPacks > maxReferencePacks
          ) {
            state.referenceCardPacks.numReferenceCardPacks = Math.max(
              playerCount,
              maxReferencePacks,
            );
          }

          // Update kings to at least player count
          if (state.kings.numKings < playerCount) {
            state.kings.numKings = playerCount;
          }
          const maxKings = 8 - state.kings.bannedKings.length;
          if (state.kings.numKings > maxKings) {
            state.kings.numKings = Math.max(playerCount, maxKings);
          }

          const currentMap = MAPS[state.map.selectedMapType];
          if (currentMap && currentMap.playerCount !== playerCount) {
            const newMapType = mapForPlayerCount(
              state.map.selectedMapType,
              playerCount,
            );

            state.map.selectedMapType = newMapType;

            state.format.allowEmptyTiles = false;
            state.format.allowHomePlanetSearch = false;
            state.format.draftSpeaker = newMapType.startsWith("heisen");
          }

          const maxSlices = Math.max(
            playerCount,
            getMaxAvailableSlices(
              state.map.selectedMapType,
              getCurrentTileGameSets(state),
              !!state.faction.minorFactionsMode,
            ),
          );

          if (state.slices.numSlices > maxSlices) {
            state.slices.numSlices = maxSlices;
          }

          const currentFactionPool = getFactionPool(
            get().content.getFactionGameSets(),
          );
          state.faction.allowedFactions = filterFactionList(
            state.faction.allowedFactions,
            currentFactionPool,
          );
          state.faction.requiredFactions = filterFactionList(
            state.faction.requiredFactions,
            currentFactionPool,
          );
        });

        applyFactionValidation();
      },

      player: {
        players: makeLobbyPlayers(6),
        setCount: (count: number) => {
          if (!Number.isInteger(count) || count < 3 || count > 8) return;
          setAndValidate((state) => {
            state.player.players = makeLobbyPlayers(count);
          });
        },

        setPlayers: (players: Player[]) =>
          setAndValidate((state) => {
            state.player.players = players;
          }),
      },

      map: {
        selectedMapType: "milty",

        setSelectedMapType: (mapType: ChoosableDraftType) => {
          setAndValidate((state) => {
            state.map.selectedMapType = mapType;

            // Reset all faction-related settings when map type changes
            const playerCount = state.player.players.length;
            state.faction.numFactions = playerCount;
            state.faction.minorFactionsMode = undefined;
            state.faction.preassignedFactions = undefined;
            state.faction.stratifiedConfig = undefined;

            // Side effects when map type changes
            state.format.allowEmptyTiles = false;
            state.format.allowHomePlanetSearch = false;
            state.format.draftSpeaker = mapType.startsWith("heisen");
          });
        },
      },

      slices: {
        numSlices: 6,

        setNumSlices: (num: number) => {
          setAndValidate((state) => {
            state.slices.numSlices = num;
          });
        },
      },

      referenceCardPacks: {
        numReferenceCardPacks: 6, // Default to player count, will be updated in validateSetup
        bannedFactions: [],
        presetPackages: "",
        setBannedFactions: (factions) =>
          setAndValidate((state) => {
            state.referenceCardPacks.bannedFactions = factions;
          }),
        setPresetPackages: (value) =>
          set((state) => {
            state.referenceCardPacks.presetPackages = value;
          }),

        setNumReferenceCardPacks: (num: number) => {
          set((state) => {
            const playerCount = state.player.players.length;
            const maxPacks = Math.floor(
              (referenceCardFactionPool.length -
                state.referenceCardPacks.bannedFactions.length) /
                3,
            );
            state.referenceCardPacks.numReferenceCardPacks = Math.max(
              playerCount,
              Math.min(maxPacks, num),
            );
          });
        },
      },

      kings: {
        numKings: 8, // Default to all 8 kings
        bannedKings: [],
        prioritizedKings: [],
        setBannedKings: (kings) =>
          setAndValidate((state) => {
            state.kings.bannedKings = kings;
            state.kings.prioritizedKings = state.kings.prioritizedKings.filter(
              (id) => !kings.includes(id),
            );
          }),
        setPrioritizedKings: (kings) =>
          set((state) => {
            state.kings.prioritizedKings = kings;
            state.kings.numKings = Math.max(state.kings.numKings, kings.length);
          }),

        setNumKings: (num: number) => {
          set((state) => {
            const playerCount = state.player.players.length;
            state.kings.numKings = Math.max(
              playerCount,
              state.kings.prioritizedKings.length,
              Math.min(8 - state.kings.bannedKings.length, num),
            );
          });
        },
      },

      texas: {
        factionHandSize: 2,
        allowRedraw: true,

        setFactionHandSize: (num: number) => {
          set((state) => {
            state.texas.factionHandSize = Math.max(2, Math.min(3, num));
          });
        },

        setAllowRedraw: (v: boolean) => {
          set((state) => {
            state.texas.allowRedraw = v;
          });
        },
      },

      content: {
        flags: {
          // New granular flags - default everything ON except Discordant
          withBaseTiles: true,
          withBaseFactions: true,
          withPokTiles: true,
          withPokFactions: true,
          withTETiles: true,
          withTEFactions: true,
          withDiscordantTiles: false,
          withDiscordantFactions: false,
          // Legacy flags
          excludeBaseFactions: false,
          excludePokFactions: false,
          withDiscordant: false,
          withDiscordantExp: false,
          withUnchartedStars: false,
          withDrahn: false,
          withTE: true, // TE on by default now
        },

        // New granular setters
        setWithBaseTiles: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withBaseTiles = v;
          });
        },

        setWithBaseFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withBaseFactions = v;
            state.content.flags.excludeBaseFactions = !v;
          });
        },

        setWithPokTiles: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withPokTiles = v;
          });
        },

        setWithPokFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withPokFactions = v;
            state.content.flags.excludePokFactions = !v;
          });
        },

        setWithTETiles: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withTETiles = v;
            // Sync legacy flag
            if (!v && !state.content.flags.withTEFactions) {
              state.content.flags.withTE = false;
            } else if (v) {
              state.content.flags.withTE = true;
            }
          });
        },

        setWithTEFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withTEFactions = v;
            // Sync legacy flag
            if (!v && !state.content.flags.withTETiles) {
              state.content.flags.withTE = false;
            } else if (v) {
              state.content.flags.withTE = true;
            }
          });
        },

        setWithDiscordantTiles: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withDiscordantTiles = v;
            // Sync legacy flags
            state.content.flags.withDiscordant =
              v || state.content.flags.withDiscordantFactions;
            state.content.flags.withDiscordantExp =
              v || state.content.flags.withDiscordantFactions;
            state.content.flags.withUnchartedStars =
              v || state.content.flags.withDiscordantFactions;
          });
        },

        setWithDiscordantFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withDiscordantFactions = v;
            // Sync legacy flags
            state.content.flags.withDiscordant =
              v || state.content.flags.withDiscordantTiles;
            state.content.flags.withDiscordantExp =
              v || state.content.flags.withDiscordantTiles;
          });
        },

        // Legacy setters
        setExcludeBaseFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.excludeBaseFactions = v;
            state.content.flags.withBaseFactions = !v;
          });
        },

        setExcludePokFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.excludePokFactions = v;
            state.content.flags.withPokFactions = !v;
          });
        },

        setWithDiscordantExp: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withDiscordantExp = v;
          });
        },

        setWithUnchartedStars: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withUnchartedStars = v;
          });
        },

        setWithDrahn: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withDrahn = v;
          });
        },

        setWithTE: (v: boolean) => {
          setAndValidate((state) => {
            state.content.flags.withTE = v;
            state.content.flags.withTETiles = v;
            state.content.flags.withTEFactions = v;
          });
        },

        toggleDiscordantStars: () => {
          setAndValidate((state) => {
            const newValue = !state.content.flags.withDiscordant;
            state.content.flags.withDiscordant = newValue;
            state.content.flags.withDiscordantTiles = newValue;
            state.content.flags.withDiscordantFactions = newValue;

            // Update dependent flags based on withDiscordant state
            if (newValue) {
              // When discordant is on, enable dependent flags
              state.content.flags.withDiscordantExp = true;
              state.content.flags.withUnchartedStars = true;
            } else {
              // When discordant is off, dependent flags must be off
              state.content.flags.withDiscordantExp = false;
              state.content.flags.withUnchartedStars = false;
              state.content.flags.excludeBaseFactions = false;
              state.content.flags.excludePokFactions = false;
            }
          });
        },

        getTileGameSets: () => {
          const { flags } = get().content;
          const tileGameSets: GameSet[] = [];
          // Use new granular flags
          if (flags.withBaseTiles) tileGameSets.push("base");
          if (flags.withPokTiles) tileGameSets.push("pok");
          if (flags.withTETiles) tileGameSets.push("te");
          if (flags.withDiscordantTiles) {
            tileGameSets.push("discordant");
            if (flags.withDiscordantExp) tileGameSets.push("discordantexp");
            if (flags.withUnchartedStars) tileGameSets.push("unchartedstars");
          }
          return tileGameSets;
        },

        getFactionGameSets: () => {
          const { flags } = get().content;
          const factionGameSets: GameSet[] = [];
          // Use new granular flags
          if (flags.withBaseFactions) factionGameSets.push("base");
          if (flags.withPokFactions) factionGameSets.push("pok");
          if (flags.withTEFactions) factionGameSets.push("te");
          if (flags.withDiscordantFactions) {
            factionGameSets.push("discordant");
            if (flags.withDiscordantExp) factionGameSets.push("discordantexp");
          }
          if (flags.withDrahn) factionGameSets.push("drahn");
          return factionGameSets;
        },
      },

      format: {
        draftSpeaker: false,
        banFactions: false,
        draftPlayerColors: false,
        allowEmptyTiles: false,
        allowHomePlanetSearch: false,
        showMonumentImagesInFactionInfo: false,

        setDraftSpeaker: (v: boolean) => {
          setAndValidate((state) => {
            state.format.draftSpeaker = v;
          });
        },

        setBanFactions: (v: boolean) => {
          setAndValidate((state) => {
            state.format.banFactions = v;
          });
        },

        setDraftPlayerColors: (v: boolean) => {
          setAndValidate((state) => {
            state.format.draftPlayerColors = v;
          });
        },

        setAllowEmptyTiles: (v: boolean) => {
          setAndValidate((state) => {
            state.format.allowEmptyTiles = v;
          });
        },

        setAllowHomePlanetSearch: (v: boolean) => {
          setAndValidate((state) => {
            state.format.allowHomePlanetSearch = v;
          });
        },

        setShowMonumentImagesInFactionInfo: (v: boolean) => {
          setAndValidate((state) => {
            state.format.showMonumentImagesInFactionInfo = v;
          });
        },
      },

      multidraft: {
        isMultidraft: false,
        numDrafts: 2,

        setIsMultidraft: (v: boolean) => {
          setAndValidate((state) => {
            state.multidraft.isMultidraft = v;
          });
        },

        setNumDrafts: (num: number) => {
          setAndValidate((state) => {
            state.multidraft.numDrafts = num;
          });
        },
      },

      faction: {
        // Initial state - start with 6 players worth of factions
        numFactions: 6,
        minorFactionsMode: undefined,
        preassignedFactions: undefined,
        allowedFactions: undefined,
        requiredFactions: undefined,
        stratifiedConfig: undefined,

        // Computed getters
        getMaxFactionCount: () => {
          const factionGameSets = get().content.getFactionGameSets();
          return getFactionCount(factionGameSets);
        },

        getFactionConstraints: () => {
          const playerCount = get().player.players.length;
          const maxFactionCount = get().faction.getMaxFactionCount();
          const {
            numFactions,
            minorFactionsMode,
            preassignedFactions,
            stratifiedConfig,
          } = get().faction;

          return calculateFactionConstraints(
            playerCount,
            maxFactionCount,
            {
              numFactions,
              minorFactionsMode,
              preassignedFactions,
            },
            stratifiedConfig,
          );
        },

        getFactionBudget: () => {
          const { numFactions, minorFactionsMode } = get().faction;
          const maxAvailable = get().faction.getMaxFactionCount();
          const usedByMinor =
            minorFactionsMode?.mode === "separatePool"
              ? minorFactionsMode.numMinorFactions
              : 0;
          const usedByRegular = numFactions;
          const remaining = maxAvailable - usedByRegular - usedByMinor;

          return {
            maxAvailable,
            usedByRegular,
            usedByMinor,
            remaining,
          };
        },

        // Helper to apply constraints to numFactions
        applyConstraints: (targetNumFactions: number) => {
          const constraints = get().faction.getFactionConstraints();
          return Math.min(
            Math.max(targetNumFactions, constraints.minNumFactions),
            constraints.maxNumFactions,
          );
        },

        setNumFactions: (num: number) => {
          setAndValidate((state) => {
            // Only allow manual adjustment if not locked
            const constraints = get().faction.getFactionConstraints();
            if (constraints.canManuallyAdjust) {
              state.faction.numFactions = num;
            }
          });
        },

        incrementNumFactions: () => {
          setAndValidate((state) => {
            const constraints = get().faction.getFactionConstraints();
            // Only increment if can manually adjust and not at max
            if (
              constraints.canManuallyAdjust &&
              state.faction.numFactions < constraints.maxNumFactions
            ) {
              state.faction.numFactions += 1;
            }
          });
        },

        decrementNumFactions: () => {
          setAndValidate((state) => {
            const constraints = get().faction.getFactionConstraints();
            // Only decrement if can manually adjust and not at min
            if (
              constraints.canManuallyAdjust &&
              state.faction.numFactions > constraints.minNumFactions
            ) {
              state.faction.numFactions -= 1;
            }
          });
        },

        toggleMinorFactions: () => {
          setAndValidate((state) => {
            if (!state.faction.minorFactionsMode) {
              // Turning on minor factions
              state.faction.minorFactionsMode = { mode: "random" };
              state.format.allowEmptyTiles = true;
            } else {
              // Turning off minor factions
              state.faction.minorFactionsMode = undefined;
              state.format.allowEmptyTiles = false;
            }
          });
        },

        setMinorFactionsMode: (mode: "random" | "shared" | "separate") => {
          setAndValidate((state) => {
            const playerCount = state.player.players.length;

            switch (mode) {
              case "random":
                state.faction.minorFactionsMode = { mode: "random" };
                state.format.allowEmptyTiles = true;
                break;
              case "shared":
                state.faction.minorFactionsMode = { mode: "sharedPool" };
                // numFactions will be set by validation
                break;
              case "separate":
                state.faction.minorFactionsMode = {
                  mode: "separatePool",
                  numMinorFactions: playerCount,
                };
                state.format.allowEmptyTiles = true;
                break;
            }
          });
        },

        incrementMinorFactions: () => {
          setAndValidate((state) => {
            if (state.faction.minorFactionsMode?.mode === "separatePool") {
              const constraints = get().faction.getFactionConstraints();
              if (
                state.faction.minorFactionsMode.numMinorFactions <
                constraints.maxMinorFactions
              ) {
                state.faction.minorFactionsMode.numMinorFactions += 1;
              }
            }
          });
        },

        decrementMinorFactions: () => {
          setAndValidate((state) => {
            if (state.faction.minorFactionsMode?.mode === "separatePool") {
              const constraints = get().faction.getFactionConstraints();
              if (
                state.faction.minorFactionsMode.numMinorFactions >
                constraints.minMinorFactions
              ) {
                state.faction.minorFactionsMode.numMinorFactions -= 1;
              }
            }
          });
        },

        togglePreassignedFactions: () => {
          setAndValidate((state) => {
            if (state.faction.preassignedFactions === undefined) {
              state.faction.preassignedFactions =
                FACTION_DEFAULTS.DEFAULT_PREASSIGNED;
            } else {
              state.faction.preassignedFactions = undefined;
            }
          });
        },

        incrementPreassignedFactions: (increment = 1) => {
          setAndValidate((state) => {
            if (state.faction.preassignedFactions !== undefined) {
              const constraints = get().faction.getFactionConstraints();
              const newValue = Math.min(
                state.faction.preassignedFactions + increment,
                constraints.maxPreassignedFactions,
              );
              state.faction.preassignedFactions = newValue;
            }
          });
        },

        decrementPreassignedFactions: (decrement = 1) => {
          setAndValidate((state) => {
            if (state.faction.preassignedFactions !== undefined) {
              const constraints = get().faction.getFactionConstraints();
              const newValue = Math.max(
                state.faction.preassignedFactions - decrement,
                constraints.minPreassignedFactions,
              );
              state.faction.preassignedFactions = newValue;
            }
          });
        },

        resetSettings: () => {
          setAndValidate((state) => {
            const playerCount = state.player.players.length;
            state.faction.numFactions = playerCount;
            state.faction.minorFactionsMode = undefined;
            state.faction.preassignedFactions = undefined;
          });
        },

        setStratification: (allowed, required, stratified) => {
          setAndValidate((state) => {
            state.faction.allowedFactions = allowed;
            state.faction.requiredFactions = required;
            state.faction.stratifiedConfig = stratified;
          });
        },
      },
    };
  }),
);
