import { draftConfig } from "~/draft/draftConfig";
import { shuffle } from "~/draft/helpers/randomization";
import { buildTexasDraft } from "~/draft/texas/buildTexasDraft";
import {
  generateReferenceCardPacks,
  generateTwilightsFallKings,
} from "~/draft/twilightsFall/pools";
import { getRandomSliceNames } from "~/data/sliceWords";
import {
  getDraftableFactions,
  initializeMap,
  initializeSlices,
  randomizeFactions,
} from "~/draftStore";
import type { DiscordData, Draft, DraftSettings, Player } from "~/types";
import { createDraftOrder } from "~/utils/draftOrder.server";
import { getDraftValidationErrors } from "~/utils/draftValidation";
import { getFactionPool } from "~/utils/factions";
import { getSystemPool } from "~/utils/system";
import { systemIdsToSlices } from "~/utils/slice";

export function prepareMultidraftDraft(
  settingsInput: DraftSettings,
  playersInput: Player[],
  discordData?: DiscordData,
): Draft {
  const settings = structuredClone(settingsInput);
  const players = structuredClone(playersInput);
  const integrations = { discord: discordData && structuredClone(discordData) };
  const config = draftConfig[settings.type];
  if (!config || config.numPlayers !== players.length)
    throw new Error("Choose a map layout that matches the number of players.");
  let prepared: Omit<Draft, "pickOrder">;
  if (settings.draftGameMode === "texasStyle") {
    prepared = buildTexasDraft({ settings, players, integrations });
  } else {
    const factionPool = getFactionPool(settings.factionGameSets);
    const systemPool = getSystemPool(settings.tileGameSets);
    const availableFactions =
      settings.draftGameMode === "twilightsFall"
        ? generateTwilightsFallKings(settings, players.length)
        : randomizeFactions(
            settings.numFactions,
            getDraftableFactions(factionPool, null, settings.allowedFactions),
            settings.requiredFactions,
            settings.factionStratification,
          );
    const minorFactionPool = getDraftableFactions(
      factionPool,
      availableFactions,
    );
    const availableMinorFactions =
      settings.numMinorFactions === undefined
        ? undefined
        : shuffle(minorFactionPool, settings.numMinorFactions);
    let slices: Draft["slices"];
    let presetMap: Draft["presetMap"];
    if (settings.draftGameMode === "presetMap" && settings.presetMap) {
      slices = [];
      presetMap = settings.presetMap;
    } else if (settings.presetSlices && settings.presetMap) {
      slices = systemIdsToSlices(
        config,
        settings.presetSlices,
        settings.sliceGenerationConfig?.sliceValueModifiers,
      );
      presetMap = settings.presetMap;
    } else if (config.generateMap) {
      const generated = config.generateMap(
        settings,
        systemPool,
        minorFactionPool,
      );
      if (!generated)
        throw new Error(
          "The selected tiles cannot produce a valid map with these slice settings. Enable more tile sets, reduce the slice count, or relax the slice limits.",
        );
      slices = systemIdsToSlices(
        config,
        generated.slices,
        settings.sliceGenerationConfig?.sliceValueModifiers,
      );
      presetMap = generated.map;
    } else {
      const generatedSlices = initializeSlices(settings, systemPool);
      if (!generatedSlices)
        throw new Error(
          "The selected tiles cannot produce the requested slices. Enable more tile sets, reduce the slice count, or relax the slice limits.",
        );
      slices = generatedSlices;
      presetMap = initializeMap(settings, slices, systemPool);
    }
    const names = getRandomSliceNames(slices.length);
    slices.forEach((slice, idx) => {
      slice.name = `Slice ${names[idx]}`;
    });
    prepared = {
      settings,
      players,
      integrations,
      availableFactions,
      availableMinorFactions,
      availableReferenceCardPacks:
        settings.draftGameMode === "twilightsFall"
          ? generateReferenceCardPacks(settings, players.length)
          : undefined,
      slices,
      presetMap,
      selections: [],
    };
  }
  const errors = getDraftValidationErrors(prepared);
  if (errors.length) throw new Error(errors.join(" "));
  const draft = {
    ...prepared,
    ...createDraftOrder({
      players,
      settings,
      availableFactions: prepared.availableFactions,
      presetMap: prepared.presetMap,
      texasDraft: prepared.texasDraft,
      slices: prepared.slices,
      availableMinorFactions: prepared.availableMinorFactions,
    }),
  };
  const dealtErrors = getDraftValidationErrors(draft);
  if (dealtErrors.length) throw new Error(dealtErrors.join(" "));
  return draft;
}

export function prepareMultidraft(
  settings: DraftSettings,
  players: Player[],
  numDrafts: number,
  discordData?: DiscordData,
): Draft[] {
  if (!Number.isInteger(numDrafts) || numDrafts < 2 || numDrafts > 9)
    throw new Error("Choose between 2 and 9 lobbies.");
  if (
    !Array.isArray(players) ||
    players.length < 3 ||
    players.length > 8 ||
    players.some(
      (player) =>
        !Number.isInteger(player.id) || typeof player.name !== "string",
    ) ||
    new Set(players.map((player) => player.id)).size !== players.length
  )
    throw new Error("Choose between 3 and 8 players with distinct player IDs.");
  if (!settings || !draftConfig[settings.type])
    throw new Error("Choose a supported draft format.");
  return Array.from({ length: numDrafts }, (_, index) => {
    try {
      return prepareMultidraftDraft(settings, players, discordData);
    } catch (error) {
      throw new Error(
        `Lobby ${index + 1} could not be prepared. ${error instanceof Error ? error.message : "Check the selected content and draft settings."}`,
      );
    }
  });
}
