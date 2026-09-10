import { describe, expect, it } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { systemData } from "~/data/systemData";
import { bagMapBuildError, bagToMantisState } from "./bagToMantis";
import { BAG_CATALOG } from "./catalog";
import { createBagState } from "./engine";

function completedBag() {
  const state = createBagState(
    {
      variant: "standard_bag_draft",
      players: ["Ada", "Bea", "Cal", "Dee"],
      includeThundersEdge: false,
      shufflePlayers: false,
    },
    () => 0.42,
  );
  const blues = BAG_CATALOG.filter(
    (item) =>
      item.category === "BLUETILE" &&
      item.systemId &&
      systemData[item.systemId]?.type === "BLUE",
  ).slice(0, 12);
  const reds = BAG_CATALOG.filter(
    (item) =>
      item.category === "REDTILE" &&
      item.systemId &&
      systemData[item.systemId]?.type === "RED",
  ).slice(0, 8);
  state.phase = "complete";
  for (const seat of state.seats) {
    seat.hand = [
      ...blues.slice(seat.id * 3, seat.id * 3 + 3),
      ...reds.slice(seat.id * 2, seat.id * 2 + 2),
    ].map((item) => item.id);
    seat.hand.push(`DRAFTORDER:${4 - seat.id}`);
    seat.keptItemIds = [...seat.hand];
    seat.finished = true;
  }
  return state;
}

describe("completed bag to map building", () => {
  it("preserves players and drafted tiles, uses speaker order, and does not mutate the draft", () => {
    const bag = completedBag();
    const original = structuredClone(bag);
    const map = bagToMantisState(bag, () => 0);
    expect(map.phase).toBe("build");
    expect(map.players).toEqual(
      bag.seats.map(({ id, name }) => ({ id, name })),
    );
    expect(map.order).toEqual([3, 2, 1, 0]);
    for (const seat of bag.seats)
      expect(map.hands[seat.id]).toEqual(
        seat.hand
          .filter((id) => !id.startsWith("DRAFTORDER:"))
          .map((id) => BAG_CATALOG.find((item) => item.id === id)!.systemId),
      );
    expect(map.seats[3]).toBe(0);
    expect(bag).toEqual(original);
  });

  it("normalizes padded home IDs and retains a chosen Mahact king label", () => {
    const bag = completedBag();
    bag.seats[0].keptItemIds.push("HOMESYSTEM:arborec", "MAHACTKING:blacktf");
    const map = bagToMantisState(bag);
    const homeIdx = draftConfig[map.mapType].homeIdxInMapString[map.seats[0]];
    expect(map.map[homeIdx]).toMatchObject({ type: "SYSTEM", systemId: "5" });
    expect(map.factionLabels?.[0]).toBe("A Sickening Lurch");
  });

  it("leaves a labelled home placeholder when an overdraft keeps multiple homes", () => {
    const bag = completedBag();
    bag.seats[0].keptItemIds.push("HOMESYSTEM:arborec", "HOMESYSTEM:sol");
    const map = bagToMantisState(bag);
    const homeIdx = draftConfig[map.mapType].homeIdxInMapString[map.seats[0]];
    expect(map.map[homeIdx]).toMatchObject({ type: "HOME", playerId: 0 });
    expect(
      map.log.some(
        (message) =>
          message.includes("Ada: a home placeholder") &&
          message.includes(" or "),
      ),
    ).toBe(true);
  });

  it("maps bot faction aliases and home IDs to the existing Creuss and Axis homes", () => {
    const bag = completedBag();
    bag.seats[0].keptItemIds.push("HOMESYSTEM:ghost");
    bag.seats[1].keptItemIds.push("HOMESYSTEM:axis");
    const map = bagToMantisState(bag);
    const homes = draftConfig[map.mapType].homeIdxInMapString;
    expect(map.map[homes[map.seats[0]]]).toMatchObject({
      type: "SYSTEM",
      systemId: "51",
    });
    expect(map.map[homes[map.seats[1]]]).toMatchObject({
      type: "SYSTEM",
      systemId: "4204",
    });
  });

  it("falls back to listed seating when speaker order was not drafted", () => {
    const bag = completedBag();
    for (const seat of bag.seats)
      seat.keptItemIds = seat.keptItemIds.filter(
        (id) => !id.startsWith("DRAFTORDER:"),
      );
    const map = bagToMantisState(bag);
    expect(map.order).toEqual([0, 1, 2, 3]);
    expect(
      map.log.some((message) => message.includes("No complete speaker order")),
    ).toBe(true);
  });

  it("rejects unfinished factions and incompatible tile counts", () => {
    const bag = completedBag();
    bag.seats[0].finished = false;
    expect(() => bagToMantisState(bag)).toThrow(/Everyone must finish/);
    bag.seats[0].finished = true;
    bag.seats[0].keptItemIds.shift();
    expect(() => bagToMantisState(bag)).toThrow(/exactly 3 blue and 2 red/);
    expect(bagMapBuildError(bag)).toMatch(/exactly 3 blue and 2 red/);
  });

  it("explains drafts without tiles and unsupported player counts", () => {
    const bag = completedBag();
    bag.seats = bag.seats.slice(0, 2);
    expect(bagMapBuildError(bag)).toMatch(/3–8 players/);
    bag.rules.keepLimits = { TECH: 2, AGENT: 1, UNIT: 1 };
    expect(bagMapBuildError(bag)).toMatch(/does not include map tiles/);
  });

  it("reports unsupported tiles and duplicate tiles using the actual builder validation", () => {
    const bag = completedBag();
    bag.seats[0].keptItemIds[0] = "BLUETILE:d100";
    expect(bagMapBuildError(bag)).toContain("does not have Silence");
    bag.seats[0].keptItemIds[0] = bag.seats[1].keptItemIds[0];
    expect(bagMapBuildError(bag)).toMatch(/must be unique/);
  });
});
