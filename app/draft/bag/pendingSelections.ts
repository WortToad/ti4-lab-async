import { availableAssemblyItemIds } from "./assembly";
import type { BagDraftItem, BagItemCategory } from "./catalog";
import type { BagDraftView, BagLimits } from "./types";

export type BagSelectionConfig = {
  phase: "drafting" | "assembling";
  round: number;
  variant: BagDraftView["settings"]["variant"];
  items: BagDraftItem[];
  baseIds: string[];
  legalIds: string[];
  handIds: string[];
  committedIds: string[];
  limits: BagLimits;
  required: number;
};

const genericTechIds = new Set(["TECH:wavelength", "TECH:antimatter"]);

export function getBagSelectionConfig(
  view: BagDraftView,
): BagSelectionConfig | null {
  const seat = view.privateSeat;
  if (
    !seat ||
    !view.lobby.ownUuid ||
    view.viewer.playerId !== seat.id ||
    (view.phase !== "drafting" && view.phase !== "assembling") ||
    (view.phase === "drafting" ? seat.ready : seat.finished)
  )
    return null;
  return {
    phase: view.phase,
    round: view.round,
    variant: view.settings.variant,
    items: view.phase === "drafting" ? seat.bag : seat.assemblyOptions,
    baseIds: seat.assemblyBaseItemIds,
    legalIds: seat.draftableItemIds,
    handIds: seat.hand.map((item) => item.id),
    committedIds: seat.keptItemIds,
    limits:
      view.phase === "drafting"
        ? view.rules.draftLimits
        : view.rules.keepLimits,
    required: seat.picksRequired,
  };
}

export function validatePendingBagSelection(
  config: BagSelectionConfig,
  ids: unknown,
): string[] {
  if (!Array.isArray(ids)) return [];
  const items = new Map(config.items.map((item) => [item.id, item]));
  const legal = new Set(config.legalIds);
  const counts = new Map<BagItemCategory, number>();
  const twilightsFall =
    config.variant === "twilights_fall" ||
    config.variant === "inaugural_splice";
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || result.includes(id)) continue;
    const item = items.get(id);
    if (!item) continue;
    const generic =
      config.phase === "assembling" && twilightsFall && genericTechIds.has(id);
    const count = counts.get(item.category) ?? 0;
    const collected = config.handIds.filter((handId) =>
      handId.startsWith(`${item.category}:`),
    ).length;
    if (config.phase === "drafting") {
      if (!legal.has(id) || result.length >= config.required) continue;
      if (item.category !== "FACTION" && count > 0) continue;
      if (collected + count >= (config.limits[item.category] ?? 0)) continue;
    } else if (!generic && count >= (config.limits[item.category] ?? 0)) {
      continue;
    }
    result.push(id);
    if (!generic) counts.set(item.category, count + 1);
  }
  if (config.phase === "assembling" && !twilightsFall) {
    const available = availableAssemblyItemIds(
      config.items,
      config.baseIds,
      result,
    );
    return result.filter((id) => available.has(id));
  }
  return result;
}

export function defaultBagSelection(config: BagSelectionConfig): string[] {
  if (config.phase === "drafting") {
    return config.legalIds.length === config.required
      ? [...config.legalIds]
      : [];
  }
  if (config.committedIds.length > 0)
    return validatePendingBagSelection(config, config.committedIds);
  const groups = new Map<BagItemCategory, BagDraftItem[]>();
  for (const item of config.items) {
    if (genericTechIds.has(item.id)) continue;
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }
  return validatePendingBagSelection(
    config,
    [...groups].flatMap(([category, items]) =>
      items.length <= (config.limits[category] ?? 0)
        ? items.map((item) => item.id)
        : [],
    ),
  );
}

export function restorePendingBagSelection(
  raw: string | null,
  owner: string,
  config: BagSelectionConfig,
): string[] {
  try {
    const snapshot: unknown = JSON.parse(raw ?? "null");
    if (
      snapshot &&
      typeof snapshot === "object" &&
      "version" in snapshot &&
      snapshot.version === 1 &&
      "owner" in snapshot &&
      snapshot.owner === owner &&
      "context" in snapshot &&
      snapshot.context === JSON.stringify(config) &&
      "ids" in snapshot
    )
      return validatePendingBagSelection(config, snapshot.ids);
  } catch {
    // A missing or corrupt saved selection must never prevent drafting.
  }
  return defaultBagSelection(config);
}

export function serializePendingBagSelection(
  owner: string,
  config: BagSelectionConfig,
  ids: string[],
) {
  return JSON.stringify({
    version: 1,
    owner,
    context: JSON.stringify(config),
    ids,
  });
}
