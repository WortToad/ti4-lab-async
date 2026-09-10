import { describe, expect, it } from "vitest";
import {
  BAG_CATALOG,
  BAG_BAN_PRESETS,
  CATEGORY_LABELS,
  getBagDraftItem,
  getBagDraftPool,
  getFactionComponents,
} from "./catalog";

describe("bundled bag draft catalog", () => {
  it("bundles both bot ban presets with resolvable components", () => {
    expect(BAG_BAN_PRESETS.map((preset) => preset.id)).toEqual([
      "weak_components",
      "op_components",
    ]);
    const overpowered = BAG_BAN_PRESETS.find(
      (preset) => preset.id === "op_components",
    );
    expect(overpowered?.itemIds).toContain("COMMANDER:mahactcommander_y");
    expect(overpowered?.itemIds).toContain("TECH:lw2");
    for (const preset of BAG_BAN_PRESETS) {
      for (const id of preset.itemIds)
        expect(getBagDraftItem(id), id).toBeDefined();
    }
  });
  it("has unique ids, readable cards, and complete errata references", () => {
    expect(new Set(BAG_CATALOG.map((item) => item.id)).size).toBe(
      BAG_CATALOG.length,
    );
    for (const item of BAG_CATALOG) {
      expect(item.id.startsWith(`${item.category}:`), item.id).toBe(true);
      expect(CATEGORY_LABELS[item.category], item.id).toBeTruthy();
      expect(item.name.trim(), item.id).toBeTruthy();
      expect(item.description.trim(), item.id).toBeTruthy();
      for (const dependency of [
        ...(item.additionalComponents ?? []),
        ...(item.optionalSwaps ?? []),
      ]) {
        expect(getBagDraftItem(dependency), `${item.id} -> ${dependency}`).toBe(
          BAG_CATALOG.find((candidate) => candidate.id === dependency),
        );
        expect(getBagDraftItem(dependency), dependency).toBeDefined();
      }
    }
  });

  it("applies Franken exclusions while preserving dependencies for assembly", () => {
    const pool = getBagDraftPool();
    expect(pool.some((item) => item.undraftable)).toBe(false);
    expect(pool.find((item) => item.id === "ABILITY:mitosis")).toBeUndefined();
    expect(getBagDraftItem("TECH:lw2")?.additionalComponents).toContain(
      "ABILITY:mitosis",
    );
    expect(getBagDraftItem("ABILITY:mitosis")?.description).toContain(
      "infantry",
    );
    expect(pool.some((item) => item.id === "ABILITY:imperia_y")).toBe(true);
    expect(pool.some((item) => item.id === "FACTION:obsidian")).toBe(false);
  });

  it("uses the Twilight's Fall decks, with the bot's genome exclusions", () => {
    const pool = getBagDraftPool({ twilightsFall: true });
    expect(pool.filter((item) => item.category === "TECH")).toHaveLength(87);
    expect(pool.filter((item) => item.category === "AGENT")).toHaveLength(25);
    expect(pool.filter((item) => item.category === "UNIT")).toHaveLength(31);
    expect(pool.find((item) => item.id === "UNIT:tf-dragonfreed")?.name).toBe(
      "The Dragon, Freed",
    );
    expect(pool.filter((item) => item.category === "MAHACTKING")).toHaveLength(
      8,
    );
    expect(pool.some((item) => item.category === "ABILITY")).toBe(false);
    expect(pool.find((item) => item.id === "TECH:tf-mitosis")?.name).toBe(
      "Mitosis",
    );
    expect(pool.find((item) => item.id === "AGENT:arborecagent")?.name).toBe(
      "Pacific Genome",
    );
    expect(
      pool.find((item) => item.id === "AGENT:ghostagent")?.description,
    ).toContain("non-home system");
    expect(pool.some((item) => item.id === "AGENT:muaatagent")).toBe(false);
    expect(getBagDraftItem("TECH:wavelength")?.description).toContain(
      "asteroid fields",
    );
    expect(getBagDraftItem("TECH:antimatter")?.description).toBeTruthy();
  });

  it("keeps Twilight's Fall display changes from mutating Franken cards", () => {
    const standard = getBagDraftItem("AGENT:ghostagent");
    const twilight = getBagDraftItem("AGENT:ghostagent", {
      twilightsFall: true,
    });
    expect(standard?.name).toBe("Emissary Taivra");
    expect(twilight?.name).toBe("Enigmatic Genome");
    expect(getBagDraftItem("AGENT:ghostagent")?.name).toBe("Emissary Taivra");
    expect(
      getBagDraftItem("STARTINGFLEET:muaat", { twilightsFall: true })
        ?.optionalSwaps,
    ).toBeUndefined();
    expect(getBagDraftItem("STARTINGFLEET:muaat")?.optionalSwaps).toContain(
      "AGENT:muaatagent",
    );
  });

  it("selects faction sets, expansion components, and monument pools", () => {
    const standard = getBagDraftPool({ includeThundersEdge: false });
    expect(standard.some((item) => item.faction === "axis")).toBe(false);
    expect(standard.some((item) => item.faction === "deepwrought")).toBe(false);
    expect(standard.some((item) => item.category === "BREAKTHROUGH")).toBe(
      false,
    );
    expect(standard.some((item) => item.category === "MONUMENT")).toBe(false);
    const expanded = getBagDraftPool({
      includeDiscordantStars: true,
      includeThundersEdge: true,
      includeMonuments: true,
    });
    expect(expanded.some((item) => item.id === "FACTION:axis")).toBe(true);
    expect(expanded.some((item) => item.id === "FACTION:deepwrought")).toBe(
      true,
    );
    expect(expanded.some((item) => item.category === "MONUMENT")).toBe(true);
    expect(
      expanded.some((item) => item.id === "MONUMENT:rhodun_monumentback"),
    ).toBe(false);
    const twilightDs = getBagDraftPool({
      twilightsFall: true,
      includeDiscordantStars: true,
    });
    expect(
      twilightDs.filter((item) => item.source === "twilight_ds"),
    ).toHaveLength(73);
  });

  it("expands FrankenDraz factions using legal replacement components", () => {
    const mahact = getFactionComponents("mahact");
    expect(mahact.some((item) => item.id === "ABILITY:imperia_y")).toBe(true);
    expect(
      mahact.some((item) => item.id === "COMMANDER:mahactcommander_y"),
    ).toBe(true);
    expect(mahact.some((item) => item.id === "MECH:mahact_mech_y")).toBe(true);
    expect(mahact.some((item) => item.undraftable)).toBe(false);
    expect(mahact.some((item) => item.category === "FACTION")).toBe(false);
    expect(getFactionComponents("missing-faction")).toEqual([]);
  });

  it("contains playable tiles and excludes home systems, Mecatol, and hyperlanes", () => {
    const tiles = getBagDraftPool().filter((item) =>
      ["BLUETILE", "REDTILE"].includes(item.category),
    );
    expect(
      tiles.find((item) => item.id === "BLUETILE:19")?.description,
    ).toContain("Wellon (1/2)");
    expect(
      tiles.find((item) => item.id === "REDTILE:41")?.description,
    ).toContain("Gravity rift");
    expect(
      tiles.some((item) => ["05", "18", "87a"].includes(item.systemId ?? "")),
    ).toBe(false);
  });
});
