import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createTestDatabase } from "~/testing/database";
import { cookieHeader, formRequest, jsonRequest } from "~/testing/requests";
import {
  generatorTestSettings,
  seedRandom,
} from "~/draft/common/generationTestUtils";
import { makeLobbyPlayers } from "~/draft/lobbySetup";
import { BAG_VARIANTS } from "~/draft/bag/rules";
import { prepareMultidraftDraft } from "./multidraft/prepareDraft.server";

vi.mock("~/utils/imageJobQueue.server", () => ({ enqueueImageJob: vi.fn() }));

let database: ReturnType<typeof createTestDatabase>;
let base: typeof import("~/drizzle/baseDraftLobby.server");
let drafts: typeof import("~/drizzle/draft.server");
let bag: typeof import("~/draft/bag/bagDraft.server");
let mantis: typeof import("~/drizzle/mantisDraft.server");
let raw: typeof import("~/drizzle/rawDraft.server");
let createBase: typeof import("./api.draft.create");
let createBag: typeof import("./draft.bag.new");
let createMantis: typeof import("./draft.mantis.new");
let createRaw: typeof import("./draft.raw.new");
let rejoin: typeof import("./draft.rejoin");

beforeAll(async () => {
  database = createTestDatabase();
  base = await import("~/drizzle/baseDraftLobby.server");
  drafts = await import("~/drizzle/draft.server");
  bag = await import("~/draft/bag/bagDraft.server");
  mantis = await import("~/drizzle/mantisDraft.server");
  raw = await import("~/drizzle/rawDraft.server");
  createBase = await import("./api.draft.create");
  createBag = await import("./draft.bag.new");
  createMantis = await import("./draft.mantis.new");
  createRaw = await import("./draft.raw.new");
  rejoin = await import("./draft.rejoin");
});
beforeEach(() => seedRandom(20260912));
afterAll(() => database?.close());

function baseInput() {
  return prepareMultidraftDraft(
    { ...generatorTestSettings, type: "milty4p", numSlices: 4, numFactions: 5 },
    makeLobbyPlayers(4),
  );
}

async function expectRecovery(
  uuid: string,
  location: string,
  expectedCookie: string,
) {
  const response = await rejoin.action(
    formRequest("/draft/rejoin", {
      uuid: `  ${uuid.toUpperCase()}  `,
    }),
  );
  expect(response).toBeInstanceOf(Response);
  if (!(response instanceof Response))
    throw new Error("Expected recovery redirect");
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe(location);
  expect(cookieHeader(response.headers)).toBe(expectedCookie);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(location).not.toContain(uuid);
}

describe("create and recover shared lobbies through their routes", () => {
  it.each([false, true])(
    "creates a base lobby with JSON response = %s and recovers both roles",
    async (json) => {
      const input = { ...baseInput(), presetUrl: `table-${randomUUID()}` };
      const args = jsonRequest("/api/draft/create", input);
      if (json) args.request.headers.set("X-Draft-Response", "json");
      const response = await createBase.action(args);
      const url = `/draft/${input.presetUrl}`;
      if (response instanceof Response) {
        expect(json).toBe(false);
        expect(response.headers.get("Location")).toBe(url);
      } else {
        expect(json).toBe(true);
        expect(response.data).toEqual({ url });
      }
      const stored = await drafts.draftByPrettyUrl(input.presetUrl);
      const adminCookie = cookieHeader(
        response instanceof Response
          ? response.headers
          : response.init?.headers,
      );
      const viewer = await base.readBaseViewer(
        stored.id,
        new Request("http://localhost", {
          headers: { Cookie: adminCookie },
        }),
      );
      expect(viewer.isAdmin).toBe(true);
      expect(viewer.playerId).toBeUndefined();
      const lobby = base.getBaseLobby(stored.id)!;
      expect(lobby.started).toBe(false);
      expect(lobby.slots.every((slot) => !slot.uuid)).toBe(true);
      const saved = JSON.parse(stored.data as string);
      expect(saved.selections).toEqual([]);
      expect(saved.pickOrder).toHaveLength(12);
      expect(saved.presetUrl).toBeUndefined();
      await expectRecovery(lobby.adminUuid, `/draft/${stored.id}`, adminCookie);
      const joined = await base.mutateBaseLobby(
        stored.id,
        new Request("http://localhost"),
        {
          type: "join",
          name: "Alice",
        },
      );
      await expectRecovery(
        joined.issued!.uuid,
        `/draft/${stored.id}`,
        cookieHeader({
          "Set-Cookie": await base
            .baseCookie(stored.id)
            .serialize(joined.issued!.uuid),
        }),
      );
    },
  );

  it.each(BAG_VARIANTS)(
    "creates the $id variant as a hidden lobby and restores its admin",
    async ({ id: variant }) => {
      const response = await createBag.action(
        formRequest("/draft/bag/new", {
          settings: JSON.stringify({
            variant,
            players: makeLobbyPlayers(3).map((player) => player.name),
            includeDiscordantStars: true,
          }),
        }),
      );
      expect(response).toBeInstanceOf(Response);
      if (!(response instanceof Response))
        throw new Error(JSON.stringify(response.data));
      const location = response.headers.get("Location")!;
      const id = location.split("/").pop()!;
      const adminCookie = cookieHeader(response.headers);
      const token = await bag.bagCookie(id, "admin").parse(adminCookie);
      const view = await bag.getBagDraftView(id, undefined, token);
      expect(view.phase).toBe("lobby");
      expect(view.lobby.slots).toHaveLength(3);
      expect(view.viewer.isAdmin).toBe(true);
      expect(view.privateSeat).toBeUndefined();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expectRecovery(token, location, adminCookie);
      const joined = await bag.joinBagDraft(id, "Alice");
      await expectRecovery(
        joined.uuid,
        location,
        cookieHeader({
          "Set-Cookie": await bag
            .bagCookie(id, "player")
            .serialize(joined.uuid),
        }),
      );
    },
  );

  it.each([4, 5, 6, 7, 8])(
    "creates a %i-player Mantis lobby with the submitted content and order",
    async (count) => {
      const response = await createMantis.action(
        formRequest("/draft/mantis/new", {
          playerCount: String(count),
          pok: "on",
          te: "on",
          ds: "on",
          staticOrder: "on",
          numFactions: String(count + 1),
          extraBlues: "0",
          extraReds: "0",
          mulligans: "2",
          bannedFactions: "sol",
          requiredFactions: "hacan",
        }),
      );
      expect(response).toBeInstanceOf(Response);
      if (!(response instanceof Response))
        throw new Error(JSON.stringify(response.data));
      const location = response.headers.get("Location")!;
      const id = location.split("/").pop()!;
      const { room } = mantis.getMantisRoom(id);
      expect(room.draft.settings).toMatchObject({
        draftOrder: Array.from({ length: count }, (_, i) => i),
        mulligans: 2,
        bannedFactions: ["sol"],
        requiredFactions: ["hacan"],
        tileGameSets: [
          "base",
          "pok",
          "te",
          "discordant",
          "discordantexp",
          "unchartedstars",
        ],
      });
      expect(room.draft.factions).toContain("hacan");
      expect(room.draft.factions).not.toContain("sol");
      const adminCookie = cookieHeader(response.headers);
      const token = await mantis.mantisAdminCookie(id).parse(adminCookie);
      await expectRecovery(token, location, adminCookie);
    },
  );

  it.each(["base", "twilightsFall"] as const)(
    "creates and recovers RAW %s with unnamed seats",
    async (mode) => {
      const response = await createRaw.action(
        formRequest("/draft/raw/new", {
          mode,
          playerCount: "4",
          pok: "on",
        }),
      );
      expect(response).toBeInstanceOf(Response);
      if (!(response instanceof Response))
        throw new Error(JSON.stringify(response.data));
      const location = response.headers.get("Location")!;
      const id = location.split("/").pop()!;
      const adminCookie = cookieHeader(response.headers);
      const token = await raw.rawCookie(id, "admin").parse(adminCookie);
      expect(raw.getRawRoom(id).room.draft.settings).toMatchObject({
        mode,
        pok: true,
        te: mode === "twilightsFall",
      });
      await expectRecovery(token, location, adminCookie);
      const joined = await raw.actRawRoom(
        formRequest(location, { intent: "join", name: "Alice" }, "", { id }),
      );
      const playerCookie = cookieHeader(joined.init?.headers);
      const playerToken = await raw.rawCookie(id).parse(playerCookie);
      await expectRecovery(playerToken, location, playerCookie);
      const view = await raw.loadRawRoom({
        ...formRequest(location, {}, playerCookie, { id }),
        request: new Request(`http://localhost${location}`, {
          headers: { Cookie: playerCookie },
        }),
      });
      expect(view.data.ownPlayers).toEqual([0]);
      expect(view.data.draft).toBeNull();
    },
  );
});

describe("setup and recovery failures", () => {
  it.each(["0", "2", "9", "4.5", "NaN"])(
    "rejects RAW player count %s",
    async (playerCount) => {
      expect(
        await createRaw.action(
          formRequest("/draft/raw/new", { mode: "base", playerCount }),
        ),
      ).toMatchObject({
        data: { error: "Choose between 3 and 8 players." },
        init: { status: 400 },
      });
    },
  );
  it.each(["3", "9", "4.5", "NaN"])(
    "rejects Mantis player count %s",
    async (playerCount) => {
      expect(
        await createMantis.action(
          formRequest("/draft/mantis/new", { playerCount }),
        ),
      ).toMatchObject({
        data: { error: "Choose between 4 and 8 players." },
        init: { status: 400 },
      });
    },
  );
  it("reports unsupported RAW modes and layouts", async () => {
    for (const fields of [
      { mode: "unknown", playerCount: "4" },
      { mode: "base", playerCount: "4", layout: "missing" },
    ] as Record<string, string>[]) {
      expect(
        await createRaw.action(formRequest("/draft/raw/new", fields)),
      ).toMatchObject({
        init: { status: 400 },
        data: { error: expect.any(String) },
      });
    }
  });
  it.each(["", "{", JSON.stringify({ variant: "missing", players: ["", ""] })])(
    "rejects malformed bag settings %s",
    async (settings) => {
      expect(
        await createBag.action(formRequest("/draft/bag/new", { settings })),
      ).toMatchObject({
        data: { error: expect.any(String) },
        init: { status: 400 },
      });
    },
  );
  it.each([false, true])(
    "rejects incomplete base previews with JSON response = %s",
    async (json) => {
      const input = baseInput();
      input.availableFactions = [];
      const args = jsonRequest("/api/draft/create", input);
      if (json) {
        args.request.headers.set("X-Draft-Response", "json");
        expect(await createBase.action(args)).toMatchObject({
          data: { error: expect.stringContaining("factions") },
          init: { status: 400 },
        });
      } else {
        await expect(createBase.action(args)).rejects.toMatchObject({
          status: 400,
        });
      }
    },
  );
  it.each(["", "not-a-code", "x".repeat(1000)])(
    "rejects invalid recovery codes without reflecting unbounded input",
    async (uuid) => {
      const response = await rejoin.action(
        formRequest("/draft/rejoin", { uuid }),
      );
      expect(response).toMatchObject({
        data: { uuid: uuid.slice(0, 128), error: expect.any(String) },
        init: { status: 400 },
      });
      if (response instanceof Response) throw new Error("Unexpected redirect");
      expect(new Headers(response.init?.headers).get("Cache-Control")).toBe(
        "no-store",
      );
      expect(new Headers(response.init?.headers).has("Set-Cookie")).toBe(false);
    },
  );
  it("returns 404 for well-formed unknown recovery codes", async () => {
    expect(
      await rejoin.action(formRequest("/draft/rejoin", { uuid: randomUUID() })),
    ).toMatchObject({
      init: { status: 404 },
      data: { error: expect.stringContaining("not found") },
    });
  });
});
