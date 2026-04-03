import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
            <p className="text-slate-600 mb-6">An unexpected error occurred in the application interface.</p>

            <div className="bg-slate-50 p-4 rounded-lg mb-8 overflow-auto max-h-64 text-sm font-mono text-slate-800 border border-slate-200">
              {this.state.error?.toString()}
              <br/>
              {this.state.error?.stack}
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-orange-800 mb-2">Recovery Options</h2>
              <p className="text-orange-700 text-sm mb-4">
                You can try clearing your local application data to fix corrupted state.
                <strong> This will ONLY clear local display preferences:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-orange-700 mb-6 space-y-1 ml-2">
                <li>View mode (Grid/List)</li>
                <li>Item size preferences</li>
                <li>Pinned domains</li>
                <li>Sidebar and inspector widths</li>
              </ul>
               <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-6 bg-emerald-50 p-3 rounded border border-emerald-100">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                 Your bookmarks, collections, and tags are safely stored in the database and will NOT be deleted.
               </div>

              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors shadow-sm"
              >
                Clear Local Data & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
