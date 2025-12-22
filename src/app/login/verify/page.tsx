"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function VerifyPage() {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
            <p className="text-slate-600">
              We've sent you a magic link to sign in. Click the link in the email to continue.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-600 mb-2">
              <strong>Didn't receive the email?</strong>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Check your spam folder or wait a moment and try again.
            </p>
            {countdown > 0 ? (
              <p className="text-xs text-slate-400">
                You can request another link in {countdown} seconds
              </p>
            ) : (
              <Link
                href="/login"
                className="text-sm text-[#29c4a9] hover:text-[#1EB9A7] font-medium"
              >
                Request another link
              </Link>
            )}
          </div>

          <Link
            href="/"
            className="text-sm text-[#29c4a9] hover:text-[#1EB9A7] font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

