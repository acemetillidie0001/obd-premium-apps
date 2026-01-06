/**
 * Campaign Mapper
 * 
 * Converts EventCampaignResponse to CampaignItem[] format for canonical state management.
 * 
 * Pattern matches Image Caption Generator's caption-mapper architecture.
 */

import type { EventCampaignResponse, CampaignItem } from "@/app/apps/event-campaign-builder/types";

/**
 * Map EventCampaignResponse to CampaignItem[] array
 * 
 * Converts the API response format into a flat array of editable campaign items.
 * Each item has a stable ID and can be edited independently.
 * 
 * @param response - The EventCampaignResponse from the API
 * @returns Array of CampaignItem objects
 */
export function mapCampaignToItems(response: EventCampaignResponse): CampaignItem[] {
  const items: CampaignItem[] = [];

  // Map meta fields
  if (response.meta.primaryTagline) {
    items.push({
      id: "meta-primaryTagline",
      type: "meta-primaryTagline",
      content: response.meta.primaryTagline,
      createdAt: Date.now(),
    });
  }

  if (response.meta.primaryCallToAction) {
    items.push({
      id: "meta-primaryCallToAction",
      type: "meta-primaryCallToAction",
      content: response.meta.primaryCallToAction,
      createdAt: Date.now(),
    });
  }

  if (response.meta.recommendedStartDateNote) {
    items.push({
      id: "meta-recommendedStartDateNote",
      type: "meta-recommendedStartDateNote",
      content: response.meta.recommendedStartDateNote,
      createdAt: Date.now(),
    });
  }

  if (response.meta.timezoneNote) {
    items.push({
      id: "meta-timezoneNote",
      type: "meta-timezoneNote",
      content: response.meta.timezoneNote,
      createdAt: Date.now(),
    });
  }

  // Map asset arrays
  response.assets.eventTitles.forEach((title, idx) => {
    items.push({
      id: `asset-eventTitle-${idx}`,
      type: "asset-eventTitle",
      content: title,
      index: idx,
      createdAt: Date.now(),
    });
  });

  response.assets.shortDescriptions.forEach((desc, idx) => {
    items.push({
      id: `asset-shortDescription-${idx}`,
      type: "asset-shortDescription",
      content: desc,
      index: idx,
      createdAt: Date.now(),
    });
  });

  if (response.assets.longDescription) {
    items.push({
      id: "asset-longDescription",
      type: "asset-longDescription",
      content: response.assets.longDescription,
      createdAt: Date.now(),
    });
  }

  response.assets.facebookPosts.forEach((post, idx) => {
    items.push({
      id: `asset-facebookPost-${idx}`,
      type: "asset-facebookPost",
      content: post,
      platform: "facebook",
      index: idx,
      createdAt: Date.now(),
    });
  });

  response.assets.instagramCaptions.forEach((caption, idx) => {
    items.push({
      id: `asset-instagramCaption-${idx}`,
      type: "asset-instagramCaption",
      content: caption,
      platform: "instagram",
      index: idx,
      createdAt: Date.now(),
    });
  });

  response.assets.instagramStoryIdeas.forEach((story, idx) => {
    items.push({
      id: `asset-instagramStory-${idx}`,
      type: "asset-instagramStory",
      content: story,
      platform: "instagram",
      index: idx,
      createdAt: Date.now(),
    });
  });

  response.assets.xPosts.forEach((post, idx) => {
    items.push({
      id: `asset-xPost-${idx}`,
      type: "asset-xPost",
      content: post,
      platform: "x",
      index: idx,
      createdAt: Date.now(),
    });
  });

  response.assets.googleBusinessPosts.forEach((post, idx) => {
    items.push({
      id: `asset-googleBusinessPost-${idx}`,
      type: "asset-googleBusinessPost",
      content: post,
      platform: "googleBusiness",
      index: idx,
      createdAt: Date.now(),
    });
  });

  if (response.assets.emailAnnouncement) {
    items.push({
      id: "asset-emailSubject",
      type: "asset-emailSubject",
      content: response.assets.emailAnnouncement.subject,
      platform: "email",
      createdAt: Date.now(),
    });

    items.push({
      id: "asset-emailPreviewText",
      type: "asset-emailPreviewText",
      content: response.assets.emailAnnouncement.previewText,
      platform: "email",
      createdAt: Date.now(),
    });

    items.push({
      id: "asset-emailBodyText",
      type: "asset-emailBodyText",
      content: response.assets.emailAnnouncement.bodyText,
      platform: "email",
      createdAt: Date.now(),
    });

    if (response.assets.emailAnnouncement.bodyHtml) {
      items.push({
        id: "asset-emailBodyHtml",
        type: "asset-emailBodyHtml",
        content: response.assets.emailAnnouncement.bodyHtml,
        platform: "email",
        createdAt: Date.now(),
      });
    }
  }

  if (response.assets.smsBlasts) {
    response.assets.smsBlasts.forEach((sms, idx) => {
      items.push({
        id: `asset-smsBlast-${idx}`,
        type: "asset-smsBlast",
        content: sms,
        platform: "sms",
        index: idx,
        createdAt: Date.now(),
      });
    });
  }

  if (response.assets.imageCaption) {
    items.push({
      id: "asset-imageCaption",
      type: "asset-imageCaption",
      content: response.assets.imageCaption,
      createdAt: Date.now(),
    });
  }

  // Map hashtag bundles (store as JSON string in content, with metadata)
  response.assets.hashtagBundles.forEach((bundle, idx) => {
    items.push({
      id: `asset-hashtagBundle-${idx}`,
      type: "asset-hashtagBundle",
      content: bundle.tags.join(" "),
      platform: bundle.platform.toLowerCase(),
      index: idx,
      metadata: { tags: bundle.tags, platform: bundle.platform },
      createdAt: Date.now(),
    });
  });

  // Map schedule ideas
  response.assets.scheduleIdeas.forEach((idea, idx) => {
    items.push({
      id: `asset-scheduleIdea-${idx}`,
      type: "asset-scheduleIdea",
      content: idea.suggestion,
      platform: idea.channel.toLowerCase(),
      index: idx,
      metadata: {
        dayOffset: idea.dayOffset,
        label: idea.label,
        channel: idea.channel,
      },
      createdAt: Date.now(),
    });
  });

  return items;
}

