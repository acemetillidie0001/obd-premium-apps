/**
 * AI Logo Generator handoff (Tier 5C sender: draft-asset, apply-only).
 *
 * Tenant safety:
 * - businessId is REQUIRED in sender payloads
 * - receiver should validate URL businessId matches payload businessId before applying
 *
 * Transport:
 * - Writes to a dedicated sender key (per spec)
 * - Also writes via the standardized Social Auto-Poster handoff transport so the composer can read it
 */

import { writeHandoff } from "@/lib/obd-framework/social-handoff-transport";

export type AILogoGeneratorDraftHandoffV1 = {
  v: 1;
  type: "ai_logo_generator_to_social_auto_poster_draft";
  sourceApp: "ai-logo-generator";
  createdAt: string;
  businessId?: string;
  userId?: string;
  logos?: Array<{
    id?: string;
    name?: string;
    imageUrl?: string | null;
    prompt?: string;
    tags?: string[];
    colorPalette?: string[];
    description?: string;
    styleNotes?: string;
  }>;
  logo?: {
    id?: string;
    name?: string;
    imageUrl?: string | null;
    prompt?: string;
    tags?: string[];
    colorPalette?: string[];
    description?: string;
    styleNotes?: string;
  };
};

export const AI_LOGO_TO_SOCIAL_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:ai-logo-generator:social-auto-poster:v1";

export const AI_LOGO_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const AI_LOGO_TO_BRAND_KIT_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:ai-logo-generator:brand-kit:v1";

export const AI_LOGO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:ai-logo-generator:ai-help-desk:v1";

export type AiLogoToSocialHandoffLogo = {
  id: string;
  name: string;
  prompt: string;
  tags: string[];
  palette: string[];
  imageUrl: string | null;
};

export type AiLogoToSocialHandoffPayload = {
  v: 1;
  type: "ai_logo_generator_to_social_auto_poster_draft";
  sourceApp: "ai-logo-generator";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  businessId: string;
  logos: AiLogoToSocialHandoffLogo[];
};

export type AiLogoToBrandKitHandoffPayload = {
  v: 1;
  type: "ai_logo_generator_to_brand_kit_draft_suggestion";
  sourceApp: "ai-logo-generator";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  businessId: string;
  logos: AiLogoToSocialHandoffLogo[];
};

export type AiLogoToHelpDeskHandoffPayload = {
  v: 1;
  type: "ai_logo_generator_to_ai_help_desk_icon_draft_suggestion";
  sourceApp: "ai-logo-generator";
  createdAt: string; // ISO
  expiresAt: string; // ISO
  businessId: string;
  logos: AiLogoToSocialHandoffLogo[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function computeExpiresAt(createdAtIso: string, ttlMs: number): string {
  const createdAt = new Date(createdAtIso);
  return new Date(createdAt.getTime() + ttlMs).toISOString();
}

export function buildAiLogoToSocialHandoffPayload(args: {
  businessId: string;
  logos: AiLogoToSocialHandoffLogo[];
  createdAt?: string;
}): AiLogoToSocialHandoffPayload {
  const businessId = (args.businessId || "").trim();
  if (!businessId) {
    throw new Error("businessId is required for AI Logo -> Social Auto-Poster handoff.");
  }
  const createdAt = args.createdAt ?? nowIso();
  return {
    v: 1,
    type: "ai_logo_generator_to_social_auto_poster_draft",
    sourceApp: "ai-logo-generator",
    createdAt,
    expiresAt: computeExpiresAt(createdAt, AI_LOGO_HANDOFF_TTL_MS),
    businessId,
    logos: Array.isArray(args.logos) ? args.logos : [],
  };
}

export function buildAiLogoToBrandKitPayload(args: {
  businessId: string;
  logos: AiLogoToSocialHandoffLogo[];
  createdAt?: string;
}): AiLogoToBrandKitHandoffPayload {
  const businessId = (args.businessId || "").trim();
  if (!businessId) {
    throw new Error("businessId is required for AI Logo -> Brand Kit handoff.");
  }
  const createdAt = args.createdAt ?? nowIso();
  return {
    v: 1,
    type: "ai_logo_generator_to_brand_kit_draft_suggestion",
    sourceApp: "ai-logo-generator",
    createdAt,
    expiresAt: computeExpiresAt(createdAt, AI_LOGO_HANDOFF_TTL_MS),
    businessId,
    logos: Array.isArray(args.logos) ? args.logos : [],
  };
}

export function buildAiLogoToHelpDeskPayload(args: {
  businessId: string;
  logos: AiLogoToSocialHandoffLogo[];
  createdAt?: string;
}): AiLogoToHelpDeskHandoffPayload {
  const businessId = (args.businessId || "").trim();
  if (!businessId) {
    throw new Error("businessId is required for AI Logo -> AI Help Desk handoff.");
  }
  const createdAt = args.createdAt ?? nowIso();
  return {
    v: 1,
    type: "ai_logo_generator_to_ai_help_desk_icon_draft_suggestion",
    sourceApp: "ai-logo-generator",
    createdAt,
    expiresAt: computeExpiresAt(createdAt, AI_LOGO_HANDOFF_TTL_MS),
    businessId,
    logos: Array.isArray(args.logos) ? args.logos : [],
  };
}

/**
 * Store payload in sessionStorage under the per-sender key (spec),
 * and also write to standardized Social Auto-Poster transport (so composer can read it).
 */
export function writeAiLogoToSocialAutoPosterHandoff(
  payload: AiLogoToSocialHandoffPayload
): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      AI_LOGO_TO_SOCIAL_HANDOFF_STORAGE_KEY_V1,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn("Failed to write AI Logo handoff payload to sessionStorage:", error);
  }

  // Standardized transport for Social Auto-Poster composer (sessionStorage + TTL envelope)
  writeHandoff("ai-logo-generator", payload, AI_LOGO_HANDOFF_TTL_MS);
}

/**
 * Store payloads for apply-only receivers (Brand Kit Builder, AI Help Desk Widget).
 * Sender writes ONLY to the dedicated key (receiver reads + validates TTL).
 */
export function storeAiLogoToBrandKitHandoff(payload: AiLogoToBrandKitHandoffPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      AI_LOGO_TO_BRAND_KIT_HANDOFF_STORAGE_KEY_V1,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn("Failed to write AI Logo -> Brand Kit handoff payload to sessionStorage:", error);
  }
}

export function storeAiLogoToHelpDeskHandoff(payload: AiLogoToHelpDeskHandoffPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      AI_LOGO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn(
      "Failed to write AI Logo -> AI Help Desk handoff payload to sessionStorage:",
      error
    );
  }
}

/**
 * Optional getter for debugging (reads from per-sender key only).
 * Enforces TTL and clears expired payloads.
 */
export function readAiLogoToSocialAutoPosterHandoff():
  | { payload: AiLogoToSocialHandoffPayload; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  if (typeof window === "undefined") return { payload: null, expired: false };

  try {
    const raw = sessionStorage.getItem(AI_LOGO_TO_SOCIAL_HANDOFF_STORAGE_KEY_V1);
    if (!raw) return { payload: null, expired: false };

    const parsed = JSON.parse(raw) as Partial<AiLogoToSocialHandoffPayload>;
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expires || Number.isNaN(expires) || Date.now() > expires) {
      try {
        sessionStorage.removeItem(AI_LOGO_TO_SOCIAL_HANDOFF_STORAGE_KEY_V1);
      } catch {
        // ignore
      }
      return { payload: null, expired: true };
    }

    return { payload: parsed as AiLogoToSocialHandoffPayload, expired: false };
  } catch (error) {
    console.warn("Failed to read AI Logo handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}

function readHandoffPayloadFromKey<T extends { expiresAt: string }>(key: string):
  | { payload: T; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  if (typeof window === "undefined") return { payload: null, expired: false };
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { payload: null, expired: false };
    const parsed = JSON.parse(raw) as Partial<T>;
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expires || Number.isNaN(expires) || Date.now() > expires) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
      return { payload: null, expired: true };
    }
    return { payload: parsed as T, expired: false };
  } catch (error) {
    console.warn("Failed to read handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}

export function readAiLogoToBrandKitHandoff():
  | { payload: AiLogoToBrandKitHandoffPayload; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  return readHandoffPayloadFromKey<AiLogoToBrandKitHandoffPayload>(
    AI_LOGO_TO_BRAND_KIT_HANDOFF_STORAGE_KEY_V1
  );
}

export function readAiLogoToHelpDeskHandoff():
  | { payload: AiLogoToHelpDeskHandoffPayload; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  return readHandoffPayloadFromKey<AiLogoToHelpDeskHandoffPayload>(
    AI_LOGO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1
  );
}

export function clearAiLogoToBrandKitHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AI_LOGO_TO_BRAND_KIT_HANDOFF_STORAGE_KEY_V1);
  } catch {
    // ignore
  }
}

export function clearAiLogoToHelpDeskHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AI_LOGO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1);
  } catch {
    // ignore
  }
}

/**
 * Placeholder factory for future use.
 * NOTE: Not currently used/wired anywhere.
 */
export function createAiLogoGeneratorDraftHandoffV1(
  payload: Omit<AILogoGeneratorDraftHandoffV1, "v" | "type" | "sourceApp" | "createdAt"> &
    Partial<Pick<AILogoGeneratorDraftHandoffV1, "createdAt">>
): AILogoGeneratorDraftHandoffV1 {
  return {
    v: 1,
    type: "ai_logo_generator_to_social_auto_poster_draft",
    sourceApp: "ai-logo-generator",
    createdAt: payload.createdAt ?? new Date().toISOString(),
    businessId: payload.businessId,
    userId: payload.userId,
    logos: payload.logos,
    logo: payload.logo,
  };
}


