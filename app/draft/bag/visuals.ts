import { factions } from "~/data/factionData";
import type { FactionId } from "~/types";
import type { BagDraftItem } from "./definitions";
import factionAliases from "./visualAliases.json";

const aliases: Record<string, string> = factionAliases;

export function getBagFaction(item: Pick<BagDraftItem, "faction">) {
  if (!item.faction) return undefined;
  const id = aliases[item.faction] ?? item.faction;
  return Object.hasOwn(factions, id) ? (id as FactionId) : undefined;
}

const unitLabels: Record<string, string> = {
  carrier: "Carrier",
  cruiser: "Cruiser",
  destroyer: "Destroyer",
  dreadnought: "Dreadnought",
  fighter: "Fighter",
  flagship: "Flagship",
  infantry: "Infantry",
  mech: "Mech",
  pds: "PDS",
  spacedock: "Space dock",
  warsun: "War sun",
  monument: "Monument",
};

export function unitLabel(unit: string) {
  return unitLabels[unit] ?? unit;
}

export type KingUnitColor =
  | "red"
  | "yellow"
  | "blue"
  | "orange"
  | "purple"
  | "pink"
  | "black"
  | "green";

export function unitIconPath(unit: string, color?: KingUnitColor) {
  if (color && (unit === "flagship" || unit === "mech"))
    return `/units/kings/${color}_${unit}.png`;
  return Object.hasOwn(unitLabels, unit) ? `/units/${unit}.png` : undefined;
}
