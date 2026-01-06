/**
 * Handoff Builder for Event Campaign Builder
 * 
 * ARCHITECTURAL OVERVIEW:
 * 
 * This module provides integration helpers for the Event Campaign Builder app.
 * The Event Campaign Builder is a campaign orchestration planner for time-bound events.
 * It generates structured, multi-channel campaign drafts.
 * 
 * This app is NOT:
 * - A scheduler (does not schedule posts or send at specific times)
 * - A calendar (does not manage event calendars or dates)
 * - A ticketing system (does not handle ticket sales or reservations)
 * - A CRM (does not manage customer relationships or contacts)
 * - An automation engine (does not execute or trigger automated actions)
 * 
 * This app does NOT:
 * - Publish content to any platform
 * - Schedule posts or messages
 * - Send emails or SMS messages
 * - Sync with external systems
 * 
 * This app ONLY:
 * - Generates campaign content drafts (text, copy, suggestions)
 * - Provides structured campaign plans and recommendations
 * - Outputs content that users can manually review, edit, and use elsewhere
 * 
 * Builds handoff payloads for sending events to Social Auto-Poster
 */

import type { EventCampaignResponse, EventCampaignFormValues } from "@/app/apps/event-campaign-builder/types";

/**
 * Handoff payload for Social Auto-Poster import from Event Campaign Builder
 */
export interface EventCampaignHandoffPayload {
  type: "social_auto_poster_import";
  sourceApp: "event-campaign-builder";
  campaignType: "event";
  eventName: string;
  eventDate: string;
  location: string;
  description: string;
  suggestedCountdownCopy: string[];
  suggestedPlatforms: string[];
  meta: {
    sourceApp: "event-campaign-builder";
    createdAt: number;
  };
}

/**
 * Generate countdown copy suggestions based on event date
 */
function generateCountdownCopy(eventDate: string): string[] {
  const suggestions: string[] = [];
  
  try {
    const eventDateObj = new Date(eventDate);
    const now = new Date();
    const diffTime = eventDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // Event is in the past
      suggestions.push("Missed this event? Stay tuned for our next one!");
    } else if (diffDays === 0) {
      suggestions.push("Happening today!");
      suggestions.push("Don't miss out - happening now!");
    } else if (diffDays === 1) {
      suggestions.push("Happening tomorrow!");
      suggestions.push("1 day to go!");
    } else if (diffDays <= 3) {
      suggestions.push(`${diffDays} days to go!`);
      suggestions.push("This weekend!");
    } else if (diffDays <= 7) {
      suggestions.push(`${diffDays} days to go!`);
      suggestions.push("This week!");
    } else if (diffDays <= 14) {
      suggestions.push(`${diffDays} days to go!`);
      suggestions.push("Coming soon!");
    } else {
      suggestions.push(`${diffDays} days to go!`);
      suggestions.push("Mark your calendar!");
    }
  } catch {
    // Fallback if date parsing fails
    suggestions.push("This weekend!");
    suggestions.push("3 days to go");
    suggestions.push("Happening tomorrow");
  }
  
  return suggestions;
}

/**
 * Build handoff payload for Social Auto-Poster from Event Campaign Builder result
 * 
 * @param result - Event Campaign Builder response
 * @param form - Original form data
 * @returns Handoff payload ready for encoding
 */
export function buildSocialAutoPosterHandoff(
  result: EventCampaignResponse,
  form: EventCampaignFormValues
): EventCampaignHandoffPayload {
  // Use event name from form
  const eventName = form.eventName.trim() || "Upcoming Event";
  
  // Use event date from form
  const eventDate = form.eventDate.trim() || "";
  
  // Use event location from form
  const location = form.eventLocation.trim() || "";
  
  // Use long description or first short description
  const description = result.assets.longDescription || 
                     result.assets.shortDescriptions?.[0] || 
                     form.eventDescription.trim() || 
                     "";

  // Generate countdown copy suggestions
  const suggestedCountdownCopy = generateCountdownCopy(eventDate);

  // Extract platforms from form toggles
  const suggestedPlatforms: string[] = [];
  if (form.includeFacebook) suggestedPlatforms.push("facebook");
  if (form.includeInstagram) suggestedPlatforms.push("instagram");
  if (form.includeX) suggestedPlatforms.push("x");
  if (form.includeGoogleBusiness) suggestedPlatforms.push("googleBusiness");
  
  // Default to Facebook and Instagram if none selected
  if (suggestedPlatforms.length === 0) {
    suggestedPlatforms.push("facebook", "instagram");
  }

  return {
    type: "social_auto_poster_import",
    sourceApp: "event-campaign-builder",
    campaignType: "event",
    eventName: eventName,
    eventDate: eventDate,
    location: location,
    description: description.trim(),
    suggestedCountdownCopy: suggestedCountdownCopy,
    suggestedPlatforms: suggestedPlatforms,
    meta: {
      sourceApp: "event-campaign-builder",
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
export function encodeHandoffPayload(payload: EventCampaignHandoffPayload): string {
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

