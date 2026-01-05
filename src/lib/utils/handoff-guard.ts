/**
 * Handoff Guard Utility
 * 
 * Prevents accidental double-imports of handoff payloads by tracking
 * imported payload hashes in sessionStorage.
 */

/**
 * Simple DJB2-style hash function that returns a base36 string.
 * This provides a short, deterministic hash for payload identification.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to base36 (0-9, a-z) and ensure positive
  const positiveHash = Math.abs(hash);
  return positiveHash.toString(36);
}

/**
 * Generate a stable hash for a handoff payload.
 * 
 * @param payload - The handoff payload (string or object)
 * @returns A short base36 hash string
 */
export function getHandoffHash(payload: unknown): string {
  let payloadString: string;
  
  if (typeof payload === "string") {
    // If already a string, use it directly
    payloadString = payload;
  } else {
    // Stringify with stable ordering (JSON.stringify is deterministic for same structure)
    payloadString = JSON.stringify(payload);
  }
  
  return hashString(payloadString);
}

/**
 * Check if a handoff payload hash was already imported for a given app.
 * 
 * @param appKey - The application key (e.g., "content-writer", "business-schema-generator")
 * @param hash - The payload hash to check
 * @returns true if the hash was already imported, false otherwise
 */
export function wasHandoffAlreadyImported(appKey: string, hash: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  
  try {
    const storageKey = `obd_handoff_imported:${appKey}`;
    const stored = sessionStorage.getItem(storageKey);
    
    if (!stored) {
      return false;
    }
    
    const hashes: string[] = JSON.parse(stored);
    return Array.isArray(hashes) && hashes.includes(hash);
  } catch (error) {
    // Fail safely: if sessionStorage is unavailable or corrupted, return false
    console.warn("Failed to check handoff import status:", error);
    return false;
  }
}

/**
 * Mark a handoff payload hash as imported for a given app.
 * Stores the hash in sessionStorage, maintaining a maximum of 25 entries.
 * 
 * @param appKey - The application key (e.g., "content-writer", "business-schema-generator")
 * @param hash - The payload hash to mark as imported
 */
export function markHandoffImported(appKey: string, hash: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const storageKey = `obd_handoff_imported:${appKey}`;
    const stored = sessionStorage.getItem(storageKey);
    
    let hashes: string[] = [];
    if (stored) {
      try {
        hashes = JSON.parse(stored);
        if (!Array.isArray(hashes)) {
          hashes = [];
        }
      } catch {
        // If corrupted, start fresh
        hashes = [];
      }
    }
    
    // Remove the hash if it already exists (to avoid duplicates)
    hashes = hashes.filter((h) => h !== hash);
    
    // Add the new hash at the end
    hashes.push(hash);
    
    // Cap at 25 entries, dropping the oldest
    if (hashes.length > 25) {
      hashes = hashes.slice(-25);
    }
    
    sessionStorage.setItem(storageKey, JSON.stringify(hashes));
  } catch (error) {
    // Fail safely: if sessionStorage is unavailable, silently continue
    console.warn("Failed to mark handoff as imported:", error);
  }
}

/**
 * Check if a localStorage handoff ID was already consumed.
 * Unit-safe guard to prevent re-reading localStorage fallback on refresh.
 * 
 * @param handoffId - The handoff ID from query parameter
 * @returns true if the handoffId was already consumed, false otherwise
 */
export function wasLocalStorageHandoffConsumed(handoffId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  
  try {
    const storageKey = `obd_handoff_consumed:${handoffId}`;
    const consumed = sessionStorage.getItem(storageKey);
    return consumed === "true";
  } catch (error) {
    // Fail safely: if sessionStorage is unavailable, return false
    console.warn("Failed to check localStorage handoff consumption status:", error);
    return false;
  }
}

/**
 * Mark a localStorage handoff ID as consumed.
 * Unit-safe guard to prevent re-reading localStorage fallback on refresh.
 * 
 * @param handoffId - The handoff ID from query parameter
 */
export function markLocalStorageHandoffConsumed(handoffId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const storageKey = `obd_handoff_consumed:${handoffId}`;
    sessionStorage.setItem(storageKey, "true");
  } catch (error) {
    // Fail safely: if sessionStorage is unavailable, silently continue
    console.warn("Failed to mark localStorage handoff as consumed:", error);
  }
}

