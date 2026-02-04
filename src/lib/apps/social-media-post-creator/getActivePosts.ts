import type { SMPCPostItem } from "@/lib/apps/social-media-post-creator/types";

/**
 * Canonical SMPC Posts Selector (Tier 5B)
 *
 * Rules:
 * - draft if parsedPosts is empty
 * - edited if editedPosts exists and has length
 * - otherwise generated
 *
 * Active posts:
 * - editedPosts ?? parsedPosts
 */
export function getActivePosts(params: {
  parsedPosts: SMPCPostItem[];
  editedPosts?: SMPCPostItem[] | null;
}): {
  activePosts: SMPCPostItem[];
  status: "draft" | "generated" | "edited";
} {
  const parsed = params.parsedPosts ?? [];
  const edited = params.editedPosts ?? null;

  if (!parsed.length) {
    return { activePosts: [], status: "draft" };
  }

  if (edited && edited.length) {
    return { activePosts: edited, status: "edited" };
  }

  return { activePosts: parsed, status: "generated" };
}

