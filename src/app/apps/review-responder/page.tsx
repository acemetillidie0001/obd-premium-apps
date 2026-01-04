"use client";

import { useState, useEffect, useRef } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getDividerClass } from "@/lib/obd-framework/layout-helpers";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";

export interface ReviewResponderFormValues {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  platform: "Google" | "OBD" | "Facebook" | "Other";
  reviewRating: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  customerName: string;
  responseGoal: string;
  brandVoice: string;
  personalityStyle: "None" | "Soft" | "Bold" | "High-Energy" | "Luxury";
  responseLength: "Short" | "Medium" | "Long";
  language: "English" | "Spanish" | "Bilingual";
  includeQnaBox: boolean;
  includeMetaDescription: boolean;
  includeStoryVersion: boolean;
}

export interface QnaBoxItem {
  question: string;
  answer: string;
}

export interface ReviewResponderResponse {
  standardReply: string;
  shortReply: string;
  socialSnippet: string;
  whyChooseSection: string;
  qnaBox?: QnaBoxItem[];
  metaDescription?: string;
  storytellingVersion?: string;
}

const DEFAULT_FORM: ReviewResponderFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  platform: "Google",
  reviewRating: 5,
  reviewText: "",
  customerName: "",
  responseGoal: "",
  brandVoice: "",
  personalityStyle: "None",
  responseLength: "Medium",
  language: "English",
  includeQnaBox: true,
  includeMetaDescription: true,
  includeStoryVersion: true,
};

interface ResultCardProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}

function ResultCard({ title, children, isDark }: ResultCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${
      isDark
        ? "bg-slate-800/50 border-slate-700"
        : "bg-slate-50 border-slate-200"
    }`}>
      <h3 className={`mb-3 text-sm font-semibold ${
        isDark ? "text-white" : "text-slate-900"
      }`}>
        {title}
      </h3>
      <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
        {children}
      </div>
    </div>
  );
}

export default function ReviewResponderPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [formValues, setFormValues] = useState<ReviewResponderFormValues>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResponderResponse | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Brand Profile auto-apply toggle
  const [useBrandProfile, setUseBrandProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return hasBrandProfile();
    } catch {
      return false;
    }
  });

  // Auto-apply brand profile to form
  const { applied, brandFound } = useAutoApplyBrandProfile({
    enabled: useBrandProfile,
    form: formValues as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        setFormValues((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as ReviewResponderFormValues);
      } else {
        setFormValues(formOrUpdater as unknown as ReviewResponderFormValues);
      }
    },
    storageKey: "review-responder-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "city") return "city";
      if (formKey === "state") return "state";
      if (formKey === "brandVoice") return "brandVoice";
      if (formKey === "language") return "language";
      return undefined;
    },
  });

  // Show one-time toast when brand profile is applied
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (applied && !toastShownRef.current) {
      toastShownRef.current = true;
      showToast("Brand Profile applied to empty fields.");
    }
  }, [applied]);

  // Handle personalityStyle mapping from brandPersonality (special case)
  // This runs after brand profile auto-apply to map brandPersonality to personalityStyle
  useEffect(() => {
    if (formValues.personalityStyle !== "None") return; // Don't overwrite if already set
    
    import("@/lib/brand/brandProfileStorage").then(({ loadBrandProfile }) => {
      const profile = loadBrandProfile();
      if (profile?.brandPersonality) {
        const personalityMap: Record<string, "Soft" | "Bold" | "High-Energy" | "Luxury"> = {
          "Soft": "Soft",
          "Bold": "Bold",
          "High-Energy": "High-Energy",
          "Luxury": "Luxury",
        };
        const mapped = personalityMap[profile.brandPersonality];
        if (mapped) {
          setFormValues((prev) => ({ ...prev, personalityStyle: mapped }));
        }
      }
    });
  }, [formValues.personalityStyle]);

  const updateFormValue = <K extends keyof ReviewResponderFormValues>(
    key: K,
    value: ReviewResponderFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const processRequest = async (values: ReviewResponderFormValues) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/review-responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: ReviewResponderResponse }
      const data = (jsonResponse.data || jsonResponse) as ReviewResponderResponse;
      setResult(data);
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.businessName.trim() || !formValues.businessType.trim() || !formValues.reviewText.trim()) {
      setError("Please fill in the business name, business type, and review text to continue.");
      return;
    }

    if (formValues.reviewRating < 1 || formValues.reviewRating > 5) {
      setError("Please select a review rating between 1 and 5 stars.");
      return;
    }

    await processRequest(formValues);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Review Responder"
      tagline="Generate polished, professional responses to customer reviews in seconds — tailored to your Ocala business."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
            {/* Business Info Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Business Info</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={formValues.businessName}
                    onChange={(e) => updateFormValue("businessName", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Example: Ocala Massage & Wellness"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={formValues.businessType}
                    onChange={(e) => updateFormValue("businessType", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Restaurant, salon, contractor, etc."
                    required
                  />
                </div>

                <div>
                  <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Services / Details (Optional)
                  </label>
                  <textarea
                    id="services"
                    value={formValues.services}
                    onChange={(e) => updateFormValue("services", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Mention key services so the AI can personalize your response."
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Mention key services so the AI can personalize your response.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={formValues.city}
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
                      value={formValues.state}
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Review Details Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Review Details</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Platform
                  </label>
                  <select
                    id="platform"
                    value={formValues.platform}
                    onChange={(e) => updateFormValue("platform", e.target.value as ReviewResponderFormValues["platform"])}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Google">Google</option>
                    <option value="OBD">OBD</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reviewRating" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Review Rating
                  </label>
                  <select
                    id="reviewRating"
                    value={formValues.reviewRating}
                    onChange={(e) => updateFormValue("reviewRating", parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                    className={getInputClasses(isDark)}
                  >
                    <option value={1}>1 (Very negative)</option>
                    <option value={2}>2 (Negative)</option>
                    <option value={3}>3 (Neutral)</option>
                    <option value={4}>4 (Positive)</option>
                    <option value={5}>5 (Very positive)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reviewText" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Customer Review Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reviewText"
                    value={formValues.reviewText}
                    onChange={(e) => updateFormValue("reviewText", e.target.value)}
                    rows={6}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste the full customer review here…"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customerName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="customerName"
                    value={formValues.customerName}
                    onChange={(e) => updateFormValue("customerName", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="If provided, the AI may address the reviewer by name"
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>If provided, the AI may address the reviewer by name.</p>
                </div>

                <div>
                  <label htmlFor="responseGoal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Response Goal (Optional)
                  </label>
                  <input
                    type="text"
                    id="responseGoal"
                    value={formValues.responseGoal}
                    onChange={(e) => updateFormValue("responseGoal", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Example: Thank the customer and invite them back; Recover trust after a bad experience"
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Voice & Language Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Voice & Language</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Brand Voice (Optional)
                  </label>
                  <textarea
                    id="brandVoice"
                    value={formValues.brandVoice}
                    onChange={(e) => {
                      updateFormValue("brandVoice", e.target.value);
                    }}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Example: Warm and family-friendly, professional and clinical, fun and high-energy"
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Example: Warm and family-friendly, professional and clinical, fun and high-energy</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Personality Style
                    </label>
                    <select
                      id="personalityStyle"
                      value={formValues.personalityStyle}
                      onChange={(e) => {
                        updateFormValue("personalityStyle", e.target.value as ReviewResponderFormValues["personalityStyle"]);
                      }}
                      className={getInputClasses(isDark)}
                    >
                      <option value="None">None</option>
                      <option value="Soft">Soft</option>
                      <option value="Bold">Bold</option>
                      <option value="High-Energy">High-Energy</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="responseLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Response Length
                    </label>
                    <select
                      id="responseLength"
                      value={formValues.responseLength}
                      onChange={(e) => updateFormValue("responseLength", e.target.value as ReviewResponderFormValues["responseLength"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                      <option value="Long">Long</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Language
                  </label>
                  <select
                    id="language"
                    value={formValues.language}
                    onChange={(e) => updateFormValue("language", e.target.value as ReviewResponderFormValues["language"])}
                    className={getInputClasses(isDark)}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Bilingual">Bilingual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Extra Output Sections */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Extra Output Sections</h3>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={formValues.includeQnaBox}
                    onChange={(e) => updateFormValue("includeQnaBox", e.target.checked)}
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                  />
                  <span className="text-sm">Include Q&A box suggestions</span>
                </label>

                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={formValues.includeMetaDescription}
                    onChange={(e) => updateFormValue("includeMetaDescription", e.target.checked)}
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                  />
                  <span className="text-sm">Include a meta description for SEO</span>
                </label>

                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={formValues.includeStoryVersion}
                    onChange={(e) => updateFormValue("includeStoryVersion", e.target.checked)}
                    className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                  />
                  <span className="text-sm">Include a storytelling version (longer narrative reply)</span>
                </label>
              </div>
            </div>

            {error && !isLoading && (
              <div className={getErrorPanelClasses(isDark)}>
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
          
          <OBDStickyActionBar isDark={isDark}>
            <button
              type="submit"
              disabled={isLoading || !formValues.businessName.trim() || !formValues.businessType.trim() || !formValues.reviewText.trim()}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Responses"
              )}
            </button>
          </OBDStickyActionBar>
        </form>
      </OBDPanel>

      {/* Results section */}
      {error && !result ? (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      ) : (
        <OBDResultsPanel
          title="Generated Responses"
          isDark={isDark}
          loading={isLoading}
          loadingText="Generating review responses..."
          emptyTitle="No responses yet"
          emptyDescription="Fill out the form above and click &quot;Generate Responses&quot; to create your review responses."
          className="mt-8"
        >
          {result ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultCard title="Standard Reply" isDark={isDark}>
              <div className="space-y-2">
                <p className="whitespace-pre-wrap">{result.standardReply}</p>
                <button
                  onClick={() => handleCopy(result.standardReply)}
                  className={`mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Copy
                </button>
              </div>
            </ResultCard>

            <ResultCard title="Short Reply" isDark={isDark}>
              <div className="space-y-2">
                <p className="whitespace-pre-wrap">{result.shortReply}</p>
                <button
                  onClick={() => handleCopy(result.shortReply)}
                  className={`mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Copy
                </button>
              </div>
            </ResultCard>

            <ResultCard title="Social Snippet" isDark={isDark}>
              <div className="space-y-2">
                <p className="whitespace-pre-wrap">{result.socialSnippet}</p>
                <button
                  onClick={() => handleCopy(result.socialSnippet)}
                  className={`mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Copy
                </button>
              </div>
            </ResultCard>

            <ResultCard title="Why Choose / Brand Expansion" isDark={isDark}>
              <div className="space-y-2">
                <p className="whitespace-pre-wrap">{result.whyChooseSection}</p>
                <button
                  onClick={() => handleCopy(result.whyChooseSection)}
                  className={`mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Copy
                </button>
              </div>
            </ResultCard>

            {result.qnaBox && result.qnaBox.length > 0 && (
              <ResultCard title="Q&A Box" isDark={isDark}>
                <div className="space-y-4">
                  {result.qnaBox.map((item, idx) => (
                    <div key={idx} className={idx > 0 ? `pt-4 mt-4 border-t ${isDark ? "border-slate-600" : "border-slate-300"}` : ""}>
                      <p className={`font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        Q: {item.question}
                      </p>
                      <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        A: {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </ResultCard>
            )}

            {result.metaDescription && (
              <ResultCard title="Meta Description" isDark={isDark}>
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap">{result.metaDescription}</p>
                  <button
                    onClick={() => handleCopy(result.metaDescription!)}
                    className={`mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Copy
                  </button>
                </div>
              </ResultCard>
            )}

            {result.storytellingVersion && (
              <ResultCard title="Storytelling Version" isDark={isDark}>
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap">{result.storytellingVersion}</p>
                  <button
                    onClick={() => handleCopy(result.storytellingVersion!)}
                    className={`mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Copy
                  </button>
                </div>
              </ResultCard>
            )}
          </div>
          ) : null}
        </OBDResultsPanel>
      )}
    </OBDPageContainer>
  );
}
