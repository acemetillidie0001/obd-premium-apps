"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

type PersonalityStyle = "Soft" | "Bold" | "High-Energy" | "Luxury";
type WritingStyleTemplate =
  | "Default"
  | "Story-Driven"
  | "SEO-Friendly"
  | "Short & Punchy"
  | "Luxury Premium";
type DescriptionLength = "Short" | "Medium" | "Long";

interface BusinessDescriptionFormValues {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  targetAudience: string;
  uniqueSellingPoints: string;
  keywords: string;
  brandVoice: string;
  personalityStyle?: PersonalityStyle | "";
  writingStyleTemplate: WritingStyleTemplate;
  includeFAQSuggestions: boolean;
  includeMetaDescription: boolean;
  descriptionLength: DescriptionLength;
  language: string;
}

const defaultFormValues: BusinessDescriptionFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  targetAudience: "",
  uniqueSellingPoints: "",
  keywords: "",
  brandVoice: "",
  personalityStyle: "",
  writingStyleTemplate: "Default",
  includeFAQSuggestions: true,
  includeMetaDescription: true,
  descriptionLength: "Medium",
  language: "English",
};

interface SocialBioPack {
  facebookBio: string;
  instagramBio: string;
  xBio: string;
  linkedinTagline: string;
}

interface FAQSuggestion {
  question: string;
  answer: string;
}

interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: SocialBioPack;
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: FAQSuggestion[];
  metaDescription: string | null;
}

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

export default function BusinessDescriptionWriterPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [formValues, setFormValues] = useState<BusinessDescriptionFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BusinessDescriptionResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<BusinessDescriptionFormValues | null>(null);

  const updateFormValue = <K extends keyof BusinessDescriptionFormValues>(
    key: K,
    value: BusinessDescriptionFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const processRequest = async (payload: BusinessDescriptionFormValues) => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const apiPayload = {
        businessName: payload.businessName.trim(),
        businessType: payload.businessType.trim(),
        services: payload.services.trim(),
        city: payload.city.trim() || "Ocala",
        state: payload.state.trim() || "Florida",
        targetAudience: payload.targetAudience.trim() || undefined,
        uniqueSellingPoints: payload.uniqueSellingPoints.trim() || undefined,
        keywords: payload.keywords.trim() || undefined,
        brandVoice: payload.brandVoice.trim() || undefined,
        personalityStyle: payload.personalityStyle || undefined,
        writingStyleTemplate: payload.writingStyleTemplate || "Default",
        includeFAQSuggestions: payload.includeFAQSuggestions ?? true,
        includeMetaDescription: payload.includeMetaDescription ?? true,
        descriptionLength: payload.descriptionLength || "Medium",
        language: payload.language || "English",
      };

      const res = await fetch("/api/business-description-writer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: BusinessDescriptionResponse }
      const response: BusinessDescriptionResponse = jsonResponse.data || jsonResponse;
      setResult(response);
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.businessName.trim()) {
      setError("Please enter a business name to continue.");
      return;
    }

    setLastPayload(formValues);
    await processRequest(formValues);
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    await processRequest(lastPayload);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Business Description Writer"
      tagline="Create compelling business descriptions tailored to your Ocala business that capture your unique value proposition."
    >
      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
              <div className={`space-y-4 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
                <div>
                  <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Name
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={formValues.businessName}
                    onChange={(e) => updateFormValue("businessName", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={formValues.businessType}
                    onChange={(e) => updateFormValue("businessType", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Services
                  </label>
                  <textarea
                    id="services"
                    value={formValues.services}
                    onChange={(e) => updateFormValue("services", e.target.value)}
                    rows={4}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Describe your main services, products, policies, hours, etc..."
                    required
                  />
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

                <div>
                  <label htmlFor="targetAudience" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Target Audience (Optional)
                  </label>
                  <input
                    type="text"
                    id="targetAudience"
                    value={formValues.targetAudience}
                    onChange={(e) => updateFormValue("targetAudience", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Local families, small businesses, retirees"
                  />
                </div>

                <div>
                  <label htmlFor="uniqueSellingPoints" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Unique Selling Points (Optional)
                  </label>
                  <textarea
                    id="uniqueSellingPoints"
                    value={formValues.uniqueSellingPoints}
                    onChange={(e) => updateFormValue("uniqueSellingPoints", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="List what makes your business stand out..."
                  />
                </div>

                <div>
                  <label htmlFor="keywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Keywords (Optional)
                  </label>
                  <input
                    type="text"
                    id="keywords"
                    value={formValues.keywords}
                    onChange={(e) => updateFormValue("keywords", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Comma-separated: e.g., Ocala pressure washing, driveway cleaning"
                  />
                </div>

                <div>
                  <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Brand Voice (Optional)
                  </label>
                  <textarea
                    id="brandVoice"
                    value={formValues.brandVoice}
                    onChange={(e) => updateFormValue("brandVoice", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                  />
                </div>

                <div>
                  <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Personality Style (Optional)
                  </label>
                  <select
                    id="personalityStyle"
                    value={formValues.personalityStyle || ""}
                    onChange={(e) => updateFormValue("personalityStyle", e.target.value as PersonalityStyle | "")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="">No specific style</option>
                    <option value="Soft">Soft</option>
                    <option value="Bold">Bold</option>
                    <option value="High-Energy">High-Energy</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="writingStyleTemplate" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Writing Style Template
                  </label>
                  <select
                    id="writingStyleTemplate"
                    value={formValues.writingStyleTemplate}
                    onChange={(e) => updateFormValue("writingStyleTemplate", e.target.value as WritingStyleTemplate)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Default">Default</option>
                    <option value="Story-Driven">Story-Driven</option>
                    <option value="SEO-Friendly">SEO-Friendly</option>
                    <option value="Short & Punchy">Short & Punchy</option>
                    <option value="Luxury Premium">Luxury Premium</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="descriptionLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Description Length
                  </label>
                  <select
                    id="descriptionLength"
                    value={formValues.descriptionLength}
                    onChange={(e) => updateFormValue("descriptionLength", e.target.value as DescriptionLength)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Short">Short</option>
                    <option value="Medium">Medium</option>
                    <option value="Long">Long</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Language
                  </label>
                  <select
                    id="language"
                    value={formValues.language}
                    onChange={(e) => updateFormValue("language", e.target.value)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Bilingual (English + Spanish)">Bilingual (English + Spanish)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeFAQSuggestions}
                      onChange={(e) => updateFormValue("includeFAQSuggestions", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include FAQ suggestions</span>
                  </label>

                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeMetaDescription}
                      onChange={(e) => updateFormValue("includeMetaDescription", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include SEO meta description</span>
                  </label>
                </div>
              </div>
              
              <OBDStickyActionBar isDark={isDark}>
                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating..." : "Create Description"}
                </button>
              </OBDStickyActionBar>
            </form>
      </OBDPanel>

      {/* Results section */}
      {error ? (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      ) : (
        <OBDResultsPanel
          title="Generated Content"
          isDark={isDark}
          actions={
            result ? (
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {loading ? "Regenerating..." : "Regenerate"}
              </button>
            ) : undefined
          }
          loading={loading}
          emptyState={
            <p className={`italic obd-soft-text text-center ${isDark ? "text-slate-500" : "text-gray-400"}`}>
              Fill out the form above and click "Create Description" to generate your business descriptions.
            </p>
          }
          className="mt-8"
        >
          {result ? (
                <div className="grid grid-cols-1 gap-4">
                  <ResultCard title="OBD Listing Description" isDark={isDark}>
                    <p className="whitespace-pre-wrap">{result.obdListingDescription}</p>
                  </ResultCard>

                  <ResultCard title="Website 'About Us' Section" isDark={isDark}>
                    <p className="whitespace-pre-wrap">{result.websiteAboutUs}</p>
                  </ResultCard>

                  <ResultCard title="Google Business Profile Description" isDark={isDark}>
                    <p className="whitespace-pre-wrap">{result.googleBusinessDescription}</p>
                  </ResultCard>

                  <ResultCard title="Social Media Bio Pack" isDark={isDark}>
                    <div className="space-y-4">
                      <div>
                        <p className={`font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>Facebook:</p>
                        <p className="whitespace-pre-wrap">{result.socialBioPack.facebookBio}</p>
                      </div>
                      <div>
                        <p className={`font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>Instagram:</p>
                        <p className="whitespace-pre-wrap">{result.socialBioPack.instagramBio}</p>
                      </div>
                      <div>
                        <p className={`font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>X (Twitter):</p>
                        <p className="whitespace-pre-wrap">{result.socialBioPack.xBio}</p>
                      </div>
                      <div>
                        <p className={`font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>LinkedIn Tagline:</p>
                        <p className="whitespace-pre-wrap">{result.socialBioPack.linkedinTagline}</p>
                      </div>
                    </div>
                  </ResultCard>

                  <ResultCard title="Tagline Options" isDark={isDark}>
                    <ul className="list-disc list-inside space-y-1">
                      {result.taglineOptions.map((tagline, idx) => (
                        <li key={idx}>{tagline}</li>
                      ))}
                    </ul>
                  </ResultCard>

                  <ResultCard title="Elevator Pitch" isDark={isDark}>
                    <p className="whitespace-pre-wrap">{result.elevatorPitch}</p>
                  </ResultCard>

                  {result.faqSuggestions.length > 0 && (
                    <ResultCard title="FAQ Suggestions" isDark={isDark}>
                      <div className="space-y-4">
                        {result.faqSuggestions.map((faq, idx) => (
                          <div key={idx}>
                            <p className={`font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                              Q: {faq.question}
                            </p>
                            <p className="whitespace-pre-wrap">A: {faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </ResultCard>
                  )}

                  {result.metaDescription && (
                    <ResultCard title="SEO Meta Description" isDark={isDark}>
                      <p className="whitespace-pre-wrap">{result.metaDescription}</p>
                    </ResultCard>
                  )}
                </div>
          ) : null}
        </OBDResultsPanel>
      )}
    </OBDPageContainer>
  );
}
