/**
 * Canonical Campaign State Helper
 * 
 * Provides a single source of truth for determining which campaign
 * should be used for display, export, and handoff operations.
 * 
 * Pattern matches Image Caption Generator and AI Content Writer canonical state management.
 */

import type { CampaignItem } from "@/app/apps/event-campaign-builder/types";

/**
 * Get the active campaign (canonical selector)
 * 
 * Returns edited campaign if present, otherwise returns generated campaign.
 * Never returns null; returns empty array when no campaign is available.
 * 
 * @param generatedCampaign - The latest generated campaign (CampaignItem[])
 * @param editedCampaign - User-edited campaign (null if not edited)
 * @returns The active campaign array (never null)
 */
export function getActiveCampaign(
  generatedCampaign: CampaignItem[],
  editedCampaign: CampaignItem[] | null
): CampaignItem[] {
  return editedCampaign ?? generatedCampaign;
}

