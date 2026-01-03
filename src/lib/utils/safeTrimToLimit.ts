/**
 * Safe Trim to Limit Utility
 * 
 * Deterministic text trimming that respects sentence and word boundaries,
 * removes trailing artifacts, and ensures clean output.
 */

/**
 * Safely trims text to a maximum character limit while preserving readability.
 * 
 * Rules:
 * - Return text unchanged if <= maxChars
 * - Prefer trimming at sentence boundary (within last 60 chars)
 * - Otherwise trim at word boundary
 * - Never cut mid-word
 * - Collapse extra whitespace
 * - Remove trailing artifacts (dangling commas, double spaces, trailing punctuation weirdness)
 * - Ensure result length <= maxChars
 * 
 * @param text - The text to trim
 * @param maxChars - Maximum character limit
 * @returns Trimmed text that is <= maxChars
 */
export function safeTrimToLimit(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) {
    return text;
  }

  // Step 1: Try to find sentence boundary within last 60 chars
  const searchWindow = Math.min(60, maxChars);
  const beforeMax = text.substring(0, maxChars);
  const searchStart = Math.max(0, maxChars - searchWindow);
  const searchText = text.substring(searchStart, maxChars);
  
  // Find last sentence boundary in the search window
  const lastPeriod = searchText.lastIndexOf(".");
  const lastExclamation = searchText.lastIndexOf("!");
  const lastQuestion = searchText.lastIndexOf("?");
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  let trimmed: string;
  
  if (lastSentenceEnd >= 0) {
    // Found a sentence boundary - cut there
    const cutPoint = searchStart + lastSentenceEnd + 1;
    trimmed = text.substring(0, cutPoint).trim();
  } else {
    // No sentence boundary found - try word boundary
    const lastSpace = beforeMax.lastIndexOf(" ");
    
    if (lastSpace > maxChars * 0.5) {
      // Found a word boundary reasonably close to max
      trimmed = text.substring(0, lastSpace).trim();
    } else {
      // Fallback: hard truncate at maxChars (but we'll clean it up)
      trimmed = text.substring(0, maxChars).trim();
      
      // Try to find a word boundary in the last 20 chars
      const lastSpaceInTrimmed = trimmed.lastIndexOf(" ");
      if (lastSpaceInTrimmed > trimmed.length - 20) {
        trimmed = trimmed.substring(0, lastSpaceInTrimmed).trim();
      }
    }
  }
  
  // Step 2: Collapse extra whitespace
  trimmed = trimmed.replace(/\s+/g, " ");
  
  // Step 3: Remove trailing artifacts
  // Remove dangling commas, periods, or other punctuation at the end
  trimmed = trimmed.replace(/[,;:]+$/, "");
  
  // Remove trailing spaces before punctuation
  trimmed = trimmed.replace(/\s+([.!?])/g, "$1");
  
  // Remove double spaces (shouldn't happen after collapse, but just in case)
  trimmed = trimmed.replace(/\s{2,}/g, " ");
  
  // Remove trailing whitespace
  trimmed = trimmed.trim();
  
  // Step 4: Ensure we didn't exceed maxChars (shouldn't happen, but safety check)
  if (trimmed.length > maxChars) {
    // Last resort: hard truncate and clean
    trimmed = trimmed.substring(0, maxChars).trim();
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > maxChars * 0.8) {
      trimmed = trimmed.substring(0, lastSpace).trim();
    }
  }
  
  return trimmed;
}

