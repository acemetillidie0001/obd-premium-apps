import type { TeamRole } from "@prisma/client";

export const APP_KEYS = [
  "BRAND_PROFILE",
  "AI_CONTENT_WRITER",
  "AI_FAQ_GENERATOR",
  "AI_HELP_DESK",
  "REPUTATION_DASHBOARD",
  "REVIEW_RESPONDER",
  "SOCIAL_AUTO_POSTER",
  "BUSINESS_DESCRIPTION_WRITER",
  "OBD_CRM",
  "OBD_SCHEDULER",
  "LOCAL_KEYWORD_RESEARCH",
  "LOCAL_SEO_PAGE_BUILDER",
  "BUSINESS_SCHEMA_GENERATOR",
  "SEO_AUDIT_ROADMAP",
  "TEAMS_USERS",
] as const;

export type AppKey = (typeof APP_KEYS)[number];

export const ACTION_KEYS = [
  "VIEW",
  "GENERATE_DRAFT",
  "EDIT_DRAFT",
  "APPLY",
  "EXPORT",
  "DELETE",
  "MANAGE_SETTINGS",
  "MANAGE_TEAM",
  "MANAGE_BILLING",
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

const ALL: readonly TeamRole[] = ["OWNER", "ADMIN", "STAFF"];
const OWNER_ADMIN: readonly TeamRole[] = ["OWNER", "ADMIN"];
const NONE: readonly TeamRole[] = [];

/**
 * Permission matrix (explicit, deny-by-default)
 *
 * Notes (safe v1 defaults):
 * - Everyone can VIEW most apps.
 * - Staff can use "draft tools" (generate/edit/export) where appropriate.
 * - "Apply", "Settings", "Delete", and "Team/Billing" are restricted.
 * - Unknown app/action => false.
 */
const PERMISSIONS: Record<AppKey, Partial<Record<ActionKey, readonly TeamRole[]>>> = {
  BRAND_PROFILE: {
    VIEW: ALL,
    // Brand profile is effectively business identity/settings (conservative)
    EDIT_DRAFT: OWNER_ADMIN,
    MANAGE_SETTINGS: OWNER_ADMIN,
    EXPORT: OWNER_ADMIN,
    APPLY: NONE,
    DELETE: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  AI_CONTENT_WRITER: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: ALL,
    APPLY: OWNER_ADMIN, // placeholder for future "apply-to-site" integrations
    DELETE: NONE,
    MANAGE_SETTINGS: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  AI_FAQ_GENERATOR: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: ALL,
    APPLY: OWNER_ADMIN, // placeholder for future "apply-to-site" integrations
    DELETE: NONE,
    MANAGE_SETTINGS: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  AI_HELP_DESK: {
    VIEW: ALL,
    // Business-level knowledge base: allow staff to view, keep mutations owner/admin in v1
    GENERATE_DRAFT: OWNER_ADMIN,
    EDIT_DRAFT: OWNER_ADMIN,
    EXPORT: ALL,
    APPLY: OWNER_ADMIN,
    DELETE: OWNER_ADMIN,
    MANAGE_SETTINGS: OWNER_ADMIN,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  REPUTATION_DASHBOARD: {
    VIEW: ALL,
    EXPORT: ALL,
    // Any destructive actions should be owner/admin only
    DELETE: OWNER_ADMIN,
    GENERATE_DRAFT: NONE,
    EDIT_DRAFT: NONE,
    APPLY: NONE,
    MANAGE_SETTINGS: OWNER_ADMIN,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  REVIEW_RESPONDER: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: ALL,
    APPLY: NONE,
    DELETE: NONE,
    MANAGE_SETTINGS: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  SOCIAL_AUTO_POSTER: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: ALL,
    APPLY: ALL,
    DELETE: ALL,
    MANAGE_SETTINGS: ALL,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  BUSINESS_DESCRIPTION_WRITER: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: ALL,
    APPLY: NONE,
    DELETE: ALL,
    MANAGE_SETTINGS: ALL,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  OBD_CRM: {
    VIEW: ALL,
    // CRM is business-level data; keep mutations owner/admin in v1
    EDIT_DRAFT: OWNER_ADMIN,
    DELETE: OWNER_ADMIN,
    EXPORT: OWNER_ADMIN,
    MANAGE_SETTINGS: OWNER_ADMIN,
    GENERATE_DRAFT: NONE,
    APPLY: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  OBD_SCHEDULER: {
    VIEW: ALL,
    // Scheduling is business-level; keep mutations owner/admin in v1
    EDIT_DRAFT: OWNER_ADMIN,
    DELETE: OWNER_ADMIN,
    EXPORT: OWNER_ADMIN,
    MANAGE_SETTINGS: OWNER_ADMIN,
    GENERATE_DRAFT: NONE,
    APPLY: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  LOCAL_KEYWORD_RESEARCH: {
    VIEW: ALL,
    // Draft-oriented research tool; allow staff to generate drafts, keep exports owner/admin by default.
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: OWNER_ADMIN,
    APPLY: NONE,
    DELETE: NONE,
    MANAGE_SETTINGS: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  LOCAL_SEO_PAGE_BUILDER: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EDIT_DRAFT: ALL,
    EXPORT: ALL,
    // "Apply" implies cross-system/site impact; staff denied by default
    APPLY: OWNER_ADMIN,
    DELETE: NONE,
    MANAGE_SETTINGS: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  BUSINESS_SCHEMA_GENERATOR: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    // Schema editing/apply is higher risk; keep owner/admin only
    EDIT_DRAFT: OWNER_ADMIN,
    APPLY: OWNER_ADMIN,
    EXPORT: ALL,
    DELETE: NONE,
    MANAGE_SETTINGS: OWNER_ADMIN,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  SEO_AUDIT_ROADMAP: {
    VIEW: ALL,
    GENERATE_DRAFT: ALL,
    EXPORT: ALL,
    EDIT_DRAFT: NONE,
    APPLY: NONE,
    DELETE: NONE,
    MANAGE_SETTINGS: NONE,
    MANAGE_TEAM: NONE,
    MANAGE_BILLING: NONE,
  },

  TEAMS_USERS: {
    VIEW: ALL,
    MANAGE_TEAM: OWNER_ADMIN,
    MANAGE_SETTINGS: OWNER_ADMIN,
    EXPORT: OWNER_ADMIN,
    DELETE: OWNER_ADMIN,
    GENERATE_DRAFT: NONE,
    EDIT_DRAFT: NONE,
    APPLY: NONE,
    MANAGE_BILLING: NONE,
  },
};

export function canUser(role: TeamRole, app: AppKey, action: ActionKey): boolean {
  const allowed = PERMISSIONS[app]?.[action];
  if (!allowed) return false; // deny-by-default
  return allowed.includes(role);
}

export type RoleCapabilitySummary = {
  view: boolean;
  createDrafts: boolean;
  editDrafts: boolean;
  apply: boolean;
  export: boolean;
  manageTeam: boolean;
  manageSettings: boolean;
};

function hasAnyPermission(role: TeamRole, action: ActionKey): boolean {
  return APP_KEYS.some((app) => canUser(role, app, action));
}

/**
 * High-level, read-only capability summary for UI display.
 *
 * IMPORTANT:
 * - This is intentionally NOT per-app granular in v1.
 * - A capability is considered available if the role has that action in at least one area of the product.
 */
export function getRoleCapabilitySummary(role: TeamRole): RoleCapabilitySummary {
  return {
    view: hasAnyPermission(role, "VIEW"),
    createDrafts: hasAnyPermission(role, "GENERATE_DRAFT"),
    editDrafts: hasAnyPermission(role, "EDIT_DRAFT"),
    apply: hasAnyPermission(role, "APPLY"),
    export: hasAnyPermission(role, "EXPORT"),
    manageTeam: canUser(role, "TEAMS_USERS", "MANAGE_TEAM"),
    manageSettings: hasAnyPermission(role, "MANAGE_SETTINGS"),
  };
}

export type PermissionContextSelector = {
  /**
   * Optional selector for multi-business future.
   * Enforced by requireBusinessContext(): must match an ACTIVE membership.
   */
  requestedBusinessId?: string | null;
};
