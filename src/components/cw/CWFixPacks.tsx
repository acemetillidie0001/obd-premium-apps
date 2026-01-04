"use client";

import { useState } from "react";
import { runQualityAnalysis, generateSoftenHypeWordsFix, generateRemoveDuplicatesFix } from "@/lib/bdw";

interface ContentSection {
  heading: string;
  body: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface ContentOutput {
  title: string;
  seoTitle: string;
  metaDescription: string;
  slugSuggestion: string;
  outline: string[];
  sections: ContentSection[];
  faq: FAQItem[];
  socialBlurb: string;
  wordCountApprox: number;
  keywordsUsed: string[];
}

interface ContentWriterFormValues {
  services: string;
  keywords: string;
}

interface CWFixPacksProps {
  formValues: ContentWriterFormValues;
  baseContent: ContentOutput;
  editedContent: ContentOutput | null;
  isDark: boolean;
  onApply: (partialUpdated: Partial<ContentOutput>, fixPackId?: string) => void;
  onReset: () => void;
  onUndo?: () => void;
}

// Convert ContentOutput to a format that quality analysis can work with
function contentToBDWFormat(content: ContentOutput) {
  // Combine all sections into a single text block for analysis
  const allSectionsText = content.sections.map(s => `${s.heading}\n${s.body}`).join("\n\n");
  const faqText = content.faq.map(f => `${f.question}\n${f.answer}`).join("\n\n");
  const fullText = `${content.title}\n${content.seoTitle}\n${content.metaDescription}\n${allSectionsText}\n${faqText}\n${content.socialBlurb}`;
  
  return {
    obdListingDescription: allSectionsText.substring(0, 500), // First 500 chars
    websiteAboutUs: allSectionsText,
    googleBusinessDescription: content.metaDescription.substring(0, 750),
    elevatorPitch: content.socialBlurb,
    metaDescription: content.metaDescription,
  };
}

export default function CWFixPacks({
  formValues,
  baseContent,
  editedContent,
  isDark,
  onApply,
  onReset,
  onUndo,
}: CWFixPacksProps) {
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    proposed: Partial<ContentOutput>;
  } | null>(null);

  const displayContent = editedContent ?? baseContent;
  const bdwFormat = contentToBDWFormat(displayContent);
  const analysis = runQualityAnalysis(bdwFormat, formValues.services, formValues.keywords);

  const handlePreviewFix = (fixId: string, fixTitle: string, proposed: Partial<ContentOutput>) => {
    setPreviewState({
      isOpen: true,
      fixId,
      fixTitle,
      proposed,
    });
  };

  const handleApplyFix = () => {
    if (previewState) {
      onApply(previewState.proposed, previewState.fixId);
      setPreviewState(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewState(null);
  };

  // Generate fixes based on quality analysis
  const fixes: Array<{
    id: string;
    title: string;
    description: string;
    proposed: Partial<ContentOutput>;
  }> = [];

  // Fix 1: Soften Hype Words
  if (analysis.hypeWords.some(h => h.count > 0)) {
    const hypeFix = generateSoftenHypeWordsFix(bdwFormat);
    if (hypeFix && Object.keys(hypeFix).length > 0) {
      // Map BDW format back to ContentOutput
      const proposed: Partial<ContentOutput> = {};
      if (hypeFix.websiteAboutUs && hypeFix.websiteAboutUs !== bdwFormat.websiteAboutUs) {
        // Try to apply to sections
        const updatedSections = [...displayContent.sections];
        // Simple approach: update first section that has hype words
        if (updatedSections.length > 0) {
          updatedSections[0] = {
            ...updatedSections[0],
            body: hypeFix.websiteAboutUs.substring(0, updatedSections[0].body.length + 100),
          };
          proposed.sections = updatedSections;
        }
      }
      if (hypeFix.metaDescription && hypeFix.metaDescription !== bdwFormat.metaDescription) {
        proposed.metaDescription = hypeFix.metaDescription;
      }
      if (Object.keys(proposed).length > 0) {
        fixes.push({
          id: "soften-hype",
          title: "Soften Hype Words",
          description: "Replace overly promotional language with more professional alternatives",
          proposed,
        });
      }
    }
  }

  // Fix 2: Remove Duplicates
  if (analysis.repetitions.some(r => r.count > 0)) {
    const dupFix = generateRemoveDuplicatesFix(bdwFormat);
    if (dupFix && Object.keys(dupFix).length > 0) {
      const proposed: Partial<ContentOutput> = {};
      if (dupFix.websiteAboutUs && dupFix.websiteAboutUs !== bdwFormat.websiteAboutUs) {
        const updatedSections = [...displayContent.sections];
        if (updatedSections.length > 0) {
          updatedSections[0] = {
            ...updatedSections[0],
            body: dupFix.websiteAboutUs.substring(0, updatedSections[0].body.length + 100),
          };
          proposed.sections = updatedSections;
        }
      }
      if (Object.keys(proposed).length > 0) {
        fixes.push({
          id: "remove-duplicates",
          title: "Remove Duplicate Sentences",
          description: "Eliminate repetitive phrases for better readability",
          proposed,
        });
      }
    }
  }

  const hasEdits = editedContent !== null;
  const canUndo = !!onUndo;

  return (
    <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          Fix Packs
        </h3>
        {hasEdits && (
          <div className="flex gap-2">
            {canUndo && (
              <button
                onClick={onUndo}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Undo
              </button>
            )}
            <button
              onClick={onReset}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Reset to Original
            </button>
          </div>
        )}
      </div>

      {fixes.length === 0 ? (
        <div className={`text-center py-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          <p className="text-sm">No fixes available. Content looks good!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fixes.map((fix) => (
            <div
              key={fix.id}
              className={`rounded-lg border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`text-sm font-medium mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {fix.title}
                  </h4>
                  <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {fix.description}
                  </p>
                </div>
                <button
                  onClick={() => handlePreviewFix(fix.id, fix.title, fix.proposed)}
                  className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-y-auto ${
            isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Preview: {previewState.fixTitle}
                </h3>
                <button
                  onClick={handleClosePreview}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Close
                </button>
              </div>
              
              <div className="space-y-4 mb-4">
                {Object.entries(previewState.proposed).map(([key, value]) => (
                  <div key={key}>
                    <h4 className={`text-sm font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {key}
                    </h4>
                    <div className={`rounded-lg border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-slate-50 border-slate-300"}`}>
                      <pre className={`text-xs whitespace-pre-wrap ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleApplyFix}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                >
                  Apply Fix
                </button>
                <button
                  onClick={handleClosePreview}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

