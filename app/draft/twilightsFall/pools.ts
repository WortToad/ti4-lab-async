import { factions, twilightsFallFactionIds } from "~/data/factionData";
import { shuffle } from "~/draft/helpers/randomization";
import { getFactionPool } from "~/utils/factions";
import type {
  Draft,
  DraftSettings,
  FactionId,
  FactionReferenceCardPack,
} from "~/types";

export const referenceCardFactionPool = getFactionPool([
  "base",
  "pok",
  "te",
]).filter((id) => factions[id].priorityOrder !== undefined);

export function parseReferenceCardPacks(
  value: string,
): FactionReferenceCardPack[] | undefined {
  if (!value.trim()) return undefined;
  return value
    .split(/[;\n]/)
    .map((pack) => pack.trim())
    .filter(Boolean)
    .map((pack) => {
      const ids = pack.split(",").map((id) => id.trim()) as FactionId[];
      if (ids.length !== 3)
        throw new Error(
          "Each reference pack must contain exactly 3 comma-separated faction IDs.",
        );
      for (const id of ids) {
        if (!referenceCardFactionPool.includes(id))
          throw new Error(
            `Unknown or unavailable reference card faction: ${id}.`,
          );
      }
      return ids;
    });
}

export function getReferenceCardPool(
  settings: Pick<DraftSettings, "bannedReferenceCardFactions">,
) {
  return referenceCardFactionPool.filter(
    (id) => !settings.bannedReferenceCardFactions?.includes(id),
  );
}

export function validateTwilightsFallSettings(
  settings: DraftSettings,
  playerCount: number,
): void {
  const kings = twilightsFallFactionIds.filter(
    (id) => !settings.allowedFactions || settings.allowedFactions.includes(id),
  );
  const numKings = settings.numKings ?? 8;
  if (
    !Number.isInteger(numKings) ||
    numKings < playerCount ||
    numKings > kings.length
  ) {
    throw new Error(
      `Choose between ${playerCount} and ${kings.length} kings, or change the king bans.`,
    );
  }
  const required = [...new Set(settings.requiredFactions ?? [])];
  if (
    required.length > numKings ||
    required.some((id) => !kings.includes(id))
  ) {
    throw new Error(
      "Prioritized kings must be allowed and fit in the king pool.",
    );
  }
  const pool = getReferenceCardPool(settings);
  const preset = settings.presetReferenceCardPacks;
  const numPacks =
    preset?.length ?? settings.numReferenceCardPacks ?? playerCount;
  if (
    !Number.isInteger(numPacks) ||
    numPacks < playerCount ||
    numPacks > Math.floor(pool.length / 3)
  ) {
    throw new Error(
      `This draft needs at least ${playerCount} reference packs. The available cards allow at most ${Math.floor(pool.length / 3)} packs; reduce card bans or the pack count.`,
    );
  }
  if (preset) {
    if (preset.some((pack) => !Array.isArray(pack) || pack.length !== 3))
      throw new Error(
        "Each reference pack must contain exactly 3 faction IDs.",
      );
    const ids = preset.flat();
    if (ids.some((id) => !pool.includes(id)))
      throw new Error(
        "Preset reference packs contain a banned or unavailable faction card.",
      );
    if (new Set(ids).size !== ids.length)
      throw new Error(
        "Each faction reference card can appear in only one pack.",
      );
  }
}

export function generateTwilightsFallKings(
  settings: DraftSettings,
  playerCount: number,
): FactionId[] {
  validateTwilightsFallSettings(settings, playerCount);
  const required = [...new Set(settings.requiredFactions ?? [])];
  const pool = twilightsFallFactionIds.filter(
    (id) =>
      (!settings.allowedFactions || settings.allowedFactions.includes(id)) &&
      !required.includes(id),
  );
  return [
    ...required,
    ...shuffle(pool, (settings.numKings ?? 8) - required.length),
  ];
}

export function generateReferenceCardPacks(
  settings: DraftSettings,
  playerCount: number,
): FactionReferenceCardPack[] {
  validateTwilightsFallSettings(settings, playerCount);
  if (settings.presetReferenceCardPacks)
    return settings.presetReferenceCardPacks.map((pack) => [...pack]);
  const count = settings.numReferenceCardPacks ?? playerCount;
  const shuffled = shuffle(getReferenceCardPool(settings), count * 3);
  return Array.from({ length: count }, (_, i) =>
    shuffled.slice(i * 3, i * 3 + 3),
  );
}

export function validateTwilightsFallDraft(
  draft: Pick<
    Draft,
    "settings" | "players" | "availableFactions" | "availableReferenceCardPacks"
  >,
) {
  validateTwilightsFallSettings(draft.settings, draft.players.length);
  const kings = draft.availableFactions;
  if (
    kings.length < draft.players.length ||
    new Set(kings).size !== kings.length ||
    kings.some(
      (id) =>
        !twilightsFallFactionIds.includes(id) ||
        (draft.settings.allowedFactions &&
          !draft.settings.allowedFactions.includes(id)),
    )
  ) {
    throw new Error(
      "The king pool must contain enough unique, allowed kings for every player.",
    );
  }
  if (draft.settings.requiredFactions?.some((id) => !kings.includes(id)))
    throw new Error("A prioritized king is missing from the pool.");
  validateTwilightsFallSettings(
    {
      ...draft.settings,
      presetReferenceCardPacks: draft.availableReferenceCardPacks ?? [],
    },
    draft.players.length,
  );
}
