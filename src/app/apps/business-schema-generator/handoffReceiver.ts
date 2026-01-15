import type { SchemaHandoffPayload } from "./handoffTypes";
import { clearHandoffParamsFromUrl, replaceUrlWithoutReload } from "@/lib/utils/clear-handoff-params";

const HANDOFF_SESSION_KEY = "obd:schema-handoff";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function isSupportedSource(value: unknown): SchemaHandoffPayload["source"] | null {
  switch (value) {
    case "ai-faq-generator":
    case "offers-promotions":
    case "event-campaign-builder":
    case "local-seo-page-builder":
      return value;
    default:
      return null;
  }
}

function parsePayload(raw: string): SchemaHandoffPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;
  if (parsed.v !== 1) return null;

  const source = isSupportedSource(parsed.source);
  if (!source) return null;

  if (typeof parsed.tenantId !== "string" || parsed.tenantId.trim().length === 0) return null;
  if (!isValidIsoDateString(parsed.createdAt)) return null;
  if (!isValidIsoDateString(parsed.expiresAt)) return null;

  if (!Array.isArray(parsed.nodes)) return null;
  for (const node of parsed.nodes) {
    if (!isPlainObject(node)) return null;
  }

  return {
    v: 1,
    source,
    tenantId: parsed.tenantId,
    createdAt: parsed.createdAt,
    expiresAt: parsed.expiresAt,
    nodes: parsed.nodes as Record<string, any>[],
  };
}

/**
 * Read and validate a schema handoff payload from sessionStorage.
 *
 * Key: "obd:schema-handoff"
 * - Validates minimal contract
 * - Enforces TTL via expiresAt
 * - Returns payload or null
 */
export function readHandoffFromSession(): SchemaHandoffPayload | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(HANDOFF_SESSION_KEY);
  if (!raw) return null;

  const payload = parsePayload(raw);
  if (!payload) return null;

  const now = Date.now();
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    // TTL safety: expired payloads are ignored silently, but removed so they don't reappear.
    try {
      window.sessionStorage.removeItem(HANDOFF_SESSION_KEY);
    } catch {
      // ignore
    }
    return null;
  }

  return payload;
}

/**
 * Clear the stored handoff payload and remove known handoff-related URL params.
 */
export function clearHandoff(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(HANDOFF_SESSION_KEY);
  } catch {
    // ignore
  }

  const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
  replaceUrlWithoutReload(cleanUrl);
}

/**
 * Strict tenant match required.
 */
export function isTenantMatch(payloadTenantId: string, currentTenantId: string): boolean {
  return payloadTenantId === currentTenantId;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableNormalize(value[key]);
  }
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function normalizeType(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim()) as string[];
  return [];
}

function getNodeId(node: Record<string, unknown>): string | null {
  const id = node["@id"];
  return typeof id === "string" && id.trim().length > 0 ? id : null;
}

function hasTypeOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setA = new Set(a);
  for (const t of b) if (setA.has(t)) return true;
  return false;
}

function isDuplicateNode(existing: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  const existingId = getNodeId(existing);
  const incomingId = getNodeId(incoming);

  const existingTypes = normalizeType(existing["@type"]);
  const incomingTypes = normalizeType(incoming["@type"]);

  // Primary: same @id + overlapping @type
  if (existingId && incomingId && existingId === incomingId && hasTypeOverlap(existingTypes, incomingTypes)) {
    return true;
  }

  // Fallback: deep-equal (stable key sort) when id/type matching isn't possible
  return stableStringify(existing) === stableStringify(incoming);
}

type JsonLdDoc = Record<string, unknown> & { "@graph": unknown[] };

function coerceToGraphDoc(parsed: unknown): JsonLdDoc {
  // Default doc if active schema is empty
  if (parsed === null || parsed === undefined || parsed === "") {
    return { "@context": "https://schema.org", "@graph": [] };
  }

  if (Array.isArray(parsed)) {
    return { "@context": "https://schema.org", "@graph": parsed };
  }

  if (isPlainObject(parsed)) {
    const graph = parsed["@graph"];
    if (Array.isArray(graph)) {
      return parsed as JsonLdDoc;
    }

    // No @graph: convert the object into a graph doc while preserving @context if present.
    const ctx = parsed["@context"];
    const nodeCandidate: Record<string, unknown> = { ...parsed };
    delete nodeCandidate["@context"];

    const doc: JsonLdDoc = {
      ...(ctx !== undefined ? { "@context": ctx } : { "@context": "https://schema.org" }),
      "@graph": [],
    };

    if (Object.keys(nodeCandidate).length > 0) {
      doc["@graph"].push(nodeCandidate);
    }

    return doc;
  }

  // Unsupported JSON root type
  throw new Error("Active schema must be a JSON object or array.");
}

/**
 * Add schema nodes into the active JSON-LD additively.
 *
 * - Ensures @graph exists (creates if needed)
 * - Adds nodes only if no existing node has same @type + @id (or deep-equal fallback)
 * - Does NOT overwrite existing nodes
 * - Does NOT reorder existing nodes (new nodes append to @graph)
 */
export function mergeNodesAdditive(activeJson: string, incomingNodes: Record<string, any>[]): string {
  const trimmed = (activeJson ?? "").trim();
  const parsed = trimmed ? (JSON.parse(trimmed) as unknown) : "";

  const doc = coerceToGraphDoc(parsed);
  const graph = Array.isArray(doc["@graph"]) ? (doc["@graph"] as unknown[]) : [];

  const existingNodes = graph.filter(isPlainObject) as Record<string, unknown>[];
  const nextGraph = [...graph];

  for (const rawNode of incomingNodes) {
    if (!isPlainObject(rawNode)) continue;

    const duplicate = existingNodes.some((ex) => isDuplicateNode(ex, rawNode));
    if (duplicate) continue;

    nextGraph.push(rawNode);
    existingNodes.push(rawNode);
  }

  // Preserve all other top-level keys and do not reorder existing nodes.
  const nextDoc: Record<string, unknown> = { ...doc, "@graph": nextGraph };
  return JSON.stringify(nextDoc, null, 2);
}


