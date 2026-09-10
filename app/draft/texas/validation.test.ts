import { describe, expect, it } from "vitest";
import { systemData } from "~/data/systemData";
import { getFactionPool } from "~/utils/factions";
import { getSystemPool } from "~/utils/system";
import type { Draft, DraftSettings } from "~/types";
import { buildTexasDraft } from "./buildTexasDraft";
import {
  applyTexasFactionCommit,
  dealTexasFactionOptions,
  dealTexasTiles,
  TEXAS_REDRAW_VALUE,
} from "./texasDraft";
import { getTexasSetupErrors } from "./validation";

const settings: DraftSettings = {
  type: "milty",
  draftGameMode: "texasStyle",
  factionGameSets: ["base", "pok", "te"],
  tileGameSets: ["base", "pok", "te"],
  draftSpeaker: false,
  allowHomePlanetSearch: false,
  numFactions: 30,
  numSlices: 0,
  randomizeMap: false,
  randomizeSlices: false,
  allowEmptyTiles: false,
  modifiers: { banFactions: { numFactions: 1 } },
  texasFactionHandSize: 3,
  texasAllowFactionRedraw: true,
};
const factions = getFactionPool(settings.factionGameSets);
const players = (count: number) =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Player ${id + 1}` }));

describe("Texas setup feasibility", () => {
  it("rejects eight three-card hands after eight bans from the thirty-faction pool", () => {
    const input = { ...settings, texasAllowFactionRedraw: false };
    expect(getTexasSetupErrors(input, 8)).toEqual([
      expect.stringContaining(
        "24 factions for 8 hands of 3 after 8 bans, but only 22 will remain",
      ),
    ]);
    expect(() =>
      buildTexasDraft({
        settings: input,
        players: players(8),
        integrations: {},
      }),
    ).toThrow(/only 22 will remain/);
  });

  it("reserves one redraw for every player and permits disabling redraw when hands still fit", () => {
    const input = { ...settings, texasFactionHandSize: 2 };
    expect(getTexasSetupErrors(input, 8)).toEqual([
      expect.stringContaining("32 factions (8 bans, 16 dealt and 8 reserved)"),
    ]);
    expect(
      getTexasSetupErrors({ ...input, texasAllowFactionRedraw: false }, 8),
    ).toEqual([]);
    expect(
      getTexasSetupErrors(
        { ...settings, factionGameSets: ["base", "pok", "te", "discordant"] },
        8,
      ),
    ).toEqual([]);
  });

  it("validates excluded factions and the actual prepared pool without counting duplicate cards", () => {
    expect(
      getTexasSetupErrors(
        { ...settings, allowedFactions: factions.slice(0, 23) },
        6,
      ),
    ).toContainEqual(expect.stringContaining("only 17 will remain"));
    expect(
      getTexasSetupErrors(settings, 6, factions.slice(0, 24)),
    ).toContainEqual(expect.stringContaining("only 24 are available"));
    expect(
      getTexasSetupErrors(settings, 6, [
        ...factions.slice(0, 24),
        ...factions.slice(0, 6),
      ]),
    ).toContainEqual(expect.stringContaining("only 24 are available"));
  });

  it("reports both blue and red shortages in a base-only eight-player tile pool", () => {
    const errors = getTexasSetupErrors(
      { ...settings, tileGameSets: ["base"] },
      8,
    );
    expect(errors).toContainEqual(
      expect.stringContaining(
        "24 blue tiles (3 per player), but the tile pool contains 20",
      ),
    );
    expect(errors).toContainEqual(
      expect.stringContaining(
        "16 red tiles (2 per player), but the tile pool contains 12",
      ),
    );
  });

  it("accepts an exact six-player pool and supports every player choosing redraw together", () => {
    expect(getTexasSetupErrors(settings, 6)).toEqual([]);
    const draft: Draft = {
      ...buildTexasDraft({ settings, players: players(6), integrations: {} }),
      pickOrder: [],
    };
    expect(draft.texasDraft?.factionOptions).toBeUndefined();
    const afterBans = factions.slice(6);
    Object.assign(
      draft.texasDraft!,
      dealTexasFactionOptions(afterBans, draft.players, 3),
    );
    const dealt = Object.values(draft.texasDraft!.factionOptions!).flat();
    expect(dealt).toHaveLength(18);
    expect(draft.texasDraft!.factionDrawPile).toHaveLength(6);
    const committed = applyTexasFactionCommit(
      draft,
      draft.players.map((player) => ({
        playerId: player.id,
        value: TEXAS_REDRAW_VALUE,
      })),
    );
    expect(new Set(committed.map((selection) => selection.value)).size).toBe(6);
    expect(
      committed.every(
        (selection) =>
          !dealt.includes(selection.value as (typeof factions)[number]),
      ),
    ).toBe(true);
    expect(draft.texasDraft!.factionDrawPile).toEqual([]);
  });

  it("deals faction hands immediately when no ban phase is configured", () => {
    const draft = buildTexasDraft({
      settings: { ...settings, modifiers: {} },
      players: players(6),
      integrations: {},
    });
    expect(
      Object.values(draft.texasDraft!.factionOptions!).every(
        (hand) => hand.length === 3,
      ),
    ).toBe(true);
  });
});

describe("Texas dealers", () => {
  it("rejects impossible legacy redraws without silently keeping a discarded faction or consuming the pile", () => {
    const draft: Draft = {
      ...buildTexasDraft({
        settings: { ...settings, modifiers: {} },
        players: players(6),
        integrations: {},
      }),
      pickOrder: [],
    };
    draft.texasDraft!.factionDrawPile = factions.slice(0, 1);
    const before = structuredClone(draft);
    const redraws = players(2).map((player) => ({
      playerId: player.id,
      value: TEXAS_REDRAW_VALUE,
    }));
    expect(() => applyTexasFactionCommit(draft, redraws)).toThrow(
      /only 1 fresh factions remain/,
    );
    expect(draft).toEqual(before);
    draft.settings.texasAllowFactionRedraw = false;
    expect(() => applyTexasFactionCommit(draft, redraws.slice(0, 1))).toThrow(
      /redraw is disabled/,
    );
    expect(draft.texasDraft!.factionDrawPile).toEqual(
      before.texasDraft!.factionDrawPile,
    );
  });
  it("fails instead of silently dealing partial faction hands or reusing duplicate cards", () => {
    const pool = factions.slice(0, 17);
    expect(() => dealTexasFactionOptions(pool, players(6), 3)).toThrow(
      /need 18 unique factions.*only 17 remain/,
    );
    expect(() =>
      dealTexasFactionOptions([...pool, ...pool], players(6), 3),
    ).toThrow(/only 17 remain/);
    expect(pool).toHaveLength(17);
  });

  it("fails before dealing partial tile hands and does not count duplicate tiles as supply", () => {
    const pool = getSystemPool(["base"]);
    expect(() => dealTexasTiles(pool, players(8))).toThrow(/24 blue tiles/);
    expect(() => dealTexasTiles([...pool, ...pool], players(8))).toThrow(
      /24 blue tiles/,
    );
  });

  it("deals complete unique hands and preserves immutable recovery hands", () => {
    const pool = getSystemPool(settings.tileGameSets);
    const initialPool = [...pool];
    const result = dealTexasTiles([...pool, ...pool], players(8));
    for (const player of players(8)) {
      expect(result.tileHands!.blue[player.id]).toHaveLength(3);
      expect(result.tileHands!.red[player.id]).toHaveLength(2);
      expect(
        result.tileHands!.blue[player.id].every(
          (id) => systemData[id].type === "BLUE",
        ),
      ).toBe(true);
    }
    const dealt = [
      ...Object.values(result.tileHands!.blue).flat(),
      ...Object.values(result.tileHands!.red).flat(),
    ];
    expect(new Set(dealt).size).toBe(40);
    result.tileHands!.blue[0].pop();
    expect(result.initialTileHands!.blue[0]).toHaveLength(3);
    expect(pool).toEqual(initialPool);
  });
});
