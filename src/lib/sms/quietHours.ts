/**
 * SMS Quiet Hours Helper (Tier 5.4A)
 * 
 * Prevents SMS sending during quiet hours (default: 9pm - 8am local server time).
 */

export interface QuietHoursConfig {
  enabled?: boolean; // Default: true
  startHour?: number; // 0-23, default: 21 (9pm)
  endHour?: number; // 0-23, default: 8 (8am)
}

/**
 * Check if SMS should be sent now (respecting quiet hours)
 * 
 * @param config Optional configuration for quiet hours
 * @returns Object with ok: true if SMS is allowed, false if within quiet hours
 */
export function shouldSendSmsNow(config?: QuietHoursConfig): { ok: boolean } {
  try {
    // Default config
    const enabled = config?.enabled ?? true;
    const startHour = config?.startHour ?? 21; // 9pm
    const endHour = config?.endHour ?? 8; // 8am

    // If quiet hours are disabled, always allow
    if (!enabled) {
      return { ok: true };
    }

    // Validate hours
    const validStartHour = Math.max(0, Math.min(23, Math.floor(startHour)));
    const validEndHour = Math.max(0, Math.min(23, Math.floor(endHour)));

    // Get current time in local server timezone
    const now = new Date();
    const currentHour = now.getHours();

    // Check if we're in quiet hours
    let isQuietHours = false;

    if (validStartHour > validEndHour) {
      // Quiet hours span midnight (e.g., 21:00 - 08:00)
      // In quiet hours if: current >= start OR current < end
      isQuietHours = currentHour >= validStartHour || currentHour < validEndHour;
    } else if (validStartHour < validEndHour) {
      // Quiet hours within same day (e.g., 10:00 - 18:00)
      isQuietHours = currentHour >= validStartHour && currentHour < validEndHour;
    } else {
      // Same hour (edge case) - treat as no quiet hours
      isQuietHours = false;
    }

    return { ok: !isQuietHours };
  } catch (error) {
    // Fail open - if quiet hours check fails, allow SMS
    console.warn("[SMS Quiet Hours] Error checking quiet hours, allowing SMS:", error);
    return { ok: true };
  }
}
