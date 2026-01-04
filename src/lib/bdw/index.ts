/**
 * BDW Reuse Kit - Tier 4A
 * 
 * Barrel export for reusable BDW utilities and types that other apps can import
 * to get BDW-level UX capabilities.
 * 
 * This module re-exports:
 * - Text utilities (safeTrimToLimit)
 * - Export formatters
 * - Quality analysis and fix generators
 * - Brand profile helpers
 * - Fix pack helpers
 * - Type definitions
 */

// Text Utilities
export { safeTrimToLimit } from "@/lib/utils/safeTrimToLimit";

// Export Formatters
export {
  formatFullPackPlainText,
  formatFullPackMarkdown,
  formatWebsiteHtmlSnippet,
  formatGBPPackPlainText,
  formatWebsitePackPlainText,
  formatGBPBlock,
  formatWebsiteAboutBlock,
  formatSocialBioBlock,
  formatFAQBlock,
  formatMetaBlock,
  type BusinessDescriptionResponse as BusinessDescriptionResponseExport,
} from "@/lib/utils/bdw-export-formatters";

// Destination Export Helpers (Tier 4B)
export {
  formatForGBP,
  type DestinationInput,
} from "@/lib/bdw/destinations/formatForGBP";
export { formatForDivi } from "@/lib/bdw/destinations/formatForDivi";
export { formatForDirectory } from "@/lib/bdw/destinations/formatForDirectory";
export { convertToDestinationInput } from "@/lib/bdw/destinations/convertToDestinationInput";

// Quality Controls
export {
  runQualityAnalysis,
  generateSoftenHypeWordsFix,
  generateRemoveDuplicatesFix,
  softenHypeWords,
  removeDuplicateSentences,
  analyzeHypeWords,
  analyzeRepetitions,
  analyzeKeywordRepetition,
  analyzeReadability,
  type BusinessDescriptionResponse as BusinessDescriptionResponseQuality,
  type QualityAnalysis,
  type HypeWordsResult,
  type RepetitionResult,
  type KeywordRepetitionResult,
  type ReadabilityResult,
} from "@/lib/utils/bdw-quality-controls";

// Brand Profile
export {
  saveBrandProfile,
  loadBrandProfile,
  clearBrandProfile,
  BRAND_PROFILE_PRESETS,
  type BrandProfile,
} from "@/lib/utils/bdw-brand-profile";

// Fix Packs
export {
  buildFixSuggestions,
  previewFixPack,
  getProposedChangesForFix,
  getFixEligibility,
  type FixPackId,
  type OutputField,
  type FixSuggestion,
  type FixPreview,
} from "@/lib/utils/bdw-fix-packs";

