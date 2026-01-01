"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getDividerClass } from "@/lib/obd-framework/layout-helpers";
import type {
  ImageCaptionRequest,
  ImageCaptionResponse,
  Caption,
  PlatformOption,
  GoalOption,
  CallToActionPreference,
  PersonalityStyle,
  CaptionLength,
  HashtagStyle,
  VariationMode,
  LanguageOption,
} from "./types";

const DEFAULT_FORM: ImageCaptionRequest = {
  businessName: "",
  businessType: "",
  services: [],
  city: "Ocala",
  state: "Florida",
  imageContext: "",
  imageDetails: "",
  platform: "Instagram",
  goal: "Awareness",
  callToActionPreference: "Soft",
  brandVoice: "",
  personalityStyle: "",
  captionLength: "Medium",
  includeHashtags: true,
  hashtagStyle: "Local",
  variationsCount: 3,
  variationMode: "Safe",
  language: "English",
};

export default function ImageCaptionGeneratorPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<ImageCaptionRequest>(DEFAULT_FORM);
  const [servicesInput, setServicesInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageCaptionResponse | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleChange = <K extends keyof ImageCaptionRequest>(
    key: K,
    value: ImageCaptionRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key: "includeHashtags") => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async (caption: Caption) => {
    try {
      const textToCopy = caption.hashtags.length > 0
        ? `${caption.text}\n\n${caption.hashtags.join(" ")}`
        : caption.text;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(caption.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!form.imageContext.trim()) {
      setError("Please describe your image so we can create the perfect caption.");
      return;
    }

    setIsLoading(true);

    try {
      const payload: ImageCaptionRequest = {
        ...form,
        services: servicesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        variationsCount: Math.min(5, Math.max(1, form.variationsCount || 3)),
      };

      const res = await fetch("/api/image-caption-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: ImageCaptionResponse }
      const response: ImageCaptionResponse = jsonResponse.data || jsonResponse;
      setResult(response);
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Image Caption Generator"
      tagline="Generate creative captions for your business images that engage your audience and boost social media performance."
    >
      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Business Basics Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Business Basics</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Business Name
                        </label>
                        <input
                          type="text"
                          id="businessName"
                          value={form.businessName}
                          onChange={(e) => handleChange("businessName", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="Your business name"
                        />
                      </div>
                      <div>
                        <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Business Type
                        </label>
                        <input
                          type="text"
                          id="businessType"
                          value={form.businessType}
                          onChange={(e) => handleChange("businessType", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Restaurant, Salon, Law Firm"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Services (comma-separated)
                      </label>
                      <input
                        type="text"
                        id="services"
                        value={servicesInput}
                        onChange={(e) => setServicesInput(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Service 1, Service 2, Service 3"
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
                          value={form.city}
                          onChange={(e) => handleChange("city", e.target.value)}
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
                          onChange={(e) => handleChange("state", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="Florida"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Image Description Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Image Description</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="imageContext" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Image Context / Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="imageContext"
                        value={form.imageContext}
                        onChange={(e) => handleChange("imageContext", e.target.value)}
                        rows={4}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="What does the photo show? (e.g., spa interior, plated dish, team photo, etc.)"
                        required
                      />
                      {!form.imageContext.trim() && error && (
                        <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                          {error}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="imageDetails" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Extra Image Details (Optional)
                      </label>
                      <textarea
                        id="imageDetails"
                        value={form.imageDetails}
                        onChange={(e) => handleChange("imageDetails", e.target.value)}
                        rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="Any additional context, mood, or details about the image..."
                      />
                    </div>
                  </div>
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Platform / Goal / CTA Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Platform / Goal / CTA</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Platform
                      </label>
                      <select
                        id="platform"
                        value={form.platform}
                        onChange={(e) => handleChange("platform", e.target.value as PlatformOption)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Instagram">Instagram</option>
                        <option value="Facebook">Facebook</option>
                        <option value="InstagramStory">Instagram Story</option>
                        <option value="GoogleBusinessProfile">Google Business Profile</option>
                        <option value="X">X (Twitter)</option>
                        <option value="Generic">Generic</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="goal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Goal
                      </label>
                      <select
                        id="goal"
                        value={form.goal}
                        onChange={(e) => handleChange("goal", e.target.value as GoalOption)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Awareness">Awareness</option>
                        <option value="Promotion">Promotion/Offer</option>
                        <option value="Event">Event</option>
                        <option value="Testimonial">Testimonial</option>
                        <option value="BehindTheScenes">Behind the Scenes</option>
                        <option value="Educational">Educational</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="callToActionPreference" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        CTA Preference
                      </label>
                      <select
                        id="callToActionPreference"
                        value={form.callToActionPreference}
                        onChange={(e) => handleChange("callToActionPreference", e.target.value as CallToActionPreference)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Soft">Soft</option>
                        <option value="Direct">Direct</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Brand Voice & Personality Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Brand Voice & Personality</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Brand Voice (Optional)
                      </label>
                      <textarea
                        id="brandVoice"
                        value={form.brandVoice}
                        onChange={(e) => handleChange("brandVoice", e.target.value)}
                        rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="Describe your brand voice (e.g., friendly, professional, witty, etc.)"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Personality
                        </label>
                        <select
                          id="personalityStyle"
                          value={form.personalityStyle}
                          onChange={(e) => handleChange("personalityStyle", e.target.value as PersonalityStyle)}
                          className={getInputClasses(isDark)}
                        >
                          <option value="">Default</option>
                          <option value="Soft">Soft</option>
                          <option value="Bold">Bold</option>
                          <option value="High-Energy">High-Energy</option>
                          <option value="Luxury">Luxury</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="captionLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Caption Length
                        </label>
                        <select
                          id="captionLength"
                          value={form.captionLength}
                          onChange={(e) => handleChange("captionLength", e.target.value as CaptionLength)}
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
                        value={form.language}
                        onChange={(e) => handleChange("language", e.target.value as LanguageOption)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="English">English only</option>
                        <option value="Spanish">Spanish only</option>
                        <option value="Bilingual">Bilingual</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Hashtags & Variations Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Hashtags & Variations</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={form.includeHashtags}
                          onChange={() => handleToggle("includeHashtags")}
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm">Include Hashtags</span>
                      </label>
                    </div>

                    <div>
                      <label htmlFor="hashtagStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Hashtag Style
                      </label>
                      <select
                        id="hashtagStyle"
                        value={form.hashtagStyle}
                        onChange={(e) => handleChange("hashtagStyle", e.target.value as HashtagStyle)}
                        disabled={!form.includeHashtags}
                        className={getInputClasses(isDark, "disabled:opacity-50 disabled:cursor-not-allowed")}
                      >
                        <option value="Local">Local</option>
                        <option value="Branded">Branded</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="variationsCount" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Variations Count
                        </label>
                        <input
                          type="number"
                          id="variationsCount"
                          min={1}
                          max={5}
                          value={form.variationsCount}
                          onChange={(e) => handleChange("variationsCount", Math.min(5, Math.max(1, parseInt(e.target.value) || 3)))}
                          className={getInputClasses(isDark)}
                        />
                      </div>

                      <div>
                        <label htmlFor="variationMode" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Variation Mode
                        </label>
                        <select
                          id="variationMode"
                          value={form.variationMode}
                          onChange={(e) => handleChange("variationMode", e.target.value as VariationMode)}
                          className={getInputClasses(isDark)}
                        >
                          <option value="Safe">Safe</option>
                          <option value="Creative">Creative</option>
                          <option value="Storytelling">Storytelling</option>
                          <option value="Punchy">Punchy</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {error && !isLoading && (
                  <div className={`rounded-xl border p-3 ${isDark ? "bg-red-900/20 border-red-700 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !form.imageContext.trim()}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Writing captions...
                    </span>
                  ) : (
                    "Write Captions"
                  )}
                </button>
              </div>
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
          title="AI-Generated Captions"
          subtitle="Each card is a variation you can copy and use."
          isDark={isDark}
          loading={isLoading}
          emptyState={
            <p className={`italic obd-soft-text text-center ${isDark ? "text-slate-500" : "text-gray-400"}`}>
              Fill out the form above and click "Write Captions" to generate your image captions.
            </p>
          }
          className="mt-8"
        >
          {result && result.captions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.captions.map((caption) => (
                    <div
                      key={caption.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isDark
                          ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                          : "bg-white border-slate-200 hover:border-[#29c4a9]"
                      }`}
                    >
                      {/* Top row with meta and copy button */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs uppercase font-medium ${themeClasses.mutedText}`}>
                            {caption.platform}
                          </span>
                          <span className={`text-xs uppercase font-medium ${themeClasses.mutedText}`}>
                            {caption.lengthMode}
                          </span>
                          <span className={`text-xs uppercase font-medium ${themeClasses.mutedText}`}>
                            {caption.variationMode}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(caption)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            copiedId === caption.id
                              ? isDark
                                ? "bg-[#29c4a9] text-white"
                                : "bg-[#29c4a9] text-white"
                              : isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {copiedId === caption.id ? "Copied!" : "Copy"}
                        </button>
                      </div>

                      {/* Label */}
                      <h3 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {caption.label}
                      </h3>

                      {/* Preview hint */}
                      {caption.previewHint && (
                        <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
                          {caption.previewHint}
                        </p>
                      )}

                      {/* Caption text */}
                      <div className={`text-sm leading-relaxed mb-3 whitespace-pre-line ${
                        isDark ? "text-slate-200" : "text-slate-700"
                      }`}>
                        {caption.text}
                      </div>

                      {/* Hashtags */}
                      {caption.hashtags.length > 0 && (
                        <div className={`pt-3 mt-3 border-t ${
                          isDark ? "border-slate-700" : "border-slate-200"
                        }`}>
                          <p className={`text-xs ${themeClasses.mutedText}`}>
                            {caption.hashtags.join(" ")}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
          ) : null}
        </OBDResultsPanel>
      )}
    </OBDPageContainer>
  );
}
