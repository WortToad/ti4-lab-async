import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLobbyRefresh } from "./useLobbyRefresh";

const mocks = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | undefined)[],
  pending: { current: false },
  fetchers: [] as { state: string }[],
  revalidator: { state: "idle", revalidate: vi.fn() },
  socket: undefined as unknown,
  sound: false,
  browserAlerts: false,
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
vi.mock("react-router", () => ({
  useFetchers: () => mocks.fetchers,
  useRevalidator: () => mocks.revalidator,
}));
vi.mock("~/socketContext", () => ({ useSocket: () => mocks.socket }));
vi.mock("~/utils/audioAlert", () => ({ isAudioAlertEnabled: () => mocks.sound }));
vi.mock("~/draft/turnNotifications", () => ({ browserAlertsEnabled: () => mocks.browserAlerts }));

let browser: EventTarget;
let documentState: EventTarget & { visibilityState: string };
let connection: { onLine: boolean };
let socket: EventEmitter;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.effects = [];
  mocks.pending.current = false;
  mocks.fetchers = [];
  mocks.sound = false;
  mocks.browserAlerts = false;
  mocks.revalidator.state = "idle";
  mocks.revalidator.revalidate.mockClear();
  socket = new EventEmitter();
  mocks.socket = socket;
  browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
  documentState = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  connection = { onLine: true };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", documentState);
  vi.stubGlobal("navigator", connection);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("lobby refresh lifecycle", () => {
  it("refreshes immediately on visibility, online and reconnect events and removes all listeners", () => {
    useLobbyRefresh();
    const cleanup = mocks.effects[0]();
    documentState.dispatchEvent(new Event("visibilitychange"));
    browser.dispatchEvent(new Event("online"));
    socket.emit("connect");
    socket.emit("draftChanged");
    expect(mocks.revalidator.revalidate).toHaveBeenCalledTimes(4);
    cleanup?.();
    documentState.dispatchEvent(new Event("visibilitychange"));
    browser.dispatchEvent(new Event("online"));
    socket.emit("connect");
    vi.advanceTimersByTime(3000);
    expect(mocks.revalidator.revalidate).toHaveBeenCalledTimes(4);
    expect(socket.listenerCount("draftChanged")).toBe(0);
  });

  it("polls only when visible and online", () => {
    useLobbyRefresh();
    const cleanup = mocks.effects[0]();
    documentState.visibilityState = "hidden";
    vi.advanceTimersByTime(6000);
    expect(mocks.revalidator.revalidate).not.toHaveBeenCalled();
    documentState.visibilityState = "visible";
    connection.onLine = false;
    vi.advanceTimersByTime(3000);
    expect(mocks.revalidator.revalidate).not.toHaveBeenCalled();
    connection.onLine = true;
    vi.advanceTimersByTime(3000);
    expect(mocks.revalidator.revalidate).toHaveBeenCalledOnce();
    cleanup?.();
  });

  it.each(["sound", "browserAlerts"] as const)("keeps an opted-in %s listener up to date in a background tab", (preference) => {
    mocks[preference] = true;
    documentState.visibilityState = "hidden";
    useLobbyRefresh();
    const cleanup = mocks.effects[0]();
    vi.advanceTimersByTime(3000);
    socket.emit("draftChanged");
    expect(mocks.revalidator.revalidate).toHaveBeenCalledTimes(2);
    mocks[preference] = false;
    vi.advanceTimersByTime(3000);
    socket.emit("draftChanged");
    expect(mocks.revalidator.revalidate).toHaveBeenCalledTimes(2);
    cleanup?.();
  });

  it.each(["submission", "refresh"])(
    "defers incoming updates until an active %s completes",
    (busy) => {
      if (busy === "submission") mocks.fetchers = [{ state: "submitting" }];
      else mocks.revalidator.state = "loading";
      useLobbyRefresh();
      const cleanup = mocks.effects[0]();
      socket.emit("draftChanged");
      vi.advanceTimersByTime(6000);
      expect(mocks.revalidator.revalidate).not.toHaveBeenCalled();
      cleanup?.();
      mocks.fetchers = [];
      mocks.revalidator.state = "idle";
      useLobbyRefresh();
      const nextCleanup = mocks.effects[1]();
      expect(mocks.revalidator.revalidate).toHaveBeenCalledOnce();
      expect(mocks.pending.current).toBe(false);
      nextCleanup?.();
    },
  );
});
