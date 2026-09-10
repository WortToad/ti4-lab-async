import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Draft, FactionId } from "~/types";
import { applyBaseSelection } from "~/drizzle/baseDraftSync.server";

vi.mock("~/utils/imageJobQueue.server", () => ({ enqueueImageJob: vi.fn() }));
vi.mock("~/websocket/broadcast.server", () => ({
  broadcastDraftUpdate: vi.fn(),
}));
const dir = mkdtempSync(join(tmpdir(), "ti4-keleres-"));
let service: typeof import("~/drizzle/baseDraftLobby.server");
let drafts: typeof import("~/drizzle/draft.server");
let route: typeof import("~/routes/api.draft.$id.keleres-home");
let undo: typeof import("~/routes/api.draft.$id.undo");
beforeAll(async () => {
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(
    join(dir, "draft.sqlite"),
  ).href;
  service = await import("~/drizzle/baseDraftLobby.server");
  drafts = await import("~/drizzle/draft.server");
  route = await import("~/routes/api.draft.$id.keleres-home");
  undo = await import("~/routes/api.draft.$id.undo");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function fixture(): Draft {
  return {
    settings: {
      type: "milty4p",
      draftGameMode: "presetMap",
      factionGameSets: ["base", "pok"],
      tileGameSets: ["base", "pok"],
      numFactions: 5,
      numSlices: 4,
      draftSpeaker: false,
      randomizeMap: false,
      randomizeSlices: false,
      allowEmptyTiles: true,
      allowHomePlanetSearch: false,
    },
    integrations: {},
    players: Array.from({ length: 4 }, (_, id) => ({
      id,
      name: `Player ${id}`,
    })),
    availableFactions: ["keleres", "mentak", "xxcha", "argent", "sol"],
    slices: [],
    presetMap: [],
    pickOrder: [0, 1, 2, 3],
    selections: ["keleres", "mentak", "xxcha", "sol"].map(
      (factionId, playerId) => ({
        type: "SELECT_FACTION",
        playerId,
        factionId: factionId as FactionId,
      }),
    ),
  };
}
async function cookie(id: string, token: string, admin = false) {
  return (
    await service.baseCookie(id, admin ? "admin" : "player").serialize(token)
  ).split(";")[0];
}
async function post(
  id: string,
  body: Record<string, unknown>,
  cookieValue = "",
  undoAction = false,
) {
  return (undoAction ? undo : route).action({
    request: new Request(`http://localhost/api/draft/${id}/keleres-home`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieValue },
      body: JSON.stringify(body),
    }),
    params: { id },
    context: {},
    unstable_pattern: "/api/draft/:id/keleres-home",
  });
}
test("owned home choice survives persistence, checkpoints and admin undo without consuming a draft pick", async () => {
  const initial = fixture();
  const created = await drafts.createDraft(initial);
  const admin = await cookie(created.id, created.adminUuid!, true);
  const tokens: string[] = [];
  for (let id = 0; id < 4; id++) {
    const joined = await service.mutateBaseLobby(
      created.id,
      new Request("http://localhost"),
      { type: "join", name: `Player ${id}` },
    );
    tokens.push(await cookie(created.id, joined.issued!.uuid));
  }
  await service.mutateBaseLobby(
    created.id,
    new Request("http://localhost", { headers: { Cookie: admin } }),
    { type: "start" },
  );
  expect(drafts.deriveDraftMetadata(initial)).toMatchObject({
    isComplete: false,
    phase: "homeSystem",
  });
  const fields = { playerId: 0, home: "argent", expectedSelectionCount: 4 };
  expect((await post(created.id, fields)).init?.status).toBe(403);
  expect((await post(created.id, fields, admin)).init?.status).toBe(403);
  expect(
    (await post(created.id, { ...fields, playerId: 1 }, tokens[1])).data
      .success,
  ).toBe(false);
  expect(
    (await post(created.id, { ...fields, home: "mentak" }, tokens[0])).data
      .success,
  ).toBe(false);
  expect(
    (
      await post(
        created.id,
        { ...fields, expectedSelectionCount: 3 },
        tokens[0],
      )
    ).init?.status,
  ).toBe(409);
  expect((await post(created.id, fields, tokens[0])).data.success).toBe(true);
  const stored = JSON.parse(
    (await drafts.draftById(created.id))!.data as string,
  ) as Draft;
  expect(stored.players[0].homeSystemFactionId).toBe("argent");
  expect(stored.selections).toEqual(initial.selections);
  expect(drafts.deriveDraftMetadata(stored).isComplete).toBe(true);
  expect((await post(created.id, fields, tokens[0])).data.success).toBe(false);
  await service.mutateBaseLobby(
    created.id,
    new Request("http://localhost", { headers: { Cookie: admin } }),
    { type: "checkpoint" },
  );
  const checkpoint = service.getBaseLobby(created.id)!.checkpoints.at(-1)!.id;
  expect(
    (await post(created.id, { expectedSelectionCount: 4 }, tokens[0], true))
      .init?.status,
  ).toBe(403);
  expect(
    (await post(created.id, { expectedSelectionCount: 4 }, admin, true)).data
      .success,
  ).toBe(true);
  const undone = JSON.parse(
    (await drafts.draftById(created.id))!.data as string,
  ) as Draft;
  expect(undone.players[0].homeSystemFactionId).toBeUndefined();
  expect(undone.selections).toEqual(initial.selections);
  await service.mutateBaseLobby(
    created.id,
    new Request("http://localhost", { headers: { Cookie: admin } }),
    { type: "restore", checkpointId: checkpoint },
  );
  expect(
    JSON.parse((await drafts.draftById(created.id))!.data as string).players[0]
      .homeSystemFactionId,
  ).toBe("argent");
});
test("standard primary and minor choices cannot consume the final Keleres home", () => {
  const draft = fixture();
  draft.selections.pop();
  expect(() =>
    applyBaseSelection(
      draft,
      { type: "SELECT_FACTION", playerId: 3, factionId: "argent" },
      3,
    ),
  ).toThrow("Keleres needs");
  expect(
    applyBaseSelection(
      draft,
      { type: "SELECT_FACTION", playerId: 3, factionId: "sol" },
      3,
    ).selections,
  ).toHaveLength(4);
  draft.settings.minorFactionsInSharedPool = true;
  expect(() =>
    applyBaseSelection(
      draft,
      { type: "SELECT_MINOR_FACTION", playerId: 3, minorFactionId: "keleres" },
      3,
    ),
  ).toThrow("cannot be drafted as a minor");
  expect(() =>
    applyBaseSelection(
      draft,
      { type: "SELECT_MINOR_FACTION", playerId: 3, minorFactionId: "argent" },
      3,
    ),
  ).toThrow("Keleres needs");
});
