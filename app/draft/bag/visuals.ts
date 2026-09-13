import { factions } from "~/data/factionData";
import { mahactKingReferences } from "~/data/mahactKingReferences";
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

const unitColors = [
  "red",
  "yellow",
  "blue",
  "orange",
  "purple",
  "pink",
  "black",
  "green",
] as const;
export type UnitColor = (typeof unitColors)[number];

export function playerUnitColor(color?: string): UnitColor | undefined {
  const normalized = color?.toLowerCase();
  return normalized === "magenta"
    ? "pink"
    : unitColors.find((value) => value === normalized);
}

export function bagKingUnitColor(items: BagDraftItem[]): UnitColor | undefined {
  const kings = items.filter((item) => item.category === "MAHACTKING");
  if (kings.length !== 1) return undefined;
  const faction = getBagFaction(kings[0]);
  return faction ? mahactKingReferences[faction]?.unitColor : undefined;
}

export function unitIconPath(unit: string, color?: UnitColor) {
  if (!Object.hasOwn(unitLabels, unit)) return undefined;
  if (color && unit !== "monument") return `/units/kings/${color}_${unit}.png`;
  return `/units/${unit}.png`;
}
