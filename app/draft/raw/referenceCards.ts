import { factions } from "~/data/factionData";
import type { Faction, FactionId } from "~/types";

// Thunder's Edge supplies one reference card per faction, including Keleres.
// The bundled bot's data/factions/keleres.json records its priority and fleet.
export const RAW_REFERENCE_OVERRIDES: Partial<
  Record<FactionId, Partial<Faction>>
> = {
  keleres: {
    priorityOrder: 23,
    fleetComposition: {
      infantry: 2,
      carrier: 2,
      fighter: 2,
      cruiser: 1,
      spacedock: 1,
    },
  },
};

export function rawReferenceFaction(id: FactionId, pok = true): Faction {
  const faction = { ...factions[id], ...RAW_REFERENCE_OVERRIDES[id] };
  if (!pok && faction.fleetComposition?.mech) {
    const fleetComposition = { ...faction.fleetComposition };
    delete fleetComposition.mech;
    return { ...faction, fleetComposition };
  }
  return faction;
}

export const rawReferenceCardPool = Object.values(factions)
  .filter((faction) => ["base", "pok", "te"].includes(faction.set))
  .map((faction) => faction.id)
  .filter((id) => rawReferenceFaction(id).priorityOrder !== undefined);
