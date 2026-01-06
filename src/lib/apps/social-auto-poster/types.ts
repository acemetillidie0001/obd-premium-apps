/**
 * OBD Social Auto-Poster - Type Definitions
 * 
 * Strict TypeScript types for the Social Auto-Poster V3 app.
 */

// ============================================
// Core Enums
// ============================================

export type SocialPlatform = "facebook" | "instagram" | "x" | "googleBusiness";

export type PostingMode = "review" | "auto" | "campaign";

export type QueueStatus = "draft" | "approved" | "scheduled" | "posted" | "failed";

export type ContentTheme = "education" | "promotion" | "social_proof" | "community" | "seasonal" | "general";

export type ContentPillar = "education" | "promotion" | "social_proof" | "community" | "seasonal";

// ============================================
// Settings Types
// ============================================

export interface PlatformOverrides {
  emojiModeOverride?: "allow" | "limit" | "none";
  hashtagLimitOverride?: number;
  ctaStyleOverride?: "none" | "soft" | "direct";
}

export interface PlatformsEnabled {
  facebook?: boolean;
  instagram?: boolean;
  x?: boolean;
  googleBusiness?: boolean;
}

export interface PlatformOverridesMap {
  facebook?: PlatformOverrides;
  instagram?: PlatformOverrides;
  x?: PlatformOverrides;
  googleBusiness?: PlatformOverrides;
}

export interface ContentPillarSettings {
  contentPillarMode: "single" | "rotate";
  defaultPillar?: ContentPillar;
  rotatePillars?: ContentPillar[];
}

export interface HashtagBankSettings {
  includeLocalHashtags: boolean;
  hashtagBankMode: "auto" | "manual";
}

export interface SchedulingRules {
  frequency: string; // e.g., "daily", "weekly", "3x per week"
  allowedDays: string[]; // ["monday", "tuesday", ...]
  timeWindow: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  timezone: string; // IANA timezone, e.g., "America/New_York"
}

export interface ImageSettings {
  enableImages: boolean;
  imageCategoryMode: "auto" | "educational" | "promotion" | "social_proof" | "local_abstract" | "evergreen";
  allowTextOverlay: boolean;
}

export interface SocialAutoposterSettings {
  id?: string;
  userId: string;
  brandVoice?: string;
  useBrandKit?: boolean; // Default true for backward compatibility
  postingMode: PostingMode;
  schedulingRules: SchedulingRules;
  enabledPlatforms: SocialPlatform[];
  platformsEnabled?: PlatformsEnabled;
  platformOverrides?: PlatformOverridesMap;
  contentPillarSettings?: ContentPillarSettings;
  hashtagBankSettings?: HashtagBankSettings;
  imageSettings?: ImageSettings;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// Post Generation Types
// ============================================

export interface PostImage {
  status: "skipped" | "generated" | "fallback";
  url?: string | null;
  altText?: string | null;
  provider?: string | null;
  aspect?: string | null;
  category?: string | null;
  fallbackReason?: string | null;
  errorCode?: string | null;
  requestId?: string | null;
}

export interface SocialPostDraft {
  platform: SocialPlatform;
  content: string;
  characterCount: number;
  reason?: string; // Why this post was created
  theme?: ContentTheme; // Content theme
  isSimilar?: boolean; // Flag if similar to recent post
  image?: PostImage; // Optional image metadata (ephemeral)
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    linkUrl?: string;
  };
}

export interface SocialPostPreview {
  platform: SocialPlatform;
  content: string;
  characterCount: number;
  maxCharacters: number;
  isValid: boolean;
  preview: string; // Formatted preview text
  reason?: string; // Why this post was created
  theme?: ContentTheme; // Content theme
  isSimilar?: boolean; // Flag if similar to recent post
  image?: PostImage; // Optional image metadata (ephemeral)
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    linkUrl?: string;
  };
}

export interface GeneratePostsRequest {
  businessName?: string;
  businessType?: string;
  topic?: string;
  details?: string;
  brandVoice?: string;
  platforms: SocialPlatform[];
  postLength?: "Short" | "Medium" | "Long";
  campaignType?: "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement";
  generateVariants?: boolean; // Generate 2 additional variants
  pillarOverride?: ContentPillar; // Override pillar for this generation
  regenerateHashtags?: boolean; // Regenerate hashtags for this post
}

export interface GeneratePostsResponse {
  drafts: SocialPostDraft[];
  previews: SocialPostPreview[];
  variants?: Record<SocialPlatform, SocialPostDraft[]>; // A/B-style variants per platform
}

// ============================================
// Queue Types
// ============================================

export interface SocialQueueItem {
  id: string;
  userId: string;
  platform: SocialPlatform;
  content: string;
  status: QueueStatus;
  scheduledAt?: Date | null;
  postedAt?: Date | null;
  errorMessage?: string | null;
  attemptCount: number;
  metadata?: Record<string, unknown>;
  contentTheme?: ContentTheme | null;
  contentHash?: string | null;
  contentFingerprint?: string | null;
  reason?: string | null;
  isSimilar?: boolean;
  imageStatus?: "skipped" | "generated" | "fallback" | null;
  imageUrl?: string | null;
  imageAltText?: string | null;
  imageProvider?: string | null;
  imageAspect?: string | null;
  imageCategory?: string | null;
  imageErrorCode?: string | null;
  imageFallbackReason?: string | null;
  imageRequestId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQueueItemRequest {
  platform: SocialPlatform;
  content: string;
  scheduledAt?: string; // ISO date string
  metadata?: Record<string, unknown>;
  reason?: string;
  theme?: ContentTheme;
  contentHash?: string;
  contentFingerprint?: string;
  isSimilar?: boolean;
}

export interface CreateQueueItemResponse {
  item: SocialQueueItem;
}

export interface UpdateQueueItemRequest {
  id: string;
  status?: QueueStatus;
  scheduledAt?: string; // ISO date string
  content?: string;
}

export interface QueueListResponse {
  items: SocialQueueItem[];
  total: number;
}

// ============================================
// Activity Log Types
// ============================================

export interface SocialDeliveryAttempt {
  id: string;
  userId: string;
  queueItemId: string;
  platform: SocialPlatform;
  success: boolean;
  errorMessage?: string | null;
  responseData?: Record<string, unknown> | null;
  attemptedAt: Date;
}

export interface ActivityLogItem {
  id: string;
  queueItemId: string;
  platform: SocialPlatform;
  content: string;
  status: QueueStatus;
  postedAt?: Date | null;
  errorMessage?: string | null;
  attemptCount: number;
  attempts: SocialDeliveryAttempt[];
  createdAt: Date;
}

export interface ActivityListResponse {
  items: ActivityLogItem[];
  total: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface SaveSettingsRequest {
  brandVoice?: string;
  useBrandKit?: boolean;
  postingMode: PostingMode;
  schedulingRules: SchedulingRules;
  enabledPlatforms: SocialPlatform[];
  platformsEnabled?: PlatformsEnabled;
  platformOverrides?: PlatformOverridesMap;
  contentPillarSettings?: ContentPillarSettings;
  hashtagBankSettings?: HashtagBankSettings;
  imageSettings?: ImageSettings;
}

export interface SaveSettingsResponse {
  settings: SocialAutoposterSettings;
}

export interface GetSettingsResponse {
  settings: SocialAutoposterSettings | null;
}

export interface SimulateRunRequest {
  queueItemIds?: string[]; // If empty, simulates all scheduled items
}

export interface SimulateRunResponse {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    queueItemId: string;
    success: boolean;
    errorMessage?: string;
  }>;
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsSummary {
  scheduledLast7Days: number;
  scheduledLast30Days: number;
  postedSuccessRate: number; // 0-100
  failureRate: number; // 0-100
  platformDistribution: Record<SocialPlatform, number>;
  totalScheduled: number;
  totalPosted: number;
  totalFailed: number;
  totalQueueItems: number;
}

