import { useState, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useWebSocket } from "@/lib/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Crown, Check, Clock, MessageSquare, Play, ArrowLeft, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GameSession {
  id: string;
  name: string;
  code: string;
  hostUserId: string;
  currentWeek: number;
  currentYear: number;
  maxPlayers: number;
  status: string;
  playerCount?: number;
}

interface Player {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  studioName?: string;
  studioId?: string;
}

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface MultiplayerLobbyProps {
  onStartGame: (sessionId: string, studioId: string) => void;
  onBack: () => void;
}

export function MultiplayerLobby({ onStartGame, onBack }: MultiplayerLobbyProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [newGameName, setNewGameName] = useState("");
  const [publicSessions, setPublicSessions] = useState<GameSession[]>([]);
  const [mySessions, setMySessions] = useState<GameSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // WebSocket connection
  const ws = useWebSocket(
    activeSession && user
      ? {
          userId: user.id,
          gameSessionId: activeSession.id,
          username: user.displayName || user.username,
          onMessage: (message) => {
            switch (message.type) {
              case "session_state":
                setPlayers(message.players || []);
                break;
              case "player_joined":
              case "player_left":
              case "player_connected":
              case "player_disconnected":
                refreshSession();
                break;
              case "player_ready":
              case "player_unready":
                setPlayers((prev) =>
                  prev.map((p) =>
                    p.userId === message.userId
                      ? { ...p, isReady: message.type === "player_ready" }
                      : p
                  )
                );
                break;
              case "chat":
                setChatMessages((prev) => [
                  ...prev,
                  {
                    userId: message.userId,
                    username: message.username,
                    message: message.message,
                    timestamp: message.timestamp,
                  },
                ]);
                break;
              case "game_started":
                // Use the players data from the message which has updated studioIds
                const updatedPlayers = message.players || players;
                const myPlayer = updatedPlayers.find((p: Player) => p.userId === user?.id);
                console.log("[WS] game_started received, myPlayer:", myPlayer);
                if (myPlayer?.studioId && activeSession) {
                  onStartGame(activeSession.id, myPlayer.studioId);
                } else {
                  console.error("[WS] Cannot start game - missing studioId or session", { myPlayer, activeSession });
                }
                break;
              case "all_ready":
                toast({
                  title: "All Players Ready!",
                  description: "The host can now start the game.",
                });
                break;
            }
          },
        }
      : null
  );

  // Load sessions on mount and auto-rejoin active session
  useEffect(() => {
    if (user) {
      loadPublicSessions();
      loadMySessions();
      autoRejoinSession();
    }
  }, [user]);

  const autoRejoinSession = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/multiplayer/my-sessions?userId=${user.id}`);
      const data = await res.json();
      const activeSessions = data.sessions || [];
      
      // Find the most recent active or lobby session
      const rejoinableSession = activeSessions.find(
        (s: GameSession) => s.status === 'lobby' || s.status === 'active'
      );
      
      if (rejoinableSession) {
        // Fetch full session data
        const sessionRes = await fetch(`/api/multiplayer/sessions/${rejoinableSession.id}`);
        const sessionData = await sessionRes.json();
        setActiveSession(sessionData.session);
        setPlayers(sessionData.players || []);
      }
    } catch (error) {
      console.error("Failed to auto-rejoin session:", error);
    }
  };

  const loadPublicSessions = async () => {
    try {
      const res = await fetch("/api/multiplayer/sessions/public");
      const data = await res.json();
      setPublicSessions(data.sessions || []);
    } catch (error) {
      console.error("Failed to load public sessions:", error);
    }
  };

  const loadMySessions = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/multiplayer/my-sessions?userId=${user.id}`);
      const data = await res.json();
      setMySessions(data.sessions || []);
    } catch (error) {
      console.error("Failed to load my sessions:", error);
    }
  };

  const refreshSession = async () => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/multiplayer/sessions/${activeSession.id}`);
      const data = await res.json();
      setActiveSession(data.session);
      setPlayers(data.players || []);
    } catch (error) {
      console.error("Failed to refresh session:", error);
    }
  };

  const createGame = async () => {
    if (!user || !newGameName.trim()) {
      console.log("Create game blocked:", { user, newGameName });
      if (!newGameName.trim()) {
        toast({ title: "Error", description: "Please enter a game name", variant: "destructive" });
      }
      return;
    }
    setIsLoading(true);
    try {
      console.log("Creating game:", { userId: user.id, name: newGameName.trim() });
      const res = await fetch("/api/multiplayer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: newGameName.trim(),
          maxPlayers: 4,
          isPublic: false,
        }),
      });
      const data = await res.json();
      console.log("Create game response:", data);
      if (data.session) {
        setActiveSession(data.session);
        setNewGameName("");
        toast({
          title: "Game Created!",
          description: `Share code: ${data.session.code}`,
        });
      } else if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      console.error("Create game error:", error);
      toast({ title: "Error", description: "Failed to create game", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const joinByCode = async () => {
    if (!user || !joinCode.trim()) return;
    setIsLoading(true);
    try {
      // First get session by code
      const res = await fetch(`/api/multiplayer/sessions/code/${joinCode.trim().toUpperCase()}`);
      const data = await res.json();
      
      if (!data.session) {
        toast({ title: "Not Found", description: "No game found with that code", variant: "destructive" });
        return;
      }

      // Join the session
      const joinRes = await fetch(`/api/multiplayer/sessions/${data.session.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (joinRes.ok) {
        // Fetch full session data after joining to get updated players list
        const sessionRes = await fetch(`/api/multiplayer/sessions/${data.session.id}`);
        const sessionData = await sessionRes.json();
        setActiveSession(sessionData.session);
        setPlayers(sessionData.players || []);
        setJoinCode("");
        toast({ title: "Joined!", description: `Welcome to ${data.session.name}` });
      } else {
        const err = await joinRes.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to join game", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const joinSession = async (session: GameSession) => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Allow rejoining if already a player (for started games)
      const res = await fetch(`/api/multiplayer/sessions/${session.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (res.ok) {
        // Fetch full session data
        const sessionRes = await fetch(`/api/multiplayer/sessions/${session.id}`);
        const data = await sessionRes.json();
        setActiveSession(data.session);
        setPlayers(data.players || []);
        
        // If game is already started and we have a studio, launch the game
        if (data.session.status === 'active') {
          const myPlayer = data.players?.find((p: Player) => p.userId === user.id);
          if (myPlayer?.studioId) {
            onStartGame(session.id, myPlayer.studioId);
          }
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to join game", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const leaveSession = async () => {
    if (!activeSession || !user) return;
    try {
      await fetch(`/api/multiplayer/sessions/${activeSession.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      setActiveSession(null);
      setPlayers([]);
      setChatMessages([]);
      loadMySessions();
    } catch (error) {
      console.error("Failed to leave session:", error);
    }
  };

  const toggleReady = async () => {
    if (!activeSession || !user) return;
    const myPlayer = players.find((p) => p.userId === user.id);
    const newReady = !myPlayer?.isReady;

    try {
      await fetch(`/api/multiplayer/sessions/${activeSession.id}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isReady: newReady }),
      });
      ws?.setReady(newReady);
    } catch (error) {
      console.error("Failed to toggle ready:", error);
    }
  };

  const startGame = async () => {
    if (!activeSession || !user) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/multiplayer/sessions/${activeSession.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("[StartGame] Response:", data);
        toast({ 
          title: "Game Starting!", 
          description: "Initializing game world..." 
        });
        
        // Handle game start directly from the response instead of waiting for WebSocket
        if (data.players) {
          const myPlayer = data.players.find((p: Player) => p.userId === user.id);
          console.log("[StartGame] My player:", myPlayer);
          if (myPlayer?.studioId) {
            // Small delay to let the toast show
            setTimeout(() => {
              onStartGame(activeSession.id, myPlayer.studioId);
            }, 500);
          } else {
            console.error("[StartGame] No studioId found for player");
          }
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      console.error("Start game error:", error);
      toast({ title: "Error", description: "Failed to start game", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    ws?.sendChat(chatInput.trim());
    setChatInput("");
  };

  const copyCode = () => {
    if (activeSession?.code) {
      navigator.clipboard.writeText(activeSession.code);
      toast({ title: "Copied!", description: "Game code copied to clipboard" });
    }
  };

  const isHost = activeSession && user && activeSession.hostUserId === user.id;
  const myPlayer = players.find((p) => p.userId === user?.id);
  const allReady = players.length > 0 && players.every((p) => p.isReady);

  // Session lobby view
  if (activeSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={leaveSession}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Leave Lobby
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-4 py-1">
                {activeSession.code}
              </Badge>
              <Button variant="ghost" size="icon" onClick={copyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {activeSession.name}
              </CardTitle>
              <CardDescription>
                {activeSession.status === "lobby" ? "Waiting for players..." : "Game in progress"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Players list */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Players ({players.length}/{activeSession.maxPlayers})</h3>
                  <div className="space-y-2">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          player.isConnected ? "bg-card" : "bg-muted opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                          <span>{player.displayName || player.username}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {player.isConnected ? (
                            <Badge variant="outline" className="text-green-500">Online</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
                          )}
                          {player.isReady ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={toggleReady}
                      variant={myPlayer?.isReady ? "secondary" : "default"}
                      className="flex-1"
                    >
                      {myPlayer?.isReady ? "Not Ready" : "Ready"}
                    </Button>
                    {isHost && (
                      <Button
                        onClick={startGame}
                        disabled={!allReady || players.length < 1 || isLoading}
                        className="flex-1"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Game
                      </Button>
                    )}
                  </div>
                </div>

                {/* Chat */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </h3>
                  <ScrollArea className="h-48 border rounded-lg p-3">
                    {chatMessages.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No messages yet...</p>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div key={i} className="text-sm mb-1">
                          <span className="font-medium">{msg.username}:</span> {msg.message}
                        </div>
                      ))
                    )}
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    />
                    <Button onClick={sendChat}>Send</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Session browser view
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
          <h1 className="text-2xl font-bold">Multiplayer</h1>
          <div className="w-24" />
        </div>

        <Tabs defaultValue="join" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="join">Join Game</TabsTrigger>
            <TabsTrigger value="create">Create Game</TabsTrigger>
            <TabsTrigger value="my-games">My Games</TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Join by Code</CardTitle>
                <CardDescription>Enter a 6-character game code</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCD12"
                  maxLength={6}
                  className="uppercase"
                />
                <Button onClick={joinByCode} disabled={joinCode.length !== 6 || isLoading}>
                  Join
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Public Games</CardTitle>
                  <CardDescription>Join an open game</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={loadPublicSessions}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {publicSessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No public games available</p>
                ) : (
                  <div className="space-y-2">
                    {publicSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{session.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.playerCount}/{session.maxPlayers} players
                          </p>
                        </div>
                        <Button onClick={() => joinSession(session)} disabled={isLoading}>
                          Join
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Game</CardTitle>
                <CardDescription>Start a new multiplayer session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Game Name</label>
                  <Input
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    placeholder="My Awesome Game"
                  />
                </div>
                <Button onClick={createGame} disabled={!newGameName.trim() || isLoading} className="w-full">
                  Create Game
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-games">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>My Games</CardTitle>
                  <CardDescription>Games you've joined or created</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={loadMySessions}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {mySessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No games yet</p>
                ) : (
                  <div className="space-y-2">
                    {mySessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {session.name}
                            {session.hostUserId === user?.id && <Crown className="w-4 h-4 text-yellow-500" />}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Week {session.currentWeek}, {session.currentYear} • {session.status}
                          </p>
                        </div>
                        <Button onClick={() => joinSession(session)} disabled={isLoading}>
                          {session.status === "active" ? "Resume" : "Enter Lobby"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
