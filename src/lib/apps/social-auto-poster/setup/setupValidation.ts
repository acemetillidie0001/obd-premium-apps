/**
 * Setup Validation Helper (Tier 5B)
 * 
 * Validates setup completion state for guided setup UX.
 */

import type { SocialAutoposterSettings } from "../types";
import type { ConnectionUIModel } from "../connection/connectionState";

export interface SetupCompletion {
  postingMode: boolean;
  platforms: boolean;
  schedule: boolean;
  requiredCompleteCount: number;
  requiredTotal: number;
}

/**
 * Get setup completion state
 * 
 * @param settings - Current settings (partial is acceptable)
 * @param connectionUI - Connection UI model for context
 * @returns SetupCompletion with completion flags and counts
 */
export function getSetupCompletion(
  settings: Partial<SocialAutoposterSettings>,
  connectionUI: ConnectionUIModel
): SetupCompletion {
  // Posting Mode: complete if a mode is selected
  const postingModeComplete = !!settings.postingMode;

  // Platforms: complete if at least one platform is selected/configured
  // If connection state prevents publishing, still evaluate based on selected platforms
  // Do NOT block the user if selection cannot be changed due to disabled UI
  const hasEnabledPlatforms = (settings.enabledPlatforms?.length ?? 0) > 0;
  const hasPlatformsEnabled = settings.platformsEnabled
    ? Object.values(settings.platformsEnabled).some((enabled) => enabled !== false)
    : false;
  const platformsComplete = hasEnabledPlatforms || hasPlatformsEnabled;

  // Schedule: complete if frequency + timezone values are valid
  const schedulingRules = settings.schedulingRules;
  const hasFrequency = !!schedulingRules?.frequency && schedulingRules.frequency.trim() !== "";
  const hasTimezone = !!schedulingRules?.timezone && schedulingRules.timezone.trim() !== "";
  const scheduleComplete = hasFrequency && hasTimezone;

  // Count required sections
  const requiredTotal = 3; // Posting Mode, Platforms, Schedule
  const requiredCompleteCount = [
    postingModeComplete,
    platformsComplete,
    scheduleComplete,
  ].filter(Boolean).length;

  return {
    postingMode: postingModeComplete,
    platforms: platformsComplete,
    schedule: scheduleComplete,
    requiredCompleteCount,
    requiredTotal,
  };
}

