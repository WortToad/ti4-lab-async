import catalogData from "./catalog.json";

import type { BagDraftItem } from "./definitions";
export { CATEGORY_LABELS } from "./definitions";
export type { BagDraftItem, BagItemCategory } from "./definitions";

export const BAG_CATALOG = catalogData.items as BagDraftItem[];
export const BAG_BAN_PRESETS: {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
}[] = catalogData.banPresets;
const itemsById = new Map(BAG_CATALOG.map((item) => [item.id, item]));
const factionComponents = catalogData.factionComponents as Record<
  string,
  string[]
>;

export type BagCatalogOptions = {
  twilightsFall?: boolean;
  includeDiscordantStars?: boolean;
  includeThundersEdge?: boolean;
  includeMonuments?: boolean;
  includeBlueReverie?: boolean;
  includeLostLegacies?: boolean;
  includeUnchartedSpace?: boolean;
};

function withContext(
  item: BagDraftItem,
  options: Pick<BagCatalogOptions, "twilightsFall">,
): BagDraftItem {
  if (!options.twilightsFall) return item;
  return {
    ...item,
    name: item.twilightsFallName ?? item.name,
    imagePath: item.twilightsFallImagePath ?? item.imagePath,
    description:
      item.twilightsFallDescription ??
      item.originalDescription ??
      item.description,
    additionalComponents: undefined,
    optionalSwaps: undefined,
  };
}

export function getBagDraftItem(
  id: string,
  options: Pick<BagCatalogOptions, "twilightsFall"> = {},
): BagDraftItem | undefined {
  const item = itemsById.get(id);
  return item ? withContext(item, options) : undefined;
}

function sourceEnabled(source: string, options: BagCatalogOptions): boolean {
  switch (source) {
    case "ds":
    case "twilight_ds":
      return options.includeDiscordantStars ?? false;
    case "blue_reverie":
      return options.includeBlueReverie ?? false;
    case "theodisi":
      return options.includeLostLegacies ?? false;
    case "uncharted_space":
      return options.includeUnchartedSpace ?? false;
    case "thunders_edge":
      return options.includeThundersEdge ?? true;
    default:
      return true;
  }
}

export function getBagDraftPool(
  options: BagCatalogOptions = {},
): BagDraftItem[] {
  const pool = options.twilightsFall ? "twilights_fall" : "franken";
  return BAG_CATALOG.filter((item) => {
    if (!item.pools.includes(pool)) return false;
    if (item.category === "MONUMENT" && !options.includeMonuments) return false;
    if (
      item.category === "BREAKTHROUGH" &&
      options.includeThundersEdge === false
    )
      return false;
    if (
      options.twilightsFall &&
      ["TECH", "AGENT", "UNIT", "MAHACTKING"].includes(item.category)
    ) {
      return sourceEnabled(item.source, {
        ...options,
        includeThundersEdge: true,
      });
    }
    return (
      sourceEnabled(item.source, options) &&
      sourceEnabled(item.factionSource ?? item.source, options)
    );
  }).map((item) => withContext(item, options));
}

export function getFactionComponents(
  factionAlias: string,
  options: BagCatalogOptions = {},
): BagDraftItem[] {
  return (factionComponents[factionAlias] ?? []).flatMap((id) => {
    const item = itemsById.get(id);
    if (!item || item.undraftable) return [];
    if (item.category === "MONUMENT" && !options.includeMonuments) return [];
    if (
      item.category === "BREAKTHROUGH" &&
      options.includeThundersEdge === false
    )
      return [];
    return [withContext(item, options)];
  });
}

export function resolveBagItems(
  ids: string[],
  options: Pick<BagCatalogOptions, "twilightsFall"> = {},
): BagDraftItem[] {
  return ids.flatMap((id) => {
    const item = getBagDraftItem(id, options);
    return item ? [item] : [];
  });
}
