import { describe, expect, it } from "vitest";
import { applyMantisAction, mantisBuildTurn } from "~/draft/mantis/engine";
import { bagMapBuildError, bagToMantisState } from "./bagToMantis";
import {
  applyBagAction,
  assemblyOptions,
  createBagState,
  draftableItems,
  keptBagItems,
  requiredBagPicks,
} from "./engine";

describe("Twilight's Fall Bag Draft of Everything", () => {
  it.each([3, 4, 5, 6, 7, 8])(
    "plays a %i-player draft through faction assembly and every map placement",
    (playerCount) => {
      let state = createBagState(
        {
          variant: "twilights_fall",
          players: Array.from({ length: playerCount }, (_, i) => `Player ${i}`),
        },
        () => 0.42,
      );
      const dealt = state.seats.flatMap((seat) => seat.bag).sort();
      expect(new Set(dealt).size).toBe(playerCount * 18);
      expect(state.rules).toEqual({
        draftLimits: {
          TECH: 3,
          AGENT: 2,
          UNIT: 2,
          BLUETILE: 3,
          REDTILE: 2,
          STARTINGFLEET: 2,
          HOMESYSTEM: 2,
          DRAFTORDER: 1,
          MAHACTKING: 1,
        },
        keepLimits: {
          TECH: 2,
          AGENT: 1,
          UNIT: 1,
          BLUETILE: 3,
          REDTILE: 2,
          STARTINGFLEET: 1,
          HOMESYSTEM: 1,
          DRAFTORDER: 1,
          MAHACTKING: 1,
        },
        firstBagPicks: 3,
        laterBagPicks: 2,
      });
      for (let step = 0; state.phase === "drafting" && step < 500; step++) {
        const seat = state.seats.find((player) => !player.ready)!;
        const selected: string[] = [];
        while (selected.length < requiredBagPicks(state, seat))
          selected.push(draftableItems(state, seat, selected)[0]);
        state = applyBagAction(state, seat.id, {
          action: "pick",
          round: state.round,
          itemIds: selected,
        });
      }
      expect(state.phase).toBe("assembling");
      expect(state.seats.flatMap((seat) => seat.hand).sort()).toEqual(dealt);
      for (const seat of state.seats) {
        const options = assemblyOptions(state, seat);
        const itemIds = Object.entries(state.rules.keepLimits).flatMap(
          ([category, limit]) =>
            options
              .filter((item) => item.category === category)
              .slice(0, limit)
              .map((item) => item.id),
        );
        state = applyBagAction(state, seat.id, { action: "assemble", itemIds });
      }
      expect(state.phase).toBe("complete");
      expect(bagMapBuildError(state)).toBeUndefined();
      let map = bagToMantisState(state, () => 0);
      expect(map.settings.mulligans).toBe(1);
      for (const seat of state.seats) {
        const items = keptBagItems(state, seat);
        expect(items).toHaveLength(13);
        expect(map.hands[seat.id]).toEqual(
          items
            .filter((item) => ["BLUETILE", "REDTILE"].includes(item.category))
            .map((item) => item.systemId),
        );
        expect(map.factionLabels?.[seat.id]).toBe(
          items.find((item) => item.category === "MAHACTKING")!.name,
        );
        expect(map.seats[seat.id]).toBe(
          Number(
            items
              .find((item) => item.category === "DRAFTORDER")!
              .id.split(":")[1],
          ) - 1,
        );
      }
      const draftedTiles = Object.values(map.hands).flat().sort();
      const first = mantisBuildTurn(map)!;
      const firstDraw = map.drawnTile;
      map = applyMantisAction(
        map,
        first.playerId,
        { type: "mulligan" },
        () => 0,
      );
      expect(map.drawnTile).not.toBe(firstDraw);
      expect(map.hands[first.playerId]).toContain(firstDraw);
      let placements = 0;
      while (map.phase === "build" && placements < 50) {
        const turn = mantisBuildTurn(map)!;
        map = applyMantisAction(
          map,
          turn.playerId,
          {
            type: "place",
            mapIdx: turn.positions[0],
          },
          () => 0,
        );
        placements++;
      }
      expect(placements).toBe(playerCount * 5);
      expect(map.phase).toBe("complete");
      expect(Object.values(map.hands).flat()).toEqual([]);
      expect(
        map.map
          .flatMap((tile) =>
            tile.type === "SYSTEM" && draftedTiles.includes(tile.systemId)
              ? [tile.systemId]
              : [],
          )
          .sort(),
      ).toEqual(draftedTiles);
    },
  );
});
