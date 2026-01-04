/**
 * Shared Handoff Types
 * 
 * Defines the structure for handoff payloads between Premium Apps.
 * All payloads are tenant-safe and scoped (no cross-tenant lookups).
 */

/**
 * Web Draft Section Types
 */
export type WebDraftSectionType = "heading" | "paragraph" | "list";

/**
 * Web Draft Section
 */
export interface WebDraftSection {
  type: WebDraftSectionType;
  level?: number; // 2-4 for headings
  text?: string; // for headings and paragraphs
  items?: string[]; // for lists
}

/**
 * Web Draft Content
 */
export interface WebDraftContent {
  title: string;
  slug?: string;
  excerpt?: string;
  sections: WebDraftSection[];
  callToAction?: string;
}

/**
 * Web Draft Meta (SEO and canonical information)
 */
export interface WebDraftMeta {
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
}

/**
 * Web Draft Payload (v1)
 * 
 * Payload for ACW → Website/Blog Draft Export
 */
export interface WebDraftPayload {
  mode: "web-draft";
  source: "ai-content-writer";
  version: "1.0";
  content: WebDraftContent;
  meta?: WebDraftMeta;
}

/**
 * Discriminated Union of all handoff payload types
 * 
 * Extend this union as new handoff modes are added.
 */
export type HandoffPayload = WebDraftPayload;

/**
 * Type guard to check if payload is a WebDraftPayload
 */
export function isWebDraftPayload(
  payload: unknown
): payload is WebDraftPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "mode" in payload &&
    payload.mode === "web-draft" &&
    "source" in payload &&
    payload.source === "ai-content-writer" &&
    "version" in payload &&
    payload.version === "1.0"
  );
}

