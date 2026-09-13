import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { factions } from "~/data/factionData";
import { BAG_CATALOG, getBagDraftItem, getBagDraftPool } from "./catalog";
import {
  getBagFaction,
  unitIconPath,
  playerUnitColor,
  bagKingUnitColor,
} from "./visuals";

describe("bag draft visual references", () => {
  it("resolves every standard unit in each player color to bundled artwork", () => {
    for (const playerColor of [
      "Red",
      "Yellow",
      "Blue",
      "Orange",
      "Purple",
      "Magenta",
      "Black",
      "Green",
    ] as const) {
      const color = playerUnitColor(playerColor)!;
      for (const unit of [
        "carrier",
        "cruiser",
        "destroyer",
        "dreadnought",
        "fighter",
        "flagship",
        "infantry",
        "mech",
        "pds",
        "spacedock",
        "warsun",
      ]) {
        const path = unitIconPath(unit, color)!;
        expect(path).toContain(`/units/kings/${color}_`);
        expect(existsSync(resolve("public", path.slice(1))), path).toBe(true);
      }
      expect(unitIconPath("monument", color)).toBe("/units/monument.png");
    }
    expect(playerUnitColor("Magenta")).toBe("pink");
    expect(playerUnitColor()).toBeUndefined();
    expect(playerUnitColor("unknown")).toBeUndefined();
    expect(unitIconPath("unknown", "red")).toBeUndefined();
  });

  it("colors assembled fleets only when exactly one king is known", () => {
    const fleet = getBagDraftItem("STARTINGFLEET:sol")!;
    const red = getBagDraftItem("MAHACTKING:redtf")!;
    const blue = getBagDraftItem("MAHACTKING:bluetf")!;
    expect(bagKingUnitColor([fleet, red])).toBe("red");
    expect(bagKingUnitColor([fleet])).toBeUndefined();
    expect(bagKingUnitColor([fleet, red, blue])).toBeUndefined();
  });

  it("reuses the lab's faction and Mahact king identities", () => {
    const examples = {
      "TECH:tf-armada": "barony",
      "AGENT:ghostagent": "creuss",
      "MAHACTKING:redtf": "redKing",
      "STARTINGFLEET:augers": "ilyxum",
      "STARTINGFLEET:zealots": "rhodun",
      "STARTINGFLEET:keleresa": "keleres",
    } as const;
    for (const [id, faction] of Object.entries(examples)) {
      const item = getBagDraftItem(id)!;
      expect(getBagFaction(item), id).toBe(faction);
      expect(item.factionIconPath, id).toBe(factions[faction].iconPath);
    }
    expect(getBagFaction({ faction: "not-a-faction" })).toBeUndefined();
  });

  it("keeps all bundled image references local and resolvable", () => {
    for (const item of BAG_CATALOG) {
      if (item.faction) expect(item.factionIconPath, item.id).toBeTruthy();
      if (item.systemId) expect(item.imagePath, item.id).toBeTruthy();
      for (const image of [
        item.factionIconPath,
        item.imagePath,
        item.twilightsFallImagePath,
      ]) {
        if (!image) continue;
        expect(image.startsWith("/"), item.id).toBe(true);
        expect(existsSync(resolve("public", image.slice(1))), image).toBe(true);
      }
      for (const { unit } of item.fleet ?? []) {
        const icon = unitIconPath(unit);
        expect(icon, `${item.id}: ${unit}`).toBeTruthy();
        expect(existsSync(resolve("public", icon!.slice(1))), icon).toBe(true);
      }
      if (item.unit) expect(unitIconPath(item.unit.type), item.id).toBeTruthy();
    }
  });

  it("uses the correct genome original without changing the Franken agent", () => {
    const agent = getBagDraftItem("AGENT:ghostagent")!;
    const genome = getBagDraftItem("AGENT:ghostagent", {
      twilightsFall: true,
    })!;
    expect(agent.imagePath).toBeUndefined();
    expect(genome.imagePath).toContain("/genome/enigmatic_genome.");
    expect(getBagFaction(genome)).toBe("creuss");
    const pool = getBagDraftPool({ twilightsFall: true });
    for (const item of pool.filter((item) => item.category === "UNIT")) {
      expect(item.imagePath, item.id).toContain("/unit_upgrade/");
      expect(item.unit, item.id).toBeDefined();
    }
  });

  it("aggregates fleets across planets and preserves unit combat dice", () => {
    expect(getBagDraftItem("STARTINGFLEET:argent")?.fleet).toContainEqual({
      unit: "infantry",
      count: 5,
    });
    expect(getBagDraftItem("STARTINGFLEET:naaz")?.fleet).toContainEqual({
      unit: "mech",
      count: 1,
    });
    const warSun = getBagDraftItem("UNIT:tf-pws")!.unit!;
    expect(warSun.type).toBe("warsun");
    expect(warSun.stats).toContainEqual({ label: "Combat", value: "3 × 3" });
    expect(warSun.abilities).toContain("Bombardment 3 × 3");
    expect(warSun.text).toContain("supernovas");
  });

  it("reuses padded home tile artwork and bundles available Franken upgrades", () => {
    expect(getBagDraftItem("HOMESYSTEM:sol")?.systemId).toBe("01");
    expect(getBagDraftItem("HOMESYSTEM:sol")?.imagePath).toBe(
      "/tiles/ST_1.png",
    );
    expect(getBagDraftItem("TECH:lw2")?.imagePath).toContain(
      "/techs/faction/letani_warrior_2.jpg",
    );
    expect(getBagDraftItem("TECH:lw2")?.unit?.type).toBe("infantry");
  });
});
