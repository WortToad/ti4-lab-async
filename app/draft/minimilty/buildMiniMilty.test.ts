import { describe, expect, it } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { systemData } from "~/data/systemData";
import { getSystemPool } from "~/utils/system";
import { createDraftOrder } from "~/utils/draftOrder.server";
import { hydratePlayers } from "~/hooks/useHydratedDraft";
import { buildMiniMiltySettings } from "./buildMiniMilty";

const players = (count: number) =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Player ${id + 1}` }));

describe("base-game Mini-Milty", () => {
  it.each([3, 4, 5, 6])(
    "prepares a complete %i-player board with three blue and two red tiles per seat",
    (count) => {
      const settings = buildMiniMiltySettings({ players: players(count) });
      const config = draftConfig[settings.type];
      const map = settings.presetMap!;
      const used: string[] = [];
      expect(settings.numFactions).toBe(count + 1);
      expect(settings.draftSpeaker).toBe(false);
      expect(map.some((tile) => tile.type === "OPEN")).toBe(false);
      expect(map.filter((tile) => tile.type === "HOME")).toHaveLength(count);
      config.homeIdxInMapString.forEach((homeIndex, seat) => {
        const home = map[homeIndex];
        const systems = config.seatTilePlacement[seat].map(([x, y]) => {
          const tile = map.find(
            (tile) =>
              tile.position.x === home.position.x + x &&
              tile.position.y === home.position.y + y,
          );
          expect(tile?.type).toBe("SYSTEM");
          if (tile?.type !== "SYSTEM") throw new Error("Missing preset tile");
          used.push(tile.systemId);
          return systemData[tile.systemId];
        });
        expect(systems.filter((system) => system.type === "BLUE")).toHaveLength(
          3,
        );
        expect(systems.filter((system) => system.type === "RED")).toHaveLength(
          2,
        );
      });
      expect(new Set(used).size).toBe(5 * count);
      expect(used.every((id) => getSystemPool(["base"]).includes(id))).toBe(
        true,
      );
    },
  );

  it("uses two snake rounds with speaker order determined by seat", () => {
    const roster = players(4);
    const settings = buildMiniMiltySettings({ players: roster });
    const order = createDraftOrder({
      players: roster,
      settings,
      availableFactions: settings.allowedFactions!,
    });
    expect(order.pickOrder).toHaveLength(8);
    expect(order.pickOrder.slice(4)).toEqual(
      [...order.pickOrder.slice(0, 4)].reverse(),
    );
    const hydrated = hydratePlayers(
      roster,
      [{ type: "SELECT_SEAT", playerId: 0, seatIdx: 2 }],
      false,
    );
    expect(hydrated[0].speakerOrder).toBe(2);
    const separateSpeaker = createDraftOrder({
      players: roster,
      settings: { ...settings, draftSpeaker: true },
      availableFactions: settings.allowedFactions!,
    });
    expect(separateSpeaker.pickOrder).toHaveLength(12);
  });

  it("respects bans and priorities and rejects invalid setups", () => {
    const settings = buildMiniMiltySettings({
      players: players(3),
      bannedFactions: ["sol"],
      requiredFactions: ["hacan"],
    });
    expect(settings.allowedFactions).not.toContain("sol");
    expect(settings.requiredFactions).toEqual(["hacan"]);
    expect(() => buildMiniMiltySettings({ players: players(7) })).toThrow(
      "3–6",
    );
    expect(() =>
      buildMiniMiltySettings({ players: players(3), numFactions: 2 }),
    ).toThrow("between");
    expect(() =>
      buildMiniMiltySettings({
        players: players(3),
        requiredFactions: ["titans"],
      }),
    ).toThrow("Prioritized");
  });
});
