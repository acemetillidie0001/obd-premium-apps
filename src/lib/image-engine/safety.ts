/**
 * OBD Brand-Safe Image Generator - Safety Evaluation
 * 
 * Implements brand safety rules to prevent unsafe image generation requests.
 */

import type { ImageEngineRequest, SafetyEvaluation } from "./types";

// ============================================
// Disallowed Patterns
// ============================================

/**
 * Patterns that indicate unsafe content when found in intentSummary.
 * All checks are case-insensitive.
 */
const DISALLOWED_PATTERNS = {
  faces: [
    /our\s+team/i,
    /my\s+staff/i,
    /owner\s+portrait/i,
    /employee\s+headshot/i,
    /staff\s+member/i,
    /team\s+member/i,
    /our\s+employees/i,
    /our\s+people/i,
  ],
  fakeLocations: [
    /our\s+storefront/i,
    /our\s+building/i,
    /front\s+of\s+our\s+shop/i,
    /our\s+location/i,
    /our\s+facility/i,
    /our\s+office/i,
    /our\s+store/i,
  ],
  medicalLegal: [
    /cure/i,
    /guarantee/i,
    /diagnose/i,
    /lawsuit/i,
    /legal\s+claim/i,
    /medical\s+claim/i,
    /guaranteed\s+result/i,
    /promise\s+to\s+cure/i,
  ],
  beforeAfter: [
    /before\s+and\s+after/i,
    /before\/after/i,
    /before\s+after/i,
    /transformation/i,
    /results\s+before/i,
  ],
  fakeReviews: [
    /5[\s-]?star\s+review/i,
    /john\s+says/i,
    /rated\s+#1/i,
    /customer\s+testimonial/i,
    /fake\s+review/i,
    /testimonial\s+from/i,
    /review\s+from\s+customer/i,
  ],
  logosNames: [
    /include\s+logo/i,
    /add\s+our\s+name/i,
    /business\s+name\s+in\s+image/i,
    /logo\s+in\s+image/i,
    /brand\s+name\s+visible/i,
    /burn\s+logo/i,
    /embed\s+logo/i,
  ],
} as const;

/**
 * Additional patterns for social_proof category (stricter rules).
 */
const SOCIAL_PROOF_DISALLOWED_PATTERNS = [
  /review/i,
  /testimonial/i,
  /customer\s+quote/i,
  /client\s+quote/i,
  /rating/i,
  /star/i,
  /5\s+star/i,
  /recommendation/i,
  /endorsement/i,
  /people\s+saying/i,
  /customers\s+saying/i,
];

// ============================================
// Safety Evaluation
// ============================================

/**
 * Evaluates safety of an image generation request.
 * Returns isAllowed=false if any disallowed patterns are found.
 */
export function evaluateSafety(request: ImageEngineRequest): SafetyEvaluation {
  const reasons: string[] = [];
  const intentSummary = request.intentSummary.toLowerCase();

  // Check for faces implying staff/owners
  for (const pattern of DISALLOWED_PATTERNS.faces) {
    if (pattern.test(intentSummary)) {
      reasons.push("Contains language implying staff/owner faces (not allowed)");
      return { isAllowed: false, reasons };
    }
  }

  // Check for fake locations/storefronts
  for (const pattern of DISALLOWED_PATTERNS.fakeLocations) {
    if (pattern.test(intentSummary)) {
      reasons.push("Contains language implying fake storefronts/locations (not allowed)");
      return { isAllowed: false, reasons };
    }
  }

  // Check for medical/legal claims
  for (const pattern of DISALLOWED_PATTERNS.medicalLegal) {
    if (pattern.test(intentSummary)) {
      reasons.push("Contains medical/legal claims (not allowed)");
      return { isAllowed: false, reasons };
    }
  }

  // Check for before/after transformations
  for (const pattern of DISALLOWED_PATTERNS.beforeAfter) {
    if (pattern.test(intentSummary)) {
      reasons.push("Contains before/after transformation language (not allowed)");
      return { isAllowed: false, reasons };
    }
  }

  // Check for fake reviews/testimonials
  for (const pattern of DISALLOWED_PATTERNS.fakeReviews) {
    if (pattern.test(intentSummary)) {
      reasons.push("Contains fake review/testimonial language (not allowed)");
      return { isAllowed: false, reasons };
    }
  }

  // Check for logos or business names
  for (const pattern of DISALLOWED_PATTERNS.logosNames) {
    if (pattern.test(intentSummary)) {
      reasons.push("Contains request to include logos/business names (not allowed)");
      return { isAllowed: false, reasons };
    }
  }

  // Additional strict checks for social_proof category
  if (request.category === "social_proof") {
    for (const pattern of SOCIAL_PROOF_DISALLOWED_PATTERNS) {
      if (pattern.test(intentSummary)) {
        reasons.push(
          "Social proof category forbids any language implying real reviews/people (must be abstract trust/quality visuals only)"
        );
        return { isAllowed: false, reasons };
      }
    }
  }

  return { isAllowed: true, reasons: [] };
}

