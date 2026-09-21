import React, { Component, type ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}] caught error:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-xs max-w-lg mx-auto my-4 text-center space-y-3">
          <span className="text-3xl block">⚠️</span>
          <h3 className="font-bold text-red-900 text-base">
            काहीतरी चूक झाली (Something went wrong)
          </h3>
          <p className="text-xs text-red-700 leading-relaxed">
            {this.state.error?.message || "घटक लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा."}
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="border-red-300 text-red-900 hover:bg-red-100 cursor-pointer"
            >
              पुन्हा प्रयत्न करा (Try Again)
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
