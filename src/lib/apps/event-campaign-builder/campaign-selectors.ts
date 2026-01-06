/**
 * Campaign Selectors
 * 
 * Helper functions to extract and group CampaignItem[] by channel/asset type.
 * Used for rendering UI directly from canonical state.
 */

import type { CampaignItem } from "@/app/apps/event-campaign-builder/types";

/**
 * Get all items of a specific type, sorted by index
 */
export function getItemsByType(
  items: CampaignItem[],
  type: CampaignItem["type"]
): CampaignItem[] {
  return items
    .filter((item) => item.type === type)
    .sort((a, b) => {
      const aIdx = a.index ?? 0;
      const bIdx = b.index ?? 0;
      return aIdx - bIdx;
    });
}

/**
 * Get items for a specific channel/platform
 */
export function getItemsForChannel(
  items: CampaignItem[],
  channel: "facebook" | "instagram" | "x" | "googleBusiness" | "email" | "sms"
): CampaignItem[] {
  const typeMap: Record<string, CampaignItem["type"][]> = {
    facebook: ["asset-facebookPost"],
    instagram: ["asset-instagramCaption", "asset-instagramStory"],
    x: ["asset-xPost"],
    googleBusiness: ["asset-googleBusinessPost"],
    email: ["asset-emailSubject", "asset-emailPreviewText", "asset-emailBodyText", "asset-emailBodyHtml"],
    sms: ["asset-smsBlast"],
  };

  const types = typeMap[channel] || [];
  return items
    .filter((item) => types.includes(item.type))
    .sort((a, b) => {
      // Email items have specific order: subject, preview, body, html
      if (channel === "email") {
        const order: Record<string, number> = {
          "asset-emailSubject": 0,
          "asset-emailPreviewText": 1,
          "asset-emailBodyText": 2,
          "asset-emailBodyHtml": 3,
        };
        return (order[a.type] ?? 999) - (order[b.type] ?? 999);
      }
      // Other channels sort by index
      const aIdx = a.index ?? 0;
      const bIdx = b.index ?? 0;
      return aIdx - bIdx;
    });
}

/**
 * Get meta items (tagline, CTA, etc.)
 */
export function getMetaItem(
  items: CampaignItem[],
  metaType: "primaryTagline" | "primaryCallToAction" | "recommendedStartDateNote" | "timezoneNote"
): CampaignItem | undefined {
  return items.find((item) => item.type === `meta-${metaType}`);
}

/**
 * Get single asset item (longDescription, imageCaption)
 */
export function getSingleAsset(
  items: CampaignItem[],
  assetType: "longDescription" | "imageCaption"
): CampaignItem | undefined {
  return items.find((item) => item.type === `asset-${assetType}`);
}

/**
 * Get hashtag bundles
 */
export function getHashtagBundles(items: CampaignItem[]): CampaignItem[] {
  return getItemsByType(items, "asset-hashtagBundle");
}

/**
 * Get schedule ideas
 */
export function getScheduleIdeas(items: CampaignItem[]): CampaignItem[] {
  return getItemsByType(items, "asset-scheduleIdea");
}

