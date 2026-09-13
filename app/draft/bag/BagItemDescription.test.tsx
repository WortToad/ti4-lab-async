import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BagItemDescription } from "./BagItemDescription";
import { getBagDraftItem } from "./catalog";

function renderDescription(description: string, planetStats = true) {
  return renderToStaticMarkup(
    <MantineProvider>
      <BagItemDescription description={description} planetStats={planetStats} />
    </MantineProvider>,
  );
}

describe("component description symbols", () => {
  it("shows every planet's resource and influence values, including zeroes", () => {
    const item = getBagDraftItem("BLUETILE:110")!;
    const html = renderDescription(item.description);
    expect(html).toContain("Horizon ");
    expect(html).toContain('aria-label="1 resources, 2 influence"');
    expect(html).toContain('aria-label="2 resources, 0 influence"');
    expect(html).toContain('aria-label="3 resources, 1 influence"');
    expect(html).toContain("/symbols/resources.png");
    expect(html).not.toContain("(1/2)");
    expect(html).toContain("\n");
  });

  it("keeps feature descriptions and appends their matching symbols", () => {
    const html = renderDescription(
      "Beta wormhole\nPropulsion technology specialty; Epsilon wormhole",
    );
    expect(html).toMatch(/Beta wormhole <span[^>]*>/);
    expect(html).toContain('aria-label="Beta wormhole"');
    expect(html).toContain("Propulsion technology specialty ");
    expect(html).toContain("/propulsion.webp");
    expect(html).toContain('aria-label="Epsilon wormhole"');
  });

  it("renders repeated and mixed prerequisites while preserving surrounding rules", () => {
    const description =
      "Roll (1/2) dice.\nPrerequisites: YYRGBB. <special rules>";
    const html = renderDescription(description, false);
    expect(html).toContain("Roll (1/2) dice.\nPrerequisites: ");
    expect(html).toContain(". &lt;special rules&gt;");
    expect(html).not.toContain("YYRGBB");
    expect(
      [...html.matchAll(/alt="([A-Z]+)"/g)].map((match) => match[1]),
    ).toEqual([
      "CYBERNETIC",
      "CYBERNETIC",
      "WARFARE",
      "BIOTIC",
      "PROPULSION",
      "PROPULSION",
    ]);
  });
});
