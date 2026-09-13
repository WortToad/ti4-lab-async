import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BagSystemDescription } from "./BagSystemDescription";
import { getBagDraftItem } from "./catalog";

function renderSystem(id: string) {
  const item = getBagDraftItem(id)!;
  return renderToStaticMarkup(
    <MantineProvider>
      <BagSystemDescription
        systemId={item.systemId!}
        description={item.description}
      />
    </MantineProvider>,
  );
}

describe("draft system descriptions", () => {
  it("separates Industrex's ability from its system's asteroid field", () => {
    const html = renderSystem("REDTILE:115");
    const planets = html.match(/<ul\b[\s\S]*?<\/ul>/)![0];
    expect(planets).toContain('aria-label="Industrial"');
    expect(planets).toContain('aria-label="2 resources, 0 influence"');
    expect(planets).toContain('alt="WARFARE"');
    expect(planets).toContain('alt="Legendary"');
    expect(planets).toContain("— Aurex Mechanica: You may exhaust this card");
    expect(planets.replace(/<[^>]+>/g, "")).not.toContain(
      "technology specialty",
    );
    expect(planets).not.toContain("Asteroid field");
    expect(html.slice(html.indexOf("</ul>"))).toContain("Asteroid field");
    expect(html).toContain('aria-label="Asteroid field"');
    expect(html).toContain("Antimass Deflectors");
  });

  it("matches planets by name when their database order differs, including stations and mixed traits", () => {
    const html = renderSystem("BLUETILE:109");
    const rows = html.match(/<li\b[\s\S]*?<\/li>/g)!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Bellatrix");
    expect(rows[0]).toContain('aria-label="Cultural"');
    expect(rows[0]).toContain('aria-label="1 resources, 2 influence"');
    expect(rows[0]).not.toContain('alt="Space station"');
    expect(rows[1]).toContain("Tsion Station");
    expect(rows[1]).toContain('alt="Space station"');
    expect(renderSystem("BLUETILE:111")).toContain(
      'aria-label="Industrial / Cultural"',
    );
    expect(renderSystem("BLUETILE:103")).toContain("Vira-Pics III");
  });

  it("retains every planet and zero-valued stat in a three-planet system", () => {
    const html = renderSystem("BLUETILE:110");
    expect(html.match(/<li\b/g)).toHaveLength(3);
    expect(html).toContain('aria-label="1 resources, 2 influence"');
    expect(html).toContain('aria-label="2 resources, 0 influence"');
    expect(html).toContain('aria-label="3 resources, 1 influence"');
  });

  it("explains the gravity rift next to its symbol", () => {
    const html = renderSystem("REDTILE:41");
    expect(html).toContain('role="img" aria-label="Gravity rift"');
    expect(html).toContain("+1 move");
    expect(html).toContain("on 1–3, remove it and any units it transports");
  });

  it("recognizes catalog scars and displays their full name, symbol and effects", () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <BagSystemDescription systemId="unknown" description={"Scar\nNebula"} />
      </MantineProvider>,
    );
    expect(html).toContain('role="img" aria-label="Entropic scar"');
    expect(html).toContain(
      "Unit abilities cannot be used by or against units here",
    );
    expect(html).toContain("gain a faction technology");
    expect(html).toContain('role="img" aria-label="Nebula"');
    expect(html).toContain("Defending ships get +1");
  });

  it("preserves off-map home planets and systems with catalog-only IDs", () => {
    const home = renderSystem("HOMESYSTEM:ghost");
    expect(home).toContain("Creuss");
    expect(home).toContain('aria-label="4 resources, 2 influence"');
    expect(home).toContain('aria-label="Delta wormhole"');
    const catalogOnly = renderSystem("BLUETILE:d100");
    expect(catalogOnly).toContain("Silence");
    expect(catalogOnly).toContain('aria-label="Industrial"');
    expect(catalogOnly).toContain('alt="Legendary"');
    expect(catalogOnly).toContain("— Imperial Salvage Yard:");
    expect(renderSystem("REDTILE:d120")).toContain("Asteroid field");
    expect(renderSystem("REDTILE:d120")).toContain("Nebula");
  });

  it("keeps semicolons in a catalog-only legendary ability", () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <BagSystemDescription
          systemId="unknown"
          description="Test planet (0/3) — Hazardous; Biotic technology specialty; Special ability: Gain 1 token; then draw a card."
        />
      </MantineProvider>,
    );
    expect(html).toContain('aria-label="Hazardous"');
    expect(html).toContain('alt="BIOTIC"');
    expect(html).toContain('alt="Legendary"');
    expect(html).toContain(
      "— Special ability: Gain 1 token; then draw a card.",
    );
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("technology specialty");
  });
});
