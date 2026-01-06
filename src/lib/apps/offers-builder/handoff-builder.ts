/**
 * Handoff Builder for Offers & Promotions Builder
 * 
 * Builds handoff payloads for sending offers to Social Auto-Poster
 */

import type { OffersBuilderResponse } from "@/app/apps/offers-builder/types";

/**
 * Handoff payload for Social Auto-Poster import from Offers Builder
 */
export interface OffersBuilderHandoffPayload {
  type: "social_auto_poster_import";
  sourceApp: "offers-builder";
  campaignType: "offer";
  headline: string;
  description: string;
  expirationDate?: string;
  suggestedCTA?: string;
  suggestedPlatforms: string[];
  meta: {
    sourceApp: "offers-builder";
    createdAt: number;
  };
}

/**
 * Build handoff payload for Social Auto-Poster from Offers Builder result
 * 
 * @param result - Offers Builder response
 * @param form - Original form data (for expiration date if available)
 * @returns Handoff payload ready for encoding
 */
export function buildSocialAutoPosterHandoff(
  result: OffersBuilderResponse,
  form?: { endDate?: string; offerCode?: string }
): OffersBuilderHandoffPayload {
  // Use the offer summary headline, or first headline option, or first social post headline
  const headline = result.offerSummary?.headline || 
                   result.headlineOptions?.[0]?.headline || 
                   result.socialPosts?.[0]?.headline || 
                   "Special Offer";

  // Use the full pitch or first body option, or first social post main copy
  const description = result.offerSummary?.fullPitch || 
                     result.bodyOptions?.[0]?.body || 
                     result.socialPosts?.[0]?.mainCopy || 
                     "";

  // Use GBP suggested CTA or first social post CTA
  const suggestedCTA = result.gbpPost?.suggestedCTA || 
                      result.socialPosts?.[0]?.callToAction || 
                      "Learn More";

  // Extract platforms from social posts
  const platformMap: string[] = [];
  if (result.socialPosts && result.socialPosts.length > 0) {
    for (const post of result.socialPosts) {
      const platform = post.platform?.toLowerCase() || "";
      if (platform === "facebook" && !platformMap.includes("facebook")) {
        platformMap.push("facebook");
      } else if (platform === "instagram" && !platformMap.includes("instagram")) {
        platformMap.push("instagram");
      } else if ((platform === "x" || platform === "twitter") && !platformMap.includes("x")) {
        platformMap.push("x");
      }
    }
  }
  const suggestedPlatforms = platformMap.length > 0 ? platformMap : ["facebook", "instagram"];

  return {
    type: "social_auto_poster_import",
    sourceApp: "offers-builder",
    campaignType: "offer",
    headline: headline.trim(),
    description: description.trim(),
    expirationDate: form?.endDate || undefined,
    suggestedCTA: suggestedCTA.trim(),
    suggestedPlatforms: suggestedPlatforms.length > 0 ? suggestedPlatforms : ["facebook", "instagram"],
    meta: {
      sourceApp: "offers-builder",
      createdAt: Date.now(),
    },
  };
}

/**
 * Encode handoff payload to base64url for URL parameter
 * 
 * @param payload - Handoff payload object
 * @returns Base64url-encoded string
 */
export function encodeHandoffPayload(payload: OffersBuilderHandoffPayload): string {
  const jsonString = JSON.stringify(payload);
  
  // Convert UTF-8 string to bytes, then to base64url
  const utf8Bytes = new TextEncoder().encode(jsonString);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  
  // Convert to base64url (replace + with -, / with _, remove padding)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

