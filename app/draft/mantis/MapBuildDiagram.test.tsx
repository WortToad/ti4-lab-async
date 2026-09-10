import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { systemData } from "~/data/systemData";
import { getHexPosition } from "~/utils/positioning";
import {
  applyMantisAction,
  createMantisMapBuild,
  mantisBuildTurn,
} from "./engine";
import { MapBuildDiagram } from "./MapBuildDiagram";

describe("map placement instructions", () => {
  it.each([3, 4, 5, 6, 7, 8])(
    "shows the positions and stages used by the %i-player builder",
    (playerCount) => {
      const players = Array.from({ length: playerCount }, (_, id) => ({
        id,
        name: `Player ${id + 1}`,
      }));
      const blues = Object.values(systemData).filter(
        (system) => system.type === "BLUE",
      );
      const reds = Object.values(systemData).filter(
        (system) => system.type === "RED",
      );
      let state = createMantisMapBuild(
        {
          players,
          seatOrder: players.map(({ id }) => id),
          hands: Object.fromEntries(
            players.map(({ id }) => [
              id,
              [
                ...blues.slice(id * 3, id * 3 + 3),
                ...reds.slice(id * 2, id * 2 + 2),
              ].map((system) => system.id),
            ]),
          ),
        },
        () => 0,
      );
      const html = renderToStaticMarkup(
        <MapBuildDiagram playerCount={playerCount} />,
      );
      expect(html).toContain(
        `aria-label="${playerCount}-player map placement stages"`,
      );
      expect(html.match(/<title>Seat \d+ home<\/title>/g)).toHaveLength(
        playerCount,
      );
      expect(html.match(/<title>Seat \d+, stage/g)).toHaveLength(
        playerCount * 5,
      );
      expect(html).not.toContain("Six-player example");
      expect(html).not.toContain("Other player counts");
      expect(html.includes("Blue lines: fixed hyperlanes")).toBe(
        playerCount !== 6,
      );

      for (let placed = 0; placed < playerCount * 5; placed++) {
        const turn = mantisBuildTurn(state)!;
        const stage =
          placed < playerCount ? 1 : placed < playerCount * 3 ? 2 : 3;
        for (const position of turn.positions) {
          const { x, y } = state.map[position].position;
          const point = getHexPosition(x, y, 24, 2);
          expect(html).toContain(
            `<g transform="translate(${point.x} ${point.y})"><title>Seat ${state.seats[turn.playerId] + 1}, stage ${stage}, map position ${position}</title>`,
          );
        }
        state = applyMantisAction(
          state,
          turn.playerId,
          { type: "place", mapIdx: turn.positions[0] },
          () => 0,
        );
      }
      expect(state.phase).toBe("complete");
    },
  );
});
