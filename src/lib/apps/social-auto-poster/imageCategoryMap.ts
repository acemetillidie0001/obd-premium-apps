/**
 * OBD Social Auto-Poster - Image Category Mapping
 * 
 * Maps post content to image categories for the image engine.
 * This is ONLY category selection - safety rules are enforced by the engine.
 */

import type { ImageCategory } from "@/lib/image-engine/types";
import type { ContentTheme, SocialPostDraft } from "./types";

/**
 * Infers image category from post content and metadata.
 * 
 * Rules (simple + deterministic):
 * - If goal/purpose includes discount/sale/offer/event -> promotion
 * - If post is tip/how-to/faq -> educational
 * - If post is testimonial-like -> social_proof (but NO real quotes; engine will force abstract)
 * - If location-focused -> local_abstract
 * - else -> evergreen
 * 
 * @param post - Post draft with content and metadata
 * @param campaignType - Campaign type (if available)
 * @returns Image category
 */
export function inferImageCategoryFromPost(
  post: Pick<SocialPostDraft, "content" | "theme" | "reason">,
  campaignType?: "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement"
): ImageCategory {
  const contentLower = post.content.toLowerCase();
  const reasonLower = post.reason?.toLowerCase() || "";

  // Check for promotion indicators
  const promotionKeywords = [
    "discount",
    "sale",
    "offer",
    "special",
    "deal",
    "promo",
    "limited time",
    "save",
    "percent off",
    "% off",
  ];
  const hasPromotionKeyword =
    promotionKeywords.some((kw) => contentLower.includes(kw)) ||
    promotionKeywords.some((kw) => reasonLower.includes(kw));

  if (hasPromotionKeyword || campaignType === "Limited-Time Offer") {
    return "promotion";
  }

  // Check for event indicators
  if (
    campaignType === "Event" ||
    contentLower.includes("event") ||
    contentLower.includes("happening") ||
    contentLower.includes("join us") ||
    reasonLower.includes("event")
  ) {
    return "promotion"; // Events are promotional
  }

  // Check for educational indicators
  const educationalKeywords = [
    "tip",
    "how to",
    "how-to",
    "guide",
    "faq",
    "learn",
    "did you know",
    "insight",
    "advice",
  ];
  const hasEducationalKeyword =
    educationalKeywords.some((kw) => contentLower.includes(kw)) ||
    educationalKeywords.some((kw) => reasonLower.includes(kw)) ||
    post.theme === "education";

  if (hasEducationalKeyword) {
    return "educational";
  }

  // Check for social proof indicators (but engine will force abstract)
  const socialProofKeywords = [
    "testimonial",
    "review",
    "customer",
    "client",
    "trust",
    "rated",
    "star",
  ];
  const hasSocialProofKeyword =
    socialProofKeywords.some((kw) => contentLower.includes(kw)) ||
    post.theme === "social_proof";

  if (hasSocialProofKeyword) {
    return "social_proof";
  }

  // Check for location focus
  const locationKeywords = [
    "ocala",
    "local",
    "community",
    "neighborhood",
    "downtown",
    "here in",
    "our area",
  ];
  const hasLocationKeyword =
    locationKeywords.some((kw) => contentLower.includes(kw)) ||
    post.theme === "community";

  if (hasLocationKeyword) {
    return "local_abstract";
  }

  // Default to evergreen
  return "evergreen";
}

