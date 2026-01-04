"use client";

import { useState } from "react";
import { recordExport } from "@/lib/bdw/local-analytics";

type GeneratedPost = {
  postNumber: number;
  platform: string;
  hook: string;
  bodyLines: string[];
  cta: string;
  raw: string;
  characterCount: number;
};

interface SMPCExportCenterPanelProps {
  posts: GeneratedPost[];
  isDark: boolean;
  storageKey?: string; // Optional storage key for analytics
}

// Format posts as plain text with platform-aware formatting
function formatPostsPlainText(posts: GeneratedPost[]): string {
  const parts: string[] = [];
  
  posts.forEach((post) => {
    parts.push(`Post ${post.postNumber} — ${post.platform}`);
    parts.push("");
    if (post.hook) {
      parts.push(`Hook: ${post.hook}`);
    }
    if (post.bodyLines.length > 0) {
      parts.push("Body:");
      post.bodyLines.forEach(line => {
        parts.push(`  ${line}`);
      });
    }
    if (post.cta) {
      parts.push(`CTA: ${post.cta}`);
    }
    parts.push("");
    parts.push(`Character count: ${post.characterCount}`);
    parts.push("");
    parts.push("---");
    parts.push("");
  });
  
  return parts.join("\n");
}

// Format posts grouped by platform
function formatPostsByPlatform(posts: GeneratedPost[]): string {
  const byPlatform: Record<string, GeneratedPost[]> = {};
  
  posts.forEach(post => {
    const platform = post.platform;
    if (!byPlatform[platform]) {
      byPlatform[platform] = [];
    }
    byPlatform[platform].push(post);
  });
  
  const parts: string[] = [];
  
  Object.entries(byPlatform).forEach(([platform, platformPosts]) => {
    parts.push(`=== ${platform.toUpperCase()} ===`);
    parts.push("");
    platformPosts.forEach(post => {
      parts.push(`Post ${post.postNumber}:`);
      const fullText = [post.hook, ...post.bodyLines, post.cta].join(" ").trim();
      parts.push(fullText);
      parts.push("");
    });
    parts.push("");
  });
  
  return parts.join("\n");
}

// Format single post for a specific platform
function formatSinglePost(post: GeneratedPost): string {
  return [post.hook, ...post.bodyLines, post.cta].join(" ").trim();
}

export default function SMPCExportCenterPanel({ posts, isDark, storageKey }: SMPCExportCenterPanelProps) {
  const [copiedItems, setCopiedItems] = useState<Record<string, string>>({});

  const handleCopy = async (itemId: string, content: string, exportType?: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedItems((prev) => ({ ...prev, [itemId]: itemId }));
      setTimeout(() => {
        setCopiedItems((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 2000);
      
      // Record export in analytics
      if (storageKey && exportType) {
        recordExport(storageKey, exportType);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = (content: string, filename: string, mimeType: string, exportType?: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Record export in analytics
    if (storageKey && exportType) {
      recordExport(storageKey, exportType);
    }
  };

  const hasContent = posts.length > 0;

  if (!hasContent) {
    return (
      <div className={`text-center py-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <p className="text-sm">Generate posts to enable exports.</p>
      </div>
    );
  }

  // Group posts by platform
  const postsByPlatform: Record<string, GeneratedPost[]> = {};
  posts.forEach(post => {
    const platform = post.platform.toLowerCase();
    if (!postsByPlatform[platform]) {
      postsByPlatform[platform] = [];
    }
    postsByPlatform[platform].push(post);
  });

  return (
    <div className="space-y-6">
      {/* Quick Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Quick Exports
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCopy("export-all", formatPostsPlainText(posts), "copy:plain")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-all"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-all"] ? "Copied!" : "Copy All Posts"}
          </button>
          <button
            onClick={() => handleCopy("export-by-platform", formatPostsByPlatform(posts), "copy:plain")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedItems["export-by-platform"]
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedItems["export-by-platform"] ? "Copied!" : "Copy by Platform"}
          </button>
        </div>
      </div>

      {/* Download Options */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Download Options
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleDownload(formatPostsPlainText(posts), "social-posts.txt", "text/plain", "download:txt")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Download as .txt
          </button>
        </div>
      </div>

      {/* Platform-Specific Exports */}
      <div>
        <h4 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
          Platform-Specific Exports
        </h4>
        <div className="space-y-3">
          {Object.entries(postsByPlatform).map(([platform, platformPosts]) => (
            <div key={platform} className={`rounded-lg border p-3 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)} ({platformPosts.length} {platformPosts.length === 1 ? "post" : "posts"})
                </span>
                <button
                  onClick={() => {
                    const content = platformPosts.map(post => formatSinglePost(post)).join("\n\n");
                    handleCopy(`platform-${platform}`, content, `platform:${platform}`);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    copiedItems[`platform-${platform}`]
                      ? "bg-[#29c4a9] text-white"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {copiedItems[`platform-${platform}`] ? "Copied!" : "Copy All"}
                </button>
              </div>
              <div className="space-y-2">
                {platformPosts.map((post, idx) => (
                  <div key={idx} className={`text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <div className="flex items-center justify-between">
                      <span>Post {post.postNumber}</span>
                      <button
                        onClick={() => handleCopy(`post-${post.postNumber}-${platform}`, formatSinglePost(post), `platform:${platform}`)}
                        className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                          copiedItems[`post-${post.postNumber}-${platform}`]
                            ? "bg-[#29c4a9] text-white"
                            : isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {copiedItems[`post-${post.postNumber}-${platform}`] ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

