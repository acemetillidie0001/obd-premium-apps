export type PersonalityStyle = "None" | "Soft" | "Bold" | "High-Energy" | "Luxury";

export interface BaseBusinessInfo {
  businessName: string;
  businessType: string;
  services: string[]; // array from comma/line separated input
  city: string;
  state: string;
  websiteUrl?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  personalityStyle: PersonalityStyle;
  brandVoice?: string;
}

export interface GoogleBusinessAuditRequest extends BaseBusinessInfo {
  googleBusinessUrl?: string;
  mainCategory?: string;
  goals?: string; // "What do you want to improve?"
}

export interface GoogleBusinessAuditResult {
  score: number; // 0–100
  summary: string;
  strengths: string[];
  issues: string[];
  quickWins: string[];
  priorityFixes: { title: string; description: string; impact: "Low" | "Medium" | "High" }[];
  suggestedKeywords: string[];
  suggestedSections: string[]; // e.g. "Add 'Services' section", "Add more photos"
}

export interface GoogleBusinessWizardRequest extends BaseBusinessInfo {
  shortDescriptionLength: "Short" | "Medium" | "Long";
  longDescriptionLength: "Short" | "Medium" | "Long";
  serviceAreas?: string;
  openingHours?: string;
  specialities?: string;
  faqCount: number;
  includePosts: boolean;
  postGoal?: string;
  promoDetails?: string;
}

export interface GoogleBusinessWizardResult {
  shortDescription: string;        // 1–2 sentence profile description
  longDescription: string;         // full "From the business" style description
  servicesSection: string;         // services-focused paragraph
  aboutSection: string;            // about the business / story
  serviceAreaSection?: string;
  openingHoursBlurb?: string;
  faqSuggestions: { question: string; answer: string }[];
  postIdeas: string[];             // GBP post ideas (if includePosts === true)
  keywordSuggestions: string[];
}

/**
 * Runtime type guard for GoogleBusinessAuditResult
 */
export function isGoogleBusinessAuditResult(value: unknown): value is GoogleBusinessAuditResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required fields with correct types
  if (typeof obj.score !== "number") return false;
  if (typeof obj.summary !== "string") return false;
  if (!Array.isArray(obj.strengths) || !obj.strengths.every((s: unknown) => typeof s === "string")) return false;
  if (!Array.isArray(obj.issues) || !obj.issues.every((s: unknown) => typeof s === "string")) return false;
  if (!Array.isArray(obj.quickWins) || !obj.quickWins.every((s: unknown) => typeof s === "string")) return false;
  if (!Array.isArray(obj.suggestedKeywords) || !obj.suggestedKeywords.every((s: unknown) => typeof s === "string")) return false;
  if (!Array.isArray(obj.suggestedSections) || !obj.suggestedSections.every((s: unknown) => typeof s === "string")) return false;

  // Check priorityFixes array
  if (!Array.isArray(obj.priorityFixes)) return false;
  for (const fix of obj.priorityFixes) {
    if (!fix || typeof fix !== "object") return false;
    const fixObj = fix as Record<string, unknown>;
    if (typeof fixObj.title !== "string") return false;
    if (typeof fixObj.description !== "string") return false;
    if (fixObj.impact !== "Low" && fixObj.impact !== "Medium" && fixObj.impact !== "High") return false;
  }

  return true;
}

/**
 * Runtime type guard for GoogleBusinessWizardResult
 */
export function isGoogleBusinessWizardResult(value: unknown): value is GoogleBusinessWizardResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required string fields
  if (typeof obj.shortDescription !== "string") return false;
  if (typeof obj.longDescription !== "string") return false;
  if (typeof obj.servicesSection !== "string") return false;
  if (typeof obj.aboutSection !== "string") return false;

  // Check optional string fields (if present, must be string)
  if (obj.serviceAreaSection !== undefined && typeof obj.serviceAreaSection !== "string") return false;
  if (obj.openingHoursBlurb !== undefined && typeof obj.openingHoursBlurb !== "string") return false;

  // Check faqSuggestions array
  if (!Array.isArray(obj.faqSuggestions)) return false;
  for (const faq of obj.faqSuggestions) {
    if (!faq || typeof faq !== "object") return false;
    const faqObj = faq as Record<string, unknown>;
    if (typeof faqObj.question !== "string") return false;
    if (typeof faqObj.answer !== "string") return false;
  }

  // Check postIdeas and keywordSuggestions arrays
  if (!Array.isArray(obj.postIdeas) || !obj.postIdeas.every((s: unknown) => typeof s === "string")) return false;
  if (!Array.isArray(obj.keywordSuggestions) || !obj.keywordSuggestions.every((s: unknown) => typeof s === "string")) return false;

  return true;
}// Combined Pro Mode request and result types

export interface GoogleBusinessProRequest
extends GoogleBusinessWizardRequest {
/**
 * Optional extra fields that help the audit side.
 * These may come from the Audit form, or be left empty.
 */
googleBusinessUrl?: string;
mainCategory?: string;
goals?: string;
}

/**
* Combined result type used by Pro Mode when running both
* the Audit Engine and the Content Wizard together.
*/
export interface GoogleBusinessProResult {
audit: GoogleBusinessAuditResult;
content: GoogleBusinessWizardResult;
}
export function isGoogleBusinessProResult(value: unknown): value is GoogleBusinessProResult {
  if (!value || typeof value !== "object") return false;
  const v = value as GoogleBusinessProResult;
  return (
    v.audit !== undefined &&
    v.content !== undefined &&
    isGoogleBusinessAuditResult(v.audit) &&
    isGoogleBusinessWizardResult(v.content)
  );
}

// ============================================================================
// Report Export Types
// ============================================================================

export interface GoogleBusinessProReportOptions {
  theme?: "light" | "dark";
  includeSections?: {
    auditSummary?: boolean;
    strengths?: boolean;
    issues?: boolean;
    quickWins?: boolean;
    priorityFixes?: boolean;
    descriptions?: boolean;
    faqs?: boolean;
    posts?: boolean;
    keywords?: boolean;
  };
  /**
   * Optional business-facing title, e.g. used on PDF/HTML report header.
   */
  reportTitle?: string;
}

export interface GoogleBusinessProReportExport {
  /**
   * Styled HTML string safe to render inside a <div dangerouslySetInnerHTML> on a report page.
   */
  html: string;
  /**
   * Optional shareable id that can be used to construct a URL like:
   * /apps/google-business-pro/report/[id]
   * For now this can be a uuid stored in memory.
   */
  shareId?: string;
  /**
   * Optional direct PDF download path (e.g. /reports/gbp-pro/{id}.pdf)
   * Implementation can be basic; it's okay if this is null for now.
   */
  pdfPath?: string;
  /**
   * Base64-encoded PDF bytes for client-side download
   */
  pdfBase64?: string;
  /**
   * Optional token returned to the UI for share-protected reports
   */
  accessToken?: string;
}

export interface GoogleBusinessProReportMeta {
  businessName: string;
  city: string;
  state: string;
  score?: number;
  createdAt: string; // ISO timestamp
  /**
   * Optional share access token (for authenticated sharing)
   */
  accessToken?: string;
}

export interface GoogleBusinessProCsvExport {
  filename: string;
  csvContent: string; // raw CSV string
}

// ============================================================================
// Pro Rewrites (Premium Optimization Pack)
// ============================================================================

export type GoogleBusinessRewriteTone =
  | "Default"
  | "Soft"
  | "Bold"
  | "High-Energy"
  | "Luxury";

export interface GoogleBusinessRewritesRequest {
  /**
   * Original Pro result as returned by /api/google-business/pro.
   * Use this instead of calling OpenAI again to reduce token usage.
   */
  proResult: GoogleBusinessProResult;
  tone: GoogleBusinessRewriteTone;
  /**
   * Optional notes for what to emphasize (e.g. "family friendly", "late hours").
   */
  emphasisNotes?: string;
}

export interface GoogleBusinessRewritesResult {
  shortDescription: string;
  longDescription: string;
  servicesSection: string;
  aboutSection: string;
  /**
   * Optional extra "Premium GBP Optimization Pack" copy block that could be used
   * as an email summary or internal notes.
   */
  premiumNotes?: string;
}

// ============================================================================
// Photo Optimization
// ============================================================================

export interface GoogleBusinessPhotoOptimizationRequest {
  proResult: GoogleBusinessProResult;
  /**
   * Optional free-text description of existing photo library or what they typically post.
   */
  currentPhotoContext?: string;
}

export interface GoogleBusinessPhotoAlbumSuggestion {
  albumName: string;
  description: string;
  suggestedImages: string[]; // conceptual image ideas
  keywords: string[];
}

export interface GoogleBusinessPhotoOptimizationResult {
  /**
   * Caption ideas for generic GBP photos that match their brand/services.
   */
  captions: string[];
  /**
   * Grouped album/collection ideas with keywords to use when naming files or organizing.
   */
  albums: GoogleBusinessPhotoAlbumSuggestion[];
}

// ============================================================================
// Competitor Insights
// ============================================================================

export interface GoogleBusinessCompetitorInput {
  name: string;
  googleBusinessUrl?: string;
  notes?: string; // summary of what user knows about this competitor
}

export interface GoogleBusinessCompetitorScore {
  name: string;
  relativeScore: number; // -20 to +20 vs our business
  summary: string;
  strengths: string[];
  weaknesses: string[];
  subScores: {
    visibility: number;  // 0–100
    reputation: number;  // 0–100
    contentQuality: number; // 0–100
    offerStrength: number;  // 0–100
  };
}

export interface GoogleBusinessCompetitorInsightsRequest {
  /**
   * Our Pro request + result, used to understand our business.
   */
  proRequest: GoogleBusinessProRequest;
  proResult: GoogleBusinessProResult;
  competitors: GoogleBusinessCompetitorInput[];
}

export interface GoogleBusinessCompetitorInsightsResult {
  overallSummary: string;
  ourPositioningAdvice: string;
  competitorScores: GoogleBusinessCompetitorScore[];
}

