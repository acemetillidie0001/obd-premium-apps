export type BrandPersonality =
  | "Friendly"
  | "Professional"
  | "Bold"
  | "High-Energy"
  | "Luxury"
  | "Trustworthy"
  | "Playful";

export type LanguageOption = "English" | "Spanish" | "Bilingual";

export type VariationMode = "Conservative" | "Moderate" | "Bold";

export type HashtagStyle = "Local" | "Branded" | "Minimal";

export interface BrandKitBuilderRequest {
  // Business Basics
  businessName: string;
  businessType: string;
  services: string[]; // derived from comma-separated input
  city: string; // default "Ocala"
  state: string; // default "Florida"

  // Brand Direction
  brandPersonality: BrandPersonality;
  targetAudience?: string;
  differentiators?: string;
  inspirationBrands?: string;
  avoidStyles?: string; // e.g., "no neon", "avoid cursive fonts"

  // Voice & Language
  brandVoice?: string; // optional textarea; if present, overrides personality
  toneNotes?: string;
  language: LanguageOption;

  // Output Controls
  industryKeywords?: string; // optional textarea; limit usage to 1-2 mentions per output section
  vibeKeywords?: string;
  variationMode: VariationMode; // default Conservative
  includeHashtags: boolean;
  hashtagStyle: HashtagStyle;

  // Extras toggles
  includeSocialPostTemplates: boolean;
  includeFAQStarter: boolean;
  includeGBPDescription: boolean;
  includeMetaDescription: boolean;
}

export type ColorName = "Primary" | "Secondary" | "Accent" | "Background" | "Text";

export interface ColorInfo {
  hex: string;
  name: ColorName;
  usageGuidance: string;
  accessibilityNote: string; // contrast considerations
}

export interface TypographyPairing {
  headlineFont: string;
  bodyFont: string;
  fallbackStack: string; // CSS font-family fallback
  usageNotes: string;
}

export interface BrandVoiceGuide {
  description: string; // 1-2 paragraphs
  do: string[]; // Do bullets
  dont: string[]; // Don't bullets
}

export interface BrandKitBuilderResponse {
  meta: {
    model: string;
    createdAtISO: string;
    latencyMs: number;
    requestId: string;
    languageUsed: LanguageOption;
  };

  brandSummary: {
    businessName: string;
    tagline?: string;
    positioning: string; // short overview
  };

  colorPalette: {
    colors: ColorInfo[]; // minimum 5: Primary, Secondary, Accent, Background, Text
  };

  typography: TypographyPairing;

  brandVoice: BrandVoiceGuide;

  messaging: {
    taglines: string[]; // 5 options
    valueProps: string[]; // 5 bullets
    elevatorPitch: string; // 80-120 words
  };

  readyToUseCopy: {
    websiteHero: {
      headline: string;
      subheadline: string;
    };
    aboutUs: string; // 150-220 words
    socialBios: {
      instagram: string;
      facebook: string;
      x: string;
    };
    emailSignature: string;
  };

  extras?: {
    socialPostTemplates?: string[]; // 3 short post templates (if includeSocialPostTemplates)
    faqStarter?: Array<{
      question: string;
      answer: string;
    }>; // 5 Q&A (if includeFAQStarter)
    gbpDescription?: string; // 750 chars max (if includeGBPDescription)
    metaDescription?: string; // 140-160 chars (if includeMetaDescription)
  };
}
