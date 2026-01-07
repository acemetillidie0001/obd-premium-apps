"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import { getThemeClasses } from "@/lib/obd-framework/theme";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  showHomeLink?: boolean;
  homeLinkHref?: string;
  homeLinkText?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component for catching React errors and displaying a friendly fallback UI
 * 
 * Features:
 * - Friendly error message
 * - Retry button (reloads page)
 * - Safe navigation link (dashboard/home)
 * - Error details only shown in development
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for monitoring/debugging
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = () => {
    // Reset error state and reload page
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === "development";
      const themeClasses = getThemeClasses(false); // Default to light theme for error page
      const {
        fallbackTitle = "Something went wrong",
        fallbackMessage = "We encountered an unexpected error. Please try again.",
        showHomeLink = true,
        homeLinkHref = "/apps",
        homeLinkText = "Back to Dashboard",
      } = this.props;

      return (
        <OBDPageContainer
          isDark={false}
          onThemeToggle={() => {}}
          title="Error"
          tagline="An error occurred"
        >
          <OBDPanel isDark={false}>
            <div className="space-y-6">
              {/* Error Icon/Message */}
              <div className="text-center">
                <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {fallbackTitle}
                </h2>
                <p className="text-gray-600">{fallbackMessage}</p>
              </div>

              {/* Error Details (Dev Only) */}
              {isDev && this.state.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-semibold text-red-900 mb-2">
                    Error Details (Development Only):
                  </p>
                  <pre className="text-xs text-red-800 overflow-auto">
                    {this.state.error.toString()}
                    {this.state.error.stack && `\n\n${this.state.error.stack}`}
                  </pre>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="px-6 py-3 bg-[#29c4a9] text-white font-medium rounded-xl hover:bg-[#25b09a] transition-colors"
                >
                  Retry
                </button>
                {showHomeLink && (
                  <Link
                    href={homeLinkHref}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-center"
                  >
                    {homeLinkText}
                  </Link>
                )}
              </div>
            </div>
          </OBDPanel>
        </OBDPageContainer>
      );
    }

    return this.props.children;
  }
}

