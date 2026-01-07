"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  // Map NextAuth error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration. Please contact support.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    Default: "An error occurred during sign in. Please try again.",
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in error</h1>
            <p className="text-slate-600 mb-2">{errorMessage}</p>
            {error && (
              <p className="text-xs text-slate-500 mt-2">
                Error code: <code className="bg-slate-100 px-2 py-1 rounded">{error}</code>
              </p>
            )}
          </div>

          <div className="space-y-4">
            <Link
              href="/login"
              className="block w-full bg-gradient-to-r from-[#1EB9A7] to-[#0AC8E9] text-white font-semibold py-3 px-6 rounded-full hover:opacity-90 transition text-center"
            >
              Try Again
            </Link>
            <Link
              href="/apps"
              className="block text-sm text-[#29c4a9] hover:text-[#1EB9A7] font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginErrorPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-16 w-16 bg-slate-200 rounded-full mx-auto"></div>
              <div className="h-8 bg-slate-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      </main>
    }>
      <ErrorContent />
    </Suspense>
  );
}
