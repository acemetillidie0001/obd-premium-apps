"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import type {
  LogoGeneratorRequest,
  LogoGeneratorResponse,
  PersonalityStyle,
  LogoStyle,
} from "./types";

const defaultFormValues: LogoGeneratorRequest = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  brandVoice: "",
  personalityStyle: "",
  logoStyle: "Modern",
  colorPreferences: "",
  includeText: true,
  variationsCount: 3,
  generateImages: false,
};

export default function AILogoGeneratorPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<LogoGeneratorRequest>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogoGeneratorResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<LogoGeneratorRequest | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    businessType?: string;
  }>({});
  const [usageInfo, setUsageInfo] = useState<{
    conceptsUsed: number;
    imagesUsed: number;
    conceptsLimit: number;
    imagesLimit: number;
    resetsAt: string;
  } | null>(null);
  const [showQuotaToast, setShowQuotaToast] = useState(false);

  function updateFormValue<K extends keyof LogoGeneratorRequest>(
    key: K,
    value: LogoGeneratorRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError(null);
    setResult(null);
    setFieldErrors({});

    // Validation with inline errors
    const errors: { businessName?: string; businessType?: string } = {};
    let hasErrors = false;

    if (!form.businessName.trim()) {
      errors.businessName = "Business name is required";
      hasErrors = true;
    }

    if (!form.businessType.trim()) {
      errors.businessType = "Business type is required";
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      // Clamp variationsCount client-side
      const clampedVariations = Math.min(6, Math.max(1, form.variationsCount || 3));

      const payload: LogoGeneratorRequest = {
        businessName: form.businessName.trim(),
        businessType: form.businessType.trim(),
        services: form.services?.trim() || undefined,
        city: form.city?.trim() || "Ocala",
        state: form.state?.trim() || "Florida",
        brandVoice: form.brandVoice?.trim() || undefined,
        personalityStyle: form.personalityStyle || undefined,
        logoStyle: form.logoStyle || "Modern",
        colorPreferences: form.colorPreferences?.trim() || undefined,
        includeText: form.includeText ?? true,
        variationsCount: clampedVariations,
        generateImages: form.generateImages ?? false,
      };

      setLastPayload(payload);

      const res = await fetch("/api/ai-logo-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        // Handle 429 (quota exceeded) with usage info
        if (res.status === 429) {
          // Extract usage info from error response
          if (errorData.usage && errorData.limits) {
            setUsageInfo({
              conceptsUsed: errorData.usage.conceptsUsed || 0,
              imagesUsed: errorData.usage.imagesUsed || 0,
              conceptsLimit: errorData.limits.conceptsPerDay || 20,
              imagesLimit: errorData.limits.imagesPerDay || 5,
              resetsAt: errorData.resetsAt || "",
            });
          }
          // Show toast notification
          setShowQuotaToast(true);
          setTimeout(() => setShowQuotaToast(false), 5000);
          throw new Error(errorData.message || errorData.error || "Daily limit reached");
        }
        
        throw new Error(errorData.error || errorData.message || `Server error: ${res.status}`);
      }

      const data: LogoGeneratorResponse & { usage?: {
        conceptsUsed: number;
        imagesUsed: number;
        conceptsLimit: number;
        imagesLimit: number;
        resetsAt: string;
      } } = await res.json();
      setResult(data);
      
      // Update usage info from response if available
      if (data.usage) {
        setUsageInfo(data.usage);
      } else {
        setUsageInfo(null);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating logos. Please try again."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    setForm(lastPayload);
    await handleSubmit();
  };

  const handleStartNew = () => {
    setForm(defaultFormValues);
    setResult(null);
    setError(null);
    setFieldErrors({});
    setLastPayload(null);
    setCopiedId(null);
    setUsageInfo(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadExport = () => {
    if (!result || !lastPayload) return;

    const slugify = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    };

    const date = new Date().toISOString().split("T")[0];
    const businessSlug = slugify(lastPayload.businessName || "logo");
    const filename = `${businessSlug}-logo-concepts-${date}.txt`;

    let content = `AI Logo Generator Export\n`;
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += `Business Information:\n`;
    content += `- Business Name: ${lastPayload.businessName}\n`;
    content += `- Business Type: ${lastPayload.businessType}\n`;
    if (lastPayload.services) content += `- Services: ${lastPayload.services}\n`;
    content += `- City: ${lastPayload.city || "Ocala"}\n`;
    content += `- State: ${lastPayload.state || "Florida"}\n`;
    if (lastPayload.brandVoice) content += `- Brand Voice: ${lastPayload.brandVoice}\n`;
    if (lastPayload.personalityStyle) content += `- Personality Style: ${lastPayload.personalityStyle}\n`;
    content += `- Logo Style: ${lastPayload.logoStyle || "Modern"}\n`;
    if (lastPayload.colorPreferences) content += `- Color Preferences: ${lastPayload.colorPreferences}\n`;
    content += `- Include Text: ${lastPayload.includeText ? "Yes" : "No"}\n`;
    content += `- Variations Count: ${lastPayload.variationsCount || 3}\n`;
    content += `- Images Generated: ${lastPayload.generateImages ? "Yes" : "No (prompts only)"}\n\n`;

    content += `=== LOGO CONCEPTS ===\n\n`;

    result.concepts.forEach((concept, idx) => {
      const image = result.images.find((img) => img.conceptId === concept.id);
      content += `Concept ${idx + 1}:\n`;
      content += `- Style: ${concept.styleNotes}\n`;
      content += `- Colors: ${concept.colorPalette.join(", ")}\n`;
      content += `- Description: ${concept.description}\n`;
      if (image) {
        content += `- Prompt: ${image.prompt}\n`;
        if (image.imageUrl) {
          content += `- Image URL: ${image.imageUrl}\n`;
        } else if (image.imageError) {
          content += `- Image Error: ${image.imageError}\n`;
        }
      }
      content += `\n`;
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Logo Generator"
      tagline="Create professional logo concepts and designs tailored to your Ocala business."
    >
      {/* How this tool works */}
      <div
        className={`rounded-xl border p-4 mb-6 ${
          isDark
            ? "bg-slate-800/50 border-slate-700"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          How this tool works
        </h3>
        <p className={`text-sm ${themeClasses.mutedText}`}>
          Generates professional logo concepts, styles, color palettes, and AI-ready prompts you can use in any image generator.
        </p>
        <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
          Turn on &quot;Generate Images (slower)&quot; to also render logo images inside this tool.
        </p>
      </div>

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Business Basics */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Business Basics
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Name *
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) =>
                      updateFormValue("businessName", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="Ocala Coffee Shop"
                    required
                  />
                  {fieldErrors.businessName && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.businessName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="businessType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
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
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                  {fieldErrors.businessType && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.businessType}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="services"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Services (Optional)
                  </label>
                  <textarea
                    id="services"
                    value={form.services}
                    onChange={(e) => updateFormValue("services", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Describe your main services or products..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="city"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
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
                    <label
                      htmlFor="state"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
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
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Brand Identity */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Brand Identity
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="brandVoice"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Brand Voice (Optional)
                  </label>
                  <textarea
                    id="brandVoice"
                    value={form.brandVoice}
                    onChange={(e) => updateFormValue("brandVoice", e.target.value)}
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Describe your brand voice (e.g., warm, professional, playful)"
                  />
                </div>

                <div>
                  <label
                    htmlFor="personalityStyle"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Personality Style (Optional)
                  </label>
                  <select
                    id="personalityStyle"
                    value={form.personalityStyle || ""}
                    onChange={(e) =>
                      updateFormValue("personalityStyle", e.target.value as PersonalityStyle | "")
                    }
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
                  <label
                    htmlFor="logoStyle"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Logo Style
                  </label>
                  <select
                    id="logoStyle"
                    value={form.logoStyle}
                    onChange={(e) =>
                      updateFormValue("logoStyle", e.target.value as LogoStyle)
                    }
                    className={getInputClasses(isDark)}
                  >
                    <option value="Modern">Modern</option>
                    <option value="Classic">Classic</option>
                    <option value="Minimalist">Minimalist</option>
                    <option value="Vintage">Vintage</option>
                    <option value="Playful">Playful</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="colorPreferences"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Color Preferences (Optional)
                  </label>
                  <input
                    type="text"
                    id="colorPreferences"
                    value={form.colorPreferences}
                    onChange={(e) =>
                      updateFormValue("colorPreferences", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Blue and green, warm colors, neutral tones"
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Logo Options */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Logo Options
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="variationsCount"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Number of Variations (1-6)
                  </label>
                  <input
                    type="number"
                    id="variationsCount"
                    value={form.variationsCount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 3;
                      const clamped = Math.min(6, Math.max(1, value));
                      updateFormValue("variationsCount", clamped);
                    }}
                    min={1}
                    max={6}
                    className={getInputClasses(isDark)}
                  />
                </div>

                <div>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={form.includeText ?? true}
                      onChange={(e) => updateFormValue("includeText", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include business name in logo</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Output Options */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Output Options
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={form.generateImages ?? false}
                      onChange={(e) => updateFormValue("generateImages", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm font-medium">Generate Images (slower)</span>
                  </label>
                  <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                    Off = generate logo concepts + prompts only. On = also render images.
                  </p>
                </div>
                {usageInfo && (
                  <div className={`text-xs ${themeClasses.mutedText} pt-2 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                    Usage today: Concepts {usageInfo.conceptsUsed}/{usageInfo.conceptsLimit}, Images {usageInfo.imagesUsed}/{usageInfo.imagesLimit}
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Resets at midnight UTC.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !form.businessName.trim() || !form.businessType.trim()}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? "Generating Logos..." : "Generate Logos"}
            </button>
          </div>
        </form>
      </OBDPanel>

      {/* Results section */}
      {result && (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Generated Logos
            </OBDHeading>
            <div className="flex gap-2">
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
              <button
                onClick={handleStartNew}
                className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Start New
              </button>
              {result && (
                <button
                  onClick={handleDownloadExport}
                  className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Export All
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className={themeClasses.mutedText}>
                {lastPayload?.generateImages
                  ? "Generating logo concepts and images... This may take a minute."
                  : "Generating logo concepts and brand kit..."}
              </div>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className={getErrorPanelClasses(isDark)}>
                <p className="font-medium mb-2">Error:</p>
                <p>{error}</p>
                {usageInfo && (
                  <div className={`mt-3 pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-300"}`}>
                    <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      Daily limit reached — try again tomorrow.
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Concepts: {usageInfo.conceptsUsed}/{usageInfo.conceptsLimit}, Images: {usageInfo.imagesUsed}/{usageInfo.imagesLimit}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : result.concepts.length > 0 ? (
            <div className="space-y-8">
              {result.concepts.map((concept) => {
                const image = result.images.find((img) => img.conceptId === concept.id);
                return (
                  <div
                    key={concept.id}
                    className={`rounded-xl border p-6 ${
                      isDark
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="mb-4">
                      <h3 className={`text-lg font-semibold mb-2 ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}>
                        Logo Concept {concept.id}
                      </h3>
                      <div className="space-y-2">
                          <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            <span className="font-medium">Style:</span> {concept.styleNotes}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                              Colors:
                            </span>
                            <div className="flex gap-2">
                              {concept.colorPalette.map((color, idx) => (
                                <div
                                  key={idx}
                                  className="w-6 h-6 rounded border border-slate-300"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                            <button
                              onClick={() => handleCopy(concept.colorPalette.join(", "), `palette-${concept.id}`)}
                              className={`text-xs px-2 py-1 rounded transition-colors ml-2 ${
                                copiedId === `palette-${concept.id}`
                                  ? "bg-[#29c4a9] text-white"
                                  : isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedId === `palette-${concept.id}` ? "Copied!" : "Copy Palette"}
                            </button>
                          </div>
                          <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            <span className="font-medium">Description:</span> {concept.description}
                          </p>
                          {image?.prompt && (
                            <div className="flex items-start gap-2 mt-2">
                              <p className={`text-xs flex-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                <span className="font-medium">Prompt:</span> {image.prompt}
                              </p>
                              <button
                                onClick={() => handleCopy(image.prompt, `prompt-${concept.id}`)}
                                className={`text-xs px-2 py-1 rounded transition-colors flex-shrink-0 ${
                                  copiedId === `prompt-${concept.id}`
                                    ? "bg-[#29c4a9] text-white"
                                    : isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedId === `prompt-${concept.id}` ? "Copied!" : "Copy Prompt"}
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              const conceptJson = JSON.stringify({
                                concept,
                                image: image?.imageUrl ? { url: image.imageUrl, prompt: image.prompt } : null,
                                imageError: image?.imageError,
                              }, null, 2);
                              handleCopy(conceptJson, `json-${concept.id}`);
                            }}
                            className={`text-xs px-2 py-1 rounded transition-colors mt-2 ${
                              copiedId === `json-${concept.id}`
                                ? "bg-[#29c4a9] text-white"
                                : isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedId === `json-${concept.id}` ? "Copied!" : "Copy JSON"}
                          </button>
                        </div>
                    </div>
                    {!lastPayload?.generateImages ? (
                      // Images not generated - show prompt for later use
                      <div className={`rounded-lg border p-6 mb-4 ${
                        isDark
                          ? "bg-slate-800/50 border-slate-600"
                          : "bg-slate-100 border-slate-300"
                      }`}>
                        <p className={`text-sm font-medium mb-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          Use this prompt to render later
                        </p>
                        {image?.prompt ? (
                          <>
                            <div className={`rounded p-3 mb-4 ${isDark ? "bg-slate-900" : "bg-white"}`}>
                              <p className={`text-xs font-mono whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                                {image.prompt}
                              </p>
                            </div>
                            <button
                              onClick={() => handleCopy(image.prompt, `prompt-large-${concept.id}`)}
                              className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                                copiedId === `prompt-large-${concept.id}`
                                  ? "bg-[#29c4a9] text-white"
                                  : isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedId === `prompt-large-${concept.id}` ? "Copied!" : "Copy Prompt"}
                            </button>
                          </>
                        ) : (
                          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Prompt will be generated when you enable image generation.
                          </p>
                        )}
                      </div>
                    ) : image?.imageUrl ? (
                      <>
                        <div className="flex justify-center mb-4">
                          <img
                            src={image.imageUrl}
                            alt={`Logo concept ${concept.id}`}
                            className="max-w-full h-auto rounded-lg border border-slate-300 shadow-lg"
                          />
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={image.imageUrl}
                            download={`logo-concept-${concept.id}.png`}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            Download Image
                          </a>
                        </div>
                      </>
                    ) : image ? (
                      <div className={`rounded-lg border p-4 mb-4 ${
                        isDark
                          ? "bg-yellow-900/20 border-yellow-700 text-yellow-400"
                          : "bg-yellow-50 border-yellow-200 text-yellow-600"
                      }`}>
                        <p className="text-sm font-medium">Image generation failed</p>
                        {image.imageError && (
                          <p className="text-xs mt-1">{image.imageError}</p>
                        )}
                        <p className="text-xs mt-2">Concept details are still available above.</p>
                      </div>
                    ) : (
                      <div className={`rounded-lg border p-4 mb-4 ${
                        isDark
                          ? "bg-blue-900/20 border-blue-700 text-blue-400"
                          : "bg-blue-50 border-blue-200 text-blue-600"
                      }`}>
                        <p className="text-sm font-medium">Image generation in progress...</p>
                        <p className="text-xs mt-2">Concept details are available above. Image will appear when ready.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`italic obd-soft-text text-center py-8 ${isDark ? "text-slate-500" : "text-gray-400"}`}>
              No logos were generated. Please try again.
            </p>
          )}
        </OBDPanel>
      )}

      {error && !result && (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Quota Toast */}
      {showQuotaToast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-yellow-900/90 border-yellow-700 text-yellow-100"
              : "bg-yellow-50 border-yellow-200 text-yellow-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Daily limit reached</p>
              <p className="text-sm opacity-90">
                You&apos;ve reached today&apos;s limit for this tool. Please try again tomorrow.
              </p>
            </div>
            <button
              onClick={() => setShowQuotaToast(false)}
              className={`ml-2 flex-shrink-0 ${isDark ? "text-yellow-200 hover:text-yellow-100" : "text-yellow-600 hover:text-yellow-800"}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}

