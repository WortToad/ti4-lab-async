import { draftConfig } from "~/draft/draftConfig";
import { systemData } from "~/data/systemData";
import { getFactionPool } from "~/utils/factions";
import { getSystemPool } from "~/utils/system";
import { generateEmptyMap } from "~/utils/map";
import type { DraftSettings, DraftType, FactionId, Player } from "~/types";

const mapTypes: Record<number, DraftType> = {
  3: "milty3p",
  4: "milty4p",
  5: "milty5p",
  6: "milty",
};

function shuffle<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function buildMiniMiltySettings(
  input: {
    players: Player[];
    numFactions?: number;
    bannedFactions?: FactionId[];
    requiredFactions?: FactionId[];
  },
  random = Math.random,
): DraftSettings {
  const count = input.players.length;
  if (!mapTypes[count])
    throw new Error(
      "Mini-Milty supports 3–6 players with the base-game tile pool.",
    );
  if (
    input.players.some(
      (player) => !player.name.trim() || player.name.length > 60,
    ) ||
    new Set(input.players.map((player) => player.id)).size !== count
  )
    throw new Error(
      "Each player needs a name of 1–60 characters and a unique ID.",
    );
  const allowed = getFactionPool(["base"]).filter(
    (id) => !input.bannedFactions?.includes(id),
  );
  const required = [...new Set(input.requiredFactions ?? [])];
  const numFactions = input.numFactions ?? count + 1;
  if (
    !Number.isInteger(numFactions) ||
    numFactions < count ||
    numFactions > allowed.length
  )
    throw new Error(
      `Choose between ${count} and ${allowed.length} available base-game factions.`,
    );
  if (
    required.length > numFactions ||
    required.some((id) => !allowed.includes(id))
  )
    throw new Error(
      "Prioritized factions must be allowed and fit within the faction pool.",
    );

  const type = mapTypes[count];
  const map = generateMiniMiltyMap(count, random);

  return {
    type,
    draftGameMode: "presetMap",
    presetMapFormat: "miniMilty",
    factionGameSets: ["base"],
    tileGameSets: ["base"],
    numFactions,
    allowedFactions: allowed,
    requiredFactions: required,
    numSlices: 0,
    draftSpeaker: false,
    draftPlayerColors: false,
    randomizeMap: false,
    randomizeSlices: false,
    allowEmptyTiles: false,
    allowHomePlanetSearch: false,
    presetMap: map,
  };
}

export function generateMiniMiltyMap(count: number, random = Math.random) {
  if (!mapTypes[count]) throw new Error("Mini-Milty supports 3–6 players.");
  const type = mapTypes[count];
  const config = draftConfig[type];
  const map = generateEmptyMap(config);
  const pool = getSystemPool(["base"]);
  const blues = shuffle(
    pool.filter((id) => systemData[id].type === "BLUE"),
    random,
  );
  const reds = shuffle(
    pool.filter((id) => systemData[id].type === "RED"),
    random,
  );
  if (blues.length < count * 3 || reds.length < count * 2)
    throw new Error("The base-game tile pool cannot fill this map.");
  config.homeIdxInMapString.forEach((homeIndex, seat) => {
    const home = map[homeIndex];
    const tiles = shuffle(
      [...blues.splice(0, 3), ...reds.splice(0, 2)],
      random,
    );
    config.seatTilePlacement[seat].forEach(([x, y], tileIndex) => {
      const index = map.findIndex(
        (tile) =>
          tile.position.x === home.position.x + x &&
          tile.position.y === home.position.y + y,
      );
      map[index] = {
        ...map[index],
        type: "SYSTEM",
        systemId: tiles[tileIndex],
      };
    });
  });

  return map;
}
