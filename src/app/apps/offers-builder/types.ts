export type PersonalityStyle =
  | "None"
  | "Soft"
  | "Bold"
  | "High-Energy"
  | "Luxury";

export type LanguageOption = "English" | "Spanish" | "Bilingual";

export type PromoType =
  | "Discount"
  | "Limited-Time Offer"
  | "Seasonal Promotion"
  | "Holiday Special"
  | "Flash Sale"
  | "Referral Bonus"
  | "Loyalty Reward"
  | "New Customer Offer"
  | "Bundle Deal"
  | "Other";

export type OutputPlatform =
  | "Facebook"
  | "Instagram"
  | "Google Business Profile"
  | "X"
  | "Email"
  | "SMS"
  | "Flyer"
  | "Website Banner";

export interface OffersBuilderRequest {
  // Business Info
  businessName: string;
  businessType: string;
  services?: string[]; // derived from a comma-separated input
  city: string; // default "Ocala"
  state: string; // default "Florida"

  // Promotion Info
  promoType: PromoType;
  promoTitle?: string; // optional internal name for the offer
  promoDescription: string; // required, user explains the offer
  offerValue?: string; // "20% off", "$50 off", "Buy 1 Get 1", etc.
  offerCode?: string; // optional coupon code
  startDate?: string; // optional ISO-like string
  endDate?: string; // optional ISO-like string
  goal?: string; // e.g. "drive bookings", "increase walk-ins"
  targetAudience?: string; // "families", "horse owners", "Ocala locals"

  // Style + Output
  outputPlatforms: OutputPlatform[];
  brandVoice?: string;
  personalityStyle: PersonalityStyle;
  length: "Short" | "Medium" | "Long";
  language: LanguageOption;

  // Extras
  includeHashtags: boolean;
  hashtagStyle?: string; // "Local", "Branded", "Minimal", etc.
  variationsCount: number; // 1–5
  variationMode: "Conservative" | "Moderate" | "Creative";

  // Wizard
  wizardMode: boolean; // controls whether we show multi-step wizard

  // Regenerate constraints (optional, only used for regeneration)
  lockedFacts?: {
    promoTitle?: string;
    promoType: PromoType;
    offerValue?: string;
    newCustomersOnly?: boolean;
    endDate?: string;
    redemptionLimits?: string;
    primaryCTA?: string;
    urgencyLevel?: "low" | "medium" | "high";
  };
}

export interface PromoOutput {
  platform: OutputPlatform | string;
  headline: string;
  mainCopy: string;
  callToAction: string;
  hashtags?: string[];
  notes?: string; // e.g. "Good for boosted posts" / "Best used as a Story"
}

export interface OffersBuilderResponse {
  offerSummary: {
    internalName: string;
    headline: string;
    subheadline: string;
    shortPitch: string;
    fullPitch: string;
  };

  headlineOptions: {
    label: string; // "Punchy", "Safe", "High-Energy", etc.
    headline: string;
  }[];

  bodyOptions: {
    label: string;
    body: string;
  }[];

  socialPosts: PromoOutput[]; // one per requested platform

  gbpPost: {
    headline: string;
    description: string;
    suggestedCTA: string;
  };

  email: {
    subject: string;
    previewText: string;
    body: string;
  };

  sms: {
    message: string; // 1–2 sentence SMS-friendly version
  };

  websiteBanner: {
    headline: string;
    subheadline: string;
    buttonText: string;
  };

  graphicPrompt?: string; // Nano Banana / AI graphic description for the promo

  variations?: PromoOutput[]; // optional alternate promos

  meta: {
    languageUsed: LanguageOption;
    personalityApplied: PersonalityStyle;
    warnings?: string[]; // e.g. if dates missing, time-sensitive warnings
  };
}