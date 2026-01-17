/**
 * Export utilities for Local Keyword Research Tool
 * Pure functions for generating CSV and TXT exports
 */

import type {
  LocalKeywordIdea,
  LocalKeywordCluster,
  LocalKeywordResponse,
  LocalKeywordRequest,
} from "@/app/api/local-keyword-research/types";

/**
 * Sanitize a string for use in filenames
 * - Lowercase
 * - Replace spaces with "-"
 * - Remove any non [a-zA-Z0-9-_] characters
 * - Collapse multiple dashes
 * - Trim dashes
 * - Max length 60 chars
 * - If result empty => "obd"
 */
export function sanitizeForFilename(input: string): string {
  if (!input || typeof input !== "string") return "obd";
  
  let sanitized = input
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/[^a-z0-9-_]/g, "") // Remove non-alphanumeric (except dash/underscore)
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-+|-+$/g, ""); // Trim dashes from start/end
  
  // Limit to 60 chars
  if (sanitized.length > 60) {
    sanitized = sanitized.slice(0, 60);
    // Trim trailing dash if truncated
    sanitized = sanitized.replace(/-+$/, "");
  }
  
  return sanitized || "obd";
}

/**
 * Escape a CSV field value (wrap in quotes if needed)
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export metadata interface
 */
export interface ExportMeta {
  businessName?: string;
  city?: string;
  state?: string;
  goal?: string;
  generatedAt?: Date;
  nearMe?: boolean;
}

/**
 * Export settings interface (lightweight, only include what exists)
 */
export interface ExportSettings {
  maxKeywords?: number;
  nearMe?: boolean;
  radiusMiles?: number;
  neighborhoods?: boolean;
  zipCodes?: boolean;
  language?: string;
}

/**
 * Generate CSV content for top keywords table
 */
export function generateKeywordsCsv(
  keywords: LocalKeywordIdea[],
  meta?: ExportMeta
): string {
  /**
   * LKRT CSV Fixed Schema (deterministic; parser-safe)
   *
   * Column order MUST remain stable across exports:
   * keyword, location, nearMe, dataSource, avgMonthlySearches, competition, lowTopOfPageBid, highTopOfPageBid, notes
   *
   * Notes:
   * - No metadata comment lines are included in the CSV body.
   * - When Google Ads metrics are null/absent, cells are exported as empty (columns are NOT dropped).
   */
  const headers = [
    "keyword",
    "location",
    "nearMe",
    "dataSource",
    "avgMonthlySearches",
    "competition",
    "lowTopOfPageBid",
    "highTopOfPageBid",
    "notes",
  ] as const;

  const location =
    meta?.city || meta?.state
      ? `${meta?.city ? String(meta.city) : ""}${meta?.city && meta?.state ? ", " : ""}${meta?.state ? String(meta.state) : ""}`
      : "";
  const nearMe =
    typeof meta?.nearMe === "boolean" ? (meta.nearMe ? "true" : "false") : "";

  const lines: string[] = [];
  lines.push(headers.join(","));

  const assertRowLenDevOnly = (row: string[], idx: number) => {
    if (process.env.NODE_ENV === "production") return;
    // "Unit-style" self-check: header/data column counts must match exactly.
    if (row.length !== headers.length) {
      // eslint-disable-next-line no-console
      console.warn("[LKRT CSV] schema mismatch", {
        expected: headers.length,
        actual: row.length,
        rowIndex: idx,
      });
    }
  };

  keywords.forEach((k, idx) => {
    // LKRT only has a single CPC field today; "top of page bid" columns are intentionally left blank.
    const row = [
      escapeCsvField(k.keyword),
      escapeCsvField(location),
      escapeCsvField(nearMe),
      escapeCsvField(k.dataSource ?? ""),
      escapeCsvField(k.monthlySearchesExact ?? null),
      escapeCsvField(k.adsCompetitionIndex ?? null),
      escapeCsvField(null),
      escapeCsvField(null),
      escapeCsvField(k.notes ?? ""),
    ];
    assertRowLenDevOnly(row, idx);
    lines.push(row.join(","));
  });

  return lines.join("\n");
}

/**
 * Generate filename for CSV export
 */
export function getCsvFilename(businessName?: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const namePart = sanitizeForFilename(businessName || "keywords");
  return `OBD-Local-Keywords-${namePart}-v3.1-${date}.csv`;
}

/**
 * Generate full report TXT content
 */
export function generateFullReportTxt(
  response: LocalKeywordResponse,
  meta?: ExportMeta,
  settings?: ExportSettings
): string {
  const now = meta?.generatedAt || new Date();
  const isoDate = now.toISOString();
  const dateTime = now.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const businessName = meta?.businessName || "Unknown Business";
  const city = meta?.city || "Ocala";
  const state = meta?.state || "FL";
  const goal = meta?.goal || "General keyword research";

  const lines: string[] = [];

  // Header
  lines.push("=".repeat(70));
  lines.push("OBD LOCAL KEYWORD RESEARCH REPORT");
  lines.push("=".repeat(70));
  lines.push("");
  lines.push(`Generated: ${dateTime}`);
  lines.push(`Generated (ISO): ${isoDate}`);
  lines.push(`Business: ${businessName}`);
  lines.push(`Location: ${city}, ${state}`);
  lines.push(`Primary Goal: ${goal}`);
  lines.push("");
  
  // Settings (only include if present)
  if (settings) {
    lines.push("Settings:");
    if (typeof settings.maxKeywords === "number") {
      lines.push(`  - Max Keywords: ${settings.maxKeywords}`);
    }
    if (typeof settings.nearMe === "boolean") {
      lines.push(`  - Include "Near Me": ${settings.nearMe ? "Yes" : "No"}`);
    }
    if (typeof settings.radiusMiles === "number") {
      lines.push(`  - Radius: ${settings.radiusMiles} miles`);
    }
    if (typeof settings.neighborhoods === "boolean") {
      lines.push(`  - Include Neighborhoods: ${settings.neighborhoods ? "Yes" : "No"}`);
    }
    if (typeof settings.zipCodes === "boolean") {
      lines.push(`  - Include ZIP Codes: ${settings.zipCodes ? "Yes" : "No"}`);
    }
    if (settings.language) {
      lines.push(`  - Language: ${settings.language}`);
    }
    lines.push("");
  }

  // Metrics transparency note (only if not using Google Ads)
  const hasGoogleAds = response.topPriorityKeywords?.some((k) => k.dataSource === "google-ads") ||
    response.keywordClusters?.some((cluster) => 
      cluster.keywords?.some((k) => k.dataSource === "google-ads")
    );
  if (!hasGoogleAds) {
    lines.push("Note: Search volume and CPC values are estimates while Google Ads access is pending.");
    lines.push("");
  }

  // Summary
  if (response.summary) {
    lines.push("SUMMARY");
    lines.push("-".repeat(70));
    lines.push(response.summary);
    lines.push("");
  }

  // Overview Notes
  if (response.overviewNotes && response.overviewNotes.length > 0) {
    lines.push("OVERVIEW NOTES");
    lines.push("-".repeat(70));
    response.overviewNotes.forEach((note) => {
      lines.push(`• ${note}`);
    });
    lines.push("");
  }

  // Top Priority Keywords (top 25 or full list)
  if (response.topPriorityKeywords && response.topPriorityKeywords.length > 0) {
    lines.push("TOP PRIORITY KEYWORDS");
    lines.push("-".repeat(70));
    lines.push("Opportunity Score (1–100): A blended score based on local intent, estimated demand, and ranking difficulty.");
    lines.push("");
    const topKeywords = response.topPriorityKeywords.slice(0, 25);
    topKeywords.forEach((k, idx) => {
      lines.push(`${idx + 1}. ${k.keyword}`);
      lines.push(`   Intent: ${k.intent} | Difficulty: ${k.difficultyLabel} | Score: ${k.opportunityScore}`);
      if (k.suggestedPageType) {
        lines.push(`   Suggested Page: ${k.suggestedPageType}`);
      }
      if (typeof k.monthlySearchesExact === "number") {
        lines.push(`   Volume: ${k.monthlySearchesExact.toLocaleString()}/month`);
      }
      if (typeof k.cpcUsd === "number") {
        lines.push(`   CPC: $${k.cpcUsd.toFixed(2)}`);
      }
      if (k.notes) {
        lines.push(`   Note: ${k.notes}`);
      }
      lines.push("");
    });
  }

  // Keyword Clusters
  if (response.keywordClusters && response.keywordClusters.length > 0) {
    lines.push("KEYWORD CLUSTERS");
    lines.push("-".repeat(70));
    response.keywordClusters.forEach((cluster) => {
      lines.push("");
      const keywordCount = cluster.keywords?.length || 0;
      lines.push(`${cluster.name}${keywordCount > 0 ? ` (${keywordCount} keyword${keywordCount !== 1 ? "s" : ""})` : ""}`);
      lines.push(`  ${cluster.description}`);
      lines.push(`  Recommended use: ${cluster.recommendedUse}`);
      if (cluster.keywords && cluster.keywords.length > 0) {
        lines.push("  Keywords:");
        cluster.keywords.forEach((k) => {
          lines.push(`    • ${k.keyword} (${k.intent}, ${k.difficultyLabel})`);
        });
      }
      lines.push("");
    });
  }

  // Blog Ideas
  if (response.blogIdeas && response.blogIdeas.length > 0) {
    lines.push("BLOG IDEAS");
    lines.push("-".repeat(70));
    response.blogIdeas.forEach((idea, idx) => {
      lines.push(`${idx + 1}. ${idea}`);
    });
    lines.push("");
  }

  // FAQ Ideas
  if (response.faqIdeas && response.faqIdeas.length > 0) {
    lines.push("FAQ IDEAS");
    lines.push("-".repeat(70));
    response.faqIdeas.forEach((faq, idx) => {
      lines.push(`${idx + 1}. Q: ${faq.question}`);
      lines.push(`   A: ${faq.answer}`);
      lines.push("");
    });
  }

  // GBP Post Ideas
  if (response.gmbPostIdeas && response.gmbPostIdeas.length > 0) {
    lines.push("GOOGLE BUSINESS PROFILE POST IDEAS");
    lines.push("-".repeat(70));
    response.gmbPostIdeas.forEach((idea, idx) => {
      lines.push(`${idx + 1}. ${idea}`);
    });
    lines.push("");
  }

  lines.push("=".repeat(70));
  lines.push("End of Report");
  lines.push("=".repeat(70));

  return lines.join("\n");
}

/**
 * Generate filename for TXT report export
 */
export function getTxtFilename(businessName?: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const namePart = sanitizeForFilename(businessName || "keywords");
  return `OBD-Local-Keyword-Report-${namePart}-v3.1-${date}.txt`;
}

/**
 * Trigger browser download for a text blob
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

