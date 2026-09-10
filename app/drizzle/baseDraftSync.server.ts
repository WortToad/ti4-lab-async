import type { Draft, DraftSelection } from "~/types";
import { getFactionPool } from "~/utils/factions";
import { getDraftableFactions, randomizeFactions } from "~/draftStore";
import { dealTexasFactionOptions } from "~/draft/texas/texasDraft";
import { shuffle } from "~/draft/helpers/randomization";
import { getPlaceableTileIndices } from "~/utils/texasMapBuild";
import { getFactionBanError } from "~/utils/factionSourceValidation";
import { canCompleteFactionDraft } from "~/draft/factionFeasibility";

/** Apply one owned selection to authoritative state; ignore client state edits. */
export function applyBaseSelection(
  server: Draft,
  selection: DraftSelection,
  playerId: number,
): Draft {
  if (
    !selection ||
    !("playerId" in selection) ||
    selection.playerId !== playerId ||
    server.pickOrder[server.selections.length] !== playerId
  )
    throw new Error(
      "Wait for your turn and choose an option for your own player.",
    );
  const result = structuredClone(server);
  const previous = server.selections;
  if (
    server.settings.draftGameMode === "texasStyle" &&
    selection.type !== "BAN_FACTION" &&
    selection.type !== "PLACE_TILE"
  )
    throw new Error("Place one of your tiles during the map-building phase.");
  const bansNeeded =
    (server.settings.modifiers?.banFactions?.numFactions ?? 0) *
    server.players.length;
  if (previous.length < bansNeeded !== (selection.type === "BAN_FACTION"))
    throw new Error("This pick is not available in the current phase.");
  if (
    selection.type !== "BAN_FACTION" &&
    selection.type !== "PLACE_TILE" &&
    previous.some(
      (s) =>
        s.type === selection.type && "playerId" in s && s.playerId === playerId,
    )
  )
    throw new Error("You already picked this category.");
  const validIndex = (value: number, count: number) =>
    Number.isInteger(value) && value >= 0 && value < count;
  let valid = false;
  switch (selection.type) {
    case "SELECT_FACTION":
      valid =
        (
          server.playerFactionPool?.[playerId] ?? server.availableFactions
        ).includes(selection.factionId) &&
        !previous.some(
          (s) =>
            (s.type === "SELECT_FACTION" &&
              s.factionId === selection.factionId) ||
            (s.type === "SELECT_MINOR_FACTION" &&
              s.minorFactionId === selection.factionId),
        );
      break;
    case "SELECT_MINOR_FACTION":
      if (selection.minorFactionId === "keleres")
        throw new Error(
          "Keleres has no fixed home system and cannot be drafted as a minor faction.",
        );
      valid =
        (server.settings.numMinorFactions !== undefined ||
          !!server.settings.minorFactionsInSharedPool) &&
        (server.settings.minorFactionsInSharedPool
          ? server.availableFactions
          : (server.availableMinorFactions ?? [])
        ).includes(selection.minorFactionId) &&
        !previous.some(
          (s) =>
            (s.type === "SELECT_MINOR_FACTION" &&
              s.minorFactionId === selection.minorFactionId) ||
            (s.type === "SELECT_FACTION" &&
              s.factionId === selection.minorFactionId),
        );
      break;
    case "SELECT_SLICE":
      valid =
        server.settings.draftGameMode !== "presetMap" &&
        validIndex(selection.sliceIdx, server.slices.length) &&
        !previous.some(
          (s) => s.type === "SELECT_SLICE" && s.sliceIdx === selection.sliceIdx,
        );
      break;
    case "SELECT_REFERENCE_CARD_PACK":
      valid =
        server.settings.draftGameMode === "twilightsFall" &&
        validIndex(
          selection.packIdx,
          server.availableReferenceCardPacks?.length ?? 0,
        ) &&
        !previous.some(
          (s) =>
            s.type === "SELECT_REFERENCE_CARD_PACK" &&
            s.packIdx === selection.packIdx,
        );
      break;
    case "SELECT_SPEAKER_ORDER":
      valid =
        !!server.settings.draftSpeaker &&
        validIndex(selection.speakerOrder, server.players.length) &&
        !previous.some(
          (s) =>
            s.type === "SELECT_SPEAKER_ORDER" &&
            s.speakerOrder === selection.speakerOrder,
        );
      break;
    case "SELECT_SEAT":
      valid =
        server.settings.draftGameMode !== "texasStyle" &&
        validIndex(selection.seatIdx, server.players.length) &&
        !previous.some(
          (s) => s.type === "SELECT_SEAT" && s.seatIdx === selection.seatIdx,
        );
      break;
    case "SELECT_PLAYER_COLOR":
      valid =
        !!server.settings.draftPlayerColors &&
        [
          "Red",
          "Blue",
          "Green",
          "Yellow",
          "Purple",
          "Orange",
          "Magenta",
          "Black",
        ].includes(selection.color) &&
        !previous.some(
          (s) =>
            s.type === "SELECT_PLAYER_COLOR" && s.color === selection.color,
        );
      break;
    case "BAN_FACTION": {
      const error = getFactionBanError(server, selection.factionId);
      if (error) throw new Error(error);
      valid = true;
      break;
    }
    case "PLACE_TILE": {
      const tiles = result.texasDraft?.playerTiles?.[playerId];
      const tile = result.presetMap[selection.mapIdx];
      valid =
        !!tiles?.includes(selection.systemId) &&
        tile?.type === "OPEN" &&
        getPlaceableTileIndices(
          result.presetMap,
          tiles ?? [],
          selection.systemId,
        ).includes(selection.mapIdx);
      if (valid && tiles && result.texasDraft?.playerTiles) {
        result.presetMap[selection.mapIdx] = {
          ...tile,
          type: "SYSTEM",
          systemId: selection.systemId,
        };
        result.texasDraft.playerTiles[playerId] = tiles.filter(
          (id) => id !== selection.systemId,
        );
      }
      break;
    }
    default:
      throw new Error("Choose one of the options in the current draft phase.");
  }
  if (!valid)
    throw new Error(
      "That option is unavailable or has already been taken. Refresh and choose again.",
    );
  result.selections.push(selection);
  if (
    (selection.type === "SELECT_FACTION" ||
      selection.type === "SELECT_MINOR_FACTION" ||
      selection.type === "SELECT_SLICE") &&
    !canCompleteFactionDraft(result)
  )
    throw new Error(
      "Keep a legal faction for every remaining main and minor pick. Keleres needs an unplayed Mentak, Xxcha, or Argent home. Choose another option or restore before the conflicting pick.",
    );
  if (
    selection.type === "BAN_FACTION" &&
    result.selections.length === bansNeeded
  ) {
    const banned = result.selections
      .filter((s) => s.type === "BAN_FACTION")
      .map((s) => s.factionId);
    const pool = getDraftableFactions(
      getFactionPool(result.settings.factionGameSets),
      result.availableMinorFactions,
      result.settings.allowedFactions,
      banned,
    );
    for (let attempt = 0; attempt < 20; attempt++) {
      if (result.settings.draftGameMode === "texasStyle" && result.texasDraft) {
        Object.assign(
          result.texasDraft,
          dealTexasFactionOptions(
            pool,
            result.players,
            result.settings.texasFactionHandSize ?? 2,
          ),
        );
        result.availableFactions = pool;
      } else {
        result.availableFactions = randomizeFactions(
          result.settings.numFactions,
          pool,
          result.settings.requiredFactions?.filter((f) => !banned.includes(f)),
          result.settings.factionStratification,
        );
        if (
          result.playerFactionPool &&
          result.settings.numPreassignedFactions !== undefined
        ) {
          const available = shuffle([...result.availableFactions]);
          for (const p of result.players)
            result.playerFactionPool[p.id] = available.splice(
              0,
              result.settings.numPreassignedFactions,
            );
        }
      }
      if (canCompleteFactionDraft(result)) break;
    }
    if (!canCompleteFactionDraft(result))
      throw new Error(
        "The faction pool after bans cannot complete this draft with a legal Keleres home. The ban was not saved. Choose a different ban or restore a checkpoint to revise the pools.",
      );
  }
  return result;
}
