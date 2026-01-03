"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { buildFixSuggestions, previewFixPack, type FixSuggestion, type FixPreview, type FixPackId } from "@/lib/utils/bdw-fix-packs";
import { runBDWHealthCheck } from "@/lib/utils/bdw-health-check";

interface BusinessDescriptionFormValues {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  targetAudience: string;
  uniqueSellingPoints: string;
  keywords: string;
  brandVoice: string;
  personalityStyle?: string | "";
  writingStyleTemplate: string;
  includeFAQSuggestions: boolean;
  includeMetaDescription: boolean;
  descriptionLength: string;
  language: string;
}

interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: {
    facebookBio: string;
    instagramBio: string;
    xBio: string;
    linkedinTagline: string;
  };
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: Array<{
    question: string;
    answer: string;
  }>;
  metaDescription: string | null;
}

// Tier 2A: Fix Preview State Type
type FixTarget = "meta" | "elevator" | "destinations" | "packs";

interface FixPreviewState {
  isOpen: boolean;
  fixId: string; // e.g. "optimize-meta" or similar
  fixTitle: string;
  targetKeys: string[]; // which fields will change
  proposed: Partial<BusinessDescriptionResponse>; // only changed fields
  createdAt: number;
}

interface FixPacksProps {
  formValues: BusinessDescriptionFormValues;
  baseResult: BusinessDescriptionResponse; // Original result
  editedResult: BusinessDescriptionResponse | null; // Current edited state
  onApply: (partialUpdated: Partial<BusinessDescriptionResponse>) => void;
  onReset: () => void;
  onCopyUpdated?: (text: string) => void;
  onSaveImproved?: () => void;
  onPushImprovedToHelpDesk?: () => void;
  onUndo?: () => void; // V5-4: Undo handler
  isV4Enabled: boolean;
  isDark: boolean; // Theme support
  healthReport?: any; // Optional health check report
  businessId?: string | null; // For Help Desk push
}

/**
 * Simple diff highlighting: marks inserted text
 */
function highlightDiff(original: string, updated: string): string {
  if (original === updated) return updated;
  
  // Find the added portion (simple approach: if updated is longer, mark the new part)
  if (updated.length > original.length) {
    const added = updated.substring(original.length);
    // If the added text starts with a space or punctuation, include it in the highlight
    const beforeAdded = updated.substring(0, original.length);
    return beforeAdded + '<mark class="bg-yellow-200 dark:bg-yellow-900/50 px-1 rounded">' + added + '</mark>';
  }
  
  // For replacements (safer_claims), try to find replaced words
  // Simple approach: if lengths are similar, mark the whole updated text with highlights for common replacements
  const riskyWords = ['best', 'guarantee', 'guaranteed', '#1', 'cure', 'miracle', 'always', 'never'];
  let highlighted = updated;
  riskyWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(original) && !regex.test(updated)) {
      // Word was replaced, highlight the replacement
      const replacementMap: Record<string, string> = {
        'best': 'trusted',
        'guarantee': 'committed to',
        'guaranteed': 'committed to',
        '#1': 'highly rated',
        'cure': 'support',
        'miracle': 'proven',
        'always': 'consistently',
        'never': 'avoid',
      };
      const replacement = replacementMap[word.toLowerCase()];
      if (replacement && highlighted.includes(replacement)) {
        highlighted = highlighted.replace(
          new RegExp(`\\b${replacement}\\b`, 'gi'),
          `<mark class="bg-yellow-200 dark:bg-yellow-900/50 px-1 rounded">${replacement}</mark>`
        );
      }
    }
  });
  
  return highlighted;
}

// Tier 2A: Enhanced Before/After comparison view with character counts
function BeforeAfterView({
  original,
  updated,
  fieldName,
  isDark,
}: {
  original: string | null | undefined;
  updated: string;
  fieldName: string;
  isDark: boolean;
}) {
  if (!original) return null;

  const originalCount = original.length;
  const updatedCount = updated.length;
  const countDiff = updatedCount - originalCount;
  const highlightedAfter = highlightDiff(original, updated);

  return (
    <div className={`rounded-lg border ${
      isDark
        ? "bg-slate-900/50 border-slate-600"
        : "bg-white border-slate-300"
    }`}>
      {/* Section Header */}
      <div className={`px-4 py-3 border-b ${
        isDark ? "border-slate-600 bg-slate-800/50" : "border-slate-200 bg-slate-50"
      }`}>
        <div className={`text-sm font-semibold ${
          isDark ? "text-white" : "text-slate-900"
        }`}>
          {fieldName}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* BEFORE Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-xs font-medium ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}>
              BEFORE
            </div>
            <div className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              {originalCount.toLocaleString()} characters
            </div>
          </div>
          <div className={`rounded border p-3 ${
            isDark
              ? "bg-slate-800/50 border-slate-600"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className={`text-sm whitespace-pre-wrap ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}>
              {original}
            </div>
          </div>
        </div>

        {/* AFTER Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-xs font-medium ${
              isDark ? "text-green-400" : "text-green-600"
            }`}>
              AFTER
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-xs ${
                isDark ? "text-green-400" : "text-green-600"
              }`}>
                {updatedCount.toLocaleString()} characters
              </div>
              {countDiff !== 0 && (
                <div className={`text-xs px-1.5 py-0.5 rounded ${
                  countDiff > 0
                    ? isDark
                      ? "bg-green-900/30 text-green-300"
                      : "bg-green-100 text-green-700"
                    : isDark
                    ? "bg-blue-900/30 text-blue-300"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {countDiff > 0 ? "+" : ""}{countDiff}
                </div>
              )}
            </div>
          </div>
          <div className={`rounded border p-3 ${
            isDark
              ? "bg-slate-800/50 border-green-600/50"
              : "bg-green-50/50 border-green-200"
          }`}>
            <div 
              className={`text-sm whitespace-pre-wrap ${
                isDark ? "text-green-200" : "text-green-800"
              }`}
              dangerouslySetInnerHTML={{ __html: highlightedAfter }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Tier 2A: Simple Toast Component
interface ToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: () => void;
  isDark: boolean;
}

function Toast({ message, action, onClose, isDark }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-[60] animate-in slide-in-from-bottom-5">
      <div className={`rounded-lg border shadow-lg p-4 max-w-sm ${
        isDark
          ? "bg-slate-800 border-slate-700 text-white"
          : "bg-white border-slate-200 text-slate-900"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm flex-1">{message}</p>
          <div className="flex items-center gap-2">
            {action && (
              <button
                onClick={action.onClick}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                  isDark
                    ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                    : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                }`}
              >
                {action.label}
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1 rounded transition-colors ${
                isDark
                  ? "hover:bg-slate-700 text-slate-300"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tier 2A: Fix Preview Modal Component
interface FixPreviewModalProps {
  previewState: FixPreviewState | null;
  baseResult: BusinessDescriptionResponse;
  onClose: () => void;
  onApply: (saveAsNewVersion?: boolean) => void;
  onSaveAsNewVersion?: () => void;
  isDark: boolean;
  getFieldName: (field: string) => string;
}

function FixPreviewModal({
  previewState,
  baseResult,
  onClose,
  onApply,
  onSaveAsNewVersion,
  isDark,
  getFieldName,
}: FixPreviewModalProps) {
  if (!previewState || !previewState.isOpen) return null;

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-xl ${
          isDark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
          isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
        }`}>
          <div>
            <h3 className={`text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              {previewState.fixTitle} Preview
            </h3>
            <p className={`text-xs mt-1 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Review changes before applying
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-700 text-slate-300"
                : "hover:bg-slate-100 text-slate-600"
            }`}
            aria-label="Close preview"
          >
            <svg
              className="w-5 h-5"
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

        {/* Content */}
        <div className="p-4 space-y-4">
          {previewState.targetKeys.map((key) => {
            const originalValue = (baseResult as any)[key] || "";
            const proposedValue = (previewState.proposed as any)[key] || "";
            
            return (
              <BeforeAfterView
                key={key}
                original={originalValue}
                updated={proposedValue}
                fieldName={getFieldName(key)}
                isDark={isDark}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 flex items-center justify-between gap-3 p-4 border-t ${
          isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
        }`}>
          <div>
            {onSaveAsNewVersion && (
              <button
                onClick={() => {
                  onSaveAsNewVersion();
                  onClose();
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Apply as New Version
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply(false);
                onClose();
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                  : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
              }`}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FixPacks({
  formValues,
  baseResult,
  editedResult,
  onApply,
  onReset,
  onCopyUpdated,
  onSaveImproved,
  onPushImprovedToHelpDesk,
  onUndo,
  isV4Enabled,
  isDark,
  healthReport,
  businessId,
}: FixPacksProps) {
  // Tier 2A: Preview state management
  const [previewState, setPreviewState] = useState<FixPreviewState | null>(null);
  const [appliedPacks, setAppliedPacks] = useState<Set<FixPackId>>(new Set());
  
  // Tier 2A: Undo snapshot and toast state
  const [lastDisplayResultBeforeApply, setLastDisplayResultBeforeApply] = useState<BusinessDescriptionResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);

  // Use provided health report or generate one
  const healthCheckReport = useMemo(() => {
    if (healthReport) return healthReport;
    if (!isV4Enabled) return null;
    try {
      // Use editedResult if available, otherwise baseResult
      const resultToCheck = editedResult || baseResult;
      return runBDWHealthCheck({
        inputs: {
          businessName: formValues.businessName || "",
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          services: formValues.services || undefined,
          businessType: formValues.businessType || undefined,
        },
        outputs: {
          obdListingDescription: resultToCheck.obdListingDescription || null,
          googleBusinessDescription: resultToCheck.googleBusinessDescription || null,
          websiteAboutUs: resultToCheck.websiteAboutUs || null,
          elevatorPitch: resultToCheck.elevatorPitch || null,
          metaDescription: resultToCheck.metaDescription || null,
        },
      });
    } catch (error) {
      console.error("[FixPacks] Error running health check:", error);
      return null;
    }
  }, [healthReport, formValues, baseResult, editedResult, isV4Enabled]);

  // Build fix suggestions (always use baseResult for suggestions)
  const suggestions = useMemo(() => {
    if (!healthCheckReport || !isV4Enabled) return [];
    try {
      return buildFixSuggestions(
        {
          businessName: formValues.businessName || "",
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          services: formValues.services || undefined,
          businessType: formValues.businessType || undefined,
        },
        {
          obdListingDescription: baseResult.obdListingDescription || null,
          googleBusinessDescription: baseResult.googleBusinessDescription || null,
          websiteAboutUs: baseResult.websiteAboutUs || null,
          elevatorPitch: baseResult.elevatorPitch || null,
          metaDescription: baseResult.metaDescription || null,
        },
        healthCheckReport
      );
    } catch (error) {
      console.error("[FixPacks] Error building suggestions:", error);
      return [];
    }
  }, [formValues, baseResult, healthCheckReport, isV4Enabled]);

  if (!isV4Enabled || suggestions.length === 0) {
    return null;
  }

  // Tier 2A: Handle preview - opens modal with proposed changes
  const handlePreview = (packId: FixPackId, suggestion: FixSuggestion) => {
    try {
      // Generate proposed changes from baseResult (original, untouched)
      const preview = previewFixPack(
        packId,
        {
          businessName: formValues.businessName || "",
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          services: formValues.services || undefined,
          businessType: formValues.businessType || undefined,
        },
        {
          obdListingDescription: baseResult.obdListingDescription || null,
          googleBusinessDescription: baseResult.googleBusinessDescription || null,
          websiteAboutUs: baseResult.websiteAboutUs || null,
          elevatorPitch: baseResult.elevatorPitch || null,
          metaDescription: baseResult.metaDescription || null,
        }
      );

      if (Object.keys(preview.updated).length > 0) {
        // Create preview state - proposed changes stored in memory, baseResult untouched
        const newPreviewState: FixPreviewState = {
          isOpen: true,
          fixId: packId,
          fixTitle: suggestion.title,
          targetKeys: Object.keys(preview.updated),
          proposed: preview.updated as Partial<BusinessDescriptionResponse>,
          createdAt: Date.now(),
        };
        setPreviewState(newPreviewState);
      }
    } catch (error) {
      console.error("[FixPacks] Error generating preview:", error);
      alert("Failed to generate preview. Please try again.");
    }
  };

  // Tier 2A: Close preview modal
  const handleClosePreview = () => {
    setPreviewState(null);
  };

  // Tier 2A: Apply changes from preview modal
  const handleApplyFromPreview = (saveAsNewVersion: boolean = false) => {
    if (!previewState || !previewState.isOpen) return;
    
    // Store snapshot for undo before applying
    const currentDisplayResult = editedResult || baseResult;
    setLastDisplayResultBeforeApply({ ...currentDisplayResult });
    
    // Apply the proposed changes
    onApply(previewState.proposed);
    
    // If this is "AI Recommended Changes", mark all suggested packs as applied
    if (previewState.fixId === "ai-recommended") {
      setAppliedPacks(new Set(suggestions.map((s) => s.id)));
    } else {
      setAppliedPacks(new Set([...appliedPacks, previewState.fixId as FixPackId]));
    }
    
    setPreviewState(null);
    
    // Show toast with undo option
    if (saveAsNewVersion && onSaveImproved) {
      // If save as new version, call save handler
      onSaveImproved();
      setToast({
        message: "Applied and saved as new version",
        action: {
          label: "Undo",
          onClick: handleUndoFromToast,
        },
      });
    } else {
      setToast({
        message: "Changes applied (unsaved)",
        action: {
          label: "Undo",
          onClick: handleUndoFromToast,
        },
      });
    }
  };

  // Tier 2A: Handle undo from toast
  const handleUndoFromToast = () => {
    if (!lastDisplayResultBeforeApply) return;
    
    // Restore the snapshot
    const restoredFields: Partial<BusinessDescriptionResponse> = {};
    const currentDisplayResult = editedResult || baseResult;
    
    // Only restore fields that were changed
    Object.keys(lastDisplayResultBeforeApply).forEach((key) => {
      const typedKey = key as keyof BusinessDescriptionResponse;
      if (currentDisplayResult[typedKey] !== lastDisplayResultBeforeApply[typedKey]) {
        (restoredFields as any)[key] = lastDisplayResultBeforeApply[typedKey];
      }
    });
    
    if (Object.keys(restoredFields).length > 0) {
      onApply(restoredFields);
      setToast({
        message: "Changes undone",
      });
      setLastDisplayResultBeforeApply(null);
    }
  };

  // Tier 2A: Handle save as new version
  const handleSaveAsNewVersion = () => {
    if (!previewState || !previewState.isOpen) return;
    
    // Store snapshot for undo
    const currentDisplayResult = editedResult || baseResult;
    setLastDisplayResultBeforeApply({ ...currentDisplayResult });
    
    // Apply changes first
    onApply(previewState.proposed);
    setAppliedPacks(new Set([...appliedPacks, previewState.fixId as FixPackId]));
    setPreviewState(null);
    
    // Then save as new version
    if (onSaveImproved) {
      onSaveImproved();
      setToast({
        message: "Applied and saved as new version",
        action: {
          label: "Undo",
          onClick: handleUndoFromToast,
        },
      });
    } else {
      setToast({
        message: "Applied (unsaved)",
        action: {
          label: "Undo",
          onClick: handleUndoFromToast,
        },
      });
    }
  };

  const handleApply = (packId: FixPackId) => {
    try {
      // Always preview from baseResult (original)
      const preview = previewFixPack(
        packId,
        {
          businessName: formValues.businessName || "",
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          services: formValues.services || undefined,
          businessType: formValues.businessType || undefined,
        },
        {
          obdListingDescription: baseResult.obdListingDescription || null,
          googleBusinessDescription: baseResult.googleBusinessDescription || null,
          websiteAboutUs: baseResult.websiteAboutUs || null,
          elevatorPitch: baseResult.elevatorPitch || null,
          metaDescription: baseResult.metaDescription || null,
        }
      );

      if (Object.keys(preview.updated).length > 0) {
        onApply(preview.updated as Partial<BusinessDescriptionResponse>);
        setAppliedPacks(new Set([...appliedPacks, packId]));
      }
    } catch (error) {
      console.error("[FixPacks] Error applying fix:", error);
      alert("Failed to apply fix. Please try again.");
    }
  };

  const handleCopyUpdated = async (packId: FixPackId, fieldKey: string) => {
    try {
      const preview = previewFixPack(
        packId,
        {
          businessName: formValues.businessName || "",
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          services: formValues.services || undefined,
          businessType: formValues.businessType || undefined,
        },
        {
          obdListingDescription: baseResult.obdListingDescription || null,
          googleBusinessDescription: baseResult.googleBusinessDescription || null,
          websiteAboutUs: baseResult.websiteAboutUs || null,
          elevatorPitch: baseResult.elevatorPitch || null,
          metaDescription: baseResult.metaDescription || null,
        }
      );

      const updatedText = (preview.updated as any)[fieldKey];
      if (updatedText) {
        await navigator.clipboard.writeText(updatedText);
        if (onCopyUpdated) {
          onCopyUpdated(updatedText);
        } else {
          alert("Copied updated text to clipboard!");
        }
      }
    } catch (error) {
      console.error("[FixPacks] Error copying text:", error);
      alert("Failed to copy text. Please try again.");
    }
  };

  const getFieldName = (field: string): string => {
    const fieldNames: Record<string, string> = {
      obdListingDescription: "Directory Listing",
      googleBusinessDescription: "Google Business Profile",
      websiteAboutUs: "Website About",
      elevatorPitch: "Elevator Pitch",
      metaDescription: "Meta Description",
    };
    return fieldNames[field] || field;
  };

  const hasEdits = editedResult !== null;
  const canPushToHelpDesk = hasEdits && businessId && onPushImprovedToHelpDesk;

  // Tier 2A: Handle "Apply AI Recommended" - opens preview modal instead of applying directly
  const handlePreviewAllRecommended = () => {
    if (suggestions.length === 0) return;
    
    // Build cumulative update from all suggestions in priority order
    // Each fix pack works independently from baseResult, so we apply all to baseResult
    // and merge the results. If multiple fixes modify the same field, the last one wins
    // (but since they're sorted by priority, higher priority fixes come first).
    const cumulativeUpdate: Partial<BusinessDescriptionResponse> = {};
    const allNotes: string[] = [];
    
    // Start with baseResult and apply each fix pack sequentially
    // Use a compatible type for previewFixPack
    let currentResult = {
      obdListingDescription: baseResult.obdListingDescription || null,
      googleBusinessDescription: baseResult.googleBusinessDescription || null,
      websiteAboutUs: baseResult.websiteAboutUs || null,
      elevatorPitch: baseResult.elevatorPitch || null,
      metaDescription: baseResult.metaDescription || null,
    };
    
    suggestions.forEach((suggestion) => {
      const preview = previewFixPack(
        suggestion.id,
        {
          businessName: formValues.businessName || "",
          city: formValues.city || undefined,
          state: formValues.state || undefined,
          services: formValues.services || undefined,
          businessType: formValues.businessType || undefined,
        },
        currentResult // Use current result so fixes build on each other
      );
      
      // Merge preview.updated into cumulative update
      Object.assign(cumulativeUpdate, preview.updated);
      allNotes.push(...preview.notes);
      
      // Update currentResult for next iteration (so fixes can build on previous fixes)
      currentResult = {
        ...currentResult,
        ...preview.updated,
      };
    });
    
    // Only show preview if there are actual changes
    if (Object.keys(cumulativeUpdate).length > 0) {
      const newPreviewState: FixPreviewState = {
        isOpen: true,
        fixId: "ai-recommended", // Special ID for combined preview
        fixTitle: "AI Recommended Changes",
        targetKeys: Object.keys(cumulativeUpdate),
        proposed: cumulativeUpdate as Partial<BusinessDescriptionResponse>,
        createdAt: Date.now(),
      };
      setPreviewState(newPreviewState);
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${
      isDark
        ? "bg-slate-800/50 border-slate-700"
        : "bg-slate-50 border-slate-200"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className={`text-sm font-semibold mb-1 ${
            isDark ? "text-white" : "text-slate-900"
          }`}>
            Premium Fix Packs
          </h3>
          <p className={`text-xs ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Preview improvements before applying — no AI calls, no automatic changes.
          </p>
        </div>
        <div className="flex gap-2">
          {/* V5-4: Undo button */}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!onUndo}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Undo
            </button>
          )}
          {/* Tier 2A: Apply AI Recommended button - opens preview modal */}
          {suggestions.length > 0 && (
            <button
              onClick={handlePreviewAllRecommended}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                  : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
              }`}
            >
              Apply AI Recommended
            </button>
          )}
          {hasEdits && (
            <>
              <button
                onClick={onReset}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Reset edits
              </button>
              {onSaveImproved && (
                <button
                  onClick={onSaveImproved}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                      : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                  }`}
                >
                  Save Improved Version
                </button>
              )}
              {canPushToHelpDesk && (
                <button
                  onClick={onPushImprovedToHelpDesk}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Push Improved to Help Desk
                </button>
              )}
            </>
          )}
        </div>
      </div>


      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const isApplied = appliedPacks.has(suggestion.id);

          return (
            <div
              key={suggestion.id}
              className={`rounded-lg border ${
                isDark
                  ? "bg-slate-900/50 border-slate-600"
                  : "bg-white border-slate-300"
              }`}
            >
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-sm font-medium mb-1 ${
                      isDark ? "text-slate-200" : "text-slate-800"
                    }`}>
                      {suggestion.title}
                      {isApplied && (
                        <span className={`ml-2 text-xs ${
                          isDark ? "text-green-400" : "text-green-600"
                        }`}>
                          ✓ Applied
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}>
                      {suggestion.description}
                    </div>
                  </div>
                  <button
                    onClick={() => handlePreview(suggestion.id, suggestion)}
                    className={`ml-3 px-2 py-1 text-xs font-medium rounded transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Tier 2A: Fix Preview Modal */}
      <FixPreviewModal
        previewState={previewState}
        baseResult={baseResult}
        onClose={handleClosePreview}
        onApply={handleApplyFromPreview}
        onSaveAsNewVersion={onSaveImproved ? handleSaveAsNewVersion : undefined}
        isDark={isDark}
        getFieldName={getFieldName}
      />

      {/* Tier 2A: Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          action={toast.action}
          onClose={() => setToast(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
