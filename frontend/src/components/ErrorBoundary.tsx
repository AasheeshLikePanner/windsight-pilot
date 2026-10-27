import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("WindSight render failure", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error" role="alert">
          <div className="fatal-error__panel">
            <div className="eyebrow">WindSight</div>
            <h1>The view failed to render</h1>
            <p>
              The data is still available. Reload the page to retry; if it
              keeps failing, check the API health endpoint.
            </p>
            <button
              className="button button--active"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
