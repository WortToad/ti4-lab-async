import { systemData } from "~/data/systemData";
import { draftConfig } from "~/draft/draftConfig";
import type { Draft, DraftSelection, FactionId, Tile } from "~/types";

export type FactionDraft = Pick<
  Draft,
  "settings" | "players" | "selections" | "availableFactions"
> &
  Partial<
    Pick<
      Draft,
      | "availableMinorFactions"
      | "playerFactionPool"
      | "texasDraft"
      | "presetMap"
      | "slices"
    >
  >;

type HomeDraft = Pick<FactionDraft, "settings" | "players" | "selections"> &
  Pick<FactionDraft, "presetMap" | "slices">;

/** Physical homes which will remain on the map independently of main picks. */
export function getOccupiedFactionHomes(
  draft: HomeDraft,
  prospectiveSelection?: DraftSelection,
): FactionId[] {
  const occupied = new Set<FactionId>();
  const addHome = (tile: Tile) => {
    if (tile.type !== "SYSTEM") return;
    const faction = systemData[tile.systemId]?.faction;
    if (faction) occupied.add(faction);
  };
  const presetMode = draft.settings.draftGameMode === "presetMap";
  const mainHomeIndices = draftConfig[draft.settings.type].homeIdxInMapString;
  for (const [index, tile] of (draft.presetMap ?? []).entries()) {
    // Normal-map hydration replaces these positions with the player's HOME.
    if (!presetMode && mainHomeIndices.includes(index)) continue;
    addHome(tile);
  }
  if (presetMode) return [...occupied];

  const selections = prospectiveSelection
    ? [...draft.selections, prospectiveSelection]
    : draft.selections;
  const slices = draft.slices ?? [];
  const selected = new Set(
    selections.flatMap((selection) =>
      selection.type === "SELECT_SLICE" ? [selection.sliceIdx] : [],
    ),
  );
  // An exactly sized pool must be used in full. Extra unselected slices may
  // never reach the map, so they must not rule out a Keleres home.
  if (slices.length === draft.players.length)
    slices.forEach((_, index) => selected.add(index));
  for (const index of selected) {
    // The first slice tile is a player-home preview, not a placed system.
    for (const tile of slices[index]?.tiles.slice(1) ?? []) addHome(tile);
  }
  return [...occupied];
}

/** A bounded bipartite matching, allowing earlier assignments to move. */
function canMatchSlots(slots: FactionId[][], excluded: Set<FactionId>) {
  const candidates = slots.map((slot) =>
    [...new Set(slot)].filter((faction) => !excluded.has(faction)),
  );
  candidates.sort((a, b) => a.length - b.length);
  const assigned = new Map<FactionId, number>();
  const assign = (slot: number, visited: Set<FactionId>): boolean => {
    for (const faction of candidates[slot]) {
      if (visited.has(faction)) continue;
      visited.add(faction);
      const previous = assigned.get(faction);
      if (previous === undefined || assign(previous, visited)) {
        assigned.set(faction, slot);
        return true;
      }
    }
    return false;
  };
  return candidates.every((_, slot) => assign(slot, new Set()));
}

/**
 * Whether every remaining main/minor pick can finish with unique factions and
 * a physical home for Keleres. This checks completion, not turn ownership or
 * whether a proposed pick belongs to its pool; those remain action validation.
 */
export function canCompleteFactionDraft(
  draft: FactionDraft,
  prospectiveSelection?: DraftSelection,
): boolean {
  if (draft.settings.draftGameMode === "twilightsFall") return true;
  const selections = prospectiveSelection
    ? [...draft.selections, prospectiveSelection]
    : draft.selections;
  const primary = new Map<number, FactionId>();
  const minor = new Map<number, FactionId>();
  const banned = new Set<FactionId>();
  for (const selection of selections) {
    if (selection.type === "SELECT_FACTION")
      primary.set(selection.playerId, selection.factionId);
    if (selection.type === "SELECT_MINOR_FACTION")
      minor.set(selection.playerId, selection.minorFactionId);
    if (selection.type === "BAN_FACTION") banned.add(selection.factionId);
    if (
      selection.type === "COMMIT_SIMULTANEOUS" &&
      selection.phase === "texasFaction"
    )
      for (const { playerId, value } of selection.selections)
        primary.set(playerId, value as FactionId);
  }
  if ([...minor.values()].includes("keleres")) return false;
  const fixed = [...primary.values(), ...minor.values()];
  const used = new Set(fixed);
  if (used.size !== fixed.length) return false;
  const occupied = getOccupiedFactionHomes(draft, prospectiveSelection);
  if (occupied.some((faction) => used.has(faction))) return false;
  const excluded = new Set([...used, ...occupied, ...banned]);
  const slots: FactionId[][] = [];
  for (const player of draft.players) {
    if (!primary.has(player.id))
      slots.push(
        draft.playerFactionPool?.[player.id] ??
          draft.texasDraft?.factionOptions?.[player.id] ??
          draft.availableFactions,
      );
    if (
      !minor.has(player.id) &&
      (draft.settings.minorFactionsInSharedPool ||
        draft.settings.numMinorFactions !== undefined)
    )
      slots.push(
        (draft.settings.minorFactionsInSharedPool
          ? draft.availableFactions
          : (draft.availableMinorFactions ?? [])
        ).filter((faction) => faction !== "keleres"),
      );
  }

  if (
    !used.has("keleres") &&
    canMatchSlots(slots, new Set([...excluded, "keleres"]))
  )
    return true;
  // Each scenario reserves a different Keleres host. No exponential search is
  // needed: each scenario is one matching of at most two slots per player.
  return (["mentak", "xxcha", "argent"] as const).some(
    (home) =>
      !used.has(home) &&
      !occupied.includes(home) &&
      canMatchSlots(slots, new Set([...excluded, home])),
  );
}
