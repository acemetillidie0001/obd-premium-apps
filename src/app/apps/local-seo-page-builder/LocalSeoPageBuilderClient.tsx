"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from "@/components/obd/OBDStickyActionBar";
import ResultCard from "@/components/obd/ResultCard";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
} from "@/lib/obd-framework/layout-helpers";
import {
  LocalSEOPageBuilderRequest,
  type LocalSEOPageBuilderResponse,
  OutputFormat,
  TargetAudience,
  TonePreset,
} from "./types";
import LocalSEOPageBuilderTools from "@/components/bdw/LocalSEOPageBuilderTools";
import WorkflowGuidance from "@/components/bdw/WorkflowGuidance";
import AnalyticsDetails from "@/components/bdw/AnalyticsDetails";
import { recordExport, recordGeneration } from "@/lib/bdw/local-analytics";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { type BrandProfile } from "@/lib/bdw";
import LocalSeoAccordionSection from "./components/LocalSeoAccordionSection";
import {
  getActiveFaqs,
  getActivePageCopy,
  getActivePageSections,
  getActiveSchemaJsonLd,
  getActiveSeoPack,
  hasEdits,
} from "./draft";
import { createInitialDraft, draftReducer } from "./draft-reducer";

const STORAGE_KEY = "obd.v3.localSEOPageBuilder.form";

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

export default function LocalSeoPageBuilderClient({
  initialDefaults = defaultFormValues,
}: {
  initialDefaults?: LocalSEOPageBuilderRequest;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [secondaryServicesInput, setSecondaryServicesInput] = useState("");
  const [neighborhoodsInput, setNeighborhoodsInput] = useState("");
  const [undoStack, setUndoStack] = useState<string[]>([]); // 1-deep undo stack
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<"Combined" | "Section Cards">(
    "Combined"
  );
  const [useBrandProfile, setUseBrandProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return hasBrandProfile();
    } catch {
      return false;
    }
  });

  const [draft, dispatch] = useReducer(
    draftReducer,
    initialDefaults,
    createInitialDraft
  );

  const form = draft.sourceInputs.form;
  const result = draft.generated;
  const loading = draft.status === "generating";
  const error = draft.error;
  const lastPayload = draft.sourceInputs.lastPayload;

  const activeSeoPack = useMemo(() => getActiveSeoPack(draft), [draft]);
  const activePageCopy = useMemo(() => getActivePageCopy(draft), [draft]);
  const activeFaqs = useMemo(() => getActiveFaqs(draft), [draft]);
  const activePageSections = useMemo(() => getActivePageSections(draft), [draft]);
  const activeSchemaJsonLd = useMemo(() => getActiveSchemaJsonLd(draft), [draft]);

  // Tier 5A: accordion sections
  const [accordionState, setAccordionState] = useState({
    pageBasics: true,
    businessInfo: true,
    locationTargeting: true,
    onPageSeoTone: false,
    contentAndCtas: false,
    schemaAndOutput: false,
    export: false,
  });

  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const expandAll = () => {
    setAccordionState({
      pageBasics: true,
      businessInfo: true,
      locationTargeting: true,
      onPageSeoTone: true,
      contentAndCtas: true,
      schemaAndOutput: true,
      export: true,
    });
  };

  const collapseAll = () => {
    setAccordionState({
      pageBasics: true, // keep the primary section visible
      businessInfo: false,
      locationTargeting: false,
      onPageSeoTone: false,
      contentAndCtas: false,
      schemaAndOutput: false,
      export: false,
    });
  };

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => setActionToast(null), 1200);
  };

  // Draft status chip (Tier 5A)
  const statusLabel: "Draft" | "Generated" | "Edited" = !result
    ? "Draft"
    : hasEdits(draft.edits)
      ? "Edited"
      : "Generated";

  const statusChip = (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`text-xs uppercase font-semibold px-2 py-1 rounded-lg border ${
          statusLabel === "Draft"
            ? isDark
              ? "bg-slate-800 text-slate-300 border-slate-700"
              : "bg-slate-50 text-slate-700 border-slate-200"
            : statusLabel === "Edited"
              ? isDark
                ? "bg-amber-900/30 text-amber-200 border-amber-800/50"
                : "bg-amber-50 text-amber-800 border-amber-200"
              : isDark
                ? "bg-blue-900/30 text-blue-200 border-blue-800/50"
                : "bg-blue-50 text-blue-800 border-blue-200"
        }`}
      >
        {statusLabel}
      </span>
      <span className={`text-xs truncate ${themeClasses.mutedText}`}>
        Draft-only. Nothing is published automatically.
      </span>
    </div>
  );

  // Current page copy (edited or original)
  const currentPageCopy = activePageCopy;

  const canUndo = undoStack.length > 0;

  // Handle page copy change with undo stack
  const handlePageCopyChange = (newCopy: string) => {
    const current = activePageCopy;
    if (newCopy !== current) {
      setUndoStack([current]); // store previous state (1-deep)
      dispatch({ type: "APPLY_EDIT", key: "pageCopy", value: newCopy });
    }
  };

  // Handle undo
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previous = undoStack[undoStack.length - 1];
      if (previous === (result?.pageCopy ?? "")) {
        dispatch({ type: "RESET_SECTION", key: "pageCopy" });
      } else {
        dispatch({ type: "APPLY_EDIT", key: "pageCopy", value: previous });
      }
      setUndoStack([]);
    }
  };

  // Auto-apply brand profile to form (fill-empty-only)
  const { applied } = useAutoApplyBrandProfile({
    enabled: useBrandProfile,
    form: form as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        const nextForm = formOrUpdater(
          form as unknown as Record<string, unknown>
        ) as unknown as LocalSEOPageBuilderRequest;
        dispatch({ type: "INIT_FROM_FORM", form: nextForm });
      } else {
        dispatch({
          type: "INIT_FROM_FORM",
          form: formOrUpdater as unknown as LocalSEOPageBuilderRequest,
        });
      }
    },
    storageKey: "local-seo-page-builder-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "city") return "city";
      if (formKey === "state") return "state";
      if (formKey === "targetAudience") return "targetAudience";
      if (formKey === "uniqueSellingPoints") return "differentiators";
      return undefined;
    },
  });

  // Show one-time toast when brand profile is applied
  const didToastRef = useRef(false);
  useEffect(() => {
    if (applied && !didToastRef.current) {
      didToastRef.current = true;
      showToast("Brand Profile applied to empty fields.");
    }
  }, [applied]);

  // Save form to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch (err) {
      console.error("Failed to save form to localStorage:", err);
    }
  }, [form]);

  const handleFieldChange = <K extends keyof LocalSEOPageBuilderRequest>(
    key: K,
    value: LocalSEOPageBuilderRequest[K]
  ) => {
    dispatch({ type: "INIT_FROM_FORM", form: { ...form, [key]: value } });
  };

  // Schema toggle guard: require a valid page URL
  const isPageUrlValid =
    !!form.pageUrl &&
    form.pageUrl.trim() !== "" &&
    (() => {
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

    // Match prior behavior: clear previous error/results immediately on a new attempt.
    dispatch({ type: "GENERATE_REQUEST", clearGenerated: true });

    // Validation (unchanged)
    if (!form.businessName.trim()) {
      dispatch({ type: "GENERATE_ERROR", error: "Business name is required." });
      return;
    }
    if (!form.businessType.trim()) {
      dispatch({ type: "GENERATE_ERROR", error: "Business type is required." });
      return;
    }
    if (!form.primaryService.trim()) {
      dispatch({ type: "GENERATE_ERROR", error: "Primary service is required." });
      return;
    }
    if (!form.city.trim()) {
      dispatch({ type: "GENERATE_ERROR", error: "City is required." });
      return;
    }
    if (!form.state.trim()) {
      dispatch({ type: "GENERATE_ERROR", error: "State is required." });
      return;
    }

    // Validate websiteUrl if provided
    if (form.websiteUrl && form.websiteUrl.trim()) {
      try {
        new URL(form.websiteUrl);
      } catch {
        dispatch({
          type: "GENERATE_ERROR",
          error: "Please enter a valid website URL (e.g., https://example.com).",
        });
        return;
      }
    }

    // Validate pageUrl if provided
    if (form.pageUrl && form.pageUrl.trim()) {
      try {
        new URL(form.pageUrl);
      } catch {
        dispatch({
          type: "GENERATE_ERROR",
          error:
            "Please enter a valid page URL (e.g., https://example.com/service-page).",
        });
        return;
      }
    }

    try {
      // Convert inputs to arrays (unchanged)
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
        secondaryServices:
          secondaryServicesArray.length > 0 ? secondaryServicesArray : undefined,
        neighborhoods:
          neighborhoodsArray.length > 0 ? neighborhoodsArray : undefined,
      };

      const res = await fetch("/api/local-seo-page-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        dispatch({
          type: "GENERATE_SUCCESS",
          payloadUsed: apiPayload,
          response: response.data,
          preserveEdits: false,
        });
        setUndoStack([]);
        setTimeout(() => {
          const resultsElement = document.getElementById("seo-page-results");
          resultsElement?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else if (response.ok === false && response.error) {
        if (response.requestId) console.error("Request ID:", response.requestId);
        throw new Error(response.error);
      } else {
        dispatch({
          type: "GENERATE_SUCCESS",
          payloadUsed: apiPayload,
          response: response as unknown as LocalSEOPageBuilderResponse,
          preserveEdits: false,
        });
      }
    } catch (error) {
      console.error("Local SEO Page Builder Submit Error:", error);
      let errorMessage =
        "Something went wrong while generating your SEO page content. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      dispatch({ type: "GENERATE_ERROR", error: errorMessage });
    }
  };

  const handleRegenerate = async () => {
    if (!lastPayload || loading) return;

    dispatch({ type: "GENERATE_REQUEST", clearGenerated: true });

    try {
      const res = await fetch("/api/local-seo-page-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        dispatch({
          type: "GENERATE_SUCCESS",
          payloadUsed: lastPayload,
          response: response.data,
          preserveEdits: true,
        });
        recordGeneration("lseo-analytics");
        setTimeout(() => {
          const resultsElement = document.getElementById("seo-page-results");
          resultsElement?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else if (response.ok === false && response.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Regenerate Error:", error);
      let errorMessage = "Something went wrong while regenerating. Please try again.";
      if (error instanceof Error) errorMessage = error.message || errorMessage;
      dispatch({ type: "GENERATE_ERROR", error: errorMessage });
    }
  };

  // Export handlers (unchanged)
  const handleExportTxt = () => {
    if (!result) return;
    recordExport("lseo-analytics", "download:txt");
    const pageCopyToUse = activePageCopy;
    const seoPackToUse = activeSeoPack ?? result.seoPack;
    const faqsToUse = activeFaqs;

    let text = `LOCAL SEO PAGE BUILDER OUTPUT\n`;
    text += `Generated: ${new Date(result.meta.createdAtISO).toLocaleString()}\n`;
    text += `Request ID: ${result.meta.requestId}\n\n`;
    text += "=".repeat(50) + "\n\n";

    text += `SEO PACK\n${"-".repeat(50)}\n`;
    text += `Meta Title: ${seoPackToUse.metaTitle}\n`;
    text += `Meta Description: ${seoPackToUse.metaDescription}\n`;
    text += `Slug: ${seoPackToUse.slug}\n`;
    text += `H1: ${seoPackToUse.h1}\n\n`;

    text += `FULL PAGE COPY\n${"-".repeat(50)}\n`;
    text += `${pageCopyToUse}\n\n`;

    text += `FAQ SECTION\n${"-".repeat(50)}\n`;
    faqsToUse.forEach((faq, i) => {
      text += `Q${i + 1}: ${faq.question}\n`;
      text += `A${i + 1}: ${faq.answer}\n\n`;
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = form.businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    a.download = `seo-page-${safeName || "page"}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleExportHtml = () => {
    if (!result || form.outputFormat !== "HTML") return;
    recordExport("lseo-analytics", "download:html");
    const pageCopyToUse = activePageCopy;
    const seoPackToUse = activeSeoPack ?? result.seoPack;
    const faqsToUse = activeFaqs;

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
    html += `  <title>${escapeHtml(seoPackToUse.metaTitle)}</title>\n`;
    html += `  <meta name="description" content="${escapeHtml(seoPackToUse.metaDescription)}">\n`;
    html += `</head>\n<body>\n`;
    html += pageCopyToUse;
    html += `\n\n<h2>Frequently Asked Questions</h2>\n`;
    faqsToUse.forEach((faq) => {
      html += `\n<h3>${faq.question}</h3>\n`;
      html += `<p>${faq.answer}</p>\n`;
    });
    html += `\n</body>\n</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = form.businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    a.download = `seo-page-${safeName || "page"}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleExportJson = () => {
    const schemaToUse = activeSchemaJsonLd;
    if (!result || !schemaToUse) return;
    recordExport("lseo-analytics", "download:json");

    try {
      const schemaData = JSON.parse(schemaToUse);
      const json = JSON.stringify(schemaData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = form.businessName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50);
      a.download = `schema-${safeName || "page"}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export schema JSON:", err);
      dispatch({ type: "GENERATE_ERROR", error: "Failed to export schema. Please try again." });
    }
  };

  const handleReset = () => {
    if (loading) return;
    dispatch({ type: "RESET_DRAFT", form: initialDefaults });
    setUndoStack([]);
    setShowSuccessToast(false);
    setActionToast(null);
    setCopyMode("Combined");
    setSecondaryServicesInput("");
    setNeighborhoodsInput("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageBasicsSummary = () => {
    const parts: string[] = [];
    if (form.primaryService.trim()) parts.push(form.primaryService.trim());
    parts.push(`Copy: ${copyMode}`);
    return parts.join(" · ");
  };

  const getBusinessInfoSummary = () => {
    const parts: string[] = [];
    if (form.businessName.trim()) parts.push(form.businessName.trim());
    if (form.businessType.trim()) parts.push(form.businessType.trim());
    if (form.phone?.trim()) parts.push("Phone");
    if (form.websiteUrl?.trim()) parts.push("Website");
    return parts.length ? parts.join(" · ") : "Not filled";
  };

  const getLocationTargetingSummary = () => {
    const parts: string[] = [];
    if (form.city.trim() || form.state.trim()) parts.push(`${form.city.trim()} ${form.state.trim()}`.trim());
    const nb = neighborhoodsInput
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (nb.length) parts.push(`${Math.min(nb.length, 12)} areas`);
    return parts.length ? parts.join(" · ") : "Not filled";
  };

  const getOnPageSeoToneSummary = () => {
    const parts: string[] = [];
    parts.push(`Tone: ${form.tonePreset || "Professional"}`);
    parts.push(`Audience: ${form.targetAudience || "Both"}`);
    if (form.uniqueSellingPoints?.trim()) parts.push("USPs");
    return parts.join(" · ");
  };

  const getContentAndCtasSummary = () => {
    const ss = secondaryServicesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parts: string[] = [];
    parts.push(ss.length ? `${Math.min(ss.length, 12)} secondary services` : "No secondary services");
    if (form.ctaPreference?.trim()) parts.push("CTA");
    return parts.join(" · ");
  };

  const getSchemaAndOutputSummary = () => {
    const parts: string[] = [];
    if (form.pageUrl?.trim()) parts.push("Page URL");
    parts.push(form.includeSchema ? "Schema on" : "Schema off");
    parts.push(`Format: ${form.outputFormat || "PlainText"}`);
    return parts.join(" · ");
  };

  const getExportSummary = () =>
    result ? `Ready · ${form.outputFormat || "PlainText"}` : "Generate to enable";

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Local SEO Page Builder"
      tagline="Generate a complete local landing page pack for a service + city."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
            isDark
              ? "bg-slate-800 text-white border border-slate-700"
              : "bg-white text-slate-900 border border-slate-200"
          }`}
        >
          {actionToast}
        </div>
      )}

      {/* Workflow Guidance */}
      <WorkflowGuidance
        isDark={isDark}
        currentStep={
          result
            ? 3
            : form.businessName.trim() && form.primaryService.trim()
              ? 2
              : 1
        }
        storageKey="lseo-workflow-guidance-dismissed"
      />

      {/* Tier 5A trust microcopy */}
      <div
        className={`rounded-xl border p-4 mb-6 ${
          isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
        }`}
      >
        <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
          Draft-only output
        </p>
        <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
          Nothing is published automatically. Use Export when you’re ready to paste into your site.
        </p>
      </div>

      {/* Inputs */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between mb-4">
          <OBDHeading level={2} isDark={isDark}>
            Inputs
          </OBDHeading>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={expandAll}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                isDark
                  ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                isDark
                  ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Use Brand Profile toggle */}
        <div className={`mb-4 pb-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
            <input
              type="checkbox"
              checked={useBrandProfile}
              onChange={(e) => setUseBrandProfile(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Use Brand Profile (auto-fill empty fields)
            </span>
          </label>
          <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
            When enabled, your saved brand profile will auto-fill business details if fields are empty.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
            <div className="space-y-4">
              <LocalSeoAccordionSection
                isDark={isDark}
                title="Page Basics"
                summary={getPageBasicsSummary()}
                isOpen={accordionState.pageBasics}
                onToggle={() => toggleAccordion("pageBasics")}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="primaryService"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Primary Service <span className="text-red-500">*</span>
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
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Used as the main topic keyword for your page (H1 + title).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onChange={(e) =>
                          setCopyMode(e.target.value as "Combined" | "Section Cards")
                        }
                        className={getInputClasses(isDark)}
                      >
                        <option value="Combined">Combined</option>
                        <option value="Section Cards">Section Cards</option>
                      </select>
                    </div>
                  </div>
                </div>
              </LocalSeoAccordionSection>

              <LocalSeoAccordionSection
                isDark={isDark}
                title="Business Info"
                summary={getBusinessInfoSummary()}
                isOpen={accordionState.businessInfo}
                onToggle={() => toggleAccordion("businessInfo")}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="businessName"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Business Name <span className="text-red-500">*</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="phone"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Phone (optional)
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
                        Website URL (optional)
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
                  </div>
                </div>
              </LocalSeoAccordionSection>

              <LocalSeoAccordionSection
                isDark={isDark}
                title="Location Targeting"
                summary={getLocationTargetingSummary()}
                isOpen={accordionState.locationTargeting}
                onToggle={() => toggleAccordion("locationTargeting")}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="city"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        City <span className="text-red-500">*</span>
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
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        State <span className="text-red-500">*</span>
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
                      onChange={(e) => setNeighborhoodsInput(e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Downtown Ocala, Silver Springs"
                    />
                    {neighborhoodsInput.trim() !== "" ? (
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                        These will be referenced naturally in the page and FAQs.
                      </p>
                    ) : null}
                  </div>
                </div>
              </LocalSeoAccordionSection>

              <LocalSeoAccordionSection
                isDark={isDark}
                title="On-Page SEO / Tone"
                summary={getOnPageSeoToneSummary()}
                isOpen={accordionState.onPageSeoTone}
                onToggle={() => toggleAccordion("onPageSeoTone")}
              >
                <div className="space-y-4">
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
                      onChange={(e) =>
                        handleFieldChange("tonePreset", e.target.value as TonePreset)
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="Professional">Professional</option>
                      <option value="Friendly">Friendly</option>
                      <option value="Direct">Direct</option>
                    </select>
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
                      onChange={(e) =>
                        handleFieldChange("targetAudience", e.target.value as TargetAudience)
                      }
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
                      Unique Selling Points (optional)
                    </label>
                    <textarea
                      id="uniqueSellingPoints"
                      value={form.uniqueSellingPoints || ""}
                      onChange={(e) =>
                        handleFieldChange("uniqueSellingPoints", e.target.value)
                      }
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="What makes your business stand out?"
                    />
                  </div>
                </div>
              </LocalSeoAccordionSection>

              <LocalSeoAccordionSection
                isDark={isDark}
                title="Content & CTAs"
                summary={getContentAndCtasSummary()}
                isOpen={accordionState.contentAndCtas}
                onToggle={() => toggleAccordion("contentAndCtas")}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="secondaryServices"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Secondary Services (comma-separated, max 12)
                    </label>
                    <input
                      type="text"
                      id="secondaryServices"
                      value={secondaryServicesInput}
                      onChange={(e) => setSecondaryServicesInput(e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Driveway cleaning, window cleaning"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ctaPreference"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      CTA Preference (optional)
                    </label>
                    <input
                      type="text"
                      id="ctaPreference"
                      value={form.ctaPreference || ""}
                      onChange={(e) =>
                        handleFieldChange("ctaPreference", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="Call now, Request a quote"
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Used for buttons and closing call-to-action sections.
                    </p>
                  </div>
                </div>
              </LocalSeoAccordionSection>

              <LocalSeoAccordionSection
                isDark={isDark}
                title="Schema & Output Format"
                summary={getSchemaAndOutputSummary()}
                isOpen={accordionState.schemaAndOutput}
                onToggle={() => toggleAccordion("schemaAndOutput")}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="outputFormat"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Output Format
                    </label>
                    <select
                      id="outputFormat"
                      value={form.outputFormat || "PlainText"}
                      onChange={(e) =>
                        handleFieldChange("outputFormat", e.target.value as OutputFormat)
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="PlainText">Plain Text</option>
                      <option value="WordPress">WordPress</option>
                      <option value="HTML">HTML</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="pageUrl"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Page URL (recommended)
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
                      Used by search engines to connect this content to a real page.
                    </p>
                  </div>

                  <div>
                    <label
                      className={`flex items-center gap-2 ${themeClasses.labelText} ${
                        !isPageUrlValid ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.includeSchema || false}
                        onChange={(e) =>
                          handleFieldChange("includeSchema", e.target.checked)
                        }
                        className="rounded"
                        disabled={!isPageUrlValid}
                      />
                      <span className="text-sm font-medium">
                        Include Schema Bundle
                      </span>
                    </label>
                    {!isPageUrlValid ? (
                      <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                        Page URL is required to generate schema. Please enter a valid page URL above.
                      </p>
                    ) : (
                      <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                        Generates optional JSON-LD you can paste into your site.
                      </p>
                    )}
                  </div>
                </div>
              </LocalSeoAccordionSection>

              <div>
                <LocalSeoAccordionSection
                  isDark={isDark}
                  title="Export"
                  summary={getExportSummary()}
                  isOpen={accordionState.export}
                  onToggle={() => toggleAccordion("export")}
                >
                  <div className="space-y-3">
                    <p className={`text-xs ${themeClasses.mutedText}`}>
                      Export is draft-only: downloads files you can paste into your site. Nothing is published automatically.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleExportTxt}
                        disabled={!result}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                        title={!result ? "Generate first" : "Download .txt export"}
                      >
                        Export .txt
                      </button>

                      <button
                        type="button"
                        onClick={handleExportHtml}
                        disabled={!result || form.outputFormat !== "HTML"}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                        title={
                          !result
                            ? "Generate first"
                            : form.outputFormat !== "HTML"
                              ? "Set Output Format to HTML to export .html"
                              : "Download .html export"
                        }
                      >
                        Export .html
                      </button>

                      <button
                        type="button"
                        onClick={handleExportJson}
                        disabled={!result || !activeSchemaJsonLd}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                        title={!result ? "Generate first" : "Download schema JSON"}
                      >
                        Export schema .json
                      </button>
                    </div>
                  </div>
                </LocalSeoAccordionSection>
              </div>
            </div>
          </div>

          <OBDStickyActionBar isDark={isDark} left={statusChip}>
            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={loading || !lastPayload}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={!lastPayload ? "Generate first" : "Regenerate with the last successful settings"}
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleExportTxt}
              disabled={!result}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={!result ? "Generate first" : "Download .txt export"}
            >
              Export .txt
            </button>
            <button
              type="button"
              onClick={handleExportHtml}
              disabled={!result || form.outputFormat !== "HTML"}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={
                !result
                  ? "Generate first"
                  : form.outputFormat !== "HTML"
                    ? "Set Output Format to HTML to export .html"
                    : "Download .html export"
              }
            >
              Export .html
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!result || !activeSchemaJsonLd}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={!result ? "Generate first" : "Download schema JSON"}
            >
              Export .json
            </button>
          </OBDStickyActionBar>
        </form>
      </OBDPanel>

      {/* Warnings Banner */}
      {result?.warnings?.length ? (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div
            className={`p-4 rounded-lg border ${
              isDark
                ? "bg-yellow-900/20 border-yellow-700/50 text-yellow-200"
                : "bg-yellow-50 border-yellow-200 text-yellow-800"
            }`}
          >
            <p className="font-medium mb-2">Warnings</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {result.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        </OBDPanel>
      ) : null}

      {/* Tools panel (existing) */}
      {result ? (
        <LocalSEOPageBuilderTools
          pageCopy={currentPageCopy}
          onPageCopyChange={handlePageCopyChange}
          onUndo={handleUndo}
          canUndo={canUndo}
          seoPack={activeSeoPack}
          faqs={activeFaqs}
          formValues={{
            businessName: form.businessName,
            services: form.secondaryServices?.join(", ") || form.primaryService,
            keywords: form.primaryService,
            primaryService: form.primaryService,
            city: form.city,
            state: form.state,
          }}
          isDark={isDark}
          onApplyBrandProfile={(profile: BrandProfile, fillEmptyOnly: boolean) => {
            const prev = form;
            const updates: Partial<LocalSEOPageBuilderRequest> = {};

            if (profile.city && (!fillEmptyOnly || !prev.city.trim())) {
              updates.city = profile.city;
            }
            if (profile.state && (!fillEmptyOnly || !prev.state.trim())) {
              updates.state = profile.state;
            }
            if (profile.services && (!fillEmptyOnly || !prev.secondaryServices?.length)) {
              const servicesArray =
                typeof profile.services === "string"
                  ? profile.services
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [];
              if (servicesArray.length > 0) {
                updates.secondaryServices = servicesArray;
                setSecondaryServicesInput(servicesArray.join(", "));
              }
            }
            if (
              profile.uniqueSellingPoints &&
              (!fillEmptyOnly || !prev.uniqueSellingPoints?.trim())
            ) {
              updates.uniqueSellingPoints = profile.uniqueSellingPoints;
            }

            dispatch({ type: "INIT_FROM_FORM", form: { ...prev, ...updates } });
          }}
        />
      ) : null}

      {/* Results (Tier 5A parity) */}
      <OBDResultsPanel
        title="Your SEO Page Content"
        subtitle="Draft-only output. Export when ready."
        isDark={isDark}
        className="mt-8"
        loading={loading}
        loadingText="Generating your local SEO page pack…"
        emptyTitle="No page yet"
        emptyDescription="Fill out the inputs above and click Generate to create your local landing page pack."
      >
        {error ? (
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error</p>
            <p>{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Reset
              </button>
            </div>
          </div>
        ) : result ? (
          <OBDPanel isDark={isDark} className="mt-4" id="seo-page-results">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Results
              </OBDHeading>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={loading || !lastPayload}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={!lastPayload ? "Generate first" : "Regenerate with same settings"}
                >
                  Regenerate
                </button>
              </div>
            </div>

            {/* Analytics / readiness details (existing) */}
            <AnalyticsDetails storageKey="lseo-analytics" isDark={isDark} />

            <div className="grid grid-cols-1 gap-4">
              <ResultCard title="SEO Pack" isDark={isDark}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Meta Title
                    </p>
                    <p className="font-semibold">{activeSeoPack?.metaTitle}</p>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Meta Description
                    </p>
                    <p className="text-sm">{activeSeoPack?.metaDescription}</p>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Slug
                    </p>
                    <p className="font-mono text-sm">{activeSeoPack?.slug}</p>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      H1
                    </p>
                    <p className="font-semibold text-lg">{activeSeoPack?.h1}</p>
                  </div>
                </div>
              </ResultCard>

              {copyMode === "Combined" ? (
                <ResultCard
                  title="Full Page Copy"
                  isDark={isDark}
                  copyText={currentPageCopy}
                >
                  {form.outputFormat === "HTML" ? (
                    <div className="overflow-x-auto">
                      <pre className="text-xs p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 whitespace-pre-wrap">
                        <code>{currentPageCopy}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{currentPageCopy}</div>
                  )}
                </ResultCard>
              ) : (
                activePageSections && (
                  <ResultCard
                    title="Section Cards"
                    isDark={isDark}
                    copyText={[
                      activePageSections.hero,
                      activePageSections.intro,
                      activePageSections.services,
                      activePageSections.whyChooseUs,
                      activePageSections.areasServed,
                      activePageSections.closingCta,
                    ].join("\n\n")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Switch Copy Mode to “Combined” to see a single full-page block.
                    </p>
                  </ResultCard>
                )
              )}

              <ResultCard
                title="FAQ Section"
                isDark={isDark}
                copyText={activeFaqs
                  .map((faq, i) => `Q${i + 1}: ${faq.question}\nA${i + 1}: ${faq.answer}`)
                  .join("\n\n")}
              >
                <div className="space-y-4">
                  {activeFaqs.map((faq, idx) => (
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

              {activeSchemaJsonLd ? (
                <ResultCard
                  title="Schema Bundle (Optional)"
                  isDark={isDark}
                  copyText={activeSchemaJsonLd}
                >
                  <pre className="text-xs overflow-x-auto p-3 rounded bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700">
                    <code>{activeSchemaJsonLd}</code>
                  </pre>
                </ResultCard>
              ) : null}
            </div>
          </OBDPanel>
        ) : null}
      </OBDResultsPanel>

      {/* Success Toast */}
      {showSuccessToast ? (
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
      ) : null}
    </OBDPageContainer>
  );
}


