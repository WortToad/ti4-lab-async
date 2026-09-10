import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ActionFunctionArgs } from "react-router";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Draft } from "~/types";
import {
  getTexasFactionConflict,
  getTexasFactionReplacementOptions,
} from "./factionConflict";
import { texasFactionConflictFixture } from "./factionConflict.testData";

vi.mock("~/utils/imageJobQueue.server", () => ({ enqueueImageJob: vi.fn() }));
vi.mock("~/websocket/broadcast.server", () => ({
  broadcastDraftUpdate: vi.fn(),
}));
vi.mock("~/discord/bot.server", () => ({ notifyPick: vi.fn() }));

const directory = mkdtempSync(join(tmpdir(), "ti4-texas-recovery-"));
let lobby: typeof import("~/drizzle/baseDraftLobby.server");
let mutations: typeof import("~/drizzle/baseDraftMutations.server");
let route: typeof import("~/routes/api.draft.$id.texas-faction-recovery");
let stage: typeof import("~/routes/api.draft.$id.stage");
let db: (typeof import("~/drizzle/config.server"))["db"];
let schema: typeof import("~/drizzle/schema.server");

beforeAll(async () => {
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(
    join(directory, "draft.sqlite"),
  ).href;
  ({ db } = await import("~/drizzle/config.server"));
  schema = await import("~/drizzle/schema.server");
  lobby = await import("~/drizzle/baseDraftLobby.server");
  mutations = await import("~/drizzle/baseDraftMutations.server");
  route = await import("~/routes/api.draft.$id.texas-faction-recovery");
  stage = await import("~/routes/api.draft.$id.stage");
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const args = (id: string, body: unknown, cookie = ""): ActionFunctionArgs => ({
  request: new Request(
    `http://localhost/api/draft/${id}/texas-faction-recovery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    },
  ),
  params: { id },
  context: {},
  unstable_pattern: "/api/draft/:id/texas-faction-recovery",
});

async function fixture({
  managed = true,
  start = true,
  draft = texasFactionConflictFixture(),
} = {}) {
  const id = randomUUID();
  db.insert(schema.drafts)
    .values({ id, data: JSON.stringify(draft) })
    .run();
  const cookies: string[] = [];
  let host = "";
  if (managed) {
    const admin = lobby.createBaseLobby(id, draft);
    host = (await lobby.baseCookie(id, "admin").serialize(admin)).split(";")[0];
    for (const player of draft.players) {
      const joined = await lobby.mutateBaseLobby(
        id,
        new Request("http://localhost"),
        { type: "join", name: player.name },
      );
      cookies.push(
        (await lobby.baseCookie(id).serialize(joined.issued!.uuid)).split(
          ";",
        )[0],
      );
    }
    if (start)
      await lobby.mutateBaseLobby(
        id,
        new Request("http://localhost", { headers: { Cookie: host } }),
        { type: "start" },
      );
  }
  return { id, cookies, host, draft };
}

function readDraft(id: string): Draft {
  return JSON.parse(mutations.draftById(id)!.data as string);
}

describe("Texas faction recovery API", () => {
  it.each(["all hands", "only the owner's hand"])(
    "projects the owner's initial hand when %s are missing without exposing other hands",
    (missing) => {
      const draft = texasFactionConflictFixture();
      if (missing === "all hands") delete draft.texasDraft!.factionOptions;
      else delete draft.texasDraft!.factionOptions![1];
      const original = structuredClone(draft);

      const projected = lobby.projectBaseDraft(draft, 1);
      expect(projected.texasDraft!.factionOptions).toEqual({
        1: ["mentak", "barony"],
      });
      expect(getTexasFactionReplacementOptions(projected, 1)).toEqual([
        "barony",
      ]);
      expect(getTexasFactionReplacementOptions(projected, 0)).toEqual([]);
      expect(projected.texasDraft!.tileHands).toEqual({
        blue: { 1: ["22", "23", "24"] },
        red: {},
      });
      expect(projected.texasDraft!.initialFactionOptions).toBeUndefined();
      expect(projected.texasDraft!.initialTileHands).toBeUndefined();
      expect(projected.texasDraft!.initialFactionDrawPile).toBeUndefined();
      expect(projected.texasDraft!.factionDrawPile).toBeUndefined();

      const spectator = lobby.projectBaseDraft(draft);
      expect(spectator.texasDraft!.factionOptions).toEqual({});
      expect(spectator.texasDraft!.tileHands).toEqual({ blue: {}, red: {} });
      expect(spectator.texasDraft!.initialFactionOptions).toBeUndefined();
      expect(spectator.texasDraft!.initialTileHands).toBeUndefined();
      expect(draft).toEqual(original);
    },
  );

  it("enforces ownership and stale-state guards, then preserves staged picks through correction and undo", async () => {
    const room = await fixture({ start: false });
    const body = {
      playerId: 1,
      value: "barony",
      expectedFaction: "mentak",
      expectedSelectionCount: 1,
    };
    expect(
      (await route.action(args(room.id, body, room.cookies[1]))).init?.status,
    ).toBe(409);
    await lobby.mutateBaseLobby(
      room.id,
      new Request("http://localhost", { headers: { Cookie: room.host } }),
      { type: "start" },
    );
    for (const cookie of ["", room.host, room.cookies[0]])
      expect(
        (await route.action(args(room.id, body, cookie))).init?.status,
      ).toBe(403);
    for (const changed of [
      { expectedSelectionCount: 0 },
      { expectedFaction: "xxcha" },
    ])
      expect(
        (
          await route.action(
            args(room.id, { ...body, ...changed }, room.cookies[1]),
          )
        ).init?.status,
      ).toBe(409);
    expect(
      (
        await route.action(
          args(room.id, { ...body, value: "saar" }, room.cookies[1]),
        )
      ).data.success,
    ).toBe(false);
    mutations.upsertStagedSelection(room.id, "texasBlueKeep1", 0, "19");
    mutations.upsertStagedSelection(room.id, "texasBlueKeep1", 1, "22");
    const before = readDraft(room.id);
    const result = await route.action(args(room.id, body, room.cookies[1]));
    expect(result.data.success).toBe(true);
    if (!("draft" in result.data)) throw new Error("Expected projected draft");
    expect(result.data.draft.texasDraft!.factionOptions).toEqual({
      1: ["mentak", "barony"],
    });
    expect(result.data.draft.texasDraft!.factionDrawPile).toBeUndefined();
    expect(result.data.draft.texasDraft!.initialFactionOptions).toBeUndefined();
    expect(result.data.draft.stagedSelections!.texasBlueKeep1).toEqual({
      0: "__ready__",
      1: "22",
    });
    expect(mutations.getStagedSelections(room.id, "texasBlueKeep1")).toEqual({
      0: "19",
      1: "22",
    });
    expect(readDraft(room.id).texasDraft).toEqual(before.texasDraft);
    expect(readDraft(room.id).presetMap).toEqual(before.presetMap);
    expect(getTexasFactionConflict(readDraft(room.id))).toBeUndefined();
    expect(lobby.getBaseLobby(room.id)!.checkpoints.at(-1)!.undoable).toBe(
      true,
    );
    await lobby.mutateBaseLobby(
      room.id,
      new Request("http://localhost", { headers: { Cookie: room.host } }),
      { type: "undo" },
    );
    expect(readDraft(room.id)).toEqual(before);
    expect(mutations.getStagedSelections(room.id, "texasBlueKeep1")).toEqual({
      0: "19",
      1: "22",
    });
  });

  it("accepts only one of two competing owned corrections", async () => {
    const room = await fixture();
    const results = await Promise.all([
      route.action(
        args(
          room.id,
          {
            playerId: 1,
            value: "barony",
            expectedFaction: "mentak",
            expectedSelectionCount: 1,
          },
          room.cookies[1],
        ),
      ),
      route.action(
        args(
          room.id,
          {
            playerId: 2,
            value: "saar",
            expectedFaction: "xxcha",
            expectedSelectionCount: 1,
          },
          room.cookies[2],
        ),
      ),
    ]);
    expect(results.filter((result) => result.data.success)).toHaveLength(1);
    expect(results.filter((result) => !result.data.success)).toHaveLength(1);
    const stored = readDraft(room.id);
    expect(stored.selections).toHaveLength(1);
    expect(stored.selections[0]).toMatchObject({
      factionReplacements: [expect.anything()],
    });
    expect(getTexasFactionConflict(stored)).toBeUndefined();
  });

  it("allows explicit fresh redraw in a completed legacy room without resetting progress", async () => {
    const initial = texasFactionConflictFixture();
    initial.selections.push({
      type: "PLACE_TILE",
      playerId: 0,
      systemId: "19",
      mapIdx: 1,
    });
    initial.pickOrder = [{ kind: "simultaneous", phase: "texasFaction" }, 0];
    initial.presetMap[1] = {
      ...initial.presetMap[1],
      type: "SYSTEM",
      systemId: "19",
    };
    const room = await fixture({ managed: false, draft: initial });
    const result = await route.action(
      args(room.id, {
        playerId: 0,
        value: "REDRAW",
        expectedFaction: "keleres",
        expectedSelectionCount: 2,
      }),
    );
    expect(result.data.success).toBe(true);
    const stored = readDraft(room.id);
    expect(stored.selections[1]).toEqual(initial.selections[1]);
    expect(stored.presetMap).toEqual(initial.presetMap);
    expect(stored.pickOrder).toEqual(initial.pickOrder);
    expect(stored.texasDraft!.playerTiles).toEqual(
      initial.texasDraft!.playerTiles,
    );
    expect(stored.texasDraft!.seatAssignments).toEqual(
      initial.texasDraft!.seatAssignments,
    );
    expect(stored.texasDraft!.factionDrawPile).toEqual(["naalu"]);
    expect(mutations.draftById(room.id)!.isComplete).toBe(true);
    expect(lobby.getBaseLobby(room.id)).toBeUndefined();
    if (!("draft" in result.data)) throw new Error("Expected projected draft");
    expect(result.data.draft.texasDraft!.factionOptions).toEqual({
      0: ["keleres", "sol"],
    });
  });

  it("blocks new tile staging before any staged choice is written while conflict remains", async () => {
    const room = await fixture();
    const before = readDraft(room.id);
    const result = await stage.action(
      args(
        room.id,
        { playerId: 0, phase: "texasBlueKeep1", value: "19" },
        room.cookies[0],
      ),
    );
    expect(result.init?.status).toBe(409);
    expect(mutations.getStagedSelections(room.id, "texasBlueKeep1")).toEqual(
      {},
    );
    expect(readDraft(room.id)).toEqual(before);
  });

  it("blocks unmanaged legacy JSON sync from bypassing conflict recovery", async () => {
    const sync = await import("~/routes/draft.$id._index/route");
    const room = await fixture({ managed: false });
    const forged = structuredClone(room.draft);
    forged.selections.push({
      type: "PLACE_TILE",
      playerId: 0,
      systemId: "19",
      mapIdx: 1,
    });
    const result = await sync.action(
      args(room.id, { id: room.id, draft: forged }),
    );
    expect(result.init?.status).toBe(409);
    expect(readDraft(room.id)).toEqual(room.draft);
  });
});
