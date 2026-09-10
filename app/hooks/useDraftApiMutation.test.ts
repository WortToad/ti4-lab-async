import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftApiMutation } from "./useDraftApiMutation";

const mocks = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | undefined)[],
  pending: { current: undefined as unknown },
  fetcher: { state: "idle", data: undefined as unknown, submit: vi.fn() },
}));
vi.mock("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) =>
    mocks.effects.push(effect),
  useRef: () => mocks.pending,
}));
vi.mock("react/compiler-runtime", () => ({
  c: (size: number) =>
    Array(size).fill(Symbol.for("react.memo_cache_sentinel")),
}));
vi.mock("react-router", () => ({ useFetcher: () => mocks.fetcher }));

function Render() {
  mocks.effects = [];
  const result = useDraftApiMutation();
  const cleanups = mocks.effects.map((effect) => effect());
  return {
    ...result,
    cleanup: () => cleanups.forEach((cleanup) => cleanup?.()),
  };
}

beforeEach(() => {
  mocks.pending.current = undefined;
  mocks.fetcher.state = "idle";
  mocks.fetcher.data = undefined;
  mocks.fetcher.submit.mockReset().mockResolvedValue(undefined);
});

describe("draft API mutations", () => {
  it("waits for authenticated loader revalidation and returns the matching action result", async () => {
    const mutation = Render();
    const completed = vi.fn();
    const request = mutation
      .submit("/api/draft/room/stage", {
        playerId: 0,
        phase: "homeSystem",
        value: "hacan",
      })
      .then(completed);
    expect(mocks.fetcher.submit).toHaveBeenCalledWith(
      { playerId: 0, phase: "homeSystem", value: "hacan" },
      {
        action: "/api/draft/room/stage",
        method: "post",
        encType: "application/json",
      },
    );
    mocks.fetcher.state = "loading";
    mocks.fetcher.data = { success: true, removedSelection: "old" };
    expect(Render().busy).toBe(true);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    mocks.fetcher.state = "idle";
    expect(Render().busy).toBe(false);
    await request;
    expect(completed).toHaveBeenCalledWith({
      success: true,
      removedSelection: "old",
    });
  });

  it("does not replace a pending request or resolve it from the previous action's data", async () => {
    mocks.fetcher.data = { success: true };
    const mutation = Render();
    const first = mutation.submit("/api/draft/room/stage", { value: "first" });
    expect(await mutation.submit("/api/draft/room/undo", {})).toMatchObject({
      success: false,
    });
    Render();
    expect(mocks.pending.current).toBeDefined();
    expect(mocks.fetcher.submit).toHaveBeenCalledOnce();
    mocks.fetcher.data = { success: false, error: "Invalid choice" };
    Render();
    expect(await first).toEqual({ success: false, error: "Invalid choice" });
  });

  it("allows retry after a transport failure and settles a request when leaving the draft", async () => {
    mocks.fetcher.submit.mockRejectedValueOnce(new Error("Connection lost"));
    const mutation = Render();
    expect(await mutation.submit("/api/draft/room/stage", {})).toEqual({
      success: false,
      error: "Connection lost",
    });
    const retry = mutation.submit("/api/draft/room/stage", {});
    expect(mocks.fetcher.submit).toHaveBeenCalledTimes(2);
    mutation.cleanup();
    expect(await retry).toMatchObject({ success: false });
    expect(mocks.pending.current).toBeUndefined();
  });
});
