import { MantineProvider } from "@mantine/core";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, test } from "vitest";
import { SystemTileCard } from "./SystemTileCard";

function renderCard(
  props: Partial<ComponentProps<typeof SystemTileCard>> = {},
  originalArt = false,
) {
  return renderToStaticMarkup(
    <MantineProvider>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={{ originalArt }} />}>
            <Route
              index
              element={<SystemTileCard systemId="26" radius={60} {...props} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("SystemTileCard artwork", () => {
  test("follows the draft's art preference and preserves the requested size", () => {
    const lab = renderCard();
    expect(lab).toContain("Lodor");
    expect(lab).not.toContain("/tiles/ST_26.png");

    const original = renderCard({}, true);
    expect(original).toContain("/tiles/ST_26.png");
    expect(original).toContain('width="120" height="120"');
  });

  test("allows an explicit art preference without changing the shared setting", () => {
    expect(renderCard({ originalArt: false }, true)).toContain("Lodor");
    expect(renderCard({ originalArt: true })).toContain("/tiles/ST_26.png");
  });

  test("uses supplied tile artwork in Originals while preserving Simplified", () => {
    const props = { imagePath: "/draft/tiles/lodor.png" };
    expect(renderCard(props, true)).toContain("/draft/tiles/lodor.png");
    expect(renderCard(props, true)).not.toContain("/tiles/ST_26.png");
    expect(renderCard(props)).toContain("Lodor");
    expect(renderCard(props)).not.toContain("/draft/tiles/lodor.png");
  });

  test("recognizes zero-padded bot system IDs in both art modes", () => {
    const lab = renderCard({ systemId: "026" });
    expect(lab).toContain("Lodor");
    expect(lab).not.toContain("System 026");
    expect(renderCard({ systemId: "026" }, true)).toContain("/tiles/ST_26.png");
  });

  test("keeps face-down tiles hidden in either art mode", () => {
    for (const originalArt of [false, true]) {
      const hidden = renderCard({ faceDown: true }, originalArt);
      expect(hidden).not.toContain("Lodor");
      expect(hidden).not.toContain("/tiles/ST_26.png");
      expect(hidden).not.toContain("System value");
      expect(hidden).not.toContain("Optimal spend");
    }
  });

  test("shows legendary scoring and the shared feature icon in either art mode", () => {
    for (const originalArt of [false, true]) {
      const html = renderCard({ systemId: "66" }, originalArt);
      expect(html).toContain('aria-label="System value 5"');
      expect(html).toContain(
        "Optimal spend: 3 resources, 0 influence, 0 flex; 3 total",
      );
      expect(html).toContain('alt="Legendary"');
    }
  });

  test("supports bot artwork and a readable fallback for unknown systems", () => {
    const imported = renderCard({
      systemId: "bot-only",
      imagePath: "/draft/cards/example.png",
    });
    expect(imported).toContain('alt="System bot-only"');
    expect(imported).toContain("/draft/cards/example.png");
    expect(renderCard({ systemId: "bot-only" })).toContain("System bot-only");
  });
});
