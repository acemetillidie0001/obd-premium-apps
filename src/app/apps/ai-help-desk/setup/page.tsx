"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

interface SetupStatus {
  env: {
    hasBaseUrl: boolean;
    hasApiKey: boolean;
    baseUrlPreview: string | null;
  };
  db: {
    canQuery: boolean;
    hasAiWorkspaceMap: boolean;
    lastErrorCode?: string;
    lastErrorMessage?: string;
  };
}

interface MappingData {
  id: string;
  businessId: string;
  workspaceSlug: string;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  searchOk: boolean;
  chatOk: boolean;
  workspaceSlug: string;
  searchResultsCount: number;
  chatAnswerPreview: string;
  sourcesCount: number;
  searchError?: string | null;
  chatError?: string | null;
}

interface ProductionReadinessStatus {
  env: {
    ANYTHINGLLM_BASE_URL: "present" | "missing" | "not_required";
    ANYTHINGLLM_API_KEY: "present" | "missing" | "not_required";
    ANYTHINGLLM_TIMEOUT_MS: "present" | "missing" | "not_required";
    AI_HELP_DESK_ADMIN_EMAILS: "present" | "missing" | "not_required";
    NEXT_PUBLIC_BASE_URL: "present" | "missing" | "not_required";
  };
  database: {
    AiWorkspaceMap: "exists" | "missing";
    AiHelpDeskEntry: "exists" | "missing";
    AiHelpDeskSyncState: "exists" | "missing";
    AiHelpDeskQuestionLog: "exists" | "missing";
    AiHelpDeskWidgetKey: "exists" | "missing";
    AiHelpDeskWidgetSettings: "exists" | "missing";
  };
  summary: {
    ready: boolean;
    blockingIssues: string[];
    warnings: string[];
  };
}

export default function AIHelpDeskSetupPage() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  // Status state
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Mapping form state - prefill from query param if available
  const [businessId, setBusinessId] = useState(searchParams.get("businessId") || "");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [urlExtractionError, setUrlExtractionError] = useState<string | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingSuccess, setMappingSuccess] = useState(false);
  const [currentMapping, setCurrentMapping] = useState<MappingData | null>(null);

  // Test state
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Production readiness check
  const [prodReadiness, setProdReadiness] = useState<ProductionReadinessStatus | null>(null);
  const [prodReadinessLoading, setProdReadinessLoading] = useState(false);
  const [prodReadinessError, setProdReadinessError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  // Load status on mount
  useEffect(() => {
    loadStatus();
    checkAdminStatus();
  }, []);

  // Check admin status
  const checkAdminStatus = async () => {
    setAdminCheckLoading(true);
    try {
      const res = await fetch("/api/ai-help-desk/setup/admin");
      const json = await res.json();
      if (res.ok && json.ok) {
        setIsAdmin(json.data.isAdmin);
        if (json.data.isAdmin) {
          loadProductionReadiness();
        }
      }
    } catch (error) {
      // Not admin or error - silently fail
      setIsAdmin(false);
    } finally {
      setAdminCheckLoading(false);
    }
  };

  // Load production readiness check
  const loadProductionReadiness = async () => {
    setProdReadinessLoading(true);
    setProdReadinessError(null);

    try {
      const res = await fetch("/api/ai-help-desk/diagnostics/production-check");
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load production readiness");
      }

      setProdReadiness(json.data);
    } catch (error) {
      console.error("Production readiness check error:", error);
      setProdReadinessError(
        error instanceof Error ? error.message : "Failed to load production readiness"
      );
    } finally {
      setProdReadinessLoading(false);
    }
  };

  // Load existing mapping when businessId changes
  useEffect(() => {
    if (businessId.trim()) {
      loadMapping(businessId.trim());
    } else {
      setCurrentMapping(null);
    }
  }, [businessId]);

  // Load setup status
  const loadStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);

    try {
      const res = await fetch("/api/ai-help-desk/setup/status");
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load setup status");
      }

      setStatus(json.data);
    } catch (error) {
      console.error("Status load error:", error);
      setStatusError(
        error instanceof Error ? error.message : "Failed to load setup status"
      );
    } finally {
      setStatusLoading(false);
    }
  };

  // Load existing mapping
  const loadMapping = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-help-desk/setup/mapping?businessId=${encodeURIComponent(id)}`);
      const json = await res.json();

      if (res.ok && json.ok && json.data) {
        setCurrentMapping(json.data);
        setWorkspaceSlug(json.data.workspaceSlug);
      } else {
        setCurrentMapping(null);
      }
    } catch (error) {
      // Ignore errors - mapping just doesn't exist
      setCurrentMapping(null);
    }
  };

  // Extract workspace slug from URL
  const extractWorkspaceSlugFromUrl = (url: string): string | null => {
    if (!url || !url.trim()) {
      return null;
    }

    const trimmedUrl = url.trim();

    try {
      // Try to parse as URL first
      let urlObj: URL;
      try {
        // If it's a full URL, parse it directly
        urlObj = new URL(trimmedUrl);
      } catch {
        // If it's a path-only value, try to parse it with a dummy base
        urlObj = new URL(trimmedUrl, "https://example.com");
      }

      // Check query parameter first (e.g., ?workspace=my-slug)
      const workspaceParam = urlObj.searchParams.get("workspace");
      if (workspaceParam) {
        return workspaceParam.trim();
      }

      // Check pathname patterns
      const pathname = urlObj.pathname;

      // Pattern: /workspace/<slug> or /workspaces/<slug>
      const workspaceMatch = pathname.match(/\/workspaces?\/([^/?#]+)/);
      if (workspaceMatch && workspaceMatch[1]) {
        return workspaceMatch[1].trim();
      }

      // Pattern: /w/<slug>
      const wMatch = pathname.match(/\/w\/([^/?#]+)/);
      if (wMatch && wMatch[1]) {
        return wMatch[1].trim();
      }

      // If we have a pathname that looks like just a slug (no leading slash patterns matched)
      // Try to get the last segment if it exists
      const segments = pathname.split("/").filter((s) => s);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // Only use it if it doesn't look like a file extension or common path
        if (lastSegment && !lastSegment.includes(".") && lastSegment.length > 0) {
          return lastSegment.trim();
        }
      }
    } catch (error) {
      // If URL parsing fails, try simple string matching
      // Look for common patterns in the raw string
      const patterns = [
        /\/workspaces?\/([^/?#\s]+)/, // /workspace/slug or /workspaces/slug
        /\/w\/([^/?#\s]+)/, // /w/slug
        /[?&]workspace=([^&?#\s]+)/, // ?workspace=slug or &workspace=slug
      ];

      for (const pattern of patterns) {
        const match = trimmedUrl.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    return null;
  };

  // Handle workspace URL input change
  const handleWorkspaceUrlChange = (value: string) => {
    setWorkspaceUrl(value);
    setUrlExtractionError(null);

    if (!value.trim()) {
      return;
    }

    const extractedSlug = extractWorkspaceSlugFromUrl(value);
    if (extractedSlug) {
      setWorkspaceSlug(extractedSlug);
    } else {
      // Only show error if there's a significant amount of text (likely a URL attempt)
      if (value.trim().length > 5) {
        setUrlExtractionError("Couldn't detect slug—paste the workspace slug manually.");
      }
    }
  };

  // Save mapping
  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setMappingLoading(true);
    setMappingError(null);
    setMappingSuccess(false);

    if (!businessId.trim() || !workspaceSlug.trim()) {
      setMappingError("Business ID and workspace slug are required");
      setMappingLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai-help-desk/setup/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          workspaceSlug: workspaceSlug.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to save mapping");
      }

      setCurrentMapping(json.data);
      setMappingSuccess(true);
      setMappingError(null);
    } catch (error) {
      console.error("Mapping save error:", error);
      setMappingError(
        error instanceof Error ? error.message : "Failed to save mapping"
      );
      setMappingSuccess(false);
    } finally {
      setMappingLoading(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!businessId.trim()) {
      setTestError("Please enter a business ID first");
      return;
    }

    setTestLoading(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await fetch("/api/ai-help-desk/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          query: "hours",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        // Check for UPSTREAM_NOT_FOUND code
        if (json.code === "UPSTREAM_NOT_FOUND") {
          setTestError(
            json.details?.friendlyMessage ||
            `Workspace not found. Please verify the workspace slug "${json.details?.workspaceSlug || ""}" exists in AnythingLLM.`
          );
        } else {
          throw new Error(json.error || "Test failed");
        }
        setTestResult(null);
      } else {
        setTestResult(json.data);
        setTestError(null);
      }
    } catch (error) {
      console.error("Test error:", error);
      setTestError(
        error instanceof Error ? error.message : "Failed to test connection"
      );
      setTestResult(null);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="AI Help Desk Setup"
      tagline="Configure your AI Help Desk integration with AnythingLLM"
    >
      {/* Status Loading */}
      {statusLoading && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>
            <p>Loading setup status...</p>
          </div>
        </OBDPanel>
      )}

      {/* Status Error */}
      {statusError && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="text-sm">{statusError}</p>
            <button
              type="button"
              onClick={loadStatus}
              className={`mt-3 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Retry
            </button>
          </div>
        </OBDPanel>
      )}

      {/* Setup Steps */}
      {status && (
        <div className="mt-7 space-y-6">
          {/* Step 1: Environment Check */}
          <OBDPanel isDark={isDark}>
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  status.env.hasBaseUrl
                    ? "bg-green-500/20 text-green-400 border-2 border-green-500"
                    : "bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500"
                }`}
              >
                1
              </div>
              <div className="flex-1">
                <OBDHeading level={2} isDark={isDark} className="mb-2">
                  Environment Configuration
                </OBDHeading>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                        ANYTHINGLLM_BASE_URL:
                      </span>
                      {status.env.hasBaseUrl ? (
                        <span className="text-sm text-green-500">✓ Set</span>
                      ) : (
                        <span className="text-sm text-yellow-500">✗ Missing</span>
                      )}
                    </div>
                    {status.env.hasBaseUrl && status.env.baseUrlPreview && (
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        {status.env.baseUrlPreview}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                        ANYTHINGLLM_API_KEY:
                      </span>
                      {status.env.hasApiKey ? (
                        <span className="text-sm text-green-500">✓ Set</span>
                      ) : (
                        <span className="text-sm text-yellow-500">✗ Optional</span>
                      )}
                    </div>
                  </div>
                  {!status.env.hasBaseUrl && (
                    <div className={`mt-4 p-4 rounded-lg border ${
                      isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                    }`}>
                      <p className={`text-sm font-medium mb-2 ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
                        What to do:
                      </p>
                      <p className={`text-sm mb-3 ${themeClasses.mutedText}`}>
                        Add the following to your environment variables:
                      </p>
                      <div className={`p-3 rounded border font-mono text-xs overflow-x-auto ${
                        isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-900"
                      }`}>
                        <div className="mb-2">
                          <span className="text-green-400"># .env.local</span>
                        </div>
                        <div>ANYTHINGLLM_BASE_URL=https://your-anythingllm-instance.com</div>
                        <div className="text-slate-500 mt-1">
                          # ANYTHINGLLM_API_KEY=your-key-here (if required)
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <span className="text-blue-400"># Vercel Environment Variables</span>
                        </div>
                        <div className="mt-1">
                          Key: ANYTHINGLLM_BASE_URL
                        </div>
                        <div>
                          Value: https://your-anythingllm-instance.com
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </OBDPanel>

          {/* Step 2: Database Check */}
          <OBDPanel isDark={isDark}>
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  status.db.hasAiWorkspaceMap
                    ? "bg-green-500/20 text-green-400 border-2 border-green-500"
                    : status.db.canQuery
                      ? "bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500"
                      : "bg-red-500/20 text-red-400 border-2 border-red-500"
                }`}
              >
                2
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <OBDHeading level={2} isDark={isDark}>
                    Database Setup
                  </OBDHeading>
                  <button
                    type="button"
                    onClick={loadStatus}
                    disabled={statusLoading}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                      statusLoading
                        ? isDark
                          ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                        : isDark
                          ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {statusLoading ? "Checking..." : "Re-check Database"}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                        Database Connection:
                      </span>
                      {status.db.canQuery ? (
                        <span className="text-sm text-green-500">✓ Connected</span>
                      ) : (
                        <span className="text-sm text-red-500">✗ Cannot Connect</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                        AiWorkspaceMap Table:
                      </span>
                      {status.db.hasAiWorkspaceMap ? (
                        <span className="text-sm text-green-500">✓ Exists</span>
                      ) : (
                        <span className="text-sm text-yellow-500">✗ Missing</span>
                      )}
                    </div>
                  </div>
                  {!status.db.canQuery && (
                    <div className={`mt-4 p-4 rounded-lg border ${
                      isDark ? "bg-red-900/20 border-red-700" : "bg-red-50 border-red-200"
                    }`}>
                      <p className={`text-sm font-medium mb-2 ${isDark ? "text-red-400" : "text-red-800"}`}>
                        Database connection failed
                      </p>
                      <p className={`text-sm ${themeClasses.mutedText}`}>
                        {status.db.lastErrorMessage || "Please check your database configuration and ensure the database is accessible."}
                      </p>
                    </div>
                  )}
                  {status.db.canQuery && !status.db.hasAiWorkspaceMap && (
                    <div className={`mt-4 p-4 rounded-lg border ${
                      isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                    }`}>
                      <p className={`text-sm font-medium mb-3 ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
                        Database migration required
                      </p>
                      <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                        The AiWorkspaceMap table needs to be created. Follow these steps:
                      </p>
                      
                      {/* 3-Step Checklist */}
                      <div className="space-y-3 mb-4">
                        {/* Step 1 */}
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                          }`}>
                            1
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium mb-1 ${themeClasses.labelText}`}>
                              Run the migration locally
                            </p>
                            <div className={`p-2 rounded border font-mono text-xs ${
                              isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-900"
                            }`}>
                              npx prisma migrate dev --name add_ai_workspace_map
                            </div>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                          }`}>
                            2
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium mb-1 ${themeClasses.labelText}`}>
                              Push to GitHub
                            </p>
                            <div className={`p-2 rounded border font-mono text-xs space-y-1 ${
                              isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-900"
                            }`}>
                              <div>git add prisma/migrations</div>
                              <div>git commit -m "Add AiWorkspaceMap migration"</div>
                              <div>git push</div>
                            </div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                          }`}>
                            3
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium mb-1 ${themeClasses.labelText}`}>
                              Confirm status shows "AiWorkspaceMap table detected"
                            </p>
                            <p className={`text-xs ${themeClasses.mutedText}`}>
                              Click "Re-check Database" above after migration completes.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* What this means */}
                      <div className={`mt-4 pt-4 border-t ${
                        isDark ? "border-slate-700" : "border-slate-200"
                      }`}>
                        <p className={`text-xs font-medium mb-1 ${themeClasses.labelText}`}>
                          What this means:
                        </p>
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          Migrations create the database table once, not every time users use the app. After the table exists, this step will be green forever unless the database is reset.
                        </p>
                      </div>
                    </div>
                  )}
                  {status.db.canQuery && status.db.hasAiWorkspaceMap && (
                    <div className={`mt-4 p-4 rounded-lg border ${
                      isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                    }`}>
                      <p className={`text-sm ${isDark ? "text-green-400" : "text-green-800"}`}>
                        ✓ Database setup is complete. The AiWorkspaceMap table exists and is ready to use.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </OBDPanel>

          {/* Step 3: Link Business to Workspace */}
          {status.db.hasAiWorkspaceMap && (
            <OBDPanel isDark={isDark}>
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentMapping
                      ? "bg-green-500/20 text-green-400 border-2 border-green-500"
                      : "bg-blue-500/20 text-blue-400 border-2 border-blue-500"
                  }`}
                >
                  3
                </div>
                <div className="flex-1">
                  <OBDHeading level={2} isDark={isDark} className="mb-2">
                    Link Business to Workspace
                  </OBDHeading>
                  <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                    Connect your business ID to an AnythingLLM workspace slug. This ensures search and chat are scoped to the correct knowledge base.
                  </p>

                  <form onSubmit={handleSaveMapping} className="space-y-4">
                    <div>
                      <label
                        htmlFor="business-id"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Business ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="business-id"
                        value={businessId}
                        onChange={(e) => setBusinessId(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="e.g., my-business-name"
                        required
                      />
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                        A unique identifier for your business (usually a slug from the business name).
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="workspace-url"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Workspace URL (optional)
                      </label>
                      <input
                        type="text"
                        id="workspace-url"
                        value={workspaceUrl}
                        onChange={(e) => handleWorkspaceUrlChange(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="https://anythingllm.example.com/workspace/my-workspace"
                      />
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                        Tip: Open your workspace in AnythingLLM and paste the URL here to auto-fill the slug.
                      </p>
                      {urlExtractionError && (
                        <p className={`mt-1 text-xs ${isDark ? "text-yellow-400" : "text-yellow-600"}`}>
                          {urlExtractionError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="workspace-slug"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Workspace Slug <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="workspace-slug"
                        value={workspaceSlug}
                        onChange={(e) => {
                          setWorkspaceSlug(e.target.value);
                          // Clear URL extraction error when user manually edits slug
                          if (urlExtractionError) {
                            setUrlExtractionError(null);
                          }
                        }}
                        className={getInputClasses(isDark)}
                        placeholder="e.g., my-workspace"
                        required
                      />
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                        The workspace slug from your AnythingLLM instance (check the workspace URL in AnythingLLM).
                      </p>
                    </div>

                    {currentMapping && (
                      <div className={`p-3 rounded-lg border ${
                        isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
                      }`}>
                        <p className={`text-sm ${isDark ? "text-blue-400" : "text-blue-800"}`}>
                          ✓ Mapping exists. Click "Save Mapping" to update it.
                        </p>
                      </div>
                    )}

                    {mappingSuccess && (
                      <div className={`p-3 rounded-lg border ${
                        isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                      }`}>
                        <p className={`text-sm ${isDark ? "text-green-400" : "text-green-800"}`}>
                          ✓ Mapping saved successfully!
                        </p>
                      </div>
                    )}

                    {mappingError && (
                      <div className={getErrorPanelClasses(isDark)}>
                        <p className="text-sm">{mappingError}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={mappingLoading || !businessId.trim() || !workspaceSlug.trim()}
                      className={SUBMIT_BUTTON_CLASSES}
                    >
                      {mappingLoading ? "Saving..." : currentMapping ? "Update Mapping" : "Save Mapping"}
                    </button>
                  </form>
                </div>
              </div>
            </OBDPanel>
          )}

          {/* Step 4: Test Connection */}
          {status.db.hasAiWorkspaceMap && (
            <OBDPanel isDark={isDark}>
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-purple-500/20 text-purple-400 border-2 border-purple-500">
                  4
                </div>
                <div className="flex-1">
                  <OBDHeading level={2} isDark={isDark} className="mb-2">
                    Test Connection
                  </OBDHeading>
                  <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                    Test that your workspace is properly configured and accessible. This will run a search and chat test.
                  </p>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testLoading || !businessId.trim()}
                    className={SUBMIT_BUTTON_CLASSES}
                  >
                    {testLoading ? "Testing..." : "Test Connection"}
                  </button>

                  {testError && (
                    <div className={`mt-4 ${getErrorPanelClasses(isDark)}`}>
                      <p className="text-sm font-medium mb-1">Test Failed</p>
                      <p className="text-sm">{testError}</p>
                    </div>
                  )}

                  {testResult && (
                    <div className={`mt-4 space-y-3`}>
                      <div className={`p-4 rounded-lg border ${
                        testResult.searchOk && testResult.chatOk
                          ? isDark
                            ? "bg-green-900/20 border-green-700"
                            : "bg-green-50 border-green-200"
                          : isDark
                            ? "bg-yellow-900/20 border-yellow-700"
                            : "bg-yellow-50 border-yellow-200"
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          {testResult.searchOk && testResult.chatOk ? (
                            <span className="text-green-500 font-bold">✓ Connection Successful</span>
                          ) : (
                            <span className="text-yellow-500 font-bold">⚠ Partial Success</span>
                          )}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={testResult.searchOk ? "text-green-500" : "text-red-500"}>
                              {testResult.searchOk ? "✓" : "✗"}
                            </span>
                            <span className={themeClasses.labelText}>
                              Search: {testResult.searchOk ? "OK" : "Failed"}
                              {testResult.searchOk && ` (${testResult.searchResultsCount} results)`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={testResult.chatOk ? "text-green-500" : "text-red-500"}>
                              {testResult.chatOk ? "✓" : "✗"}
                            </span>
                            <span className={themeClasses.labelText}>
                              Chat: {testResult.chatOk ? "OK" : "Failed"}
                              {testResult.chatOk && testResult.sourcesCount > 0 && ` (${testResult.sourcesCount} sources)`}
                            </span>
                          </div>
                          <div className={`mt-2 pt-2 border-t ${
                            isDark ? "border-slate-700" : "border-slate-200"
                          }`}>
                            <span className={`text-xs ${themeClasses.mutedText}`}>
                              Workspace: {testResult.workspaceSlug}
                            </span>
                          </div>
                          {testResult.chatAnswerPreview && (
                            <div className={`mt-2 pt-2 border-t ${
                              isDark ? "border-slate-700" : "border-slate-200"
                            }`}>
                              <p className={`text-xs font-medium mb-1 ${themeClasses.labelText}`}>
                                Chat Response Preview:
                              </p>
                              <p className={`text-xs ${themeClasses.mutedText}`}>
                                {testResult.chatAnswerPreview}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </OBDPanel>
          )}

          {/* Production Readiness Check (Admin Only) */}
          {!adminCheckLoading && isAdmin && (
            <OBDPanel isDark={isDark} className="mt-6">
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Production Readiness Check
              </OBDHeading>
              
              {prodReadinessLoading && (
                <p className={`text-sm ${themeClasses.mutedText}`}>Checking...</p>
              )}

              {prodReadinessError && (
                <div className={getErrorPanelClasses(isDark)}>
                  <p className="text-sm">{prodReadinessError}</p>
                  <button
                    type="button"
                    onClick={loadProductionReadiness}
                    className={`mt-3 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Retry
                  </button>
                </div>
              )}

              {prodReadiness && (
                <div className="space-y-4">
                  {/* Summary Status */}
                  <div className={`p-4 rounded-lg border ${
                    prodReadiness.summary.ready
                      ? isDark
                        ? "bg-green-900/20 border-green-700"
                        : "bg-green-50 border-green-200"
                      : isDark
                        ? "bg-red-900/20 border-red-700"
                        : "bg-red-50 border-red-200"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {prodReadiness.summary.ready ? (
                        <>
                          <span className="text-green-500 font-bold text-lg">✓</span>
                          <span className={`font-semibold ${prodReadiness.summary.ready ? "text-green-500" : "text-red-500"}`}>
                            Production Ready
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-red-500 font-bold text-lg">✗</span>
                          <span className={`font-semibold text-red-500`}>
                            Not Production Ready
                          </span>
                        </>
                      )}
                    </div>
                    {prodReadiness.summary.blockingIssues.length > 0 && (
                      <div className="mt-3">
                        <p className={`text-sm font-medium mb-2 ${isDark ? "text-red-400" : "text-red-800"}`}>
                          Blocking Issues:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {prodReadiness.summary.blockingIssues.map((issue, idx) => (
                            <li key={idx} className={`text-sm ${themeClasses.mutedText}`}>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prodReadiness.summary.warnings.length > 0 && (
                      <div className="mt-3">
                        <p className={`text-sm font-medium mb-2 ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
                          Warnings (Optional):
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {prodReadiness.summary.warnings.map((warning, idx) => (
                            <li key={idx} className={`text-sm ${themeClasses.mutedText}`}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Environment Variables */}
                  <div>
                    <OBDHeading level={3} isDark={isDark} className="mb-2 text-sm">
                      Environment Variables
                    </OBDHeading>
                    <div className="space-y-2">
                      {Object.entries(prodReadiness.env).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className={themeClasses.labelText}>{key}:</span>
                          <span className={
                            value === "present"
                              ? "text-green-500"
                              : value === "missing"
                                ? "text-yellow-500"
                                : "text-slate-500"
                          }>
                            {value === "present" ? "✓ Present" : value === "missing" ? "✗ Missing" : "Not Required"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Database Tables */}
                  <div>
                    <OBDHeading level={3} isDark={isDark} className="mb-2 text-sm">
                      Database Tables
                    </OBDHeading>
                    <div className="space-y-2">
                      {Object.entries(prodReadiness.database).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className={themeClasses.labelText}>{key}:</span>
                          <span className={value === "exists" ? "text-green-500" : "text-red-500"}>
                            {value === "exists" ? "✓ Exists" : "✗ Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={loadProductionReadiness}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Refresh Check
                  </button>
                </div>
              )}
            </OBDPanel>
          )}

          {/* Navigation */}
          {status.db.hasAiWorkspaceMap && (
            <OBDPanel isDark={isDark}>
              <div className="flex items-center justify-between">
                <div>
                  <OBDHeading level={2} isDark={isDark} className="mb-2">
                    Ready to Use
                  </OBDHeading>
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    Your AI Help Desk is configured and ready to use.
                  </p>
                </div>
                <Link
                  href="/apps/ai-help-desk"
                  className={SUBMIT_BUTTON_CLASSES + " whitespace-nowrap"}
                >
                  Go to Help Desk →
                </Link>
              </div>
            </OBDPanel>
          )}
        </div>
      )}
    </OBDPageContainer>
  );
}

