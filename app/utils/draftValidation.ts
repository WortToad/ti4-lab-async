import { draftConfig } from "~/draft/draftConfig";
import { validateTwilightsFallDraft } from "~/draft/twilightsFall/pools";
import type { Draft, PlayerSelection } from "~/types";
import { hydrateMap } from "./map";
import { getTexasSetupErrors } from "~/draft/texas/validation";
import { getFactionSourceValidationErrors } from "./factionSourceValidation";
import { canCompleteFactionDraft } from "~/draft/factionFeasibility";

export function getMinimumFactionCount(
  draft: Pick<Draft, "settings" | "players">,
) {
  const { settings, players } = draft;
  const factionsPerPlayer = Math.max(
    1,
    settings.minorFactionsInSharedPool ? 2 : 1,
    settings.numPreassignedFactions ?? 1,
  );
  return Math.max(
    players.length * factionsPerPlayer,
    new Set(settings.requiredFactions ?? []).size,
  );
}

export function getDraftValidationErrors(draft: Omit<Draft, "pickOrder">) {
  const { settings, players, slices, presetMap } = draft;
  const errors: string[] = [];
  if (settings.draftGameMode === "twilightsFall") {
    try {
      validateTwilightsFallDraft(draft);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Invalid Twilight's Fall pools.",
      );
    }
  }
  if (settings.draftGameMode === "texasStyle")
    return getTexasSetupErrors(
      settings,
      players.length,
      draft.availableFactions,
    );

  errors.push(...getFactionSourceValidationErrors(draft));
  const minimumFactions = getMinimumFactionCount(draft);
  const availableCount = new Set(draft.availableFactions).size;
  if (!canCompleteFactionDraft({ ...draft, selections: [] }))
    errors.push(
      "The faction pools cannot fill every main and minor pick while leaving a home for Keleres. Increase the faction pool or change the available factions; Keleres cannot be a minor faction.",
    );
  if (
    settings.numFactions < minimumFactions ||
    availableCount < minimumFactions
  ) {
    errors.push(
      `This draft needs at least ${minimumFactions} factions; the pool contains ${availableCount}. Adjust the pool or faction settings.`,
    );
  }

  if (
    settings.numMinorFactions !== undefined &&
    new Set(
      (draft.availableMinorFactions ?? []).filter((id) => id !== "keleres"),
    ).size < players.length
  ) {
    errors.push(
      `The minor faction pool needs at least ${players.length} factions, one for each player.`,
    );
  }

  if (
    settings.draftGameMode !== "presetMap" &&
    slices.length < players.length
  ) {
    errors.push("The slice pool needs at least one slice for each player.");
  }
  slices.forEach((slice) => {
    if (slice.tiles.some((tile) => tile.type === "OPEN")) {
      errors.push(`${slice.name} has empty tiles`);
    }
  });

  const selections: PlayerSelection[] = players.map((player, index) => ({
    playerId: player.id,
    seatIdx: index,
    sliceIdx: index,
  }));
  const hydratedMap = hydrateMap(
    draftConfig[settings.type],
    presetMap,
    slices,
    selections,
  );
  if (
    !settings.allowEmptyTiles &&
    hydratedMap.some((tile) => tile.type === "OPEN")
  ) {
    errors.push("Map has empty tiles");
  }
  return errors;
}
