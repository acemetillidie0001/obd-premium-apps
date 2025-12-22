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
import {
  OffersBuilderRequest,
  OffersBuilderResponse,
  PromoOutput,
  PromoType,
  OutputPlatform,
  PersonalityStyle,
  LanguageOption,
} from "./types";

const defaultFormValues: OffersBuilderRequest = {
  businessName: "",
  businessType: "",
  services: [],
  city: "Ocala",
  state: "Florida",
  promoType: "Discount",
  promoTitle: "",
  promoDescription: "",
  offerValue: "",
  offerCode: "",
  startDate: "",
  endDate: "",
  goal: "",
  targetAudience: "",
  outputPlatforms: ["Facebook", "Instagram", "Google Business Profile"],
  brandVoice: "",
  personalityStyle: "None",
  length: "Medium",
  language: "English",
  includeHashtags: true,
  hashtagStyle: "Local",
  variationsCount: 1,
  variationMode: "Conservative",
  wizardMode: false,
};

const PROMO_TYPES: PromoType[] = [
  "Discount",
  "Limited-Time Offer",
  "Seasonal Promotion",
  "Holiday Special",
  "Flash Sale",
  "Referral Bonus",
  "Loyalty Reward",
  "New Customer Offer",
  "Bundle Deal",
  "Other",
];

const PLATFORM_OPTIONS: OutputPlatform[] = [
  "Facebook",
  "Instagram",
  "Google Business Profile",
  "X",
  "Email",
  "SMS",
  "Flyer",
  "Website Banner",
];

const PLATFORM_ICONS: Record<OutputPlatform, string> = {
  Facebook: "📘",
  Instagram: "📸",
  "Google Business Profile": "📍",
  X: "✖️",
  Email: "📧",
  SMS: "💬",
  Flyer: "📄",
  "Website Banner": "🖼️",
};

interface ResultCardProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  copyText?: string; // If provided, shows copy button
}

/**
 * ResultCard - Displays a result section with optional copy-to-clipboard functionality.
 * Shows "Copied!" feedback for 2 seconds after copying.
 */
function ResultCard({
  title,
  children,
  isDark,
  copyText,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("OffersBuilder Copy Error:", error);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      {(title || copyText) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3
              className={`text-sm font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {title}
            </h3>
          )}
          {copyText && (
            <button
              onClick={handleCopy}
              className={`text-xs px-2 py-1 rounded transition-colors ml-auto ${
                copied
                  ? "bg-[#29c4a9] text-white"
                  : isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
              )}
        </div>
      )}
      <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
        {children}
      </div>
    </div>
  );
}

export default function OffersBuilderPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<OffersBuilderRequest>(defaultFormValues);
  const [servicesInput, setServicesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OffersBuilderResponse | null>(null);
  const [lastPayload, setLastPayload] =
    useState<OffersBuilderRequest | null>(null);

  // Wizard state (6 steps: business basics → offer details → style → platforms → review)
  const [wizardStep, setWizardStep] = useState(1);
  const totalWizardSteps = 6;

  function updateFormValue<K extends keyof OffersBuilderRequest>(
    key: K,
    value: OffersBuilderRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handlePlatformToggle = (platform: OutputPlatform) => {
    const current = form.outputPlatforms;
    if (current.includes(platform)) {
      updateFormValue(
        "outputPlatforms",
        current.filter((p) => p !== platform)
      );
    } else {
      updateFormValue("outputPlatforms", [...current, platform]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError(null);
    setResult(null);

    // Validation
    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!form.businessType.trim()) {
      setError("Business type is required.");
      return;
    }

    if (!form.promoDescription.trim()) {
      setError("Promotion description is required.");
      return;
    }

    if (form.outputPlatforms.length === 0) {
      setError("At least one output platform must be selected.");
      return;
    }

    setLoading(true);

    try {
      // Convert services string to array (comma-separated input → string[])
      const servicesArray =
        servicesInput.trim() !== ""
          ? servicesInput
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];

      // Prepare payload with clamped variationsCount (1-5) and default hashtagStyle
      const apiPayload: OffersBuilderRequest = {
        ...form,
        services: servicesArray,
        variationsCount: Math.max(1, Math.min(5, form.variationsCount || 1)),
        hashtagStyle: form.hashtagStyle || "Local",
      };

      const res = await fetch("/api/offers-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use status-based message
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const data: OffersBuilderResponse = await res.json();
      setResult(data);
      setLastPayload({ ...form });
    } catch (error) {
      console.error("OffersBuilder Submit Error:", error);
      // Extract error message from API response if available
      let errorMessage = "An error occurred while generating offers. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
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
    setServicesInput("");
    setResult(null);
    setError(null);
    setWizardStep(1);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWizardNext = () => {
    // Validation before proceeding
    if (wizardStep === 1) {
      // Step 1: Business Basics
      if (!form.businessName.trim()) {
        setError("Business name is required.");
        return;
      }
      if (!form.businessType.trim()) {
        setError("Business type is required.");
        return;
      }
      setError(null);
    } else if (wizardStep === 2) {
      // Step 2: Offer Basics
      if (!form.promoDescription.trim()) {
        setError("Promotion description is required.");
        return;
      }
      setError(null);
    } else if (wizardStep === 5) {
      // Step 5: Platforms & Options
      if (form.outputPlatforms.length === 0) {
        setError("At least one output platform must be selected.");
        return;
      }
      setError(null);
    }

    if (wizardStep < totalWizardSteps) {
      setWizardStep(wizardStep + 1);
      // Scroll to top of form when moving to next step
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  // Render wizard step content
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        // Business Basics - collect business info first
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 1: Business Basics
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-businessName"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Business Name *
              </label>
              <input
                type="text"
                id="wizard-businessName"
                value={form.businessName}
                onChange={(e) =>
                  updateFormValue("businessName", e.target.value)
                }
                className={getInputClasses(isDark)}
                placeholder="e.g., Ocala Coffee Shop"
                required
              />
            </div>

            <div>
              <label
                htmlFor="wizard-businessType"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Business Type *
              </label>
              <input
                type="text"
                id="wizard-businessType"
                value={form.businessType}
                onChange={(e) =>
                  updateFormValue("businessType", e.target.value)
                }
                className={getInputClasses(isDark)}
                placeholder="e.g., Restaurant, Retail, Service"
                required
              />
            </div>

            <div>
              <label
                htmlFor="wizard-services"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Services (Optional)
              </label>
              <textarea
                id="wizard-services"
                value={servicesInput}
                onChange={(e) => setServicesInput(e.target.value)}
                rows={3}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Comma-separated: e.g., Pressure washing, Driveway cleaning"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="wizard-city"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  City
                </label>
                <input
                  type="text"
                  id="wizard-city"
                  value={form.city}
                  onChange={(e) => updateFormValue("city", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Ocala"
                />
              </div>

              <div>
                <label
                  htmlFor="wizard-state"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  State
                </label>
                <input
                  type="text"
                  id="wizard-state"
                  value={form.state}
                  onChange={(e) => updateFormValue("state", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Florida"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 2: Offer Basics
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-promoType"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Promotion Type
              </label>
              <select
                id="wizard-promoType"
                value={form.promoType}
                onChange={(e) =>
                  updateFormValue("promoType", e.target.value as PromoType)
                }
                className={getInputClasses(isDark)}
              >
                {PROMO_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="wizard-promoDescription"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Promotion Description *
              </label>
              <textarea
                id="wizard-promoDescription"
                value={form.promoDescription}
                onChange={(e) =>
                  updateFormValue("promoDescription", e.target.value)
                }
                rows={4}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Describe the offer, who it's for, and what makes it special."
                required
              />
            </div>

            <div>
              <label
                htmlFor="wizard-offerValue"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Offer Value (Optional)
              </label>
              <input
                type="text"
                id="wizard-offerValue"
                value={form.offerValue}
                onChange={(e) => updateFormValue("offerValue", e.target.value)}
                className={getInputClasses(isDark)}
                placeholder='e.g., "20% off dinner", "$50 off service"'
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="wizard-startDate"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  id="wizard-startDate"
                  value={form.startDate}
                  onChange={(e) => updateFormValue("startDate", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label
                  htmlFor="wizard-endDate"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  id="wizard-endDate"
                  value={form.endDate}
                  onChange={(e) => updateFormValue("endDate", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="wizard-goal"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Goal (Optional)
              </label>
              <input
                type="text"
                id="wizard-goal"
                value={form.goal}
                onChange={(e) => updateFormValue("goal", e.target.value)}
                className={getInputClasses(isDark)}
                placeholder="e.g., drive bookings, increase walk-ins"
              />
            </div>

            <div>
              <label
                htmlFor="wizard-targetAudience"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Target Audience (Optional)
              </label>
              <input
                type="text"
                id="wizard-targetAudience"
                value={form.targetAudience}
                onChange={(e) =>
                  updateFormValue("targetAudience", e.target.value)
                }
                className={getInputClasses(isDark)}
                placeholder="e.g., families, horse owners, Ocala locals"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 3: Headline Direction
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-length"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Content Length
              </label>
              <select
                id="wizard-length"
                value={form.length}
                onChange={(e) =>
                  updateFormValue(
                    "length",
                    e.target.value as "Short" | "Medium" | "Long"
                  )
                }
                className={getInputClasses(isDark)}
              >
                <option value="Short">Short</option>
                <option value="Medium">Medium</option>
                <option value="Long">Long</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="wizard-personalityStyle"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Personality Style
              </label>
              <select
                id="wizard-personalityStyle"
                value={form.personalityStyle}
                onChange={(e) =>
                  updateFormValue(
                    "personalityStyle",
                    e.target.value as PersonalityStyle
                  )
                }
                className={getInputClasses(isDark)}
              >
                <option value="None">None</option>
                <option value="Soft">Soft</option>
                <option value="Bold">Bold</option>
                <option value="High-Energy">High-Energy</option>
                <option value="Luxury">Luxury</option>
              </select>
              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                Sets the tone and style of your promotional content.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 4: Body & Story
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-brandVoice"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Brand Voice (Optional)
              </label>
              <textarea
                id="wizard-brandVoice"
                value={form.brandVoice}
                onChange={(e) => updateFormValue("brandVoice", e.target.value)}
                rows={4}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Paste 2–4 sentences that sound like your existing brand voice. This will override the personality style."
              />
            </div>

            <div>
              <label
                htmlFor="wizard-language"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Language
              </label>
              <select
                id="wizard-language"
                value={form.language}
                onChange={(e) =>
                  updateFormValue("language", e.target.value as LanguageOption)
                }
                className={getInputClasses(isDark)}
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="Bilingual">Bilingual</option>
              </select>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 5: Platforms & Options
            </OBDHeading>
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Output Platforms *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PLATFORM_OPTIONS.map((platform) => (
                  <label
                    key={platform}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      form.outputPlatforms.includes(platform)
                        ? isDark
                          ? "border-[#29c4a9] bg-[#29c4a9]/10"
                          : "border-[#29c4a9] bg-[#29c4a9]/5"
                        : isDark
                        ? "border-slate-700 hover:bg-slate-800"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.outputPlatforms.includes(platform)}
                      onChange={() => handlePlatformToggle(platform)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className={`text-xs ${themeClasses.labelText}`}>
                      {PLATFORM_ICONS[platform]} {platform}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-2 ${themeClasses.labelText}`}
              >
                <input
                  type="checkbox"
                  checked={form.includeHashtags}
                  onChange={(e) =>
                    updateFormValue("includeHashtags", e.target.checked)
                  }
                  className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                />
                <span className="text-sm">Include hashtags</span>
              </label>

              {form.includeHashtags && (
                <div className="ml-6">
                  <label
                    htmlFor="wizard-hashtagStyle"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Hashtag Style
                  </label>
                  <select
                    id="wizard-hashtagStyle"
                    value={form.hashtagStyle || "Local"}
                    onChange={(e) =>
                      updateFormValue("hashtagStyle", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                  >
                    <option value="Local">Local</option>
                    <option value="Branded">Branded</option>
                    <option value="Minimal">Minimal</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="wizard-variationsCount"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  Number of Variations (1–5)
                </label>
                <input
                  type="number"
                  id="wizard-variationsCount"
                  min={1}
                  max={5}
                  value={form.variationsCount}
                  onChange={(e) =>
                    updateFormValue(
                      "variationsCount",
                      Math.max(
                        1,
                        Math.min(5, parseInt(e.target.value) || 1)
                      )
                    )
                  }
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label
                  htmlFor="wizard-variationMode"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  Variation Mode
                </label>
                <select
                  id="wizard-variationMode"
                  value={form.variationMode}
                  onChange={(e) =>
                    updateFormValue(
                      "variationMode",
                      e.target.value as
                        | "Conservative"
                        | "Moderate"
                        | "Creative"
                    )
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Creative">Creative</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 6: Review & Generate
            </OBDHeading>
            <div
              className={`rounded-lg border p-4 ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="space-y-2 text-sm">
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Business:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.businessName || "Not set"}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Business Type:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.businessType || "Not set"}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Promotion Type:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.promoType}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Platforms:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.outputPlatforms.join(", ") || "None selected"}
                  </span>
                </div>
                {form.offerValue && (
                  <div>
                    <span
                      className={`font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Offer Value:
                    </span>{" "}
                    <span className={themeClasses.mutedText}>
                      {form.offerValue}
                    </span>
                  </div>
                )}
                {form.promoDescription && (
                  <div>
                    <span
                      className={`font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Description:
                    </span>{" "}
                    <span className={themeClasses.mutedText}>
                      {form.promoDescription.substring(0, 100)}
                      {form.promoDescription.length > 100 ? "..." : ""}
                    </span>
                  </div>
                )}
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Content Length:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>{form.length}</span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Personality Style:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.personalityStyle}
                  </span>
                </div>
              </div>
            </div>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              Review your selections above. Click "Generate Promotional Offers"
              to create your multi-platform promotional content.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Offers & Promotions Builder"
      tagline="Create high-converting promotional offers with headlines, body copy, social posts, and Google Business Profile updates—all in one step."
    >
      {/* Wizard Mode Toggle */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={`text-sm font-medium mb-1 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Form Mode
            </h3>
            <p className={`text-xs ${themeClasses.mutedText}`}>
              {form.wizardMode
                ? "Step through Offer → Headlines → Copy → Social Posts → GBP Post → Graphic Prompt."
                : "Use the wizard for step-by-step guidance, or use the standard form for full control."}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-sm ${themeClasses.labelText}`}>Standard</span>
            <input
              type="checkbox"
              checked={form.wizardMode}
              onChange={(e) => {
                updateFormValue("wizardMode", e.target.checked);
                if (!e.target.checked) setWizardStep(1);
              }}
              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
            />
            <span className={`text-sm ${themeClasses.labelText}`}>Wizard</span>
          </label>
        </div>
      </OBDPanel>

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        {form.wizardMode ? (
          <div>
            {/* Wizard Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                  Step {wizardStep} of {totalWizardSteps}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-[#29c4a9] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(wizardStep / totalWizardSteps) * 100}%` }}
                />
              </div>
            </div>

            {renderWizardStep()}

            {/* Wizard Navigation */}
            <div className={`flex justify-between mt-6 pt-6 ${getDividerClass(isDark)}`}>
              <button
                type="button"
                onClick={handleWizardBack}
                disabled={wizardStep === 1}
                className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleWizardNext}
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                  {wizardStep === totalWizardSteps
                    ? loading
                      ? "Generating..."
                      : "Generate Promotional Offers"
                    : "Next"}
              </button>
            </div>
          </div>
        ) : (
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
                      placeholder="e.g., Ocala Coffee Shop"
                      required
                    />
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
                      value={servicesInput}
                      onChange={(e) => setServicesInput(e.target.value)}
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Comma-separated: e.g., Pressure washing, Driveway cleaning, Deck staining"
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
                        onChange={(e) =>
                          updateFormValue("state", e.target.value)
                        }
                        className={getInputClasses(isDark)}
                        placeholder="Florida"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)} />

              {/* Promotion Details */}
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Promotion Details
                </OBDHeading>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="promoType"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Promotion Type
                    </label>
                    <select
                      id="promoType"
                      value={form.promoType}
                      onChange={(e) =>
                        updateFormValue("promoType", e.target.value as PromoType)
                      }
                      className={getInputClasses(isDark)}
                    >
                      {PROMO_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="promoTitle"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Promo Title (Optional)
                    </label>
                    <input
                      type="text"
                      id="promoTitle"
                      value={form.promoTitle}
                      onChange={(e) =>
                        updateFormValue("promoTitle", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="Internal name for this promotion"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="promoDescription"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Promotion Description *
                    </label>
                    <textarea
                      id="promoDescription"
                      value={form.promoDescription}
                      onChange={(e) =>
                        updateFormValue("promoDescription", e.target.value)
                      }
                      rows={4}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Describe the offer, who it's for, and what makes it special."
                      required
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Describe the offer, who it's for, and what makes it
                      special.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="offerValue"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Offer Value (Optional)
                    </label>
                    <input
                      type="text"
                      id="offerValue"
                      value={form.offerValue}
                      onChange={(e) =>
                        updateFormValue("offerValue", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder='e.g., "20% off dinner", "$50 off service"'
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="offerCode"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Coupon/Offer Code (Optional)
                    </label>
                    <input
                      type="text"
                      id="offerCode"
                      value={form.offerCode}
                      onChange={(e) =>
                        updateFormValue("offerCode", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="e.g., SAVE20, SPRING2024"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="startDate"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Start Date (Optional)
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={form.startDate}
                        onChange={(e) =>
                          updateFormValue("startDate", e.target.value)
                        }
                        className={getInputClasses(isDark)}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="endDate"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={form.endDate}
                        onChange={(e) =>
                          updateFormValue("endDate", e.target.value)
                        }
                        className={getInputClasses(isDark)}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="goal"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Promotion Goal (Optional)
                    </label>
                    <input
                      type="text"
                      id="goal"
                      value={form.goal}
                      onChange={(e) => updateFormValue("goal", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., drive bookings, increase walk-ins, clear inventory"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="targetAudience"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Target Audience (Optional)
                    </label>
                    <input
                      type="text"
                      id="targetAudience"
                      value={form.targetAudience}
                      onChange={(e) =>
                        updateFormValue("targetAudience", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="e.g., families, horse owners, Ocala locals, new customers"
                    />
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)} />

              {/* Platforms & Style */}
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Platforms & Style
                </OBDHeading>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Output Platforms *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {PLATFORM_OPTIONS.map((platform) => (
                        <label
                          key={platform}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            form.outputPlatforms.includes(platform)
                              ? isDark
                                ? "border-[#29c4a9] bg-[#29c4a9]/10"
                                : "border-[#29c4a9] bg-[#29c4a9]/5"
                              : isDark
                              ? "border-slate-700 hover:bg-slate-800"
                              : "border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.outputPlatforms.includes(platform)}
                            onChange={() => handlePlatformToggle(platform)}
                            className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className={`text-xs ${themeClasses.labelText}`}>
                            {PLATFORM_ICONS[platform]} {platform}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

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
                      onChange={(e) =>
                        updateFormValue("brandVoice", e.target.value)
                      }
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="personalityStyle"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Personality Style
                    </label>
                    <select
                      id="personalityStyle"
                      value={form.personalityStyle}
                      onChange={(e) =>
                        updateFormValue(
                          "personalityStyle",
                          e.target.value as PersonalityStyle
                        )
                      }
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
                    <label
                      htmlFor="length"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Content Length
                    </label>
                    <select
                      id="length"
                      value={form.length}
                      onChange={(e) =>
                        updateFormValue(
                          "length",
                          e.target.value as "Short" | "Medium" | "Long"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                      <option value="Long">Long</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="language"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Language
                    </label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(e) =>
                        updateFormValue("language", e.target.value as LanguageOption)
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Bilingual">Bilingual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)} />

              {/* Hashtags & Variations */}
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Hashtags & Variations
                </OBDHeading>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      className={`flex items-center gap-2 ${themeClasses.labelText}`}
                    >
                      <input
                        type="checkbox"
                        checked={form.includeHashtags}
                        onChange={(e) =>
                          updateFormValue("includeHashtags", e.target.checked)
                        }
                        className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      />
                      <span className="text-sm">Include hashtags</span>
                    </label>

                    {form.includeHashtags && (
                      <div className="ml-6">
                        <label
                          htmlFor="hashtagStyle"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Hashtag Style
                        </label>
                        <select
                          id="hashtagStyle"
                          value={form.hashtagStyle || "Local"}
                          onChange={(e) =>
                            updateFormValue("hashtagStyle", e.target.value)
                          }
                          className={getInputClasses(isDark)}
                        >
                          <option value="Local">Local</option>
                          <option value="Branded">Branded</option>
                          <option value="Minimal">Minimal</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="variationsCount"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Number of Variations (1–5)
                    </label>
                    <input
                      type="number"
                      id="variationsCount"
                      min={1}
                      max={5}
                      value={form.variationsCount}
                      onChange={(e) =>
                        updateFormValue(
                          "variationsCount",
                          Math.max(
                            1,
                            Math.min(5, parseInt(e.target.value) || 1)
                          )
                        )
                      }
                      className={getInputClasses(isDark)}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="variationMode"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Variation Mode
                    </label>
                    <select
                      id="variationMode"
                      value={form.variationMode}
                      onChange={(e) =>
                        updateFormValue(
                          "variationMode",
                          e.target.value as
                            | "Conservative"
                            | "Moderate"
                            | "Creative"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="Conservative">Conservative</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Creative">Creative</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {loading ? "Generating Offers..." : "Generate Promotional Offers"}
              </button>
            </div>
          </form>
        )}
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Results */}
      {result && (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Generated Promotional Content
            </OBDHeading>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className={themeClasses.mutedText}>
                Generating promotional content...
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {/* Offer Summary */}
              {/* Offer Summary Section */}
              <div>
                <h3
                  className={`text-base font-semibold mb-3 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Offer Summary
                </h3>
                <ResultCard
                  title=""
                  isDark={isDark}
                  copyText={`${result.offerSummary.headline}\n\n${result.offerSummary.subheadline}\n\n${result.offerSummary.fullPitch}`}
                >
                  <div className="space-y-4">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Headline
                      </p>
                      <p
                        className={`font-semibold text-lg ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {result.offerSummary.headline}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Subheadline
                      </p>
                      <p
                        className={`text-sm italic ${
                          isDark ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        {result.offerSummary.subheadline}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-lg border ${
                        isDark
                          ? "bg-slate-900/50 border-slate-700"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Short Pitch
                      </p>
                      <p>{result.offerSummary.shortPitch}</p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Full Pitch
                      </p>
                      <p className="whitespace-pre-wrap">
                        {result.offerSummary.fullPitch}
                      </p>
                    </div>
                  </div>
                </ResultCard>
              </div>

              {/* Copy Options Section */}
              {(result.headlineOptions.length > 0 ||
                result.bodyOptions.length > 0) && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-3 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Copy Options
                  </h3>

                  {/* Headline Options */}
                  {result.headlineOptions.length > 0 && (
                    <ResultCard title="Headline Options" isDark={isDark}>
                      <div className="space-y-4">
                        {result.headlineOptions.map((option, idx) => (
                          <div key={idx}>
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {option.label}
                            </p>
                            <p>{option.headline}</p>
                          </div>
                        ))}
                      </div>
                    </ResultCard>
                  )}

                  {/* Body Options */}
                  {result.bodyOptions.length > 0 && (
                    <div className="mt-4">
                      <ResultCard
                        title="Body Copy Options"
                        isDark={isDark}
                      >
                      <div className="space-y-4">
                        {result.bodyOptions.map((option, idx) => (
                          <div key={idx}>
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {option.label}
                            </p>
                            <p className="whitespace-pre-wrap">{option.body}</p>
                          </div>
                        ))}
                      </div>
                    </ResultCard>
                    </div>
                  )}
                </div>
              )}

              {/* Social Posts Section */}
              {result.socialPosts.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Social Media Posts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.socialPosts.map((post, idx) => {
                      const fullText = `${post.headline}\n\n${post.mainCopy}\n\n${post.callToAction}${
                        post.hashtags && post.hashtags.length > 0
                          ? `\n\n${post.hashtags.join(" ")}`
                          : ""
                      }`;
                      return (
                        <ResultCard
                          key={idx}
                          title={`${PLATFORM_ICONS[post.platform as OutputPlatform] || ""} ${post.platform}`}
                          isDark={isDark}
                          copyText={fullText}
                        >
                          <div className="space-y-3">
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Headline
                              </p>
                              <p className="font-medium">{post.headline}</p>
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Body Copy
                              </p>
                              <p className="whitespace-pre-wrap">{post.mainCopy}</p>
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Call to Action
                              </p>
                              <p className="font-medium">{post.callToAction}</p>
                            </div>
                            {post.hashtags && post.hashtags.length > 0 && (
                              <div>
                                <p
                                  className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                    isDark ? "text-slate-400" : "text-slate-500"
                                  }`}
                                >
                                  Hashtags
                                </p>
                                <p className={`text-xs opacity-75 ${themeClasses.mutedText}`}>
                                  {post.hashtags.join(" ")}
                                </p>
                              </div>
                            )}
                            {post.notes && (
                              <p
                                className={`text-xs italic mt-2 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                {post.notes}
                              </p>
                            )}
                          </div>
                        </ResultCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Deep Copy Sections */}
              {(result.gbpPost ||
                result.email ||
                result.sms ||
                result.websiteBanner ||
                result.graphicPrompt) && (
                <>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Deep Copy Sections
                  </h3>
                </>
              )}

              {/* GBP Post */}
              {result.gbpPost && (
                <ResultCard
                  title={`${PLATFORM_ICONS["Google Business Profile"]} Google Business Profile Post`}
                  isDark={isDark}
                  copyText={`${result.gbpPost.headline}\n\n${result.gbpPost.description}\n\n${result.gbpPost.suggestedCTA}`}
                >
                  <div className="space-y-3">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Headline
                      </p>
                      <p className="font-medium">{result.gbpPost.headline}</p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Description
                      </p>
                      <p className="whitespace-pre-wrap">
                        {result.gbpPost.description}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Call to Action
                      </p>
                      <p>{result.gbpPost.suggestedCTA}</p>
                    </div>
                  </div>
                </ResultCard>
              )}

              {/* Email */}
              {result.email && (
                <ResultCard
                  title={`${PLATFORM_ICONS.Email} Email Campaign`}
                  isDark={isDark}
                  copyText={`Subject: ${result.email.subject}\n\nPreview: ${result.email.previewText}\n\n${result.email.body}`}
                >
                  <div className="space-y-4">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Subject
                      </p>
                      <p>{result.email.subject}</p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Preview Text
                      </p>
                      <p className="text-xs italic">{result.email.previewText}</p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Body
                      </p>
                      <p className="whitespace-pre-wrap">{result.email.body}</p>
                    </div>
                  </div>
                </ResultCard>
              )}

              {/* SMS */}
              {result.sms && (
                <ResultCard
                  title={`${PLATFORM_ICONS.SMS} SMS Message`}
                  isDark={isDark}
                  copyText={result.sms.message}
                >
                  <p className="whitespace-pre-wrap">{result.sms.message}</p>
                  <p
                    className={`text-xs mt-2 ${themeClasses.mutedText}`}
                  >
                    Length: {result.sms.message.length} characters
                  </p>
                </ResultCard>
              )}

              {/* Website Banner */}
              {result.websiteBanner && (
                <ResultCard
                  title={`${PLATFORM_ICONS["Website Banner"]} Website Banner`}
                  isDark={isDark}
                  copyText={`${result.websiteBanner.headline}\n\n${result.websiteBanner.subheadline}\n\nButton: ${result.websiteBanner.buttonText}`}
                >
                  <div className="space-y-4">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Preview
                      </p>
                      <div
                        className={`rounded-lg border-2 p-6 text-center ${
                          isDark
                            ? "bg-slate-900/50 border-[#29c4a9]"
                            : "bg-white border-[#29c4a9]"
                        }`}
                      >
                        <h4
                          className={`text-xl font-bold mb-2 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {result.websiteBanner.headline}
                        </h4>
                        <p
                          className={`mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                        >
                          {result.websiteBanner.subheadline}
                        </p>
                        <button
                          className={`px-6 py-2 rounded-lg font-medium ${
                            isDark
                              ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                              : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                          }`}
                        >
                          {result.websiteBanner.buttonText}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Headline
                      </p>
                      <p>{result.websiteBanner.headline}</p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Subheadline
                      </p>
                      <p>{result.websiteBanner.subheadline}</p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Button Text
                      </p>
                      <p>{result.websiteBanner.buttonText}</p>
                    </div>
                  </div>
                </ResultCard>
              )}

              {/* Graphic Prompt */}
              {result.graphicPrompt && (
                <ResultCard
                  title="Graphic / Design Prompt"
                  isDark={isDark}
                  copyText={result.graphicPrompt}
                >
                  <p className="whitespace-pre-wrap">{result.graphicPrompt}</p>
                  <p
                    className={`text-xs mt-2 italic ${themeClasses.mutedText}`}
                  >
                    Use this prompt with AI image generators like DALL-E,
                    Midjourney, or Canva AI
                  </p>
                </ResultCard>
              )}

              {/* Variations */}
              {result.variations && result.variations.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Alternate Variations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.variations.map((variation, idx) => {
                      const fullText = `${variation.headline}\n\n${variation.mainCopy}\n\n${variation.callToAction}${
                        variation.hashtags && variation.hashtags.length > 0
                          ? `\n\n${variation.hashtags.join(" ")}`
                          : ""
                      }`;
                      return (
                        <ResultCard
                          key={idx}
                          title={`Alternate Promo #${idx + 1} - ${variation.platform}`}
                          isDark={isDark}
                          copyText={fullText}
                        >
                          <div className="space-y-3">
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Headline
                              </p>
                              <p className="font-medium">{variation.headline}</p>
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Body Copy
                              </p>
                              <p className="whitespace-pre-wrap">
                                {variation.mainCopy}
                              </p>
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Call to Action
                              </p>
                              <p className="font-medium">{variation.callToAction}</p>
                            </div>
                            {variation.hashtags &&
                              variation.hashtags.length > 0 && (
                                <div>
                                  <p
                                    className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                      isDark ? "text-slate-400" : "text-slate-500"
                                    }`}
                                  >
                                    Hashtags
                                  </p>
                                  <p
                                    className={`text-xs opacity-75 ${themeClasses.mutedText}`}
                                  >
                                    {variation.hashtags.join(" ")}
                                  </p>
                                </div>
                              )}
                          </div>
                        </ResultCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.meta.warnings && result.meta.warnings.length > 0 && (
                <div
                  className={`rounded-xl border p-4 ${
                    isDark
                      ? "bg-amber-950/20 border-amber-800"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-amber-200" : "text-amber-800"
                    }`}
                  >
                    ⚠️ Warnings
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {result.meta.warnings.map((warning, idx) => (
                      <li
                        key={idx}
                        className={`text-sm ${
                          isDark ? "text-amber-100" : "text-amber-700"
                        }`}
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </OBDPanel>
      )}

      {!result && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-8">
          <p
            className={`italic obd-soft-text text-center py-8 ${
              isDark ? "text-slate-500" : "text-gray-400"
            }`}
          >
            Fill out the form above and click "Generate Promotional Offers" to
            create your multi-platform promotional content.
          </p>
        </OBDPanel>
      )}

      {/* Sticky Bottom Action Bar */}
      {result && !loading && (
        <div
          className={`sticky bottom-0 left-0 right-0 z-10 mt-12 border-t ${
            isDark
              ? "bg-slate-950 border-slate-800"
              : "bg-white border-slate-200"
          } shadow-lg`}
        >
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className={`px-6 py-2.5 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Regenerate with Same Inputs
              </button>
              <button
                onClick={handleStartNew}
                className={`px-6 py-2.5 font-medium rounded-xl transition-colors ${
                  isDark
                    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                }`}
              >
                Start New Promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}