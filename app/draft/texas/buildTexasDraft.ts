import { draftConfig } from "~/draft/draftConfig";
import { generateEmptyMap } from "~/utils/map";
import { getSystemPool } from "~/utils/system";
import { getTexasFactionPool, getTexasSetupErrors } from "./validation";
import {
  createTexasSeatAssignments,
  dealTexasFactionOptions,
  dealTexasTiles,
} from "~/draft/texas/texasDraft";
import type { Draft, DraftSettings, Player, DraftIntegrations } from "~/types";

type BuildTexasDraftInput = {
  settings: DraftSettings;
  players: Player[];
  integrations: DraftIntegrations;
};

/**
 * Build a complete Texas style draft object ready for submission to the server.
 * This allows prechoice to submit directly to the action without going through
 * the /draft/new page.
 */
export function buildTexasDraft({
  settings,
  players,
  integrations,
}: BuildTexasDraftInput): Omit<Draft, "pickOrder"> {
  const errors = getTexasSetupErrors(settings, players.length);
  if (errors.length) throw new Error(errors.join(" "));
  const config = draftConfig[settings.type];

  // Initialize pools
  const systemPool = getSystemPool(settings.tileGameSets);

  // Get draftable factions
  const draftableFactions = getTexasFactionPool(settings);

  // Create texasDraft state with seat assignments and tile hands
  // Faction hands are dealt after the ban phase when one is configured.
  const texasDraft = {
    ...createTexasSeatAssignments(players),
    ...dealTexasTiles(systemPool, players),
    ...(!settings.modifiers?.banFactions?.numFactions
      ? dealTexasFactionOptions(
          draftableFactions,
          players,
          settings.texasFactionHandSize ?? 2,
        )
      : {}),
  };

  // Generate empty map for the selected map type
  const presetMap = generateEmptyMap(config);

  return {
    settings,
    players,
    integrations,
    availableFactions: draftableFactions,
    slices: [],
    presetMap,
    selections: [],
    texasDraft,
  };
}
