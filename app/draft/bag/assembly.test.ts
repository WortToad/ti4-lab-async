import { describe, expect, it } from "vitest";
import {
  availableAssemblyItemIds,
  includeAssemblyCompanions,
} from "./assembly";
import { getBagDraftItem, type BagDraftItem } from "./catalog";

const item = (id: string) => getBagDraftItem(id)!;

describe("assembly selection availability", () => {
  const options = [
    item("ABILITY:star_forge"),
    item("ABILITY:telepathic"),
    item("MECH:sol_mech"),
    item("MECH:muaat_mech"),
  ];
  const drafted = options.slice(0, 3).map((entry) => entry.id);

  it("unlocks a replacement only while its granting component is selected", () => {
    expect(
      availableAssemblyItemIds(options, drafted, ["ABILITY:star_forge"]),
    ).toContain("MECH:muaat_mech");
    expect(
      availableAssemblyItemIds(options, drafted, [
        "ABILITY:telepathic",
        "MECH:muaat_mech",
      ]),
    ).not.toContain("MECH:muaat_mech");
  });

  it("keeps an independently drafted component available without its swap parent", () => {
    expect(
      availableAssemblyItemIds(options, [...drafted, "MECH:muaat_mech"], []),
    ).toContain("MECH:muaat_mech");
  });

  it("does not expose banned or disabled replacements missing from the options", () => {
    const available = availableAssemblyItemIds(options, drafted, [
      "ABILITY:star_forge",
    ]);
    expect(available).not.toContain("BREAKTHROUGH:muaatbt");
  });

  it("requires a connection to a drafted component for chained replacements", () => {
    const chained: BagDraftItem[] = [
      { ...item("ABILITY:star_forge"), optionalSwaps: ["MECH:muaat_mech"] },
      { ...item("MECH:muaat_mech"), optionalSwaps: ["MECH:sol_mech"] },
      { ...item("MECH:sol_mech"), optionalSwaps: ["MECH:muaat_mech"] },
    ];
    const selected = chained.map((entry) => entry.id);
    expect(
      availableAssemblyItemIds(chained, [selected[0]], selected),
    ).toContain("MECH:sol_mech");
    expect(
      availableAssemblyItemIds(chained, [selected[0]], selected.slice(1)),
    ).not.toContain("MECH:sol_mech");
  });
});

describe("final faction preview", () => {
  it("includes mandatory companions exactly once alongside the selected components", () => {
    const selected = [item("ABILITY:amalgamation"), item("ABILITY:riftmeld")];
    const final = includeAssemblyCompanions(selected);
    expect(final.map((entry) => entry.id)).toEqual([
      "ABILITY:amalgamation",
      "ABILITY:riftmeld",
      "ABILITY:devour",
    ]);
    expect(selected).toHaveLength(2);
  });

  it("does not apply Franken companions to Twilight’s Fall cards", () => {
    const selected = [
      getBagDraftItem("ABILITY:amalgamation", { twilightsFall: true })!,
    ];
    expect(includeAssemblyCompanions(selected)).toEqual(selected);
  });
});
