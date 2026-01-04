/**
 * Brand Profile Type Definition
 * 
 * Matches the stored brand profile shape used in /apps/brand-profile.
 * This type represents the complete brand profile data structure.
 */

export interface BrandProfile {
  // Metadata (optional, may not be present when loaded from API)
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string | null;

  // Business Basics
  businessName?: string | null;
  businessType?: string | null;
  city?: string | null;
  state?: string | null;

  // Brand Direction
  brandPersonality?: string | null;
  targetAudience?: string | null;
  differentiators?: string | null; // "What Makes You Different"
  inspirationBrands?: string | null;
  avoidStyles?: string | null; // "Styles to Avoid"

  // Voice & Language
  brandVoice?: string | null;
  toneNotes?: string | null;
  language?: string | null;

  // Output Controls
  industryKeywords?: string | null;
  vibeKeywords?: string | null;
  variationMode?: string | null;
  hashtagStyle?: string | null;
  includeHashtags?: boolean;

  // Extra Sections (toggles)
  includeSocialPostTemplates?: boolean;
  includeFAQStarter?: boolean;
  includeGBPDescription?: boolean;
  includeMetaDescription?: boolean;

  // JSON fields (optional, complex data structures)
  colorsJson?: Record<string, unknown> | null;
  typographyJson?: Record<string, unknown> | null;
  messagingJson?: Record<string, unknown> | null;
  kitJson?: Record<string, unknown> | null;
}

