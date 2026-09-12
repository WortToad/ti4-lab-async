import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateDraft,
  useCreateDraftPreview,
  type DraftInput,
} from "./useCreateDraft";

const mocks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  pending: { current: false },
  navigate: vi.fn(),
  submit: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));
vi.mock("react", () => ({
  useRef: () => mocks.pending,
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.values)) mocks.values[index] = initial;
    return [
      mocks.values[index],
      (value: unknown) => {
        mocks.values[index] = value;
      },
    ];
  },
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  useFetcher: () => ({ submit: mocks.submit }),
}));

const input = {
  settings: { type: "milty4p" },
  players: [],
  selections: [],
} as unknown as DraftInput;
const onCreated = vi.fn();
function Render() {
  mocks.cursor = 0;
  return useCreateDraftPreview(onCreated);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockReset();
  mocks.pending.current = false;
  mocks.values = [];
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("BASE_URL", "/ti4/");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("preview creation and retry", () => {
  it("submits the preview under the configured base path and clears it only after success", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ url: "/draft/new-room" })),
    );
    await Render().createDraft(input);
    expect(mocks.fetch).toHaveBeenCalledWith("/ti4/api/draft/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Draft-Response": "json",
      },
      body: JSON.stringify(input),
    });
    expect(onCreated).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith("/draft/new-room");
    expect(onCreated.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.navigate.mock.invocationCallOrder[0],
    );
    expect(Render()).toMatchObject({ creating: false, error: undefined });
  });
  it("coalesces repeated clicks while creation is pending", async () => {
    let finish!: (value: Response) => void;
    mocks.fetch.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = Render().createDraft(input);
    expect(Render().creating).toBe(true);
    await Render().createDraft(input);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(onCreated).not.toHaveBeenCalled();
    finish(new Response(JSON.stringify({ url: "/draft/room" })));
    await first;
    expect(Render().creating).toBe(false);
    expect(onCreated).toHaveBeenCalledOnce();
  });
  it.each([
    {
      name: "validation",
      response: () =>
        new Response(JSON.stringify({ error: "Add another faction" }), {
          status: 400,
        }),
      message: "Add another faction",
    },
    {
      name: "server HTML",
      response: () => new Response("Service unavailable", { status: 503 }),
      message: "Your preview is saved",
    },
    {
      name: "missing URL",
      response: () => new Response("{}"),
      message: "Your preview is saved",
    },
    {
      name: "invalid URL type",
      response: () => new Response('{"url":123}'),
      message: "Your preview is saved",
    },
  ])(
    "retains edits after $name failure and permits a successful retry",
    async ({ response, message }) => {
      const before = structuredClone(input);
      mocks.fetch.mockResolvedValueOnce(response());
      await Render().createDraft(input);
      expect(Render().error).toContain(message);
      expect(Render().creating).toBe(false);
      expect(onCreated).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
      expect(input).toEqual(before);
      mocks.fetch.mockResolvedValueOnce(new Response('{"url":"/draft/retry"}'));
      await Render().createDraft(input);
      expect(onCreated).toHaveBeenCalledOnce();
      expect(Render().error).toBeUndefined();
      expect(mocks.navigate).toHaveBeenCalledWith("/draft/retry");
    },
  );
  it.each([new TypeError("Failed to fetch"), "offline"])(
    "preserves the preview on a network rejection: %s",
    async (error) => {
      mocks.fetch.mockRejectedValue(error);
      await Render().createDraft(input);
      expect(Render().error).toContain("Check your connection");
      expect(Render().creating).toBe(false);
      expect(onCreated).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    },
  );
  it("submits tournament and other direct creation through the router", () => {
    useCreateDraft()(input);
    expect(mocks.submit).toHaveBeenCalledWith(input, {
      method: "POST",
      encType: "application/json",
      action: "/draft/new",
    });
  });
});
