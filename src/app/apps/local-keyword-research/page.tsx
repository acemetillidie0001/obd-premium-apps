"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import { LocalKeywordLegend } from "@/components/obd/LocalKeywordLegend";
import type {
  LocalKeywordRequest,
  LocalKeywordResponse,
  LocalKeywordIdea,
  LocalKeywordCluster,
  RankCheckResult,
  RankHistoryItem,
} from "@/app/api/local-keyword-research/types";

const defaultFormValues: LocalKeywordRequest = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  websiteUrl: undefined,
  primaryGoal: "SEO",
  radiusMiles: 15,
  includeNearMeVariants: true,
  includeZipCodes: true,
  includeNeighborhoods: true,
  maxKeywords: 60,
  personalityStyle: "None",
  brandVoice: "",
  language: "English",
  includeBlogIdeas: true,
  includeFaqIdeas: true,
  includeGmbPostIdeas: true,
};

export default function LocalKeywordResearchPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<LocalKeywordRequest>(defaultFormValues);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LocalKeywordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // Rank check state
  const [rankKeyword, setRankKeyword] = useState("");
  const [rankTargetUrl, setRankTargetUrl] = useState("");
  const [rankIsLoading, setRankIsLoading] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);
  const [rankResult, setRankResult] = useState<RankCheckResult | null>(null);

  // TODO: Once a database is added, populate rankHistory from the backend:
  // - On page load, fetch recent rank history for this business.
  // - After each successful rank check, POST the result to a "rank-history" endpoint
  //   and update this state with the new entry.
  const [rankHistory, setRankHistory] = useState<RankHistoryItem[] | null>(null);

  // Update rankTargetUrl when form.websiteUrl changes (if not already set)
  useEffect(() => {
    if (form.websiteUrl && !rankTargetUrl) {
      setRankTargetUrl(form.websiteUrl);
    }
  }, [form.websiteUrl]); // Removed rankTargetUrl from deps to avoid unnecessary re-runs

  const updateFormValue = <K extends keyof LocalKeywordRequest>(
    key: K,
    value: LocalKeywordRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setResult(null);

    if (!form.businessType.trim()) {
      setError(
        "Please enter your business type (e.g., Massage Spa, Plumber, Restaurant)."
      );
      setIsLoading(false);
      return;
    }

    if (!form.services.trim()) {
      setError("Please list at least one service or specialty.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/local-keyword-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ||
            "There was a problem generating keyword ideas. Please try again."
        );
      }

      const data: LocalKeywordResponse = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedKeyword(id);
        setTimeout(() => setCopiedKeyword(null), 1500);
      }
    } catch {
      // ignore copy errors
    }
  };

  const renderKeywordTable = (keywords: LocalKeywordIdea[]) => {
    if (!keywords?.length) return null;

    // Detect if metrics are present
    const hasVolume = keywords.some(
      (k) => typeof k.monthlySearchesExact === "number"
    );
    const hasCpc = keywords.some((k) => typeof k.cpcUsd === "number");

    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <OBDHeading level={2} isDark={isDark}>
            Top Priority Keywords
          </OBDHeading>
          <button
            type="button"
            onClick={() =>
              handleCopyText(
                keywords
                  .map(
                    (k) =>
                      `${k.keyword} — ${k.intent} — ${k.suggestedPageType} — ${k.difficultyLabel} — Score: ${k.opportunityScore}${hasVolume && typeof k.monthlySearchesExact === "number" ? ` — Volume: ${k.monthlySearchesExact}` : ""}${hasCpc && typeof k.cpcUsd === "number" ? ` — CPC: $${k.cpcUsd.toFixed(2)}` : ""}`
                  )
                  .join("\n")
              )
            }
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Copy All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs md:text-sm">
            <thead className={`border-b text-[11px] uppercase tracking-wide ${themeClasses.mutedText} md:text-xs`}>
              <tr>
                <th className="py-2 pr-4">Keyword</th>
                <th className="py-2 pr-4">Intent</th>
                <th className="py-2 pr-4">Suggested Use</th>
                <th className="py-2 pr-4">Difficulty</th>
                <th className="py-2 pr-4">Opportunity</th>
                {hasVolume && <th className="py-2 pr-4">Est. Volume</th>}
                {hasCpc && <th className="py-2 pr-4">Est. CPC</th>}
                <th className="py-2 pr-0 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k) => (
                <tr key={k.keyword} className={`border-b ${isDark ? "border-slate-700" : "border-slate-200"} last:border-0`}>
                  <td className={`py-2 pr-4 font-medium ${themeClasses.headingText}`}>{k.keyword}</td>
                  <td className={`py-2 pr-4 ${themeClasses.labelText}`}>{k.intent}</td>
                  <td className={`py-2 pr-4 ${themeClasses.labelText}`}>{k.suggestedPageType}</td>
                  <td
                    className={`py-2 pr-4 font-semibold ${
                      k.difficultyLabel === "Easy"
                        ? "text-emerald-600"
                        : k.difficultyLabel === "Medium"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {k.difficultyLabel}
                  </td>
                  <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                    {Math.max(1, Math.min(100, k.opportunityScore || 50))}
                  </td>
                  {hasVolume && (
                    <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                      {typeof k.monthlySearchesExact === "number"
                        ? k.monthlySearchesExact.toLocaleString()
                        : "—"}
                    </td>
                  )}
                  {hasCpc && (
                    <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                      {typeof k.cpcUsd === "number" ? `$${k.cpcUsd.toFixed(2)}` : "—"}
                    </td>
                  )}
                  <td className="py-2 pr-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRankKeyword(k.keyword)}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        title="Use this keyword for rank check"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(k.keyword, k.keyword)}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {copiedKeyword === k.keyword ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OBDPanel>
    );
  };

  const renderClusterCards = (clusters: LocalKeywordCluster[]) => {
    if (!clusters?.length) return null;

    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <OBDHeading level={2} isDark={isDark} className="mb-4">
          Keyword Clusters
        </OBDHeading>
        <div className="grid gap-4 md:grid-cols-2">
          {clusters.map((cluster) => (
            <div
              key={cluster.name}
              className={`flex flex-col rounded-xl border p-4 md:p-6 ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="mb-3">
                <h3 className={`text-base font-semibold md:text-lg ${themeClasses.headingText}`}>
                  {cluster.name}
                </h3>
                <p className={`mt-1 text-xs md:text-sm ${themeClasses.mutedText}`}>
                  {cluster.description}
                </p>
                <p className="mt-1 text-xs font-medium text-[#29c4a9] md:text-sm">
                  Recommended use: {cluster.recommendedUse}
                </p>
              </div>
              <div className="flex-1 space-y-2">
                {cluster.keywords && cluster.keywords.length > 0 ? (
                  cluster.keywords.map((k) => (
                  <button
                    key={k.keyword}
                    type="button"
                    onClick={() => handleCopyText(k.keyword, k.keyword)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs hover:border-[#29c4a9] transition-colors md:text-sm ${
                      isDark
                        ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                        : "bg-white border-slate-200 hover:bg-teal-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium ${themeClasses.headingText}`}>{k.keyword}</span>
                      <span className={`text-[11px] ${themeClasses.mutedText}`}>
                        {k.intent} · {k.difficultyLabel}
                      </span>
                    </div>
                    {k.notes && (
                      <p className={`mt-1 text-[11px] ${themeClasses.mutedText}`}>
                        {k.notes}
                      </p>
                    )}
                  </button>
                  ))
                ) : (
                  <p className={`text-xs italic ${themeClasses.mutedText}`}>
                    No keywords in this cluster.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </OBDPanel>
    );
  };

  const renderIdeaList = (title: string, items?: string[]) => {
    if (!items || !items.length) return null;
    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <OBDHeading level={2} isDark={isDark}>
            {title}
          </OBDHeading>
          <button
            type="button"
            onClick={() => handleCopyText(items.join("\n"))}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Copy All
          </button>
        </div>
        <ul className={`list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.labelText}`}>
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </OBDPanel>
    );
  };

  const renderFaqIdeas = (
    title: string,
    items?: { question: string; answer: string }[]
  ) => {
    if (!items || !items.length) return null;
    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <OBDHeading level={2} isDark={isDark}>
            {title}
          </OBDHeading>
          <button
            type="button"
            onClick={() =>
              handleCopyText(
                items
                  .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
                  .join("\n\n")
              )
            }
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Copy All
          </button>
        </div>
        <div className={`space-y-3 text-xs md:text-sm ${themeClasses.labelText}`}>
          {items.map((item, idx) => (
            <div key={idx}>
              <p className={`font-semibold ${themeClasses.headingText}`}>Q: {item.question}</p>
              <p className={themeClasses.mutedText}>A: {item.answer}</p>
            </div>
          ))}
        </div>
      </OBDPanel>
    );
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Local Keyword Research Tool"
      tagline="Discover exactly what local customers are searching for in Ocala and surrounding areas."
    >
      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <OBDHeading level={2} isDark={isDark}>
              Step 1 — Tell us about your business
            </OBDHeading>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              We'll use these details to generate local keyword ideas that actually match what you do in Ocala.
            </p>

            {/* Business basics */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Business Name
                </label>
                <input
                  type="text"
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) =>
                    updateFormValue("businessName", e.target.value)
                  }
                  className={getInputClasses(isDark)}
                  placeholder="Example: Sunshine Massage & Wellness"
                />
              </div>
              <div>
                <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Business Type *
                </label>
                <input
                  type="text"
                  id="businessType"
                  value={form.businessType}
                  onChange={(e) =>
                    updateFormValue("businessType", e.target.value)
                  }
                  className={getInputClasses(isDark)}
                  placeholder="Example: Massage spa, plumber, dentist"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Services & specialties *
              </label>
              <textarea
                id="services"
                value={form.services}
                onChange={(e) =>
                  updateFormValue("services", e.target.value)
                }
                className={getInputClasses(isDark, "resize-none")}
                placeholder="List your main services, separated by commas or lines (e.g. deep tissue massage, hot stone massage, couples massage, prenatal massage)"
                rows={3}
                required
              />
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  value={form.city}
                  onChange={(e) => updateFormValue("city", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Ocala"
                />
              </div>
              <div>
                <label htmlFor="state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  value={form.state}
                  onChange={(e) => updateFormValue("state", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Florida"
                />
              </div>
              <div>
                <label htmlFor="radiusMiles" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Target Radius (miles)
                </label>
                <input
                  type="number"
                  id="radiusMiles"
                  min={1}
                  max={60}
                  value={form.radiusMiles}
                  onChange={(e) =>
                    updateFormValue(
                      "radiusMiles",
                      Number(e.target.value || 0)
                    )
                  }
                  className={getInputClasses(isDark)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="websiteUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Website URL (optional)
              </label>
              <input
                type="url"
                id="websiteUrl"
                value={form.websiteUrl}
                onChange={(e) =>
                  updateFormValue("websiteUrl", e.target.value)
                }
                  className={getInputClasses(isDark)}
                  placeholder="https://example.com"
                  aria-label="Website URL (optional)"
                />
            </div>

            {/* Local targeting options */}
            <div className={`rounded-2xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50/50 border-slate-200"}`}>
              <p className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Local targeting options</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-medium ${themeClasses.labelText}`}>Include "near me"</p>
                    <p className={`text-[11px] ${themeClasses.mutedText}`}>
                      e.g. "massage near me"
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.includeNearMeVariants}
                    onChange={(e) =>
                      updateFormValue("includeNearMeVariants", e.target.checked)
                    }
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    aria-label="Include near me variants"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-medium ${themeClasses.labelText}`}>Include ZIP codes</p>
                    <p className={`text-[11px] ${themeClasses.mutedText}`}>
                      e.g. 34470, 34471, 34474
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.includeZipCodes}
                    onChange={(e) =>
                      updateFormValue("includeZipCodes", e.target.checked)
                    }
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    aria-label="Include near me variants"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                      Include neighborhoods
                    </p>
                    <p className={`text-[11px] ${themeClasses.mutedText}`}>
                      e.g. "near Downtown Ocala"
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.includeNeighborhoods}
                    onChange={(e) =>
                      updateFormValue("includeNeighborhoods", e.target.checked)
                    }
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    aria-label="Include near me variants"
                  />
                </div>
              </div>
            </div>

            {/* Strategy & output */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="primaryGoal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Primary goal
                </label>
                <select
                  id="primaryGoal"
                  value={form.primaryGoal}
                  onChange={(e) =>
                    updateFormValue(
                      "primaryGoal",
                      e.target.value as LocalKeywordRequest["primaryGoal"]
                    )
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="SEO">SEO ranking</option>
                  <option value="Content">Content & blog ideas</option>
                  <option value="Ads">Google Ads targeting</option>
                  <option value="Mixed">Mix of all three</option>
                </select>
              </div>
              <div>
                <label htmlFor="maxKeywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Max keywords
                </label>
                <input
                  type="number"
                  id="maxKeywords"
                  min={20}
                  max={150}
                  value={form.maxKeywords}
                  onChange={(e) =>
                    updateFormValue(
                      "maxKeywords",
                      Number(e.target.value || 0)
                    )
                  }
                  className={getInputClasses(isDark)}
                />
                <p className={`text-[11px] mt-1 ${themeClasses.mutedText}`}>
                  40–80 is a sweet spot for most local businesses.
                </p>
              </div>
              <div>
                <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Language
                </label>
                <select
                  id="language"
                  value={form.language}
                  onChange={(e) =>
                    updateFormValue(
                      "language",
                      e.target.value as LocalKeywordRequest["language"]
                    )
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Bilingual">Bilingual</option>
                </select>
              </div>
            </div>

            {/* Personality / brand voice */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Personality style
                </label>
                <select
                  id="personalityStyle"
                  value={form.personalityStyle}
                  onChange={(e) =>
                    updateFormValue(
                      "personalityStyle",
                      e.target.value as LocalKeywordRequest["personalityStyle"]
                    )
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="None">None / neutral</option>
                  <option value="Soft">Soft & friendly</option>
                  <option value="Bold">Bold & confident</option>
                  <option value="High-Energy">High-energy & upbeat</option>
                  <option value="Luxury">Luxury & premium</option>
                </select>
              </div>
              <div>
                <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Brand voice (optional)
                </label>
                <textarea
                  id="brandVoice"
                  value={form.brandVoice}
                  onChange={(e) =>
                    updateFormValue("brandVoice", e.target.value)
                  }
                  className={getInputClasses(isDark, "resize-none")}
                  rows={3}
                  placeholder="Describe your brand voice in 1–3 sentences. Example: Warm, welcoming, and community-focused with a touch of Ocala charm."
                />
              </div>
            </div>

            {/* Extra idea outputs */}
            <div className={`rounded-2xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50/50 border-slate-200"}`}>
              <p className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Extra strategy ideas you'd like
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                      Blog & article ideas
                    </p>
                    <p className={`text-[11px] ${themeClasses.mutedText}`}>
                      Based on your best keyword clusters.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.includeBlogIdeas}
                    onChange={(e) =>
                      updateFormValue("includeBlogIdeas", e.target.checked)
                    }
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    aria-label="Include near me variants"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-medium ${themeClasses.labelText}`}>FAQ ideas</p>
                    <p className={`text-[11px] ${themeClasses.mutedText}`}>
                      Great for service pages and OBD listing.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.includeFaqIdeas}
                    onChange={(e) =>
                      updateFormValue("includeFaqIdeas", e.target.checked)
                    }
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    aria-label="Include near me variants"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                      Google Business post ideas
                    </p>
                    <p className={`text-[11px] ${themeClasses.mutedText}`}>
                      Quick posts you can publish this week.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.includeGmbPostIdeas}
                    onChange={(e) =>
                      updateFormValue("includeGmbPostIdeas", e.target.checked)
                    }
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    aria-label="Include near me variants"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className={getErrorPanelClasses(isDark)}>
                <p className="font-medium mb-2">Error:</p>
                <p>{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-4 md:flex-row md:items-center md:justify-between">
              <p className={`text-[11px] ${themeClasses.mutedText}`}>
                Tip: The more detail you include about your services, the
                smarter the keyword suggestions will be.
              </p>
              <button type="submit" disabled={isLoading} className={SUBMIT_BUTTON_CLASSES}>
                {isLoading
                  ? "Analyzing local searches..."
                  : "Generate local keyword strategy"}
              </button>
            </div>
          </div>
        </form>
      </OBDPanel>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <OBDPanel isDark={isDark} className="mt-8">
            <OBDHeading level={2} isDark={isDark}>
              Step 2 — Your local keyword strategy
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.labelText}`}>
              {result.summary || "Your keyword strategy has been generated."}
            </p>
            {result.overviewNotes && result.overviewNotes.length > 0 && (
              <ul className={`mt-3 list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.mutedText}`}>
                {result.overviewNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            )}
          </OBDPanel>

          {/* Legend */}
          <LocalKeywordLegend isDark={isDark} />

          {renderKeywordTable(result.topPriorityKeywords)}
          {renderClusterCards(result.keywordClusters)}

          <div className="grid gap-4 md:grid-cols-2">
            {renderIdeaList("Blog & content ideas", result.blogIdeas)}
            {renderFaqIdeas(
              "FAQ ideas for your site & OBD listing",
              result.faqIdeas
            )}
          </div>

          {renderIdeaList(
            "Google Business Profile post ideas",
            result.gmbPostIdeas
          )}

          {/* Rank Check Panel */}
          <OBDPanel isDark={isDark} className="mt-8">
            <OBDHeading level={2} isDark={isDark}>
              Check Your Current Google Ranking
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
              See where your business appears today for a specific keyword in Google's organic search results.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setRankError(null);
                setRankIsLoading(true);
                setRankResult(null);

                if (!rankKeyword.trim()) {
                  setRankError("Keyword is required.");
                  setRankIsLoading(false);
                  return;
                }

                if (!rankTargetUrl.trim()) {
                  setRankError("Please enter the URL you want to check.");
                  setRankIsLoading(false);
                  return;
                }

                try {
                  const res = await fetch("/api/local-keyword-research/rank-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      keyword: rankKeyword.trim(),
                      targetUrl: rankTargetUrl.trim(),
                      city: form.city,
                      state: form.state,
                    }),
                  });

                  if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(
                      data?.error ||
                        "We couldn't retrieve rank data at this time. Please try again shortly."
                    );
                  }

                  const data = await res.json();
                  setRankResult(data.result);
                } catch (err) {
                  console.error(err);
                  setRankError(
                    err instanceof Error
                      ? err.message
                      : "We couldn't retrieve rank data at this time. Please try again shortly."
                  );
                } finally {
                  setRankIsLoading(false);
                }
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="rankKeyword" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Keyword to check
                  </label>
                  <input
                    type="text"
                    id="rankKeyword"
                    value={rankKeyword || ""}
                    onChange={(e) => setRankKeyword(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder='e.g., "massage therapy Ocala"'
                    required
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Choose a keyword you're actively targeting or testing.
                  </p>
                </div>
                <div>
                  <label htmlFor="rankTargetUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Website or OBD listing URL
                  </label>
                  <input
                    type="url"
                    id="rankTargetUrl"
                    value={rankTargetUrl || ""}
                    onChange={(e) => setRankTargetUrl(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder={form.websiteUrl || "https://yourbusiness.com"}
                    required
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    This is the page we'll try to locate in the Google results.
                  </p>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Search location
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    id="rankCity"
                    value={form.city}
                    readOnly
                    className={getInputClasses(isDark, "bg-slate-100 dark:bg-slate-800 cursor-not-allowed")}
                  />
                  <input
                    type="text"
                    id="rankState"
                    value={form.state}
                    readOnly
                    className={getInputClasses(isDark, "bg-slate-100 dark:bg-slate-800 cursor-not-allowed")}
                  />
                </div>
                <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                  Used to simulate local search results. Defaults to your business location.
                </p>
              </div>

              {rankError && (
                <div className={getErrorPanelClasses(isDark)}>
                  <p className="font-medium mb-2">Error:</p>
                  <p>{rankError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={rankIsLoading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {rankIsLoading ? "Checking Google results…" : "Run Rank Check"}
              </button>
            </form>

            {/* Empty state */}
            {!rankResult && !rankError && (
              <p className={`mt-4 text-xs ${themeClasses.mutedText}`}>
                No rank data yet. Enter a keyword above to run your first check.
              </p>
            )}

            {/* Rank Check Results */}
            {rankResult && (
              <div className={`mt-6 rounded-xl border p-4 md:p-6 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
                  Your Ranking Results
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className={`text-sm font-medium ${themeClasses.labelText}`}>
                      Organic position:
                    </p>
                    {rankResult.currentPositionOrganic !== null ? (
                      <>
                        <p className={`text-lg font-bold ${themeClasses.headingText}`}>
                          #{rankResult.currentPositionOrganic}
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          {rankResult.currentPositionOrganic !== undefined && rankResult.currentPositionOrganic <= 10
                            ? "Appears on page 1."
                            : rankResult.currentPositionOrganic !== undefined && rankResult.currentPositionOrganic <= 20
                            ? "Appears on page 2."
                            : rankResult.currentPositionOrganic !== undefined && rankResult.currentPositionOrganic <= 30
                            ? "Appears on page 3."
                            : rankResult.currentPositionOrganic !== undefined
                            ? "Appears on page 4+."
                            : "Position not available."}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={`text-lg font-bold ${themeClasses.headingText}`}>
                          Not found in top 100
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          Your website did not appear in the top 100 organic results. This is common for newer sites or more competitive keywords.
                        </p>
                      </>
                    )}
                  </div>

                  {rankResult.serpSampleUrls && rankResult.serpSampleUrls.length > 0 && (
                    <div>
                      <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Top results for this search:
                      </p>
                      <ol className={`list-decimal list-inside space-y-1 text-xs md:text-sm ${themeClasses.labelText}`}>
                        {rankResult.serpSampleUrls.slice(0, 10).map((url, idx) => (
                          <li key={idx} className="break-all">
                            {url === rankResult.targetUrl ? (
                              <span className="font-semibold text-[#29c4a9]">{url}</span>
                            ) : (
                              url
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className={`pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                      Data source: {rankResult.dataSource ?? "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </OBDPanel>

          {/* Future: wire this table to real rank history stored in the database. */}
          {/* Saved Rank History Panel */}
          <OBDPanel isDark={isDark} className="mt-8">
            <OBDHeading level={2} isDark={isDark}>
              Saved Rank History
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
              Track how your search visibility changes over time for your most important keywords.
            </p>

            {rankHistory === null || rankHistory.length === 0 ? (
              <p className={`mt-4 text-xs ${themeClasses.mutedText}`}>
                Rank history will appear here once tracking is connected. For now, you can run single checks above to see your current position.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs md:text-sm">
                  <thead className={`border-b text-[11px] uppercase tracking-wide ${themeClasses.mutedText} md:text-xs`}>
                    <tr>
                      <th className="py-2 pr-4">Keyword</th>
                      <th className="py-2 pr-4">Position</th>
                      <th className="py-2 pr-4">Checked</th>
                      <th className="py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankHistory.map((item) => (
                      <tr key={item.id} className={`border-b ${isDark ? "border-slate-700 hover:bg-slate-800/50" : "border-slate-200 hover:bg-slate-50"} last:border-0`}>
                        <td className={`py-2 pr-4 font-medium ${themeClasses.headingText}`}>{item.keyword}</td>
                        <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                          {item.positionOrganic != null
                            ? `#${item.positionOrganic}`
                            : "Not found"}
                        </td>
                        <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                          {new Date(item.checkedAt).toLocaleString()}
                        </td>
                        <td className={`py-2 pr-4 text-xs ${themeClasses.mutedText}`}>
                          {item.dataSource ?? "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OBDPanel>
        </div>
      )}
    </OBDPageContainer>
  );
}

