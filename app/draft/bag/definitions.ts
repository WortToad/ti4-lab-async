export type BagItemCategory =
  | "FACTION"
  | "ABILITY"
  | "TECH"
  | "AGENT"
  | "COMMANDER"
  | "HERO"
  | "MECH"
  | "FLAGSHIP"
  | "COMMODITIES"
  | "PN"
  | "HOMESYSTEM"
  | "STARTINGTECH"
  | "STARTINGFLEET"
  | "BLUETILE"
  | "REDTILE"
  | "DRAFTORDER"
  | "MAHACTKING"
  | "UNIT"
  | "MONUMENT"
  | "BREAKTHROUGH"
  | "PLOT";

export type BagDraftItem = {
  id: string;
  category: BagItemCategory;
  name: string;
  description: string;
  source: string;
  pools: ("franken" | "twilights_fall")[];
  faction?: string;
  factionName?: string;
  factionSource?: string;
  systemId?: string;
  additionalComponents?: string[];
  optionalSwaps?: string[];
  undraftable?: boolean;
  originalDescription?: string;
  twilightsFallName?: string;
  twilightsFallDescription?: string;
  factionIconPath?: string;
  imagePath?: string;
  twilightsFallImagePath?: string;
  technologyTypes?: string[];
  fleet?: { unit: string; count: number }[];
  unit?: {
    type: string;
    stats: { label: string; value: string }[];
    abilities: string[];
    text: string;
  };
};

export const CATEGORY_LABELS: Record<BagItemCategory, string> = {
  FACTION: "Faction",
  ABILITY: "Faction ability",
  TECH: "Faction technology",
  AGENT: "Agent",
  COMMANDER: "Commander",
  HERO: "Hero",
  MECH: "Mech",
  FLAGSHIP: "Flagship",
  COMMODITIES: "Commodities",
  PN: "Promissory note",
  HOMESYSTEM: "Home system",
  STARTINGTECH: "Starting technology",
  STARTINGFLEET: "Starting fleet",
  BLUETILE: "Blue tile",
  REDTILE: "Red tile",
  DRAFTORDER: "Speaker order",
  MAHACTKING: "Mahact king",
  UNIT: "Unit upgrade",
  MONUMENT: "Monument",
  BREAKTHROUGH: "Breakthrough",
  PLOT: "Plot",
};
