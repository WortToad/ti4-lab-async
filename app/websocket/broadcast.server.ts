import type { Server, Socket } from "socket.io";
import type { Draft } from "~/types";

interface SocketState {
  instance: Server | null;
}

interface GlobalWithSocket {
  __socketIO?: SocketState;
}

const socketState: SocketState = {
  instance: null,
};

if (typeof global !== "undefined") {
  const globalWithSocket = global as GlobalWithSocket;
  globalWithSocket.__socketIO = globalWithSocket.__socketIO || socketState;
}

export function setSocketIO(ioInstance: Server): void {
  socketState.instance = ioInstance;
  if (typeof global !== "undefined") {
    const globalWithSocket = global as GlobalWithSocket;
    if (globalWithSocket.__socketIO) {
      globalWithSocket.__socketIO.instance = ioInstance;
    }
  }
  console.log("Socket.IO instance set successfully");
}

function getSocketIO(): Server | null {
  if (typeof global !== "undefined") {
    const globalWithSocket = global as GlobalWithSocket;
    if (globalWithSocket.__socketIO?.instance) {
      return globalWithSocket.__socketIO.instance;
    }
  }
  return socketState.instance;
}

export async function broadcastDraftUpdate(
  draftId: string,
  draft: Draft,
): Promise<void> {
  void draft;
  const io = getSocketIO();

  if (!io) {
    console.warn(
      "Socket.IO instance not available, skipping WebSocket broadcast. " +
        "Clients will receive updates via API responses instead.",
    );
    return;
  }

  try {
    // Each browser reloads through its own authenticated loader. Broadcasting
    // a shared draft payload would reveal hands or staged choices to spectators.
    io.to(`draft:${draftId}`).emit("draftChanged");
    console.log(`Broadcasted draft update to draft:${draftId}`);
  } catch (error) {
    console.error("Error broadcasting draft update:", error);
  }
}

/** Legacy clients may still send a draft payload; none of it is trusted. */
export function registerDraftSyncHandlers(socket: Socket): void {
  const validId = (id: unknown): id is string =>
    typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  socket.on("joinDraft", (id: unknown) => {
    if (validId(id)) void socket.join(`draft:${id}`);
  });
  socket.on("leaveDraft", (id: unknown) => {
    if (validId(id)) void socket.leave(`draft:${id}`);
  });
  const notify = (id: unknown) => {
    if (validId(id) && socket.rooms.has(`draft:${id}`))
      socket.to(`draft:${id}`).emit("draftChanged");
  };
  socket.on("syncDraft", notify);
  socket.on("draftChanged", notify);
}
