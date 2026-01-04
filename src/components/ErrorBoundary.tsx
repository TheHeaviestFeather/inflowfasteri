/**
 * Error Boundary component for catching render-time errors
 * Prevents entire app crashes by showing recovery UI
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development, could send to error tracking service
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-muted/30">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">
              {this.props.fallbackTitle || "Something went wrong"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {this.props.fallbackDescription ||
                "An unexpected error occurred. Try refreshing this section."}
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs text-left overflow-auto max-w-full max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleReset} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
