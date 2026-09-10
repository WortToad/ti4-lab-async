import { describe, expect, it, vi } from "vitest";
import type { Server, Socket } from "socket.io";
import type { Draft } from "~/types";
import {
  broadcastDraftUpdate,
  registerDraftSyncHandlers,
  setSocketIO,
} from "./broadcast.server";

describe("draft websocket privacy", () => {
  it("broadcasts an invalidation without draft contents", async () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    setSocketIO({ to } as unknown as Server);
    await broadcastDraftUpdate("room", {
      privateHand: "secret",
    } as unknown as Draft);
    expect(to).toHaveBeenCalledWith("draft:room");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("draftChanged");
  });

  it("never forwards a client-provided draft and only notifies joined rooms", () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const rooms = new Set<string>();
    const emit = vi.fn();
    const join = vi.fn((room: string) => rooms.add(room));
    const leave = vi.fn((room: string) => rooms.delete(room));
    registerDraftSyncHandlers({
      on: (event: string, callback: (...args: unknown[]) => void) => {
        handlers[event] = callback;
      },
      rooms,
      join,
      leave,
      to: () => ({ emit }),
    } as unknown as Socket);
    handlers.syncDraft("room", "forged private draft");
    expect(emit).not.toHaveBeenCalled();
    handlers.joinDraft("room");
    handlers.syncDraft("room", "forged private draft");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("draftChanged");
    handlers.joinDraft({ id: "room" });
    handlers.joinDraft("bad room!");
    expect(join).toHaveBeenCalledTimes(1);
    handlers.leaveDraft("room");
    handlers.syncDraft("room", "forged private draft");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith("draft:room");
    handlers.leaveDraft({ id: "room" });
    handlers.leaveDraft("bad room!");
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
