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

function renderedSeatTiles(html: string) {
  return Array.from(
    html.matchAll(
      /<g\b([^>]*)>\s*<title>(Seat [^<]+)<\/title>([\s\S]*?)<\/g>/g,
    ),
    ([, attributes, title, contents]) => ({
      title,
      attributes: Object.fromEntries(
        Array.from(
          attributes.matchAll(/([\w-]+)="([^"]*)"/g),
          ([, key, value]) => [key, value],
        ),
      ),
      label: contents.match(/<text\b[^>]*>(.*?)<\/text>/)?.[1] ?? "",
    }),
  );
}

function expectFocusedSlice(html: string, playerCount: number, seat: number) {
  const tiles = renderedSeatTiles(html);
  const numberedTiles = tiles.filter(({ label }) => /^[123]$/.test(label));
  expect(numberedTiles.map(({ label }) => label).sort()).toEqual([
    "1",
    "2",
    "2",
    "3",
    "3",
  ]);
  expect(
    numberedTiles.every(({ title }) => title.startsWith(`Seat ${seat + 1},`)),
  ).toBe(true);
  for (let homeSeat = 0; homeSeat < playerCount; homeSeat++) {
    expect(
      tiles.find(({ title }) => title === `Seat ${homeSeat + 1} home`)?.label,
    ).toBe(`H${homeSeat + 1}`);
  }
  for (const tile of tiles) {
    const focused = tile.title.match(/^Seat (\d+)/)?.[1] === String(seat + 1);
    expect(Number(tile.attributes.opacity)).toBe(focused ? 1 : 0.2);
  }
}

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
      expectFocusedSlice(html, playerCount, 0);
      const renderedTiles = new Map(
        renderedSeatTiles(html).map((tile) => [tile.title, tile]),
      );

      for (let placed = 0; placed < playerCount * 5; placed++) {
        const turn = mantisBuildTurn(state)!;
        const stage =
          placed < playerCount ? 1 : placed < playerCount * 3 ? 2 : 3;
        for (const position of turn.positions) {
          const { x, y } = state.map[position].position;
          const point = getHexPosition(x, y, 24, 2);
          const tile = renderedTiles.get(
            `Seat ${state.seats[turn.playerId] + 1}, stage ${stage}, map position ${position}`,
          );
          expect(tile?.attributes.transform).toBe(
            `translate(${point.x} ${point.y})`,
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

  it.each([3, 4, 5, 6, 7, 8])(
    "focuses the viewer's assigned seat in the %i-player diagram",
    (playerCount) => {
      const playerSeat = playerCount - 1;
      const html = renderToStaticMarkup(
        <MapBuildDiagram playerCount={playerCount} playerSeat={playerSeat} />,
      );
      expectFocusedSlice(html, playerCount, playerSeat);
      const selectedButton = html.match(
        /<button\b[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/,
      )?.[1];
      expect(selectedButton).toContain(`Seat ${playerCount} (you)`);
    },
  );
});
