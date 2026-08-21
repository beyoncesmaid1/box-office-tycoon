import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[UI] Uncaught render error:", error);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="font-display text-2xl">
            {this.props.fallbackTitle || "Something went wrong"}
          </h1>
          <p className="text-sm text-muted-foreground">
            The screen crashed instead of staying blank. You can return to the current view or reload the game.
          </p>
          <p className="text-xs text-muted-foreground break-words">
            {this.state.error.message}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload Game
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
