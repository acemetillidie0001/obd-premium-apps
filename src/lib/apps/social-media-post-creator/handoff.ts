import type { SMPCPostItem } from "@/lib/apps/social-media-post-creator/types";

export const SMPC_HANDOFF_KEY =
  "obd:handoff:social-media-post-creator:social-auto-poster:v1";

export const SMPC_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type SmpcToSocialAutoPosterHandoffPayloadV1 = {
  v: 1;
  source: "social-media-post-creator";
  createdAt: number;
  ttlMs: number;
  businessId: string;
  items: Array<{ platform: string; text: string }>;
};

export function formatSmpcPostText(post: SMPCPostItem): string {
  const hook = (post.hook || "").trim();
  const body = (post.bodyLines || []).map((l) => (l || "").trim()).filter(Boolean).join("\n");
  const cta = (post.cta || "").trim();

  const parts = [hook, body, cta].filter(Boolean);
  // Deterministic: blank line between sections, no trailing whitespace
  return parts.join("\n\n").trim();
}

export function buildSmpcHandoffPayload(params: {
  businessId: string;
  posts: SMPCPostItem[];
  ttlMs?: number;
}): SmpcToSocialAutoPosterHandoffPayloadV1 {
  const businessId = params.businessId.trim();
  const ttlMs = typeof params.ttlMs === "number" && params.ttlMs > 0 ? params.ttlMs : SMPC_HANDOFF_TTL_MS;
  const createdAt = Date.now();

  const items = params.posts
    .map((post) => ({
      platform: post.platformKey !== "other" ? post.platformKey : post.platformLabel,
      text: formatSmpcPostText(post),
    }))
    .filter((x) => x.text.trim().length > 0);

  return {
    v: 1,
    source: "social-media-post-creator",
    createdAt,
    ttlMs,
    businessId,
    items,
  };
}

export function isSmpcHandoffPayloadV1(payload: unknown): payload is SmpcToSocialAutoPosterHandoffPayloadV1 {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.v !== 1) return false;
  if (p.source !== "social-media-post-creator") return false;
  if (typeof p.createdAt !== "number") return false;
  if (typeof p.ttlMs !== "number" || p.ttlMs <= 0) return false;
  if (typeof p.businessId !== "string" || p.businessId.trim().length === 0) return false;
  if (!Array.isArray(p.items) || p.items.length === 0) return false;
  for (const item of p.items) {
    if (!item || typeof item !== "object") return false;
    const it = item as Record<string, unknown>;
    if (typeof it.platform !== "string" || it.platform.trim().length === 0) return false;
    if (typeof it.text !== "string" || it.text.trim().length === 0) return false;
  }
  return true;
}

