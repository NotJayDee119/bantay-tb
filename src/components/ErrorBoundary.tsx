import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Changing this clears a caught error — pass the pathname so moving to
   *  another page gets a fresh attempt instead of the same error card. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * The app had no error boundary, so one throw anywhere in a render — or a page
 * chunk that would not load — unmounted the whole tree and left a white
 * screen with no way forward. This catches it and offers the two things that
 * actually help: reload, or go home.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-5 py-12">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-base font-semibold text-slate-900">
            {offline ? "You're offline" : "This page couldn't load"}
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            {offline
              ? "Check your connection, then reload. Nothing you saved has been lost."
              : "Something went wrong while opening this page. Reloading usually fixes it — the app may have just been updated."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              Reload
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              Go to home page
            </a>
          </div>
        </div>
      </div>
    );
  }
}
