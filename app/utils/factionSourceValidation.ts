import { factions } from "~/data/factionData";
import type { Draft, DraftSettings, FactionId } from "~/types";
import { getFactionPool } from "./factions";

type FactionSourceDraft = Pick<
  Draft,
  "settings" | "players" | "availableMinorFactions"
>;

export function getFactionBanSource(
  draft: Pick<Draft, "settings" | "availableMinorFactions">,
): FactionId[] {
  const minorFactions = new Set(draft.availableMinorFactions ?? []);
  return [
    ...new Set(
      draft.settings.allowedFactions ??
        getFactionPool(draft.settings.factionGameSets),
    ),
  ].filter((id) => !minorFactions.has(id));
}

function requiredFactionPool(draft: FactionSourceDraft) {
  const sharedMinimum = draft.settings.minorFactionsInSharedPool
    ? draft.players.length * 2
    : 0;
  return Math.max(
    draft.settings.numFactions,
    draft.players.length *
      Math.max(1, draft.settings.numPreassignedFactions ?? 1),
    sharedMinimum,
  );
}

/** Match the priority/quota allocation used by randomizeFactions, including its final pool cap. */
function factionGenerationCapacity(settings: DraftSettings, pool: FactionId[]) {
  if (!settings.factionStratification) return pool.length;
  const required = [...new Set(settings.requiredFactions ?? [])].filter((id) =>
    pool.includes(id),
  );
  let count = required.length;
  for (const [group, target] of Object.entries(
    settings.factionStratification,
  )) {
    const sets = group.split("|");
    const belongs = (id: FactionId) => sets.includes(factions[id].set);
    const alreadyRequired = required.filter(belongs).length;
    const available = pool.filter(
      (id) => belongs(id) && !required.includes(id),
    ).length;
    count += Math.min(Math.max(0, target - alreadyRequired), available);
  }
  return Math.min(settings.numFactions, count);
}

export function getFactionSourceValidationErrors(
  draft: FactionSourceDraft,
): string[] {
  const { settings, players } = draft;
  if (
    settings.draftGameMode === "texasStyle" ||
    settings.draftGameMode === "twilightsFall"
  )
    return [];
  if (
    settings.numPreassignedFactions !== undefined &&
    (!Number.isInteger(settings.numPreassignedFactions) ||
      settings.numPreassignedFactions < 1)
  )
    return ["Each private faction hand must contain at least one faction."];
  const bansPerPlayer = settings.modifiers?.banFactions?.numFactions ?? 0;
  if (!Number.isInteger(bansPerPlayer) || bansPerPlayer < 0)
    return ["Faction bans per player must be a whole number of zero or more."];
  if (!bansPerPlayer) return [];
  const source = getFactionBanSource(draft);
  const bans = bansPerPlayer * players.length;
  const required = requiredFactionPool(draft);
  const remaining = Math.max(0, source.length - bans);
  if (remaining < required)
    return [
      `The faction source needs ${required} factions after ${bans} bans, but only ${remaining} will remain after excluding the separate minor faction pool. Allow more factions, reduce bans, or reduce the faction pool or hand size.`,
    ];
  if (factionGenerationCapacity(settings, source) < settings.numFactions)
    return [
      `The selected expansion mix cannot supply the requested ${settings.numFactions} factions. Allow more factions in its expansion groups or adjust the mix.`,
    ];
  return [];
}

/** Keep each offered ban compatible with the pool that will be dealt after all bans. */
export function getFactionBanError(
  draft: FactionSourceDraft & Pick<Draft, "selections">,
  candidate: FactionId,
): string | undefined {
  const source = getFactionBanSource(draft);
  if (!source.includes(candidate))
    return "This faction is excluded from the ban pool or reserved as a minor faction.";
  const banned = new Set(
    draft.selections
      .filter((selection) => selection.type === "BAN_FACTION")
      .map((selection) => selection.factionId),
  );
  if (banned.has(candidate)) return "This faction has already been banned.";
  if (
    draft.settings.draftGameMode === "texasStyle" ||
    draft.settings.draftGameMode === "twilightsFall"
  )
    return undefined;
  banned.add(candidate);
  const pool = source.filter((id) => !banned.has(id));
  const bansLeft = Math.max(
    0,
    (draft.settings.modifiers?.banFactions?.numFactions ?? 0) *
      draft.players.length -
      banned.size,
  );
  if (pool.length < requiredFactionPool(draft) + bansLeft)
    return "This ban would leave too few factions for the remaining bans and player choices. Ask the admin to adjust the faction settings.";
  if (
    factionGenerationCapacity(draft.settings, pool) < draft.settings.numFactions
  )
    return "Needed to fill the selected expansion mix. Ban a faction from another expansion group.";
  return undefined;
}
