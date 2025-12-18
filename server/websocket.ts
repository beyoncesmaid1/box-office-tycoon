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

const clients: Map<string, ConnectedClient> = new Map(); // keyed by odule
const gameSessionClients: Map<string, Set<string>> = new Map(); // gameSessionId -> Set of client keys

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let clientKey: string | null = null;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "auth": {
            // Client authenticates with userId and gameSessionId
            const { userId, gameSessionId, username } = message;
            if (!userId || !gameSessionId) {
              ws.send(JSON.stringify({ type: "error", message: "Missing userId or gameSessionId" }));
              return;
            }

            clientKey = `${userId}:${gameSessionId}`;
            clients.set(clientKey, { ws, userId, gameSessionId, username: username || "Player" });

            // Add to game session tracking
            if (!gameSessionClients.has(gameSessionId)) {
              gameSessionClients.set(gameSessionId, new Set());
            }
            gameSessionClients.get(gameSessionId)!.add(clientKey);

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

            console.log(`[WS] Client connected: ${username} to session ${gameSessionId}`);
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

    ws.on("close", async () => {
      if (clientKey) {
        const client = clients.get(clientKey);
        if (client) {
          // Update player connection status
          const player = await storage.getGameSessionPlayerByUserAndSession(client.userId, client.gameSessionId);
          if (player) {
            await storage.updateGameSessionPlayer(player.id, { 
              isConnected: false,
              lastSeenAt: Math.floor(Date.now() / 1000)
            });
          }

          // Notify others
          broadcastToSession(client.gameSessionId, {
            type: "player_disconnected",
            userId: client.userId,
            username: client.username,
          }, clientKey);

          // Remove from tracking
          gameSessionClients.get(client.gameSessionId)?.delete(clientKey);
          clients.delete(clientKey);

          console.log(`[WS] Client disconnected: ${client.username}`);
        }
      }
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
    return;
  }

  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  const clientKeys = Array.from(sessionClients);
  for (const clientKey of clientKeys) {
    if (excludeClientKey && clientKey === excludeClientKey) continue;
    const client = clients.get(clientKey);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
      sentCount++;
    }
  }
  console.log(`[WS] Broadcast ${message.type} to ${sentCount}/${sessionClients.size} clients in session ${gameSessionId}`);
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
