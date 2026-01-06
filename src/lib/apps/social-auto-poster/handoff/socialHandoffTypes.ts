/**
 * Canonical Social Auto-Poster Handoff Types
 * 
 * Unified payload structure for importing content from multiple apps
 */

export type SocialHandoffSource =
  | "ai-content-writer"
  | "offers-builder"
  | "event-campaign-builder"
  | "image-caption-generator";

export interface SocialComposerHandoffPayload {
  v: 1;
  source: SocialHandoffSource;
  createdAt?: string;
  text?: string;

  // Optional structured fields
  campaignType?: "offer" | "event";
  headline?: string;
  description?: string;
  cta?: string;
  expirationDate?: string;
  eventName?: string;
  eventDate?: string;
  location?: string;
  countdownVariants?: string[];
}

/**
 * Get pretty display name for source
 */
export function getSourceDisplayName(source: SocialHandoffSource): string {
  switch (source) {
    case "ai-content-writer":
      return "Content Writer";
    case "offers-builder":
      return "Offers & Promotions";
    case "event-campaign-builder":
      return "Event Campaign Builder";
    case "image-caption-generator":
      return "Image Caption Generator";
    default:
      return "Unknown Source";
  }
}

