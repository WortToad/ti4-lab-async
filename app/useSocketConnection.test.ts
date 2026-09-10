import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSocketConnection } from "./useSocketConnection";

const hooks = vi.hoisted(() => ({
  socket: undefined as unknown,
  effects: [] as (() => (() => void) | undefined)[],
  setters: [] as ReturnType<typeof vi.fn>[],
}));
vi.mock("./socketContext", () => ({ useSocket: () => hooks.socket }));
vi.mock("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) => hooks.effects.push(effect),
  useState: (initial: boolean) => {
    const set = vi.fn();
    hooks.setters.push(set);
    return [initial, set];
  },
}));
vi.mock("react/compiler-runtime", () => ({
  c: (size: number) => Array(size).fill(Symbol.for("react.memo_cache_sentinel")),
}));

class DraftSocket extends EventEmitter {
  connected = true;
  io = new EventEmitter();
  disconnect = vi.fn(() => {
    this.connected = false;
    this.emit("disconnect");
  });
  connect = vi.fn();
}

beforeEach(() => {
  hooks.effects = [];
  hooks.setters = [];
});

describe("draft connection lifecycle", () => {
  it("joins when navigating to a draft on an already connected socket", () => {
    const socket = new DraftSocket();
    const joined = vi.fn();
    const left = vi.fn();
    socket.on("joinDraft", joined);
    socket.on("leaveDraft", left);
    hooks.socket = socket;
    useSocketConnection({ draftId: "first" });
    const cleanup = hooks.effects[0]();
    expect(joined).toHaveBeenCalledWith("first");

    cleanup?.();
    expect(left).toHaveBeenCalledWith("first");
    useSocketConnection({ draftId: "second" });
    hooks.effects[1]();
    joined.mockClear();
    socket.emit("connect");
    expect(joined).toHaveBeenCalledOnce();
    expect(joined).toHaveBeenCalledWith("second");
  });

  it("tracks Manager reconnection events and clears the spinner on success", () => {
    const socket = new DraftSocket();
    socket.connected = false;
    const joined = vi.fn();
    socket.on("joinDraft", joined);
    hooks.socket = socket;
    useSocketConnection({ draftId: "room" });
    const cleanup = hooks.effects[0]();
    const [disconnected, reconnecting] = hooks.setters;
    expect(joined).not.toHaveBeenCalled();
    expect(disconnected).toHaveBeenLastCalledWith(true);
    socket.io.emit("reconnect_attempt", 1);
    expect(reconnecting).toHaveBeenLastCalledWith(true);
    socket.connected = true;
    socket.emit("connect");
    expect(joined).toHaveBeenCalledWith("room");
    expect(disconnected).toHaveBeenLastCalledWith(false);
    expect(reconnecting).toHaveBeenLastCalledWith(false);
    socket.emit("disconnect");
    socket.io.emit("reconnect_attempt", 1);
    socket.io.emit("reconnect_failed");
    expect(disconnected).toHaveBeenLastCalledWith(true);
    expect(reconnecting).toHaveBeenLastCalledWith(false);
    cleanup?.();
    for (const event of ["connect", "disconnect", "connect_error"])
      expect(socket.listenerCount(event)).toBe(0);
    expect(socket.io.listenerCount("reconnect_attempt")).toBe(0);
    expect(socket.io.listenerCount("reconnect_failed")).toBe(0);
  });

  it("keeps manual reconnection pending after the disconnect event", () => {
    const socket = new DraftSocket();
    hooks.socket = socket;
    const connection = useSocketConnection({ draftId: "room" });
    hooks.effects[0]();
    connection.reconnect();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(socket.connect).toHaveBeenCalledOnce();
    expect(hooks.setters[1]).toHaveBeenLastCalledWith(true);
  });
});
