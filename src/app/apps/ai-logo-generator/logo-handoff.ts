/**
 * AI Logo Generator handoff (stub-only; intentionally not wired yet).
 *
 * This module will eventually build "draft assets" handoffs to other apps
 * (e.g., Social Auto-Poster). For now it exists as a placeholder only.
 */

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


