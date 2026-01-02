/**
 * OBD Scheduler & Booking - Calendar Token Encryption
 * 
 * AES-256-GCM encryption for storing calendar OAuth tokens at rest.
 * Uses CALENDAR_TOKEN_ENCRYPTION_KEY from environment variables.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits for GCM tag
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY environment variable is not set");
  }

  // Support both base64 and hex encoding
  let key: Buffer;
  try {
    // Try base64 first
    key = Buffer.from(keyEnv, "base64");
  } catch {
    try {
      // Fall back to hex
      key = Buffer.from(keyEnv, "hex");
    } catch {
      throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must be base64 or hex encoded");
    }
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`CALENDAR_TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (got ${key.length})`);
  }

  return key;
}

/**
 * Encrypt text using AES-256-GCM
 * Returns base64-encoded string: IV (12 bytes) + encrypted data + auth tag (16 bytes)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from("obd-scheduler-calendar", "utf8")); // Additional authenticated data
  
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const tag = cipher.getAuthTag();
  
  // Combine: IV + encrypted data + tag
  const combined = Buffer.concat([iv, encrypted, tag]);
  
  return combined.toString("base64");
}

/**
 * Decrypt base64-encoded payload
 * Expects format: IV (12 bytes) + encrypted data + auth tag (16 bytes)
 */
export function decrypt(payload: string): string {
  const key = getEncryptionKey();
  
  const combined = Buffer.from(payload, "base64");
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from("obd-scheduler-calendar", "utf8"));
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}

