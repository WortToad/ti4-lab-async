import { describe, expect, it } from "vitest";
import { rawSplicePool } from "./spliceCards";
import { rawReferenceCardPool, rawReferenceFaction } from "./referenceCards";

describe("physical Twilight's Fall cards", () => {
  it("includes all 87 abilities, 31 upgrades, and 31 genomes", () => {
    const pool = rawSplicePool();
    expect(pool.filter((item) => item.category === "TECH")).toHaveLength(87);
    expect(pool.filter((item) => item.category === "UNIT")).toHaveLength(31);
    expect(pool.filter((item) => item.category === "AGENT")).toHaveLength(31);
    expect(new Set(pool.map((item) => item.id)).size).toBe(149);
    expect(
      pool.find((item) => item.id === "AGENT:firmamentagent"),
    ).toMatchObject({
      undraftable: false,
    });
    expect(pool.every((item) => item.description.length > 0)).toBe(true);
  });

  it("removes exactly the rulebook's eight splice cards without PoK", () => {
    const pool = rawSplicePool(false);
    expect(pool.filter((item) => item.category === "TECH")).toHaveLength(84);
    expect(pool.filter((item) => item.category === "UNIT")).toHaveLength(28);
    expect(pool.filter((item) => item.category === "AGENT")).toHaveLength(29);
    expect(pool.some((item) => item.name === "Brutal Genome")).toBe(false);
    expect(pool.some((item) => item.name === "Curious Genome")).toBe(false);
  });

  it("provides all 30 reference cards and unique priorities", () => {
    expect(rawReferenceCardPool).toHaveLength(30);
    const priorities = rawReferenceCardPool.map(
      (id) => rawReferenceFaction(id).priorityOrder,
    );
    expect(priorities.sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    expect(rawReferenceFaction("keleres")).toMatchObject({
      priorityOrder: 23,
      fleetComposition: {
        infantry: 2,
        carrier: 2,
        fighter: 2,
        cruiser: 1,
        spacedock: 1,
      },
    });
  });
});
