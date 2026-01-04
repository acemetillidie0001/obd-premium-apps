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

interface QualityControlsFormValues {
  services: string;
  keywords: string;
}

interface CWQualityControlsTabProps {
  content: ContentOutput;
  formValues: QualityControlsFormValues;
  isDark: boolean;
  onApplyFix?: (partialUpdated: Partial<ContentOutput>) => void;
}

// Convert ContentOutput to BDW format for analysis
function contentToBDWFormat(content: ContentOutput) {
  const allSectionsText = content.sections.map(s => `${s.heading}\n${s.body}`).join("\n\n");
  const faqText = content.faq.map(f => `${f.question}\n${f.answer}`).join("\n\n");
  const fullText = `${content.title}\n${content.seoTitle}\n${content.metaDescription}\n${allSectionsText}\n${faqText}\n${content.socialBlurb}`;
  
  return {
    obdListingDescription: allSectionsText.substring(0, 500),
    websiteAboutUs: allSectionsText,
    googleBusinessDescription: content.metaDescription.substring(0, 750),
    elevatorPitch: content.socialBlurb,
    metaDescription: content.metaDescription,
  };
}

export default function CWQualityControlsTab({
  content,
  formValues,
  isDark,
  onApplyFix,
}: CWQualityControlsTabProps) {
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    proposed: Partial<ContentOutput>;
  } | null>(null);

  const bdwFormat = contentToBDWFormat(content);
  const analysis = runQualityAnalysis(bdwFormat, formValues.services, formValues.keywords);

  const handlePreviewFix = (
    fixId: string,
    fixTitle: string,
    proposed: Partial<ContentOutput>
  ) => {
    setPreviewState({
      isOpen: true,
      fixId,
      fixTitle,
      proposed,
    });
  };

  const handleApplyFix = () => {
    if (previewState && onApplyFix) {
      onApplyFix(previewState.proposed);
      setPreviewState(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewState(null);
  };

  const hasContent = content.sections.length > 0 || content.metaDescription;

  if (!hasContent) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate content to run quality checks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hype Words Detector */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Hype Words Detector
        </h4>
        <div className="space-y-3">
          {analysis.hypeWords.length > 0 ? (
            analysis.hypeWords.map((item) => (
              <div key={item.section} className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {item.section}:
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.count > 0
                      ? isDark ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-800"
                      : isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-800"
                  }`}>
                    {item.count} found
                  </span>
                  {item.count > 0 && item.words.length > 0 && (
                    <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      ({item.words.join(", ")})
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              No hype words detected. ✓
            </p>
          )}
        </div>
        {analysis.hypeWords.some(h => h.count > 0) && (
          <div className="mt-4">
            <button
              onClick={() => {
                const fix = generateSoftenHypeWordsFix(bdwFormat);
                if (fix && onApplyFix) {
                  const proposed: Partial<ContentOutput> = {};
                  if (fix.metaDescription) {
                    proposed.metaDescription = fix.metaDescription;
                  }
                  if (fix.websiteAboutUs && content.sections.length > 0) {
                    const updatedSections = [...content.sections];
                    updatedSections[0] = {
                      ...updatedSections[0],
                      body: fix.websiteAboutUs.substring(0, updatedSections[0].body.length + 100),
                    };
                    proposed.sections = updatedSections;
                  }
                  if (Object.keys(proposed).length > 0) {
                    handlePreviewFix("soften-hype", "Soften Hype Words", proposed);
                  }
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-[#29c4a9] hover:text-white"
              }`}
            >
              Preview Fix
            </button>
          </div>
        )}
      </div>

      {/* Repetition Detector */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Repetition Detector
        </h4>
        <div className="space-y-3">
          {analysis.repetitions.length > 0 ? (
            analysis.repetitions.map((item) => (
              <div key={item.section} className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {item.section}:
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  item.count > 0
                    ? isDark ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-800"
                    : isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-800"
                }`}>
                  {item.count} duplicates
                </span>
              </div>
            ))
          ) : (
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              No repetitions detected. ✓
            </p>
          )}
        </div>
        {analysis.repetitions.some(r => r.count > 0) && (
          <div className="mt-4">
            <button
              onClick={() => {
                const fix = generateRemoveDuplicatesFix(bdwFormat);
                if (fix && onApplyFix) {
                  const proposed: Partial<ContentOutput> = {};
                  if (fix.websiteAboutUs && content.sections.length > 0) {
                    const updatedSections = [...content.sections];
                    updatedSections[0] = {
                      ...updatedSections[0],
                      body: fix.websiteAboutUs.substring(0, updatedSections[0].body.length + 100),
                    };
                    proposed.sections = updatedSections;
                  }
                  if (Object.keys(proposed).length > 0) {
                    handlePreviewFix("remove-duplicates", "Remove Duplicates", proposed);
                  }
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-[#29c4a9] hover:text-white"
              }`}
            >
              Preview Fix
            </button>
          </div>
        )}
      </div>

      {/* Keyword Repetition */}
      {analysis.keywordRepetitions.length > 0 && (
        <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Keyword Repetition
          </h4>
          <div className="space-y-2">
            {analysis.keywordRepetitions.map((item) => (
              <div key={item.keyword}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    "{item.keyword}"
                  </span>
                </div>
                {item.warnings.length > 0 && (
                  <ul className={`text-xs list-disc list-inside ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {item.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Readability */}
      {analysis.readability.length > 0 && (
        <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Readability
          </h4>
          <div className="space-y-2">
            {analysis.readability.map((item) => (
              <div key={item.section} className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {item.section}:
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.band === "Easy"
                      ? isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-800"
                      : item.band === "Standard"
                      ? isDark ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-800"
                      : isDark ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-800"
                  }`}>
                    {item.band}
                  </span>
                  <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {item.avgWordsPerSentence.toFixed(1)} words/sentence
                  </span>
                </div>
              </div>
            ))}
          </div>
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

