import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BagItemCard } from "./BagComponents";
import { getBagDraftItem } from "./catalog";

function renderItem(id: string, twilightsFall = false) {
  const item = getBagDraftItem(id, { twilightsFall })!;
  return renderToStaticMarkup(
    <MantineProvider>
      <MemoryRouter>
        <BagItemCard
          item={item}
          variant={twilightsFall ? "inaugural_splice" : "franken"}
        />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("bag component presentation", () => {
  it("preserves upgrade technology prerequisites alongside the ship and stats", () => {
    const html = renderItem("TECH:ac2");
    expect(html).toContain("/factions/ti_sol.png");
    expect(html).toContain("/units/carrier.png");
    expect(html).toContain("Prerequisites: BB");
    expect(html).toContain("SUSTAIN DAMAGE");
  });

  it("identifies a genome by its originating faction and contextual name", () => {
    const html = renderItem("AGENT:ghostagent", true);
    expect(html).toContain("/factions/ti_creuss.png");
    expect(html).toContain("Genomes");
    expect(html).toContain("Enigmatic Genome");
    expect(html).toContain("Original card");
  });
});
