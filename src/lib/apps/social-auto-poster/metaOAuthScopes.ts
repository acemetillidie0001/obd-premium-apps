/**
 * Central Meta OAuth scope sets for staged permissions.
 *
 * Hard constraint: keep Basic Connect scopes unchanged unless explicitly requested.
 * We only request publishing scopes when the user explicitly initiates the Publishing Access flow.
 */

export const META_OAUTH_SCOPES_BASIC = ["public_profile"] as const;

// Stage 2: pages listing + basic read engagement (for page selection + validation)
export const META_OAUTH_SCOPES_PAGES_ACCESS = ["pages_show_list", "pages_read_engagement"] as const;

// Stage 3: publishing permissions (Facebook Pages + Instagram Content Publishing)
// Stable order matters (deterministic requiredScopesMissing, deterministic error payloads).
export const META_OAUTH_SCOPES_PUBLISHING = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
] as const;

export const META_PUBLISHING_REQUIRED_SCOPES = META_OAUTH_SCOPES_PUBLISHING;

export function getMissingMetaScopes(
  required: readonly string[],
  present: readonly string[]
): string[] {
  const set = new Set(present);
  return required.filter((s) => !set.has(s));
}

