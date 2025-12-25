/**
 * OBD Brand-Safe Image Generator - Safety Rules Types
 * 
 * Types for the brand-safety rules evaluation engine.
 */

export type SafetyVerdict = "allow" | "block" | "fallback";

export interface SafetyInput {
  platform: string;
  category: string;
  aspect: string;
  mode: string;
  negativeRules?: string[];
  businessName?: string;
  userText?: string;
  flags?: Record<string, boolean>;
}

export interface SafetyResult {
  verdict: SafetyVerdict;
  reasonSafe: string;
  tags?: string[];
}

