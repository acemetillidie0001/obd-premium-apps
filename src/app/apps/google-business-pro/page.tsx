"use client";

import { useMemo, useState, useEffect, useReducer } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import {
  GoogleBusinessAuditRequest,
  type GoogleBusinessAuditResult,
  GoogleBusinessWizardRequest,
  type GoogleBusinessWizardResult,
  GoogleBusinessProRequest,
  GoogleBusinessProResult,
  GoogleBusinessProReportExport,
  GoogleBusinessProCsvExport,
  GoogleBusinessRewritesResult,
  GoogleBusinessPhotoOptimizationResult,
  GoogleBusinessCompetitorInsightsResult,
  GoogleBusinessRewriteTone,
  PersonalityStyle,
} from "./types";
import GoogleBusinessAccordionSection from "./components/GoogleBusinessAccordionSection";
import { getActiveGbpDraft, type GoogleBusinessDraftContent } from "./draft";
import {
  buildEditedSnapshot,
  createInitialGoogleBusinessDraft,
  googleBusinessDraftReducer,
} from "./draft-reducer";
import {
  EditableFaqsBlock,
  EditableLinesBlock,
  EditableTextBlock,
  type FaqItem,
} from "./components/GbpEditableBlocks";
import GbpExportCenterPanel from "./components/GbpExportCenterPanel";

type Mode = "audit" | "wizard" | "pro";

type AuditFormState = Omit<
  GoogleBusinessAuditRequest,
  "services" | "secondaryKeywords"
> & { services: string; secondaryKeywords: string };

type WizardFormState = Omit<
  GoogleBusinessWizardRequest,
  "services" | "secondaryKeywords"
> & { services: string; secondaryKeywords: string };

const DEFAULT_AUDIT_FORM: AuditFormState = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  websiteUrl: "",
  googleBusinessUrl: "",
  mainCategory: "",
  primaryKeyword: "",
  secondaryKeywords: "",
  personalityStyle: "Soft",
  brandVoice: "",
  goals: "",
};

const DEFAULT_WIZARD_FORM: WizardFormState = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  websiteUrl: "",
  primaryKeyword: "",
  secondaryKeywords: "",
  personalityStyle: "Soft",
  brandVoice: "",
  shortDescriptionLength: "Short",
  longDescriptionLength: "Medium",
  serviceAreas: "",
  openingHours: "",
  specialities: "",
  faqCount: 5,
  includePosts: true,
  postGoal: "",
  promoDetails: "",
};

// Helper to convert text to array (split on commas or newlines, trim, filter empty)
function textToArray(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function GoogleBusinessProfileProPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  // Simple OBD-style toast (used by Export Center copy/download actions)
  const [actionToast, setActionToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => setActionToast(null), 1200);
  };

  const [mode, setMode] = useState<Mode>("audit");

  // Audit form state
  const [auditForm, setAuditForm] = useState<AuditFormState>(DEFAULT_AUDIT_FORM);

  // Wizard form state
  const [wizardForm, setWizardForm] = useState<WizardFormState>(DEFAULT_WIZARD_FORM);

  // Tier 5B Canonical Draft Model (deterministic; no output drift)
  const [gbpDraft, gbpDispatch] = useReducer(
    googleBusinessDraftReducer,
    undefined,
    createInitialGoogleBusinessDraft
  );
  const activeDraft = useMemo(() => getActiveGbpDraft(gbpDraft), [gbpDraft]);
  const activeAudit = activeDraft?.audit ?? null;
  const activeWizard = activeDraft?.content ?? null;
  const activeProResult = useMemo<GoogleBusinessProResult | null>(() => {
    if (activeDraft?.audit && activeDraft?.content) {
      return { audit: activeDraft.audit, content: activeDraft.content };
    }
    return null;
  }, [activeDraft]);
  const generatedWizard = gbpDraft.generatedContent?.content ?? null;
  const editedWizard = gbpDraft.editedContent?.content ?? null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Report export state
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportExport, setReportExport] = useState<GoogleBusinessProReportExport | null>(null);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Rewrites state
  const [rewritesLoading, setRewritesLoading] = useState(false);
  const [rewritesError, setRewritesError] = useState<string | null>(null);
  const [rewritesResult, setRewritesResult] = useState<GoogleBusinessRewritesResult | null>(null);
  const [selectedRewriteTone, setSelectedRewriteTone] = useState<GoogleBusinessRewriteTone>("Default");
  const [emphasisNotes, setEmphasisNotes] = useState("");

  // Photo optimization state
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoResult, setPhotoResult] = useState<GoogleBusinessPhotoOptimizationResult | null>(null);
  const [currentPhotoContext, setCurrentPhotoContext] = useState("");

  // Competitor insights state
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);
  const [competitorsResult, setCompetitorsResult] = useState<GoogleBusinessCompetitorInsightsResult | null>(null);
  const [competitorInputs, setCompetitorInputs] = useState<Array<{ name: string; url: string; notes: string }>>([
    { name: "", url: "", notes: "" },
  ]);

  // Tier 5A: accordion sections (default: first open, others collapsed)
  const [auditAccordion, setAuditAccordion] = useState({
    businessBasics: true,
    gbpDetails: false,
    servicesKeywords: false,
    brandGoals: false,
    faqsPosts: false,
    advancedOptional: false,
  });

  const [wizardAccordion, setWizardAccordion] = useState({
    businessBasics: true,
    gbpDetails: false,
    servicesKeywords: false,
    brandGoals: false,
    faqsPosts: false,
    advancedOptional: false,
  });

  const [proAccordion, setProAccordion] = useState({
    businessBasics: true,
    gbpDetails: false,
    servicesKeywords: false,
    brandGoals: false,
    faqsPosts: false,
    advancedOptional: false,
  });

  const toggleAuditAccordion = (key: keyof typeof auditAccordion) =>
    setAuditAccordion((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleWizardAccordion = (key: keyof typeof wizardAccordion) =>
    setWizardAccordion((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleProAccordion = (key: keyof typeof proAccordion) =>
    setProAccordion((prev) => ({ ...prev, [key]: !prev[key] }));

  const auditServicesCount = useMemo(() => textToArray(auditForm.services).length, [auditForm.services]);
  const auditSecondaryKeywordsCount = useMemo(
    () => textToArray(auditForm.secondaryKeywords).length,
    [auditForm.secondaryKeywords]
  );
  const wizardServicesCount = useMemo(() => textToArray(wizardForm.services).length, [wizardForm.services]);
  const wizardSecondaryKeywordsCount = useMemo(
    () => textToArray(wizardForm.secondaryKeywords).length,
    [wizardForm.secondaryKeywords]
  );

  const auditSectionSummaries = useMemo(() => {
    const businessBasics = [
      auditForm.businessName?.trim(),
      auditForm.businessType?.trim(),
      [auditForm.city?.trim(), auditForm.state?.trim()].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const gbpDetails = [
      auditForm.googleBusinessUrl?.trim() ? "GBP URL" : "",
      auditForm.mainCategory?.trim() ? auditForm.mainCategory.trim() : "",
      auditForm.websiteUrl?.trim() ? "Website" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const servicesKeywords = [
      auditServicesCount ? `${auditServicesCount} services` : "",
      auditForm.primaryKeyword?.trim() ? `Primary: ${auditForm.primaryKeyword.trim()}` : "",
      auditSecondaryKeywordsCount ? `${auditSecondaryKeywordsCount} secondary keywords` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const brandGoals = [
      auditForm.personalityStyle ? `Style: ${auditForm.personalityStyle}` : "",
      auditForm.brandVoice?.trim() ? "Brand voice" : "",
      auditForm.goals?.trim() ? "Goals" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    return {
      businessBasics,
      gbpDetails,
      servicesKeywords,
      brandGoals,
      faqsPosts: "Not used in Audit mode",
      advancedOptional: "Optional details",
    };
  }, [
    auditForm.businessName,
    auditForm.businessType,
    auditForm.city,
    auditForm.state,
    auditForm.googleBusinessUrl,
    auditForm.mainCategory,
    auditForm.websiteUrl,
    auditForm.primaryKeyword,
    auditForm.personalityStyle,
    auditForm.brandVoice,
    auditForm.goals,
    auditServicesCount,
    auditSecondaryKeywordsCount,
  ]);

  const wizardSectionSummaries = useMemo(() => {
    const businessBasics = [
      wizardForm.businessName?.trim(),
      wizardForm.businessType?.trim(),
      [wizardForm.city?.trim(), wizardForm.state?.trim()].filter(Boolean).join(" "),
      wizardForm.websiteUrl?.trim() ? "Website" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const gbpDetails = [
      `Short: ${wizardForm.shortDescriptionLength}`,
      `Long: ${wizardForm.longDescriptionLength}`,
      wizardForm.serviceAreas?.trim() ? "Service areas" : "",
      wizardForm.openingHours?.trim() ? "Hours" : "",
      wizardForm.specialities?.trim() ? "Specialities" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const servicesKeywords = [
      wizardServicesCount ? `${wizardServicesCount} services` : "",
      wizardForm.primaryKeyword?.trim() ? `Primary: ${wizardForm.primaryKeyword.trim()}` : "",
      wizardSecondaryKeywordsCount ? `${wizardSecondaryKeywordsCount} secondary keywords` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const brandGoals = [
      wizardForm.personalityStyle ? `Style: ${wizardForm.personalityStyle}` : "",
      wizardForm.brandVoice?.trim() ? "Brand voice" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    const faqsPosts = [
      `FAQs: ${Math.min(Math.max(3, wizardForm.faqCount), 12)}`,
      wizardForm.includePosts ? "Posts on" : "Posts off",
      wizardForm.includePosts && wizardForm.postGoal?.trim() ? "Post goal" : "",
      wizardForm.includePosts && wizardForm.promoDetails?.trim() ? "Promo" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Not filled";

    return {
      businessBasics,
      gbpDetails,
      servicesKeywords,
      brandGoals,
      faqsPosts,
      advancedOptional: "Optional fields",
    };
  }, [
    wizardForm.businessName,
    wizardForm.businessType,
    wizardForm.city,
    wizardForm.state,
    wizardForm.websiteUrl,
    wizardForm.shortDescriptionLength,
    wizardForm.longDescriptionLength,
    wizardForm.serviceAreas,
    wizardForm.openingHours,
    wizardForm.specialities,
    wizardForm.primaryKeyword,
    wizardForm.personalityStyle,
    wizardForm.brandVoice,
    wizardForm.faqCount,
    wizardForm.includePosts,
    wizardForm.postGoal,
    wizardForm.promoDetails,
    wizardServicesCount,
    wizardSecondaryKeywordsCount,
  ]);

  const proSectionSummaries = useMemo(() => {
    const businessName = wizardForm.businessName?.trim() || auditForm.businessName?.trim();
    const businessType = wizardForm.businessType?.trim() || auditForm.businessType?.trim();
    const city = wizardForm.city?.trim() || auditForm.city?.trim();
    const state = wizardForm.state?.trim() || auditForm.state?.trim();
    const websiteUrl = wizardForm.websiteUrl?.trim() || auditForm.websiteUrl?.trim();

    const businessBasics = [
      businessName,
      businessType,
      [city, state].filter(Boolean).join(" "),
      websiteUrl ? "Website" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Fill Audit/Wizard first";

    const gbpDetails = [
      auditForm.googleBusinessUrl?.trim() ? "GBP URL" : "",
      auditForm.mainCategory?.trim() ? auditForm.mainCategory.trim() : "",
      `Short: ${wizardForm.shortDescriptionLength}`,
      `Long: ${wizardForm.longDescriptionLength}`,
    ]
      .filter(Boolean)
      .join(" · ") || "Fill Audit/Wizard first";

    const primaryKeyword = (auditForm.primaryKeyword || wizardForm.primaryKeyword || "").trim();

    const servicesKeywords = [
      wizardServicesCount || auditServicesCount
        ? `${wizardServicesCount || auditServicesCount} services`
        : "",
      primaryKeyword ? `Primary: ${primaryKeyword}` : "",
      auditSecondaryKeywordsCount || wizardSecondaryKeywordsCount
        ? `${auditSecondaryKeywordsCount || wizardSecondaryKeywordsCount} secondary keywords`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Fill Audit/Wizard first";

    const brandGoals = [
      (wizardForm.personalityStyle || auditForm.personalityStyle)
        ? `Style: ${wizardForm.personalityStyle || auditForm.personalityStyle}`
        : "",
      (wizardForm.brandVoice || auditForm.brandVoice)?.trim() ? "Brand voice" : "",
      auditForm.goals?.trim() ? "Goals" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Fill Audit/Wizard first";

    const faqsPosts = [
      `FAQs: ${Math.min(Math.max(3, wizardForm.faqCount), 12)}`,
      wizardForm.includePosts ? "Posts on" : "Posts off",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      businessBasics,
      gbpDetails,
      servicesKeywords,
      brandGoals,
      faqsPosts,
      advancedOptional: activeProResult ? "Ready" : "Draft-only (run Audit + Wizard for full Pro)",
    };
  }, [
    auditForm.businessName,
    auditForm.businessType,
    auditForm.city,
    auditForm.state,
    auditForm.websiteUrl,
    auditForm.googleBusinessUrl,
    auditForm.mainCategory,
    auditForm.primaryKeyword,
    auditForm.secondaryKeywords,
    auditForm.personalityStyle,
    auditForm.brandVoice,
    auditForm.goals,
    wizardForm.businessName,
    wizardForm.businessType,
    wizardForm.city,
    wizardForm.state,
    wizardForm.websiteUrl,
    wizardForm.primaryKeyword,
    wizardForm.secondaryKeywords,
    wizardForm.shortDescriptionLength,
    wizardForm.longDescriptionLength,
    wizardForm.faqCount,
    wizardForm.includePosts,
    wizardForm.personalityStyle,
    wizardForm.brandVoice,
    auditServicesCount,
    auditSecondaryKeywordsCount,
    wizardServicesCount,
    wizardSecondaryKeywordsCount,
    activeProResult,
  ]);

  const scrollToId = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleResetEdits = () => {
    if (isSubmitting || reportLoading || rewritesLoading || photoLoading || competitorsLoading || csvLoading) return;
    setError(null);
    setCopiedIndex(null);
    gbpDispatch({ type: "RESET_ALL_EDITS" });
  };

  const handleClearAll = () => {
    if (isSubmitting || reportLoading || rewritesLoading || photoLoading || competitorsLoading || csvLoading) return;

    setError(null);
    setCopiedIndex(null);

    setAuditForm(DEFAULT_AUDIT_FORM);
    setWizardForm(DEFAULT_WIZARD_FORM);

    gbpDispatch({ type: "CLEAR_GENERATED_AND_EDITS" });

    setReportError(null);
    setReportExport(null);
    setReportPdfUrl(null);
    setShareUrl(null);

    setRewritesError(null);
    setRewritesResult(null);
    setSelectedRewriteTone("Default");
    setEmphasisNotes("");

    setPhotoError(null);
    setPhotoResult(null);
    setCurrentPhotoContext("");

    setCompetitorsError(null);
    setCompetitorsResult(null);
    setCompetitorInputs([{ name: "", url: "", notes: "" }]);

    setCsvError(null);
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // ---------------------------------------------------------------------------
  // Tier 5B Draft Editing Helpers (write ONLY to editedContent)
  // ---------------------------------------------------------------------------

  const hasEdits = gbpDraft.editedContent !== null;

  const jsonEqual = (a: unknown, b: unknown): boolean => {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  };

  const isDraftContentEqualToGenerated = (nextEdited: GoogleBusinessDraftContent): boolean => {
    if (!gbpDraft.generatedContent) return false;
    return (
      jsonEqual(nextEdited.audit, gbpDraft.generatedContent.audit) &&
      jsonEqual(nextEdited.content, gbpDraft.generatedContent.content)
    );
  };

  const commitEditedSnapshot = (nextEdited: GoogleBusinessDraftContent) => {
    // If edits match the generated baseline, drop edits entirely (keeps state deterministic).
    if (isDraftContentEqualToGenerated(nextEdited)) {
      gbpDispatch({ type: "SET_EDITED_SNAPSHOT", editedContent: null });
      return;
    }
    gbpDispatch({ type: "SET_EDITED_SNAPSHOT", editedContent: nextEdited });
  };

  const updateWizardContent = (updater: (current: GoogleBusinessWizardResult) => GoogleBusinessWizardResult) => {
    if (!activeWizard) return;
    const nextEdited = buildEditedSnapshot(gbpDraft, (baseline) => {
      const base = baseline.content ?? activeWizard;
      return { ...baseline, content: updater(base) };
    });
    commitEditedSnapshot(nextEdited);
  };

  const isWizardFieldEdited = (key: keyof GoogleBusinessWizardResult): boolean => {
    if (!editedWizard) return false;
    if (!generatedWizard) return true;
    return !jsonEqual(editedWizard[key], generatedWizard[key]);
  };

  const handleAuditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!auditForm.businessName.trim() || !auditForm.businessType.trim()) {
      setError("Business Name and Business Type are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: GoogleBusinessAuditRequest = {
        ...auditForm,
        services: textToArray(auditForm.services),
        secondaryKeywords: textToArray(auditForm.secondaryKeywords),
      };

      const res = await fetch("/api/google-business/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = (await res.json()) as GoogleBusinessAuditResult;
      gbpDispatch({ type: "UPSERT_GENERATED_AUDIT", audit: data, preserveEdits: true });
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while running the audit. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWizardSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!wizardForm.businessName.trim() || !wizardForm.businessType.trim()) {
      setError("Business Name and Business Type are required.");
      return;
    }

    const servicesArray = textToArray(wizardForm.services);
    if (servicesArray.length === 0 && !wizardForm.primaryKeyword?.trim()) {
      setError("Please provide at least one service or a primary keyword.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: GoogleBusinessWizardRequest = {
        ...wizardForm,
        services: servicesArray,
        secondaryKeywords: textToArray(wizardForm.secondaryKeywords),
        faqCount: Math.min(Math.max(3, wizardForm.faqCount), 12),
      };

      const res = await fetch("/api/google-business/wizard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = (await res.json()) as GoogleBusinessWizardResult;
      gbpDispatch({ type: "UPSERT_GENERATED_WIZARD", content: data, preserveEdits: true });
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating content. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProSubmit = () => {
    // Tier 5B: Pro Mode is deterministic and read-only.
    // It must aggregate from the existing canonical draft only (no new generation).
    const active = getActiveGbpDraft(gbpDraft);
    if (!active?.audit && !active?.content) {
      setError("Run Audit and/or Wizard first so Pro Mode has draft data to summarize.");
      return;
    }
    setError(null);
    setMode("pro");
  };

  /**
   * Export-source lock helper:
   * Always build the payload from the canonical selector at action-time
   * (no reads from ad-hoc component state or raw AI responses).
   */
  const getActiveProResultFromDraft = (): GoogleBusinessProResult | null => {
    const active = getActiveGbpDraft(gbpDraft);
    if (active?.audit && active?.content) return { audit: active.audit, content: active.content };
    return null;
  };

  const handleGenerateReport = async () => {
    const proResult = getActiveProResultFromDraft();
    if (!proResult) {
      setReportError("Run Audit + Wizard first so Pro Mode has a full draft (audit + content) to export.");
      return;
    }

    setReportLoading(true);
    setReportError(null);

    try {
      const res = await fetch("/api/google-business/pro/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proResult,
          options: {
            theme: isDark ? "dark" : "light",
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setReportExport(data);
    } catch (error) {
      console.error("Error generating report:", error);
      setReportError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating the report. Please try again."
      );
    } finally {
      setReportLoading(false);
    }
  };

  // Compute share URL when reportExport changes (include token if present)
  useEffect(() => {
    if (reportExport?.shareId && typeof window !== "undefined") {
      const baseUrl = `${window.location.origin}/apps/google-business-pro/report/${reportExport.shareId}`;
      const tokenizedUrl = reportExport.accessToken
        ? `${baseUrl}?token=${reportExport.accessToken}`
        : baseUrl;
      setShareUrl(tokenizedUrl);
    } else {
      setShareUrl(null);
    }
    // Set PDF URL if pdfBase64 is available
    if (reportExport?.pdfBase64) {
      setReportPdfUrl(`data:application/pdf;base64,${reportExport.pdfBase64}`);
    } else {
      setReportPdfUrl(null);
    }
  }, [reportExport]);

  const handleDownloadPDF = () => {
    if (!reportExport?.pdfBase64) return;
    
    try {
      // Convert base64 to blob
      const byteCharacters = atob(reportExport.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `google-business-pro-report${reportExport.shareId ? `-${reportExport.shareId}` : ""}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  const handleViewReport = () => {
    if (shareUrl) {
      window.open(shareUrl, "_blank");
    } else if (reportExport?.html) {
      // Fallback to local modal if shareUrl not available
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(reportExport.html);
        newWindow.document.close();
      }
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        // Show temporary feedback (could use a toast library, but keeping simple)
        const button = document.activeElement as HTMLElement;
        const originalText = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy link:", err);
      }
    }
  };

  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleExportCSV = async () => {
    const proResult = getActiveProResultFromDraft();
    if (!proResult) {
      setCsvError("Run Audit + Wizard first so Pro Mode has data for export.");
      return;
    }

    try {
      setCsvError(null);
      setCsvLoading(true);

      const res = await fetch("/api/google-business/pro/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proResults: [proResult] }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to generate CSV export.");
      }

      const data = (await res.json()) as GoogleBusinessProCsvExport;
      const blob = new Blob([data.csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "gbp-pro-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unexpected error while generating CSV export.";
      setCsvError(errorMessage);
    } finally {
      setCsvLoading(false);
    }
  };

  const handleGenerateRewrites = async () => {
    const proResult = getActiveProResultFromDraft();
    if (!proResult) {
      setRewritesError("Run Audit + Wizard first so Pro Mode has a full draft to rewrite.");
      return;
    }

    setRewritesLoading(true);
    setRewritesError(null);

    try {
      const res = await fetch("/api/google-business/pro/rewrites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proResult,
          tone: selectedRewriteTone,
          emphasisNotes: emphasisNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setRewritesResult(data);
    } catch (error) {
      console.error("Error generating rewrites:", error);
      setRewritesError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating rewrites. Please try again."
      );
    } finally {
      setRewritesLoading(false);
    }
  };

  const handleGeneratePhotoOptimization = async () => {
    const proResult = getActiveProResultFromDraft();
    if (!proResult) {
      setPhotoError("Run Audit + Wizard first so Pro Mode has a full draft to use for photo optimization.");
      return;
    }

    setPhotoLoading(true);
    setPhotoError(null);

    try {
      const res = await fetch("/api/google-business/pro/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proResult,
          currentPhotoContext: currentPhotoContext.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setPhotoResult(data);
    } catch (error) {
      console.error("Error generating photo optimization:", error);
      setPhotoError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating photo suggestions. Please try again."
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleAnalyzeCompetitors = async () => {
    const proResult = getActiveProResultFromDraft();
    if (!proResult) {
      setCompetitorsError("Run Audit + Wizard first so Pro Mode has a full draft to analyze.");
      return;
    }

    const validCompetitors = competitorInputs.filter(c => c.name.trim());
    if (validCompetitors.length === 0) {
      setCompetitorsError("Please add at least one competitor name.");
      return;
    }

    setCompetitorsLoading(true);
    setCompetitorsError(null);

    try {
      // Reconstruct proRequest similar to handleProSubmit
      const wizardServices = textToArray(wizardForm.services);
      const auditServices = textToArray(auditForm.services);
      const wizardKeywords = textToArray(wizardForm.secondaryKeywords);
      const auditKeywords = textToArray(auditForm.secondaryKeywords);

      const proRequest: GoogleBusinessProRequest = {
        businessName: wizardForm.businessName || auditForm.businessName,
        businessType: wizardForm.businessType || auditForm.businessType,
        services: wizardServices.length > 0 ? wizardServices : auditServices,
        city: wizardForm.city || auditForm.city || "Ocala",
        state: wizardForm.state || auditForm.state || "Florida",
        websiteUrl: wizardForm.websiteUrl || auditForm.websiteUrl,
        primaryKeyword: auditForm.primaryKeyword || wizardForm.primaryKeyword,
        secondaryKeywords: auditKeywords.length > 0 ? auditKeywords : wizardKeywords,
        googleBusinessUrl: auditForm.googleBusinessUrl,
        mainCategory: auditForm.mainCategory,
        goals: auditForm.goals,
        shortDescriptionLength: wizardForm.shortDescriptionLength,
        longDescriptionLength: wizardForm.longDescriptionLength,
        serviceAreas: wizardForm.serviceAreas,
        openingHours: wizardForm.openingHours,
        specialities: wizardForm.specialities,
        faqCount: Math.min(Math.max(3, wizardForm.faqCount), 12),
        includePosts: wizardForm.includePosts,
        postGoal: wizardForm.postGoal,
        promoDetails: wizardForm.promoDetails,
        personalityStyle: (wizardForm.personalityStyle || auditForm.personalityStyle) as PersonalityStyle,
        brandVoice: wizardForm.brandVoice || auditForm.brandVoice,
      };

      const res = await fetch("/api/google-business/pro/competitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proRequest,
          proResult,
          competitors: validCompetitors.map(c => ({
            name: c.name.trim(),
            googleBusinessUrl: c.url.trim() || undefined,
            notes: c.notes.trim() || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setCompetitorsResult(data);
    } catch (error) {
      console.error("Error analyzing competitors:", error);
      setCompetitorsError(
        error instanceof Error
          ? error.message
          : "An error occurred while analyzing competitors. Please try again."
      );
    } finally {
      setCompetitorsLoading(false);
    }
  };

  const modeHasGeneratedResult =
    mode === "audit"
      ? Boolean(gbpDraft.generatedContent?.audit)
      : mode === "wizard"
        ? Boolean(gbpDraft.generatedContent?.content)
        : Boolean(activeDraft?.audit || activeDraft?.content);

  const generateDisabled = isSubmitting;
  const regenerateDisabled = isSubmitting || !modeHasGeneratedResult;
  const exportDisabled = isSubmitting || mode !== "pro" || !activeProResult;
  const canProExports = Boolean(activeProResult);
  const resetDisabled =
    isSubmitting ||
    reportLoading ||
    rewritesLoading ||
    photoLoading ||
    competitorsLoading ||
    csvLoading;

  // Deterministic view models for results panels (resolve ONLY from canonical draft selector)
  const auditResult = activeAudit;
  const wizardResult = activeWizard;

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Google Business Profile Pro"
      tagline="Audit, optimize, and rebuild your Google Business Profile for Ocala search visibility."
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

      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 mb-6 mt-4 flex-wrap">
        <button
          type="button"
          onClick={() => setMode("audit")}
          className={`px-6 py-2.5 rounded-full font-medium transition-colors text-sm ${
            mode === "audit"
              ? "bg-[#29c4a9] text-white shadow-sm"
              : isDark
              ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
          }`}
        >
          Audit & Optimize My Google Business Profile
        </button>
        <button
          type="button"
          onClick={() => setMode("wizard")}
          className={`px-6 py-2.5 rounded-full font-medium transition-colors text-sm ${
            mode === "wizard"
              ? "bg-[#29c4a9] text-white shadow-sm"
              : isDark
              ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
          }`}
        >
          Create / Rebuild My Google Business Profile Content
        </button>
        <button
          type="button"
          onClick={() => setMode("pro")}
          className={`px-6 py-2.5 rounded-full font-medium transition-colors text-sm ${
            mode === "pro"
              ? "bg-[#29c4a9] text-white shadow-sm"
              : isDark
              ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
          }`}
        >
          Pro Mode
        </button>
      </div>

      {/* Trust & scope microcopy (Tier 5A, non-dismissable) */}
      <div
        className={`rounded-xl border p-4 mb-6 ${
          isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
        }`}
      >
        <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
          Draft-only tool
        </p>
        <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
          This tool does not connect to or update your live Google Business Profile.
        </p>
        <p className={`text-sm ${themeClasses.mutedText}`}>
          All content generated here is draft-only. You choose what to apply.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4">
          <div className={getErrorPanelClasses(isDark)}>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form Panel */}
        <OBDPanel isDark={isDark} className="mt-7">
          {mode === "pro" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleProSubmit();
              }}
            >
              <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
                <div className="space-y-4">
                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Business Basics"
                    summary={proSectionSummaries.businessBasics}
                    isOpen={proAccordion.businessBasics}
                    onToggle={() => toggleProAccordion("businessBasics")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Pro Mode uses the details you've entered in Audit and Wizard. If something looks missing,
                      switch back and fill it in, then Generate here.
                    </p>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Google Business Profile Details"
                    summary={proSectionSummaries.gbpDetails}
                    isOpen={proAccordion.gbpDetails}
                    onToggle={() => toggleProAccordion("gbpDetails")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Pro Mode combines your profile URL/category (Audit) and content settings (Wizard) into one analysis.
                    </p>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Services & Keywords"
                    summary={proSectionSummaries.servicesKeywords}
                    isOpen={proAccordion.servicesKeywords}
                    onToggle={() => toggleProAccordion("servicesKeywords")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Pro Mode merges services/keywords from your prior inputs to generate an optimized pack.
                    </p>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Brand & Goals"
                    summary={proSectionSummaries.brandGoals}
                    isOpen={proAccordion.brandGoals}
                    onToggle={() => toggleProAccordion("brandGoals")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Uses your personality style, brand voice, and goals to shape recommendations and content.
                    </p>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="FAQs & Posts"
                    summary={proSectionSummaries.faqsPosts}
                    isOpen={proAccordion.faqsPosts}
                    onToggle={() => toggleProAccordion("faqsPosts")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      FAQ and post settings come from Wizard mode and are included in Pro outputs.
                    </p>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Advanced / Optional"
                    summary={proSectionSummaries.advancedOptional}
                    isOpen={proAccordion.advancedOptional}
                    onToggle={() => toggleProAccordion("advancedOptional")}
                  >
                    <div className="space-y-3">
                      <ul className={`space-y-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        <li className="flex items-start gap-2 text-sm">
                          <span className="text-[#29c4a9] mt-1">1.</span>
                          <span>Fill out your details in Audit Mode.</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <span className="text-[#29c4a9] mt-1">2.</span>
                          <span>Fill out your details in Wizard Mode.</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <span className="text-[#29c4a9] mt-1">3.</span>
                          <span>Generate here to see a combined view.</span>
                        </li>
                      </ul>

                      {(wizardForm.businessName || auditForm.businessName) ? (
                        <div className={`p-3 rounded-lg ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
                          <p className={`text-sm ${themeClasses.mutedText}`}>
                            <span className="font-medium">Business:</span>{" "}
                            {wizardForm.businessName || auditForm.businessName}
                            {(wizardForm.city || auditForm.city) ? (
                              <span> • {wizardForm.city || auditForm.city}</span>
                            ) : null}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </GoogleBusinessAccordionSection>
                </div>
              </div>

              <OBDStickyActionBar
                isDark={isDark}
                left={
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${themeClasses.headingText}`}>
                      Draft-only
                    </div>
                    <div className={`text-xs leading-snug ${themeClasses.mutedText}`}>
                      <div>This tool does not connect to or update your live Google Business Profile.</div>
                      <div>All content generated here is draft-only. You choose what to apply.</div>
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  onClick={() => scrollToId("gbp-pro-results")}
                  disabled={isSubmitting || !(activeDraft?.audit || activeDraft?.content)}
                  className={SUBMIT_BUTTON_CLASSES}
                  title="Pro Mode is read-only and renders from your existing draft."
                >
                  View Pro Summary
                </button>

                <button
                  type="button"
                  onClick={() => scrollToId("gbp-pro-export")}
                  disabled={exportDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    isSubmitting
                      ? "Please wait for the current request to finish."
                      : !activeProResult
                        ? "Run Audit + Wizard first to enable Export."
                        : "Jump to Export tools (report + CSV)."
                  }
                >
                  Export
                </button>

                <button
                  type="button"
                  onClick={handleResetEdits}
                  disabled={resetDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    resetDisabled
                      ? "Please wait for any in-progress tasks to finish."
                      : "Reset all edits (generated content is preserved)."
                  }
                >
                  Reset Edits
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={resetDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    resetDisabled
                      ? "Please wait for any in-progress tasks to finish."
                      : "Clear inputs + draft content."
                  }
                >
                  Clear All
                </button>
              </OBDStickyActionBar>
            </form>
          ) : mode === "audit" ? (
            <form onSubmit={handleAuditSubmit}>
              <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
                <div className="space-y-4">
                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Business Basics"
                    summary={auditSectionSummaries.businessBasics}
                    isOpen={auditAccordion.businessBasics}
                    onToggle={() => toggleAuditAccordion("businessBasics")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="audit-businessName"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Business Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="audit-businessName"
                          value={auditForm.businessName}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, businessName: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Ocala Coffee Shop"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="audit-businessType"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Business Type <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="audit-businessType"
                          value={auditForm.businessType}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, businessType: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Restaurant, Retail, Service"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="audit-city"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            City
                          </label>
                          <input
                            type="text"
                            id="audit-city"
                            value={auditForm.city}
                            onChange={(e) =>
                              setAuditForm({ ...auditForm, city: e.target.value })
                            }
                            className={getInputClasses(isDark)}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="audit-state"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            State
                          </label>
                          <input
                            type="text"
                            id="audit-state"
                            value={auditForm.state}
                            onChange={(e) =>
                              setAuditForm({ ...auditForm, state: e.target.value })
                            }
                            className={getInputClasses(isDark)}
                          />
                        </div>
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Google Business Profile Details"
                    summary={auditSectionSummaries.gbpDetails}
                    isOpen={auditAccordion.gbpDetails}
                    onToggle={() => toggleAuditAccordion("gbpDetails")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="audit-websiteUrl"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Website URL (Optional)
                        </label>
                        <input
                          type="url"
                          id="audit-websiteUrl"
                          value={auditForm.websiteUrl}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, websiteUrl: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="https://example.com"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="audit-googleBusinessUrl"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Google Business Profile URL (Optional)
                        </label>
                        <input
                          type="url"
                          id="audit-googleBusinessUrl"
                          value={auditForm.googleBusinessUrl}
                          onChange={(e) =>
                            setAuditForm({
                              ...auditForm,
                              googleBusinessUrl: e.target.value,
                            })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="https://g.page/your-business"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="audit-mainCategory"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Main Category (Optional)
                        </label>
                        <input
                          type="text"
                          id="audit-mainCategory"
                          value={auditForm.mainCategory}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, mainCategory: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Massage Therapist, Restaurant"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Services & Keywords"
                    summary={auditSectionSummaries.servicesKeywords}
                    isOpen={auditAccordion.servicesKeywords}
                    onToggle={() => toggleAuditAccordion("servicesKeywords")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="audit-services"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Services
                        </label>
                        <textarea
                          id="audit-services"
                          value={auditForm.services}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, services: e.target.value })
                          }
                          rows={4}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Comma or line separated (e.g., Massage Therapy, Deep Tissue, Hot Stone)"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="audit-primaryKeyword"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Primary Keyword (Optional)
                        </label>
                        <input
                          type="text"
                          id="audit-primaryKeyword"
                          value={auditForm.primaryKeyword}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, primaryKeyword: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Ocala massage therapist"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="audit-secondaryKeywords"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Secondary Keywords (Optional)
                        </label>
                        <textarea
                          id="audit-secondaryKeywords"
                          value={auditForm.secondaryKeywords}
                          onChange={(e) =>
                            setAuditForm({
                              ...auditForm,
                              secondaryKeywords: e.target.value,
                            })
                          }
                          rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Comma or line separated"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Brand & Goals"
                    summary={auditSectionSummaries.brandGoals}
                    isOpen={auditAccordion.brandGoals}
                    onToggle={() => toggleAuditAccordion("brandGoals")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="audit-personalityStyle"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Personality Style
                        </label>
                        <select
                          id="audit-personalityStyle"
                          value={auditForm.personalityStyle}
                          onChange={(e) =>
                            setAuditForm({
                              ...auditForm,
                              personalityStyle: e.target.value as PersonalityStyle,
                            })
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
                          htmlFor="audit-brandVoice"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Brand Voice (Optional)
                        </label>
                        <textarea
                          id="audit-brandVoice"
                          value={auditForm.brandVoice}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, brandVoice: e.target.value })
                          }
                          rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="audit-goals"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Goals (Optional)
                        </label>
                        <textarea
                          id="audit-goals"
                          value={auditForm.goals}
                          onChange={(e) =>
                            setAuditForm({ ...auditForm, goals: e.target.value })
                          }
                          rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="What do you want to improve? (e.g., More calls, More direction requests, Better local ranking)"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="FAQs & Posts"
                    summary={auditSectionSummaries.faqsPosts}
                    isOpen={auditAccordion.faqsPosts}
                    onToggle={() => toggleAuditAccordion("faqsPosts")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Audit mode focuses on analysis and optimization suggestions. FAQs and Posts are generated in Wizard/Pro.
                    </p>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Advanced / Optional"
                    summary={auditSectionSummaries.advancedOptional}
                    isOpen={auditAccordion.advancedOptional}
                    onToggle={() => toggleAuditAccordion("advancedOptional")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Optional fields help improve specificity, but you can generate without them.
                    </p>
                  </GoogleBusinessAccordionSection>
                </div>
              </div>

              <OBDStickyActionBar
                isDark={isDark}
                left={
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${themeClasses.headingText}`}>
                      Draft-only
                    </div>
                    <div className={`text-xs leading-snug ${themeClasses.mutedText}`}>
                      <div>This tool does not connect to or update your live Google Business Profile.</div>
                      <div>All content generated here is draft-only. You choose what to apply.</div>
                    </div>
                  </div>
                }
              >
                <button
                  type="submit"
                  disabled={generateDisabled}
                  className={SUBMIT_BUTTON_CLASSES}
                  title={
                    generateDisabled
                      ? "Please wait for the current request to finish."
                      : "Generate draft output."
                  }
                >
                  {isSubmitting ? "Generating…" : "Generate"}
                </button>

                <button
                  type="button"
                  onClick={() => handleAuditSubmit()}
                  disabled={isSubmitting || !gbpDraft.generatedContent?.audit}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    isSubmitting
                      ? "Please wait for the current request to finish."
                      : !gbpDraft.generatedContent?.audit
                        ? "Generate first to enable Regenerate."
                        : "Regenerate using your current inputs."
                  }
                >
                  Regenerate
                </button>

                <button
                  type="button"
                  onClick={() => scrollToId("gbp-pro-export")}
                  disabled={true}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title="Export is available in Pro Mode."
                >
                  Export
                </button>

                <button
                  type="button"
                  onClick={handleResetEdits}
                  disabled={resetDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    resetDisabled
                      ? "Please wait for any in-progress tasks to finish."
                      : "Reset all edits (generated content is preserved)."
                  }
                >
                  Reset Edits
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={resetDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    resetDisabled
                      ? "Please wait for any in-progress tasks to finish."
                      : "Clear inputs + draft content."
                  }
                >
                  Clear All
                </button>
              </OBDStickyActionBar>
            </form>
          ) : (
            <form onSubmit={handleWizardSubmit}>
              <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
                <div className="space-y-4">
                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Business Basics"
                    summary={wizardSectionSummaries.businessBasics}
                    isOpen={wizardAccordion.businessBasics}
                    onToggle={() => toggleWizardAccordion("businessBasics")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="wizard-businessName"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Business Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="wizard-businessName"
                          value={wizardForm.businessName}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, businessName: e.target.value })
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
                          Business Type <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="wizard-businessType"
                          value={wizardForm.businessType}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, businessType: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Restaurant, Retail, Service"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
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
                            value={wizardForm.city}
                            onChange={(e) =>
                              setWizardForm({ ...wizardForm, city: e.target.value })
                            }
                            className={getInputClasses(isDark)}
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
                            value={wizardForm.state}
                            onChange={(e) =>
                              setWizardForm({ ...wizardForm, state: e.target.value })
                            }
                            className={getInputClasses(isDark)}
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="wizard-websiteUrl"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Website URL (Optional)
                        </label>
                        <input
                          type="url"
                          id="wizard-websiteUrl"
                          value={wizardForm.websiteUrl}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, websiteUrl: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Google Business Profile Details"
                    summary={wizardSectionSummaries.gbpDetails}
                    isOpen={wizardAccordion.gbpDetails}
                    onToggle={() => toggleWizardAccordion("gbpDetails")}
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="wizard-shortDescriptionLength"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Short Description Length
                          </label>
                          <select
                            id="wizard-shortDescriptionLength"
                            value={wizardForm.shortDescriptionLength}
                            onChange={(e) =>
                              setWizardForm({
                                ...wizardForm,
                                shortDescriptionLength: e.target.value as
                                  | "Short"
                                  | "Medium"
                                  | "Long",
                              })
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
                            htmlFor="wizard-longDescriptionLength"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Long Description Length
                          </label>
                          <select
                            id="wizard-longDescriptionLength"
                            value={wizardForm.longDescriptionLength}
                            onChange={(e) =>
                              setWizardForm({
                                ...wizardForm,
                                longDescriptionLength: e.target.value as
                                  | "Short"
                                  | "Medium"
                                  | "Long",
                              })
                            }
                            className={getInputClasses(isDark)}
                          >
                            <option value="Short">Short</option>
                            <option value="Medium">Medium</option>
                            <option value="Long">Long</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="wizard-serviceAreas"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Service Areas (Optional)
                        </label>
                        <textarea
                          id="wizard-serviceAreas"
                          value={wizardForm.serviceAreas}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, serviceAreas: e.target.value })
                          }
                          rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="e.g., Ocala, Gainesville, The Villages"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="wizard-openingHours"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Opening Hours (Optional)
                        </label>
                        <textarea
                          id="wizard-openingHours"
                          value={wizardForm.openingHours}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, openingHours: e.target.value })
                          }
                          rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="e.g., Monday-Friday: 9am-5pm, Saturday: 10am-3pm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="wizard-specialities"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Specialities (Optional)
                        </label>
                        <textarea
                          id="wizard-specialities"
                          value={wizardForm.specialities}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, specialities: e.target.value })
                          }
                          rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="e.g., Deep tissue massage, Sports injury recovery"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Services & Keywords"
                    summary={wizardSectionSummaries.servicesKeywords}
                    isOpen={wizardAccordion.servicesKeywords}
                    onToggle={() => toggleWizardAccordion("servicesKeywords")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="wizard-services"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Services
                        </label>
                        <textarea
                          id="wizard-services"
                          value={wizardForm.services}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, services: e.target.value })
                          }
                          rows={4}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Comma or line separated"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="wizard-primaryKeyword"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Primary Keyword (Optional)
                        </label>
                        <input
                          type="text"
                          id="wizard-primaryKeyword"
                          value={wizardForm.primaryKeyword}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, primaryKeyword: e.target.value })
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Ocala massage therapist"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="wizard-secondaryKeywords"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Secondary Keywords (Optional)
                        </label>
                        <textarea
                          id="wizard-secondaryKeywords"
                          value={wizardForm.secondaryKeywords}
                          onChange={(e) =>
                            setWizardForm({
                              ...wizardForm,
                              secondaryKeywords: e.target.value,
                            })
                          }
                          rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Comma or line separated"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Brand & Goals"
                    summary={wizardSectionSummaries.brandGoals}
                    isOpen={wizardAccordion.brandGoals}
                    onToggle={() => toggleWizardAccordion("brandGoals")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="wizard-personalityStyle"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Personality Style
                        </label>
                        <select
                          id="wizard-personalityStyle"
                          value={wizardForm.personalityStyle}
                          onChange={(e) =>
                            setWizardForm({
                              ...wizardForm,
                              personalityStyle: e.target.value as PersonalityStyle,
                            })
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
                          htmlFor="wizard-brandVoice"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Brand Voice (Optional)
                        </label>
                        <textarea
                          id="wizard-brandVoice"
                          value={wizardForm.brandVoice}
                          onChange={(e) =>
                            setWizardForm({ ...wizardForm, brandVoice: e.target.value })
                          }
                          rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                        />
                      </div>
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="FAQs & Posts"
                    summary={wizardSectionSummaries.faqsPosts}
                    isOpen={wizardAccordion.faqsPosts}
                    onToggle={() => toggleWizardAccordion("faqsPosts")}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="wizard-faqCount"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          FAQ Count
                        </label>
                        <input
                          type="number"
                          id="wizard-faqCount"
                          value={wizardForm.faqCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setWizardForm({ ...wizardForm, faqCount: 5 });
                              return;
                            }
                            const num = parseInt(val, 10);
                            if (!isNaN(num)) {
                              setWizardForm({
                                ...wizardForm,
                                faqCount: Math.min(Math.max(3, num), 12),
                              });
                            }
                          }}
                          min={3}
                          max={12}
                          className={getInputClasses(isDark)}
                        />
                        <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                          Generate between 3 and 12 FAQs.
                        </p>
                      </div>

                      <div>
                        <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                          <input
                            type="checkbox"
                            checked={wizardForm.includePosts}
                            onChange={(e) =>
                              setWizardForm({ ...wizardForm, includePosts: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className="text-sm font-medium">
                            Include Google Business Posts?
                          </span>
                        </label>
                      </div>

                      {wizardForm.includePosts ? (
                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor="wizard-postGoal"
                              className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                            >
                              Post Goal (Optional)
                            </label>
                            <textarea
                              id="wizard-postGoal"
                              value={wizardForm.postGoal}
                              onChange={(e) =>
                                setWizardForm({ ...wizardForm, postGoal: e.target.value })
                              }
                              rows={2}
                              className={getInputClasses(isDark, "resize-none")}
                              placeholder="e.g., announcements, promotions, events, etc."
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="wizard-promoDetails"
                              className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                            >
                              Promo Details (Optional)
                            </label>
                            <textarea
                              id="wizard-promoDetails"
                              value={wizardForm.promoDetails}
                              onChange={(e) =>
                                setWizardForm({ ...wizardForm, promoDetails: e.target.value })
                              }
                              rows={2}
                              className={getInputClasses(isDark, "resize-none")}
                              placeholder="e.g., current offers, seasonal specials, etc."
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </GoogleBusinessAccordionSection>

                  <GoogleBusinessAccordionSection
                    isDark={isDark}
                    title="Advanced / Optional"
                    summary={wizardSectionSummaries.advancedOptional}
                    isOpen={wizardAccordion.advancedOptional}
                    onToggle={() => toggleWizardAccordion("advancedOptional")}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Optional fields help personalize outputs. You can generate with only the required basics.
                    </p>
                  </GoogleBusinessAccordionSection>
                </div>
              </div>

              <OBDStickyActionBar
                isDark={isDark}
                left={
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${themeClasses.headingText}`}>
                      Draft-only
                    </div>
                    <div className={`text-xs leading-snug ${themeClasses.mutedText}`}>
                      <div>This tool does not connect to or update your live Google Business Profile.</div>
                      <div>All content generated here is draft-only. You choose what to apply.</div>
                    </div>
                  </div>
                }
              >
                <button
                  type="submit"
                  disabled={generateDisabled}
                  className={SUBMIT_BUTTON_CLASSES}
                  title={
                    generateDisabled
                      ? "Please wait for the current request to finish."
                      : "Generate draft output."
                  }
                >
                  {isSubmitting ? "Generating…" : "Generate"}
                </button>

                <button
                  type="button"
                  onClick={() => handleWizardSubmit()}
                  disabled={isSubmitting || !gbpDraft.generatedContent?.content}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    isSubmitting
                      ? "Please wait for the current request to finish."
                      : !gbpDraft.generatedContent?.content
                        ? "Generate first to enable Regenerate."
                        : "Regenerate using your current inputs."
                  }
                >
                  Regenerate
                </button>

                <button
                  type="button"
                  onClick={() => scrollToId("gbp-pro-export")}
                  disabled={true}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title="Export is available in Pro Mode."
                >
                  Export
                </button>

                <button
                  type="button"
                  onClick={handleResetEdits}
                  disabled={resetDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    resetDisabled
                      ? "Please wait for any in-progress tasks to finish."
                      : "Reset all edits (generated content is preserved)."
                  }
                >
                  Reset Edits
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={resetDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title={
                    resetDisabled
                      ? "Please wait for any in-progress tasks to finish."
                      : "Clear inputs + draft content."
                  }
                >
                  Clear All
                </button>
              </OBDStickyActionBar>
            </form>
          )}
        </OBDPanel>

        {/* Right: Results Panel */}
        <OBDPanel isDark={isDark} className="mt-7">
          {mode === "pro" ? (
            <>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Pro Mode Results
              </OBDHeading>
              {activeAudit || activeWizard ? (
                <div className="space-y-6">
                  {/* Pro Audit Overview */}
                  {activeAudit ? (
                  <div className={`rounded-xl border-2 p-6 ${
                    isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📊</span>
                        <h3 className={`text-lg font-bold ${themeClasses.headingText}`}>
                          Pro Audit Overview
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          isDark ? "bg-[#29c4a9]/20 text-[#29c4a9]" : "bg-[#29c4a9]/10 text-[#29c4a9]"
                        }`}>
                          From Draft
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMode("audit")}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        View full audit in Audit Mode
                      </button>
                    </div>
                    <div className={`rounded-xl border p-6 text-center mb-4 ${
                      isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                    }`}>
                      <div className="mb-3">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}>
                          Audit Score
                        </span>
                      </div>
                      <div className="relative mb-4">
                        <div className={`text-5xl font-bold mb-2 ${
                          activeAudit.score >= 80 ? "text-green-500" :
                          activeAudit.score >= 60 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          {activeAudit.score}
                        </div>
                        <div className={`text-sm font-medium ${themeClasses.mutedText}`}>out of 100</div>
                        <div className={`mt-3 h-2 rounded-full overflow-hidden ${
                          isDark ? "bg-slate-700" : "bg-slate-200"
                        }`}>
                          <div
                            className={`h-full transition-all ${
                              activeAudit.score >= 80 ? "bg-green-500" :
                              activeAudit.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${activeAudit.score}%` }}
                          />
                        </div>
                      </div>
                      <p className={`mt-4 text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {activeAudit.summary}
                      </p>
                    </div>
                    {activeAudit.strengths.length > 0 && (
                      <div className="mb-4">
                        <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                          Top Strengths
                        </h4>
                        <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {activeAudit.strengths.slice(0, 5).map((strength, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-green-500 mt-1">✓</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activeAudit.issues.length > 0 && (
                      <div>
                        <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                          Top Issues
                        </h4>
                        <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {activeAudit.issues.slice(0, 5).map((issue, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-red-500 mt-1">✗</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  ) : null}

                  {/* Pro Content Highlights */}
                  {activeWizard ? (
                    <div className={`rounded-xl border-2 p-6 ${
                      isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                    }`}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">✨</span>
                        <h3 className={`text-lg font-bold ${themeClasses.headingText}`}>
                          Pro Content Highlights
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          isDark ? "bg-[#29c4a9]/20 text-[#29c4a9]" : "bg-[#29c4a9]/10 text-[#29c4a9]"
                        }`}>
                          GBP Content
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <EditableTextBlock
                          isDark={isDark}
                          title="Short Description"
                          value={activeWizard.shortDescription}
                          baseline={generatedWizard?.shortDescription}
                          isEdited={isWizardFieldEdited("shortDescription")}
                          extraActions={
                            <button
                              type="button"
                              onClick={() => handleCopy(activeWizard.shortDescription, 100)}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedIndex === 100 ? "Copied!" : "Copy"}
                            </button>
                          }
                          onSave={(next) => updateWizardContent((c) => ({ ...c, shortDescription: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, shortDescription: generatedWizard.shortDescription }))
                              : undefined
                          }
                        />

                        <EditableTextBlock
                          isDark={isDark}
                          title="Long Description"
                          value={activeWizard.longDescription}
                          baseline={generatedWizard?.longDescription}
                          isEdited={isWizardFieldEdited("longDescription")}
                          extraActions={
                            <button
                              type="button"
                              onClick={() => handleCopy(activeWizard.longDescription, 101)}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedIndex === 101 ? "Copied!" : "Copy"}
                            </button>
                          }
                          onSave={(next) => updateWizardContent((c) => ({ ...c, longDescription: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, longDescription: generatedWizard.longDescription }))
                              : undefined
                          }
                        />

                        <EditableTextBlock
                          isDark={isDark}
                          title="Services Section"
                          value={activeWizard.servicesSection}
                          baseline={generatedWizard?.servicesSection}
                          isEdited={isWizardFieldEdited("servicesSection")}
                          extraActions={
                            <button
                              type="button"
                              onClick={() => handleCopy(activeWizard.servicesSection, 102)}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedIndex === 102 ? "Copied!" : "Copy"}
                            </button>
                          }
                          onSave={(next) => updateWizardContent((c) => ({ ...c, servicesSection: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, servicesSection: generatedWizard.servicesSection }))
                              : undefined
                          }
                        />

                        <EditableTextBlock
                          isDark={isDark}
                          title="About Section"
                          value={activeWizard.aboutSection}
                          baseline={generatedWizard?.aboutSection}
                          isEdited={isWizardFieldEdited("aboutSection")}
                          extraActions={
                            <button
                              type="button"
                              onClick={() => handleCopy(activeWizard.aboutSection, 103)}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedIndex === 103 ? "Copied!" : "Copy"}
                            </button>
                          }
                          onSave={(next) => updateWizardContent((c) => ({ ...c, aboutSection: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, aboutSection: generatedWizard.aboutSection }))
                              : undefined
                          }
                        />

                        <EditableFaqsBlock
                          isDark={isDark}
                          title="FAQ Suggestions"
                          value={activeWizard.faqSuggestions as FaqItem[]}
                          baseline={generatedWizard?.faqSuggestions as FaqItem[] | undefined}
                          isEdited={isWizardFieldEdited("faqSuggestions")}
                          onSave={(next) => updateWizardContent((c) => ({ ...c, faqSuggestions: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, faqSuggestions: generatedWizard.faqSuggestions }))
                              : undefined
                          }
                        />

                        <EditableLinesBlock
                          isDark={isDark}
                          title="Post Ideas"
                          value={activeWizard.postIdeas}
                          baseline={generatedWizard?.postIdeas}
                          isEdited={isWizardFieldEdited("postIdeas")}
                          placeholder={"One idea per line"}
                          onSave={(next) => updateWizardContent((c) => ({ ...c, postIdeas: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, postIdeas: generatedWizard.postIdeas }))
                              : undefined
                          }
                        />

                        {(activeWizard.serviceAreaSection || generatedWizard?.serviceAreaSection) ? (
                          <EditableTextBlock
                            isDark={isDark}
                            title="Service Area Section"
                            value={activeWizard.serviceAreaSection ?? ""}
                            baseline={generatedWizard?.serviceAreaSection ?? ""}
                            isEdited={isWizardFieldEdited("serviceAreaSection")}
                            onSave={(next) => updateWizardContent((c) => ({ ...c, serviceAreaSection: next }))}
                            onResetToGenerated={
                              generatedWizard
                                ? () => updateWizardContent((c) => ({ ...c, serviceAreaSection: generatedWizard.serviceAreaSection }))
                                : undefined
                            }
                          />
                        ) : null}

                        {(activeWizard.openingHoursBlurb || generatedWizard?.openingHoursBlurb) ? (
                          <EditableTextBlock
                            isDark={isDark}
                            title="Opening Hours Blurb"
                            value={activeWizard.openingHoursBlurb ?? ""}
                            baseline={generatedWizard?.openingHoursBlurb ?? ""}
                            isEdited={isWizardFieldEdited("openingHoursBlurb")}
                            onSave={(next) => updateWizardContent((c) => ({ ...c, openingHoursBlurb: next }))}
                            onResetToGenerated={
                              generatedWizard
                                ? () => updateWizardContent((c) => ({ ...c, openingHoursBlurb: generatedWizard.openingHoursBlurb }))
                                : undefined
                            }
                          />
                        ) : null}

                        <EditableLinesBlock
                          isDark={isDark}
                          title="Keyword Suggestions"
                          value={activeWizard.keywordSuggestions}
                          baseline={generatedWizard?.keywordSuggestions}
                          isEdited={isWizardFieldEdited("keywordSuggestions")}
                          placeholder={"One keyword phrase per line"}
                          onSave={(next) => updateWizardContent((c) => ({ ...c, keywordSuggestions: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, keywordSuggestions: generatedWizard.keywordSuggestions }))
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Export Center (Single Authoritative Export) */}
                  <div
                    id="gbp-pro-export"
                    className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <h3 className={`text-lg font-semibold mb-2 ${themeClasses.headingText}`}>Export Center</h3>
                    <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                      All exports are built from your active canonical draft (edited-over-generated) via{" "}
                      <span className="font-medium">getActiveGbpDraft()</span>.
                    </p>

                    <GbpExportCenterPanel
                      isDark={isDark}
                      draft={gbpDraft}
                      businessName={wizardForm.businessName || auditForm.businessName}
                      onToast={showToast}
                    />

                    {/* Existing advanced exports (kept here so Export Center is the single source) */}
                    <div className="mt-6 space-y-4">
                      {/* Pro Report Export */}
                      <div
                        className={`rounded-xl border p-4 ${
                          isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"
                        }`}
                      >
                        <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Pro Report (HTML/PDF)</h4>
                        <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                          Generates a clean, printable report. Source-locked to the active draft at click time.
                        </p>
                        {!canProExports && (
                          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                            Run <span className="font-medium">Audit</span> and <span className="font-medium">Wizard</span> first to enable Pro exports.
                          </p>
                        )}
                        {reportError && (
                          <div className={`mb-4 ${getErrorPanelClasses(isDark)}`}>
                            <p className="text-sm">{reportError}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleGenerateReport}
                          disabled={reportLoading || !canProExports}
                          className={SUBMIT_BUTTON_CLASSES}
                          title={!canProExports ? "Run Audit + Wizard first to enable Pro exports." : undefined}
                        >
                          {reportLoading ? "Generating Report..." : "Generate Report"}
                        </button>
                        {reportExport && (
                          <div className="mt-4 space-y-3">
                            <button
                              type="button"
                              onClick={handleViewReport}
                              disabled={!shareUrl && !reportExport.html}
                              className={`w-full px-4 py-2 font-medium rounded-xl transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              View HTML Report
                            </button>
                            {reportPdfUrl && (
                              <button
                                type="button"
                                onClick={handleDownloadPDF}
                                className={`w-full px-4 py-2 font-medium rounded-xl transition-colors ${
                                  isDark
                                    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                                    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                                }`}
                              >
                                Download PDF
                              </button>
                            )}
                            {shareUrl && (
                              <div>
                                <label className={`block text-xs font-medium mb-1 ${themeClasses.labelText}`}>
                                  Shareable Link
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value={shareUrl}
                                    className={getInputClasses(isDark, "flex-1")}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                                      isDark
                                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                    }`}
                                  >
                                    Copy Link
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CSV Export */}
                      <div
                        className={`rounded-xl border p-4 ${
                          isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"
                        }`}
                      >
                        <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>CSV Export (Agency Tools)</h4>
                        <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                          Downloads a CSV summary. Source-locked to the active draft at click time.
                        </p>
                        {!canProExports && (
                          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                            Run <span className="font-medium">Audit</span> and <span className="font-medium">Wizard</span> first to enable Pro exports.
                          </p>
                        )}
                        {csvError && (
                          <div className={`mb-4 ${getErrorPanelClasses(isDark)}`}>
                            <p className="text-sm">{csvError}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleExportCSV}
                          disabled={csvLoading || !canProExports}
                          className={SUBMIT_BUTTON_CLASSES}
                          title={!canProExports ? "Run Audit + Wizard first to enable Pro exports." : undefined}
                        >
                          {csvLoading ? "Generating CSV..." : "Download CSV"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Premium GBP Optimization Pack (AI Rewrites) */}
                  <div className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}>
                    <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                      Premium GBP Optimization Pack (AI Rewrites)
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Tone
                        </label>
                        <select
                          value={selectedRewriteTone}
                          onChange={(e) => setSelectedRewriteTone(e.target.value as GoogleBusinessRewriteTone)}
                          className={getInputClasses(isDark)}
                        >
                          <option value="Default">Default</option>
                          <option value="Soft">Soft</option>
                          <option value="Bold">Bold</option>
                          <option value="High-Energy">High-Energy</option>
                          <option value="Luxury">Luxury</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Emphasis Notes (Optional)
                        </label>
                        <textarea
                          value={emphasisNotes}
                          onChange={(e) => setEmphasisNotes(e.target.value)}
                          rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="e.g., family friendly, late hours, eco-friendly"
                        />
                      </div>
                      {rewritesError && (
                        <div className={getErrorPanelClasses(isDark)}>
                          <p className="text-sm">{rewritesError}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleGenerateRewrites}
                        disabled={rewritesLoading}
                        className={SUBMIT_BUTTON_CLASSES}
                      >
                        {rewritesLoading ? "Generating Rewrites..." : "Generate Optimized Rewrites"}
                      </button>
                      {rewritesResult && (
                        <div className="mt-4 space-y-4">
                          <div className={`rounded-lg border p-4 ${
                            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                                Rewritten Short Description
                              </h4>
                              <button
                                onClick={() => handleCopy(rewritesResult.shortDescription, 200)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedIndex === 200 ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              {rewritesResult.shortDescription}
                            </p>
                          </div>
                          <div className={`rounded-lg border p-4 ${
                            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                                Rewritten Long Description
                              </h4>
                              <button
                                onClick={() => handleCopy(rewritesResult.longDescription, 201)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedIndex === 201 ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              {rewritesResult.longDescription}
                            </p>
                          </div>
                          <div className={`rounded-lg border p-4 ${
                            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                                Rewritten Services Section
                              </h4>
                              <button
                                onClick={() => handleCopy(rewritesResult.servicesSection, 202)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedIndex === 202 ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              {rewritesResult.servicesSection}
                            </p>
                          </div>
                          <div className={`rounded-lg border p-4 ${
                            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                                Rewritten About Section
                              </h4>
                              <button
                                onClick={() => handleCopy(rewritesResult.aboutSection, 203)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedIndex === 203 ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              {rewritesResult.aboutSection}
                            </p>
                          </div>
                          {rewritesResult.premiumNotes && (
                            <div className={`rounded-lg border p-4 ${
                              isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                            }`}>
                              <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                                Premium Optimization Notes
                              </h4>
                              <p className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                {rewritesResult.premiumNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photo & Album Optimization */}
                  <div className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}>
                    <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                      Photo & Album Optimization
                    </h3>
                    <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                      Get caption ideas and album groupings for your GBP photos.
                    </p>
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Current Photo Context (Optional)
                      </label>
                      <textarea
                        value={currentPhotoContext}
                        onChange={(e) => setCurrentPhotoContext(e.target.value)}
                        rows={3}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="Describe your existing photo library or what you typically post"
                      />
                    </div>
                    {photoError && (
                      <div className={`mb-4 ${getErrorPanelClasses(isDark)}`}>
                        <p className="text-sm">{photoError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleGeneratePhotoOptimization}
                      disabled={photoLoading}
                      className={SUBMIT_BUTTON_CLASSES}
                    >
                      {photoLoading ? "Generating Suggestions..." : "Generate Photo Suggestions"}
                    </button>
                    {photoResult && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                              Caption Ideas
                            </h4>
                            <button
                              onClick={() => handleCopy(photoResult.captions.join("\n\n"), 300)}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {copiedIndex === 300 ? "Copied!" : "Copy All"}
                            </button>
                          </div>
                          <ul className={`space-y-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                            {photoResult.captions.map((caption, idx) => (
                              <li key={idx} className="text-sm">• {caption}</li>
                            ))}
                          </ul>
                        </div>
                        {photoResult.albums.length > 0 && (
                          <div>
                            <h4 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                              Album Suggestions
                            </h4>
                            <div className="space-y-3">
                              {photoResult.albums.map((album, idx) => (
                                <div
                                  key={idx}
                                  className={`rounded-lg border p-4 ${
                                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                                  }`}
                                >
                                  <h5 className={`font-semibold mb-2 ${themeClasses.headingText}`}>
                                    {album.albumName}
                                  </h5>
                                  <p className={`text-sm mb-3 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                    {album.description}
                                  </p>
                                  <div className="mb-3">
                                    <p className={`text-xs font-medium mb-2 ${themeClasses.mutedText}`}>
                                      Suggested Images:
                                    </p>
                                    <ul className={`space-y-1 text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                      {album.suggestedImages.map((img, imgIdx) => (
                                        <li key={imgIdx}>• {img}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className={`text-xs font-medium mb-2 ${themeClasses.mutedText}`}>
                                      Keywords:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {album.keywords.map((kw, kwIdx) => (
                                        <span
                                          key={kwIdx}
                                          className={`px-2 py-1 rounded text-xs ${
                                            isDark
                                              ? "bg-slate-700 text-slate-200"
                                              : "bg-slate-200 text-slate-700"
                                          }`}
                                        >
                                          {kw}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Competitor Insights */}
                  <div className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}>
                    <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                      Competitor Insights (Advanced)
                    </h3>
                    <div className="space-y-4">
                      {competitorInputs.map((competitor, idx) => (
                        <div key={idx} className="space-y-2">
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${themeClasses.labelText}`}>
                              Competitor {idx + 1} Name
                            </label>
                            <input
                              type="text"
                              value={competitor.name}
                              onChange={(e) => {
                                const updated = [...competitorInputs];
                                updated[idx].name = e.target.value;
                                setCompetitorInputs(updated);
                              }}
                              className={getInputClasses(isDark)}
                              placeholder="Competitor business name"
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${themeClasses.labelText}`}>
                              Google Business URL (Optional)
                            </label>
                            <input
                              type="url"
                              value={competitor.url}
                              onChange={(e) => {
                                const updated = [...competitorInputs];
                                updated[idx].url = e.target.value;
                                setCompetitorInputs(updated);
                              }}
                              className={getInputClasses(isDark)}
                              placeholder="https://g.page/competitor"
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${themeClasses.labelText}`}>
                              Notes (Optional)
                            </label>
                            <textarea
                              value={competitor.notes}
                              onChange={(e) => {
                                const updated = [...competitorInputs];
                                updated[idx].notes = e.target.value;
                                setCompetitorInputs(updated);
                              }}
                              rows={2}
                              className={getInputClasses(isDark, "resize-none")}
                              placeholder="What you know about this competitor"
                            />
                          </div>
                        </div>
                      ))}
                      {competitorInputs.length < 3 && (
                        <button
                          type="button"
                          onClick={() => setCompetitorInputs([...competitorInputs, { name: "", url: "", notes: "" }])}
                          className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"} hover:underline`}
                        >
                          + Add Another Competitor
                        </button>
                      )}
                      {competitorsError && (
                        <div className={getErrorPanelClasses(isDark)}>
                          <p className="text-sm">{competitorsError}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleAnalyzeCompetitors}
                        disabled={competitorsLoading}
                        className={SUBMIT_BUTTON_CLASSES}
                      >
                        {competitorsLoading ? "Analyzing..." : "Analyze Competitors"}
                      </button>
                      {competitorsResult && (
                        <div className="mt-4 space-y-4">
                          <div className={`rounded-lg border p-4 ${
                            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                          }`}>
                            <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                              Overall Summary
                            </h4>
                            <p className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              {competitorsResult.overallSummary}
                            </p>
                          </div>
                          <div className={`rounded-lg border p-4 ${
                            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                          }`}>
                            <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                              Our Positioning Advice
                            </h4>
                            <p className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              {competitorsResult.ourPositioningAdvice}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs mb-4 ${themeClasses.mutedText} italic`}>
                              Scores are relative estimates based on the information you provided. They're designed to guide positioning, not to be exact metrics.
                            </p>
                            <h4 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                              Competitor Scores
                            </h4>
                            <div className="space-y-3">
                              {competitorsResult.competitorScores.map((score, idx) => {
                                const badgeText = score.relativeScore > 5 ? "Stronger" : score.relativeScore < -5 ? "Weaker" : "Similar";
                                const badgeColor = score.relativeScore > 5 
                                  ? (isDark ? "bg-orange-900/30 text-orange-400 border-orange-700" : "bg-orange-50 text-orange-600 border-orange-200")
                                  : score.relativeScore < -5
                                  ? (isDark ? "bg-[#29c4a9]/20 text-[#29c4a9] border-[#29c4a9]/40" : "bg-[#29c4a9]/10 text-[#29c4a9] border-[#29c4a9]/30")
                                  : (isDark ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-200 text-slate-600 border-slate-300");
                                
                                return (
                                  <div
                                    key={idx}
                                    className={`rounded-lg border p-4 ${
                                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className={`font-semibold ${themeClasses.headingText}`}>
                                        {score.name}
                                      </h5>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium border ${badgeColor}`}>
                                          {badgeText}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                          score.relativeScore > 0
                                            ? isDark ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600"
                                            : score.relativeScore < 0
                                            ? isDark ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-600"
                                            : isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                                        }`}>
                                          {score.relativeScore > 0 ? "+" : ""}{score.relativeScore}
                                        </span>
                                      </div>
                                    </div>
                                    <p className={`text-sm mb-4 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                      {score.summary}
                                    </p>
                                    
                                    {/* Sub-scores */}
                                    <div className="mb-4 space-y-2">
                                      <p className={`text-xs font-semibold mb-2 ${themeClasses.mutedText} uppercase tracking-wide`}>
                                        Sub-Scores
                                      </p>
                                      <div className="grid grid-cols-2 gap-3">
                                        {[
                                          { label: "Visibility", value: score.subScores.visibility },
                                          { label: "Reputation", value: score.subScores.reputation },
                                          { label: "Content", value: score.subScores.contentQuality },
                                          { label: "Offer", value: score.subScores.offerStrength },
                                        ].map((sub, subIdx) => (
                                          <div key={subIdx}>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className={`text-xs font-medium ${themeClasses.mutedText}`}>
                                                {sub.label}
                                              </span>
                                              <span className={`text-xs font-semibold ${
                                                sub.value >= 80 ? "text-green-500" :
                                                sub.value >= 60 ? "text-yellow-500" : "text-red-500"
                                              }`}>
                                                {sub.value}
                                              </span>
                                            </div>
                                            <div className={`h-1.5 rounded-full overflow-hidden ${
                                              isDark ? "bg-slate-700" : "bg-slate-200"
                                            }`}>
                                              <div
                                                className={`h-full transition-all ${
                                                  sub.value >= 80 ? "bg-green-500" :
                                                  sub.value >= 60 ? "bg-yellow-500" : "bg-red-500"
                                                }`}
                                                style={{ width: `${sub.value}%` }}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700">
                                      <div>
                                        <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>
                                          Strengths
                                        </p>
                                        <ul className={`space-y-1 text-xs ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                          {score.strengths.map((s, sIdx) => (
                                            <li key={sIdx}>• {s}</li>
                                          ))}
                                        </ul>
                                      </div>
                                      <div>
                                        <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>
                                          Weaknesses
                                        </p>
                                        <ul className={`space-y-1 text-xs ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                          {score.weaknesses.map((w, wIdx) => (
                                            <li key={wIdx}>• {w}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className={`italic ${themeClasses.mutedText}`}>
                  Run Pro Mode to see a combined summary of your audit score and content pack.
                </p>
              )}
            </>
          ) : mode === "audit" ? (
            <>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Audit Results
              </OBDHeading>
              {auditResult ? (
                <div className="space-y-6">
                  {/* Scorecard */}
                  <div className={`rounded-xl border-2 p-6 text-center ${
                    isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                  }`}>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-2xl">📊</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                        isDark ? "bg-[#29c4a9]/20 text-[#29c4a9]" : "bg-[#29c4a9]/10 text-[#29c4a9]"
                      }`}>
                        Audit Score: {auditResult.score}/100
                      </span>
                    </div>
                    <div className={`text-5xl font-bold mb-2 ${
                      auditResult.score >= 80 ? "text-green-500" :
                      auditResult.score >= 60 ? "text-yellow-500" : "text-red-500"
                    }`}>
                      {auditResult.score}
                    </div>
                    <div className={`text-sm font-medium ${themeClasses.mutedText}`}>out of 100</div>
                    <div className={`mt-4 mb-4 h-2 rounded-full overflow-hidden ${
                      isDark ? "bg-slate-700" : "bg-slate-200"
                    }`}>
                      <div
                        className={`h-full transition-all ${
                          auditResult.score >= 80 ? "bg-green-500" :
                          auditResult.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${auditResult.score}%` }}
                      />
                    </div>
                    <p className={`mt-4 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                      {auditResult.summary}
                    </p>
                  </div>

                  {/* Strengths */}
                  {auditResult.strengths.length > 0 && (
                    <div className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${themeClasses.headingText}`}>
                        <span>✓</span>
                        <span>Strengths</span>
                      </h3>
                      <ul className={`space-y-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {auditResult.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Issues */}
                  {auditResult.issues.length > 0 && (
                    <div className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${themeClasses.headingText}`}>
                        <span>✗</span>
                        <span>Issues Found</span>
                      </h3>
                      <ul className={`space-y-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {auditResult.issues.map((issue, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1">✗</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Quick Wins */}
                  {auditResult.quickWins.length > 0 && (
                    <div className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${themeClasses.headingText}`}>
                        <span>⚡</span>
                        <span>Quick Wins</span>
                      </h3>
                      <ul className={`space-y-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {auditResult.quickWins.map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#29c4a9] mt-1">⚡</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Priority Fixes */}
                  {auditResult.priorityFixes.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                        Priority Fixes
                      </h3>
                      <div className="space-y-3">
                        {auditResult.priorityFixes.map((fix, idx) => {
                          const impactColors = {
                            High: isDark ? "bg-red-900/30 border-red-700 text-red-400" : "bg-red-50 border-red-200 text-red-600",
                            Medium: isDark ? "bg-yellow-900/30 border-yellow-700 text-yellow-400" : "bg-yellow-50 border-yellow-200 text-yellow-600",
                            Low: isDark ? "bg-blue-900/30 border-blue-700 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600",
                          };
                          return (
                            <div
                              key={idx}
                              className={`rounded-lg border p-4 ${
                                isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className={`font-semibold ${themeClasses.headingText}`}>
                                  {fix.title}
                                </h4>
                                <span className={`px-2 py-1 rounded text-xs font-medium border ${impactColors[fix.impact]}`}>
                                  {fix.impact}
                                </span>
                              </div>
                              <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                {fix.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Keyword & Section Suggestions */}
                  <div>
                    <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                      Keyword & Section Suggestions
                    </h3>
                    {auditResult.suggestedKeywords.length > 0 && (
                      <div className="mb-4">
                        <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>Suggested Keywords:</p>
                        <div className="flex flex-wrap gap-2">
                          {auditResult.suggestedKeywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className={`px-3 py-1 rounded-full text-xs ${
                                isDark
                                  ? "bg-slate-800 text-slate-200 border border-slate-700"
                                  : "bg-slate-100 text-slate-700 border border-slate-300"
                              }`}
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {auditResult.suggestedSections.length > 0 && (
                      <div>
                        <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>Suggested Sections:</p>
                        <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {auditResult.suggestedSections.map((section, idx) => (
                            <li key={idx} className="text-sm">• {section}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className={`italic ${themeClasses.mutedText}`}>
                  Run an audit to see your Google Business Profile score and personalized recommendations.
                </p>
              )}
            </>
          ) : (
            <>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Generated Content
              </OBDHeading>
              {wizardResult ? (
                <div className="space-y-6">
                  {/* Business Descriptions Group */}
                  <div className={`rounded-xl border-2 p-4 ${
                    isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">📝</span>
                      <h3 className={`text-sm font-bold ${themeClasses.headingText}`}>
                        Business Descriptions
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <EditableTextBlock
                        isDark={isDark}
                        title="Short Profile Description"
                        value={wizardResult.shortDescription}
                        baseline={generatedWizard?.shortDescription}
                        isEdited={isWizardFieldEdited("shortDescription")}
                        extraActions={
                          <button
                            type="button"
                            onClick={() => handleCopy(wizardResult.shortDescription, 0)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedIndex === 0 ? "Copied!" : "Copy"}
                          </button>
                        }
                        onSave={(next) => updateWizardContent((c) => ({ ...c, shortDescription: next }))}
                        onResetToGenerated={
                          generatedWizard
                            ? () => updateWizardContent((c) => ({ ...c, shortDescription: generatedWizard.shortDescription }))
                            : undefined
                        }
                      />

                      <EditableTextBlock
                        isDark={isDark}
                        title={`Full "From the Business" Description`}
                        value={wizardResult.longDescription}
                        baseline={generatedWizard?.longDescription}
                        isEdited={isWizardFieldEdited("longDescription")}
                        extraActions={
                          <button
                            type="button"
                            onClick={() => handleCopy(wizardResult.longDescription, 1)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedIndex === 1 ? "Copied!" : "Copy"}
                          </button>
                        }
                        onSave={(next) => updateWizardContent((c) => ({ ...c, longDescription: next }))}
                        onResetToGenerated={
                          generatedWizard
                            ? () => updateWizardContent((c) => ({ ...c, longDescription: generatedWizard.longDescription }))
                            : undefined
                        }
                      />
                    </div>
                  </div>

                  {/* Services/About Group */}
                  <div className={`rounded-xl border-2 p-4 ${
                    isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">💼</span>
                      <h3 className={`text-sm font-bold ${themeClasses.headingText}`}>
                        Services & About
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <EditableTextBlock
                        isDark={isDark}
                        title="Services Section"
                        value={wizardResult.servicesSection}
                        baseline={generatedWizard?.servicesSection}
                        isEdited={isWizardFieldEdited("servicesSection")}
                        extraActions={
                          <button
                            type="button"
                            onClick={() => handleCopy(wizardResult.servicesSection, 2)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedIndex === 2 ? "Copied!" : "Copy"}
                          </button>
                        }
                        onSave={(next) => updateWizardContent((c) => ({ ...c, servicesSection: next }))}
                        onResetToGenerated={
                          generatedWizard
                            ? () => updateWizardContent((c) => ({ ...c, servicesSection: generatedWizard.servicesSection }))
                            : undefined
                        }
                      />

                      <EditableTextBlock
                        isDark={isDark}
                        title="About / Story Section"
                        value={wizardResult.aboutSection}
                        baseline={generatedWizard?.aboutSection}
                        isEdited={isWizardFieldEdited("aboutSection")}
                        extraActions={
                          <button
                            type="button"
                            onClick={() => handleCopy(wizardResult.aboutSection, 3)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedIndex === 3 ? "Copied!" : "Copy"}
                          </button>
                        }
                        onSave={(next) => updateWizardContent((c) => ({ ...c, aboutSection: next }))}
                        onResetToGenerated={
                          generatedWizard
                            ? () => updateWizardContent((c) => ({ ...c, aboutSection: generatedWizard.aboutSection }))
                            : undefined
                        }
                      />

                      {(wizardResult.serviceAreaSection || generatedWizard?.serviceAreaSection) ? (
                        <EditableTextBlock
                          isDark={isDark}
                          title="Service Area Section"
                          value={wizardResult.serviceAreaSection ?? ""}
                          baseline={generatedWizard?.serviceAreaSection ?? ""}
                          isEdited={isWizardFieldEdited("serviceAreaSection")}
                          extraActions={
                            wizardResult.serviceAreaSection ? (
                              <button
                                type="button"
                                onClick={() => handleCopy(wizardResult.serviceAreaSection ?? "", 4)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedIndex === 4 ? "Copied!" : "Copy"}
                              </button>
                            ) : null
                          }
                          onSave={(next) => updateWizardContent((c) => ({ ...c, serviceAreaSection: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, serviceAreaSection: generatedWizard.serviceAreaSection }))
                              : undefined
                          }
                        />
                      ) : null}

                      {(wizardResult.openingHoursBlurb || generatedWizard?.openingHoursBlurb) ? (
                        <EditableTextBlock
                          isDark={isDark}
                          title="Opening Hours Blurb"
                          value={wizardResult.openingHoursBlurb ?? ""}
                          baseline={generatedWizard?.openingHoursBlurb ?? ""}
                          isEdited={isWizardFieldEdited("openingHoursBlurb")}
                          extraActions={
                            wizardResult.openingHoursBlurb ? (
                              <button
                                type="button"
                                onClick={() => handleCopy(wizardResult.openingHoursBlurb ?? "", 5)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {copiedIndex === 5 ? "Copied!" : "Copy"}
                              </button>
                            ) : null
                          }
                          onSave={(next) => updateWizardContent((c) => ({ ...c, openingHoursBlurb: next }))}
                          onResetToGenerated={
                            generatedWizard
                              ? () => updateWizardContent((c) => ({ ...c, openingHoursBlurb: generatedWizard.openingHoursBlurb }))
                              : undefined
                          }
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* FAQs */}
                  <div className={`rounded-xl border-2 p-4 ${
                    isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">❓</span>
                      <h3 className={`text-sm font-bold ${themeClasses.headingText}`}>
                        FAQs
                      </h3>
                    </div>
                    <EditableFaqsBlock
                      isDark={isDark}
                      title="FAQ Suggestions"
                      value={wizardResult.faqSuggestions as FaqItem[]}
                      baseline={generatedWizard?.faqSuggestions as FaqItem[] | undefined}
                      isEdited={isWizardFieldEdited("faqSuggestions")}
                      onSave={(next) => updateWizardContent((c) => ({ ...c, faqSuggestions: next }))}
                      onResetToGenerated={
                        generatedWizard
                          ? () => updateWizardContent((c) => ({ ...c, faqSuggestions: generatedWizard.faqSuggestions }))
                          : undefined
                      }
                    />
                  </div>

                  {/* Post Ideas */}
                  <div className={`rounded-xl border-2 p-4 ${
                    isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">📱</span>
                      <h3 className={`text-sm font-bold ${themeClasses.headingText}`}>
                        Post Ideas
                      </h3>
                    </div>
                    <EditableLinesBlock
                      isDark={isDark}
                      title="Post Ideas"
                      value={wizardResult.postIdeas}
                      baseline={generatedWizard?.postIdeas}
                      isEdited={isWizardFieldEdited("postIdeas")}
                      placeholder={"One idea per line"}
                      onSave={(next) => updateWizardContent((c) => ({ ...c, postIdeas: next }))}
                      onResetToGenerated={
                        generatedWizard
                          ? () => updateWizardContent((c) => ({ ...c, postIdeas: generatedWizard.postIdeas }))
                          : undefined
                      }
                    />
                  </div>

                  {/* Keyword Suggestions */}
                  <div className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}>
                    <EditableLinesBlock
                      isDark={isDark}
                      title="Keyword Suggestions"
                      value={wizardResult.keywordSuggestions}
                      baseline={generatedWizard?.keywordSuggestions}
                      isEdited={isWizardFieldEdited("keywordSuggestions")}
                      placeholder={"One keyword phrase per line"}
                      onSave={(next) => updateWizardContent((c) => ({ ...c, keywordSuggestions: next }))}
                      onResetToGenerated={
                        generatedWizard
                          ? () => updateWizardContent((c) => ({ ...c, keywordSuggestions: generatedWizard.keywordSuggestions }))
                          : undefined
                      }
                    />
                  </div>
                </div>
              ) : (
                <p className={`italic ${themeClasses.mutedText}`}>
                  Fill out your business details and generate ready-to-paste Google Business Profile content.
                </p>
              )}
            </>
          )}
        </OBDPanel>
      </div>
    </OBDPageContainer>
  );
}
