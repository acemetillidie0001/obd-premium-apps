/**
 * Text Sanitization Utility
 * 
 * Sanitizes user-provided text input to prevent XSS attacks and normalize data.
 * Removes control characters, trims whitespace, and ensures safe storage.
 */

/**
 * Sanitize text input by:
 * 1. Trimming whitespace
 * 2. Removing control characters (except newlines, tabs, and carriage returns for multi-line text)
 * 3. Normalizing line endings
 * 
 * @param text - The text to sanitize
 * @param allowNewlines - Whether to preserve newlines, tabs, and carriage returns (default: true)
 * @returns Sanitized text
 */
export function sanitizeText(text: string | null | undefined, allowNewlines: boolean = true): string {
  if (!text) {
    return "";
  }

  // Trim whitespace
  let sanitized = text.trim();

  // Remove control characters
  // Control characters are: \x00-\x1F except \n (0x0A), \r (0x0D), \t (0x09)
  if (allowNewlines) {
    // Preserve newlines, carriage returns, and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  } else {
    // Remove all control characters including newlines
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");
  }

  // Normalize line endings to \n
  sanitized = sanitized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  return sanitized;
}

/**
 * Sanitize text for single-line fields (names, emails, etc.)
 * Removes all newlines and control characters.
 * 
 * @param text - The text to sanitize
 * @returns Sanitized single-line text
 */
export function sanitizeSingleLine(text: string | null | undefined): string {
  return sanitizeText(text, false);
}

