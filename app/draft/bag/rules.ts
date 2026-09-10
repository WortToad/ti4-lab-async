import type { BagLimits, BagRules, BagSettings, BagVariant } from "./types";

export const BAG_VARIANTS: {
  id: BagVariant;
  name: string;
  description: string;
}[] = [
  {
    id: "franken",
    name: "Franken",
    description:
      "Build a faction from individually drafted components. Pick three from your first bag, then two per pass; choose your final components afterwards.",
  },
  {
    id: "powered_franken",
    name: "Powered Franken",
    description:
      "Franken with four abilities and three faction technologies in each bag and final faction.",
  },
  {
    id: "onepick_franken",
    name: "One-pick Franken",
    description:
      "Standard Franken components, choosing one item from each bag on every pass.",
  },
  {
    id: "overdraft_franken",
    name: "Overdraft Franken",
    description:
      "Standard Franken bags; keep all drafted components instead of trimming to the normal faction limits.",
  },
  {
    id: "poweredonepick_franken",
    name: "Powered one-pick Franken",
    description:
      "Powered Franken component counts, with one pick from each bag.",
  },
  {
    id: "powered_overdraft_franken",
    name: "Powered overdraft Franken",
    description: "Powered Franken bags; keep all drafted components.",
  },
  {
    id: "frankendraz",
    name: "FrankenDraz",
    description:
      "Draft whole faction packages, tiles and speaker order. Build a custom faction from the components of your drafted factions. Defaults to six factions per bag; large games need a homebrew faction pack.",
  },
  {
    id: "twilights_fall",
    name: "Twilight’s Fall bag draft",
    description:
      "Draft Mahact kings, abilities, genomes, unit upgrades, home systems, fleets, tiles and speaker order. Keep two abilities, one genome and one unit upgrade.",
  },
  {
    id: "inaugural_splice",
    name: "Inaugural Splice",
    description:
      "Twilight’s Fall opening splice: seven-card bags with three abilities, two genomes and two unit upgrades. Pick one at a time, then keep two abilities, one genome and one unit upgrade.",
  },
  {
    id: "standard_bag_draft",
    name: "Standard bag draft",
    description:
      "Pass bags containing three blue tiles, two red tiles, a home system and speaker order. Keep all seven drafted items.",
  },
];

const standard: BagLimits = {
  ABILITY: 3,
  TECH: 2,
  AGENT: 2,
  COMMANDER: 2,
  HERO: 2,
  MECH: 2,
  FLAGSHIP: 2,
  COMMODITIES: 2,
  PN: 2,
  HOMESYSTEM: 2,
  STARTINGTECH: 2,
  STARTINGFLEET: 2,
  BREAKTHROUGH: 2,
  MONUMENT: 2,
  BLUETILE: 3,
  REDTILE: 2,
  DRAFTORDER: 1,
};
const standardKeep: BagLimits = Object.fromEntries(
  Object.entries(standard).map(([category, count]) => [
    category,
    ["ABILITY", "TECH", "BLUETILE", "REDTILE", "MONUMENT"].includes(category)
      ? count
      : 1,
  ]),
);

export function isTwilightsFallBag(variant: BagVariant) {
  return variant === "twilights_fall" || variant === "inaugural_splice";
}

export function getBagRules(settings: BagSettings): BagRules {
  const { variant } = settings;
  let draftLimits = { ...standard };
  let keepLimits = { ...standardKeep };
  let firstBagPicks = 3;
  let laterBagPicks = 2;
  if (variant.includes("powered")) {
    draftLimits.ABILITY = keepLimits.ABILITY = 4;
    draftLimits.TECH = keepLimits.TECH = 3;
  }
  if (variant.includes("overdraft")) keepLimits = { ...draftLimits };
  if (variant.includes("onepick") || variant === "inaugural_splice") {
    firstBagPicks = laterBagPicks = 1;
  }
  if (variant === "standard_bag_draft") {
    draftLimits = { BLUETILE: 3, REDTILE: 2, HOMESYSTEM: 1, DRAFTORDER: 1 };
    keepLimits = { ...draftLimits };
  }
  if (variant === "frankendraz") {
    draftLimits = { FACTION: 6, BLUETILE: 3, REDTILE: 2, DRAFTORDER: 1 };
    keepLimits = { ...standardKeep, ABILITY: 4, TECH: 3 };
    firstBagPicks = 2;
    laterBagPicks = 1;
  }
  if (isTwilightsFallBag(variant)) {
    draftLimits = { TECH: 3, AGENT: 2, UNIT: 2 };
    keepLimits = { TECH: 2, AGENT: 1, UNIT: 1 };
    if (variant === "twilights_fall") {
      Object.assign(draftLimits, {
        BLUETILE: 3,
        REDTILE: 2,
        STARTINGFLEET: 2,
        HOMESYSTEM: 2,
        DRAFTORDER: 1,
        MAHACTKING: 1,
      });
      Object.assign(keepLimits, {
        BLUETILE: 3,
        REDTILE: 2,
        STARTINGFLEET: 1,
        HOMESYSTEM: 1,
        DRAFTORDER: 1,
        MAHACTKING: 1,
      });
    }
  }
  for (const [category, limits] of Object.entries(
    settings.categoryLimits ?? {},
  )) {
    const key = category as keyof BagLimits;
    draftLimits[key] = limits.draft;
    keepLimits[key] = limits.keep;
  }
  if (settings.includeTiles === false) {
    for (const category of ["BLUETILE", "REDTILE", "DRAFTORDER"] as const) {
      delete draftLimits[category];
      delete keepLimits[category];
    }
  }
  if (!settings.includeMonuments) {
    delete draftLimits.MONUMENT;
    delete keepLimits.MONUMENT;
  }
  if (settings.includeThundersEdge === false) {
    delete draftLimits.BREAKTHROUGH;
    delete keepLimits.BREAKTHROUGH;
  }
  return {
    draftLimits,
    keepLimits,
    firstBagPicks: settings.firstBagPicks ?? firstBagPicks,
    laterBagPicks: settings.laterBagPicks ?? laterBagPicks,
  };
}
