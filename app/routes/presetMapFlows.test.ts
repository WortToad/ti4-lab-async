import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "~/testing/database";
import { formRequest, jsonRequest } from "~/testing/requests";
import { generateMiniMiltyMap } from "~/draft/minimilty/buildMiniMilty";
import {
  encodeMapString,
  decodeMapString,
} from "~/mapgen/utils/mapStringCodec";
import { buildPresetDraftState } from "~/mapgen/utils/presetDraft";

let database: ReturnType<typeof createTestDatabase>;
let service: typeof import("~/drizzle/presetMap.server");
let publish: typeof import("./api.preset-maps");
let like: typeof import("./api.preset-maps.$id.like");
let view: typeof import("./api.preset-maps.$id.view");
let detail: typeof import("./maps.$slug");
beforeAll(async () => {
  database = createTestDatabase();
  service = await import("~/drizzle/presetMap.server");
  publish = await import("./api.preset-maps");
  like = await import("./api.preset-maps.$id.like");
  view = await import("./api.preset-maps.$id.view");
  detail = await import("./maps.$slug");
});
afterAll(() => database?.close());

function input() {
  return {
    name: "  Flow test galaxy  ",
    description: "  A four-player map  ",
    author: "  Alice  ",
    mapString: encodeMapString(generateMiniMiltyMap(4, () => 0.5)),
    mapConfigId: "milty4p",
  };
}
async function create() {
  const response = await publish.action(
    jsonRequest("/api/preset-maps", input()),
  );
  expect(response.data.success).toBe(true);
  if (!("id" in response.data)) throw new Error("Map was not published");
  return response.data;
}

describe("publish, discover and use a shared map", () => {
  it("persists trimmed form data and statistics, opens by slug, and prepares a new draft", async () => {
    const created = await create();
    const stored = (await service.presetMapById(created.id))!;
    expect(stored).toMatchObject({
      name: "Flow test galaxy",
      description: "A four-player map",
      author: "Alice",
      views: 0,
      likes: 0,
    });
    expect(stored.totalResources).toBeGreaterThan(0);
    expect(stored.totalInfluence).toBeGreaterThan(0);
    expect(stored.avgSliceValue).toBeGreaterThan(0);
    const result = await detail.loader(
      formRequest(`/maps/${created.slug}`, {}, "", { slug: created.slug }),
    );
    expect(result.preset.id).toBe(created.id);
    expect(result.preset.views).toBe(1);
    const decoded = decodeMapString(result.preset.mapString)!;
    const prepared = buildPresetDraftState({
      map: decoded.map,
      mapConfigId: stored.mapConfigId,
      gameSets: decoded.gameSets,
      playerCount: 4,
    });
    expect(prepared).toMatchObject({
      ok: true,
      value: {
        settings: {
          draftGameMode: "presetMap",
          draftSpeaker: true,
          presetMap: decoded.map,
        },
        players: Array.from({ length: 4 }, (_, id) => ({ id, name: "" })),
      },
    });
    expect((await service.listPresetMaps()).map((map) => map.id)).toContain(
      created.id,
    );
  });
  it("assigns distinct share links when maps have the same title", async () => {
    const first = await create();
    const second = await create();
    expect(second.id).not.toBe(first.id);
    expect(second.slug).not.toBe(first.slug);
    expect((await service.presetMapBySlug(first.slug))?.id).toBe(first.id);
    expect((await service.presetMapBySlug(second.slug))?.id).toBe(second.id);
  });
  it("counts views and deduplicates likes by visitor across proxy headers", async () => {
    const { id } = await create();
    for (let count = 1; count <= 2; count++) {
      expect(
        await view.action(
          formRequest(`/api/preset-maps/${id}/view`, {}, "", { id }),
        ),
      ).toMatchObject({ data: { success: true, views: count } });
    }
    for (const [headers, expected] of [
      [{ "x-forwarded-for": "192.0.2.1, 192.0.2.9" }, 1],
      [{ "x-real-ip": "192.0.2.1" }, 1],
      [
        { "x-forwarded-for": "192.0.2.2, 192.0.2.9", "x-real-ip": "192.0.2.1" },
        2,
      ],
      [{}, 3],
      [{}, 3],
    ] as [Record<string, string>, number][]) {
      const args = formRequest(`/api/preset-maps/${id}/like`, {}, "", { id });
      Object.entries(headers).forEach(([key, value]) =>
        args.request.headers.set(key, value),
      );
      expect(await like.action(args)).toMatchObject({
        data: { success: true, liked: true, likes: expected },
      });
    }
    expect(await service.presetMapById(id)).toMatchObject({
      views: 2,
      likes: 3,
    });
    await service.updatePresetMapImageUrl(id, "/map.png");
    expect(await service.presetMapById(id)).toMatchObject({
      imageUrl: "/map.png",
    });
  });
  it.each([
    "name",
    "description",
    "author",
    "mapString",
    "mapConfigId",
  ] as const)("rejects an empty %s without publishing", async (field) => {
    const before = await service.listPresetMaps();
    expect(
      await publish.action(
        jsonRequest("/api/preset-maps", { ...input(), [field]: "  " }),
      ),
    ).toMatchObject({
      data: { success: false, error: "Missing required fields" },
      init: { status: 400 },
    });
    expect(await service.listPresetMaps()).toEqual(before);
  });
  it.each(["publish", "like", "view"] as const)(
    "rejects non-POST requests to %s",
    async (operation) => {
      const action = { publish, like, view }[operation].action;
      expect(
        await action({
          ...formRequest("/api/preset-maps", {}),
          request: new Request("http://localhost/api/preset-maps"),
        }),
      ).toMatchObject({ data: { success: false }, init: { status: 405 } });
    },
  );
  it.each(["like", "view"] as const)(
    "rejects missing and unknown map IDs for %s",
    async (operation) => {
      const action = { like, view }[operation].action;
      expect(await action(formRequest("/api/preset-maps", {}))).toMatchObject({
        init: { status: 400 },
      });
      expect(
        await action(
          formRequest("/api/preset-maps/missing", {}, "", { id: "missing" }),
        ),
      ).toMatchObject({ init: { status: 404 } });
    },
  );
  it("reports missing map pages and incompatible draft layouts", async () => {
    await expect(detail.loader(formRequest("/maps", {}))).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(
      detail.loader(formRequest("/maps/missing", {}, "", { slug: "missing" })),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      buildPresetDraftState({
        map: [],
        mapConfigId: "unsupported",
        gameSets: ["base"],
        playerCount: 4,
      }),
    ).toMatchObject({ ok: false });
    expect(
      buildPresetDraftState({
        map: [],
        mapConfigId: "milty4p",
        gameSets: ["base"],
        playerCount: 0,
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("home systems"),
    });
  });
});
