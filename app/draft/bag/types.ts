import type { BagDraftItem, BagItemCategory } from "./catalog";

export type BagVariant =
  | "standard_bag_draft"
  | "franken"
  | "powered_franken"
  | "onepick_franken"
  | "overdraft_franken"
  | "poweredonepick_franken"
  | "powered_overdraft_franken"
  | "frankendraz"
  | "twilights_fall"
  | "inaugural_splice";

export type BagLimits = Partial<Record<BagItemCategory, number>>;

export type BagSettings = {
  variant: BagVariant;
  includeDiscordantStars?: boolean;
  includeThundersEdge?: boolean;
  includeBlueReverie?: boolean;
  includeLostLegacies?: boolean;
  includeTiles?: boolean;
  includeMonuments?: boolean;
  firstBagPicks?: number;
  laterBagPicks?: number;
  categoryLimits?: Partial<
    Record<BagItemCategory, { draft: number; keep: number }>
  >;
  bannedItemIds?: string[];
  bannedFactions?: string[];
  priorityFactions?: string[];
  shufflePlayers?: boolean;
};

export type CreateBagDraftInput = BagSettings & { players: string[] };

export type BagRules = {
  draftLimits: BagLimits;
  keepLimits: BagLimits;
  firstBagPicks: number;
  laterBagPicks: number;
};

export type BagSeat = {
  id: number;
  name: string;
  bag: string[];
  hand: string[];
  roundPicks: string[];
  ready: boolean;
  keptItemIds: string[];
  finished: boolean;
};

export type BagRoundSnapshot = { round: number; seats: BagSeat[] };

export type BagDraftState = {
  version: 1;
  settings: BagSettings;
  rules: BagRules;
  phase: "drafting" | "assembling" | "complete";
  round: number;
  revision: number;
  seats: BagSeat[];
  history: BagRoundSnapshot[];
};

export type BagDraftView = {
  id: string;
  settings: BagSettings;
  rules: BagRules;
  phase: BagDraftState["phase"];
  round: number;
  revision: number;
  players: {
    id: number;
    name: string;
    ready: boolean;
    finished: boolean;
    draftedCount: number;
    keptItems?: BagDraftItem[];
  }[];
  viewer: { isAdmin: boolean; playerId?: number };
  privateSeat?: {
    id: number;
    bag: BagDraftItem[];
    hand: BagDraftItem[];
    assemblyOptions: BagDraftItem[];
    keptItemIds: string[];
    roundPicks: string[];
    ready: boolean;
    finished: boolean;
    canUndo: boolean;
    picksRequired: number;
    draftableItemIds: string[];
  };
  seatLinks?: { id: number; name: string; path: string }[];
  canUndoRound: boolean;
  canBuildMap: boolean;
};

export type BagDraftAction =
  | { action: "pick"; round: number; itemIds: string[] }
  | { action: "undo"; round: number }
  | { action: "assemble"; itemIds: string[] }
  | { action: "reopen" }
  | { action: "undoRound"; revision: number };
