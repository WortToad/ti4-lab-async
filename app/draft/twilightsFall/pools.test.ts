import { describe, expect, test } from "vitest";
import { twilightsFallFactionIds } from "~/data/factionData";
import type { DraftSettings } from "~/types";
import {
  generateReferenceCardPacks,
  generateTwilightsFallKings,
  parseReferenceCardPacks,
  referenceCardFactionPool,
  validateTwilightsFallDraft,
  validateTwilightsFallSettings,
} from "./pools";

const settings: DraftSettings = {
  type: "milty",
  factionGameSets: ["twilightsFall"],
  tileGameSets: ["base", "pok", "te"],
  draftGameMode: "twilightsFall",
  draftSpeaker: false,
  allowHomePlanetSearch: false,
  numFactions: 6,
  numKings: 6,
  numSlices: 6,
  numReferenceCardPacks: 6,
  randomizeMap: true,
  randomizeSlices: true,
  allowEmptyTiles: false,
};

describe("Twilight's Fall draft pools", () => {
  test("king bans and priorities survive every reroll", () => {
    const configured = {
      ...settings,
      allowedFactions: twilightsFallFactionIds.filter((id) => id !== "redKing"),
      requiredFactions: ["blueKing" as const, "yellowKing" as const],
    };
    for (let i = 0; i < 30; i++) {
      const kings = generateTwilightsFallKings(configured, 6);
      expect(kings).toHaveLength(6);
      expect(new Set(kings).size).toBe(6);
      expect(kings).not.toContain("redKing");
      expect(kings).toContain("blueKing");
      expect(kings).toContain("yellowKing");
    }
  });

  test("reference card bans preserve exact pack counts and unique physical cards", () => {
    const packs = generateReferenceCardPacks(
      { ...settings, bannedReferenceCardFactions: ["sol", "hacan"] },
      6,
    );
    expect(packs).toHaveLength(6);
    expect(packs.every((pack) => pack.length === 3)).toBe(true);
    expect(new Set(packs.flat()).size).toBe(18);
    expect(packs.flat()).not.toContain("sol");
    expect(packs.flat()).not.toContain("hacan");
  });

  test("preset packs preserve composition and order without shared mutable arrays", () => {
    const preset = Array.from({ length: 6 }, (_, i) =>
      referenceCardFactionPool.slice(i * 3, i * 3 + 3),
    );
    const configured = { ...settings, presetReferenceCardPacks: preset };
    const packs = generateReferenceCardPacks(configured, 6);
    expect(packs).toEqual(preset);
    packs[0].pop();
    expect(preset[0]).toHaveLength(3);
  });

  test("accepts semicolon or newline pack strings and rejects unavailable cards", () => {
    expect(
      parseReferenceCardPacks(
        "sol,hacan,arborec;barony,xxcha,yin\nnaalu,nekro,winnu",
      ),
    ).toHaveLength(3);
    expect(parseReferenceCardPacks("  ")).toBeUndefined();
    expect(() => parseReferenceCardPacks("sol,hacan")).toThrow("exactly 3");
    expect(() => parseReferenceCardPacks("sol,hacan,unknown")).toThrow(
      "unavailable",
    );
    expect(() => parseReferenceCardPacks("sol,hacan,keleres")).toThrow(
      "unavailable",
    );
  });

  test("rejects impossible card counts instead of silently generating too few packs", () => {
    expect(() =>
      generateReferenceCardPacks({ ...settings, numReferenceCardPacks: 10 }, 6),
    ).toThrow("at most 9");
    expect(() =>
      generateReferenceCardPacks(
        {
          ...settings,
          bannedReferenceCardFactions: referenceCardFactionPool.slice(0, 12),
        },
        6,
      ),
    ).toThrow("at most 5");
    expect(() =>
      generateTwilightsFallKings(
        { ...settings, allowedFactions: ["redKing"] },
        6,
      ),
    ).toThrow("kings");
    expect(() =>
      generateTwilightsFallKings(
        {
          ...settings,
          allowedFactions: twilightsFallFactionIds.filter(
            (id) => id !== "redKing",
          ),
          requiredFactions: ["redKing"],
        },
        6,
      ),
    ).toThrow("Prioritized");
  });

  test("validates duplicates, banned preset cards, and missing prioritized kings on submission", () => {
    const preset = Array.from({ length: 6 }, (_, i) =>
      referenceCardFactionPool.slice(i * 3, i * 3 + 3),
    );
    expect(() =>
      validateTwilightsFallSettings(
        {
          ...settings,
          presetReferenceCardPacks: [...preset.slice(0, 5), preset[0]],
        },
        6,
      ),
    ).toThrow("only one pack");
    expect(() =>
      validateTwilightsFallSettings(
        {
          ...settings,
          presetReferenceCardPacks: preset,
          bannedReferenceCardFactions: [preset[0][0]],
        },
        6,
      ),
    ).toThrow("banned");
    expect(() =>
      validateTwilightsFallDraft({
        settings: { ...settings, requiredFactions: ["redKing"] },
        players: Array.from({ length: 6 }, (_, id) => ({ id, name: "" })),
        availableFactions: twilightsFallFactionIds
          .filter((id) => id !== "redKing")
          .slice(0, 6),
        availableReferenceCardPacks: preset,
      }),
    ).toThrow("prioritized king");
  });
});
