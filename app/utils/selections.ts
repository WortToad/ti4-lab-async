import { factions } from "~/data/factionData";
import { Draft, DraftSelection } from "~/types";

export function draftSelectionToMessage(
  playerName: string,
  selection: DraftSelection,
  draft: Draft,
) {
  if (selection.type === "SELECT_SPEAKER_ORDER") {
    return `${playerName} selected speaker order: ${selection.speakerOrder + 1}`;
  }
  if (selection.type === "SELECT_SLICE") {
    const sliceName = draft.slices[selection.sliceIdx].name;
    return `${playerName} selected slice: ${sliceName}`;
  }
  if (selection.type === "SELECT_FACTION") {
    const faction = factions[selection.factionId];
    return `${playerName} selected faction: ${faction.name}`;
  }
  if (selection.type === "SELECT_MINOR_FACTION") {
    const minorFaction = factions[selection.minorFactionId];
    return `${playerName} selected minor faction: ${minorFaction.name}`;
  }
  if (selection.type === "SELECT_SEAT") {
    return `${playerName} selected seat: ${selection.seatIdx + 1}`;
  }
  if (selection.type === "SELECT_PLAYER_COLOR") {
    return `${playerName} selected color: ${selection.color}`;
  }

  if (selection.type === "BAN_FACTION") {
    return `${playerName} banned faction: ${selection.factionId}`;
  }

  if (selection.type === "COMMIT_SIMULTANEOUS") {
    if (selection.phase === "priorityValue") {
      return "Priority value selection complete";
    }
    if (selection.phase === "homeSystem") {
      return "Home system selection complete";
    }
    if (selection.phase === "texasFaction") {
      const replacements = selection.factionReplacements?.map((replacement) => {
        const player = draft.players.find(
          (player) => player.id === replacement.playerId,
        );
        return `${player?.name ?? "Player"} changed ${factions[replacement.previousFactionId].name} to ${factions[replacement.factionId].name}${replacement.redrawn ? " (redraw)" : ""} to resolve the Keleres home conflict`;
      });
      return [
        "Texas Style faction selection complete",
        ...(replacements ?? []),
      ].join(". ");
    }
    if (selection.phase === "texasBlueKeep1") {
      return "Texas Style blue keep (round 1) complete";
    }
    if (selection.phase === "texasBlueKeep2") {
      return "Texas Style blue keep (round 2) complete";
    }
    if (selection.phase === "texasRedKeep") {
      return "Texas Style red keep complete";
    }
  }

  if (selection.type === "PLACE_TILE") {
    return `${playerName} placed tile ${selection.systemId}`;
  }

  return "";
}
