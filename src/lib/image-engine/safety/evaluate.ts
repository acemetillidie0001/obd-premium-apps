/**
 * OBD Brand-Safe Image Generator - Safety Rules Evaluation
 * 
 * Deterministic rules engine for brand-safety evaluation.
 * No external calls, no prompts stored.
 */

import type { SafetyInput, SafetyResult } from "./types";

/**
 * Disallowed words that trigger block verdict.
 * Case-insensitive matching.
 */
const DISALLOWED_WORDS = [
  "nudity",
  "nude",
  "explicit",
  "weapon",
  "gun",
  "blood",
];

/**
 * Evaluates safety rules and returns a verdict.
 * 
 * Rules (in order of evaluation):
 * A) If negativeRules includes "no_faces" AND userText mentions "portrait" or "headshot" -> block
 * B) If userText contains disallowed words -> block
 * C) If category="review" AND userText contains "before and after" -> fallback
 * D) Default allow
 * 
 * @param input - Safety evaluation input
 * @returns Safety evaluation result
 */
export function evaluateSafety(input: SafetyInput): SafetyResult {
  const { negativeRules = [], userText = "", category } = input;

  // Normalize userText to lowercase for matching
  const normalizedText = userText.toLowerCase();

  // Rule A: Check for no_faces + portrait/headshot conflict
  const hasNoFacesRule = negativeRules.some(
    (rule) => rule.toLowerCase().includes("no_faces") || rule.toLowerCase().includes("no faces")
  );
  
  if (hasNoFacesRule) {
    const mentionsPortrait = normalizedText.includes("portrait");
    const mentionsHeadshot = normalizedText.includes("headshot");
    
    if (mentionsPortrait || mentionsHeadshot) {
      return {
        verdict: "block",
        reasonSafe: "Request conflicts with no_faces rule: mentions portrait or headshot",
        tags: ["no_faces_conflict", "portrait_or_headshot"],
      };
    }
  }

  // Rule B: Check for disallowed words
  for (const word of DISALLOWED_WORDS) {
    if (normalizedText.includes(word)) {
      return {
        verdict: "block",
        reasonSafe: `Request contains disallowed word: ${word}`,
        tags: ["disallowed_word", word],
      };
    }
  }

  // Rule C: Check for before/after in review category
  // Note: Using "social_proof" as the review-like category since "review" isn't in the enum
  // Also checking for any category that might be review-related
  const isReviewCategory = category === "social_proof" || category.toLowerCase().includes("review");
  const mentionsBeforeAfter = 
    normalizedText.includes("before and after") ||
    normalizedText.includes("before/after") ||
    normalizedText.includes("before-after");

  if (isReviewCategory && mentionsBeforeAfter) {
    return {
      verdict: "fallback",
      reasonSafe: "Review category with before/after language may be deceptive - using fallback",
      tags: ["before_after", "review_category", "deceptive_ad"],
    };
  }

  // Rule D: Default allow
  return {
    verdict: "allow",
    reasonSafe: "Request passed all safety checks",
    tags: ["safe"],
  };
}

