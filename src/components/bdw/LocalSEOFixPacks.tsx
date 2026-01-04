"use client";

import { useState } from "react";
import QualityPreviewModal from "./QualityPreviewModal";
import { softenHypeWords, removeDuplicateSentences } from "@/lib/bdw";

interface LocalSEOFixPacksProps {
  text: string;
  isDark: boolean;
  onApplyFix: (fixedText: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export default function LocalSEOFixPacks({
  text,
  isDark,
  onApplyFix,
  onUndo,
  canUndo = false,
}: LocalSEOFixPacksProps) {
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    originalText: string;
    proposedText: string;
  } | null>(null);

  if (!text || text.trim().length === 0) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate content to enable fix packs.</p>
      </div>
    );
  }

  const handlePreviewFix = (fixId: string, fixTitle: string, fixFn: (t: string) => string) => {
    const proposed = fixFn(text);
    if (proposed === text) {
      alert("No changes to preview.");
      return;
    }
    setPreviewState({
      isOpen: true,
      fixId,
      fixTitle,
      originalText: text,
      proposedText: proposed,
    });
  };

  const handleApply = () => {
    if (previewState) {
      onApplyFix(previewState.proposedText);
      setPreviewState(null);
    }
  };

  const handleClose = () => {
    setPreviewState(null);
  };

  // Create a mock BusinessDescriptionResponse for the modal
  const mockBaseResult = {
    obdListingDescription: "",
    websiteAboutUs: text,
    googleBusinessDescription: "",
    socialBioPack: { facebookBio: "", instagramBio: "", xBio: "", linkedinTagline: "" },
    taglineOptions: [],
    elevatorPitch: "",
    faqSuggestions: [],
    metaDescription: null,
  };

  const mockPreviewState = previewState ? {
    isOpen: previewState.isOpen,
    fixId: previewState.fixId,
    fixTitle: previewState.fixTitle,
    targetKeys: ["websiteAboutUs"],
    proposed: { websiteAboutUs: previewState.proposedText },
  } : null;

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Safe Fix Actions
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handlePreviewFix("soften-hype-words", "Soften Hype Words", softenHypeWords)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            Preview: Soften Hype Words
          </button>
          <button
            onClick={() => handlePreviewFix("remove-duplicates", "Remove Duplicate Sentences", removeDuplicateSentences)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            Preview: Remove Duplicates
          </button>
        </div>
        {canUndo && onUndo && (
          <div className="mt-4">
            <button
              onClick={onUndo}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Undo Last Fix
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {mockPreviewState && mockPreviewState.isOpen && (
        <QualityPreviewModal
          previewState={mockPreviewState}
          baseResult={mockBaseResult}
          onClose={handleClose}
          onApply={handleApply}
          isDark={isDark}
        />
      )}
    </div>
  );
}

