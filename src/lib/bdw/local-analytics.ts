/**
 * Local-only usage analytics for BDW-like apps
 * 
 * Stores usage data in localStorage:
 * - lastGeneratedAt: timestamp of last content generation
 * - lastFixPackAppliedId: ID of last fix pack applied
 * - lastExportTypeUsed: type of last export used
 * 
 * No tracking endpoints, no schema changes, localStorage only.
 * 
 * Export Type Standardization:
 * ============================
 * Format: <action>:<format> or <action>:<category>:<identifier>
 * 
 * Copy actions:
 *   - copy:plain          Copy as plain text
 *   - copy:markdown       Copy as markdown
 *   - copy:html           Copy as HTML
 *   - copy:meta           Copy meta description
 * 
 * Download actions:
 *   - download:txt        Download as .txt
 *   - download:md         Download as .md
 *   - download:html       Download as .html
 *   - download:json       Download as .json
 * 
 * Bundle actions:
 *   - bundle:seo          Copy SEO bundle (title, meta, slug)
 *   - bundle:content      Copy content-only bundle
 *   - bundle:full         Copy full content bundle
 *   - bundle:facebook     Copy Facebook posts bundle
 *   - bundle:instagram    Copy Instagram posts bundle
 *   - bundle:x            Copy X/Twitter posts bundle
 *   - bundle:linkedin     Copy LinkedIn posts bundle
 *   - bundle:gbp          Copy Google Business Profile bundle
 *   - bundle:all          Copy all posts bundle
 * 
 * Platform-specific exports:
 *   - platform:facebook   Copy Facebook-specific content
 *   - platform:instagram Copy Instagram-specific content
 *   - platform:x          Copy X/Twitter-specific content
 *   - platform:linkedin  Copy LinkedIn-specific content
 *   - platform:gbp       Copy Google Business Profile content
 * 
 * Block exports (BDW-specific):
 *   - block:gbp           Copy GBP block
 *   - block:website       Copy website block
 *   - block:social-bio    Copy social bio block
 *   - block:faq           Copy FAQ block
 *   - block:meta          Copy meta block
 * 
 * Legacy values are preserved as-is for backward compatibility.
 */

export interface LocalAnalytics {
  lastGeneratedAt: number | null;
  lastFixPackAppliedId: string | null;
  lastExportTypeUsed: string | null;
}

/**
 * Standardized export event types
 * 
 * Format: <action>:<format> or <action>:<category>:<identifier>
 */
export type ExportEventType =
  // Copy actions
  | "copy:plain"
  | "copy:markdown"
  | "copy:html"
  | "copy:meta"
  // Download actions
  | "download:txt"
  | "download:md"
  | "download:html"
  | "download:json"
  // Bundle actions
  | "bundle:seo"
  | "bundle:content"
  | "bundle:full"
  | "bundle:facebook"
  | "bundle:instagram"
  | "bundle:x"
  | "bundle:linkedin"
  | "bundle:gbp"
  | "bundle:all"
  // Platform-specific exports
  | "platform:facebook"
  | "platform:instagram"
  | "platform:x"
  | "platform:linkedin"
  | "platform:gbp"
  // Block exports (BDW-specific)
  | "block:gbp"
  | "block:website"
  | "block:social-bio"
  | "block:faq"
  | "block:meta";

/**
 * Normalize export type string to standardized format
 * 
 * Maps common patterns to standardized types while preserving
 * legacy values for backward compatibility.
 * 
 * @param input - Raw export type string from call sites
 * @returns Normalized export type or original string if no mapping found
 */
export function normalizeExportType(input: string): ExportEventType | string {
  const lower = input.toLowerCase().trim();
  
  // Copy actions
  if (lower.includes("copy") && (lower.includes("plain") || lower.includes("text"))) {
    return "copy:plain";
  }
  if (lower.includes("copy") && lower.includes("markdown")) {
    return "copy:markdown";
  }
  if (lower.includes("copy") && lower.includes("html")) {
    return "copy:html";
  }
  if (lower.includes("copy") && lower.includes("meta")) {
    return "copy:meta";
  }
  
  // Download actions
  if (lower.includes("download") && (lower.includes(".txt") || lower.includes("txt"))) {
    return "download:txt";
  }
  if (lower.includes("download") && (lower.includes(".md") || lower.includes("markdown"))) {
    return "download:md";
  }
  if (lower.includes("download") && (lower.includes(".html") || lower.includes("html"))) {
    return "download:html";
  }
  if (lower.includes("download") && (lower.includes(".json") || lower.includes("json"))) {
    return "download:json";
  }
  
  // Bundle actions
  if (lower.includes("bundle") || lower.includes("seo bundle")) {
    if (lower.includes("seo")) return "bundle:seo";
    if (lower.includes("content")) return "bundle:content";
    if (lower.includes("full") || lower.includes("all")) return "bundle:full";
    if (lower.includes("facebook")) return "bundle:facebook";
    if (lower.includes("instagram")) return "bundle:instagram";
    if (lower.includes("x") || lower.includes("twitter")) return "bundle:x";
    if (lower.includes("linkedin")) return "bundle:linkedin";
    if (lower.includes("gbp") || lower.includes("google")) return "bundle:gbp";
    if (lower.includes("all")) return "bundle:all";
  }
  
  // Platform-specific exports
  if (lower.includes("platform") || lower.includes("-copy")) {
    if (lower.includes("facebook")) return "platform:facebook";
    if (lower.includes("instagram")) return "platform:instagram";
    if (lower.includes("x") || lower.includes("twitter")) return "platform:x";
    if (lower.includes("linkedin")) return "platform:linkedin";
    if (lower.includes("gbp") || lower.includes("google")) return "platform:gbp";
  }
  
  // Block exports
  if (lower.includes("block")) {
    if (lower.includes("gbp")) return "block:gbp";
    if (lower.includes("website")) return "block:website";
    if (lower.includes("social") || lower.includes("bio")) return "block:social-bio";
    if (lower.includes("faq")) return "block:faq";
    if (lower.includes("meta")) return "block:meta";
  }
  
  // Legacy: "Copy All Posts", "Copy by Platform", etc.
  if (lower.includes("copy all posts")) return "copy:plain";
  if (lower.includes("copy by platform")) return "copy:plain";
  
  // If no mapping found, return original (backward compatibility)
  return input;
}

const DEFAULT_ANALYTICS: LocalAnalytics = {
  lastGeneratedAt: null,
  lastFixPackAppliedId: null,
  lastExportTypeUsed: null,
};

/**
 * Get analytics for a specific app
 */
export function getLocalAnalytics(storageKey: string): LocalAnalytics {
  if (typeof window === "undefined") {
    return DEFAULT_ANALYTICS;
  }

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return DEFAULT_ANALYTICS;
    }

    const parsed = JSON.parse(stored) as Partial<LocalAnalytics>;
    return {
      lastGeneratedAt: parsed.lastGeneratedAt ?? null,
      lastFixPackAppliedId: parsed.lastFixPackAppliedId ?? null,
      lastExportTypeUsed: parsed.lastExportTypeUsed ?? null,
    };
  } catch (error) {
    console.error(`[LocalAnalytics] Failed to read ${storageKey}:`, error);
    return DEFAULT_ANALYTICS;
  }
}

/**
 * Set analytics for a specific app
 */
export function setLocalAnalytics(
  storageKey: string,
  updates: Partial<LocalAnalytics>
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = getLocalAnalytics(storageKey);
    const updated: LocalAnalytics = {
      ...current,
      ...updates,
    };

    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (error) {
    console.error(`[LocalAnalytics] Failed to write ${storageKey}:`, error);
  }
}

/**
 * Record a generation event
 */
export function recordGeneration(storageKey: string): void {
  setLocalAnalytics(storageKey, {
    lastGeneratedAt: Date.now(),
  });
}

/**
 * Record a fix pack application
 */
export function recordFixPackApplied(storageKey: string, fixPackId: string): void {
  setLocalAnalytics(storageKey, {
    lastFixPackAppliedId: fixPackId,
  });
}

/**
 * Record an export
 * 
 * @param storageKey - Storage key for the app (e.g., "bdw-analytics")
 * @param exportType - Export type (will be normalized to standard format)
 */
export function recordExport(storageKey: string, exportType: string): void {
  const normalized = normalizeExportType(exportType);
  setLocalAnalytics(storageKey, {
    lastExportTypeUsed: normalized,
  });
}

/**
 * Format timestamp for display
 */
export function formatLastUsed(timestamp: number | null): string | null {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Format export type for human-friendly display
 * 
 * Maps standardized export types to readable labels while preserving
 * the original stored value in localStorage.
 * 
 * @param t - Export type string (standardized or legacy)
 * @returns Human-friendly label or original string if unknown
 */
export function formatExportTypeLabel(t: string): string {
  // Copy actions
  if (t === "copy:plain") return "Copy (Plain)";
  if (t === "copy:markdown") return "Copy (Markdown)";
  if (t === "copy:html") return "Copy (HTML)";
  if (t === "copy:meta") return "Copy (Meta)";
  
  // Download actions
  if (t === "download:txt") return "Download (.txt)";
  if (t === "download:md") return "Download (.md)";
  if (t === "download:html") return "Download (.html)";
  if (t === "download:json") return "Download (.json)";
  
  // Bundle actions
  if (t === "bundle:seo") return "Copy Bundle (SEO)";
  if (t === "bundle:content") return "Copy Bundle (Content)";
  if (t === "bundle:full") return "Copy Bundle (Full)";
  if (t === "bundle:facebook") return "Copy Bundle (Facebook)";
  if (t === "bundle:instagram") return "Copy Bundle (Instagram)";
  if (t === "bundle:x") return "Copy Bundle (X)";
  if (t === "bundle:linkedin") return "Copy Bundle (LinkedIn)";
  if (t === "bundle:gbp") return "Copy Bundle (GBP)";
  if (t === "bundle:all") return "Copy Bundle (All)";
  
  // Platform-specific exports
  if (t === "platform:facebook") return "Copy for Facebook";
  if (t === "platform:instagram") return "Copy for Instagram";
  if (t === "platform:x") return "Copy for X";
  if (t === "platform:linkedin") return "Copy for LinkedIn";
  if (t === "platform:gbp") return "Copy for GBP";
  
  // Block exports
  if (t === "block:gbp") return "Copy Block (GBP)";
  if (t === "block:website") return "Copy Block (Website)";
  if (t === "block:social-bio") return "Copy Block (Social Bio)";
  if (t === "block:faq") return "Copy Block (FAQ)";
  if (t === "block:meta") return "Copy Block (Meta)";
  
  // Unknown type - return original (backward compatibility)
  return t;
}

