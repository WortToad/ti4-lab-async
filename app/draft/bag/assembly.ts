import { getBagDraftItem, type BagDraftItem } from "./catalog";

export function availableAssemblyItemIds(
  options: BagDraftItem[],
  draftedItemIds: string[],
  selectedItemIds: string[],
) {
  const available = new Set(draftedItemIds);
  const selected = new Set(selectedItemIds);
  const items = new Map(options.map((item) => [item.id, item]));
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const item = items.get(id) ?? getBagDraftItem(id);
    for (const companion of item?.additionalComponents ?? []) visit(companion);
    for (const swap of item?.optionalSwaps ?? []) {
      if (!items.has(swap)) continue;
      available.add(swap);
      if (selected.has(swap)) visit(swap);
    }
  };
  draftedItemIds.filter((id) => selected.has(id)).forEach(visit);
  return available;
}

export function includeAssemblyCompanions(items: BagDraftItem[]) {
  const result = new Map(items.map((item) => [item.id, item]));
  const visit = (item: BagDraftItem) => {
    for (const id of item.additionalComponents ?? []) {
      if (result.has(id)) continue;
      const companion = getBagDraftItem(id);
      if (!companion) throw new Error(`Unknown draft item: ${id}.`);
      result.set(id, companion);
      visit(companion);
    }
  };
  items.forEach(visit);
  return [...result.values()];
}
