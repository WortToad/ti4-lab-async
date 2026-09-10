import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BagMapSetup } from "./BagMapSetup";

type View = Parameters<typeof BagMapSetup>[0]["view"];

function renderSetup(overrides: Partial<View> = {}) {
  const view: View = {
    phase: "complete",
    ...overrides,
  };
  return renderToStaticMarkup(
    <MantineProvider>
      <MemoryRouter>
        <BagMapSetup view={view} mapPath="/draft/bag/source?key=player" />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("the next map step after a bag draft", () => {
  it("tells players that map building starts automatically after their final choices", () => {
    const html = renderSetup({ phase: "assembling" });
    expect(html).toContain("Next step: build the map");
    expect(html).toContain("Map building starts automatically");
    expect(html).not.toContain("Waiting for the host");
    expect(html).not.toContain("Build map from drafted tiles");
  });

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
