import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncDraftFetcher } from "./useSyncDraft";

const mocks = vi.hoisted(() => ({
  effects: [] as (() => void)[],
  handledResult: { current: undefined as unknown },
  fetcher: { state: "idle", data: undefined as unknown, submit: vi.fn() },
  revalidator: { revalidate: vi.fn() },
  mutation: { submit: vi.fn(), busy: false },
  notify: vi.fn(),
  draft: { selections: [{ type: "faction", factionId: "hacan" }] },
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => mocks.effects.push(effect),
  useRef: () => mocks.handledResult,
}));
vi.mock("react/compiler-runtime", () => ({
  c: (size: number) =>
    Array(size).fill(Symbol.for("react.memo_cache_sentinel")),
}));
vi.mock("react-router", () => ({
  useFetcher: () => mocks.fetcher,
  useRevalidator: () => mocks.revalidator,
}));
vi.mock("~/draftStore", () => ({
  draftStore: {
    getState: () => ({ draftId: "room", draft: mocks.draft }),
  },
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notify },
}));
vi.mock("./useDraftApiMutation", () => ({
  useDraftApiMutation: () => mocks.mutation,
}));

function Render() {
  mocks.effects = [];
  const result = useSyncDraftFetcher();
  mocks.effects.forEach((effect) => effect());
  return result;
}

beforeEach(() => {
  mocks.handledResult.current = undefined;
  mocks.fetcher.state = "idle";
  mocks.fetcher.data = undefined;
  mocks.fetcher.submit.mockReset().mockResolvedValue(undefined);
  mocks.revalidator.revalidate.mockReset().mockResolvedValue(undefined);
  mocks.mutation.submit.mockReset().mockResolvedValue({ success: true });
  mocks.notify.mockClear();
});

describe("draft synchronization recovery", () => {
  it("shows the rejected choice's reason and refreshes once without reloading the page", () => {
    mocks.fetcher.data = {
      success: false,
      error: "The admin has paused this draft.",
    };
    Render();
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Could not save your choice",
        message: "The admin has paused this draft.",
        color: "red",
      }),
    );
    expect(mocks.revalidator.revalidate).toHaveBeenCalledOnce();
    Render();
    expect(mocks.revalidator.revalidate).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("waits until the mutation settles before recovering a conflict", () => {
    mocks.fetcher.data = { success: false, error: "out_of_sync" };
    mocks.fetcher.state = "loading";
    Render();
    expect(mocks.revalidator.revalidate).not.toHaveBeenCalled();
    mocks.fetcher.state = "idle";
    Render();
    expect(mocks.revalidator.revalidate).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "The draft has changed",
        color: "orange",
        message: expect.not.stringContaining("undefined"),
      }),
    );
  });

  it("leaves successful synchronization to the router's normal revalidation", () => {
    mocks.fetcher.data = { success: true };
    Render();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.revalidator.revalidate).not.toHaveBeenCalled();
  });

  it("keeps syncDraft pending until submission finishes", async () => {
    let finish!: () => void;
    mocks.fetcher.submit.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const finished = vi.fn();
    const request = Render().syncDraft().then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    expect(mocks.fetcher.submit).toHaveBeenCalledWith(
      { id: "room", draft: mocks.draft },
      { method: "POST", encType: "application/json" },
    );
    finish();
    await request;
    expect(finished).toHaveBeenCalledOnce();
  });

  it("reports a transport rejection without an unhandled promise rejection", async () => {
    mocks.fetcher.submit.mockRejectedValueOnce(new Error("Network lost"));
    await expect(Render().syncDraft()).resolves.toBeUndefined();
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Could not save your choice",
        color: "red",
      }),
    );
  });

  it.each(["undoLastPick", "undoSimultaneousPhase"] as const)(
    "refreshes immediately after an out-of-sync %s without a delayed page reload",
    async (operation) => {
      mocks.mutation.submit.mockResolvedValueOnce({
        success: false,
        error: "out_of_sync",
      });
      const draft = Render();
      const result =
        operation === "undoLastPick"
          ? await draft.undoLastPick()
          : await draft.undoSimultaneousPhase("homeSystem");
      expect(result).toEqual({ success: false });
      expect(mocks.revalidator.revalidate).toHaveBeenCalledOnce();
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "orange",
          message: expect.not.stringContaining("undefined"),
        }),
      );
    },
  );
});
