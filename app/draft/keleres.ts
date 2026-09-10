import type { Draft, DraftSelection, FactionId } from "~/types";
import { getOccupiedFactionHomes } from "./factionFeasibility";

export const keleresHomeFactions = ["mentak", "xxcha", "argent"] as const;
export type KeleresHomeFaction = (typeof keleresHomeFactions)[number];
export const keleresHeroNames: Record<KeleresHomeFaction, string> = {
  mentak: "Harka Leeds",
  xxcha: "Odlynn Myrr",
  argent: "Kuuasi Aun Jalatai",
};

export function getSelectedFactions(selections: DraftSelection[]) {
  const primary: Record<number, FactionId> = {};
  const minor: FactionId[] = [];
  for (const selection of selections) {
    if (selection.type === "SELECT_FACTION")
      primary[selection.playerId] = selection.factionId;
    if (selection.type === "SELECT_MINOR_FACTION")
      minor.push(selection.minorFactionId);
    if (
      selection.type === "COMMIT_SIMULTANEOUS" &&
      selection.phase === "texasFaction"
    )
      for (const { playerId, value } of selection.selections)
        primary[playerId] = value as FactionId;
  }
  return { primary, minor };
}

export function availableKeleresHomes(usedFactions: FactionId[]) {
  return keleresHomeFactions.filter((id) => !usedFactions.includes(id));
}

export function hasKeleresHomeConflict(selections: DraftSelection[]) {
  const { primary, minor } = getSelectedFactions(selections);
  return (
    Object.values(primary).includes("keleres") &&
    availableKeleresHomes([...Object.values(primary), ...minor]).length === 0
  );
}

export function getBaseKeleresSetup(
  draft: Pick<Draft, "players" | "selections" | "settings" | "pickOrder"> &
    Partial<Pick<Draft, "presetMap" | "slices">>,
) {
  if (draft.settings.draftGameMode === "twilightsFall") return undefined;
  const { primary, minor } = getSelectedFactions(draft.selections);
  const player = draft.players.find((p) => primary[p.id] === "keleres");
  if (!player) return undefined;
  const choices = availableKeleresHomes([
    ...Object.values(primary),
    ...minor,
    ...getOccupiedFactionHomes(draft),
  ]);
  const chosen = choices.find((id) => id === player.homeSystemFactionId);
  return {
    playerId: player.id,
    choices,
    chosen,
    ready: draft.selections.length >= draft.pickOrder.length,
  };
}

export function chooseBaseKeleresHome(
  draft: Draft,
  playerId: number,
  home: string,
): Draft {
  const setup = getBaseKeleresSetup(draft);
  if (!setup?.ready)
    throw new Error("Finish all draft picks before choosing the Keleres home.");
  if (setup.playerId !== playerId)
    throw new Error("Only the Keleres player can choose their home.");
  if (!setup.choices.some((choice) => choice === home))
    throw new Error(
      "Choose an unplayed Mentak, Xxcha, or Argent home. If none remain, ask the admin to restore before the conflicting faction pick.",
    );
  if (setup.chosen)
    throw new Error(
      "The Keleres home is already chosen. Ask the admin to undo that choice before changing it.",
    );
  return {
    ...draft,
    players: draft.players.map((p) =>
      p.id === playerId
        ? { ...p, homeSystemFactionId: home as KeleresHomeFaction }
        : p,
    ),
  };
}
