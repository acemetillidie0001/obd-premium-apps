"use client";

import { useState } from "react";
import { runQualityAnalysis, generateSoftenHypeWordsFix, generateRemoveDuplicatesFix } from "@/lib/bdw";

type GeneratedPost = {
  postNumber: number;
  platform: string;
  hook: string;
  bodyLines: string[];
  cta: string;
  raw: string;
  characterCount: number;
};

interface SMPCQualityControlsTabProps {
  posts: GeneratedPost[];
  isDark: boolean;
  onApplyFix?: (updatedPosts: GeneratedPost[]) => void;
}

// Convert posts to BDW format for analysis
function postsToBDWFormat(posts: GeneratedPost[]) {
  const allText = posts.map(post => {
    return [post.hook, ...post.bodyLines, post.cta].join(" ").trim();
  }).join("\n\n");
  
  return {
    obdListingDescription: allText.substring(0, 500),
    websiteAboutUs: allText,
    googleBusinessDescription: allText.substring(0, 750),
    elevatorPitch: allText.substring(0, 300),
    metaDescription: allText.substring(0, 160),
  };
}

export default function SMPCQualityControlsTab({
  posts,
  isDark,
  onApplyFix,
}: SMPCQualityControlsTabProps) {
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    proposed: GeneratedPost[];
  } | null>(null);

  const bdwFormat = postsToBDWFormat(posts);
  const analysis = runQualityAnalysis(bdwFormat, "", "");

  const handlePreviewFix = (
    fixId: string,
    fixTitle: string,
    proposed: GeneratedPost[]
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

  const hasContent = posts.length > 0;

  if (!hasContent) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate posts to run quality checks.</p>
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
                  // Simplified: return original posts for now
                  handlePreviewFix("soften-hype", "Soften Hype Words", posts);
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
                  handlePreviewFix("remove-duplicates", "Remove Duplicates", posts);
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

      {/* Character Count Warnings */}
      <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Character Count Check
        </h4>
        <div className="space-y-2">
          {posts.map((post) => {
            const isX = post.platform.toLowerCase().includes("x") || post.platform.toLowerCase().includes("twitter");
            const isOverLimit = isX && post.characterCount > 280;
            const isNearLimit = isX && post.characterCount > 260;
            
            return (
              <div key={post.postNumber} className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Post {post.postNumber} — {post.platform}:
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  isOverLimit
                    ? isDark ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-800"
                    : isNearLimit
                    ? isDark ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-800"
                    : isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-800"
                }`}>
                  {post.characterCount} chars
                  {isOverLimit && " (over limit)"}
                  {isNearLimit && !isOverLimit && " (near limit)"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
                {previewState.proposed.map((post, idx) => (
                  <div key={idx} className={`rounded-lg border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-slate-50 border-slate-300"}`}>
                    <h4 className={`text-sm font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Post {post.postNumber} — {post.platform}
                    </h4>
                    <div className={`text-xs whitespace-pre-wrap ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                      {post.hook && `Hook: ${post.hook}\n`}
                      {post.bodyLines.length > 0 && `Body:\n${post.bodyLines.join("\n")}\n`}
                      {post.cta && `CTA: ${post.cta}`}
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

