"use client";

import { useMemo } from "react";
import { softenHypeWords, removeDuplicateSentences } from "@/lib/bdw";

interface LocalSEOTextQualityControlsProps {
  text: string;
  services?: string;
  keywords?: string;
  isDark: boolean;
  onApplyFix?: (fixedText: string) => void;
}

export default function LocalSEOTextQualityControls({
  text,
  services,
  keywords,
  isDark,
  onApplyFix,
}: LocalSEOTextQualityControlsProps) {
  // Simple hype words analysis
  const hypeWords = useMemo(() => {
    const hypeWordList = ["best", "top", "premier", "leading", "#1", "unmatched", "world-class", "ultimate", "perfect"];
    const found: string[] = [];
    const lowerText = text.toLowerCase();
    
    hypeWordList.forEach((word) => {
      const regex = new RegExp(`\\b${word.replace("#", "\\#")}\\b`, "gi");
      if (regex.test(text)) {
        found.push(word);
      }
    });
    
    return { words: found, count: found.length };
  }, [text]);

  // Simple readability estimate
  const readability = useMemo(() => {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgCharsPerWord = words.length > 0 ? text.length / words.length : 0;
    
    let band: "Easy" | "Medium" | "Complex" = "Medium";
    if (avgWordsPerSentence < 15 && avgCharsPerWord < 5) {
      band = "Easy";
    } else if (avgWordsPerSentence > 25 || avgCharsPerWord > 6) {
      band = "Complex";
    }
    
    return { avgWordsPerSentence, avgCharsPerWord, band };
  }, [text]);

  // Check for duplicate sentences
  const hasDuplicates = useMemo(() => {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 10);
    const unique = new Set(sentences);
    return sentences.length > unique.size;
  }, [text]);

  if (!text || text.trim().length === 0) {
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
        {hypeWords.count === 0 ? (
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No hype words detected.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Found:
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {hypeWords.count} {hypeWords.count === 1 ? "match" : "matches"}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                  {hypeWords.words.join(", ")}
                </span>
              </div>
            </div>
          </div>
        )}
        <p className={`text-xs mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          This is a style check (estimate).
        </p>
      </div>

      {/* Repetition Warning */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Repetition Warning
        </h4>
        {!hasDuplicates ? (
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No repeated sentences detected.
          </p>
        ) : (
          <p className={`text-sm ${isDark ? "text-yellow-300" : "text-yellow-600"}`}>
            ⚠️ Duplicate sentences detected. Consider removing repetitions for better readability.
          </p>
        )}
      </div>

      {/* Readability Estimate */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Readability Estimate
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Content:
            </span>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {readability.avgWordsPerSentence.toFixed(1)} words/sentence, {readability.avgCharsPerWord.toFixed(1)} chars/word
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                readability.band === "Easy"
                  ? isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-700"
                  : readability.band === "Complex"
                  ? isDark ? "bg-orange-900/30 text-orange-300" : "bg-orange-100 text-orange-700"
                  : isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700"
              }`}>
                {readability.band}
              </span>
            </div>
          </div>
        </div>
        <p className={`text-xs mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Estimate (not exact).
        </p>
      </div>

      {/* Safe Fix Actions */}
      {onApplyFix && (
        <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Safe Fix Actions
          </h4>
          <div className="flex flex-wrap gap-3">
            {hypeWords.count > 0 && (
              <button
                onClick={() => {
                  const fixed = softenHypeWords(text);
                  if (fixed !== text) {
                    onApplyFix(fixed);
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
            )}
            {hasDuplicates && (
              <button
                onClick={() => {
                  const fixed = removeDuplicateSentences(text);
                  if (fixed !== text) {
                    onApplyFix(fixed);
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

