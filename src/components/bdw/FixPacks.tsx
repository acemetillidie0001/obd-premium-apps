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

function DiffView({
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

  const highlightedAfter = highlightDiff(original, updated);

  return (
    <div className={`rounded-lg border p-3 mb-3 ${
      isDark
        ? "bg-slate-900/50 border-slate-600"
        : "bg-white border-slate-300"
    }`}>
      <div className={`text-xs font-medium mb-2 ${
        isDark ? "text-slate-300" : "text-slate-700"
      }`}>
        {fieldName}
      </div>
      <div className="space-y-2">
        <div>
          <div className={`text-xs mb-1 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Before:
          </div>
          <div className={`text-sm whitespace-pre-wrap ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}>
            {original}
          </div>
        </div>
        <div className={`border-t ${isDark ? "border-slate-600" : "border-slate-300"}`} />
        <div>
          <div className={`text-xs mb-1 ${
            isDark ? "text-green-400" : "text-green-600"
          }`}>
            After:
          </div>
          <div 
            className={`text-sm whitespace-pre-wrap ${
              isDark ? "text-green-300" : "text-green-700"
            }`}
            dangerouslySetInnerHTML={{ __html: highlightedAfter }}
          />
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
  const [expandedPack, setExpandedPack] = useState<FixPackId | null>(null);
  const [appliedPacks, setAppliedPacks] = useState<Set<FixPackId>>(new Set());
  const [showApplyAllConfirm, setShowApplyAllConfirm] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  const handlePreview = (packId: FixPackId) => {
    const wasExpanded = expandedPack === packId;
    setExpandedPack(wasExpanded ? null : packId);
    
    // V5-4: Smooth scroll to preview container when expanding
    if (!wasExpanded && previewContainerRef.current) {
      setTimeout(() => {
        previewContainerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100); // Small delay to ensure DOM is updated
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
        setExpandedPack(null);
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

  // V5-4: Apply All Recommended handler
  const handleApplyAllRecommended = () => {
    if (suggestions.length === 0) return;
    
    // Build cumulative update from all suggestions in priority order
    // Each fix pack works independently from baseResult, so we apply all to baseResult
    // and merge the results. If multiple fixes modify the same field, the last one wins
    // (but since they're sorted by priority, higher priority fixes come first).
    const cumulativeUpdate: Partial<BusinessDescriptionResponse> = {};
    
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
        {
          obdListingDescription: baseResult.obdListingDescription || null,
          googleBusinessDescription: baseResult.googleBusinessDescription || null,
          websiteAboutUs: baseResult.websiteAboutUs || null,
          elevatorPitch: baseResult.elevatorPitch || null,
          metaDescription: baseResult.metaDescription || null,
        }
      );
      
      // Merge preview.updated into cumulative update
      // Later fixes (lower priority) will overwrite earlier fixes if they modify the same field
      Object.assign(cumulativeUpdate, preview.updated);
    });
    
    // Apply all at once (onApply will push to history before applying)
    if (Object.keys(cumulativeUpdate).length > 0) {
      onApply(cumulativeUpdate);
      setAppliedPacks(new Set(suggestions.map((s) => s.id)));
      setShowApplyAllConfirm(false);
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
          {/* V5-4: Apply All Recommended button */}
          {suggestions.length > 0 && !showApplyAllConfirm && (
            <button
              onClick={() => setShowApplyAllConfirm(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                  : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
              }`}
            >
              Apply All Recommended
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

      {/* V5-4: Apply All Confirmation */}
      {showApplyAllConfirm && (
        <div className={`mb-4 rounded-lg border p-4 ${
          isDark
            ? "bg-slate-900/50 border-slate-600"
            : "bg-white border-slate-300"
        }`}>
          <h4 className={`text-sm font-semibold mb-2 ${
            isDark ? "text-white" : "text-slate-900"
          }`}>
            Apply All Recommended Fixes?
          </h4>
          <p className={`text-xs mb-3 ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}>
            The following {suggestions.length} fix pack{suggestions.length > 1 ? "s" : ""} will be applied:
          </p>
          <ul className={`text-xs mb-4 space-y-1 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}>
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} className="flex items-start gap-2">
                <span className="text-[#29c4a9]">•</span>
                <span>{suggestion.title}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={handleApplyAllRecommended}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                  : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
              }`}
            >
              Apply All Now
            </button>
            <button
              onClick={() => setShowApplyAllConfirm(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const isExpanded = expandedPack === suggestion.id;
          const isApplied = appliedPacks.has(suggestion.id);
          const preview = isExpanded
            ? previewFixPack(
                suggestion.id,
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
              )
            : null;

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
                    onClick={() => handlePreview(suggestion.id)}
                    className={`ml-3 px-2 py-1 text-xs font-medium rounded transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isExpanded ? "Close Preview" : "Preview"}
                  </button>
                </div>
              </div>

              {isExpanded && preview && (
                <div 
                  ref={expandedPack === suggestion.id ? previewContainerRef : null}
                  className={`border-t p-3 ${
                    isDark ? "border-slate-600" : "border-slate-300"
                  }`}
                >
                  {preview.notes.length > 0 && (
                    <div className={`mb-3 text-xs ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}>
                      {preview.notes.map((note, idx) => (
                        <div key={idx}>• {note}</div>
                      ))}
                    </div>
                  )}

                  {Object.entries(preview.updated).map(([key, updatedValue]) => {
                    const originalValue = (baseResult as any)[key];
                    return (
                      <div key={key}>
                        <DiffView
                          original={originalValue}
                          updated={updatedValue}
                          fieldName={getFieldName(key)}
                          isDark={isDark}
                        />
                        <button
                          onClick={() => handleCopyUpdated(suggestion.id, key)}
                          className={`mb-3 px-2 py-1 text-xs font-medium rounded transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          Copy Updated
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApply(suggestion.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isDark
                          ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                          : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                      }`}
                    >
                      Apply Fix
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
