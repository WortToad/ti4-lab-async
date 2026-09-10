import { factionSystems, systemData } from "~/data/systemData";
import type { FactionId } from "~/types";
import { createMantisMapBuild } from "~/draft/mantis/engine";
import { keptBagItems } from "./engine";
import { BAG_VARIANTS } from "./rules";
import type { BagDraftState } from "./types";

const factionAliases: Record<string, FactionId> = {
  ghost: "creuss",
  ghosts: "creuss",
  letnev: "barony",
  cabal: "vulraith",
  naaz: "naazrokha",
  deepwrought: "dws",
  augers: "ilyxum",
  mykomentori: "myko",
  rohdhna: "rohdina",
  zealots: "rhodun",
  keleresa: "keleres",
};

function knownSystemId(id: string | undefined) {
  if (!id) return undefined;
  if (systemData[id]) return id;
  const normalized = /^\d+$/.test(id) ? String(Number(id)) : id;
  return systemData[normalized] ? normalized : undefined;
}

/** Carry a completed component draft into the map builder without redrafting. */
export function bagToMantisState(state: BagDraftState, random = Math.random) {
  if (
    state.phase !== "complete" ||
    state.seats.some((seat) => !seat.finished)
  ) {
    throw new Error(
      "Everyone must finish their faction before building the map.",
    );
  }
  if (
    !(state.rules.keepLimits.BLUETILE ?? 0) &&
    !(state.rules.keepLimits.REDTILE ?? 0)
  ) {
    throw new Error(
      "This draft does not include map tiles. Use an existing map or create one in the map generator.",
    );
  }
  if (state.seats.length < 3 || state.seats.length > 8) {
    throw new Error("Map building supports 3–8 players.");
  }
  const hands: Record<number, string[]> = {};
  const homeSystems: Record<number, string> = {};
  const factionLabels: Record<number, string> = {};
  const speakerOrders = new Map<number, number>();
  const notes: string[] = [];
  const variantName =
    BAG_VARIANTS.find((variant) => variant.id === state.settings.variant)
      ?.name ?? "Custom faction";
  for (const seat of state.seats) {
    const items = keptBagItems(state, seat);
    const tiles = items.filter(
      (item) => item.category === "BLUETILE" || item.category === "REDTILE",
    );
    hands[seat.id] = tiles.map((tile) => {
      const systemId = knownSystemId(tile.systemId);
      if (!systemId)
        throw new Error(
          `The map builder does not have ${tile.name}. Choose a supported tile before building the map.`,
        );
      return systemId;
    });
    const homes = items.filter((item) => item.category === "HOMESYSTEM");
    const factionId =
      homes.length === 1 && homes[0].faction
        ? (factionAliases[homes[0].faction] ?? (homes[0].faction as FactionId))
        : undefined;
    const homeSystem =
      homes.length === 1
        ? ((factionId ? factionSystems[factionId]?.id : undefined) ??
          knownSystemId(homes[0].systemId))
        : undefined;
    if (homeSystem && systemData[homeSystem].type === "GREEN")
      homeSystems[seat.id] = homeSystem;
    else
      notes.push(
        `${seat.name}: a home placeholder is shown. Use ${homes.length ? homes.map((item) => item.name).join(" or ") : "your chosen home system"} when setting up the game.`,
      );
    const king = items.find((item) => item.category === "MAHACTKING");
    factionLabels[seat.id] =
      king?.name ??
      (state.settings.variant === "standard_bag_draft" && homes.length === 1
        ? (homes[0].factionName ?? homes[0].name)
        : variantName);
    const orderItem = items.find((item) => item.category === "DRAFTORDER");
    if (orderItem)
      speakerOrders.set(seat.id, Number(orderItem.id.split(":")[1]));
  }
  const hasSpeakerOrder =
    speakerOrders.size === state.seats.length &&
    new Set(speakerOrders.values()).size === state.seats.length &&
    [...speakerOrders.values()].every(
      (order) =>
        Number.isInteger(order) && order >= 1 && order <= state.seats.length,
    );
  const seatOrder = hasSpeakerOrder
    ? [...state.seats]
        .sort((a, b) => speakerOrders.get(a.id)! - speakerOrders.get(b.id)!)
        .map((seat) => seat.id)
    : state.seats.map((seat) => seat.id);
  if (!hasSpeakerOrder)
    notes.push(
      "No complete speaker order was drafted; the listed player order is used for seating and map building.",
    );
  const mapBuild = createMantisMapBuild(
    {
      players: state.seats.map(({ id, name }) => ({ id, name })),
      hands,
      homeSystems,
      seatOrder,
      factionLabels,
    },
    random,
  );
  mapBuild.log.push(...notes);
  return mapBuild;
}

export function bagMapBuildError(state: BagDraftState): string | undefined {
  try {
    bagToMantisState(state, () => 0);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Unable to build this map.";
  }
}
