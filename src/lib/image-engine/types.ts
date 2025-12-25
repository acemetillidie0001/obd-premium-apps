/**
 * OBD Brand-Safe Image Generator - Type Definitions
 * 
 * Strict TypeScript types for the Image Engine (Phase 1: Contract + Decision Logic, Phase 2A: Generation)
 */

// ============================================
// Core Enums
// ============================================

export type ImagePlatform = "instagram" | "facebook" | "x" | "google_business_profile" | "blog";

export type ImageAspect = "1:1" | "4:5" | "16:9" | "4:3";

export type ImageCategory = "educational" | "promotion" | "social_proof" | "local_abstract" | "evergreen";

export type ImageEnergy = "low" | "medium" | "high";

export type TextAllowance = "none" | "minimal" | "headline_only";

export type DecisionMode = "generate" | "fallback";

export type ImageProviderId = "nano_banana" | "openai" | "other";

export type ConsumerApp = 
  | "social_auto_poster" 
  | "offers_promotions" 
  | "event_campaign" 
  | "review_responder" 
  | "brand_kit_builder" 
  | "seo_audit_roadmap" 
  | "other";

// ============================================
// Brand Influence Types
// ============================================

export interface BrandKitInfluence {
  primaryColorHex?: string;
  secondaryColorHex?: string;
  accentColorHex?: string;
  styleTone?: "modern" | "luxury" | "friendly" | "bold" | "clean";
  industry?: string;
}

// ============================================
// Request Types
// ============================================

export interface ImageEngineRequest {
  requestId: string; // required, from consumer app
  consumerApp: ConsumerApp;
  platform: ImagePlatform;
  category: ImageCategory;
  intentSummary: string; // short description of what the image should communicate
  brand?: BrandKitInfluence; // optional brand influence
  locale?: {
    city?: string;
    region?: string;
  }; // ex: Ocala, FL (used ONLY as abstract context)
  allowTextOverlay?: boolean; // default false; even if true, obey category rules
  safeMode?: "strict"; // default "strict"
}

// ============================================
// Decision Output Types
// ============================================

export interface ImageEngineDecision {
  requestId: string;
  mode: DecisionMode;
  platform: ImagePlatform;
  aspect: ImageAspect;
  category: ImageCategory;
  energy: ImageEnergy;
  text: {
    allowance: TextAllowance;
    recommendedOverlayText?: string | null;
  };
  safety: {
    isAllowed: boolean;
    reasons: string[];
    usedFallback: boolean;
  };
  promptPlan: {
    templateId: string;
    negativeRules: string[];
    variables: Record<string, string>;
  };
  providerPlan: {
    providerId: ImageProviderId;
    modelTier: "flash" | "pro";
    notes?: string;
  };
}

// ============================================
// Safety Evaluation Types
// ============================================

export interface SafetyEvaluation {
  isAllowed: boolean;
  reasons: string[];
}

// ============================================
// Generation Result Types (Phase 2A)
// ============================================

export interface ImageGenerationResult {
  requestId: string;
  ok: boolean;
  decision: ImageEngineDecision;
  image?: {
    url: string; // public URL or signed URL
    width: number;
    height: number;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    altText: string;
  };
  fallback?: {
    used: boolean;
    reason: string;
    placeholderUrl?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  timingsMs: {
    decision: number;
    provider?: number;
    storage?: number;
    total: number;
  };
}

// ============================================
// Provider Interface (Phase 2A)
// ============================================

export interface ImageProvider {
  id: ImageProviderId;
  generate(args: {
    decision: ImageEngineDecision;
    prompt: string; // assembled internally
    width: number;
    height: number;
    contentType: "image/png" | "image/jpeg" | "image/webp";
  }): Promise<{
    bytes: Uint8Array;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    width: number;
    height: number;
  }>;
}

// ============================================
// Storage Interface (Phase 2A)
// ============================================

export interface ImageStorage {
  put(args: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ url: string }>;
}

