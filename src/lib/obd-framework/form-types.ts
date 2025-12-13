/**
 * OBD V3 App Framework - Shared Form Types
 * 
 * Base interfaces for all app form payloads.
 * Each app can extend these interfaces with app-specific fields.
 */

/**
 * Base business information fields shared across all apps
 */
export interface BaseBusinessInfo {
  businessName?: string;
  businessType?: string;
  services?: string;
  city?: string;
  state?: string;
}

/**
 * Base brand voice and personality fields
 */
export interface BaseBrandVoice {
  brandVoice?: string;
  personalityStyle?: "None" | "Soft" | "Bold" | "High-Energy" | "Luxury" | "";
}

/**
 * Base language and length options
 */
export interface BaseContentOptions {
  language?: "English" | "Spanish" | "Bilingual" | string;
  length?: "Short" | "Medium" | "Long";
}

/**
 * Base form payload that all apps can extend
 */
export interface BaseFormPayload extends BaseBusinessInfo, BaseBrandVoice, BaseContentOptions {
  [key: string]: unknown;
}

