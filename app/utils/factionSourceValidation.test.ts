import { describe, expect, test } from "vitest";
import { applyBaseSelection } from "~/drizzle/baseDraftSync.server";
import { makeLobbyPlayers } from "~/draft/lobbySetup";
import { generatorTestSettings } from "~/draft/common/generationTestUtils";
import { getFactionPool } from "./factions";
import {
  getFactionBanError,
  getFactionBanSource,
  getFactionSourceValidationErrors,
} from "./factionSourceValidation";
import type { Draft } from "~/types";

const base = getFactionPool(["base"]);
const edge = getFactionPool(["te"]);
function draftWithBans(): Draft {
  return {
    settings: {
      ...generatorTestSettings,
      type: "milty4p",
      numFactions: 4,
      numSlices: 4,
      modifiers: { banFactions: { numFactions: 1 } },
      allowedFactions: base.slice(0, 8),
    },
    players: makeLobbyPlayers(4),
    availableFactions: base.slice(0, 4),
    slices: [],
    presetMap: [],
    selections: [],
    integrations: {},
    pickOrder: [0, 1, 2, 3, 0, 1, 2, 3],
  };
}

describe("faction source preflight", () => {
  test("uses the full source instead of subtracting bans from the preview", () => {
    const draft = draftWithBans();
    expect(draft.availableFactions).toHaveLength(4);
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
    delete draft.settings.allowedFactions;
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
  });

  test("reserves the requested regenerated pool, even when fewer factions would cover players", () => {
    const draft = draftWithBans();
    draft.settings.numFactions = 6;
    draft.availableFactions = base.slice(0, 6);
    expect(getFactionSourceValidationErrors(draft)).toContainEqual(
      expect.stringContaining(
        "needs 6 factions after 4 bans, but only 4 will remain",
      ),
    );
  });

  test("reserves enough factions for private hands and shared minors", () => {
    const draft = draftWithBans();
    draft.settings.allowedFactions = base.slice(0, 15);
    draft.settings.numPreassignedFactions = 3;
    draft.settings.minorFactionsInSharedPool = true;
    expect(getFactionSourceValidationErrors(draft)).toContainEqual(
      expect.stringContaining(
        "needs 12 factions after 4 bans, but only 11 will remain",
      ),
    );
    draft.settings.allowedFactions = base.slice(0, 16);
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
  });

  test("allows exact shared supply with Keleres and still reserves larger private hands", () => {
    const draft = draftWithBans();
    draft.settings.numFactions = 8;
    draft.settings.minorFactionsInSharedPool = true;
    draft.settings.allowedFactions = ["keleres", ...base.slice(0, 11)];
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
    draft.settings.allowedFactions = ["keleres", ...base.slice(0, 15)];
    draft.settings.numPreassignedFactions = 3;
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
  });

  test("subtracts distinct separate minor factions only when they belong to the source", () => {
    const draft = draftWithBans();
    draft.settings.numFactions = 6;
    draft.settings.allowedFactions = base.slice(0, 11);
    draft.availableMinorFactions = [base[0], base[0], base[1], edge[0]];
    expect(getFactionBanSource(draft)).toHaveLength(9);
    expect(getFactionSourceValidationErrors(draft)).toContainEqual(
      expect.stringContaining("only 5 will remain"),
    );
  });

  test("does not treat duplicated source IDs as extra ban supply", () => {
    const draft = draftWithBans();
    draft.settings.allowedFactions = [...base.slice(0, 7), base[0], base[1]];
    expect(getFactionSourceValidationErrors(draft)).toContainEqual(
      expect.stringContaining("only 3 will remain"),
    );
  });

  test("leaves Texas and Twilight's Fall to their dedicated validation", () => {
    const draft = draftWithBans();
    draft.settings.allowedFactions = [];
    draft.settings.draftGameMode = "texasStyle";
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
    draft.settings.draftGameMode = "twilightsFall";
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
  });
});

function stratifiedDraft() {
  const draft = draftWithBans();
  draft.settings.factionGameSets = ["base", "te"];
  draft.settings.allowedFactions = [...base.slice(0, 7), ...edge.slice(0, 2)];
  draft.settings.factionStratification = { "base|pok": 2, te: 2 };
  draft.availableFactions = [...base.slice(0, 2), ...edge.slice(0, 2)];
  return draft;
}

describe("safe faction bans", () => {
  test("keeps a viable stratified setup and rejects only bans that exhaust a quota", () => {
    const draft = stratifiedDraft();
    expect(getFactionSourceValidationErrors(draft)).toEqual([]);
    expect(getFactionBanError(draft, edge[0])).toContain(
      "selected expansion mix",
    );
    expect(getFactionBanError(draft, base[0])).toBeUndefined();
  });

  test("authoritative selection rejects an exhausting ban without changing the draft", () => {
    const draft = stratifiedDraft();
    const before = structuredClone(draft);
    expect(() =>
      applyBaseSelection(
        draft,
        { type: "BAN_FACTION", playerId: 0, factionId: edge[0] },
        0,
      ),
    ).toThrow("selected expansion mix");
    expect(draft).toEqual(before);
  });

  test("legal bans finish with a full pool that honors expansion quotas and permits banning priorities", () => {
    let draft = stratifiedDraft();
    draft.settings.requiredFactions = [base[0]];
    for (let playerId = 0; playerId < 4; playerId++) {
      draft = applyBaseSelection(
        draft,
        { type: "BAN_FACTION", playerId, factionId: base[playerId] },
        playerId,
      );
    }
    expect(draft.availableFactions).toHaveLength(4);
    expect(
      draft.availableFactions.filter((id) => edge.includes(id)),
    ).toHaveLength(2);
    expect(draft.availableFactions).not.toContain(base[0]);
  });

  test("blocks factions reserved for separate minor choices", () => {
    const draft = draftWithBans();
    draft.availableMinorFactions = [base[0]];
    expect(getFactionBanError(draft, base[0])).toContain(
      "reserved as a minor faction",
    );
    expect(() =>
      applyBaseSelection(
        draft,
        { type: "BAN_FACTION", playerId: 0, factionId: base[0] },
        0,
      ),
    ).toThrow("reserved as a minor faction");
  });
});

test("a tight shared source permits a Keleres ban without demanding an extra spare", () => {
  const draft = draftWithBans();
  draft.settings.numFactions = 8;
  draft.settings.minorFactionsInSharedPool = true;
  draft.settings.allowedFactions = ["keleres", ...base.slice(0, 11)];
  expect(getFactionBanError(draft, "keleres")).toBeUndefined();
});
