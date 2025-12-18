import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { storage } from "./storage";

// Track connected clients by game session and user
interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  gameSessionId: string;
  username: string;
}

const clients: Map<string, ConnectedClient> = new Map(); // keyed by userId:gameSessionId
const gameSessionClients: Map<string, Set<string>> = new Map(); // gameSessionId -> Set of client keys
const PING_INTERVAL = 30000; // 30 seconds

// Helper function to log connection state
function logConnectionState() {
  console.log('\n[WS] Current connection state:');
  console.log(`[WS] Total connected clients: ${clients.size}`);
  gameSessionClients.forEach((clientsSet, sessionId) => {
    console.log(`[WS] Session ${sessionId}: ${clientsSet.size} clients`);
    clientsSet.forEach(clientKey => {
      const client = clients.get(clientKey);
      console.log(`  - ${client?.username || 'unknown'} (${client?.userId || 'unknown'})`);
    });
  });
  console.log(''); // Add a newline for readability
}

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let clientKey: string | null = null;
    let pingInterval: NodeJS.Timeout;

    // Set up ping/pong
    const setupPing = () => {
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error('Error sending ping:', error);
            ws.terminate();
          }
        }
      }, PING_INTERVAL);
    };

    ws.on("pong", () => {
      // Connection is alive
    });

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "auth": {
            const { userId, gameSessionId, username } = message;
            if (!userId || !gameSessionId) {
              ws.send(JSON.stringify({ type: "error", message: "Missing userId or gameSessionId" }));
              return;
            }

            // Clean up any existing connection for this user in this session
            const existingClientKey = `${userId}:${gameSessionId}`;
            const existingClient = clients.get(existingClientKey);
            if (existingClient) {
              console.log(`[WS] Closing existing connection for user ${userId} in session ${gameSessionId}`);
              existingClient.ws.close(1000, "New connection from same user");
            }

            clientKey = existingClientKey;
            clients.set(clientKey, { ws, userId, gameSessionId, username: username || "Player" });

            // Add to game session tracking
            if (!gameSessionClients.has(gameSessionId)) {
              gameSessionClients.set(gameSessionId, new Set());
            }
            gameSessionClients.get(gameSessionId)!.add(clientKey);

            // Log connection
            console.log(`[WS] Client connected: ${username} to session ${gameSessionId}`);
            logConnectionState();

            // Set up ping after auth
            setupPing();

            // Update player connection status
            const player = await storage.getGameSessionPlayerByUserAndSession(userId, gameSessionId);
            if (player) {
              await storage.updateGameSessionPlayer(player.id, { 
                isConnected: true,
                lastSeenAt: Math.floor(Date.now() / 1000)
              });
            }

            // Notify others in the session
            broadcastToSession(gameSessionId, {
              type: "player_connected",
              userId,
              username: username || "Player",
            }, clientKey);

            // Send current session state to the connecting client
            const session = await storage.getGameSession(gameSessionId);
            const players = await storage.getPlayersByGameSession(gameSessionId);
            ws.send(JSON.stringify({
              type: "session_state",
              session,
              players,
            }));
            break;
          }

          case "ready": {
            // Player marks themselves as ready to advance week
            if (!clientKey) return;
            const client = clients.get(clientKey);
            if (!client) return;

            const player = await storage.getGameSessionPlayerByUserAndSession(client.userId, client.gameSessionId);
            if (player) {
              await storage.updateGameSessionPlayer(player.id, { isReady: true });
            }

            // Broadcast ready status
            broadcastToSession(client.gameSessionId, {
              type: "player_ready",
              userId: client.userId,
              username: client.username,
            });

            // Check if all players are ready
            await checkAllPlayersReady(client.gameSessionId);
            break;
          }

          case "unready": {
            // Player unmarks themselves as ready
            if (!clientKey) return;
            const client = clients.get(clientKey);
            if (!client) return;

            const player = await storage.getGameSessionPlayerByUserAndSession(client.userId, client.gameSessionId);
            if (player) {
              await storage.updateGameSessionPlayer(player.id, { isReady: false });
            }

            broadcastToSession(client.gameSessionId, {
              type: "player_unready",
              userId: client.userId,
              username: client.username,
            });
            break;
          }

          case "chat": {
            // Simple chat message
            if (!clientKey) return;
            const client = clients.get(clientKey);
            if (!client) return;

            broadcastToSession(client.gameSessionId, {
              type: "chat",
              userId: client.userId,
              username: client.username,
              message: message.message,
              timestamp: Date.now(),
            });
            break;
          }

          case "game_action": {
            // Notify others of a game action (film released, award won, etc.)
            if (!clientKey) return;
            const client = clients.get(clientKey);
            if (!client) return;

            broadcastToSession(client.gameSessionId, {
              type: "game_action",
              userId: client.userId,
              username: client.username,
              action: message.action,
              data: message.data,
            }, clientKey); // Exclude sender
            break;
          }

          default:
            console.log(`[WS] Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error("[WS] Error processing message:", error);
      }
    });

    ws.on("close", () => {
      console.log(`[WS] Client disconnected: ${clientKey}`);
      if (clientKey) {
        const client = clients.get(clientKey);
        if (client) {
          // Remove from game session tracking
          const sessionClients = gameSessionClients.get(client.gameSessionId);
          if (sessionClients) {
            sessionClients.delete(clientKey);
            console.log(`[WS] Removed client from session ${client.gameSessionId}, now has ${sessionClients.size} clients`);
          }
          
          // Update player connection status
          storage.getGameSessionPlayerByUserAndSession(client.userId, client.gameSessionId)
            .then(player => {
              if (player) {
                return storage.updateGameSessionPlayer(player.id, { 
                  isConnected: false,
                  lastSeenAt: Math.floor(Date.now() / 1000)
                });
              }
            })
            .catch(console.error);
          
          // Remove from clients map
          clients.delete(clientKey);
        }
      }
      clearInterval(pingInterval);
    });

    ws.on("error", (error) => {
      console.error("[WS] WebSocket error:", error);
    });
  });

  console.log("[WS] WebSocket server initialized on /ws");
  return wss;
}

// Broadcast message to all clients in a game session
export function broadcastToSession(gameSessionId: string, message: any, excludeClientKey?: string) {
  const sessionClients = gameSessionClients.get(gameSessionId);
  if (!sessionClients) {
    console.log(`[WS] No clients found for session ${gameSessionId}`);
    logConnectionState();
    return;
  }

  const clientKeys = Array.from(sessionClients);
  let sentCount = 0;
  const now = Date.now();

  clientKeys.forEach(clientKey => {
    if (excludeClientKey && clientKey === excludeClientKey) return;
    
    const client = clients.get(clientKey);
    if (!client) {
      console.log(`[WS] Client ${clientKey} not found in clients map`);
      sessionClients.delete(clientKey);
      return;
    }

    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        sentCount++;
      } catch (error) {
        console.error(`[WS] Error sending to client ${clientKey}:`, error);
        sessionClients.delete(clientKey);
        clients.delete(clientKey);
      }
    } else if (client.ws.readyState === WebSocket.CLOSED) {
      console.log(`[WS] Removing closed connection for ${clientKey}`);
      sessionClients.delete(clientKey);
      clients.delete(clientKey);
    } else {
      console.log(`[WS] Client ${clientKey} not ready (state: ${client.ws.readyState})`);
    }
  });

  console.log(`[WS] Broadcast ${message.type} to ${sentCount}/${clientKeys.length} clients in session ${gameSessionId}`);
  if (sentCount < clientKeys.length) {
    logConnectionState();
  }
}

// Check if all players in a session are ready to advance
async function checkAllPlayersReady(gameSessionId: string) {
  const session = await storage.getGameSession(gameSessionId);
  if (!session || session.status !== "active") return;

  const players = await storage.getPlayersByGameSession(gameSessionId);
  const connectedPlayers = players.filter(p => p.isConnected);
  const allReady = connectedPlayers.length > 0 && connectedPlayers.every(p => p.isReady);

  if (allReady) {
    // Notify all clients that week will advance
    broadcastToSession(gameSessionId, {
      type: "all_ready",
      message: "All players ready! Week advancing...",
    });

    // The actual week advancement will be triggered by the host or server
    // This just notifies clients
  }
}

// Notify session of week advancement
export function notifyWeekAdvanced(gameSessionId: string, newWeek: number, newYear: number) {
  broadcastToSession(gameSessionId, {
    type: "week_advanced",
    week: newWeek,
    year: newYear,
  });
}

// Notify session of a game event
export function notifyGameEvent(gameSessionId: string, eventType: string, eventData: any) {
  broadcastToSession(gameSessionId, {
    type: "game_event",
    eventType,
    data: eventData,
    timestamp: Date.now(),
  });
}

// Get connected player count for a session
export function getConnectedPlayerCount(gameSessionId: string): number {
  return gameSessionClients.get(gameSessionId)?.size || 0;
}
