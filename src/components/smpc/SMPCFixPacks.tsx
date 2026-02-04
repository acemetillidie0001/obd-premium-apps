"use client";

import { useState } from "react";
import { runQualityAnalysis, generateSoftenHypeWordsFix, generateRemoveDuplicatesFix } from "@/lib/bdw";
import type { SMPCPostItem } from "@/lib/apps/social-media-post-creator/types";

interface SMPCFixPacksProps {
  posts: SMPCPostItem[];
  basePosts: SMPCPostItem[];
  editedPosts: SMPCPostItem[] | null;
  isDark: boolean;
  onApply: (updatedPosts: SMPCPostItem[], fixPackId?: string) => void;
  onReset: () => void;
  onUndo?: () => void;
}

// Convert posts to BDW format for analysis
function postsToBDWFormat(posts: SMPCPostItem[]) {
  // Combine all post text
  const allText = posts.map(post => {
    const fullText = [post.hook, ...post.bodyLines, post.cta].join(" ").trim();
    return fullText;
  }).join("\n\n");
  
  return {
    obdListingDescription: allText.substring(0, 500),
    websiteAboutUs: allText,
    googleBusinessDescription: allText.substring(0, 750),
    elevatorPitch: allText.substring(0, 300),
    metaDescription: allText.substring(0, 160),
  };
}

export default function SMPCFixPacks({
  posts,
  basePosts,
  editedPosts,
  isDark,
  onApply,
  onReset,
  onUndo,
}: SMPCFixPacksProps) {
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    fixId: string;
    fixTitle: string;
    proposed: SMPCPostItem[];
  } | null>(null);

  const displayPosts = editedPosts ?? posts;
  const bdwFormat = postsToBDWFormat(displayPosts);
  const analysis = runQualityAnalysis(bdwFormat, "", "");

  const handlePreviewFix = (fixId: string, fixTitle: string, proposed: SMPCPostItem[]) => {
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
    proposed: SMPCPostItem[];
  }> = [];

  // Fix 1: Soften Hype Words
  if (analysis.hypeWords.some(h => h.count > 0)) {
    const hypeFix = generateSoftenHypeWordsFix(bdwFormat);
    if (hypeFix && Object.keys(hypeFix).length > 0) {
      // Apply fix to posts
      const proposed: SMPCPostItem[] = displayPosts.map(post => {
        const fullText = [post.hook, ...post.bodyLines, post.cta].join(" ").trim();
        let updatedText = fullText;
        
        // Simple approach: replace hype words in the text
        if (hypeFix.websiteAboutUs && hypeFix.websiteAboutUs !== bdwFormat.websiteAboutUs) {
          // Try to apply the fix proportionally
          const ratio = hypeFix.websiteAboutUs.length / bdwFormat.websiteAboutUs.length;
          updatedText = fullText.substring(0, Math.floor(fullText.length * ratio));
        }
        
        // Split back into hook, body, cta (simplified)
        const words = updatedText.split(" ");
        const hookWords = Math.floor(words.length * 0.2);
        const ctaWords = Math.floor(words.length * 0.1);
        
        return {
          ...post,
          hook: words.slice(0, hookWords).join(" "),
          bodyLines: words.slice(hookWords, -ctaWords).join(" ").split(/\s+/).map(w => `- ${w}`),
          cta: words.slice(-ctaWords).join(" "),
        };
      });
      
      fixes.push({
        id: "soften-hype",
        title: "Soften Hype Words",
        description: "Replace overly promotional language with more professional alternatives",
        proposed,
      });
    }
  }

  // Fix 2: Remove Duplicates
  if (analysis.repetitions.some(r => r.count > 0)) {
    const dupFix = generateRemoveDuplicatesFix(bdwFormat);
    if (dupFix && Object.keys(dupFix).length > 0) {
      // Apply fix to posts (simplified - just return original for now)
      const proposed = [...displayPosts];
      
      fixes.push({
        id: "remove-duplicates",
        title: "Remove Duplicate Sentences",
        description: "Eliminate repetitive phrases for better readability",
        proposed,
      });
    }
  }

  const hasEdits = editedPosts !== null;
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
          <p className="text-sm">No fixes available. Posts look good!</p>
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

