/**
 * OBD Scheduler Pilot Access Control
 * 
 * Lightweight feature flag for V1 pilot rollout.
 * 
 * Environment Variables:
 * - OBD_SCHEDULER_PILOT_MODE: Set to "true" to enable pilot mode restrictions
 * - OBD_SCHEDULER_PILOT_BUSINESS_IDS: Comma-separated list of business IDs allowed in pilot
 * 
 * When pilot mode is OFF (default), all businesses have access.
 * When pilot mode is ON, only businesses in the allowlist have access.
 */

/**
 * Check if a business is allowed to access Scheduler in pilot mode
 * 
 * @param businessId - The business ID to check
 * @returns true if access is allowed, false otherwise
 */
export function isSchedulerPilotAllowed(businessId: string): boolean {
  // If pilot mode is not enabled, allow all businesses
  const pilotMode = process.env.OBD_SCHEDULER_PILOT_MODE;
  if (!pilotMode || pilotMode.toLowerCase() !== "true") {
    return true;
  }

  // If pilot mode is enabled but no allowlist, deny all (fail-safe)
  const allowlistStr = process.env.OBD_SCHEDULER_PILOT_BUSINESS_IDS;
  if (!allowlistStr || allowlistStr.trim() === "") {
    return false;
  }

  // Parse allowlist (comma-separated, trim whitespace)
  const allowlist = allowlistStr
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  // Check if businessId is in allowlist
  return allowlist.includes(businessId);
}

