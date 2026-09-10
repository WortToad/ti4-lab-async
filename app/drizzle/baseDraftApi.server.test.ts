import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import type { Draft } from "~/types";

vi.mock("~/utils/imageJobQueue.server", () => ({ enqueueImageJob: vi.fn() }));
const directory = mkdtempSync(join(tmpdir(), "ti4-base-api-test-"));
let lobby: typeof import("~/drizzle/baseDraftLobby.server");
let stage: typeof import("~/routes/api.draft.$id.stage");
let undoPick: typeof import("~/routes/api.draft.$id.simultaneous-undo-pick");
let undo: typeof import("~/routes/api.draft.$id.undo");
let undoPhase: typeof import("~/routes/api.draft.$id.simultaneous-undo-phase");

beforeAll(async () => {
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(
    join(directory, "draft.sqlite"),
  ).href;
  lobby = await import("~/drizzle/baseDraftLobby.server");
  stage = await import("~/routes/api.draft.$id.stage");
  undoPick = await import("~/routes/api.draft.$id.simultaneous-undo-pick");
  undo = await import("~/routes/api.draft.$id.undo");
  undoPhase = await import("~/routes/api.draft.$id.simultaneous-undo-phase");
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const args = (id: string, body: unknown, cookie = ""): ActionFunctionArgs => ({
  request: new Request(`http://localhost/api/draft/${id}/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  }),
  params: { id },
  context: {},
  unstable_pattern: "/api/draft/:id/stage",
});

async function fixture(start = true) {
  const { db } = await import("~/drizzle/config.server");
  const { drafts } = await import("~/drizzle/schema.server");
  const id = randomUUID();
  const draft = {
    settings: {
      type: "milty",
      draftGameMode: "texasStyle",
      adminPassword: "private-admin-password",
    },
    integrations: {},
    players: [
      { id: 0, name: "Alice" },
      { id: 1, name: "Bob" },
      { id: 2, name: "Carol" },
    ],
    slices: [],
    presetMap: [],
    availableFactions: [],
    selections: [],
    pickOrder: [
      { kind: "simultaneous", phase: "texasBlueKeep1" },
      { kind: "simultaneous", phase: "texasBlueKeep2" },
      0,
      1,
      2,
    ],
    texasDraft: {
      seatOrder: [0, 1, 2],
      seatAssignments: { 0: 0, 1: 1, 2: 2 },
      speakerId: 0,
      tileHands: {
        blue: {
          0: ["101", "102", "103"],
          1: ["201", "202", "203"],
          2: ["301", "302", "303"],
        },
        red: {},
      },
      tileKeeps: { blue: { 0: [], 1: [], 2: [] }, red: {} },
      factionDrawPile: ["private-faction-draw"],
    },
  } as unknown as Draft;
  db.insert(drafts)
    .values({ id, data: JSON.stringify(draft) })
    .run();
  const adminUuid = lobby.createBaseLobby(id, draft);
  const host = (await lobby.baseCookie(id, "admin").serialize(adminUuid)).split(
    ";",
  )[0];
  const cookies: string[] = [];
  for (const player of draft.players) {
    const result = await lobby.mutateBaseLobby(
      id,
      new Request("http://localhost"),
      { type: "join", playerId: player.id, name: player.name },
    );
    cookies.push(
      (await lobby.baseCookie(id).serialize(result.issued!.uuid)).split(";")[0],
    );
  }
  if (start)
    await lobby.mutateBaseLobby(
      id,
      new Request("http://localhost", { headers: { Cookie: host } }),
      { type: "start" },
    );
  return { id, host, cookies };
}

describe("draft API ownership and private projections", () => {
  it("rejects waiting, paused, spectator, admin-only, and other-player picks before writing", async () => {
    const room = await fixture(false);
    const operation = { phase: "texasBlueKeep1", playerId: 0, value: "101" };
    expect(
      (await stage.action(args(room.id, operation, room.cookies[0]))).init
        ?.status,
    ).toBe(409);
    await lobby.mutateBaseLobby(
      room.id,
      new Request("http://localhost", { headers: { Cookie: room.host } }),
      { type: "start" },
    );
    for (const cookie of ["", room.host, room.cookies[1]])
      expect(
        (await stage.action(args(room.id, operation, cookie))).init?.status,
      ).toBe(403);
    expect(
      (
        await stage.action(
          args(room.id, { ...operation, value: "201" }, room.cookies[0]),
        )
      ).init?.status,
    ).toBe(400);
    await lobby.mutateBaseLobby(
      room.id,
      new Request("http://localhost", { headers: { Cookie: room.host } }),
      { type: "pause" },
    );
    expect(
      (await stage.action(args(room.id, operation, room.cookies[0]))).init
        ?.status,
    ).toBe(409);
    const { getDraftStagedSelections } = await import("~/drizzle/draft.server");
    expect(await getDraftStagedSelections(room.id)).toEqual({});
  });

  it("returns only the caller's staged choice and hand, preserving others' ready status", async () => {
    const room = await fixture();
    await stage.action(
      args(
        room.id,
        { phase: "texasBlueKeep1", playerId: 1, value: "201" },
        room.cookies[1],
      ),
    );
    const result = await stage.action(
      args(
        room.id,
        { phase: "texasBlueKeep1", playerId: 0, value: "101" },
        room.cookies[0],
      ),
    );
    expect(result.data.success).toBe(true);
    if (!("draft" in result.data)) throw new Error("Expected a draft view");
    expect(result.data.draft.stagedSelections).toEqual({
      texasBlueKeep1: { 0: "101", 1: "__ready__" },
    });
    expect(result.data.draft.texasDraft!.tileHands!.blue).toEqual({
      0: ["101", "102", "103"],
    });
    expect(JSON.stringify(result.data)).not.toContain("201");
    expect(JSON.stringify(result.data)).not.toContain("private-faction-draw");
    expect(JSON.stringify(result.data)).not.toContain("private-admin-password");
    expect(new Headers(result.init?.headers).get("Cache-Control")).toBe(
      "no-store",
    );
    const rejected = await undoPick.action(
      args(room.id, { phase: "texasBlueKeep1", playerId: 1 }, room.cookies[0]),
    );
    expect(rejected.init?.status).toBe(403);
    const removed = await undoPick.action(
      args(room.id, { phase: "texasBlueKeep1", playerId: 0 }, room.cookies[0]),
    );
    expect(removed.data.success).toBe(true);
  });

  it("serializes simultaneous final confirmations into one committed round", async () => {
    const room = await fixture();
    const responses = await Promise.all(
      [0, 1, 2].map((playerId) =>
        stage.action(
          args(
            room.id,
            { phase: "texasBlueKeep1", playerId, value: `${playerId + 1}01` },
            room.cookies[playerId],
          ),
        ),
      ),
    );
    expect(responses.every((response) => response.data.success)).toBe(true);
    expect(
      responses.filter(
        (response) =>
          "allPlayersReady" in response.data && response.data.allPlayersReady,
      ),
    ).toHaveLength(1);
    const { draftById, getDraftStagedSelections } = await import(
      "~/drizzle/draft.server"
    );
    const draft = JSON.parse(
      (await draftById(room.id)).data as string,
    ) as Draft;
    expect(draft.selections).toHaveLength(1);
    expect(draft.texasDraft?.tileKeeps?.blue).toEqual({
      0: ["101"],
      1: ["201"],
      2: ["301"],
    });
    expect(await getDraftStagedSelections(room.id)).toEqual({});
    expect(
      (
        await stage.action(
          args(
            room.id,
            { phase: "texasBlueKeep1", playerId: 0, value: "101" },
            room.cookies[0],
          ),
        )
      ).data.success,
    ).toBe(false);
    expect(
      JSON.parse((await draftById(room.id)).data as string).selections,
    ).toHaveLength(1);
  });

  it("rolls back staged rows and checkpoints together when committing a round fails", async () => {
    const room = await fixture();
    for (const playerId of [0, 1])
      await stage.action(
        args(
          room.id,
          { phase: "texasBlueKeep1", playerId, value: `${playerId + 1}01` },
          room.cookies[playerId],
        ),
      );
    const count = lobby.getBaseLobby(room.id)!.checkpoints.length;
    const service = await import("./baseDraftMutations.server");
    const failure = vi.spyOn(service, "updateDraft").mockImplementation(() => {
      throw new Error("Simulated write failure");
    });
    try {
      const result = await stage.action(
        args(
          room.id,
          { phase: "texasBlueKeep1", playerId: 2, value: "301" },
          room.cookies[2],
        ),
      );
      expect(result.data.success).toBe(false);
      expect(service.getStagedSelections(room.id, "texasBlueKeep1")).toEqual({
        0: "101",
        1: "201",
      });
      expect(
        JSON.parse(service.draftById(room.id)!.data as string).selections,
      ).toHaveLength(0);
      expect(lobby.getBaseLobby(room.id)!.checkpoints).toHaveLength(count);
    } finally {
      failure.mockRestore();
    }
    expect(
      (
        await stage.action(
          args(
            room.id,
            { phase: "texasBlueKeep1", playerId: 2, value: "301" },
            room.cookies[2],
          ),
        )
      ).data.success,
    ).toBe(true);
  });

  it("validates priority and home choices against the player's reference pack", async () => {
    const { db } = await import("./config.server");
    const { drafts } = await import("./schema.server");
    const { eq } = await import("drizzle-orm");
    const { draftById } = await import("./draft.server");
    for (const phase of ["priorityValue", "homeSystem"] as const) {
      const room = await fixture();
      const draft = JSON.parse(
        (await draftById(room.id)).data as string,
      ) as Draft;
      delete draft.texasDraft;
      draft.settings.draftGameMode = "twilightsFall";
      draft.availableReferenceCardPacks = [
        ["arborec", "hacan", "sol"],
      ] as Draft["availableReferenceCardPacks"];
      draft.selections = [
        { type: "SELECT_REFERENCE_CARD_PACK", playerId: 0, packIdx: 0 },
      ];
      if (phase === "homeSystem")
        draft.selections.push({
          type: "COMMIT_SIMULTANEOUS",
          phase: "priorityValue",
          selections: [{ playerId: 0, value: "arborec" }],
        });
      draft.pickOrder = [
        ...draft.selections.map(() => 0),
        { kind: "simultaneous", phase },
      ];
      db.update(drafts)
        .set({ data: JSON.stringify(draft) })
        .where(eq(drafts.id, room.id))
        .run();
      expect(
        (
          await stage.action(
            args(
              room.id,
              { phase, playerId: 0, value: "unoffered-faction" },
              room.cookies[0],
            ),
          )
        ).init?.status,
      ).toBe(400);
      if (phase === "homeSystem")
        expect(
          (
            await stage.action(
              args(
                room.id,
                { phase, playerId: 0, value: "arborec" },
                room.cookies[0],
              ),
            )
          ).init?.status,
        ).toBe(400);
      expect(
        (
          await stage.action(
            args(
              room.id,
              { phase, playerId: 0, value: "hacan" },
              room.cookies[0],
            ),
          )
        ).data.success,
      ).toBe(true);
    }
  });

  it("restricts history changes to the admin and does not leak removed private picks", async () => {
    const room = await fixture();
    for (let playerId = 0; playerId < 3; playerId++)
      await stage.action(
        args(
          room.id,
          { phase: "texasBlueKeep1", playerId, value: `${playerId + 1}01` },
          room.cookies[playerId],
        ),
      );
    expect(
      (await undo.action(args(room.id, {}, room.cookies[0]))).init?.status,
    ).toBe(403);
    expect(
      (
        await undoPhase.action(
          args(room.id, { phase: "texasBlueKeep1" }, room.cookies[0]),
        )
      ).init?.status,
    ).toBe(403);
    const result = await undo.action(
      args(room.id, { expectedSelectionCount: 1 }, room.host),
    );
    expect(result.data.success).toBe(true);
    if (!("draft" in result.data)) throw new Error("Expected restored draft");
    expect(result.data.removedSelection).toEqual({
      type: "COMMIT_SIMULTANEOUS",
    });
    expect(result.data.draft.texasDraft?.tileHands?.blue).toEqual({});
    expect(JSON.stringify(result.data)).not.toContain("201");
    expect(JSON.stringify(result.data)).not.toContain("101");
  });
});
