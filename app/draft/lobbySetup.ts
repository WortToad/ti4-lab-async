import type { Player } from "~/types";

export function parseLobbyPlayerCount(
  value: string | null | undefined,
  min = 3,
  max = 8,
  fallback = 6,
): number {
  const count = value?.trim() ? Number(value) : fallback;
  return Math.min(
    max,
    Math.max(min, Number.isInteger(count) && count > 0 ? count : fallback),
  );
}

export function makeLobbyPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    name: `Player ${id + 1}`,
  }));
}
