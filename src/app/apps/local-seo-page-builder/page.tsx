"use client";

import { useState, useEffect } from "react";
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
  LocalSEOPageBuilderRequest,
  LocalSEOPageBuilderResponse,
  TargetAudience,
  OutputFormat,
  TonePreset,
} from "./types";

const STORAGE_KEY = "obd.v3.localSEOPageBuilder.form";
const USE_BRAND_PROFILE_KEY = "obd.v3.useBrandProfile";

const defaultFormValues: LocalSEOPageBuilderRequest = {
  businessName: "",
  businessType: "",
  primaryService: "",
  city: "Ocala",
  state: "Florida",
  secondaryServices: [],
  neighborhoods: [],
  targetAudience: "Both",
  uniqueSellingPoints: "",
  ctaPreference: "",
  phone: "",
  websiteUrl: "",
  pageUrl: "",
  outputFormat: "PlainText",
  includeSchema: false,
  tonePreset: "Professional",
};

export default function LocalSEOPageBuilderPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<LocalSEOPageBuilderRequest>(defaultFormValues);
  const [secondaryServicesInput, setSecondaryServicesInput] = useState("");
  const [neighborhoodsInput, setNeighborhoodsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocalSEOPageBuilderResponse | null>(null);
  const [useBrandProfile, setUseBrandProfile] = useState(true);
  const [brandProfileLoaded, setBrandProfileLoaded] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [lastPayload, setLastPayload] = useState<LocalSEOPageBuilderRequest | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [copyMode, setCopyMode] = useState<"Combined" | "Section Cards">("Combined");

  // Load "use brand profile" preference from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(USE_BRAND_PROFILE_KEY);
      if (stored !== null) {
        setUseBrandProfile(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load useBrandProfile preference:", err);
    }
  }, []);

  // Save "use brand profile" preference to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(USE_BRAND_PROFILE_KEY, JSON.stringify(useBrandProfile));
    } catch (err) {
      console.error("Failed to save useBrandProfile preference:", err);
    }
  }, [useBrandProfile]);

  // Load brand profile on mount
  useEffect(() => {
    if (brandProfileLoaded || !useBrandProfile) {
      setBrandProfileLoaded(true);
      return;
    }

    let mounted = true;
    const loadBrandProfile = async () => {
      try {
        const res = await fetch("/api/brand-profile");
        if (res.ok && mounted) {
          const profile = await res.json();
          if (profile && mounted) {
            const newAutoFilled = new Set<string>();
            setForm((currentForm) => {
              const newForm = { ...currentForm };
              // Only prefill if field is empty
              if (!newForm.businessName && profile.businessName) {
                newForm.businessName = profile.businessName;
                newAutoFilled.add("businessName");
              }
              if (!newForm.businessType && profile.businessType) {
                newForm.businessType = profile.businessType;
                newAutoFilled.add("businessType");
              }
              if (!newForm.city && profile.city) {
                newForm.city = profile.city;
                newAutoFilled.add("city");
              }
              if (!newForm.state && profile.state) {
                newForm.state = profile.state;
                newAutoFilled.add("state");
              }
              // Services - map to secondaryServices if provided
              if ((newForm.secondaryServices?.length ?? 0) === 0 && profile.services) {
                const servicesArray = Array.isArray(profile.services)
                  ? profile.services
                  : typeof profile.services === "string"
                  ? profile.services.split(",").map((s: string) => s.trim()).filter(Boolean)
                  : [];
                if (servicesArray.length > 0) {
                  newForm.secondaryServices = servicesArray;
                  setSecondaryServicesInput(servicesArray.join(", "));
                  newAutoFilled.add("secondaryServices");
                }
              }
              return newForm;
            });
            if (newAutoFilled.size > 0) {
              setAutoFilledFields(newAutoFilled);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load brand profile:", err);
      } finally {
        if (mounted) {
          setBrandProfileLoaded(true);
        }
      }
    };
    loadBrandProfile();
    return () => {
      mounted = false;
    };
  }, [useBrandProfile, brandProfileLoaded]);

  // Save to localStorage whenever form changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch (err) {
      console.error("Failed to save form to localStorage:", err);
    }
  }, [form]);

  // Clear hint chips when user edits auto-filled fields
  const handleFieldChange = <K extends keyof LocalSEOPageBuilderRequest>(
    key: K,
    value: LocalSEOPageBuilderRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (autoFilledFields.has(key)) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSecondaryServicesChange = (value: string) => {
    setSecondaryServicesInput(value);
    if (autoFilledFields.has("secondaryServices")) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete("secondaryServices");
        return next;
      });
    }
  };

  const handleNeighborhoodsChange = (value: string) => {
    setNeighborhoodsInput(value);
    if (autoFilledFields.has("neighborhoods")) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete("neighborhoods");
        return next;
      });
    }
  };

  // Check if pageUrl is valid for schema toggle
  const isPageUrlValid = form.pageUrl && form.pageUrl.trim() !== "" && (() => {
    try {
      new URL(form.pageUrl);
      return true;
    } catch {
      return false;
    }
  })();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (loading) return;

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

    if (!form.primaryService.trim()) {
      setError("Primary service is required.");
      return;
    }

    if (!form.city.trim()) {
      setError("City is required.");
      return;
    }

    if (!form.state.trim()) {
      setError("State is required.");
      return;
    }

    // Validate websiteUrl if provided
    if (form.websiteUrl && form.websiteUrl.trim()) {
      try {
        new URL(form.websiteUrl);
      } catch {
        setError("Please enter a valid website URL (e.g., https://example.com).");
        return;
      }
    }

    // Validate pageUrl if provided
    if (form.pageUrl && form.pageUrl.trim()) {
      try {
        new URL(form.pageUrl);
      } catch {
        setError("Please enter a valid page URL (e.g., https://example.com/service-page).");
        return;
      }
    }

    setLoading(true);

    try {
      // Convert inputs to arrays
      const secondaryServicesArray =
        secondaryServicesInput.trim() !== ""
          ? secondaryServicesInput
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];

      const neighborhoodsArray =
        neighborhoodsInput.trim() !== ""
          ? neighborhoodsInput
              .split(",")
              .map((n) => n.trim())
              .filter((n) => n.length > 0)
          : [];

      const apiPayload: LocalSEOPageBuilderRequest = {
        ...form,
        secondaryServices: secondaryServicesArray.length > 0 ? secondaryServicesArray : undefined,
        neighborhoods: neighborhoodsArray.length > 0 ? neighborhoodsArray : undefined,
      };

      const res = await fetch("/api/local-seo-page-builder", {
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
          if (errorData.requestId) {
            console.error("Request ID:", errorData.requestId);
          }
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json();

      if (response.ok && response.data) {
        setResult(response.data);
        setLastPayload(apiPayload);
        setTimeout(() => {
          const resultsElement = document.getElementById("seo-page-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.ok === false && response.error) {
        if (response.requestId) {
          console.error("Request ID:", response.requestId);
        }
        throw new Error(response.error);
      } else {
        setResult(response);
      }
    } catch (error) {
      console.error("Local SEO Page Builder Submit Error:", error);
      let errorMessage = "Something went wrong while generating your SEO page content. Please try again.";
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
    if (!lastPayload || loading) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/local-seo-page-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lastPayload),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${res.status}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json();

      if (response.ok && response.data) {
        setResult(response.data);
        setTimeout(() => {
          const resultsElement = document.getElementById("seo-page-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.ok === false && response.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Regenerate Error:", error);
      let errorMessage = "Something went wrong while regenerating. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTxt = () => {
    if (!result) return;

    let text = `LOCAL SEO PAGE BUILDER OUTPUT\n`;
    text += `Generated: ${new Date(result.meta.createdAtISO).toLocaleString()}\n`;
    text += `Request ID: ${result.meta.requestId}\n\n`;
    text += "=".repeat(50) + "\n\n";

    text += `SEO PACK\n${"-".repeat(50)}\n`;
    text += `Meta Title: ${result.seoPack.metaTitle}\n`;
    text += `Meta Description: ${result.seoPack.metaDescription}\n`;
    text += `Slug: ${result.seoPack.slug}\n`;
    text += `H1: ${result.seoPack.h1}\n\n`;

    text += `FULL PAGE COPY\n${"-".repeat(50)}\n`;
    text += `${result.pageCopy}\n\n`;

    text += `FAQ SECTION\n${"-".repeat(50)}\n`;
    result.faqs.forEach((faq, i) => {
      text += `Q${i + 1}: ${faq.question}\n`;
      text += `A${i + 1}: ${faq.answer}\n\n`;
    });

    // Download
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Sanitize filename: remove special characters, limit length
    const safeName = form.businessName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 50);
    a.download = `seo-page-${safeName || "page"}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success toast
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleExportHtml = () => {
    if (!result || form.outputFormat !== "HTML") return;

    // HTML escape function for meta tags
    const escapeHtml = (text: string): string => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    let html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n`;
    html += `  <meta charset="UTF-8">\n`;
    html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
    html += `  <title>${escapeHtml(result.seoPack.metaTitle)}</title>\n`;
    html += `  <meta name="description" content="${escapeHtml(result.seoPack.metaDescription)}">\n`;
    html += `</head>\n<body>\n`;
    html += result.pageCopy;
    html += `\n\n<h2>Frequently Asked Questions</h2>\n`;
    result.faqs.forEach((faq) => {
      html += `\n<h3>${faq.question}</h3>\n`;
      html += `<p>${faq.answer}</p>\n`;
    });
    html += `\n</body>\n</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Sanitize filename: remove special characters, limit length
    const safeName = form.businessName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 50);
    a.download = `seo-page-${safeName || "page"}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success toast
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleExportJson = () => {
    if (!result || !result.schemaJsonLd) return;

    try {
      const schemaData = JSON.parse(result.schemaJsonLd);
      const json = JSON.stringify(schemaData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Sanitize filename: remove special characters, limit length
      const safeName = form.businessName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 50);
      a.download = `schema-${safeName || "page"}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export schema JSON:", err);
      setError("Failed to export schema. Please try again.");
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Local SEO Page Builder"
      tagline="Generate a complete local landing page pack for a service + city."
    >
      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between mb-6">
          <OBDHeading level={2} isDark={isDark}>
            Page Details
          </OBDHeading>
        </div>

        {/* Use saved brand profile toggle */}
        <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
            <input
              type="checkbox"
              checked={useBrandProfile}
              onChange={(e) => setUseBrandProfile(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Use saved Brand Profile
            </span>
          </label>
          <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
            When enabled, your saved brand profile will auto-fill business details if fields are empty.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Business Basics */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Business Basics
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Name <span className="text-red-500">*</span>
                    {autoFilledFields.has("businessName") && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        From Brand Profile
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) => handleFieldChange("businessName", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="businessType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Type <span className="text-red-500">*</span>
                    {autoFilledFields.has("businessType") && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        From Brand Profile
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={form.businessType}
                    onChange={(e) => handleFieldChange("businessType", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="primaryService"
                    className={`flex items-center gap-2 text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    <span>
                      Primary Service <span className="text-red-500">*</span>
                    </span>
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs cursor-help ${
                        isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                      title="This becomes your main page keyword (H1 + title). Be specific."
                    >
                      ?
                    </span>
                  </label>
                  <input
                    type="text"
                    id="primaryService"
                    value={form.primaryService}
                    onChange={(e) => handleFieldChange("primaryService", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Pressure washing"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="city"
                      className={`flex items-center gap-2 text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      <span>
                        City <span className="text-red-500">*</span>
                        {autoFilledFields.has("city") && (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            isDark
                              ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                              : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}>
                            From Brand Profile
                          </span>
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs cursor-help ${
                          isDark
                            ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                        title="Used for local SEO targeting and schema location signals."
                      >
                        ?
                      </span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={form.city}
                      onChange={(e) => handleFieldChange("city", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Ocala"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="state"
                      className={`flex items-center gap-2 text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      <span>
                        State <span className="text-red-500">*</span>
                        {autoFilledFields.has("state") && (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            isDark
                              ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                              : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}>
                            From Brand Profile
                          </span>
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs cursor-help ${
                          isDark
                            ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                        title="Used for local SEO targeting and schema location signals."
                      >
                        ?
                      </span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={form.state}
                      onChange={(e) => handleFieldChange("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Additional Details */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Additional Details
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="secondaryServices"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Secondary Services (comma-separated, max 12)
                    {autoFilledFields.has("secondaryServices") && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        From Brand Profile
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="secondaryServices"
                    value={secondaryServicesInput}
                    onChange={(e) => handleSecondaryServicesChange(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Driveway cleaning, window cleaning"
                  />
                </div>

                <div>
                  <label
                    htmlFor="neighborhoods"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Neighborhoods (comma-separated, max 12)
                  </label>
                  <input
                    type="text"
                    id="neighborhoods"
                    value={neighborhoodsInput}
                    onChange={(e) => handleNeighborhoodsChange(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Downtown Ocala, Silver Springs"
                  />
                  {neighborhoodsInput.trim() !== "" && (() => {
                    const parsed = neighborhoodsInput
                      .split(",")
                      .map((n) => n.trim())
                      .filter((n) => n.length > 0);
                    const unique = Array.from(new Set(parsed)).slice(0, 12);
                    return unique.length > 0 ? (
                      <div className={`mt-2 p-3 rounded-lg border ${
                        isDark
                          ? "bg-slate-800/50 border-slate-700"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <p className={`text-xs font-semibold mb-2 ${
                          isDark ? "text-slate-300" : "text-slate-700"
                        }`}>
                          Local areas referenced
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {unique.map((neighborhood, idx) => (
                            <li key={idx} className={`text-xs ${
                              isDark ? "text-slate-400" : "text-slate-600"
                            }`}>
                              {neighborhood}
                            </li>
                          ))}
                        </ul>
                        <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                          These will be referenced naturally in your content and FAQs.
                        </p>
                      </div>
                    ) : null;
                  })()}
                </div>

                <div>
                  <label
                    htmlFor="targetAudience"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Target Audience
                  </label>
                  <select
                    id="targetAudience"
                    value={form.targetAudience || "Both"}
                    onChange={(e) => handleFieldChange("targetAudience", e.target.value as TargetAudience)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="uniqueSellingPoints"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Unique Selling Points
                  </label>
                  <textarea
                    id="uniqueSellingPoints"
                    value={form.uniqueSellingPoints || ""}
                    onChange={(e) => handleFieldChange("uniqueSellingPoints", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="What makes your business stand out?"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ctaPreference"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    CTA Preference
                  </label>
                  <input
                    type="text"
                    id="ctaPreference"
                    value={form.ctaPreference || ""}
                    onChange={(e) => handleFieldChange("ctaPreference", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Call now, Request a quote"
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Used for buttons and closing call-to-action sections.
                  </p>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Output Format */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Output Format
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="outputFormat"
                    className={`flex items-center gap-2 text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    <span>Format</span>
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs cursor-help ${
                        isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                      title="Choose based on how you plan to paste this content into your site."
                    >
                      ?
                    </span>
                  </label>
                  <select
                    id="outputFormat"
                    value={form.outputFormat || "PlainText"}
                    onChange={(e) => handleFieldChange("outputFormat", e.target.value as OutputFormat)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="PlainText">Plain Text</option>
                    <option value="WordPress">WordPress</option>
                    <option value="HTML">HTML</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="copyMode"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Copy Mode
                  </label>
                  <select
                    id="copyMode"
                    value={copyMode}
                    onChange={(e) => setCopyMode(e.target.value as "Combined" | "Section Cards")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Combined">Combined</option>
                    <option value="Section Cards">Section Cards</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="tonePreset"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Copy Tone
                  </label>
                  <select
                    id="tonePreset"
                    value={form.tonePreset || "Professional"}
                    onChange={(e) => handleFieldChange("tonePreset", e.target.value as TonePreset)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Professional">Professional</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Direct">Direct</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Contact & Schema */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Contact & Schema
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="phone"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={form.phone || ""}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="(352) 555-1234"
                  />
                </div>

                <div>
                  <label
                    htmlFor="websiteUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="websiteUrl"
                    value={form.websiteUrl || ""}
                    onChange={(e) => handleFieldChange("websiteUrl", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pageUrl"
                    className={`flex items-center gap-2 text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    <span>Page URL (recommended for schema)</span>
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs cursor-help ${
                        isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                      title="Used by search engines to connect this content to a real page."
                    >
                      ?
                    </span>
                  </label>
                  <input
                    type="url"
                    id="pageUrl"
                    value={form.pageUrl || ""}
                    onChange={(e) => handleFieldChange("pageUrl", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com/pressure-washing-ocala-florida"
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Full URL of the page where this content will be published
                  </p>
                </div>

                <div>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText} ${!isPageUrlValid ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      checked={form.includeSchema || false}
                      onChange={(e) => handleFieldChange("includeSchema", e.target.checked)}
                      className="rounded"
                      disabled={!isPageUrlValid}
                    />
                    <span className="text-sm font-medium">
                      Include Schema Bundle
                    </span>
                  </label>
                  {!isPageUrlValid && (
                    <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                      Page URL is required to generate schema. Please enter a valid page URL above.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating SEO Page Content...
                </span>
              ) : (
                "Generate SEO Page Content"
              )}
            </button>
          </div>
        </form>
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Warnings Banner */}
      {result && result.warnings && result.warnings.length > 0 && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className={`p-4 rounded-lg border ${
            isDark
              ? "bg-yellow-900/20 border-yellow-700/50 text-yellow-200"
              : "bg-yellow-50 border-yellow-200 text-yellow-800"
          }`}>
            <p className="font-medium mb-2">⚠️ Warnings</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {result.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        </OBDPanel>
      )}

      {/* Results */}
      {result && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8" id="seo-page-results">
          <div className="flex items-center justify-between mb-6">
            <OBDHeading level={2} isDark={isDark}>
              Your SEO Page Content
            </OBDHeading>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={loading || !lastPayload}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Regenerate
              </button>
              <button
                onClick={handleExportTxt}
                disabled={!result}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Export .txt
              </button>
              {form.outputFormat === "HTML" && (
                <button
                  onClick={handleExportHtml}
                  disabled={!result}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Export .html
                </button>
              )}
              <button
                onClick={handleExportJson}
                disabled={!result || !result.schemaJsonLd}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Export .json
              </button>
            </div>
          </div>

          {/* SEO Readiness Score */}
          {(() => {
            const checks = [
              {
                label: "Meta Title present and ≤ 60 chars",
                passed: result.seoPack.metaTitle.length > 0 && result.seoPack.metaTitle.length <= 60,
              },
              {
                label: "Meta Description present and ≤ 160 chars",
                passed: result.seoPack.metaDescription.length > 0 && result.seoPack.metaDescription.length <= 160,
              },
              {
                label: "H1 present",
                passed: result.seoPack.h1.length > 0,
              },
              {
                label: "City mentioned in content",
                passed: result.pageCopy.toLowerCase().includes(form.city.toLowerCase()),
              },
              {
                label: "FAQ count ≥ 5",
                passed: result.faqs.length >= 5,
              },
              {
                label: form.includeSchema
                  ? result.schemaJsonLd
                    ? "Schema enabled and generated"
                    : "Schema not enabled (page URL missing)."
                  : "Schema not enabled",
                passed: form.includeSchema ? !!result.schemaJsonLd : false,
              },
            ];

            const score = checks.filter((c) => c.passed).length;

            return (
              <div className={`mb-6 p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-200"
              }`}>
                <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
                  SEO Readiness: {score} / 6
                </h3>
                <div className="space-y-2">
                  {checks.map((check, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className={`text-sm mt-0.5 ${
                        check.passed
                          ? isDark ? "text-green-400" : "text-green-600"
                          : isDark ? "text-yellow-400" : "text-yellow-600"
                      }`}>
                        {check.passed ? "✓" : "⚠"}
                      </span>
                      <span className={`text-sm ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Before Publishing Checklist */}
          <div className={`mb-6 p-4 rounded-xl border ${
            isDark
              ? "bg-slate-800/50 border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}>
            <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
              Before Publishing
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className={`text-sm mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  ☐
                </span>
                <span className={`text-sm ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>
                  Paste H1 into page heading
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`text-sm mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  ☐
                </span>
                <span className={`text-sm ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>
                  Add meta title & description in your SEO plugin
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`text-sm mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  ☐
                </span>
                <span className={`text-sm ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>
                  Paste content into your page builder
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`text-sm mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  ☐
                </span>
                <span className={`text-sm ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>
                  Add internal links
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`text-sm mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  ☐
                </span>
                <span className={`text-sm ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>
                  Publish page
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* SEO Pack */}
            <ResultCard
              title="SEO Pack"
              isDark={isDark}
              copyText={`Meta Title: ${result.seoPack.metaTitle}\nMeta Description: ${result.seoPack.metaDescription}\nSlug: ${result.seoPack.slug}\nH1: ${result.seoPack.h1}`}
            >
              <div className="space-y-3">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Meta Title
                  </p>
                  <p className="font-semibold">{result.seoPack.metaTitle}</p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Meta Description
                  </p>
                  <p>{result.seoPack.metaDescription}</p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Slug
                  </p>
                  <p className="font-mono text-sm">{result.seoPack.slug}</p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    H1
                  </p>
                  <p className="font-semibold text-lg">{result.seoPack.h1}</p>
                </div>
              </div>
            </ResultCard>

            {/* Full Page Copy or Section Cards */}
            {copyMode === "Combined" ? (
              <ResultCard
                title="Full Page Copy"
                isDark={isDark}
                copyText={result.pageCopy}
              >
                {form.outputFormat === "HTML" ? (
                  <div className="overflow-x-auto">
                    <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                      <code>{result.pageCopy}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{result.pageCopy}</div>
                )}
              </ResultCard>
            ) : (
              result.pageSections && (
                <>
                  <ResultCard
                    title="Hero"
                    isDark={isDark}
                    copyText={result.pageSections.hero}
                  >
                    {form.outputFormat === "HTML" ? (
                      <div className="overflow-x-auto">
                        <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                          <code>{result.pageSections.hero}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{result.pageSections.hero}</div>
                    )}
                  </ResultCard>

                  <ResultCard
                    title="Intro"
                    isDark={isDark}
                    copyText={result.pageSections.intro}
                  >
                    {form.outputFormat === "HTML" ? (
                      <div className="overflow-x-auto">
                        <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                          <code>{result.pageSections.intro}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{result.pageSections.intro}</div>
                    )}
                  </ResultCard>

                  <ResultCard
                    title="Our Services"
                    isDark={isDark}
                    copyText={result.pageSections.services}
                  >
                    {form.outputFormat === "HTML" ? (
                      <div className="overflow-x-auto">
                        <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                          <code>{result.pageSections.services}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{result.pageSections.services}</div>
                    )}
                  </ResultCard>

                  <ResultCard
                    title="Why Choose Us"
                    isDark={isDark}
                    copyText={result.pageSections.whyChooseUs}
                  >
                    {form.outputFormat === "HTML" ? (
                      <div className="overflow-x-auto">
                        <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                          <code>{result.pageSections.whyChooseUs}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{result.pageSections.whyChooseUs}</div>
                    )}
                  </ResultCard>

                  <ResultCard
                    title="Proudly Serving (Areas)"
                    isDark={isDark}
                    copyText={result.pageSections.areasServed}
                  >
                    {form.outputFormat === "HTML" ? (
                      <div className="overflow-x-auto">
                        <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                          <code>{result.pageSections.areasServed}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{result.pageSections.areasServed}</div>
                    )}
                  </ResultCard>

                  <ResultCard
                    title="Closing CTA"
                    isDark={isDark}
                    copyText={result.pageSections.closingCta}
                  >
                    {form.outputFormat === "HTML" ? (
                      <div className="overflow-x-auto">
                        <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                          <code>{result.pageSections.closingCta}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{result.pageSections.closingCta}</div>
                    )}
                  </ResultCard>
                </>
              )
            )}

            {/* FAQ Section */}
            <ResultCard
              title="FAQ Section"
              isDark={isDark}
              copyText={result.faqs.map((faq, i) => `Q${i + 1}: ${faq.question}\nA${i + 1}: ${faq.answer}`).join("\n\n")}
            >
              <div className="space-y-4">
                {result.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-slate-300 dark:border-slate-600"
                  >
                    <p className="font-semibold mb-2">Q: {faq.question}</p>
                    <p className="text-sm">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </ResultCard>

            {/* Schema Bundle */}
            {result.schemaJsonLd && (
              <ResultCard
                title="Schema Bundle (Optional)"
                isDark={isDark}
                copyText={result.schemaJsonLd}
              >
                <pre className="text-xs overflow-x-auto p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700">
                  <code>{result.schemaJsonLd}</code>
                </pre>
              </ResultCard>
            )}
          </div>
        </OBDPanel>
      )}

      {!result && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">📄</div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Ready to build your SEO page?
            </h3>
            <p className={themeClasses.mutedText}>
              Fill out the form above and click Generate SEO Page Content to create your
              complete local landing page pack.
            </p>
          </div>
        </OBDPanel>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-[#29c4a9] border-[#29c4a9] text-white"
              : "bg-[#29c4a9] border-[#29c4a9] text-white"
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm">
                Download started — ready to paste into your site.
              </p>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}
