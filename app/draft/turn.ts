import {
  HOME_PHASE,
  PRIORITY_PHASE,
  type Draft,
  type SimultaneousPickType,
} from "~/types";
import type { BagDraftView } from "./bag/types";
import { getBaseKeleresSetup } from "./keleres";

export type PendingDraftAction = { key: string; label: string };

const phaseLabels: Record<SimultaneousPickType, string> = {
  priorityValue: "Choose your priority card",
  homeSystem: "Choose your home system",
  texasFaction: "Choose your faction",
  texasBlueKeep1: "Keep your first blue tile",
  texasBlueKeep2: "Keep your second blue tile",
  texasRedKeep: "Keep your red tile",
};

export function getBasePendingAction(
  draft: Draft,
  playerId?: number,
): PendingDraftAction | undefined {
  if (
    playerId === undefined ||
    !draft.players.some((player) => player.id === playerId)
  )
    return;
  const keleres = getBaseKeleresSetup(draft);
  if (keleres?.ready && !keleres.chosen && keleres.playerId === playerId)
    return { key: "keleres-home", label: "Choose your Keleres home and hero" };
  const index = draft.selections.length;
  const pick = draft.pickOrder[index];
  const phase =
    typeof pick === "object"
      ? pick.phase
      : pick === PRIORITY_PHASE
        ? "priorityValue"
        : pick === HOME_PHASE
          ? "homeSystem"
          : undefined;
  if (phase) {
    if (draft.stagedSelections?.[phase]?.[playerId] !== undefined) return;
    return { key: `${index}:${phase}`, label: phaseLabels[phase] };
  }
  if (pick === playerId) {
    const bans =
      (draft.settings.modifiers?.banFactions?.numFactions ?? 0) *
      draft.players.length;
    return {
      key: `${index}:pick`,
      label: index < bans ? "Ban a faction" : "Make your next pick",
    };
  }
}

export function getBagPendingAction(
  view: BagDraftView,
): PendingDraftAction | undefined {
  const seat = view.privateSeat;
  if (!seat || view.lobby.paused) return;
  if (view.phase === "drafting" && !seat.ready && seat.picksRequired > 0)
    return {
      key: `drafting:${view.round}`,
      label: `Choose ${seat.picksRequired} item${seat.picksRequired === 1 ? "" : "s"} from your bag`,
    };
  if (view.phase === "assembling" && !seat.finished)
    return { key: "assembling", label: "Confirm your finished faction" };
}
