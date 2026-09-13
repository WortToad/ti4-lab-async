import type { Anomaly } from "~/types";

// Rules summaries: Living Rules Reference §§11, 41, 59, 86, and Thunder's Edge p. 11.
// https://images-cdn.fantasyflightgames.com/filer_public/51/55/51552c7f-c05c-445b-84bf-4b073456d008/ti10_pok_living_rules_reference_20_web.pdf
// https://images-cdn.fantasyflightgames.com/filer_public/ca/e7/cae7706f-cdb5-4ee1-a20c-7f76a13d135c/te_rulebook_web.pdf
export const anomalyDetails: Record<
  Anomaly,
  { label: string; description: string }
> = {
  ASTEROID_FIELD: {
    label: "Asteroid field",
    description:
      "Ships need Antimass Deflectors or another ability to enter or pass through.",
  },
  NEBULA: {
    label: "Nebula",
    description:
      "Ships cannot pass through. Ships starting here have a move value of 1 before bonuses. Defending ships get +1 to their space combat rolls.",
  },
  SUPERNOVA: {
    label: "Supernova",
    description:
      "Ships cannot enter or pass through unless an ability allows it.",
  },
  GRAVITY_RIFT: {
    label: "Gravity rift",
    description:
      "Moving out or through gives ships +1 move. Roll a die for each ship as it exits: on 1–3, remove it and any units it transports. Each rift grants its movement bonus only once per ship per movement.",
  },
  ENTROPIC_SCAR: {
    label: "Entropic scar",
    description:
      "Unit abilities cannot be used by or against units here; text abilities still work. Wormholes placed here are discarded. At the start of the status phase, if you have ships here, you may spend a strategy token to gain a faction technology.",
  },
};

/** Catalog descriptions use “Scar”, while the map data uses ENTROPIC_SCAR. */
export function anomalyFromLabel(label: string): Anomaly | undefined {
  const normalized = label.trim().toLowerCase();
  if (normalized === "scar") return "ENTROPIC_SCAR";
  return (Object.keys(anomalyDetails) as Anomaly[]).find(
    (anomaly) => anomalyDetails[anomaly].label.toLowerCase() === normalized,
  );
}
