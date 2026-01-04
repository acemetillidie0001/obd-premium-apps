"use client";

import { useState } from "react";
import QualityPreviewModal from "./QualityPreviewModal";
import {
  runQualityAnalysis,
  generateSoftenHypeWordsFix,
  generateRemoveDuplicatesFix,
  type BusinessDescriptionResponseExport as BusinessDescriptionResponse,
} from "@/lib/bdw";

export interface QualityControlsFormValues {
  services: string;
  keywords: string;
}

export interface QualityControlsTabProps {
  result: BusinessDescriptionResponse;
  formValues: QualityControlsFormValues;
  isDark: boolean;
  onApplyFix?: (partialUpdated: Partial<BusinessDescriptionResponse>) => void;
}

export default function QualityControlsTab({
  result,
  formValues,
  isDark,
  onApplyFix,
}: QualityControlsTabProps) {
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    targetKeys: string[];
    proposed: Partial<BusinessDescriptionResponse>;
  } | null>(null);

  // Run quality analysis
  const analysis = runQualityAnalysis(result, formValues.services, formValues.keywords);

  const handlePreviewFix = (
    fixId: string,
    fixTitle: string,
    proposed: Partial<BusinessDescriptionResponse>
  ) => {
    const targetKeys = Object.keys(proposed);
    if (targetKeys.length === 0) {
      alert("No changes to preview.");
      return;
    }
    setPreviewState({
      isOpen: true,
      fixId,
      fixTitle,
      targetKeys,
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

  // Check if result has content
  const hasContent =
    result.obdListingDescription ||
    result.googleBusinessDescription ||
    result.websiteAboutUs ||
    result.elevatorPitch ||
    result.metaDescription;

  if (!hasContent) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate content to run quality checks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Hype Words Detector */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Hype Words Detector
        </h4>
        <div className="space-y-3">
          {analysis.hypeWords.map((item) => (
            <div key={item.section} className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {item.section}:
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {item.count} {item.count === 1 ? "match" : "matches"}
                </span>
                {item.words.length > 0 && (
                  <span className={`text-xs px-2 py-1 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                    {item.words.join(", ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className={`text-xs mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          This is a style check (estimate).
        </p>
      </div>

      {/* Section 2: Repetition Warning */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Repetition Warning
        </h4>
        {analysis.repetitions.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No repeated sentences detected.
          </p>
        ) : (
          <div className="space-y-3">
            {analysis.repetitions.map((item) => (
              <div key={item.section}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {item.section}:
                  </span>
                  <span className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    {item.count} {item.count === 1 ? "duplicate" : "duplicates"}
                  </span>
                </div>
                {item.sentences.length > 0 && (
                  <div className={`text-xs mt-1 max-h-32 overflow-y-auto ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {item.sentences.slice(0, 5).map((sentence, idx) => (
                      <div key={idx} className="mb-1">
                        &quot;{sentence.length > 80 ? sentence.substring(0, 80) + "..." : sentence}&quot;
                      </div>
                    ))}
                    {item.sentences.length > 5 && (
                      <div className="mt-1 italic">
                        ...and {item.sentences.length - 5} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Keyword Repetition */}
      {analysis.keywordRepetitions.length > 0 && (
        <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Keyword Repetition
          </h4>
          <div className="space-y-3">
            {analysis.keywordRepetitions.map((item) => (
              <div key={item.keyword} className={`rounded border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
                <div className="font-medium mb-2 text-sm">
                  <span className={isDark ? "text-slate-200" : "text-slate-800"}>
                    &quot;{item.keyword}&quot;
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={isDark ? "text-slate-400" : "text-slate-600"}>
                    OBD: {item.counts.obd}
                  </div>
                  <div className={isDark ? "text-slate-400" : "text-slate-600"}>
                    GBP: {item.counts.gbp}
                  </div>
                  <div className={isDark ? "text-slate-400" : "text-slate-600"}>
                    Website: {item.counts.website}
                  </div>
                  <div className={isDark ? "text-slate-400" : "text-slate-600"}>
                    Citations: {item.counts.citations}
                  </div>
                  <div className={isDark ? "text-slate-400" : "text-slate-600"}>
                    Meta: {item.counts.meta}
                  </div>
                </div>
                {item.warnings.length > 0 && (
                  <div className={`mt-2 text-xs ${isDark ? "text-yellow-400" : "text-yellow-600"}`}>
                    ⚠️ {item.warnings.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Readability Estimate */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Readability Estimate
        </h4>
        <div className="space-y-3">
          {analysis.readability.map((item) => (
            <div key={item.section} className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {item.section}:
              </span>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {item.avgWordsPerSentence.toFixed(1)} words/sentence, {item.avgCharsPerWord.toFixed(1)} chars/word
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  item.band === "Easy"
                    ? isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-700"
                    : item.band === "Complex"
                    ? isDark ? "bg-orange-900/30 text-orange-300" : "bg-orange-100 text-orange-700"
                    : isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700"
                }`}>
                  {item.band}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className={`text-xs mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Estimate (not exact).
        </p>
      </div>

      {/* Optional Safe Fix Actions */}
      {onApplyFix && (
        <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Safe Fix Actions
          </h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const proposed = generateSoftenHypeWordsFix(result);
                const hasChanges = Object.keys(proposed).length > 0;
                if (hasChanges) {
                  handlePreviewFix("soften-hype-words", "Soften Hype Words", proposed);
                } else {
                  alert("No hype words found to soften.");
                }
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                  : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
              }`}
            >
              Soften Hype Words
            </button>
            <button
              onClick={() => {
                const proposed = generateRemoveDuplicatesFix(result);
                const hasChanges = Object.keys(proposed).length > 0;
                if (hasChanges) {
                  handlePreviewFix("remove-duplicates", "Remove Duplicate Sentences", proposed);
                } else {
                  alert("No duplicate sentences found.");
                }
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                  : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
              }`}
            >
              Remove Duplicate Sentences
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewState && previewState.isOpen && (
        <QualityPreviewModal
          previewState={previewState}
          baseResult={result}
          onClose={handleClosePreview}
          onApply={handleApplyFix}
          isDark={isDark}
        />
      )}
    </div>
  );
}

