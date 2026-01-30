"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Support both "callbackUrl" (from middleware) and "next" (legacy)
  // Never use /login or /login/* as callbackUrl to prevent redirect loops
  let callbackUrl = searchParams.get("callbackUrl") || searchParams.get("next") || "/";
  if (callbackUrl.startsWith("/login")) {
    callbackUrl = "/";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        // Map NextAuth error codes to user-friendly messages
        let errorMessage = result.error;
        if (result.error === "Configuration") {
          errorMessage = "Server configuration error. Please check that all required environment variables are set and the database is accessible.";
        } else if (result.error === "AccessDenied") {
          errorMessage = "Access denied. Please contact support if you believe this is an error.";
        } else if (result.error === "Verification") {
          errorMessage = "The verification link has expired or has already been used. Please request a new one.";
        }
        setMessage({ type: "error", text: errorMessage });
        // Do NOT redirect on error - show error message to user
      } else {
        // Email was sent successfully (no error) - always redirect to verify page
        // This handles both result.ok === true (unlikely after email send) and result.ok === false (normal case)
        const verifyPath = `/login/verify?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(email)}`;
        router.push(verifyPath);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <img src="/obd-logo.png" alt="OBD Logo" className="h-12 w-auto mx-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Sign in to Premium</h1>
          <p className="text-slate-600 mb-1">
            We'll email you a secure, one-time login link.
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#29c4a9] focus:border-transparent outline-none transition"
                disabled={isLoading}
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#1EB9A7] to-[#0AC8E9] text-white font-semibold py-3 px-6 rounded-full hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isLoading ? "Sending..." : "Send Login Link"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-6 space-y-3 text-center">
          <Link
            href="/apps"
            className="block text-sm text-[#29c4a9] hover:text-[#1EB9A7] font-medium"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="https://ocalabusinessdirectory.com"
            className="block text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            ← Back to Directory
          </Link>
        </div>

        {/* Support & Learning (quiet, optional) */}
        <div className="mt-10">
          <div className="text-left max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Support &amp; Learning
            </h2>
            <p className="text-sm text-slate-600">
              Find answers fast — or reach the team if you need human help.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Link
              href="/help-center"
              className="h-full min-h-[180px] bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col transition-shadow transition-colors hover:shadow-md hover:border-slate-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <span className="text-xl leading-none">🧭</span>
                </div>
                <h3 className="text-base font-semibold leading-tight text-slate-900">
                  Help Center
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Search across OBD tools to understand how things work. Read-only. No changes made.
              </p>
              <div className="mt-auto pt-5">
                <span className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100">
                  Open Help Center →
                </span>
              </div>
            </Link>

            <a
              href="https://ocalabusinessdirectory.com/contact/"
              className="h-full min-h-[180px] bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col transition-shadow transition-colors hover:shadow-md hover:border-slate-300"
              rel="noreferrer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <span className="text-xl leading-none">💬</span>
                </div>
                <h3 className="text-base font-semibold leading-tight text-slate-900">
                  Contact Support
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Need help from the team? Send a support request and we’ll point you in the right direction.
              </p>
              <div className="mt-auto pt-5">
                <span className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100">
                  Open Support →
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginFormClient() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-200px)] bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4"></div>
              <div className="h-10 bg-slate-200 rounded"></div>
              <div className="h-10 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

