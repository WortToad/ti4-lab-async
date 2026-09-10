import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BagMapSetup } from "./BagMapSetup";
import { BAG_VARIANTS, getBagRules } from "./rules";

type Props = Parameters<typeof BagMapSetup>[0];

function renderSetup(overrides: Partial<Props> = {}) {
  const props: Props = {
    rules: getBagRules({ variant: "twilights_fall" }),
    playerCount: 6,
    phase: "complete",
    ...overrides,
  };
  return renderToStaticMarkup(
    <MantineProvider>
      <MemoryRouter>
        <BagMapSetup {...props} mapPath="/draft/bag/source?key=player" />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("the next map step after a bag draft", () => {
  it.each([3, 4, 5, 6, 7, 8])(
    "shows the %i-player map selected for the bag draft",
    (playerCount) => {
      const html = renderSetup({ playerCount });
      expect(html).toContain(
        `aria-label="${playerCount}-player map placement stages"`,
      );
      expect(html).not.toContain("standard six-player map");
    },
  );

  it("tells players that map building starts automatically after their final choices", () => {
    const html = renderSetup({
      phase: "assembling",
      mapBuildError:
        "Everyone must finish their faction before building the map.",
    });
    expect(html).toContain("Build the map with your drafted tiles");
    expect(html).toContain("Map building starts automatically");
    expect(html).not.toContain("Waiting for the host");
    expect(html).not.toContain("Build map from drafted tiles");
    expect(html).toContain(
      "builder randomly draws one of your remaining tiles",
    );
    expect(html).not.toContain(
      "Everyone must finish their faction before building the map.",
    );
  });

  it.each(["setup", "drafting"] as const)(
    "explains the map before faction assembly during %s",
    (phase) => {
      const html = renderSetup({ phase });
      expect(html).toContain("Build the map with your drafted tiles");
      expect(html).toContain("Each tile uses one of your normal bag picks");
      expect(html).toContain("Map building starts automatically");
    },
  );

  it.each(BAG_VARIANTS.filter(({ id }) => id !== "inaugural_splice"))(
    "shows the same accessible tile-to-map flow for $name",
    ({ id }) => {
      const html = renderSetup({
        phase: "setup",
        rules: getBagRules({ variant: id }),
      });
      expect(html).toContain(
        'aria-label="From drafted tiles to the shared map"',
      );
      expect(html).toContain(
        "These same five tiles go into your own hand for map building",
      );
      expect(html).toContain("Every tile in your hand will be placed");
      expect(html).toContain("you keep every map tile you drafted");
    },
  );

  it("explains selecting extras before the same five kept tiles enter map building", () => {
    const html = renderSetup({
      phase: "setup",
      rules: getBagRules({
        variant: "franken",
        categoryLimits: { BLUETILE: { draft: 4, keep: 3 } },
      }),
    });
    expect(html).toContain("4 blue + 2 red per player");
    expect(html).toContain("Choose exactly 3 blue + 2 red");
    expect(html).toContain("Discard the extras");
    expect(html).toContain("Map building starts automatically");
    expect(html).not.toContain("you keep every map tile you drafted");
  });

  it.each([
    { variant: "inaugural_splice" as const },
    { variant: "twilights_fall" as const, includeTiles: false },
    { variant: "franken" as const, includeTiles: false },
  ])("explains separate map setup when tiles are omitted: %o", (settings) => {
    const html = renderSetup({
      phase: "assembling",
      rules: getBagRules(settings),
      mapBuildError:
        "Everyone must finish their faction before building the map.",
    });
    expect(html).toContain("does not include map tiles");
    expect(html).toContain('href="/map-generator"');
    expect(html).not.toContain("Map building starts automatically");
    expect(html).not.toContain(
      'aria-label="From drafted tiles to the shared map"',
    );
  });

  it.each(["setup", "drafting", "assembling"] as const)(
    "explains incompatible settings during %s",
    (phase) => {
      const twoPlayers = renderSetup({ phase, playerCount: 2 });
      expect(twoPlayers).toContain("supports 3–8 players");
      expect(twoPlayers).not.toContain("Map building starts automatically");
      expect(twoPlayers).not.toContain(
        'aria-label="From drafted tiles to the shared map"',
      );

      const customTiles = renderSetup({
        phase,
        rules: getBagRules({
          variant: "twilights_fall",
          categoryLimits: { BLUETILE: { draft: 4, keep: 4 } },
        }),
      });
      expect(customTiles).toContain("collect up to 4 blue and 2 red");
      expect(customTiles).toContain("keep exactly 3 blue and 2 red tiles");
      expect(customTiles).not.toContain("Map building starts automatically");
      expect(customTiles).not.toContain(
        'aria-label="From drafted tiles to the shared map"',
      );
    },
  );

  it("explains when a draft cannot proceed to map building", () => {
    const html = renderSetup({
      mapBuildError: "Map building supports 3–8 players.",
    });
    expect(html).toContain("Map building supports 3–8 players.");
    expect(html).toContain('href="/map-generator"');
  });

  it("links every player to the saved map room", () => {
    const html = renderSetup({ mapRoomId: "shared-map" });
    expect(html).toContain('href="/draft/bag/source?key=player"');
    expect(html).toContain("Open map room");
    expect(html).not.toContain("Waiting for the host");
  });
});
