/**
 * Verification helper for Vercel Cron requests.
 * 
 * Verifies that a request is from Vercel's cron service by checking
 * for Vercel-specific headers.
 */

import { Headers } from "next/server";

/**
 * Checks if a request is likely from Vercel Cron.
 * 
 * Verification checks for:
 * - Presence of any `x-vercel-*` headers (strong indicator)
 * - User-Agent containing "vercel" (secondary indicator)
 * 
 * @param headers - Request headers object
 * @returns true if request appears to be from Vercel Cron, false otherwise
 */
export function isLikelyVercelCron(headers: Headers): boolean {
  // Check for any x-vercel-* headers (strong indicator of Vercel infrastructure)
  const hasVercelHeader = Array.from(headers.keys()).some((key) =>
    key.toLowerCase().startsWith("x-vercel-")
  );

  if (hasVercelHeader) {
    return true;
  }

  // Secondary check: User-Agent containing "vercel" (case-insensitive)
  const userAgent = headers.get("user-agent")?.toLowerCase() || "";
  if (userAgent.includes("vercel")) {
    return true;
  }

  // Not a Vercel Cron request
  return false;
}

