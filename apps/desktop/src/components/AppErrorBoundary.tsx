import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { logError } from "../lib/logging";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

/**
 * Last-resort recovery surface for a renderer crash. The raw error and
 * component stack go to the redacted console logger; the UI stays generic so a
 * file path or token cannot leak through the fallback.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError("ui.render", error, { componentStack: info.componentStack });
  }

  private retry = (): void => {
    this.setState({ failed: false });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex h-screen items-center justify-center bg-dj-bg p-8 font-sans text-dj-text">
        <section
          role="alert"
          aria-labelledby="app-error-title"
          className="w-full max-w-md border border-dj-border bg-dj-panel p-6"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center border border-dj-warning/40 bg-dj-warning/10">
            <AlertTriangle className="h-6 w-6 text-dj-warning" aria-hidden="true" />
          </div>
          <h1 id="app-error-title" className="text-lg font-semibold">
            DJ Assistant hit an unexpected error
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-dj-text-secondary">
            The interface stopped before it could finish drawing. Your library was not changed. Try
            again, or reload the window if the problem repeats. The console log is redacted.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="inline-flex items-center gap-1.5 border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs font-medium text-dj-text transition hover:bg-dj-hover"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex items-center gap-1.5 border border-dj-accent bg-dj-accent px-3 py-1.5 text-xs font-medium text-dj-on-accent transition hover:bg-dj-accent-strong"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reload app
            </button>
          </div>
        </section>
      </div>
    );
  }
}
