"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getSecondaryButtonClasses,
  getErrorPanelClasses,
} from "@/lib/obd-framework/layout-helpers";
import { parseHandoffFromUrl } from "@/lib/utils/parse-handoff";
import {
  validateWebDraftPayload,
  isValidWebDraftPayload,
} from "@/lib/handoff/validators";
import type { WebDraftPayload } from "@/lib/handoff/types";
import {
  webDraftToMarkdown,
  webDraftToHtml,
} from "@/lib/handoff/serializers/webDraftSerializers";
import {
  gutenbergAdapter,
  diviAdapter,
} from "@/lib/handoff/adapters";
import { getCmsImportInstructions } from "@/lib/handoff/adapters/importHelpers";
import {
  getHandoffHash,
  wasHandoffAlreadyImported,
  markHandoffImported,
} from "@/lib/utils/handoff-guard";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";
import WebDraftImportReadyBanner from "./components/WebDraftImportReadyBanner";
import WebDraftReviewModal from "./components/WebDraftReviewModal";
import EcosystemNextSteps from "@/components/obd/EcosystemNextSteps";

function WebDraftImportPageContent() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  // Handoff state
  const [handoffPayload, setHandoffPayload] = useState<WebDraftPayload | null>(null);
  const [handoffHash, setHandoffHash] = useState<string | null>(null);
  const [isHandoffAlreadyImported, setIsHandoffAlreadyImported] = useState(false);
  const [showImportBanner, setShowImportBanner] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Accepted draft state
  const [acceptedDraft, setAcceptedDraft] = useState<WebDraftPayload | null>(null);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  // Copy state
  const [copiedFormat, setCopiedFormat] = useState<"markdown" | "html" | "gutenberg" | "divi" | null>(null);
  const [copiedInstructions, setCopiedInstructions] = useState<"gutenberg" | "divi" | "all" | null>(null);
  const [lastCmsExport, setLastCmsExport] = useState<"gutenberg" | "divi" | null>(null);

  // Parse handoff payload on mount
  useEffect(() => {
    if (!searchParams || typeof window === "undefined") {
      return;
    }

    const MAX_PAYLOAD_SIZE_BYTES = 150 * 1024; // 150KB

    try {
      // Check size before parsing when raw JSON string is available
      const handoff = searchParams.get("handoff");
      const handoffId = searchParams.get("handoffId");
      let rawJsonString: string | null = null;
      
      if (handoff) {
        // For base64url-encoded payload, decode and check UTF-8 byte size
        try {
          // Convert base64url to base64 (add padding if needed)
          let base64 = handoff.replace(/-/g, "+").replace(/_/g, "/");
          while (base64.length % 4) {
            base64 += "=";
          }
          // Decode base64 to binary string
          const decoded = atob(base64);
          // Convert binary string to UTF-8 bytes to get actual size
          rawJsonString = decoded;
          const decodedSize = new TextEncoder().encode(decoded).length;
          if (decodedSize > MAX_PAYLOAD_SIZE_BYTES) {
            setValidationErrors(["Draft exceeds size limit (150KB)"]);
            setHandoffPayload(null);
            return;
          }
        } catch {
          // If decoding fails, let parseHandoffFromUrl handle it
        }
      } else if (handoffId) {
        // For localStorage payload, check stored string size
        const storageKey = `obd_handoff:${handoffId}`;
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            rawJsonString = stored;
            const storedSize = new TextEncoder().encode(stored).length;
            if (storedSize > MAX_PAYLOAD_SIZE_BYTES) {
              setValidationErrors(["Draft exceeds size limit (150KB)"]);
              setHandoffPayload(null);
              return;
            }
          }
        } catch {
          // If localStorage access fails, let parseHandoffFromUrl handle it
        }
      }

      const result = parseHandoffFromUrl(searchParams, isValidWebDraftPayload);

      // Dev-only logging (without full content)
      if (process.env.NODE_ENV === "development") {
        if (result.payload) {
          const handoffIdValue = searchParams.get("handoffId");
          console.log("[handoff] received web-draft", {
            handoffId: handoffIdValue || undefined,
            source: result.payload.source,
            version: result.payload.version,
          });
        }
      }

      if (result.payload) {
        // Validate with Zod for detailed errors
        const validation = validateWebDraftPayload(result.payload);
        if (!validation.success) {
          // Extract up to 3 validation errors
          const errors = validation.error.split(";").slice(0, 3);
          setValidationErrors(errors);
          setHandoffPayload(null);
          return;
        }

        // Compute hash
        const hash = getHandoffHash(result.payload);
        setHandoffHash(hash);

        // Check if already imported - refuse import if already imported
        const alreadyImported = wasHandoffAlreadyImported("website-draft-import", hash);
        setIsHandoffAlreadyImported(alreadyImported);

        // Refuse to show banner/modal if already imported
        if (alreadyImported) {
          setHandoffPayload(null);
          setValidationErrors([]);
          // Clean up URL params
          const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
          replaceUrlWithoutReload(cleanUrl);
          return;
        }

        setHandoffPayload(validation.data);
        setValidationErrors([]);

        // Show banner if not dismissed
        const dismissedKey = "obd_wdi_dismissed_handoff:web-draft";
        const wasDismissed = sessionStorage.getItem(dismissedKey) === "true";
        if (!wasDismissed) {
          setShowImportBanner(true);
        }
      } else {
        // No valid handoff found
        setHandoffPayload(null);
        setValidationErrors(result.error ? [result.error] : []);
      }
    } catch (error) {
      console.error("Failed to parse handoff payload:", error);
      setValidationErrors(["Failed to parse handoff payload"]);
      setHandoffPayload(null);
    }
  }, [searchParams]);

  // Handle accept draft
  const handleAcceptDraft = () => {
    if (!handoffPayload || !handoffHash) {
      return;
    }

    try {
      // Set accepted draft
      setAcceptedDraft(handoffPayload);

      // Mark handoff as imported
      markHandoffImported("website-draft-import", handoffHash);
      setIsHandoffAlreadyImported(true);

      // Show success toast
      setToast("Website draft ready");
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to accept draft:", error);
      setToast("Failed to accept draft");
      setTimeout(() => setToast(null), 3000);
    } finally {
      // Cleanup always runs (try/finally)
      // Clear handoff params from URL (preserves other params)
      if (typeof window !== "undefined") {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }

      // Clear localStorage handoff key if it exists
      if (typeof window !== "undefined" && searchParams) {
        const handoffId = searchParams.get("handoffId");
        if (handoffId) {
          const storageKey = `obd_handoff:${handoffId}`;
          localStorage.removeItem(storageKey);
        }
      }

      // Clear transient receiver state
      setShowImportBanner(false);
      setShowReviewModal(false);
      setHandoffPayload(null);
      setHandoffHash(null);
    }
  };

  // Handle copy
  const handleCopy = async (format: "markdown" | "html" | "gutenberg" | "divi") => {
    if (!acceptedDraft) return;

    try {
      let content: string;
      let toastMessage: string;
      
      if (format === "markdown") {
        content = webDraftToMarkdown(acceptedDraft);
        toastMessage = "Copied as Markdown";
      } else if (format === "html") {
        content = webDraftToHtml(acceptedDraft);
        toastMessage = "Copied as HTML";
      } else if (format === "gutenberg") {
        content = gutenbergAdapter.generate(acceptedDraft);
        toastMessage = "Copied Gutenberg blocks";
      } else {
        content = diviAdapter.generate(acceptedDraft);
        toastMessage = "Copied Divi HTML";
      }
      
      await navigator.clipboard.writeText(content);
      setCopiedFormat(format);
      // Track CMS export format for suggestion
      if (format === "gutenberg" || format === "divi") {
        setLastCmsExport(format);
      }
      setToast(toastMessage);
      setTimeout(() => {
        setCopiedFormat(null);
        setToast(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      setToast("Failed to copy");
      setTimeout(() => setToast(null), 2000);
    }
  };

  // Handle copy instructions
  const handleCopyInstructions = async (target: "gutenberg" | "divi") => {
    try {
      const instructions = getCmsImportInstructions(target);
      const formattedText = [
        instructions.title,
        "",
        `Best for: ${instructions.bestFor}`,
        "",
        "Steps:",
        ...instructions.steps.map((step, idx) => `${idx + 1}) ${step}`),
        "",
        instructions.gotcha ? `Gotcha: ${instructions.gotcha}` : "",
      ].filter(Boolean).join("\n");

      await navigator.clipboard.writeText(formattedText);
      setCopiedInstructions(target);
      setToast(target === "gutenberg" ? "Copied Gutenberg instructions" : "Copied Divi instructions");
      setTimeout(() => {
        setCopiedInstructions(null);
        setToast(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy instructions:", error);
      setToast("Failed to copy instructions");
      setTimeout(() => setToast(null), 2000);
    }
  };

  // Handle copy all instructions
  const handleCopyAllInstructions = async () => {
    try {
      const gutenbergInstructions = getCmsImportInstructions("gutenberg");
      const diviInstructions = getCmsImportInstructions("divi");

      const formatInstructions = (instructions: ReturnType<typeof getCmsImportInstructions>) => [
        instructions.title,
        "",
        `Best for: ${instructions.bestFor}`,
        "",
        "Steps:",
        ...instructions.steps.map((step, idx) => `${idx + 1}) ${step}`),
        "",
        instructions.gotcha ? `Gotcha: ${instructions.gotcha}` : "",
      ].filter(Boolean);

      const allText = [
        ...formatInstructions(gutenbergInstructions),
        "",
        "---",
        "",
        ...formatInstructions(diviInstructions),
      ].join("\n");

      await navigator.clipboard.writeText(allText);
      setCopiedInstructions("all"); // Show visual feedback
      setToast("Copied CMS instructions");
      setTimeout(() => {
        setCopiedInstructions(null);
        setToast(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy all instructions:", error);
      setToast("Failed to copy instructions");
      setTimeout(() => setToast(null), 2000);
    }
  };

  // Handle download
  const handleDownload = (format: "markdown" | "html" | "gutenberg" | "divi") => {
    if (!acceptedDraft) return;

    try {
      let content: string;
      let toastMessage: string;
      let mimeType: string;
      let extension: string;
      
      if (format === "markdown") {
        content = webDraftToMarkdown(acceptedDraft);
        toastMessage = "Downloaded .md file";
        mimeType = "text/markdown";
        extension = "md";
      } else if (format === "html") {
        content = webDraftToHtml(acceptedDraft);
        toastMessage = "Downloaded .html file";
        mimeType = "text/html";
        extension = "html";
      } else if (format === "gutenberg") {
        content = gutenbergAdapter.generate(acceptedDraft);
        toastMessage = "Downloaded Gutenberg HTML";
        mimeType = "text/html";
        extension = "html";
      } else {
        content = diviAdapter.generate(acceptedDraft);
        toastMessage = "Downloaded Divi HTML";
        mimeType = "text/html";
        extension = "html";
      }
      
      const filename = `${acceptedDraft.content.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${extension}`;

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Track CMS export format for suggestion
      if (format === "gutenberg" || format === "divi") {
        setLastCmsExport(format);
      }

      // Toast for success path
      setToast(toastMessage);
      setTimeout(() => setToast(null), 2000);
    } catch (error) {
      console.error("Failed to download:", error);
      setToast("Failed to download");
      setTimeout(() => setToast(null), 2000);
    }
  };

  // Handle dismiss banner
  const handleDismissBanner = () => {
    setShowImportBanner(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("obd_wdi_dismissed_handoff:web-draft", "true");
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="Website Draft Import"
      tagline="Import and export website content drafts"
    >
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
              isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 border border-slate-200"
            }`}
          >
            {toast}
          </div>
        )}

        {/* Import Ready Banner */}
        {showImportBanner && handoffPayload && !isHandoffAlreadyImported && (
          <WebDraftImportReadyBanner
            isDark={isDark}
            payload={handoffPayload}
            onReview={() => setShowReviewModal(true)}
            onDismiss={handleDismissBanner}
          />
        )}

        {/* Review Modal */}
        {showReviewModal && handoffPayload && (
          <WebDraftReviewModal
            payload={handoffPayload}
            isDark={isDark}
            isAlreadyImported={isHandoffAlreadyImported}
            onClose={() => setShowReviewModal(false)}
            onAccept={handleAcceptDraft}
          />
        )}

        {/* Error State */}
        {validationErrors.length > 0 && (
          <OBDPanel isDark={isDark}>
            <div className={getErrorPanelClasses(isDark)}>
              <h3 className="text-lg font-semibold mb-2">
                {validationErrors[0]?.includes("size limit") ? "Size Limit Exceeded" : "Validation Failed"}
              </h3>
              <ul className="list-disc list-inside space-y-1 mb-4">
                {validationErrors.map((error, idx) => (
                  <li key={idx} className="text-sm">{error}</li>
                ))}
              </ul>
              <Link
                href="/apps/content-writer"
                className={getSecondaryButtonClasses(isDark)}
              >
                Back to AI Content Writer
              </Link>
            </div>
          </OBDPanel>
        )}

        {/* Empty State */}
        {!handoffPayload && !acceptedDraft && validationErrors.length === 0 && (
          <OBDPanel isDark={isDark}>
            <div className="text-center py-8">
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                No draft found
              </h3>
              <p className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Generate content in AI Content Writer to import a draft.
              </p>
              <Link
                href="/apps/content-writer"
                className={getSecondaryButtonClasses(isDark)}
              >
                Go to AI Content Writer
              </Link>
            </div>
          </OBDPanel>
        )}

        {/* Export UI (only shown after accept) */}
        {acceptedDraft && (
          <OBDPanel isDark={isDark}>
            <OBDHeading level={1} isDark={isDark}>Website Draft</OBDHeading>
            <div className="mt-6 space-y-6">
              {/* Export Buttons */}
              <div>
                <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Export Options
                </h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleCopy("markdown")}
                    disabled={!acceptedDraft}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      !acceptedDraft
                        ? "opacity-50 cursor-not-allowed"
                        : copiedFormat === "markdown"
                        ? "bg-[#29c4a9] text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                        : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                    }`}
                  >
                    {copiedFormat === "markdown" ? "Copied!" : "Copy as Markdown"}
                  </button>
                  <button
                    onClick={() => handleCopy("html")}
                    disabled={!acceptedDraft}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      !acceptedDraft
                        ? "opacity-50 cursor-not-allowed"
                        : copiedFormat === "html"
                        ? "bg-[#29c4a9] text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                        : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                    }`}
                  >
                    {copiedFormat === "html" ? "Copied!" : "Copy as HTML"}
                  </button>
                  <button
                    onClick={() => handleCopy("gutenberg")}
                    disabled={!acceptedDraft}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      !acceptedDraft
                        ? "opacity-50 cursor-not-allowed"
                        : copiedFormat === "gutenberg"
                        ? "bg-[#29c4a9] text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                        : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                    }`}
                  >
                    {copiedFormat === "gutenberg" ? "Copied!" : "Copy Gutenberg Blocks"}
                  </button>
                  <button
                    onClick={() => handleCopy("divi")}
                    disabled={!acceptedDraft}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      !acceptedDraft
                        ? "opacity-50 cursor-not-allowed"
                        : copiedFormat === "divi"
                        ? "bg-[#29c4a9] text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                        : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                    }`}
                  >
                    {copiedFormat === "divi" ? "Copied!" : "Copy Divi HTML"}
                  </button>
                  <button
                    onClick={() => handleDownload("markdown")}
                    disabled={!acceptedDraft}
                    className={`${getSecondaryButtonClasses(isDark)} ${!acceptedDraft ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Download .md
                  </button>
                  <button
                    onClick={() => handleDownload("html")}
                    disabled={!acceptedDraft}
                    className={`${getSecondaryButtonClasses(isDark)} ${!acceptedDraft ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Download .html
                  </button>
                  <button
                    onClick={() => handleDownload("gutenberg")}
                    disabled={!acceptedDraft}
                    className={`${getSecondaryButtonClasses(isDark)} ${!acceptedDraft ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Download Gutenberg HTML
                  </button>
                  <button
                    onClick={() => handleDownload("divi")}
                    disabled={!acceptedDraft}
                    className={`${getSecondaryButtonClasses(isDark)} ${!acceptedDraft ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Download Divi HTML
                  </button>
                </div>
              </div>

              {/* CMS Import Helpers */}
              <div>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  CMS Import Helpers
                </h4>
                <p className={`text-xs mb-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Quick steps to paste your draft into WordPress or Divi.
                </p>
                {lastCmsExport && (
                  <p className={`text-xs mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    <span className="font-medium">Which should I use?</span>{" "}
                    {lastCmsExport === "gutenberg"
                      ? "Since you generated a Gutenberg export, use WordPress (Gutenberg) if you're using WordPress."
                      : "Since you generated a Divi export, use Divi Builder if you're using Divi."}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Gutenberg Card */}
                  <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    {(() => {
                      const instructions = getCmsImportInstructions("gutenberg");
                      return (
                        <>
                          <h5 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                            WordPress (Gutenberg)
                          </h5>
                          <p className={`text-xs mb-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            {instructions.bestFor}
                          </p>
                          <ol className={`list-decimal list-inside space-y-2 mb-4 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                            {instructions.steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                          {instructions.gotcha && (
                            <p className={`text-xs italic mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {instructions.gotcha}
                            </p>
                          )}
                          <button
                            onClick={() => handleCopyInstructions("gutenberg")}
                            disabled={!acceptedDraft}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors w-full ${
                              !acceptedDraft
                                ? "opacity-50 cursor-not-allowed"
                                : copiedInstructions === "gutenberg"
                                ? "bg-[#29c4a9] text-white"
                                : isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                            }`}
                          >
                            {copiedInstructions === "gutenberg" ? "Copied!" : "Copy Instructions"}
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Divi Card */}
                  <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    {(() => {
                      const instructions = getCmsImportInstructions("divi");
                      return (
                        <>
                          <h5 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                            Divi Builder
                          </h5>
                          <p className={`text-xs mb-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            {instructions.bestFor}
                          </p>
                          <ol className={`list-decimal list-inside space-y-2 mb-4 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                            {instructions.steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                          {instructions.gotcha && (
                            <p className={`text-xs italic mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {instructions.gotcha}
                            </p>
                          )}
                          <button
                            onClick={() => handleCopyInstructions("divi")}
                            disabled={!acceptedDraft}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors w-full ${
                              !acceptedDraft
                                ? "opacity-50 cursor-not-allowed"
                                : copiedInstructions === "divi"
                                ? "bg-[#29c4a9] text-white"
                                : isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                            }`}
                          >
                            {copiedInstructions === "divi" ? "Copied!" : "Copy Instructions"}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={handleCopyAllInstructions}
                  disabled={!acceptedDraft}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors w-full ${
                    !acceptedDraft
                      ? "opacity-50 cursor-not-allowed"
                      : copiedInstructions === "all"
                      ? "bg-[#29c4a9] text-white"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                      : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                  }`}
                >
                  {copiedInstructions === "all" ? "Copied!" : "Copy All Instructions"}
                </button>
              </div>

              {/* Ecosystem Next Steps */}
              <EcosystemNextSteps
                title="What would you like to do next?"
                steps={[
                  {
                    id: "faq",
                    label: "Generate FAQs",
                    description: "Turn this page into customer-ready FAQs.",
                    href: "/apps/faq-generator",
                    cta: "Generate FAQs",
                  },
                  {
                    id: "schema",
                    label: "Add Page Schema",
                    description: "Improve search visibility with structured data.",
                    href: "/apps/business-schema-generator",
                    cta: "Add Schema",
                  },
                  {
                    id: "helpdesk",
                    label: "Use in AI Help Desk",
                    description: "Answer customer questions automatically using this content.",
                    href: "/apps/ai-help-desk",
                    cta: "Open Help Desk",
                  },
                ]}
                dismissKey="tier5c-website-draft-next-steps"
                isDark={isDark}
              />

              {/* Draft Preview */}
              <div>
                <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Draft Preview
                </h4>
                <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <h5 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {acceptedDraft.content.title}
                  </h5>
                  {acceptedDraft.content.excerpt && (
                    <p className={`text-sm italic mb-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {acceptedDraft.content.excerpt}
                    </p>
                  )}
                  <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {acceptedDraft.content.sections.length} section{acceptedDraft.content.sections.length !== 1 ? "s" : ""}
                    {acceptedDraft.content.callToAction && " • Call to Action"}
                    {acceptedDraft.meta && " • Meta"}
                  </p>
                </div>
              </div>
            </div>
          </OBDPanel>
        )}
      </div>
    </OBDPageContainer>
  );
}

export default function WebDraftImportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WebDraftImportPageContent />
    </Suspense>
  );
}

