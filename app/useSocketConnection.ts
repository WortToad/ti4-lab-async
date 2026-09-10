import { useEffect, useState } from "react";
import { useSocket } from "./socketContext";

type Props = {
  draftId: string;
};

export function useSocketConnection({ draftId }: Props) {
  const socket = useSocket();
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  useEffect(() => {
    if (!socket) return;

    const connected = () => {
      socket.emit("joinDraft", draftId);
      setIsDisconnected(false);
      setIsReconnecting(false);
    };
    const disconnected = () => {
      setIsDisconnected(true);
      setIsReconnecting(false);
    };
    const reconnecting = () => {
      setIsReconnecting(true);
    };
    const reconnectFailed = () => {
      setIsDisconnected(true);
      setIsReconnecting(false);
    };
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", reconnectFailed);
    socket.io.on("reconnect_attempt", reconnecting);
    socket.io.on("reconnect_failed", reconnectFailed);
    if (socket.connected) connected();
    else setIsDisconnected(true);
    return () => {
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", reconnectFailed);
      socket.io.off("reconnect_attempt", reconnecting);
      socket.io.off("reconnect_failed", reconnectFailed);
      if (socket.connected) socket.emit("leaveDraft", draftId);
    };
  }, [socket, draftId]);

  const reconnect = () => {
    socket?.disconnect();
    setIsReconnecting(true);
    socket?.connect();
  };

  return { socket, isDisconnected, isReconnecting, reconnect };
}
