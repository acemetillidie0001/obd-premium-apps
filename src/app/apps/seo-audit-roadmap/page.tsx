"use client";

import { useState } from "react";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import ResultCard from "@/components/obd/ResultCard";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import {
  SEOAuditRoadmapRequest,
  SEOAuditRoadmapResponse,
} from "./types";

const defaultFormValues: SEOAuditRoadmapRequest = {
  pageUrl: "",
  pageContent: "",
  primaryService: "",
  city: "Ocala",
  state: "Florida",
  businessType: "",
  targetAudience: "Both",
};

export default function SEOAuditRoadmapPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [formValues, setFormValues] = useState<SEOAuditRoadmapRequest>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SEOAuditRoadmapResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<SEOAuditRoadmapRequest | null>(null);

  const updateFormValue = <K extends keyof SEOAuditRoadmapRequest>(
    key: K,
    value: SEOAuditRoadmapRequest[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Clear field error when user types
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const processRequest = async (payload: SEOAuditRoadmapRequest) => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setResult(null);

    try {
      // Validate that at least one source is provided
      const hasUrl = !!payload.pageUrl?.trim();
      const hasContent = !!payload.pageContent?.trim();
      
      if (!hasUrl && !hasContent) {
        setError("Please provide either a page URL or page content.");
        return;
      }

      if (!payload.primaryService?.trim()) {
        setError("Primary service is required.");
        return;
      }

      // If both provided, prefer URL
      let apiPayload: SEOAuditRoadmapRequest;
      if (hasUrl && hasContent) {
        apiPayload = {
          pageUrl: payload.pageUrl!.trim(),
          pageContent: undefined,
          primaryService: payload.primaryService.trim(),
          city: payload.city?.trim() || "Ocala",
          state: payload.state?.trim() || "Florida",
          businessType: payload.businessType?.trim() || undefined,
          targetAudience: payload.targetAudience || undefined,
        };
      } else {
        apiPayload = {
          pageUrl: payload.pageUrl?.trim() || undefined,
          pageContent: payload.pageContent?.trim() || undefined,
          primaryService: payload.primaryService.trim(),
          city: payload.city?.trim() || "Ocala",
          state: payload.state?.trim() || "Florida",
          businessType: payload.businessType?.trim() || undefined,
          targetAudience: payload.targetAudience || undefined,
        };
      }

      const res = await fetch("/api/seo-audit-roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        if (responseData.error?.fieldErrors) {
          setFieldErrors(responseData.error.fieldErrors);
        }
        throw new Error(responseData.error?.message || `Server error: ${res.status}`);
      }

      if (responseData.ok && responseData.data) {
        setResult(responseData.data);
        setLastPayload(apiPayload);
      } else if (responseData.ok === false && responseData.error) {
        throw new Error(responseData.error.message || "An error occurred");
      } else {
        setResult(responseData);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while running the SEO audit. Please try again."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processRequest(formValues);
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    await processRequest(lastPayload);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return isDark ? "text-green-400" : "text-green-600";
    if (score >= 60) return isDark ? "text-yellow-400" : "text-yellow-600";
    return isDark ? "text-red-400" : "text-red-600";
  };

  const getBandColor = (band: string) => {
    const lower = band.toLowerCase();
    if (lower.includes("excellent") || lower.includes("strong")) {
      return isDark ? "bg-green-900/30 border-green-700" : "bg-green-50 border-green-200";
    }
    if (lower.includes("needs") || lower.includes("improvement")) {
      return isDark ? "bg-yellow-900/30 border-yellow-700" : "bg-yellow-50 border-yellow-200";
    }
    return isDark ? "bg-red-900/30 border-red-700" : "bg-red-50 border-red-200";
  };

  const getStatusBadge = (status: string) => {
    if (status === "pass") return isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-700";
    if (status === "needs-improvement") return isDark ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-700";
    return isDark ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-700";
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="SEO Audit & Roadmap"
      tagline="Audit a local page and get a prioritized SEO improvement plan."
    >
      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Audit Source Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Audit Source <span className="text-red-500">*</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="pageUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Page URL
                  </label>
                  <input
                    type="url"
                    id="pageUrl"
                    value={formValues.pageUrl || ""}
                    onChange={(e) => updateFormValue("pageUrl", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com/service-page"
                    aria-describedby="pageUrl-help"
                  />
                  {fieldErrors.pageUrl && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.pageUrl[0]}
                    </p>
                  )}
                  <p id="pageUrl-help" className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Enter the full URL of the page to audit
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className={getDividerClass(isDark)}></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={`px-2 ${isDark ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500"}`}>
                      Or
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="pageContent" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Page Content
                  </label>
                  <textarea
                    id="pageContent"
                    value={formValues.pageContent || ""}
                    onChange={(e) => updateFormValue("pageContent", e.target.value)}
                    rows={8}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste the HTML content or text content of the page here..."
                    aria-describedby="pageContent-help"
                  />
                  {fieldErrors.pageContent && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.pageContent[0]}
                    </p>
                  )}
                  <p id="pageContent-help" className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Paste the HTML or text content directly
                  </p>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Context Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Context
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="primaryService" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Primary Service <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryService"
                    value={formValues.primaryService || ""}
                    onChange={(e) => updateFormValue("primaryService", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Plumbing, HVAC, Legal Services"
                    required
                  />
                  {fieldErrors.primaryService && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.primaryService[0]}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={formValues.city || ""}
                      onChange={(e) => updateFormValue("city", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Ocala"
                      required
                    />
                    {fieldErrors.city && (
                      <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                        {fieldErrors.city[0]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={formValues.state || ""}
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                      required
                    />
                    {fieldErrors.state && (
                      <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                        {fieldErrors.state[0]}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={formValues.businessType || ""}
                    onChange={(e) => updateFormValue("businessType", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Service Business, Retail, Restaurant"
                  />
                </div>

                <div>
                  <label htmlFor="targetAudience" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Target Audience
                  </label>
                  <select
                    id="targetAudience"
                    value={formValues.targetAudience || "Both"}
                    onChange={(e) => updateFormValue("targetAudience", e.target.value as "Residential" | "Commercial" | "Both")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {loading ? "Running Audit..." : "Run SEO Audit"}
              </button>
            </div>
          </div>
        </form>
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-6">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Results section */}
      {result && (
        <OBDPanel isDark={isDark} className="mt-8" id="seo-audit-results">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              SEO Audit Results
            </OBDHeading>
            {result && (
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {loading ? "Re-running..." : "Re-run Audit"}
              </button>
            )}
          </div>

          {/* Single-page audit clarification */}
          <div className={`mt-4 p-3 rounded-lg border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-blue-50 border-blue-200"}`}>
            <p className={`text-xs ${isDark ? "text-slate-300" : "text-blue-700"}`}>
              <span className="font-medium">Note:</span> This audit analyzes a single page only. For a complete site-wide SEO assessment, audit multiple pages individually.
            </p>
          </div>

          {/* Overall Score */}
          <ResultCard
            title="Overall SEO Score"
            isDark={isDark}
            copyText={`SEO Score: ${result.score}/100 (${result.band})\n${result.summary}`}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
                  {result.score}
                </div>
                <div className="flex-1">
                  <div className={`px-4 py-2 rounded-lg border ${getBandColor(result.band)}`}>
                    <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {result.band}
                    </p>
                  </div>
                </div>
              </div>
              <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {result.summary}
              </p>
              {result.auditedUrl && (
                <p className={`text-xs ${themeClasses.mutedText}`}>
                  Audited: <a href={result.auditedUrl} target="_blank" rel="noopener noreferrer" className="underline">{result.auditedUrl}</a>
                </p>
              )}
              <div className={`text-xs ${themeClasses.mutedText}`}>
                Request ID: {result.meta.requestId} · Audited: {new Date(result.meta.auditedAtISO).toLocaleString()}
              </div>
            </div>
          </ResultCard>

          {/* Category Results */}
          {result.categoryResults.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className={`text-base font-semibold mb-3 ${themeClasses.headingText}`}>
                Category Breakdown
              </h3>
              {result.categoryResults.map((category) => (
                <ResultCard
                  key={category.key}
                  title={`${category.label} (${category.pointsEarned}/${category.pointsMax})`}
                  isDark={isDark}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(category.status)}`}>
                        {category.status === "pass" ? "✓ Pass" : category.status === "needs-improvement" ? "⚠ Needs Improvement" : "✗ Missing"}
                      </span>
                    </div>
                    <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      {category.shortExplanation}
                    </p>
                    <div className={`text-sm ${themeClasses.mutedText}`}>
                      <span className="font-medium">Fix:</span> {category.fixRecommendation}
                    </div>
                  </div>
                </ResultCard>
              ))}
            </div>
          )}

          {/* Roadmap */}
          {result.roadmap.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className={`text-base font-semibold mb-3 ${themeClasses.headingText}`}>
                Prioritized Roadmap
              </h3>
              {["HIGH", "MEDIUM", "OPTIONAL"].map((priority) => {
                const items = result.roadmap.filter((item) => item.priority === priority);
                if (items.length === 0) return null;

                const priorityColors = {
                  HIGH: isDark ? "border-red-700 bg-red-900/20" : "border-red-200 bg-red-50",
                  MEDIUM: isDark ? "border-yellow-700 bg-yellow-900/20" : "border-yellow-200 bg-yellow-50",
                  OPTIONAL: isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50",
                };

                const priorityLabels = {
                  HIGH: "High Priority",
                  MEDIUM: "Medium Priority",
                  OPTIONAL: "Optional",
                };

                return (
                  <div key={priority} className="space-y-3">
                    <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                      {priorityLabels[priority as keyof typeof priorityLabels]}
                    </h4>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-4 ${priorityColors[priority as keyof typeof priorityColors]}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className={`font-semibold text-sm mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                              {item.title}
                            </h5>
                            <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>
                              {item.pointsAvailable} points available
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.estimatedEffort === "Low"
                                ? isDark ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-700"
                                : item.estimatedEffort === "Medium"
                                ? isDark ? "bg-yellow-900/50 text-yellow-300" : "bg-yellow-100 text-yellow-700"
                                : isDark ? "bg-red-900/50 text-red-300" : "bg-red-100 text-red-700"
                            }`}>
                              {item.estimatedEffort} Effort
                            </span>
                          </div>
                        </div>
                        <p className={`text-sm mb-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          <span className="font-medium">Issue:</span> {item.whatIsWrong}
                        </p>
                        <p className={`text-sm mb-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          <span className="font-medium">Why it matters:</span> {item.whyItMatters}
                        </p>
                        {item.nextSteps.length > 0 && (
                          <div className="mb-3">
                            <p className={`text-xs font-medium mb-2 ${themeClasses.mutedText}`}>Next Steps:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {item.nextSteps.map((step, idx) => (
                                <li key={idx} className={isDark ? "text-slate-300" : "text-slate-600"}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {item.relatedApp && (
                          <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
                            <Link
                              href={item.relatedApp.href}
                              className={`text-xs font-medium underline ${
                                isDark ? "text-[#29c4a9] hover:text-[#1EB9A7]" : "text-[#29c4a9] hover:text-[#1EB9A7]"
                              }`}
                            >
                              → Use {item.relatedApp.name} to help with this
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {result.roadmap.length === 0 && result.categoryResults.length === 0 && (
            <p className={`italic obd-soft-text text-center py-8 ${themeClasses.mutedText}`}>
              No audit results available.
            </p>
          )}
        </OBDPanel>
      )}

      {!result && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-8">
          <p className={`italic obd-soft-text text-center py-8 ${themeClasses.mutedText}`}>
            Fill out the form above and click &quot;Run SEO Audit&quot; to get started.
          </p>
        </OBDPanel>
      )}
    </OBDPageContainer>
  );
}
