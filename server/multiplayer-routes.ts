import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { broadcastToSession, notifyGameEvent } from "./websocket";
import crypto from "crypto";

// Generate a random 6-character game code
function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars like 0/O, 1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Hash password (simple for now - in production use bcrypt)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function registerMultiplayerRoutes(app: Express) {
  // ==================== AUTHENTICATION ====================

  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, displayName } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: "Username must be 3-20 characters" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Check if username exists
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const user = await storage.createUser({
        username,
        password: hashPassword(password),
        displayName: displayName || username,
      });

      // Don't send password back
      const { password: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update online status
      await storage.updateUser(user.id, { 
        isOnline: true,
        lastSeenAt: Math.floor(Date.now() / 1000)
      });

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (userId) {
        await storage.updateUser(userId, { 
          isOnline: false,
          lastSeenAt: Math.floor(Date.now() / 1000)
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // ==================== GAME SESSIONS ====================

  // Create new game session
  app.post("/api/multiplayer/sessions", async (req: Request, res: Response) => {
    try {
      const { userId, name, maxPlayers, isPublic, weekAdvanceMode, timerMinutes } = req.body;
      console.log("[Multiplayer] Create session request:", { userId, name, maxPlayers, isPublic });

      if (!userId || !name) {
        return res.status(400).json({ error: "userId and name required" });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.error("[Multiplayer] User not found:", userId);
        return res.status(404).json({ error: "User not found" });
      }

      // Generate unique code
      let code = generateGameCode();
      let attempts = 0;
      while (await storage.getGameSessionByCode(code) && attempts < 10) {
        code = generateGameCode();
        attempts++;
      }
      console.log("[Multiplayer] Generated code:", code);

      const session = await storage.createGameSession({
        name,
        code,
        hostUserId: userId,
        maxPlayers: maxPlayers || 4,
        isPublic: isPublic || false,
        weekAdvanceMode: weekAdvanceMode || "ready",
        timerMinutes: timerMinutes || 5,
        status: "lobby",
        currentWeek: 1,
        currentYear: 2025,
      });
      console.log("[Multiplayer] Session created:", session.id);

      // Add host as first player
      await storage.createGameSessionPlayer({
        gameSessionId: session.id,
        userId,
        isHost: true,
        isReady: false,
        isConnected: false,
      });
      console.log("[Multiplayer] Host added as player");

      res.status(201).json({ session });
    } catch (error: any) {
      console.error("[Multiplayer] Create session error:", error.message, error.stack);
      res.status(500).json({ error: "Failed to create session: " + error.message });
    }
  });

  // Get public sessions
  app.get("/api/multiplayer/sessions/public", async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getPublicGameSessions();
      
      // Get player counts for each session
      const sessionsWithCounts = await Promise.all(
        sessions.map(async (session) => {
          const players = await storage.getPlayersByGameSession(session.id);
          return {
            ...session,
            playerCount: players.length,
          };
        })
      );

      res.json({ sessions: sessionsWithCounts });
    } catch (error) {
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // Get session by code (for joining)
  app.get("/api/multiplayer/sessions/code/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const session = await storage.getGameSessionByCode(code.toUpperCase());

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const players = await storage.getPlayersByGameSession(session.id);

      res.json({ session, players });
    } catch (error) {
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  // Get session by ID
  app.get("/api/multiplayer/sessions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = await storage.getGameSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const players = await storage.getPlayersByGameSession(id);
      const studios = await storage.getStudiosByGameSession(id);

      // Get user info for each player
      const playersWithInfo = await Promise.all(
        players.map(async (player) => {
          const user = await storage.getUser(player.userId);
          const studio = studios.find(s => s.userId === player.userId);
          return {
            ...player,
            username: user?.username,
            displayName: user?.displayName,
            studioName: studio?.name,
            studioBudget: studio?.budget,
            studioEarnings: studio?.totalEarnings,
          };
        })
      );

      res.json({ session, players: playersWithInfo, studios });
    } catch (error) {
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  // Join session
  app.post("/api/multiplayer/sessions/:id/join", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const session = await storage.getGameSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "lobby") {
        return res.status(400).json({ error: "Game already in progress" });
      }

      const players = await storage.getPlayersByGameSession(id);
      if (players.length >= session.maxPlayers) {
        return res.status(400).json({ error: "Session is full" });
      }

      // Check if already in session
      const existing = await storage.getGameSessionPlayerByUserAndSession(userId, id);
      if (existing) {
        return res.status(400).json({ error: "Already in session" });
      }

      const player = await storage.createGameSessionPlayer({
        gameSessionId: id,
        userId,
        isHost: false,
        isReady: false,
        isConnected: false,
      });

      // Get user info
      const user = await storage.getUser(userId);

      // Log activity
      await storage.createGameActivityLog({
        gameSessionId: id,
        userId,
        eventType: "player_joined",
        message: `${user?.displayName || user?.username} joined the game`,
        gameWeek: session.currentWeek,
        gameYear: session.currentYear,
        eventData: {},
      });

      // Notify via WebSocket
      broadcastToSession(id, {
        type: "player_joined",
        userId,
        username: user?.displayName || user?.username,
      });

      res.json({ player });
    } catch (error) {
      console.error("Join session error:", error);
      res.status(500).json({ error: "Failed to join session" });
    }
  });

  // Leave session
  app.post("/api/multiplayer/sessions/:id/leave", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const player = await storage.getGameSessionPlayerByUserAndSession(userId, id);
      if (!player) {
        return res.status(404).json({ error: "Not in session" });
      }

      const session = await storage.getGameSession(id);
      const user = await storage.getUser(userId);

      await storage.deleteGameSessionPlayer(player.id);

      // If host leaves, either transfer or delete session
      if (player.isHost) {
        const remainingPlayers = await storage.getPlayersByGameSession(id);
        if (remainingPlayers.length > 0) {
          // Transfer host to next player
          await storage.updateGameSessionPlayer(remainingPlayers[0].id, { isHost: true });
          await storage.updateGameSession(id, { hostUserId: remainingPlayers[0].userId });
        } else {
          // Delete empty session
          await storage.deleteGameSession(id);
        }
      }

      // Notify via WebSocket
      broadcastToSession(id, {
        type: "player_left",
        userId,
        username: user?.displayName || user?.username,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to leave session" });
    }
  });

  // Start game (host only)
  app.post("/api/multiplayer/sessions/:id/start", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const session = await storage.getGameSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.hostUserId !== userId) {
        return res.status(403).json({ error: "Only host can start the game" });
      }

      if (session.status !== "lobby") {
        return res.status(400).json({ error: "Game already started" });
      }

      const players = await storage.getPlayersByGameSession(id);
      if (players.length < 1) {
        return res.status(400).json({ error: "Need at least 1 player" });
      }

      // Create studios for all players
      for (const player of players) {
        const user = await storage.getUser(player.userId);
        const studio = await storage.createStudio({
          deviceId: `mp-${id}`,
          userId: player.userId,
          gameSessionId: id,
          name: `${user?.displayName || user?.username}'s Studio`,
          budget: 150000000,
          currentWeek: 1,
          currentYear: 2025,
          prestigeLevel: 1,
          totalEarnings: 0,
          totalAwards: 0,
          isAI: false,
        });

        await storage.updateGameSessionPlayer(player.id, { studioId: studio.id });
      }

      // Update session status
      await storage.updateGameSession(id, {
        status: "active",
        startedAt: Math.floor(Date.now() / 1000),
      });

      // Log activity
      await storage.createGameActivityLog({
        gameSessionId: id,
        eventType: "game_started",
        message: "The game has begun!",
        gameWeek: 1,
        gameYear: 2025,
        eventData: {},
      });

      // Get updated players with studioIds
      const updatedPlayers = await storage.getPlayersByGameSession(id);
      const playersWithStudios = await Promise.all(
        updatedPlayers.map(async (p) => {
          const user = await storage.getUser(p.userId);
          return {
            ...p,
            username: user?.username,
            displayName: user?.displayName,
          };
        })
      );

      // Notify all players with updated player data including studioIds
      broadcastToSession(id, {
        type: "game_started",
        session: await storage.getGameSession(id),
        players: playersWithStudios,
      });

      res.json({ success: true, players: playersWithStudios });
    } catch (error) {
      console.error("Start game error:", error);
      res.status(500).json({ error: "Failed to start game" });
    }
  });

  // Get user's active sessions
  app.get("/api/multiplayer/my-sessions", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const playerRecords = await storage.getGameSessionsByPlayer(userId);
      const sessions = await Promise.all(
        playerRecords.map(async (p) => {
          const session = await storage.getGameSession(p.gameSessionId);
          const players = await storage.getPlayersByGameSession(p.gameSessionId);
          return {
            ...session,
            playerCount: players.length,
            isHost: p.isHost,
          };
        })
      );

      res.json({ sessions: sessions.filter(s => s !== null) });
    } catch (error) {
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // Get activity log for session
  app.get("/api/multiplayer/sessions/:id/activity", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await storage.getActivityLogBySession(id, limit);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to get activity log" });
    }
  });

  // Toggle ready status
  app.post("/api/multiplayer/sessions/:id/ready", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId, isReady } = req.body;

      const player = await storage.getGameSessionPlayerByUserAndSession(userId, id);
      if (!player) {
        return res.status(404).json({ error: "Not in session" });
      }

      await storage.updateGameSessionPlayer(player.id, { isReady });

      const user = await storage.getUser(userId);
      broadcastToSession(id, {
        type: isReady ? "player_ready" : "player_unready",
        userId,
        username: user?.displayName || user?.username,
      });

      // Check if all ready
      const session = await storage.getGameSession(id);
      if (session?.status === "active") {
        const players = await storage.getPlayersByGameSession(id);
        const allReady = players.every(p => p.isReady);
        
        if (allReady) {
          broadcastToSession(id, {
            type: "all_ready",
            message: "All players ready!",
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update ready status" });
    }
  });

  // Advance week for multiplayer session (requires all ready or host control)
  app.post("/api/multiplayer/sessions/:id/advance-week", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const session = await storage.getGameSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "active") {
        return res.status(400).json({ error: "Game not active" });
      }

      const players = await storage.getPlayersByGameSession(id);

      // Verify user is a player in this session
      const isPlayer = players.some(p => p.userId === userId);
      if (!isPlayer) {
        return res.status(403).json({ error: "You are not a player in this session" });
      }

      // For now, any player can advance the week
      // The ready system is used in the lobby before game starts
      // In-game, we allow any player to advance (could add voting later)

      // Get the requesting player's studio to use for AI processing
      const requestingPlayer = players.find(p => p.userId === userId);
      if (!requestingPlayer?.studioId) {
        return res.status(400).json({ error: "Player has no studio" });
      }

      // Call the single-player advance-week endpoint internally
      // This runs all the AI film creation, box office, etc. logic
      // Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Railway
      const port = process.env.PORT || 5000;
      const advanceResponse = await fetch(`http://127.0.0.1:${port}/api/studio/${requestingPlayer.studioId}/advance-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!advanceResponse.ok) {
        const errorText = await advanceResponse.text();
        console.error("[Multiplayer] Advance week failed:", errorText);
        return res.status(500).json({ error: "Failed to advance week" });
      }

      const advanceData = await advanceResponse.json();
      const newWeek = advanceData.studio?.currentWeek || session.currentWeek + 1;
      const newYear = advanceData.studio?.currentYear || session.currentYear;

      // Update session to match
      await storage.updateGameSession(id, {
        currentWeek: newWeek,
        currentYear: newYear,
        lastActivityAt: Math.floor(Date.now() / 1000),
      });

      // Update all OTHER player studios to match session time
      // (the requesting player's studio was already updated by the advance-week call)
      const studios = await storage.getStudiosByGameSession(id);
      for (const studio of studios) {
        if (studio.id !== requestingPlayer.studioId) {
          await storage.updateStudio(studio.id, {
            currentWeek: newWeek,
            currentYear: newYear,
          });
        }
      }

      // Reset ready status for all players
      for (const player of players) {
        await storage.updateGameSessionPlayer(player.id, { isReady: false });
      }

      // Log activity
      await storage.createGameActivityLog({
        gameSessionId: id,
        eventType: "week_advanced",
        message: `Week ${newWeek}, ${newYear}`,
        gameWeek: newWeek,
        gameYear: newYear,
        eventData: {},
      });

      // Notify all players
      broadcastToSession(id, {
        type: "week_advanced",
        week: newWeek,
        year: newYear,
      });

      res.json({ 
        success: true, 
        week: newWeek, 
        year: newYear,
        studio: advanceData.studio,
      });
    } catch (error) {
      console.error("Advance week error:", error);
      res.status(500).json({ error: "Failed to advance week" });
    }
  });

  console.log("[Multiplayer] Routes registered");
}
