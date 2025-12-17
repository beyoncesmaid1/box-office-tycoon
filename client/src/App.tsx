import { Switch, Route, useLocation } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimeControls } from "@/components/TimeControls";
import { QuitMenuButton } from "@/components/QuitMenuButton";
import { GameProvider } from "@/lib/gameState";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { MainMenu } from "@/pages/MainMenu";
import TalentEditorPage from "@/pages/TalentEditorPage";
import { AuthPage } from "@/pages/AuthPage";
import { MultiplayerLobby } from "@/pages/MultiplayerLobby";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import DevelopPage from "@/pages/DevelopPage";
import BoxOfficePage from "@/pages/BoxOfficePage";
import LibraryPage from "@/pages/LibraryPage";
import AwardsPage from "@/pages/AwardsPage";
import ReleaseCalendar from "@/pages/ReleaseCalendar";
import StreamingPage from "@/pages/StreamingPage";
import StreamingServiceDetailPage from "@/pages/StreamingServiceDetailPage";
import EmailsPage from "@/pages/EmailsPage";
import ScriptMarketplacePage from "@/pages/ScriptMarketplacePage";
import TVShowsPage from "@/pages/TVShowsPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/develop" component={DevelopPage} />
      <Route path="/tv-shows" component={TVShowsPage} />
      <Route path="/boxoffice" component={BoxOfficePage} />
      <Route path="/calendar" component={ReleaseCalendar} />
      <Route path="/library" component={LibraryPage} />
      <Route path="/streaming" component={StreamingPage} />
      <Route path="/streaming/:serviceId" component={StreamingServiceDetailPage} />
      <Route path="/emails" component={EmailsPage} />
      <Route path="/awards" component={AwardsPage} />
      <Route path="/scripts" component={ScriptMarketplacePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GameLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 flex-wrap p-3 border-b border-border bg-background sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <TimeControls />
            </div>
            <div className="flex items-center gap-2">
              <QuitMenuButton />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background sleek-scrollbar">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

type AppView = "menu" | "editor" | "multiplayer-auth" | "multiplayer-lobby" | "game";

function AppContent() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [view, setView] = useState<AppView>("menu");
  const [activeStudio, setActiveStudio] = useState<string | null>(null);
  const [multiplayerSessionId, setMultiplayerSessionId] = useState<string | null>(null);

  // Editor view
  if (view === "editor") {
    return (
      <>
        <TalentEditorPage onBack={() => setView("menu")} />
        <Toaster />
      </>
    );
  }

  // Multiplayer auth view (login/register)
  if (view === "multiplayer-auth") {
    return (
      <>
        <AuthPage 
          onSuccess={() => setView("multiplayer-lobby")} 
          onBack={() => setView("menu")} 
        />
        <Toaster />
      </>
    );
  }

  // Multiplayer lobby view
  if (view === "multiplayer-lobby") {
    if (!user) {
      // Not logged in, redirect to auth
      setView("multiplayer-auth");
      return null;
    }
    return (
      <>
        <MultiplayerLobby 
          onStartGame={(sessionId, studioId) => {
            setMultiplayerSessionId(sessionId);
            setActiveStudio(studioId);
            setView("game");
            navigate("/");
          }}
          onBack={() => setView("menu")}
        />
        <Toaster />
      </>
    );
  }

  // Main menu view
  if (view === "menu" || !activeStudio) {
    return (
      <>
        <MainMenu 
          onSelectStudio={(studioId) => {
            setActiveStudio(studioId);
            setMultiplayerSessionId(null);
            setView("game");
            navigate("/");
          }}
          onOpenEditor={() => setView("editor")}
          onOpenMultiplayer={() => {
            if (user) {
              setView("multiplayer-lobby");
            } else {
              setView("multiplayer-auth");
            }
          }}
        />
        <Toaster />
      </>
    );
  }

  // Game view
  return (
    <GameProvider studioId={activeStudio} onQuitGame={() => {
      setActiveStudio(null);
      setMultiplayerSessionId(null);
      setView("menu");
    }}>
      <TooltipProvider>
        <GameLayout />
        <Toaster />
      </TooltipProvider>
    </GameProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
