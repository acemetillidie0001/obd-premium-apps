/**
 * Campaign View Model Builder
 * 
 * Converts CampaignItem[] (canonical state) into a view model structure
 * that the UI can consume without reading from the legacy `result` object.
 * 
 * This ensures all displayed content comes from canonical state.
 */

import type { CampaignItem } from "@/app/apps/event-campaign-builder/types";

export interface CampaignViewModel {
  meta: {
    primaryTagline: string;
    primaryCallToAction: string;
    recommendedStartDateNote: string;
    timezoneNote: string;
  };
  assets: {
    eventTitles: string[];
    shortDescriptions: string[];
    longDescription: string;
    facebookPosts: string[];
    instagramCaptions: string[];
    instagramStoryIdeas: string[];
    xPosts: string[];
    googleBusinessPosts: string[];
    emailAnnouncement?: {
      subject: string;
      previewText: string;
      bodyText: string;
      bodyHtml?: string;
    };
    smsBlasts?: string[];
    imageCaption?: string;
    hashtagBundles: Array<{
      platform: string;
      tags: string[];
    }>;
    scheduleIdeas: Array<{
      dayOffset: number;
      label: string;
      channel: string;
      suggestion: string;
    }>;
  };
}

/**
 * Build a view model from CampaignItem[] array
 * 
 * Converts the canonical campaign state into the structure expected by the UI.
 * This is the single source of truth for all displayed content.
 * 
 * @param items - Array of CampaignItem objects (from getActiveCampaign)
 * @returns CampaignViewModel structure for UI consumption
 */
export function buildCampaignViewModel(items: CampaignItem[]): CampaignViewModel {
  const viewModel: CampaignViewModel = {
    meta: {
      primaryTagline: "",
      primaryCallToAction: "",
      recommendedStartDateNote: "",
      timezoneNote: "",
    },
    assets: {
      eventTitles: [],
      shortDescriptions: [],
      longDescription: "",
      facebookPosts: [],
      instagramCaptions: [],
      instagramStoryIdeas: [],
      xPosts: [],
      googleBusinessPosts: [],
      hashtagBundles: [],
      scheduleIdeas: [],
    },
  };

  // Process each item and populate the view model
  items.forEach((item) => {
    switch (item.type) {
      case "meta-primaryTagline":
        viewModel.meta.primaryTagline = item.content;
        break;
      case "meta-primaryCallToAction":
        viewModel.meta.primaryCallToAction = item.content;
        break;
      case "meta-recommendedStartDateNote":
        viewModel.meta.recommendedStartDateNote = item.content;
        break;
      case "meta-timezoneNote":
        viewModel.meta.timezoneNote = item.content;
        break;
      case "asset-eventTitle":
        if (item.index !== undefined) {
          // Ensure array is large enough
          while (viewModel.assets.eventTitles.length <= item.index) {
            viewModel.assets.eventTitles.push("");
          }
          viewModel.assets.eventTitles[item.index] = item.content;
        }
        break;
      case "asset-shortDescription":
        if (item.index !== undefined) {
          while (viewModel.assets.shortDescriptions.length <= item.index) {
            viewModel.assets.shortDescriptions.push("");
          }
          viewModel.assets.shortDescriptions[item.index] = item.content;
        }
        break;
      case "asset-longDescription":
        viewModel.assets.longDescription = item.content;
        break;
      case "asset-facebookPost":
        if (item.index !== undefined) {
          while (viewModel.assets.facebookPosts.length <= item.index) {
            viewModel.assets.facebookPosts.push("");
          }
          viewModel.assets.facebookPosts[item.index] = item.content;
        }
        break;
      case "asset-instagramCaption":
        if (item.index !== undefined) {
          while (viewModel.assets.instagramCaptions.length <= item.index) {
            viewModel.assets.instagramCaptions.push("");
          }
          viewModel.assets.instagramCaptions[item.index] = item.content;
        }
        break;
      case "asset-instagramStory":
        if (item.index !== undefined) {
          while (viewModel.assets.instagramStoryIdeas.length <= item.index) {
            viewModel.assets.instagramStoryIdeas.push("");
          }
          viewModel.assets.instagramStoryIdeas[item.index] = item.content;
        }
        break;
      case "asset-xPost":
        if (item.index !== undefined) {
          while (viewModel.assets.xPosts.length <= item.index) {
            viewModel.assets.xPosts.push("");
          }
          viewModel.assets.xPosts[item.index] = item.content;
        }
        break;
      case "asset-googleBusinessPost":
        if (item.index !== undefined) {
          while (viewModel.assets.googleBusinessPosts.length <= item.index) {
            viewModel.assets.googleBusinessPosts.push("");
          }
          viewModel.assets.googleBusinessPosts[item.index] = item.content;
        }
        break;
      case "asset-emailSubject":
        if (!viewModel.assets.emailAnnouncement) {
          viewModel.assets.emailAnnouncement = {
            subject: "",
            previewText: "",
            bodyText: "",
          };
        }
        viewModel.assets.emailAnnouncement.subject = item.content;
        break;
      case "asset-emailPreviewText":
        if (!viewModel.assets.emailAnnouncement) {
          viewModel.assets.emailAnnouncement = {
            subject: "",
            previewText: "",
            bodyText: "",
          };
        }
        viewModel.assets.emailAnnouncement.previewText = item.content;
        break;
      case "asset-emailBodyText":
        if (!viewModel.assets.emailAnnouncement) {
          viewModel.assets.emailAnnouncement = {
            subject: "",
            previewText: "",
            bodyText: "",
          };
        }
        viewModel.assets.emailAnnouncement.bodyText = item.content;
        break;
      case "asset-emailBodyHtml":
        if (!viewModel.assets.emailAnnouncement) {
          viewModel.assets.emailAnnouncement = {
            subject: "",
            previewText: "",
            bodyText: "",
          };
        }
        viewModel.assets.emailAnnouncement.bodyHtml = item.content;
        break;
      case "asset-smsBlast":
        if (item.index !== undefined) {
          if (!viewModel.assets.smsBlasts) {
            viewModel.assets.smsBlasts = [];
          }
          while (viewModel.assets.smsBlasts.length <= item.index) {
            viewModel.assets.smsBlasts.push("");
          }
          viewModel.assets.smsBlasts[item.index] = item.content;
        }
        break;
      case "asset-imageCaption":
        viewModel.assets.imageCaption = item.content;
        break;
      case "asset-hashtagBundle":
        if (item.index !== undefined && item.metadata) {
          const bundle = item.metadata as { tags: string[]; platform: string };
          while (viewModel.assets.hashtagBundles.length <= item.index) {
            viewModel.assets.hashtagBundles.push({ platform: "", tags: [] });
          }
          viewModel.assets.hashtagBundles[item.index] = {
            platform: bundle.platform || "",
            tags: bundle.tags || [],
          };
        }
        break;
      case "asset-scheduleIdea":
        if (item.index !== undefined && item.metadata) {
          const idea = item.metadata as {
            dayOffset: number;
            label: string;
            channel: string;
          };
          while (viewModel.assets.scheduleIdeas.length <= item.index) {
            viewModel.assets.scheduleIdeas.push({
              dayOffset: 0,
              label: "",
              channel: "",
              suggestion: "",
            });
          }
          viewModel.assets.scheduleIdeas[item.index] = {
            dayOffset: idea.dayOffset || 0,
            label: idea.label || "",
            channel: idea.channel || "",
            suggestion: item.content,
          };
        }
        break;
    }
  });

  // Clean up empty array entries (remove trailing empty strings)
  const cleanArray = (arr: string[]) => {
    const result: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] || i < arr.length - 1) {
        result.push(arr[i]);
      }
    }
    return result.filter((s) => s.trim().length > 0);
  };

  viewModel.assets.eventTitles = cleanArray(viewModel.assets.eventTitles);
  viewModel.assets.shortDescriptions = cleanArray(viewModel.assets.shortDescriptions);
  viewModel.assets.facebookPosts = cleanArray(viewModel.assets.facebookPosts);
  viewModel.assets.instagramCaptions = cleanArray(viewModel.assets.instagramCaptions);
  viewModel.assets.instagramStoryIdeas = cleanArray(viewModel.assets.instagramStoryIdeas);
  viewModel.assets.xPosts = cleanArray(viewModel.assets.xPosts);
  viewModel.assets.googleBusinessPosts = cleanArray(viewModel.assets.googleBusinessPosts);
  if (viewModel.assets.smsBlasts) {
    viewModel.assets.smsBlasts = cleanArray(viewModel.assets.smsBlasts);
  }

  return viewModel;
}

