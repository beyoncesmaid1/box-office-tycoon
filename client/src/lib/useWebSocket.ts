import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  userId: string;
  gameSessionId: string;
  username: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions | null) {
  const { userId, gameSessionId, username, onMessage, onConnect, onDisconnect } = options || {};
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!userId || !gameSessionId || !username) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      // Authenticate with the server
      ws.send(JSON.stringify({
        type: "auth",
        userId,
        gameSessionId,
        username,
      }));
      setIsConnected(true);
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
        onMessage?.(message);
      } catch (error) {
        console.error("[WS] Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setIsConnected(false);
      onDisconnect?.();

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (userId && gameSessionId) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }, [userId, gameSessionId, username, onMessage, onConnect, onDisconnect]);

  useEffect(() => {
    if (options) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, options]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const setReady = useCallback((ready: boolean) => {
    send({ type: ready ? "ready" : "unready" });
  }, [send]);

  const sendChat = useCallback((message: string) => {
    send({ type: "chat", message });
  }, [send]);

  const sendGameAction = useCallback((action: string, data: any) => {
    send({ type: "game_action", action, data });
  }, [send]);

  return {
    isConnected,
    lastMessage,
    send,
    setReady,
    sendChat,
    sendGameAction,
  };
}
