"use client";

import { useEffect } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SetupError({ error, reset }: ErrorProps) {
  const { isDark } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);

  useEffect(() => {
    // Log error for debugging
    console.error("AI Help Desk Setup Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: isDark ? "#020617" : "#f8fafc" }}>
      <OBDPanel isDark={isDark} className="max-w-2xl w-full">
        <div className="space-y-4">
          <OBDHeading level={1} isDark={isDark}>
            Setup Error
          </OBDHeading>
          
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-semibold mb-2">AI Help Desk Setup ran into an error</p>
            <p className="text-sm mb-4">
              Something went wrong while loading the setup page. Please try again or contact support if the issue persists.
            </p>
            
            {error.message && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium mb-2">
                  Error Details
                </summary>
                <div className="mt-2 p-3 rounded bg-black/20 text-xs font-mono break-all">
                  {error.message}
                  {error.digest && (
                    <div className="mt-2 text-xs opacity-70">
                      Error ID: {error.digest}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className={`px-6 py-3 font-medium rounded-xl transition-colors ${
                isDark
                  ? "bg-[#29c4a9] text-white hover:bg-[#29c4a9]/90"
                  : "bg-[#29c4a9] text-white hover:bg-[#29c4a9]/90"
              }`}
            >
              Try Again
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/apps/ai-help-desk";
                }
              }}
              className={`px-6 py-3 font-medium rounded-xl border transition-colors ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Go to Help Desk
            </button>
          </div>
        </div>
      </OBDPanel>
    </div>
  );
}

