/**
 * OBD Scheduler & Booking - Booking Key Utilities (V3)
 * 
 * Helper functions for generating and validating booking keys.
 * Booking keys are used for public booking links and must be:
 * - Unique
 * - Random
 * - Not easily guessable
 */

import { randomBytes } from "crypto";

/**
 * Generate a random booking key.
 * 
 * Returns a 64-character hex string (256 bits of entropy).
 * This provides sufficient security for public booking links.
 * 
 * @returns A random 64-character hex string
 */
export function generateBookingKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Validate booking key format.
 * 
 * Checks that the key is:
 * - A non-empty string
 * - Exactly 64 characters (32 bytes in hex)
 * - Contains only hexadecimal characters (0-9, a-f)
 * 
 * @param key - The booking key to validate
 * @returns true if valid, false otherwise
 */
export function validateBookingKeyFormat(key: string | null | undefined): boolean {
  if (!key || typeof key !== "string") {
    return false;
  }

  // Must be exactly 64 characters (32 bytes in hex)
  if (key.length !== 64) {
    return false;
  }

  // Must contain only hexadecimal characters
  const hexRegex = /^[0-9a-f]+$/i;
  return hexRegex.test(key);
}

