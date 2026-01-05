export type PlatformOption =
  | "Facebook"
  | "Instagram"
  | "InstagramStory"
  | "GoogleBusinessProfile"
  | "X"
  | "Generic";

export type GoalOption =
  | "Awareness"
  | "Promotion"
  | "Event"
  | "Testimonial"
  | "BehindTheScenes"
  | "Educational";

export type CallToActionPreference = "Soft" | "Direct" | "None";

export type PersonalityStyle = "Soft" | "Bold" | "High-Energy" | "Luxury" | "";

export type CaptionLength = "Short" | "Medium" | "Long";

export type HashtagStyle = "Local" | "Branded" | "Mixed";

export type VariationMode = "Safe" | "Creative" | "Storytelling" | "Punchy";

export type LanguageOption = "English" | "Spanish" | "Bilingual";

export interface ImageCaptionRequest {
  businessName: string;
  businessType: string;
  services: string[];
  city: string;
  state: string;
  imageContext: string;
  imageDetails: string;
  platform: PlatformOption;
  goal: GoalOption;
  callToActionPreference: CallToActionPreference;
  brandVoice: string;
  personalityStyle: PersonalityStyle;
  captionLength: CaptionLength;
  includeHashtags: boolean;
  hashtagStyle: HashtagStyle;
  variationsCount: number;
  variationMode: VariationMode;
  language: LanguageOption;
}

export interface Caption {
  id: number;
  label: string;
  lengthMode: CaptionLength;
  variationMode: VariationMode;
  platform: PlatformOption | "Generic";
  text: string;
  hashtags: string[];
  previewHint: string;
}

export interface ImageCaptionResponseMeta {
  businessName: string;
  city: string;
  state: string;
  platform: string;
  goal: string;
  captionLength: string;
  includeHashtags: boolean;
  variationMode: string;
  language: string;
}

export interface ImageCaptionResponse {
  captions: Caption[];
  meta: ImageCaptionResponseMeta;
}

/**
 * CaptionItem - Canonical internal state type for caption management
 * 
 * Used for state management, editing, selection, export, and handoff.
 * Maps from API Caption type to this normalized structure.
 */
export interface CaptionItem {
  id: string; // Stable string ID (converted from numeric ID)
  platform: string; // "facebook" | "instagram" | "google" | etc. (extendable)
  goal?: string | null;
  tone?: string | null;
  length?: "short" | "medium" | "long" | string | null;
  caption: string; // The caption text (mapped from "text" field)
  hashtags?: string[] | null;
  createdAt?: number; // Optional local timestamp
  // Display-only fields (preserved from original Caption for UI)
  label?: string;
  lengthMode?: CaptionLength;
  variationMode?: VariationMode;
  previewHint?: string;
}

