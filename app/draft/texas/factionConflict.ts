import { factions } from "~/data/factionData";
import type { Draft, FactionId } from "~/types";
import { canCompleteFactionDraft } from "../factionFeasibility";
import {
  getBaseKeleresSetup,
  getSelectedFactions,
  keleresHomeFactions,
} from "../keleres";
import { TEXAS_REDRAW_VALUE } from "./texasDraft";

/** Only revealed faction choices can trigger recovery; staged picks stay private. */
export function getTexasFactionConflict(draft: Draft) {
  if (
    draft.settings.draftGameMode !== "texasStyle" ||
    !draft.texasDraft ||
    !draft.selections.some(
      (selection) =>
        selection.type === "COMMIT_SIMULTANEOUS" &&
        selection.phase === "texasFaction",
    )
  )
    return undefined;
  const keleres = getBaseKeleresSetup(draft);
  if (!keleres || keleres.choices.length > 0) return undefined;
  const { primary } = getSelectedFactions(draft.selections);
  return {
    keleresPlayerId: keleres.playerId,
    affectedPlayerIds: draft.players
      .filter(
        (player) =>
          player.id === keleres.playerId ||
          keleresHomeFactions.some((home) => primary[player.id] === home),
      )
      .map((player) => player.id),
  };
}

function amendFaction(
  draft: Draft,
  playerId: number,
  factionId: FactionId,
  redrawn: boolean,
): Draft {
  const next = structuredClone(draft);
  const commit = [...next.selections]
    .reverse()
    .find(
      (selection) =>
        selection.type === "COMMIT_SIMULTANEOUS" &&
        selection.phase === "texasFaction" &&
        selection.selections.some((choice) => choice.playerId === playerId),
    );
  if (commit?.type !== "COMMIT_SIMULTANEOUS")
    throw new Error("There is no revealed Texas faction choice to change.");
  const choice = commit.selections.find((pick) => pick.playerId === playerId)!;
  commit.factionReplacements = [
    ...(commit.factionReplacements ?? []),
    {
      playerId,
      previousFactionId: choice.value as FactionId,
      factionId,
      redrawn,
    },
  ];
  choice.value = factionId;

  // Old saves may contain a home which was illegal under the revealed picks.
  // Resolving the conflict must not silently revive that old home choice.
  const keleresPlayerId = getTexasFactionConflict(draft)?.keleresPlayerId;
  const keleresPlayer = next.players.find((p) => p.id === keleresPlayerId);
  if (keleresPlayer) delete keleresPlayer.homeSystemFactionId;
  return next;
}

function isLegalReplacement(draft: Draft, playerId: number, value: FactionId) {
  if (!Object.hasOwn(factions, value)) return false;
  const { primary } = getSelectedFactions(draft.selections);
  if (primary[playerId] === value) return false;
  if (
    draft.selections.some(
      (selection) =>
        selection.type === "BAN_FACTION" && selection.factionId === value,
    )
  )
    return false;
  return canCompleteFactionDraft(amendFaction(draft, playerId, value, false));
}

export function getTexasFactionReplacementOptions(
  draft: Draft,
  playerId: number,
) {
  if (!getTexasFactionConflict(draft)?.affectedPlayerIds.includes(playerId))
    return [];
  const options =
    draft.texasDraft?.factionOptions?.[playerId] ??
    draft.texasDraft?.initialFactionOptions?.[playerId] ??
    [];
  return [...new Set(options)].filter((faction) =>
    isLegalReplacement(draft, playerId, faction),
  );
}

function legalFreshReserve(draft: Draft, playerId: number): FactionId[] {
  if (
    draft.settings.texasAllowFactionRedraw === false ||
    !getTexasFactionConflict(draft)?.affectedPlayerIds.includes(playerId)
  )
    return [];
  const texas = draft.texasDraft!;
  // Undo/rebuild in older rooms may have reset the pile to its initial state.
  // Never reuse a faction already drawn, discarded by recovery, or dealt.
  const unavailable = new Set([
    ...Object.values(texas.factionOptions ?? {}).flat(),
    ...Object.values(texas.initialFactionOptions ?? {}).flat(),
    ...draft.selections.flatMap((selection) =>
      selection.type === "COMMIT_SIMULTANEOUS" &&
      selection.phase === "texasFaction"
        ? selection.selections
            .map((choice) => choice.value as FactionId)
            .concat(
              selection.factionReplacements?.flatMap((replacement) => [
                replacement.previousFactionId,
                replacement.factionId,
              ]) ?? [],
            )
        : [],
    ),
  ]);
  return [...new Set(texas.factionDrawPile ?? [])].filter(
    (faction) =>
      !unavailable.has(faction) && isLegalReplacement(draft, playerId, faction),
  );
}

export function canRedrawTexasConflictingFaction(
  draft: Draft,
  playerId: number,
) {
  return legalFreshReserve(draft, playerId).length > 0;
}

export function replaceTexasConflictingFaction(
  draft: Draft,
  playerId: number,
  value: string,
): Draft {
  const conflict = getTexasFactionConflict(draft);
  if (!conflict)
    throw new Error(
      "The faction conflict has already been resolved. Refresh the draft.",
    );
  if (!conflict.affectedPlayerIds.includes(playerId))
    throw new Error(
      "Only a player involved in this conflict can change their own faction.",
    );
  const redrawn = value === TEXAS_REDRAW_VALUE;
  const faction = redrawn
    ? legalFreshReserve(draft, playerId).at(-1)
    : getTexasFactionReplacementOptions(draft, playerId).find(
        (option) => option === value,
      );
  if (!faction)
    throw new Error(
      redrawn
        ? "There is no legal fresh faction available to redraw. Another involved player can choose a replacement from their own hand."
        : "Choose an unused faction from your original hand that resolves the Keleres home conflict.",
    );
  const next = amendFaction(draft, playerId, faction, redrawn);
  if (redrawn)
    next.texasDraft!.factionDrawPile = next.texasDraft!.factionDrawPile!.filter(
      (candidate) => candidate !== faction,
    );
  return next;
}
