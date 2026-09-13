import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  Draft,
  DraftSelection,
  DraftSettings,
  SimultaneousPickType,
} from "~/types";
import { createTestDatabase } from "~/testing/database";
import { cookieHeader, formRequest, jsonRequest } from "~/testing/requests";
import { draftConfig } from "~/draft/draftConfig";
import {
  generatorTestSettings,
  seedRandom,
} from "~/draft/common/generationTestUtils";
import { makeLobbyPlayers } from "~/draft/lobbySetup";
import { buildMiniMiltySettings } from "~/draft/minimilty/buildMiniMilty";
import { prepareMultidraftDraft } from "./multidraft/prepareDraft.server";
import { getFactionPool } from "~/utils/factions";
import { getPlaceableTileIndices } from "~/utils/texasMapBuild";
import { getRingForIndex } from "~/utils/hexCoordinates";
import {
  hydratePlayers,
  computePlayerSelections,
} from "~/hooks/useHydratedDraft";
import { hydrateMap, hydratePresetMap } from "~/utils/map";
import {
  encodeAsyncMapString,
  decodeAsyncMapString,
} from "~/mapgen/utils/externalMapStringCodec";
import { getBaseKeleresSetup } from "~/draft/keleres";

vi.mock("~/utils/imageJobQueue.server", () => ({ enqueueImageJob: vi.fn() }));
vi.mock("~/discord/bot.server", () => ({
  notifyPick: vi.fn(async () => ({ success: true })),
}));
vi.mock("~/websocket/broadcast.server", () => ({
  broadcastDraftUpdate: vi.fn(),
}));

let database: ReturnType<typeof createTestDatabase>;
let lobby: typeof import("~/drizzle/baseDraftLobby.server");
let drafts: typeof import("~/drizzle/draft.server");
let route: typeof import("./draft.$id._index/route");
let stage: typeof import("./api.draft.$id.stage");
let undo: typeof import("./api.draft.$id.undo");
let keleres: typeof import("./api.draft.$id.keleres-home");
let replay: typeof import("./draft.$id.replay/route");
let publicExport: typeof import("./admin.drafts.$id.raw");
beforeAll(async () => {
  database = createTestDatabase();
  lobby = await import("~/drizzle/baseDraftLobby.server");
  drafts = await import("~/drizzle/draft.server");
  route = await import("./draft.$id._index/route");
  stage = await import("./api.draft.$id.stage");
  undo = await import("./api.draft.$id.undo");
  keleres = await import("./api.draft.$id.keleres-home");
  replay = await import("./draft.$id.replay/route");
  publicExport = await import("./admin.drafts.$id.raw");
});
beforeEach(() => seedRandom(121));
afterAll(() => database?.close());

type Room = { id: string; prettyUrl: string; admin: string; cookies: string[] };
async function stored(room: Room): Promise<Draft> {
  return JSON.parse((await drafts.draftById(room.id)).data as string);
}
async function load(room: Room, cookie = "") {
  const result = await route.loader({
    ...formRequest(`/draft/${room.prettyUrl}`, {}, cookie, {
      id: room.prettyUrl,
    }),
    request: new Request(`http://localhost/draft/${room.prettyUrl}`, {
      headers: { Cookie: cookie },
    }),
  });
  if (result instanceof Response) throw new Error("Unexpected redirect");
  expect(new Headers(result.init?.headers).get("Cache-Control")).toBe(
    "no-store",
  );
  return result.data;
}
async function create(settings: DraftSettings) {
  const prepared = prepareMultidraftDraft(
    settings,
    makeLobbyPlayers(draftConfig[settings.type].numPlayers),
  );
  const created = await drafts.createDraft(prepared);
  const room: Room = {
    ...created,
    admin: cookieHeader({
      "Set-Cookie": await lobby
        .baseCookie(created.id, "admin")
        .serialize(created.adminUuid),
    }),
    cookies: [],
  };
  expect((await load(room)).data).toBeNull();
  expect((await load(room, room.admin)).data).toBeNull();
  for (const player of prepared.players) {
    const result = await route.action(
      formRequest(
        `/draft/${room.prettyUrl}`,
        {
          operation: JSON.stringify({
            type: "join",
            name: `Test player ${player.id}`,
          }),
          revision: String(lobby.getBaseLobby(room.id)!.revision),
        },
        "",
        { id: room.prettyUrl },
      ),
    );
    expect(result.data).toMatchObject({ success: true });
    room.cookies[player.id] = cookieHeader(result.init?.headers);
  }
  const started = await route.action(
    formRequest(
      `/draft/${room.prettyUrl}`,
      {
        operation: JSON.stringify({ type: "start" }),
        revision: String(lobby.getBaseLobby(room.id)!.revision),
      },
      room.admin,
      { id: room.prettyUrl },
    ),
  );
  expect(started.data).toMatchObject({ success: true });
  expect((await load(room)).data).not.toBeNull();
  return room;
}
async function pick(room: Room, selection: DraftSelection) {
  if (!("playerId" in selection)) throw new Error("Expected an owned pick");
  const view = await load(room, room.cookies[selection.playerId]);
  const result = await route.action(
    jsonRequest(
      `/draft/${room.prettyUrl}`,
      {
        id: room.id,
        draft: {
          ...view.data,
          selections: [...view.data!.selections, selection],
        },
      },
      room.cookies[selection.playerId],
      { id: room.prettyUrl },
    ),
  );
  expect(result.data, JSON.stringify(selection)).toMatchObject({
    success: true,
  });
  return stored(room);
}

const colors = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Magenta",
  "Black",
] as const;
function nextSelection(draft: Draft): DraftSelection {
  const playerId = draft.pickOrder[draft.selections.length];
  if (typeof playerId !== "number")
    throw new Error("Expected a sequential turn");
  const own = draft.selections.filter(
    (selection) => "playerId" in selection && selection.playerId === playerId,
  );
  const has = (type: DraftSelection["type"]) =>
    own.some((selection) => selection.type === type);
  const usedFactions = draft.selections.flatMap((selection) =>
    selection.type === "SELECT_FACTION"
      ? [selection.factionId]
      : selection.type === "SELECT_MINOR_FACTION"
        ? [selection.minorFactionId]
        : [],
  );
  const bansNeeded =
    (draft.settings.modifiers?.banFactions?.numFactions ?? 0) *
    draft.players.length;
  if (draft.selections.length < bansNeeded) {
    const banned = draft.selections.flatMap((selection) =>
      selection.type === "BAN_FACTION" ? [selection.factionId] : [],
    );
    const factionId = getFactionPool(draft.settings.factionGameSets).find(
      (id) =>
        !banned.includes(id) && !draft.settings.requiredFactions?.includes(id),
    )!;
    return { type: "BAN_FACTION", playerId, factionId };
  }
  if (!has("SELECT_FACTION"))
    return {
      type: "SELECT_FACTION",
      playerId,
      factionId: (
        draft.playerFactionPool?.[playerId] ?? draft.availableFactions
      ).find((id) => !usedFactions.includes(id))!,
    };
  if (draft.settings.draftGameMode !== "presetMap" && !has("SELECT_SLICE"))
    return { type: "SELECT_SLICE", playerId, sliceIdx: playerId };
  if (
    draft.settings.draftGameMode === "twilightsFall" &&
    !has("SELECT_REFERENCE_CARD_PACK")
  )
    return { type: "SELECT_REFERENCE_CARD_PACK", playerId, packIdx: playerId };
  if (
    (draft.settings.draftGameMode !== "twilightsFall" ||
      draft.settings.nucleusStyle) &&
    !has("SELECT_SEAT")
  )
    return { type: "SELECT_SEAT", playerId, seatIdx: playerId };
  if (draft.settings.draftSpeaker && !has("SELECT_SPEAKER_ORDER"))
    return {
      type: "SELECT_SPEAKER_ORDER",
      playerId,
      speakerOrder: draft.players.length - 1 - playerId,
    };
  if (
    (draft.settings.numMinorFactions !== undefined ||
      draft.settings.minorFactionsInSharedPool) &&
    !has("SELECT_MINOR_FACTION")
  )
    return {
      type: "SELECT_MINOR_FACTION",
      playerId,
      minorFactionId: (draft.settings.minorFactionsInSharedPool
        ? draft.availableFactions
        : draft.availableMinorFactions)!.find(
        (id) => id !== "keleres" && !usedFactions.includes(id),
      )!,
    };
  if (draft.settings.draftPlayerColors && !has("SELECT_PLAYER_COLOR"))
    return { type: "SELECT_PLAYER_COLOR", playerId, color: colors[playerId] };
  throw new Error(
    `Player ${playerId} has no remaining category at turn ${draft.selections.length} of ${draft.pickOrder.length}`,
  );
}
async function sequentialPicks(room: Room) {
  let draft = await stored(room);
  while (typeof draft.pickOrder[draft.selections.length] === "number")
    draft = await pick(room, nextSelection(draft));
  return draft;
}
async function finishHomeChoice(room: Room) {
  const draft = await stored(room);
  const setup = getBaseKeleresSetup(draft);
  if (setup && !setup.chosen) {
    expect(drafts.deriveDraftMetadata(draft)).toMatchObject({
      isComplete: false,
      phase: "homeSystem",
    });
    const result = await keleres.action(
      jsonRequest(
        `/api/draft/${room.id}/keleres-home`,
        {
          playerId: setup.playerId,
          home: setup.choices[0],
          expectedSelectionCount: draft.selections.length,
        },
        room.cookies[setup.playerId],
        { id: room.id },
      ),
    );
    expect(result.data).toMatchObject({ success: true });
    expect((await stored(room)).selections).toEqual(draft.selections);
  }
  return stored(room);
}
function expectFinished(draft: Draft) {
  expect(drafts.deriveDraftMetadata(draft)).toMatchObject({
    isComplete: true,
    phase: "complete",
    progressPercent: 100,
  });
  const players = hydratePlayers(
    draft.players,
    draft.selections,
    draft.settings.draftSpeaker,
    [],
    draft.availableReferenceCardPacks,
    draft.texasDraft,
    draft.settings,
  );
  expect(new Set(players.map((player) => player.faction)).size).toBe(
    players.length,
  );
  expect(
    players.every(
      (player) =>
        player.faction &&
        player.seatIdx !== undefined &&
        player.speakerOrder !== undefined,
    ),
  ).toBe(true);
  const selections = computePlayerSelections(players);
  const map =
    draft.settings.draftGameMode === "presetMap"
      ? hydratePresetMap(draft.presetMap, selections)
      : hydrateMap(
          draftConfig[draft.settings.type],
          draft.presetMap,
          draft.slices,
          selections,
        );
  expect(map.filter((tile) => tile.type === "HOME")).toHaveLength(
    players.length,
  );
  expect(map.some((tile) => tile.type === "OPEN")).toBe(false);
  const exported = encodeAsyncMapString(map);
  expect(exported).not.toContain("undefined");
  expect(decodeAsyncMapString(exported)).not.toBeNull();
  return players;
}

describe("complete standard draft flows", () => {
  it.each(
    Object.values(draftConfig).map(
      (config) => [config.type, config.numPlayers] as const,
    ),
  )(
    "creates, joins, drafts, reloads and exports %s (%i players)",
    async (type, count) => {
      const room = await create({
        ...generatorTestSettings,
        type,
        numSlices: count,
        numFactions: count + 1,
        randomizeMap: true,
        randomizeSlices: true,
        draftSpeaker: type.startsWith("heisen"),
      });
      const finished = await sequentialPicks(room);
      expect((await load(room)).data?.selections).toEqual(finished.selections);
      const undone = await undo.action(
        jsonRequest(
          `/api/draft/${room.id}/undo`,
          { expectedSelectionCount: finished.selections.length },
          room.admin,
          { id: room.id },
        ),
      );
      expect(undone.data.success).toBe(true);
      expect((await stored(room)).selections).toHaveLength(
        finished.selections.length - 1,
      );
      await pick(room, finished.selections.at(-1)!);
      expectFinished(await finishHomeChoice(room));
    },
  );
  it.each(
    [
      { name: "bans", modifiers: { banFactions: { numFactions: 1 } } },
      {
        name: "preassigned faction hands",
        numFactions: 8,
        numPreassignedFactions: 2,
      },
      {
        name: "shared minor factions",
        numFactions: 8,
        minorFactionsInSharedPool: true,
      },
      { name: "separate minor factions", numMinorFactions: 4 },
      {
        name: "speaker and colors",
        draftSpeaker: true,
        draftPlayerColors: true,
      },
    ].map(({ name, ...settings }) => ({ name, settings })),
  )("finishes with $name", async ({ settings }) => {
    const room = await create({
      ...generatorTestSettings,
      type: "milty4p",
      numSlices: 4,
      numFactions: 5,
      ...settings,
    });
    await sequentialPicks(room);
    const finished = await finishHomeChoice(room);
    const players = expectFinished(finished);
    if (
      finished.settings.numMinorFactions ||
      finished.settings.minorFactionsInSharedPool
    )
      expect(
        new Set(
          players.flatMap((player) => [player.faction, player.minorFaction]),
        ).size,
      ).toBe(8);
    if (finished.settings.draftPlayerColors)
      expect(players.map((player) => player.factionColor)).toEqual(
        colors.slice(0, 4),
      );
    if (finished.playerFactionPool)
      for (const player of players)
        expect(finished.playerFactionPool[player.id]).toContain(player.faction);
  });
  it.each([3, 4, 5, 6])(
    "finishes Mini-Milty with %i players in two rounds",
    async (count) => {
      const settings = buildMiniMiltySettings({
        players: makeLobbyPlayers(count),
      });
      const room = await create(settings);
      const finished = await sequentialPicks(room);
      expect(finished.selections).toHaveLength(count * 2);
      expect(finished.presetMap).toEqual(settings.presetMap);
      expectFinished(finished);
    },
  );
  it("finishes a preset map with separate seating and speaker order", async () => {
    const room = await create({
      ...buildMiniMiltySettings({ players: makeLobbyPlayers(4) }),
      draftSpeaker: true,
      presetMapFormat: undefined,
    });
    const finished = await sequentialPicks(room);
    expect(finished.selections).toHaveLength(12);
    const players = expectFinished(finished);
    expect(players.map((player) => player.seatIdx)).toEqual([0, 1, 2, 3]);
    expect(players.map((player) => player.speakerOrder)).toEqual([3, 2, 1, 0]);
  });
});

async function simultaneous(
  room: Room,
  phase: SimultaneousPickType,
  values: string[],
) {
  const before = await stored(room);
  for (let playerId = 0; playerId < values.length; playerId++) {
    const response = await stage.action(
      jsonRequest(
        `/api/draft/${room.id}/stage`,
        { phase, playerId, value: values[playerId] },
        room.cookies[playerId],
        { id: room.id },
      ),
    );
    expect(response.data).toMatchObject({
      success: true,
      allPlayersReady: playerId === values.length - 1,
    });
    if (playerId < values.length - 1)
      expect((await stored(room)).selections).toEqual(before.selections);
  }
  const after = await stored(room);
  expect(after.selections).toHaveLength(before.selections.length + 1);
  expect(await drafts.getDraftStagedSelections(room.id)).toEqual({});
  return after;
}

describe("complete simultaneous draft flows", () => {
  it.each(
    Object.values(draftConfig).flatMap(({ type, numPlayers }) =>
      (type.startsWith("heisen") ? [false, true] : [false]).map(
        (draftSpeaker) => ({
          name: `${type}, ${numPlayers} players, speaker drafting ${draftSpeaker}`,
          settings: {
            type,
            nucleusStyle: type.startsWith("heisen"),
            draftSpeaker,
          },
        }),
      ),
    ),
  )(
    "finishes Twilight's Fall $name through priority and home reveal",
    async ({ settings }) => {
      const room = await create({
        ...generatorTestSettings,
        numSlices: draftConfig[settings.type].numPlayers,
        numFactions: 8,
        draftGameMode: "twilightsFall",
        randomizeMap: true,
        randomizeSlices: true,
        ...settings,
      });
      let draft = await sequentialPicks(room);
      const packs = draft.availableReferenceCardPacks!;
      draft = await simultaneous(
        room,
        "priorityValue",
        draft.players.map((player) => packs[player.id][0]),
      );
      draft = await simultaneous(
        room,
        "homeSystem",
        draft.players.map((player) => packs[player.id][1]),
      );
      const players = expectFinished(draft);
      for (const player of players) {
        expect(player.priorityValueFactionId).toBe(packs[player.id][0]);
        expect(player.homeSystemFactionId).toBe(packs[player.id][1]);
        expect(player.startingUnitsFactionId).toBe(packs[player.id][2]);
        if (settings.nucleusStyle) expect(player.seatIdx).toBe(player.id);
      }
    },
  );
  it.each(Object.values(draftConfig).map(({ type }) => type))(
    "validates Texas %s and completes every supported layout through map placement",
    async (type) => {
      const count = draftConfig[type].numPlayers;
      const settings: DraftSettings = {
        ...generatorTestSettings,
        type,
        numSlices: count,
        numFactions: count * 2,
        draftGameMode: "texasStyle",
        texasAllowFactionRedraw: true,
      };
      if (["std4p", "miltyeq7plarge"].includes(type)) {
        await expect(create(settings)).rejects.toThrow(/five tiles per player/);
        return;
      }
      const room = await create(settings);
      let draft = await stored(room);
      const initialTiles = Object.values(
        draft.texasDraft!.initialTileHands!.blue,
      )
        .flat()
        .concat(Object.values(draft.texasDraft!.initialTileHands!.red).flat());
      draft = await simultaneous(
        room,
        "texasFaction",
        draft.players.map((player) =>
          player.id === 0
            ? "REDRAW"
            : draft.texasDraft!.factionOptions![player.id][0],
        ),
      );
      for (const phase of [
        "texasBlueKeep1",
        "texasBlueKeep2",
        "texasRedKeep",
      ] as const) {
        const color = phase === "texasRedKeep" ? "red" : "blue";
        const hands = structuredClone(draft.texasDraft!.tileHands![color]);
        draft = await simultaneous(
          room,
          phase,
          draft.players.map((player) => hands[player.id][0]),
        );
        const seats = draft.texasDraft!.seatOrder;
        seats.forEach((playerId, index) =>
          expect(
            draft.texasDraft!.tileHands![color][seats[(index + 1) % count]],
          ).toEqual(hands[playerId].slice(1)),
        );
      }
      expect(
        Object.values(draft.texasDraft!.playerTiles!).flat().sort(),
      ).toEqual([...initialTiles].sort());
      let previousRing = 0;
      while (draft.selections.length < draft.pickOrder.length) {
        const playerId = draft.pickOrder[draft.selections.length] as number;
        const hand = draft.texasDraft!.playerTiles![playerId];
        const placement = hand.flatMap((systemId) =>
          getPlaceableTileIndices(draft.presetMap, hand, systemId).map(
            (mapIdx) => ({
              type: "PLACE_TILE" as const,
              playerId,
              systemId,
              mapIdx,
            }),
          ),
        )[0];
        expect(
          placement,
          `No legal placement for player ${playerId}`,
        ).toBeDefined();
        const ring = getRingForIndex(placement.mapIdx);
        expect(ring).toBeGreaterThanOrEqual(previousRing);
        previousRing = ring;
        draft = await pick(room, placement);
      }
      expect(Object.values(draft.texasDraft!.playerTiles!).flat()).toEqual([]);
      expect(
        draft.selections
          .filter((selection) => selection.type === "PLACE_TILE")
          .map((selection) => selection.systemId)
          .sort(),
      ).toEqual([...initialTiles].sort());
      expectFinished(await finishHomeChoice(room));
    },
  );
});

describe("live draft rejection and public recovery flows", () => {
  const settings: DraftSettings = {
    ...generatorTestSettings,
    type: "milty4p",
    numSlices: 4,
    numFactions: 5,
  };
  it("rejects spectator, admin-only and wrong-player writes without changing the saved draft", async () => {
    const room = await create(settings);
    const draft = await stored(room);
    const selection = nextSelection(draft);
    if (!("playerId" in selection)) throw new Error("Expected owned selection");
    for (const cookie of [
      "",
      room.admin,
      room.cookies[(selection.playerId + 1) % 4],
    ]) {
      const result = await route.action(
        jsonRequest(
          `/draft/${room.prettyUrl}`,
          {
            id: room.id,
            draft: { ...draft, selections: [selection] },
          },
          cookie,
          { id: room.prettyUrl },
        ),
      );
      expect(result.data).toMatchObject({ success: false });
      expect(await stored(room)).toEqual(draft);
    }
  });
  it("accepts only the owned selection and ignores forged settings, map and identity changes", async () => {
    const room = await create(settings);
    const draft = await stored(room);
    const selection = nextSelection(draft);
    if (!("playerId" in selection)) throw new Error("Expected owned selection");
    const result = await route.action(
      jsonRequest(
        `/draft/${room.prettyUrl}`,
        {
          id: room.id,
          draft: {
            ...draft,
            settings: {
              ...draft.settings,
              adminPassword: "forged",
              draftSpeaker: true,
            },
            players: [],
            presetMap: [],
            pickOrder: [],
            selections: [selection],
          },
        },
        room.cookies[selection.playerId],
        { id: room.prettyUrl },
      ),
    );
    expect(result.data).toMatchObject({ success: true });
    expect(await stored(room)).toEqual({ ...draft, selections: [selection] });
  });
  it("commits concurrent duplicate submissions once and rejects stale rewritten history", async () => {
    const room = await create(settings);
    const draft = await stored(room);
    const selection = nextSelection(draft);
    if (!("playerId" in selection)) throw new Error("Expected owned selection");
    const submit = () =>
      route.action(
        jsonRequest(
          `/draft/${room.prettyUrl}`,
          { id: room.id, draft: { ...draft, selections: [selection] } },
          room.cookies[selection.playerId],
          { id: room.prettyUrl },
        ),
      );
    const responses = await Promise.all([submit(), submit()]);
    expect(
      responses.filter(
        (result) =>
          typeof result.data === "object" &&
          result.data !== null &&
          "success" in result.data &&
          result.data.success,
      ),
    ).toHaveLength(1);
    const updated = await stored(room);
    expect(updated.selections).toEqual([selection]);
    const playerId = updated.pickOrder[1] as number;
    const conflict = await route.action(
      jsonRequest(
        `/draft/${room.prettyUrl}`,
        {
          id: room.id,
          draft: {
            ...updated,
            selections: [
              { type: "SELECT_SEAT", playerId, seatIdx: 0 },
              nextSelection(updated),
            ],
          },
        },
        room.cookies[playerId],
        { id: room.prettyUrl },
      ),
    );
    expect(conflict).toMatchObject({
      data: { success: false, error: "out_of_sync" },
      init: { status: 409 },
    });
    expect(await stored(room)).toEqual(updated);
  });
  it("prevents replay and JSON export before the lobby starts", async () => {
    const created = await drafts.createDraft(
      prepareMultidraftDraft(settings, makeLobbyPlayers(4)),
    );
    await expect(
      replay.loader({ params: { id: created.prettyUrl } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      publicExport.loader(
        formRequest(`/admin/drafts/${created.prettyUrl}/raw`, {}, "", {
          id: created.prettyUrl,
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("exports and replays Texas public history without exposing private hands or draw piles", async () => {
    const room = await create({ ...settings, draftGameMode: "texasStyle" });
    const draft = await stored(room);
    await simultaneous(
      room,
      "texasFaction",
      draft.players.map(
        (player) => draft.texasDraft!.factionOptions![player.id][0],
      ),
    );
    const played = await stored(room);
    const replayed = await replay.loader({ params: { id: room.prettyUrl } });
    if (replayed instanceof Response) throw new Error("Unexpected redirect");
    const exported = await publicExport.loader(
      formRequest(`/admin/drafts/${room.prettyUrl}/raw`, {}, "", {
        id: room.prettyUrl,
      }),
    );
    const publicDraft = await exported.json();
    expect(publicDraft).toEqual(replayed.data.data);
    expect(publicDraft.selections).toEqual(played.selections);
    expect(publicDraft.texasDraft).toMatchObject({
      tileHands: { blue: {}, red: {} },
      factionOptions: {},
      playerTiles: {},
    });
    expect(publicDraft.texasDraft.factionDrawPile).toBeUndefined();
    expect(publicDraft.texasDraft.initialTileHands).toBeUndefined();
    expect(exported.headers.get("Cache-Control")).toBe("no-store");
  });
});
