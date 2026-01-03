/**
 * Feature flags for OBD Premium Apps
 * 
 * These flags control the rollout of new features and UI versions.
 * All flags default to false for safe deployments.
 * 
 * V4 Upgrade Flags:
 * - bdwV4: AI Business Description Writer V4 UI (additive-only, no API changes)
 */
export const flags = {
  bdwV4: true,
} as const;

