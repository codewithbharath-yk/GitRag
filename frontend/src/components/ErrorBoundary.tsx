import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#162623] text-[#F0F5F7] font-sans h-full">
          <div className="max-w-md p-6 rounded-2xl bg-[#1B2D2A] border border-rose-500/30 shadow-2xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {this.props.fallbackTitle || 'Workspace Error'}
              </h2>
              <p className="text-xs text-[#B9CECC] mt-1.5 font-mono break-words leading-relaxed">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-xl bg-[#295255] hover:bg-[#34686C] text-white text-xs font-semibold inline-flex items-center gap-2 border border-[#577877]/40 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
