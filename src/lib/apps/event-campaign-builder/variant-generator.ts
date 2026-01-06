/**
 * Variant Generator
 * 
 * Generates countdown variant-specific content for event campaign posts.
 * Supports time-based variants: 7 days out, 3 days out, day-of.
 */

export type CountdownVariant = "7-days" | "3-days" | "day-of";

export interface VariantContent {
  variant: CountdownVariant;
  countdownText: string;
  urgencyLevel: "low" | "medium" | "high";
}

/**
 * Generate countdown text for a specific variant based on event date
 */
export function generateCountdownText(
  eventDate: string,
  variant: CountdownVariant
): string {
  try {
    const eventDateObj = new Date(eventDate);
    const now = new Date();
    const diffTime = eventDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    switch (variant) {
      case "7-days":
        if (diffDays >= 7) {
          return "Save the date!";
        } else if (diffDays >= 4) {
          return "Next week!";
        } else {
          return `${diffDays} days to go!`;
        }
      case "3-days":
        if (diffDays >= 3) {
          return `${diffDays} days to go!`;
        } else if (diffDays === 2) {
          return "2 days to go!";
        } else if (diffDays === 1) {
          return "Happening tomorrow!";
        } else {
          return "Happening soon!";
        }
      case "day-of":
        if (diffDays === 0) {
          return "Happening today!";
        } else if (diffDays === 1) {
          return "Happening tomorrow!";
        } else if (diffDays < 0) {
          return "Event in progress!";
        } else {
          return "Happening soon!";
        }
      default:
        return "Save the date!";
    }
  } catch {
    return "Save the date!";
  }
}

/**
 * Get all available variants for an event date
 */
export function getAvailableVariants(eventDate: string): CountdownVariant[] {
  try {
    const eventDateObj = new Date(eventDate);
    const now = new Date();
    const diffTime = eventDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const variants: CountdownVariant[] = [];
    
    // 7-days variant available if event is 7+ days away
    if (diffDays >= 7) {
      variants.push("7-days");
    }
    
    // 3-days variant available if event is 3+ days away
    if (diffDays >= 3) {
      variants.push("3-days");
    }
    
    // Day-of variant always available
    variants.push("day-of");

    return variants.length > 0 ? variants : ["day-of"];
  } catch {
    return ["day-of"];
  }
}

/**
 * Apply variant countdown text to post content
 * Replaces or prepends countdown text in the post
 */
export function applyVariantToContent(
  originalContent: string,
  variant: CountdownVariant,
  eventDate: string,
  eventName: string
): string {
  const countdownText = generateCountdownText(eventDate, variant);
  
  // Try to detect and replace existing countdown text
  const countdownPatterns = [
    /^(Save the date!|Next week!|Happening tomorrow!|Happening today!|\d+ days to go!|Happening soon!|Event in progress!)\s*\n?\n?/i,
  ];
  
  let modifiedContent = originalContent;
  for (const pattern of countdownPatterns) {
    if (pattern.test(modifiedContent)) {
      modifiedContent = modifiedContent.replace(pattern, `${countdownText}\n\n`);
      break;
    }
  }
  
  // If no countdown text found, prepend it
  if (!countdownPatterns.some(p => p.test(originalContent))) {
    modifiedContent = `${countdownText}\n\n${originalContent}`;
  }
  
  return modifiedContent.trim();
}

