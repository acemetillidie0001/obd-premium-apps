"use client";

export type Tier5SectionId =
  | "technical"
  | "on-page"
  | "local"
  | "content"
  | "trust"
  | "schema";

export type Tier5SectionStatus = "good" | "needs-work" | "missing";

export type SeoAuditSectionDef = {
  id: Tier5SectionId;
  title: string;
  categoryKeys: string[];
  emptyState?: { status: Tier5SectionStatus; summary: string; detail: string };
};

/**
 * Tier 5A/Tier 5B: Canonical section grouping for the SEO Audit accordion + exports.
 * IMPORTANT: This is a UI/export mapping only. It must not change audit scoring logic.
 */
export const SEO_AUDIT_SECTION_DEFS: SeoAuditSectionDef[] = [
  {
    id: "technical",
    title: "Technical SEO",
    categoryKeys: ["mobile-friendly"],
  },
  {
    id: "on-page",
    title: "On-Page SEO",
    categoryKeys: [
      "title-tag",
      "meta-description",
      "h1-tag",
      "heading-structure",
      "internal-links",
    ],
  },
  {
    id: "local",
    title: "Local SEO",
    categoryKeys: ["local-keywords"],
  },
  {
    id: "content",
    title: "Content & Coverage",
    categoryKeys: ["content-length"],
  },
  {
    id: "trust",
    title: "Trust Signals",
    categoryKeys: ["conversion-signals", "images-alt"],
  },
  {
    id: "schema",
    title: "Schema & Structured Data",
    categoryKeys: [],
    emptyState: {
      status: "missing",
      summary: "Not evaluated in this audit yet",
      detail:
        "This Tier 5A/Tier 5B scaffold includes a place for structured data checks, but the current deterministic audit does not score schema yet.",
    },
  },
];


