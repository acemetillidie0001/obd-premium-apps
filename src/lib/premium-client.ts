/**
 * Client-safe premium utilities
 * 
 * This file can be imported in client components.
 * Server-only functions are in premium.ts
 * 
 * IMPORTANT: Environment variables are not available in client components
 * unless prefixed with NEXT_PUBLIC_. This function checks NEXT_PUBLIC_META_REVIEW_MODE.
 */

/**
 * Check if Meta review mode is enabled (client-safe version)
 * 
 * In client components, only NEXT_PUBLIC_ prefixed env vars are available.
 * For server-side usage, use isMetaReviewMode() from premium.ts instead.
 * 
 * Note: You may need to add NEXT_PUBLIC_META_REVIEW_MODE to your .env file
 * if you want this to work in client components.
 */
export function isMetaReviewMode(): boolean {
  // In client components, only NEXT_PUBLIC_ env vars are available at build time
  // This will be replaced at build time with the actual value (or undefined)
  return process.env.NEXT_PUBLIC_META_REVIEW_MODE === "true";
}

