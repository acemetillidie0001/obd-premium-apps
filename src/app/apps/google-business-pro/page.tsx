"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import {
  GoogleBusinessAuditRequest,
  GoogleBusinessAuditResult,
  GoogleBusinessWizardRequest,
  GoogleBusinessWizardResult,
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

type Mode = "audit" | "wizard" | "pro";

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

  const [mode, setMode] = useState<Mode>("audit");

  // Audit form state
  const [auditForm, setAuditForm] = useState<Omit<GoogleBusinessAuditRequest, "services" | "secondaryKeywords"> & { services: string; secondaryKeywords: string }>({
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
  });

  // Wizard form state
  const [wizardForm, setWizardForm] = useState<Omit<GoogleBusinessWizardRequest, "services" | "secondaryKeywords"> & { services: string; secondaryKeywords: string }>({
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
  });

  const [auditResult, setAuditResult] = useState<GoogleBusinessAuditResult | null>(null);
  const [wizardResult, setWizardResult] = useState<GoogleBusinessWizardResult | null>(null);
  const [proResult, setProResult] = useState<GoogleBusinessProResult | null>(null);
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

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      const data = await res.json();
      setAuditResult(data);
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while running the audit. Please try again."
      );
      setAuditResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      const data = await res.json();
      setWizardResult(data);
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating content. Please try again."
      );
      setWizardResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProSubmit = async () => {
    // Validate that we have basic info from either form
    const businessName = wizardForm.businessName.trim() || auditForm.businessName.trim();
    const businessType = wizardForm.businessType.trim() || auditForm.businessType.trim();

    if (!businessName || !businessType) {
      setError("Please complete your business details in Audit or Wizard mode before running Pro Mode.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build Pro request payload by merging auditForm and wizardForm
      // wizardForm fields take precedence when both exist
      const wizardServices = textToArray(wizardForm.services);
      const auditServices = textToArray(auditForm.services);
      const wizardKeywords = textToArray(wizardForm.secondaryKeywords);
      const auditKeywords = textToArray(auditForm.secondaryKeywords);

      const payload: GoogleBusinessProRequest = {
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

      const res = await fetch("/api/google-business/pro", {
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

      const data = await res.json();
      setProResult(data);
    } catch (error) {
      console.error("Error in Pro Mode:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while running Pro Mode. Please try again."
      );
      setProResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!proResult) {
      setReportError("Run Pro Mode first to generate a full analysis before using this feature.");
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
    if (!proResult) {
      setCsvError("Run Pro Mode first to generate data for export.");
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
    if (!proResult) {
      setRewritesError("Run Pro Mode first to generate a full analysis before using this feature.");
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
    if (!proResult) {
      setPhotoError("Run Pro Mode first to generate a full analysis before using this feature.");
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
    if (!proResult) {
      setCompetitorsError("Run Pro Mode first to generate a full analysis before using this feature.");
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

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Google Business Profile Pro"
      tagline="Audit, optimize, and rebuild your Google Business Profile for Ocala search visibility."
    >
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
            <div className="space-y-4">
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Run Full Pro Analysis
              </OBDHeading>
              <p className={`${themeClasses.mutedText} mb-4`}>
                Pro Mode uses the details you've already entered in Audit and Wizard to run a full Google Business Profile analysis and generate a complete content pack.
              </p>
              <ul className={`space-y-2 mb-6 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                <li className="flex items-start gap-2">
                  <span className="text-[#29c4a9] mt-1">1.</span>
                  <span>Fill out your details in Audit Mode.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#29c4a9] mt-1">2.</span>
                  <span>Fill out your details in Wizard Mode.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#29c4a9] mt-1">3.</span>
                  <span>Come back here and run Pro Mode to see a combined view.</span>
                </li>
              </ul>
              {(wizardForm.businessName || auditForm.businessName) && (
                <div className={`mb-4 p-3 rounded-lg ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    <span className="font-medium">Business:</span> {wizardForm.businessName || auditForm.businessName}
                    {(wizardForm.city || auditForm.city) && (
                      <span> • {wizardForm.city || auditForm.city}</span>
                    )}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleProSubmit}
                disabled={isSubmitting}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {isSubmitting ? "Running Pro Analysis..." : "Run Pro Audit & Content"}
              </button>
            </div>
          ) : mode === "audit" ? (
            <form onSubmit={handleAuditSubmit}>
              <div className="space-y-4">
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Business Basics
                </OBDHeading>

                <div>
                  <label htmlFor="audit-businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="audit-businessName"
                    value={auditForm.businessName}
                    onChange={(e) => setAuditForm({ ...auditForm, businessName: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="audit-businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="audit-businessType"
                    value={auditForm.businessType}
                    onChange={(e) => setAuditForm({ ...auditForm, businessType: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="audit-services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Services
                  </label>
                  <textarea
                    id="audit-services"
                    value={auditForm.services}
                    onChange={(e) => setAuditForm({ ...auditForm, services: e.target.value })}
                    rows={4}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Comma or line separated (e.g., Massage Therapy, Deep Tissue, Hot Stone)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="audit-city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      City
                    </label>
                    <input
                      type="text"
                      id="audit-city"
                      value={auditForm.city}
                      onChange={(e) => setAuditForm({ ...auditForm, city: e.target.value })}
                      className={getInputClasses(isDark)}
                    />
                  </div>
                  <div>
                    <label htmlFor="audit-state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      State
                    </label>
                    <input
                      type="text"
                      id="audit-state"
                      value={auditForm.state}
                      onChange={(e) => setAuditForm({ ...auditForm, state: e.target.value })}
                      className={getInputClasses(isDark)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="audit-websiteUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Website URL (Optional)
                  </label>
                  <input
                    type="url"
                    id="audit-websiteUrl"
                    value={auditForm.websiteUrl}
                    onChange={(e) => setAuditForm({ ...auditForm, websiteUrl: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com"
                  />
                </div>

                <OBDHeading level={2} isDark={isDark} className="mb-4 mt-6">
                  Google Business Profile Details
                </OBDHeading>

                <div>
                  <label htmlFor="audit-googleBusinessUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Google Business Profile URL (Optional)
                  </label>
                  <input
                    type="url"
                    id="audit-googleBusinessUrl"
                    value={auditForm.googleBusinessUrl}
                    onChange={(e) => setAuditForm({ ...auditForm, googleBusinessUrl: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="https://g.page/your-business"
                  />
                </div>

                <div>
                  <label htmlFor="audit-mainCategory" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Main Category
                  </label>
                  <input
                    type="text"
                    id="audit-mainCategory"
                    value={auditForm.mainCategory}
                    onChange={(e) => setAuditForm({ ...auditForm, mainCategory: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Massage Therapist, Restaurant"
                  />
                </div>

                <div>
                  <label htmlFor="audit-primaryKeyword" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Primary Keyword (Optional)
                  </label>
                  <input
                    type="text"
                    id="audit-primaryKeyword"
                    value={auditForm.primaryKeyword}
                    onChange={(e) => setAuditForm({ ...auditForm, primaryKeyword: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala massage therapist"
                  />
                </div>

                <div>
                  <label htmlFor="audit-secondaryKeywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Secondary Keywords (Optional)
                  </label>
                  <textarea
                    id="audit-secondaryKeywords"
                    value={auditForm.secondaryKeywords}
                    onChange={(e) => setAuditForm({ ...auditForm, secondaryKeywords: e.target.value })}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Comma or line separated"
                  />
                </div>

                <OBDHeading level={2} isDark={isDark} className="mb-4 mt-6">
                  Brand & Goals
                </OBDHeading>

                <div>
                  <label htmlFor="audit-personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Personality Style
                  </label>
                  <select
                    id="audit-personalityStyle"
                    value={auditForm.personalityStyle}
                    onChange={(e) => setAuditForm({ ...auditForm, personalityStyle: e.target.value as PersonalityStyle })}
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
                  <label htmlFor="audit-brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Brand Voice (Optional)
                  </label>
                  <textarea
                    id="audit-brandVoice"
                    value={auditForm.brandVoice}
                    onChange={(e) => setAuditForm({ ...auditForm, brandVoice: e.target.value })}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                  />
                </div>

                <div>
                  <label htmlFor="audit-goals" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Goals (Optional)
                  </label>
                  <textarea
                    id="audit-goals"
                    value={auditForm.goals}
                    onChange={(e) => setAuditForm({ ...auditForm, goals: e.target.value })}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="What do you want to improve? (e.g., More calls, More direction requests, Better local ranking)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {isSubmitting ? "Running Audit..." : "Run Google Business Profile Audit"}
                </button>
                <p className={`text-xs text-center ${themeClasses.mutedText}`}>
                  We'll review your Google Business Profile and suggest improvements you can apply inside your listing.
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleWizardSubmit}>
              <div className="space-y-4">
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Business Basics
                </OBDHeading>

                <div>
                  <label htmlFor="wizard-businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="wizard-businessName"
                    value={wizardForm.businessName}
                    onChange={(e) => setWizardForm({ ...wizardForm, businessName: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="wizard-businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="wizard-businessType"
                    value={wizardForm.businessType}
                    onChange={(e) => setWizardForm({ ...wizardForm, businessType: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="wizard-services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Services
                  </label>
                  <textarea
                    id="wizard-services"
                    value={wizardForm.services}
                    onChange={(e) => setWizardForm({ ...wizardForm, services: e.target.value })}
                    rows={4}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Comma or line separated"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="wizard-city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      City
                    </label>
                    <input
                      type="text"
                      id="wizard-city"
                      value={wizardForm.city}
                      onChange={(e) => setWizardForm({ ...wizardForm, city: e.target.value })}
                      className={getInputClasses(isDark)}
                    />
                  </div>
                  <div>
                    <label htmlFor="wizard-state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      State
                    </label>
                    <input
                      type="text"
                      id="wizard-state"
                      value={wizardForm.state}
                      onChange={(e) => setWizardForm({ ...wizardForm, state: e.target.value })}
                      className={getInputClasses(isDark)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="wizard-websiteUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Website URL (Optional)
                  </label>
                  <input
                    type="url"
                    id="wizard-websiteUrl"
                    value={wizardForm.websiteUrl}
                    onChange={(e) => setWizardForm({ ...wizardForm, websiteUrl: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label htmlFor="wizard-primaryKeyword" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Primary Keyword (Optional)
                  </label>
                  <input
                    type="text"
                    id="wizard-primaryKeyword"
                    value={wizardForm.primaryKeyword}
                    onChange={(e) => setWizardForm({ ...wizardForm, primaryKeyword: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala massage therapist"
                  />
                </div>

                <div>
                  <label htmlFor="wizard-secondaryKeywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Secondary Keywords (Optional)
                  </label>
                  <textarea
                    id="wizard-secondaryKeywords"
                    value={wizardForm.secondaryKeywords}
                    onChange={(e) => setWizardForm({ ...wizardForm, secondaryKeywords: e.target.value })}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Comma or line separated"
                  />
                </div>

                <OBDHeading level={2} isDark={isDark} className="mb-4 mt-6">
                  Profile Content Settings
                </OBDHeading>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="wizard-shortDescriptionLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Short Description Length
                    </label>
                    <select
                      id="wizard-shortDescriptionLength"
                      value={wizardForm.shortDescriptionLength}
                      onChange={(e) => setWizardForm({ ...wizardForm, shortDescriptionLength: e.target.value as "Short" | "Medium" | "Long" })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                      <option value="Long">Long</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="wizard-longDescriptionLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Long Description Length
                    </label>
                    <select
                      id="wizard-longDescriptionLength"
                      value={wizardForm.longDescriptionLength}
                      onChange={(e) => setWizardForm({ ...wizardForm, longDescriptionLength: e.target.value as "Short" | "Medium" | "Long" })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                      <option value="Long">Long</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="wizard-serviceAreas" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Service Areas (Optional)
                  </label>
                  <textarea
                    id="wizard-serviceAreas"
                    value={wizardForm.serviceAreas}
                    onChange={(e) => setWizardForm({ ...wizardForm, serviceAreas: e.target.value })}
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="e.g., Ocala, Gainesville, The Villages"
                  />
                </div>

                <div>
                  <label htmlFor="wizard-openingHours" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Opening Hours (Optional)
                  </label>
                  <textarea
                    id="wizard-openingHours"
                    value={wizardForm.openingHours}
                    onChange={(e) => setWizardForm({ ...wizardForm, openingHours: e.target.value })}
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="e.g., Monday-Friday: 9am-5pm, Saturday: 10am-3pm"
                  />
                </div>

                <div>
                  <label htmlFor="wizard-specialities" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Specialities (Optional)
                  </label>
                  <textarea
                    id="wizard-specialities"
                    value={wizardForm.specialities}
                    onChange={(e) => setWizardForm({ ...wizardForm, specialities: e.target.value })}
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="e.g., Deep tissue massage, Sports injury recovery"
                  />
                </div>

                <OBDHeading level={2} isDark={isDark} className="mb-4 mt-6">
                  Brand & Voice
                </OBDHeading>

                <div>
                  <label htmlFor="wizard-personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Personality Style
                  </label>
                  <select
                    id="wizard-personalityStyle"
                    value={wizardForm.personalityStyle}
                    onChange={(e) => setWizardForm({ ...wizardForm, personalityStyle: e.target.value as PersonalityStyle })}
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
                  <label htmlFor="wizard-brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Brand Voice (Optional)
                  </label>
                  <textarea
                    id="wizard-brandVoice"
                    value={wizardForm.brandVoice}
                    onChange={(e) => setWizardForm({ ...wizardForm, brandVoice: e.target.value })}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                  />
                </div>

                <OBDHeading level={2} isDark={isDark} className="mb-4 mt-6">
                  FAQs & Posts
                </OBDHeading>

                <div>
                  <label htmlFor="wizard-faqCount" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
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
                        setWizardForm({ ...wizardForm, faqCount: Math.min(Math.max(3, num), 12) });
                      }
                    }}
                    min={3}
                    max={12}
                    className={getInputClasses(isDark)}
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Generate between 3 and 12 FAQs.</p>
                </div>

                <div>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={wizardForm.includePosts}
                      onChange={(e) => setWizardForm({ ...wizardForm, includePosts: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm font-medium">Include Google Business Posts?</span>
                  </label>
                </div>

                {wizardForm.includePosts && (
                  <>
                    <div>
                      <label htmlFor="wizard-postGoal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Post Goal (Optional)
                      </label>
                      <textarea
                        id="wizard-postGoal"
                        value={wizardForm.postGoal}
                        onChange={(e) => setWizardForm({ ...wizardForm, postGoal: e.target.value })}
                        rows={2}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="e.g., announcements, promotions, events, etc."
                      />
                    </div>

                    <div>
                      <label htmlFor="wizard-promoDetails" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Promo Details (Optional)
                      </label>
                      <textarea
                        id="wizard-promoDetails"
                        value={wizardForm.promoDetails}
                        onChange={(e) => setWizardForm({ ...wizardForm, promoDetails: e.target.value })}
                        rows={2}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="e.g., current offers, seasonal specials, etc."
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {isSubmitting ? "Generating..." : "Generate Google Business Profile Content"}
                </button>
              </div>
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
              {proResult ? (
                <div className="space-y-6">
                  {/* Pro Audit Overview */}
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
                          From Pro Analysis
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
                          proResult.audit.score >= 80 ? "text-green-500" :
                          proResult.audit.score >= 60 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          {proResult.audit.score}
                        </div>
                        <div className={`text-sm font-medium ${themeClasses.mutedText}`}>out of 100</div>
                        <div className={`mt-3 h-2 rounded-full overflow-hidden ${
                          isDark ? "bg-slate-700" : "bg-slate-200"
                        }`}>
                          <div
                            className={`h-full transition-all ${
                              proResult.audit.score >= 80 ? "bg-green-500" :
                              proResult.audit.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${proResult.audit.score}%` }}
                          />
                        </div>
                      </div>
                      <p className={`mt-4 text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {proResult.audit.summary}
                      </p>
                    </div>
                    {proResult.audit.strengths.length > 0 && (
                      <div className="mb-4">
                        <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                          Top Strengths
                        </h4>
                        <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {proResult.audit.strengths.slice(0, 5).map((strength, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-green-500 mt-1">✓</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {proResult.audit.issues.length > 0 && (
                      <div>
                        <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                          Top Issues
                        </h4>
                        <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {proResult.audit.issues.slice(0, 5).map((issue, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-red-500 mt-1">✗</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Pro Content Highlights */}
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
                      {/* Short Description */}
                      <div className={`rounded-lg border p-4 ${
                        isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            Short Description
                          </h4>
                          <button
                            onClick={() => handleCopy(proResult.content.shortDescription, 100)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedIndex === 100 ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {proResult.content.shortDescription}
                        </p>
                      </div>

                      {/* Long Description */}
                      <div className={`rounded-lg border p-4 ${
                        isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            Long Description
                          </h4>
                          <button
                            onClick={() => handleCopy(proResult.content.longDescription, 101)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {copiedIndex === 101 ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                          {proResult.content.longDescription}
                        </p>
                      </div>

                      {/* Top FAQs */}
                      {proResult.content.faqSuggestions.length > 0 && (
                        <div className={`rounded-lg border p-4 ${
                          isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                        }`}>
                          <h4 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                            Top FAQs
                          </h4>
                          <div className="space-y-3">
                            {proResult.content.faqSuggestions.slice(0, 3).map((faq, idx) => (
                              <div key={idx} className={`pb-3 ${idx < 2 ? "border-b " + (isDark ? "border-slate-700" : "border-slate-200") : ""}`}>
                                <p className={`font-medium mb-1 text-sm ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                                  Q: {faq.question}
                                </p>
                                <p className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                  A: {faq.answer}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Post Ideas */}
                      {proResult.content.postIdeas.length > 0 && (
                        <div className={`rounded-lg border p-4 ${
                          isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                        }`}>
                          <h4 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                            Post Ideas
                          </h4>
                          <ul className={`space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                            {proResult.content.postIdeas.slice(0, 5).map((idea, idx) => (
                              <li key={idx} className="text-sm">• {idea}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export Pro Report */}
                  <div className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}>
                    <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                      Export Pro Report
                    </h3>
                    <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                      Generate a clean, printable report for clients or internal use.
                    </p>
                    {reportError && (
                      <div className={`mb-4 ${getErrorPanelClasses(isDark)}`}>
                        <p className="text-sm">{reportError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleGenerateReport}
                      disabled={reportLoading}
                      className={SUBMIT_BUTTON_CLASSES}
                    >
                      {reportLoading ? "Generating Report..." : "Generate HTML Report"}
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
                  <div className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}>
                    <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                      CSV Export (Agency Tools)
                    </h3>
                    <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                      Download a CSV summary of this Pro analysis for your internal records or reporting.
                    </p>
                    {csvError && (
                      <div className={`mb-4 ${getErrorPanelClasses(isDark)}`}>
                        <p className="text-sm">{csvError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      disabled={!proResult || csvLoading}
                      className={SUBMIT_BUTTON_CLASSES}
                    >
                      {csvLoading ? "Generating CSV..." : "Download CSV"}
                    </button>
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
                    <div className="space-y-4">
                      {/* Short Profile Description */}
                      <div className={`rounded-lg border p-4 ${
                        isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            Short Profile Description
                          </h4>
                      <button
                        onClick={() => handleCopy(wizardResult.shortDescription, 0)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {copiedIndex === 0 ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className={`whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                      {wizardResult.shortDescription}
                    </p>
                  </div>

                      {/* Full Description */}
                      <div className={`rounded-lg border p-4 ${
                        isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            Full "From the Business" Description
                          </h4>
                      <button
                        onClick={() => handleCopy(wizardResult.longDescription, 1)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {copiedIndex === 1 ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className={`whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                      {wizardResult.longDescription}
                    </p>
                  </div>

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
                    <div className="space-y-4">
                      {/* Services Section */}
                      <div className={`rounded-lg border p-4 ${
                        isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            Services Section
                          </h4>
                      <button
                        onClick={() => handleCopy(wizardResult.servicesSection, 2)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {copiedIndex === 2 ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className={`whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                      {wizardResult.servicesSection}
                    </p>
                  </div>

                      {/* About Section */}
                      <div className={`rounded-lg border p-4 ${
                        isDark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            About / Story Section
                          </h4>
                      <button
                        onClick={() => handleCopy(wizardResult.aboutSection, 3)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {copiedIndex === 3 ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className={`whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                      {wizardResult.aboutSection}
                    </p>
                  </div>

                  {/* Service Area Section */}
                  {wizardResult.serviceAreaSection && (
                    <div className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                          Service Area Section
                        </h3>
                        <button
                          onClick={() => handleCopy(wizardResult.serviceAreaSection!, 4)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          {copiedIndex === 4 ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p className={`whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {wizardResult.serviceAreaSection}
                      </p>
                    </div>
                  )}

                  {/* Opening Hours Blurb */}
                  {wizardResult.openingHoursBlurb && (
                    <div className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                          Opening Hours Blurb
                        </h3>
                        <button
                          onClick={() => handleCopy(wizardResult.openingHoursBlurb!, 5)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          {copiedIndex === 5 ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p className={`whitespace-pre-wrap ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {wizardResult.openingHoursBlurb}
                      </p>
                    </div>
                  )}

                    </div>
                  </div>

                  {/* FAQs */}
                  {wizardResult.faqSuggestions.length > 0 && (
                    <div className={`rounded-xl border-2 p-4 ${
                      isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                    }`}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">❓</span>
                        <h3 className={`text-sm font-bold ${themeClasses.headingText}`}>
                          FAQs
                        </h3>
                      </div>
                      <div className="space-y-4">
                        {wizardResult.faqSuggestions.map((faq, idx) => (
                          <div key={idx} className={`pb-4 ${idx < wizardResult.faqSuggestions.length - 1 ? "border-b " + (isDark ? "border-slate-700" : "border-slate-200") : ""}`}>
                            <p className={`font-medium mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                              Q: {faq.question}
                            </p>
                            <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                              A: {faq.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post Ideas */}
                  {wizardResult.postIdeas.length > 0 && (
                    <div className={`rounded-xl border-2 p-4 ${
                      isDark ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-[#29c4a9]/30" : "bg-gradient-to-br from-slate-50 to-white border-[#29c4a9]/20"
                    }`}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">📱</span>
                        <h3 className={`text-sm font-bold ${themeClasses.headingText}`}>
                          Post Ideas
                        </h3>
                      </div>
                      <ul className={`space-y-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                        {wizardResult.postIdeas.map((idea, idx) => (
                          <li key={idx} className="text-sm">• {idea}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Keyword Suggestions */}
                  {wizardResult.keywordSuggestions.length > 0 && (
                    <div className={`rounded-xl border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                        Keyword Suggestions
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {wizardResult.keywordSuggestions.map((keyword, idx) => (
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
