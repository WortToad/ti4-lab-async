import { systemData } from "~/data/systemData";
import { getFactionPool } from "~/utils/factions";
import { getSystemPool } from "~/utils/system";
import { draftConfig } from "~/draft/draftConfig";
import { generateEmptyMap } from "~/utils/map";
import type { DraftSettings, FactionId, SystemId } from "~/types";

export function getTexasFactionPool(
  settings: DraftSettings,
  availableFactionPool?: FactionId[],
) {
  return [
    ...new Set(
      availableFactionPool ??
        settings.allowedFactions ??
        getFactionPool(settings.factionGameSets),
    ),
  ];
}

export function getTexasTilePoolErrors(
  systemPool: SystemId[],
  playerCount: number,
) {
  const errors: string[] = [];
  const uniqueTiles = [...new Set(systemPool)];
  for (const [color, perPlayer] of [
    ["BLUE", 3],
    ["RED", 2],
  ] as const) {
    const available = uniqueTiles.filter(
      (id) => systemData[id]?.type === color,
    ).length;
    const required = perPlayer * playerCount;
    if (available < required) {
      errors.push(
        `Texas needs ${required} ${color.toLowerCase()} tiles (${perPlayer} per player), but the tile pool contains ${available}. Enable more tile content or reduce the player count.`,
      );
    }
  }
  return errors;
}

export function getTexasSetupErrors(
  settings: DraftSettings,
  playerCount: number,
  availableFactionPool?: FactionId[],
) {
  if (!Number.isInteger(playerCount) || playerCount < 1)
    return ["Choose a whole number of players before setting up Texas."];
  const errors = getTexasTilePoolErrors(
    getSystemPool(settings.tileGameSets),
    playerCount,
  );
  const config = draftConfig[settings.type];
  if (config) {
    const openSpaces = generateEmptyMap(config).filter(
      (tile) => tile.type === "OPEN",
    ).length;
    if (openSpaces !== config.numPlayers * 5) {
      errors.push(
        `This layout has ${openSpaces} map spaces. Texas deals five tiles per player and needs exactly ${config.numPlayers * 5} spaces. Choose another galaxy layout.`,
      );
    }
  }
  const handSize = settings.texasFactionHandSize ?? 2;
  if (handSize !== 2 && handSize !== 3) {
    errors.push("Texas deals either 2 or 3 factions per player.");
    return errors;
  }
  const bansPerPlayer = settings.modifiers?.banFactions?.numFactions ?? 0;
  if (!Number.isInteger(bansPerPlayer) || bansPerPlayer < 0) {
    errors.push(
      "Faction bans per player must be a whole number of zero or more.",
    );
    return errors;
  }
  const available = getTexasFactionPool(settings, availableFactionPool).length;
  const bans = playerCount * bansPerPlayer;
  const dealt = playerCount * handSize;
  const redraws = settings.texasAllowFactionRedraw === false ? 0 : playerCount;
  if (available < bans + dealt) {
    errors.push(
      `Texas needs ${dealt} factions for ${playerCount} hands of ${handSize} after ${bans} bans, but only ${Math.max(0, available - bans)} will remain. Enable more faction content, allow more factions, or deal fewer factions per player.`,
    );
  } else if (available < bans + dealt + redraws) {
    errors.push(
      `Redraw for all ${playerCount} players requires ${bans + dealt + redraws} factions (${bans} bans, ${dealt} dealt and ${redraws} reserved), but only ${available} are available. Enable more faction content, deal fewer factions per player, or turn off redraw.`,
    );
  }
  return errors;
}
