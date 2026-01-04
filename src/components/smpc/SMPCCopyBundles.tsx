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

interface SMPCCopyBundlesProps {
  posts: GeneratedPost[];
  isDark: boolean;
  storageKey?: string; // Optional storage key for analytics
}

// Format posts for a specific platform
function formatPlatformBundle(posts: GeneratedPost[], platformFilter: string): string {
  const filtered = posts.filter(post => 
    post.platform.toLowerCase().includes(platformFilter.toLowerCase())
  );
  
  if (filtered.length === 0) return "";
  
  return filtered.map(post => {
    return [post.hook, ...post.bodyLines, post.cta].join(" ").trim();
  }).join("\n\n");
}

// Format all posts bundle
function formatAllPostsBundle(posts: GeneratedPost[]): string {
  return posts.map(post => {
    return `Post ${post.postNumber} — ${post.platform}\n${[post.hook, ...post.bodyLines, post.cta].join(" ").trim()}`;
  }).join("\n\n");
}

export default function SMPCCopyBundles({ posts, isDark, storageKey }: SMPCCopyBundlesProps) {
  const [copiedBundle, setCopiedBundle] = useState<string | null>(null);

  const handleCopy = async (bundleId: string, content: string, exportType?: string) => {
    if (!content) return;
    
    try {
      await navigator.clipboard.writeText(content);
      setCopiedBundle(bundleId);
      setTimeout(() => {
        setCopiedBundle(null);
      }, 2000);
      
      // Record export in analytics
      if (storageKey && exportType) {
        recordExport(storageKey, exportType);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Check which platforms are present
  const hasFacebook = posts.some(p => p.platform.toLowerCase().includes("facebook"));
  const hasInstagram = posts.some(p => p.platform.toLowerCase().includes("instagram"));
  const hasX = posts.some(p => p.platform.toLowerCase().includes("x") || p.platform.toLowerCase().includes("twitter"));
  const hasLinkedIn = posts.some(p => p.platform.toLowerCase().includes("linkedin"));
  const hasGBP = posts.some(p => p.platform.toLowerCase().includes("google") || p.platform.toLowerCase().includes("gbp"));

  return (
    <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex flex-wrap gap-3 items-center">
        <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          Copy Bundles:
        </span>
        {hasFacebook && (
          <button
            onClick={() => handleCopy("facebook", formatPlatformBundle(posts, "facebook"), "bundle:facebook")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedBundle === "facebook"
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedBundle === "facebook" ? "Copied!" : "Copy Facebook Bundle"}
          </button>
        )}
        {hasInstagram && (
          <button
            onClick={() => handleCopy("instagram", formatPlatformBundle(posts, "instagram"), "bundle:instagram")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedBundle === "instagram"
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedBundle === "instagram" ? "Copied!" : "Copy Instagram Bundle"}
          </button>
        )}
        {hasX && (
          <button
            onClick={() => handleCopy("x", formatPlatformBundle(posts, "x"), "bundle:x")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedBundle === "x"
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedBundle === "x" ? "Copied!" : "Copy X Bundle"}
          </button>
        )}
        {hasLinkedIn && (
          <button
            onClick={() => handleCopy("linkedin", formatPlatformBundle(posts, "linkedin"), "bundle:linkedin")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedBundle === "linkedin"
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedBundle === "linkedin" ? "Copied!" : "Copy LinkedIn Bundle"}
          </button>
        )}
        {hasGBP && (
          <button
            onClick={() => handleCopy("gbp", formatPlatformBundle(posts, "google"), "bundle:gbp")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedBundle === "gbp"
                ? "bg-[#29c4a9] text-white"
                : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
            }`}
          >
            {copiedBundle === "gbp" ? "Copied!" : "Copy GBP Bundle"}
          </button>
        )}
        <button
          onClick={() => handleCopy("all", formatAllPostsBundle(posts), "bundle:all")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            copiedBundle === "all"
              ? "bg-[#29c4a9] text-white"
              : isDark
              ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
              : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
          }`}
        >
          {copiedBundle === "all" ? "Copied!" : "Copy All Posts"}
        </button>
      </div>
    </div>
  );
}

