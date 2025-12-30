"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type { KnowledgeEntryType } from "./KnowledgeList";

interface PreviewPage {
  url: string;
  title: string;
  content: string;
  preview: string;
  suggestedType: KnowledgeEntryType;
}

interface WebsiteImportProps {
  isDark: boolean;
  businessId: string;
  onImportComplete: () => void;
}

export default function WebsiteImport({
  isDark,
  businessId,
  onImportComplete,
}: WebsiteImportProps) {
  const themeClasses = getThemeClasses(isDark);

  const [url, setUrl] = useState("");
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isAutofilled, setIsAutofilled] = useState(false);
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Basic URL validation
  const isValidUrl = (urlString: string): boolean => {
    if (!urlString.trim()) return false;
    try {
      const url = new URL(urlString.trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Handle URL input change with validation
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    // Mark that user has typed (so we don't overwrite their input)
    if (!hasUserTyped && newUrl.trim()) {
      setHasUserTyped(true);
      // Clear autofilled state if user modifies the autofilled value
      if (isAutofilled) {
        setIsAutofilled(false);
      }
    }
    
    // Clear previous errors
    setError(null);
    
    // Validate URL if it's not empty
    if (newUrl.trim()) {
      if (!isValidUrl(newUrl)) {
        setUrlValidationError("Please enter a valid URL (must start with http:// or https://)");
      } else {
        setUrlValidationError(null);
      }
    } else {
      setUrlValidationError(null);
    }
  };

  // Fetch business website URL on mount if available
  useEffect(() => {
    const fetchBusinessWebsite = async () => {
      // Only fetch if URL is empty and user hasn't typed yet
      if (url.trim() || hasUserTyped || !businessId.trim()) {
        return;
      }

      try {
        const res = await fetch(
          `/api/ai-help-desk/business-profile?businessId=${encodeURIComponent(businessId.trim())}`
        );
        const json = await res.json();

        if (res.ok && json.ok && json.data?.websiteUrl) {
          // Double-check URL is still empty (user hasn't typed while fetch was in progress)
          setUrl((currentUrl) => {
            if (!currentUrl.trim() && !hasUserTyped) {
              setIsAutofilled(true);
              return json.data.websiteUrl;
            }
            return currentUrl;
          });
        }
      } catch (err) {
        // Silently fail - this is a convenience feature
        console.debug("Could not fetch business website URL:", err);
      }
    };

    fetchBusinessWebsite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]); // Only run when businessId changes (intentionally not including url/hasUserTyped to avoid re-fetching)

  // Autofocus the URL input when component mounts and is ready
  useEffect(() => {
    if (urlInputRef.current && !loading && !importing) {
      // Small delay to ensure component is fully rendered
      const timer = setTimeout(() => {
        urlInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, importing]);

  const handlePreview = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!url.trim()) {
      setError("Please enter a website URL");
      return;
    }

    if (!isValidUrl(url)) {
      setUrlValidationError("Please enter a valid URL (must start with http:// or https://)");
      return;
    }

    if (!businessId.trim()) {
      setError("Business ID is required");
      return;
    }

    setLoading(true);
    setError(null);
    setUrlValidationError(null);
    setPreviewPages([]);
    setSelectedPages(new Set());
    setImportSuccess(false);

    try {
      const res = await fetch("/api/ai-help-desk/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          url: url.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to preview website");
      }

      setPreviewPages(json.data.pages || []);
      
      // Auto-select all pages by default
      const allIndices = new Set<number>(json.data.pages.map((_: PreviewPage, idx: number) => idx));
      setSelectedPages(allIndices);
    } catch (err) {
      console.error("Preview error:", err);
      setError(err instanceof Error ? err.message : "Failed to preview website");
      setPreviewPages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePage = (index: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPages(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPages.size === previewPages.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(previewPages.map((_, idx) => idx)));
    }
  };

  const handleImport = async () => {
    if (selectedPages.size === 0) {
      setError("Please select at least one page to import");
      return;
    }

    if (!businessId.trim()) {
      setError("Business ID is required");
      return;
    }

    setImporting(true);
    setError(null);
    setImportSuccess(false);

    try {
      const itemsToImport = Array.from(selectedPages).map((idx) => {
        const page = previewPages[idx];
        return {
          type: page.suggestedType,
          title: page.title,
          content: page.content,
          tags: [] as string[],
        };
      });

      const res = await fetch("/api/ai-help-desk/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          items: itemsToImport,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to import pages");
      }

      setImportSuccess(true);
      setPreviewPages([]);
      setSelectedPages(new Set());
      setUrl("");

      // Notify parent to reload entries
      setTimeout(() => {
        onImportComplete();
        setImportSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Failed to import pages");
    } finally {
      setImporting(false);
    }
  };

  const getTypeLabel = (type: KnowledgeEntryType) => {
    switch (type) {
      case "FAQ":
        return "FAQ";
      case "SERVICE":
        return "Service";
      case "POLICY":
        return "Policy";
      case "NOTE":
        return "Note";
    }
  };

  const getTypeColor = (type: KnowledgeEntryType) => {
    switch (type) {
      case "FAQ":
        return isDark ? "bg-blue-900/30 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800";
      case "SERVICE":
        return isDark ? "bg-green-900/30 border-green-700 text-green-300" : "bg-green-50 border-green-200 text-green-800";
      case "POLICY":
        return isDark ? "bg-purple-900/30 border-purple-700 text-purple-300" : "bg-purple-50 border-purple-200 text-purple-800";
      case "NOTE":
        return isDark ? "bg-yellow-900/30 border-yellow-700 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-800";
    }
  };

  return (
    <OBDPanel isDark={isDark}>
      <div className="space-y-4">
        <OBDHeading level={2} isDark={isDark}>
          Import from Website
        </OBDHeading>

        {/* URL Input */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
            Website URL
          </label>
          <div className="relative w-full">
            <Globe
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? "text-slate-400" : "text-slate-500"
              } opacity-60 pointer-events-none z-10`}
              aria-hidden="true"
            />
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={handleUrlChange}
              className={`${getInputClasses(isDark, "w-full min-w-0")} pl-10`}
              placeholder="https://yourbusiness.com"
              disabled={loading || importing}
              aria-invalid={urlValidationError ? "true" : "false"}
              aria-describedby={urlValidationError ? "url-error" : "url-helper"}
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreview(e);
            }}
            disabled={loading || importing || !url.trim() || !businessId.trim() || !!urlValidationError}
            className={`${SUBMIT_BUTTON_CLASSES} w-full mt-3`}
            aria-disabled={loading || importing || !url.trim() || !businessId.trim() || !!urlValidationError}
          >
            {loading ? "Crawling..." : "Preview Import"}
          </button>
          {urlValidationError ? (
            <p id="url-error" className={`text-sm mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
              {urlValidationError}
            </p>
          ) : isAutofilled && !hasUserTyped ? (
            <p id="url-helper" className={`text-sm mt-1 ${themeClasses.mutedText}`}>
              <span className={isDark ? "text-[#29c4a9]" : "text-[#29c4a9]"}>
                Prefilled from your business profile — you can change it.
              </span>
              {" "}
              <span className={themeClasses.mutedText}>
                We'll crawl up to 10 pages from the same domain.
              </span>
            </p>
          ) : (
            <p id="url-helper" className={`text-sm mt-1 ${themeClasses.mutedText}`}>
              We'll crawl up to 10 pages from the same domain.
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className={getErrorPanelClasses(isDark)}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {importSuccess && (
          <div className={`p-4 rounded-lg border ${
            isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
          }`}>
            <p className={`text-sm ${isDark ? "text-green-300" : "text-green-800"}`}>
              ✓ Successfully imported {selectedPages.size} page{selectedPages.size === 1 ? "" : "s"}!
            </p>
          </div>
        )}

        {/* Preview Pages */}
        {previewPages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className={`font-semibold ${themeClasses.headingText}`}>
                  Found {previewPages.length} page{previewPages.length === 1 ? "" : "s"}
                </h4>
                <p className={`text-sm ${themeClasses.mutedText}`}>
                  Select pages to import into your knowledge base
                </p>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {selectedPages.size === previewPages.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {previewPages.map((page, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    selectedPages.has(idx)
                      ? isDark
                        ? "bg-slate-800 border-[#29c4a9]"
                        : "bg-[#29c4a9]/10 border-[#29c4a9]"
                      : isDark
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedPages.has(idx)}
                      onChange={() => handleTogglePage(idx)}
                      className="mt-1 w-4 h-4 rounded border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${getTypeColor(page.suggestedType)}`}
                        >
                          {getTypeLabel(page.suggestedType)}
                        </span>
                      </div>
                      <h5 className={`font-semibold mb-1 ${themeClasses.headingText}`}>
                        {page.title}
                      </h5>
                      <p className={`text-xs mb-2 ${themeClasses.mutedText} break-all`}>
                        {page.url}
                      </p>
                      <p className={`text-sm line-clamp-2 ${themeClasses.mutedText}`}>
                        {page.preview}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Import Button */}
            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                {selectedPages.size} of {previewPages.length} page{previewPages.length === 1 ? "" : "s"} selected
              </p>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || selectedPages.size === 0}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {importing ? "Importing..." : `Import Selected (${selectedPages.size})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </OBDPanel>
  );
}

