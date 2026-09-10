import type { FactionId, Map, Player } from "~/types";

export type RawSettings = {
  players: Player[];
  mode: "base" | "twilightsFall";
  pok: boolean;
  te: boolean;
  /** Defaults to the rulebook's standard layout for this player count. */
  layout?: string;
  shuffleSeats?: boolean;
};

export type RawPhase =
  | "factions"
  | "referenceDraft"
  | "priority"
  | "mapPreplace"
  | "map"
  | "homes"
  | "kings"
  | "splice"
  | "spliceKeep"
  | "complete";

export type RawReferenceHand = {
  hand: FactionId[];
  drafted: FactionId[];
  ready: boolean;
  priority?: FactionId;
};

export type RawSpliceHand = {
  hand: string[];
  drafted: string[];
  ready: boolean;
  kept?: string[];
};

export type RawSnapshot = {
  phase: RawPhase;
  players: Player[];
  /** Clockwise player IDs, beginning with the speaker. */
  order: number[];
  speaker: number;
  map: Map;
  hands: Record<number, string[]>;
  /** Extra tiles placed by the speaker next to Mecatol before regular placement. */
  preplace: string[];
  turn: number;
  factions: Record<number, FactionId>;
  references: Record<number, RawReferenceHand>;
  referenceRound: number;
  /** Undealt cards, used for the Keleres home-system replacement. */
  referenceDeck: FactionId[];
  priorities: Record<number, FactionId>;
  homes: Record<number, FactionId>;
  fleets: Record<number, FactionId>;
  kings: Record<number, FactionId>;
  splice: Record<number, RawSpliceHand>;
  spliceRound: number;
  tradeGoods: Record<number, number>;
  log: string[];
};

export type RawState = RawSnapshot & {
  version: 1;
  settings: RawSettings;
  revision: number;
  history: RawSnapshot[];
};

export type RawAction =
  | { type: "chooseFaction"; playerId: number; factionId: FactionId }
  | { type: "pickReference"; playerId: number; factionId: FactionId }
  | { type: "choosePriority"; playerId: number; factionId: FactionId }
  | {
      type: "placeSystem";
      playerId: number;
      systemId: string;
      position: number;
    }
  | { type: "chooseHome"; playerId: number; factionId: FactionId }
  | { type: "chooseKing"; playerId: number; factionId: FactionId }
  | { type: "pickSplice"; playerId: number; itemId: string }
  | { type: "keepSplice"; playerId: number; itemIds: string[] };

export type RawLayout = {
  id: string;
  label: string;
  description: string;
  players: number;
  blue: number;
  red: number;
  rings: 3 | 4;
  homes: number[];
  closed: number[];
  preset: Record<number, { systemId: string; rotation?: number }>;
  extraBlue?: number;
  extraRed?: number;
  tradeGoods?: number[];
};
