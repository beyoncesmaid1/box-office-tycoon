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

const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocket(options: UseWebSocketOptions | null) {
  const { userId, gameSessionId, username, onMessage, onConnect, onDisconnect } = options || {};
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  
  // Store callbacks in refs to avoid recreating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  
  // Update refs when callbacks change (without triggering reconnection)
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    if (!userId || !gameSessionId || !username) return;

    // Don't create a new connection if one already exists and is open/connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('[WS] Connection already exists, reusing');
      return;
    }

    console.log(`[WS] Connecting to WebSocket... (attempt ${reconnectAttempts.current + 1})`);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected, authenticating...');
      // Reset reconnect attempts on successful connection
      reconnectAttempts.current = 0;
      
      // Authenticate with the server
      ws.send(JSON.stringify({
        type: "auth",
        userId,
        gameSessionId,
        username,
      }));

      // Set a timeout to check if authentication was successful
      const authTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN && !isConnected) {
          console.error('[WS] Authentication timeout');
          ws.close();
        }
      }, 5000);

      // Clear the timeout on successful authentication
      const onAuthSuccess = () => {
        clearTimeout(authTimeout);
        setIsConnected(true);
        onConnectRef.current?.();
      };

      // Override the message handler to check for auth success
      const originalOnMessage = ws.onmessage;
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WS] Received message:', message.type, message);
          
          if (message.type === 'session_state') {
            onAuthSuccess();
          }
          
          setLastMessage(message);
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };
    };

    ws.onclose = (event) => {
      console.log(`[WS] Disconnected (code: ${event.code}, reason: ${event.reason || 'no reason provided'})`);
      setIsConnected(false);
      onDisconnectRef.current?.();

      // Only attempt to reconnect if this wasn't an intentional disconnect
      if (event.code !== 1000 && event.code !== 1005) { // 1000 = Normal closure, 1005 = No status
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current); // Exponential backoff
          console.log(`[WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        } else {
          console.error(`[WS] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] WebSocket error:', error);
    };
  }, [userId, gameSessionId, username]);

  useEffect(() => {
    if (!options) return;
    
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect, userId, gameSessionId, username]);

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
