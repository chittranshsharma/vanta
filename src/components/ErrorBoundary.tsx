import { Component, type ErrorInfo, type ReactNode } from "react";
import { buildClientErrorEvent, reportClientError } from "../lib/telemetry";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  correlationId: string | null;
}

/**
 * Top-level error boundary (Upgrade G). Shows an honest failure state with a
 * correlation id the user can quote; never renders a fake empty workspace.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, correlationId: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, correlationId: crypto.randomUUID() };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const correlationId = this.state.correlationId ?? crypto.randomUUID();
    const event = buildClientErrorEvent(error, correlationId, window.location.pathname, import.meta.env.VITE_APP_VERSION ?? "dev");
    void reportClientError({ ...event, stack_head: event.stack_head ?? info.componentStack?.split("\n").slice(0, 3).join("\n") ?? null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page-shell" role="alert">
        <section className="load-error" style={{ margin: "80px auto", maxWidth: 640 }}>
          <div>
            <p className="state-overline">Something failed in the interface</p>
            <p>The page stopped rather than showing data it could not trust. Reload to continue. If it repeats, quote this id:</p>
            <ul>
              <li>{this.state.correlationId}</li>
            </ul>
          </div>
          <button className="ghost-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </main>
    );
  }
}
