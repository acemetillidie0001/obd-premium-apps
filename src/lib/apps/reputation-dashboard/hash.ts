/**
 * Hash Utility for Reputation Dashboard
 * 
 * Implements FNV-1a 32-bit hash algorithm for deterministic snapshot ID generation.
 * No external dependencies - pure TypeScript implementation.
 */

/**
 * FNV-1a 32-bit hash constants
 */
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * Compute FNV-1a 32-bit hash of a string
 */
function fnv1a32(str: string): number {
  let hash = FNV_OFFSET_BASIS;
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * FNV_PRIME) >>> 0; // Use unsigned right shift to keep as 32-bit
  }
  
  return hash >>> 0; // Ensure unsigned 32-bit
}

/**
 * Normalize a review for stable hashing
 * Sorts by date, then platform, then rating to ensure consistent ordering
 */
function normalizeReviewForHash(review: {
  platform: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  responded: boolean;
  responseDate?: string;
}): string {
  // Create a stable string representation
  return [
    review.reviewDate,
    review.platform,
    review.rating.toString(),
    review.reviewText.substring(0, 100), // First 100 chars for stability
    review.responded ? "1" : "0",
    review.responseDate || "",
  ].join("|");
}

/**
 * Generate deterministic snapshot ID from dashboard inputs
 * 
 * @param businessName - Business name
 * @param businessType - Optional business type
 * @param dateRange - Date range configuration (mode + resolved dates)
 * @param reviews - Array of reviews (will be normalized and sorted)
 * @returns Snapshot ID in format "RD-XXXXXXXX" where XXXXXXXX is 8 uppercase hex chars
 */
export function generateSnapshotId(
  businessName: string,
  businessType: string | undefined,
  dateRange: {
    mode: string;
    startDate?: string;
    endDate?: string;
  },
  reviews: Array<{
    platform: string;
    rating: number;
    reviewText: string;
    reviewDate: string;
    responded: boolean;
    responseDate?: string;
  }>
): string {
  // Normalize and sort reviews for stable hashing
  const normalizedReviews = [...reviews]
    .map(normalizeReviewForHash)
    .sort()
    .join("\n");
  
  // Resolve date range to stable string
  let dateRangeStr: string;
  if (dateRange.mode === "custom") {
    dateRangeStr = `custom:${dateRange.startDate || ""}:${dateRange.endDate || ""}`;
  } else {
    dateRangeStr = dateRange.mode;
  }
  
  // Create hash input string
  const hashInput = [
    businessName.trim().toLowerCase(),
    businessType?.trim().toLowerCase() || "",
    dateRangeStr,
    normalizedReviews,
  ].join("::");
  
  // Compute hash
  const hash = fnv1a32(hashInput);
  
  // Convert to 8 uppercase hex characters
  const hex = hash.toString(16).toUpperCase().padStart(8, "0");
  
  return `RD-${hex}`;
}

