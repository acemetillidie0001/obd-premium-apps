/**
 * Dismiss Keys for Tier 5B First-run Callouts
 * 
 * SessionStorage keys for dismissible callouts.
 * All keys are namespaced with tier5b-social-auto-poster-
 */

export const DISMISS_KEYS = {
  setupConnectionStates: "tier5b-social-auto-poster-setup-connection-states",
  queueBlockedStatus: "tier5b-social-auto-poster-queue-blocked-status",
  composerWorkflow: "tier5b-social-auto-poster-composer-workflow",
  importBanner: "tier5c-social-auto-poster-import-banner",
} as const;

/**
 * Check if a callout has been dismissed in this session
 */
export function isDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(key) === "true";
}

/**
 * Mark a callout as dismissed for this session
 */
export function dismiss(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, "true");
}

