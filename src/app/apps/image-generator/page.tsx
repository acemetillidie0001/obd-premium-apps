"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type {
  ImageEngineRequest,
  ImageEngineDecision,
  ImageGenerationResult,
} from "@/lib/image-engine/types";

interface TestFormValues {
  requestId: string;
  consumerApp: ImageEngineRequest["consumerApp"];
  platform: ImageEngineRequest["platform"];
  category: ImageEngineRequest["category"];
  intentSummary: string;
  allowTextOverlay: boolean;
  primaryColorHex: string;
  secondaryColorHex: string;
  accentColorHex: string;
  styleTone: "modern" | "luxury" | "friendly" | "bold" | "clean" | "";
  industry: string;
  city: string;
  region: string;
}

const defaultFormValues: TestFormValues = {
  requestId: `test-${Date.now()}`,
  consumerApp: "social_auto_poster",
  platform: "instagram",
  category: "educational",
  intentSummary: "An abstract educational image about local business tips",
  allowTextOverlay: false,
  primaryColorHex: "",
  secondaryColorHex: "",
  accentColorHex: "",
  styleTone: "",
  industry: "",
  city: "Ocala",
  region: "Florida",
};

export default function ImageGeneratorTestPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [formValues, setFormValues] = useState<TestFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<ImageEngineDecision | null>(null);
  const [generationResult, setGenerationResult] =
    useState<ImageGenerationResult | null>(null);
  const [mode, setMode] = useState<"decision" | "generate">("decision");

  const updateFormValue = <K extends keyof TestFormValues>(
    key: K,
    value: TestFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const buildRequestPayload = (): ImageEngineRequest => {
    const payload: ImageEngineRequest = {
      requestId: formValues.requestId.trim() || `test-${Date.now()}`,
      consumerApp: formValues.consumerApp,
      platform: formValues.platform,
      category: formValues.category,
      intentSummary: formValues.intentSummary.trim(),
      allowTextOverlay: formValues.allowTextOverlay,
      brand: {
        ...(formValues.primaryColorHex && { primaryColorHex: formValues.primaryColorHex }),
        ...(formValues.secondaryColorHex && { secondaryColorHex: formValues.secondaryColorHex }),
        ...(formValues.accentColorHex && { accentColorHex: formValues.accentColorHex }),
        ...(formValues.styleTone && { styleTone: formValues.styleTone }),
        ...(formValues.industry && { industry: formValues.industry }),
      },
      locale: {
        ...(formValues.city && { city: formValues.city }),
        ...(formValues.region && { region: formValues.region }),
      },
      safeMode: "strict",
    };

    // Remove empty brand object if no brand fields
    if (Object.keys(payload.brand || {}).length === 0) {
      delete payload.brand;
    }

    // Remove empty locale object if no locale fields
    if (Object.keys(payload.locale || {}).length === 0) {
      delete payload.locale;
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDecision(null);
    setGenerationResult(null);

    try {
      const requestPayload = buildRequestPayload();

      if (mode === "decision") {
        // Decision only
        const res = await fetch("/api/image-engine/decision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${res.status}`);
        }

        const data = await res.json();
        setDecision(data as ImageEngineDecision);
      } else {
        // Generate image
        const res = await fetch("/api/image-engine/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${res.status}`);
        }

        const data = await res.json();
        setGenerationResult(data as ImageGenerationResult);
        // Also set decision from result
        if (data.decision) {
          setDecision(data.decision);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Image Generator - Internal Test Harness"
      tagline="Internal testing tool for the OBD Brand-Safe Image Generator (Phase 2A: Generation)."
    >
      {/* Warning banner */}
      <div className={`mt-7 p-4 rounded-lg border ${
        isDark
          ? "bg-amber-900/20 border-amber-700 text-amber-200"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}>
        <p className="text-sm font-semibold mb-1">⚠️ Internal Test Harness</p>
        <p className="text-xs">
          This page is for testing the image engine. Toggle between decision-only and full generation below.
        </p>
      </div>

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Fields */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Request Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="requestId" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Request ID
                    </label>
                    <input
                      type="text"
                      id="requestId"
                      value={formValues.requestId}
                      onChange={(e) => updateFormValue("requestId", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="test-123"
                    />
                  </div>
                  <div>
                    <label htmlFor="consumerApp" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Consumer App
                    </label>
                    <select
                      id="consumerApp"
                      value={formValues.consumerApp}
                      onChange={(e) => updateFormValue("consumerApp", e.target.value as ImageEngineRequest["consumerApp"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="social_auto_poster">Social Auto-Poster</option>
                      <option value="offers_promotions">Offers & Promotions</option>
                      <option value="event_campaign">Event Campaign</option>
                      <option value="review_responder">Review Responder</option>
                      <option value="brand_kit_builder">Brand Kit Builder</option>
                      <option value="seo_audit_roadmap">SEO Audit Roadmap</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Platform
                    </label>
                    <select
                      id="platform"
                      value={formValues.platform}
                      onChange={(e) => updateFormValue("platform", e.target.value as ImageEngineRequest["platform"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="x">X (Twitter)</option>
                      <option value="google_business_profile">Google Business Profile</option>
                      <option value="blog">Blog</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="category" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Category
                    </label>
                    <select
                      id="category"
                      value={formValues.category}
                      onChange={(e) => updateFormValue("category", e.target.value as ImageEngineRequest["category"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="educational">Educational</option>
                      <option value="promotion">Promotion</option>
                      <option value="social_proof">Social Proof</option>
                      <option value="local_abstract">Local Abstract</option>
                      <option value="evergreen">Evergreen</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="intentSummary" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Intent Summary
                  </label>
                  <textarea
                    id="intentSummary"
                    value={formValues.intentSummary}
                    onChange={(e) => updateFormValue("intentSummary", e.target.value)}
                    className={getInputClasses(isDark)}
                    rows={3}
                    placeholder="Describe what the image should communicate..."
                  />
                </div>

                <div>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.allowTextOverlay}
                      onChange={(e) => updateFormValue("allowTextOverlay", e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Allow Text Overlay</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Brand Influence */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Brand Influence (Optional)
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="primaryColorHex" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Primary Color (Hex)
                    </label>
                    <input
                      type="text"
                      id="primaryColorHex"
                      value={formValues.primaryColorHex}
                      onChange={(e) => updateFormValue("primaryColorHex", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="#FF5733"
                    />
                  </div>
                  <div>
                    <label htmlFor="secondaryColorHex" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Secondary Color (Hex)
                    </label>
                    <input
                      type="text"
                      id="secondaryColorHex"
                      value={formValues.secondaryColorHex}
                      onChange={(e) => updateFormValue("secondaryColorHex", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="#33FF57"
                    />
                  </div>
                  <div>
                    <label htmlFor="accentColorHex" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Accent Color (Hex)
                    </label>
                    <input
                      type="text"
                      id="accentColorHex"
                      value={formValues.accentColorHex}
                      onChange={(e) => updateFormValue("accentColorHex", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="#3357FF"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="styleTone" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Style Tone
                    </label>
                    <select
                      id="styleTone"
                      value={formValues.styleTone}
                      onChange={(e) => updateFormValue("styleTone", e.target.value as TestFormValues["styleTone"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">None</option>
                      <option value="modern">Modern</option>
                      <option value="luxury">Luxury</option>
                      <option value="friendly">Friendly</option>
                      <option value="bold">Bold</option>
                      <option value="clean">Clean</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="industry" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Industry
                    </label>
                    <input
                      type="text"
                      id="industry"
                      value={formValues.industry}
                      onChange={(e) => updateFormValue("industry", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., Restaurant, Salon"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Locale */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Locale (Optional)
              </h3>
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
                  <label htmlFor="region" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Region/State
                  </label>
                  <input
                    type="text"
                    id="region"
                    value={formValues.region}
                    onChange={(e) => updateFormValue("region", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Florida"
                  />
                </div>
              </div>
            </div>

            {/* Mode Toggle */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Mode
              </h3>
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="radio"
                    name="mode"
                    value="decision"
                    checked={mode === "decision"}
                    onChange={(e) => setMode(e.target.value as "decision" | "generate")}
                    className="rounded"
                  />
                  <span className="text-sm">Decision Only</span>
                </label>
                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="radio"
                    name="mode"
                    value="generate"
                    checked={mode === "generate"}
                    onChange={(e) => setMode(e.target.value as "decision" | "generate")}
                    className="rounded"
                  />
                  <span className="text-sm">Generate Image</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {loading
                  ? "Processing..."
                  : mode === "decision"
                  ? "Get Decision"
                  : "Generate Image"}
              </button>
            </div>
          </div>
        </form>
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Generation Result Display */}
      {generationResult && (
        <OBDPanel isDark={isDark} className="mt-7">
          <OBDHeading isDark={isDark} level={2}>
            Generation Result
          </OBDHeading>
          <div className="mt-4 space-y-4">
            {/* Status */}
            <div
              className={`p-3 rounded-lg ${
                generationResult.ok
                  ? isDark
                    ? "bg-green-900/20 border border-green-700 text-green-200"
                    : "bg-green-50 border border-green-200 text-green-900"
                  : isDark
                  ? "bg-red-900/20 border border-red-700 text-red-200"
                  : "bg-red-50 border border-red-200 text-red-900"
              }`}
            >
              <p className="text-sm font-semibold">
                {generationResult.ok ? "✓ Success" : "✗ Failed"}
              </p>
              {generationResult.fallback && (
                <p className="text-xs mt-1">
                  Fallback used: {generationResult.fallback.reason}
                </p>
              )}
              {generationResult.error && (
                <p className="text-xs mt-1">
                  Error: {generationResult.error.message}
                </p>
              )}
            </div>

            {/* Image Display */}
            {generationResult.ok && generationResult.image && (
              <div>
                <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Generated Image
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={generationResult.image.url}
                    alt={generationResult.image.altText}
                    className="w-full h-auto"
                    style={{ maxHeight: "600px", objectFit: "contain" }}
                  />
                </div>
                <p className="text-xs mt-2 text-slate-500">
                  {generationResult.image.width}x{generationResult.image.height}px •{" "}
                  {generationResult.image.contentType}
                </p>
              </div>
            )}

            {/* JSON Response */}
            <div>
              <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Full Response
              </p>
              <pre className={`text-xs p-4 rounded-lg overflow-auto ${
                isDark
                  ? "bg-slate-900 border border-slate-700 text-slate-100"
                  : "bg-slate-50 border border-slate-200 text-slate-900"
              }`}>
                {JSON.stringify(generationResult, null, 2)}
              </pre>
            </div>
          </div>
        </OBDPanel>
      )}

      {/* Decision Display (when decision-only mode) */}
      {decision && !generationResult && (
        <OBDPanel isDark={isDark} className="mt-7">
          <OBDHeading isDark={isDark} level={2}>
            Decision Result
          </OBDHeading>
          <div className="mt-4">
            <pre className={`text-xs p-4 rounded-lg overflow-auto ${
              isDark
                ? "bg-slate-900 border border-slate-700 text-slate-100"
                : "bg-slate-50 border border-slate-200 text-slate-900"
            }`}>
              {JSON.stringify(decision, null, 2)}
            </pre>
          </div>
        </OBDPanel>
      )}
    </OBDPageContainer>
  );
}

