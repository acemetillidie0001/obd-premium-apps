/**
 * OBD Social Auto-Poster - Utility Functions
 * 
 * Content normalization, hashing, and similarity detection utilities.
 */

import { createHash } from "crypto";
import type { SocialPlatform, ContentTheme, ContentPillar, AnalyticsSummary, PlatformsEnabled, PlatformOverridesMap, ContentPillarSettings, HashtagBankSettings, PlatformOverrides } from "./types";
import { prisma } from "@/lib/prisma";

// ============================================
// Runtime Type Guards for Prisma JSON Fields
// ============================================

const VALID_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "x", "googleBusiness"];
const VALID_CONTENT_PILLARS: ContentPillar[] = ["education", "promotion", "social_proof", "community", "seasonal"];
const VALID_PILLAR_MODES = ["single", "rotate"] as const;
const VALID_HASHTAG_MODES = ["auto", "manual"] as const;
const VALID_EMOJI_MODES = ["allow", "limit", "none"] as const;
const VALID_CTA_STYLES = ["none", "soft", "direct"] as const;

/**
 * Type guard for SocialPlatform array
 */
export function isValidSocialPlatformArray(value: unknown): value is SocialPlatform[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => typeof v === "string" && VALID_PLATFORMS.includes(v as SocialPlatform));
}

/**
 * Type guard for PlatformsEnabled object
 */
export function isValidPlatformsEnabled(value: unknown): value is PlatformsEnabled {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  // Check that all keys are valid platforms and values are booleans (or undefined)
  return Object.keys(obj).every((key) => {
    if (!VALID_PLATFORMS.includes(key as SocialPlatform)) return false;
    const val = obj[key];
    return val === undefined || typeof val === "boolean";
  });
}

/**
 * Type guard for PlatformOverrides object
 */
function isValidPlatformOverrides(value: unknown): value is PlatformOverrides {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  
  if (obj.emojiModeOverride !== undefined) {
    if (typeof obj.emojiModeOverride !== "string" || !(VALID_EMOJI_MODES as readonly string[]).includes(obj.emojiModeOverride)) {
      return false;
    }
  }
  
  if (obj.hashtagLimitOverride !== undefined) {
    if (typeof obj.hashtagLimitOverride !== "number" || obj.hashtagLimitOverride < 0) {
      return false;
    }
  }
  
  if (obj.ctaStyleOverride !== undefined) {
    if (typeof obj.ctaStyleOverride !== "string" || !(VALID_CTA_STYLES as readonly string[]).includes(obj.ctaStyleOverride)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Type guard for PlatformOverridesMap object
 */
export function isValidPlatformOverridesMap(value: unknown): value is PlatformOverridesMap {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  // Check that all keys are valid platforms and values are PlatformOverrides (or undefined)
  return Object.keys(obj).every((key) => {
    if (!VALID_PLATFORMS.includes(key as SocialPlatform)) return false;
    const val = obj[key];
    return val === undefined || isValidPlatformOverrides(val);
  });
}

/**
 * Type guard for ContentPillarSettings object
 */
export function isValidContentPillarSettings(value: unknown): value is ContentPillarSettings {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  
  // contentPillarMode is required
  if (typeof obj.contentPillarMode !== "string" || !(VALID_PILLAR_MODES as readonly string[]).includes(obj.contentPillarMode)) {
    return false;
  }
  
  // defaultPillar is optional but must be valid if present
  if (obj.defaultPillar !== undefined) {
    if (typeof obj.defaultPillar !== "string" || !VALID_CONTENT_PILLARS.includes(obj.defaultPillar as ContentPillar)) {
      return false;
    }
  }
  
  // rotatePillars is optional but must be valid array if present
  if (obj.rotatePillars !== undefined) {
    if (!Array.isArray(obj.rotatePillars)) return false;
    if (!obj.rotatePillars.every((p) => typeof p === "string" && VALID_CONTENT_PILLARS.includes(p as ContentPillar))) {
      return false;
    }
  }
  
  return true;
}

/**
 * Type guard for HashtagBankSettings object
 */
export function isValidHashtagBankSettings(value: unknown): value is HashtagBankSettings {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  
  // includeLocalHashtags is required
  if (typeof obj.includeLocalHashtags !== "boolean") return false;
  
  // hashtagBankMode is required
  if (typeof obj.hashtagBankMode !== "string" || !(VALID_HASHTAG_MODES as readonly string[]).includes(obj.hashtagBankMode)) {
    return false;
  }
  
  return true;
}

/**
 * Normalizes text for hashing/comparison:
 * - Lowercase
 * - Remove extra whitespace
 * - Remove punctuation (optional, configurable)
 * - Remove common stop words (optional)
 */
export function normalizeText(text: string, options?: { removePunctuation?: boolean; removeStopWords?: boolean }): string {
  let normalized = text.toLowerCase().trim();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, " ");
  
  if (options?.removePunctuation) {
    // Remove punctuation but keep spaces
    normalized = normalized.replace(/[^\w\s]/g, "");
  }
  
  if (options?.removeStopWords) {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
      "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
      "will", "would", "should", "could", "may", "might", "must", "can", "this", "that", "these", "those",
    ]);
    normalized = normalized
      .split(" ")
      .filter((word) => !stopWords.has(word))
      .join(" ");
  }
  
  return normalized.trim();
}

/**
 * Computes a stable hash for content similarity detection.
 * Uses SHA-256 for collision resistance and security.
 */
export function computeContentHash(
  content: string,
  platform: SocialPlatform,
  theme?: ContentTheme
): string {
  const normalized = normalizeText(content, { removePunctuation: true, removeStopWords: true });
  const combined = `${platform}:${theme || "general"}:${normalized}`;
  
  // Use SHA-256 for secure, collision-resistant hashing
  return createHash("sha256").update(combined, "utf8").digest("hex");
}

/**
 * Computes a short fingerprint for quick comparisons.
 * Uses first 16 characters of normalized content + platform.
 */
export function computeContentFingerprint(content: string, platform: SocialPlatform): string {
  const normalized = normalizeText(content, { removePunctuation: true });
  const prefix = normalized.substring(0, 16).replace(/\s/g, "");
  return `${platform}:${prefix}`;
}

/**
 * Checks for similar posts in recent N days (default 14).
 * Returns true if a similar post (same hash) exists.
 */
export async function similarityCheckRecent(
  userId: string,
  platform: SocialPlatform,
  contentHash: string,
  days: number = 14
): Promise<{ isSimilar: boolean; similarPostId?: string; similarPostDate?: Date }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const similarPost = await prisma.socialQueueItem.findFirst({
    where: {
      userId,
      platform,
      contentHash,
      createdAt: {
        gte: cutoffDate,
      },
      // Exclude drafts that might be duplicates
      status: {
        not: "draft",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  
  if (similarPost) {
    return {
      isSimilar: true,
      similarPostId: similarPost.id,
      similarPostDate: similarPost.createdAt,
    };
  }
  
  return { isSimilar: false };
}

/**
 * Determines content theme based on inputs.
 */
export function determineContentTheme(
  campaignType?: string,
  topic?: string,
  details?: string
): ContentTheme {
  const combined = `${campaignType || ""} ${topic || ""} ${details || ""}`.toLowerCase();
  
  if (combined.includes("offer") || combined.includes("promo") || combined.includes("discount") || combined.includes("sale")) {
    return "promotion";
  }
  if (combined.includes("review") || combined.includes("testimonial") || combined.includes("customer")) {
    return "social_proof";
  }
  if (combined.includes("learn") || combined.includes("how") || combined.includes("tip") || combined.includes("guide")) {
    return "education";
  }
  if (combined.includes("community") || combined.includes("local") || combined.includes("neighborhood")) {
    return "community";
  }
  if (combined.includes("season") || combined.includes("holiday") || combined.includes("summer") || combined.includes("winter") || combined.includes("spring") || combined.includes("fall")) {
    return "seasonal";
  }
  
  return "general";
}

/**
 * Generates a reason string explaining why the post was created.
 */
export function generatePostReason(
  businessName?: string,
  businessType?: string,
  topic?: string,
  campaignType?: string,
  theme: ContentTheme = "general"
): string {
  const parts: string[] = [];
  
  if (businessType) {
    parts.push(`Based on your business type: ${businessType}`);
  }
  
  if (campaignType) {
    const campaignLabels: Record<string, string> = {
      "Everyday Post": "everyday content",
      "Event": "event promotion",
      "Limited-Time Offer": "limited-time offer",
      "New Service Announcement": "new service announcement",
    };
    parts.push(`Promoting: ${campaignLabels[campaignType] || campaignType}`);
  }
  
  if (topic) {
    parts.push(`Topic: ${topic}`);
  }
  
  if (theme === "seasonal") {
    parts.push("Seasonal Ocala content");
  }
  
  if (parts.length === 0) {
    return "General business post";
  }
  
  return parts.join(" • ");
}

/**
 * Picks the next content pillar based on rotation mode and recent history.
 * Avoids repeating the last 2 pillars used.
 */
export async function pickNextPillar(
  userId: string,
  pillarSettings: { contentPillarMode: "single" | "rotate"; defaultPillar?: ContentPillar; rotatePillars?: ContentPillar[] }
): Promise<ContentPillar> {
  // If single mode, return default or first available
  if (pillarSettings.contentPillarMode === "single") {
    return pillarSettings.defaultPillar || "education";
  }

  // Rotate mode: get recent pillars (last 2)
  const recentItems = await prisma.socialQueueItem.findMany({
    where: {
      userId,
      contentTheme: {
        in: ["education", "promotion", "social_proof", "community", "seasonal"],
      },
      status: {
        not: "draft",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 2,
    select: {
      contentTheme: true,
    },
  });

  const recentPillars = recentItems
    .map((item) => item.contentTheme as ContentPillar)
    .filter((p): p is ContentPillar => p !== null);

  // Get available pillars (from rotatePillars or all)
  const availablePillars: ContentPillar[] = pillarSettings.rotatePillars || [
    "education",
    "promotion",
    "social_proof",
    "community",
    "seasonal",
  ];

  // Filter out recent pillars
  const candidates = availablePillars.filter((p) => !recentPillars.includes(p));

  // If all pillars were used recently, use the oldest one
  if (candidates.length === 0) {
    return recentPillars[recentPillars.length - 1] || availablePillars[0];
  }

  // Return first available candidate
  return candidates[0];
}

/**
 * Default hashtag sets for Ocala businesses.
 */
const DEFAULT_HASHTAG_SETS: Record<string, string[]> = {
  global: ["#OcalaFL", "#OcalaBusiness", "#MarionCounty", "#SupportLocalOcala", "#OcalaLocal"],
  service: ["#OcalaServices", "#OcalaBusiness", "#MarionCounty", "#LocalBusiness", "#OcalaFL"],
  retail: ["#OcalaShopping", "#OcalaBusiness", "#MarionCounty", "#ShopLocal", "#OcalaFL"],
  restaurant: ["#OcalaFood", "#OcalaDining", "#MarionCounty", "#EatLocalOcala", "#OcalaFL"],
  professional: ["#OcalaBusiness", "#MarionCounty", "#OcalaFL", "#LocalBusiness", "#OcalaProfessional"],
};

/**
 * Gets a hashtag set for a business, considering recent usage.
 */
export async function getHashtagSetForBusiness(
  userId: string,
  businessType?: string,
  platform?: SocialPlatform
): Promise<string[]> {
  // Determine which set to use based on business type
  let setKey = "global";
  if (businessType) {
    const lowerType = businessType.toLowerCase();
    if (lowerType.includes("service") || lowerType.includes("repair") || lowerType.includes("cleaning")) {
      setKey = "service";
    } else if (lowerType.includes("retail") || lowerType.includes("shop") || lowerType.includes("store")) {
      setKey = "retail";
    } else if (lowerType.includes("restaurant") || lowerType.includes("food") || lowerType.includes("cafe")) {
      setKey = "restaurant";
    } else if (lowerType.includes("professional") || lowerType.includes("consulting") || lowerType.includes("legal")) {
      setKey = "professional";
    }
  }

  const baseSet = DEFAULT_HASHTAG_SETS[setKey] || DEFAULT_HASHTAG_SETS.global;

  // Check recent usage (last 7 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const recentItems = await prisma.socialQueueItem.findMany({
    where: {
      userId,
      createdAt: {
        gte: cutoffDate,
      },
      status: {
        not: "draft",
      },
      ...(platform ? { platform } : {}),
    },
    select: {
      metadata: true,
    },
  });

  // Extract hashtags from recent items
  const recentHashtagSets = recentItems
    .map((item) => {
      const metadata = item.metadata as { hashtags?: string[] } | null;
      return metadata?.hashtags || [];
    })
    .filter((hashtags) => hashtags.length > 0);

  // If we've used this exact set recently, rotate it
  const setString = baseSet.sort().join(",");
  const hasUsedRecently = recentHashtagSets.some((hashtags) => {
    const hashtagString = hashtags.sort().join(",");
    return hashtagString === setString;
  });

  if (hasUsedRecently) {
    return rotateHashtagSet(baseSet, recentHashtagSets);
  }

  return baseSet;
}

/**
 * Rotates a hashtag set to avoid recent duplicates.
 */
export function rotateHashtagSet(
  baseSet: string[],
  recentSets: string[][]
): string[] {
  // Create a pool of alternative hashtags
  const allHashtags = new Set<string>();
  Object.values(DEFAULT_HASHTAG_SETS).forEach((set) => {
    set.forEach((tag) => allHashtags.add(tag));
  });

  // Remove recently used hashtags
  const usedHashtags = new Set<string>();
  recentSets.forEach((set) => {
    set.forEach((tag) => usedHashtags.add(tag));
  });

  const availableHashtags = Array.from(allHashtags).filter((tag) => !usedHashtags.has(tag));

  // If we have enough available, use them
  if (availableHashtags.length >= baseSet.length) {
    return availableHashtags.slice(0, baseSet.length);
  }

  // Otherwise, mix available with base set (avoiding exact duplicates)
  const result: string[] = [];
  const usedInResult = new Set<string>();

  // First, add available hashtags
  for (const tag of availableHashtags) {
    if (result.length < baseSet.length && !usedInResult.has(tag)) {
      result.push(tag);
      usedInResult.add(tag);
    }
  }

  // Then, add from base set if needed (avoiding recent)
  for (const tag of baseSet) {
    if (result.length < baseSet.length && !usedInResult.has(tag) && !usedHashtags.has(tag)) {
      result.push(tag);
      usedInResult.add(tag);
    }
  }

  // If still not enough, just use base set (can't avoid all duplicates)
  if (result.length < baseSet.length) {
    return baseSet;
  }

  return result;
}

/**
 * Computes analytics summary from queue items and delivery attempts.
 */
export async function computeAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get all queue items
  const allItems = await prisma.socialQueueItem.findMany({
    where: { userId },
    select: {
      status: true,
      platform: true,
      scheduledAt: true,
      createdAt: true,
    },
  });

  // Get delivery attempts
  const attempts = await prisma.socialDeliveryAttempt.findMany({
    where: { userId },
    select: {
      success: true,
      platform: true,
    },
  });

  // Calculate metrics
  const scheduledLast7Days = allItems.filter(
    (item) => item.scheduledAt && new Date(item.scheduledAt) >= last7Days
  ).length;

  const scheduledLast30Days = allItems.filter(
    (item) => item.scheduledAt && new Date(item.scheduledAt) >= last30Days
  ).length;

  const totalScheduled = allItems.filter((item) => item.status === "scheduled" || item.status === "posted").length;
  const totalPosted = allItems.filter((item) => item.status === "posted").length;
  const totalFailed = allItems.filter((item) => item.status === "failed").length;
  const totalQueueItems = allItems.length;

  const successfulAttempts = attempts.filter((a) => a.success).length;
  const totalAttempts = attempts.length;
  const postedSuccessRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;
  const failureRate = totalAttempts > 0 ? Math.round(((totalAttempts - successfulAttempts) / totalAttempts) * 100) : 0;

  // Platform distribution
  const platformDistribution: Record<SocialPlatform, number> = {
    facebook: 0,
    instagram: 0,
    x: 0,
    googleBusiness: 0,
  };

  allItems.forEach((item) => {
    if (item.status === "posted" || item.status === "scheduled") {
      platformDistribution[item.platform as SocialPlatform]++;
    }
  });

  return {
    scheduledLast7Days,
    scheduledLast30Days,
    postedSuccessRate,
    failureRate,
    platformDistribution,
    totalScheduled,
    totalPosted,
    totalFailed,
    totalQueueItems,
  };
}

