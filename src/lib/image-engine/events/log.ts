/**
 * OBD Brand-Safe Image Generator - Event Logging Wrapper
 * 
 * Standardized wrapper for logging engine events with safety guarantees.
 */

import { logImageEvent } from "@/lib/image-engine/db";
import type { EngineEventInput } from "./types";

/**
 * Maximum length for messageSafe field.
 */
const MAX_MESSAGE_LENGTH = 240;

/**
 * Fields that must be stripped from data before saving (defensive safety).
 */
const FORBIDDEN_DATA_FIELDS = ["prompt", "negativePrompt", "promptText", "userPrompt"];

/**
 * Sanitizes data object by removing forbidden fields.
 * 
 * @param data - Data object to sanitize
 * @returns Sanitized data object
 */
function sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | null {
  if (!data) {
    return null;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip forbidden fields (case-insensitive check)
    const keyLower = key.toLowerCase();
    if (FORBIDDEN_DATA_FIELDS.some((forbidden) => keyLower.includes(forbidden.toLowerCase()))) {
      continue; // Skip this field
    }

    // Recursively sanitize nested objects
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const nestedSanitized = sanitizeData(value as Record<string, unknown>);
      if (nestedSanitized) {
        sanitized[key] = nestedSanitized;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Truncates message to maximum length if needed.
 * 
 * @param message - Message to truncate
 * @returns Truncated message
 */
function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message;
  }
  return message.substring(0, MAX_MESSAGE_LENGTH - 3) + "...";
}

/**
 * Logs an engine event with standardized types and safety guarantees.
 * 
 * Ensures:
 * - messageSafe is truncated to max length
 * - prompt/negativePrompt fields are stripped from data
 * - All events use consistent taxonomy
 * 
 * @param input - Event input with standardized type
 * @returns The created ImageEvent record
 */
export async function logEngineEvent(input: EngineEventInput) {
  const { requestId, type, ok, messageSafe, data } = input;

  // Truncate message if needed
  const truncatedMessage = truncateMessage(messageSafe);

  // Sanitize data (remove prompt fields)
  const sanitizedData = sanitizeData(data);

  // Call underlying logImageEvent
  return await logImageEvent(
    requestId,
    type,
    ok,
    truncatedMessage,
    sanitizedData
  );
}

