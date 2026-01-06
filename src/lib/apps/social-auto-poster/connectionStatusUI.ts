/**
 * Connection Status UI Helper (Legacy/Backwards Compatibility)
 * 
 * This file is a thin re-export wrapper for backwards compatibility.
 * All new code should import directly from ./connection/connectionState.ts
 * 
 * @deprecated Use ./connection/connectionState.ts instead
 */

// Re-export all types and functions from the canonical implementation
export type { ConnectionUIState, ConnectionUIModel } from "./connection/connectionState";
export { getConnectionUIModel } from "./connection/connectionState";

// Import for type alias and functions
import type { ConnectionUIModel } from "./connection/connectionState";
import { getConnectionUIModel } from "./connection/connectionState";
import { isMetaPublishingEnabled } from "./metaConnectionStatus";

// Legacy type aliases for backwards compatibility (if needed)
export type ConnectionStatusUI = ConnectionUIModel;

/**
 * Legacy function name - maps to getConnectionUIModel
 * 
 * @deprecated Use getConnectionUIModel instead
 * 
 * Note: The old implementation ignored googleStatus, so this wrapper does too.
 * All logic now uses the centralized getConnectionUIModel from connection/connectionState.ts
 */
export function getConnectionStatusUI(
  metaStatus: Parameters<typeof getConnectionUIModel>[0],
  googleStatus?: unknown // Legacy parameter, not used in new implementation
): ConnectionUIModel {
  // Map legacy call to new function
  // Note: googleStatus is ignored as it wasn't used in the old implementation logic
  const publishingEnabled = isMetaPublishingEnabled();
  return getConnectionUIModel(metaStatus, undefined, publishingEnabled);
}
