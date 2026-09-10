import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DraftConfig } from "~/draft/types";
import { draftConfig } from "~/draft/draftConfig";
import { makeLobbyPlayers } from "~/draft/lobbySetup";
import { generatorTestSettings } from "~/draft/common/generationTestUtils";
import { generateEmptyMap } from "~/utils/map";
import { getSystemPool } from "~/utils/system";
import { createDraft } from "~/drizzle/draft.server";
import { createMultiDraft } from "~/drizzle/multiDraft.server";
import { action } from "./route";

vi.mock("~/drizzle/draft.server", () => ({ createDraft: vi.fn() }));
vi.mock("~/drizzle/multiDraft.server", () => ({ createMultiDraft: vi.fn() }));
vi.mock("~/drizzle/baseDraftLobby.server", () => ({
  baseCookie: () => ({ serialize: async (value: string) => `admin=${value}` }),
}));

beforeEach(() => {
  vi.mocked(createDraft).mockImplementation(async (_, name) => ({
    id: name ?? "draft-id",
    prettyUrl: name ?? "draft-url",
    adminUuid: "admin-code",
  }));
  vi.mocked(createMultiDraft).mockResolvedValue("batch-url");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function request() {
  const form = new FormData();
  form.set(
    "draftSettings",
    JSON.stringify({
      ...generatorTestSettings,
      type: "milty4p",
      numFactions: 4,
      numSlices: 4,
      randomizeSlices: true,
    }),
  );
  form.set("players", JSON.stringify(makeLobbyPlayers(4)));
  form.set("numDrafts", "2");
  return new Request("http://localhost/multidraft", {
    method: "POST",
    body: form,
  });
}
const mapConfig = draftConfig.milty4p as DraftConfig & {
  generateMap: NonNullable<DraftConfig["generateMap"]>;
};
const pool = getSystemPool(["base", "pok"]);
const slices = Array.from({ length: 4 }, (_, idx) =>
  pool.slice(idx * 5, idx * 5 + 5),
);

test("a later generation failure creates no lobbies and reports how to recover", async () => {
  vi.spyOn(mapConfig, "generateMap")
    .mockReturnValueOnce({ map: generateEmptyMap(draftConfig.milty4p), slices })
    .mockReturnValueOnce(undefined);
  const response = await action({
    request: request(),
    params: {},
    context: {},
    unstable_pattern: "/multidraft",
  });
  expect(response).toMatchObject({
    data: { error: expect.stringContaining("Lobby 2 could not be prepared") },
    init: { status: 400 },
  });
  expect(createDraft).not.toHaveBeenCalled();
  expect(createMultiDraft).not.toHaveBeenCalled();
});

test("persists the batch only after all generation and validation succeeds", async () => {
  const generate = vi
    .spyOn(mapConfig, "generateMap")
    .mockReturnValue({ map: generateEmptyMap(draftConfig.milty4p), slices });
  const response = await action({
    request: request(),
    params: {},
    context: {},
    unstable_pattern: "/multidraft",
  });
  expect(response).toBeInstanceOf(Response);
  expect((response as Response).headers.get("Location")).toBe(
    "/multidraft/batch-url",
  );
  expect(createDraft).toHaveBeenCalledTimes(2);
  expect(generate.mock.invocationCallOrder[1]).toBeLessThan(
    vi.mocked(createDraft).mock.invocationCallOrder[0],
  );
  expect(createMultiDraft).toHaveBeenCalledWith(["draft-url", "draft-url"]);
});
