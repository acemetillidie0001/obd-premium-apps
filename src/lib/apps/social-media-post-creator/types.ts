/**
 * SMPC (Social Media Post Creator) - Canonical Types (Tier 5B)
 *
 * Keep platform permissive for now to avoid breaking
 * "Instagram (Carousel)" and other formatted labels.
 */

export type SMPCPlatform = string;

import type { SMPCPlatformKey } from "@/lib/apps/social-media-post-creator/platforms";

export type SMPCPostSection = {
  hook: string;
  bodyLines: string[];
  cta: string;
};

export type SMPCPostSnapshot = SMPCPostSection & {
  raw: string;
  characterCount: number;
};

/**
 * Canonical post item.
 *
 * Notes:
 * - Top-level fields represent the currently active content for this item.
 * - `generated` is the original parsed snapshot.
 * - `edited` is set when Fix Packs (or future inline editors) mutate content.
 */
export type SMPCPostItem = {
  id: string; // stable identifier (postNumber + platform)

  // Canonical platform fields (for exports/handoff/grouping)
  platformKey: SMPCPlatformKey;
  platformLabel: string;

  platform: SMPCPlatform;
  postNumber: number;

  // Active content fields (used by existing UI without needing to unwrap snapshots)
  hook: string;
  bodyLines: string[];
  cta: string;
  raw: string;
  characterCount: number;

  generated: SMPCPostSnapshot;
  edited?: SMPCPostSnapshot;

  createdAt: number;
  updatedAt: number;
};

