/**
 * AnythingLLM Business Scoping Utilities
 * 
 * Provides tenant-scoped workspace mapping for AnythingLLM integration.
 * Ensures each business has its own workspace and prevents cross-business data leakage.
 */

import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/api/logger";

/**
 * Tenant Safety Error - thrown when workspace slug matches known global/default values
 */
export class TenantSafetyError extends Error {
  constructor(workspaceSlug: string) {
    super(
      `Tenant safety blocked: workspace slug '${workspaceSlug}' matches a known global/default workspace name. Use a business-specific workspace.`
    );
    this.name = "TenantSafetyError";
  }
}

/**
 * Known global/default workspace slug values (case-insensitive)
 * These should never be used as they could expose cross-tenant data
 */
const BLOCKED_WORKSPACE_SLUGS = ["default", "global", "main", "public"];

/**
 * Assert that a workspace slug is not a blocked global/default value
 * 
 * @param workspaceSlug - The workspace slug to check
 * @throws TenantSafetyError if the slug matches a blocked value
 */
export function assertTenantSafe(workspaceSlug: string): void {
  const slugLower = workspaceSlug.toLowerCase().trim();
  
  if (BLOCKED_WORKSPACE_SLUGS.includes(slugLower)) {
    throw new TenantSafetyError(workspaceSlug);
  }
}

/**
 * Result of workspace slug lookup
 */
export interface WorkspaceSlugResult {
  workspaceSlug: string;
  isFallback: boolean;
}

/**
 * Get the workspace slug for a given business ID
 * 
 * Returns the mapped workspace slug, or falls back to DEV workspace in development.
 * In production, throws an error if no mapping exists.
 * 
 * Includes tenant safety checks to prevent use of global/default workspaces.
 * 
 * @param businessId - The business ID to look up (must not be empty)
 * @returns Workspace slug result with isFallback flag
 * @throws Error if businessId is missing, mapping is missing (production), or workspace slug is blocked
 */
export async function getWorkspaceSlugForBusiness(
  businessId: string
): Promise<WorkspaceSlugResult> {
  // Validate businessId is provided
  if (!businessId || !businessId.trim()) {
    throw new Error("Business ID is required");
  }

  try {
    const mapping = await prisma.aiWorkspaceMap.findUnique({
      where: { businessId },
      select: { workspaceSlug: true },
    });

    // If mapping exists, validate tenant safety and return it with isFallback=false
    if (mapping?.workspaceSlug) {
      // Tenant safety check: block global/default workspace slugs
      assertTenantSafe(mapping.workspaceSlug);
      
      return {
        workspaceSlug: mapping.workspaceSlug,
        isFallback: false,
      };
    }

    // --- PRODUCTION: STRICT MAPPING REQUIRED ---
    if (process.env.NODE_ENV === "production") {
      // In production, mappings are required - no fallback allowed
      throw new Error(
        `No workspace mapping found for businessId '${businessId}'. Please create a mapping in the database or use the setup wizard.`
      );
    }
    // --- END PRODUCTION ---

    // --- DEVELOPMENT: ALLOW FALLBACK (only if env var is set) ---
    const devWorkspaceSlug = process.env.AI_HELP_DESK_DEV_WORKSPACE_SLUG;
    if (devWorkspaceSlug && devWorkspaceSlug.trim()) {
      // Tenant safety check: block global/default workspace slugs even in dev
      assertTenantSafe(devWorkspaceSlug.trim());
      
      apiLogger.warn("anythingllm.scoping.dev-fallback", {
        message: `No mapping found for businessId '${businessId}', using DEV_WORKSPACE_SLUG fallback.`,
      });
      return {
        workspaceSlug: devWorkspaceSlug.trim(),
        isFallback: true,
      };
    } else {
      apiLogger.warn("anythingllm.scoping.dev-fallback-missing-env", {
        message: `No mapping found for businessId '${businessId}' and AI_HELP_DESK_DEV_WORKSPACE_SLUG is not set.`,
      });
      // Explicit error for developer to set the env var
      throw new Error(
        "Development fallback requires AI_HELP_DESK_DEV_WORKSPACE_SLUG to be set in .env.local"
      );
    }
    // --- END DEVELOPMENT ---
  } catch (error) {
    // Re-throw TenantSafetyError immediately (don't wrap it)
    if (error instanceof TenantSafetyError) {
      throw error;
    }
    
    // Re-throw if it's already our custom error (business ID required, mapping required, etc.)
    if (error instanceof Error && (error.message.includes("fallback") || error.message.includes("mapping") || error.message.includes("Business ID is required"))) {
      throw error;
    }
    
    apiLogger.error("anythingllm.scoping.get-workspace-error", {
      error: error instanceof Error ? error.message : String(error),
      businessId,
    });
    // On unexpected error, throw to let caller handle
    throw error;
  }
}

/**
 * Get or create a workspace mapping for a business
 * 
 * If mapping exists, returns it. Otherwise, creates a new mapping using
 * the provided workspaceSlug (or generates one if not provided).
 * 
 * @param businessId - The business ID
 * @param workspaceSlug - Optional workspace slug (if not provided, will be generated from businessId)
 * @returns The workspace slug
 */
export async function getOrCreateWorkspaceMapping(
  businessId: string,
  workspaceSlug?: string
): Promise<string> {
  try {
    // Try to get existing mapping
    const existing = await prisma.aiWorkspaceMap.findUnique({
      where: { businessId },
      select: { workspaceSlug: true },
    });

    if (existing) {
      return existing.workspaceSlug;
    }

    // Create new mapping
    const slug = workspaceSlug || generateWorkspaceSlug(businessId);
    await prisma.aiWorkspaceMap.create({
      data: {
        businessId,
        workspaceSlug: slug,
      },
    });

    return slug;
  } catch (error) {
    apiLogger.error("anythingllm.scoping.create-mapping-error", {
      error: error instanceof Error ? error.message : String(error),
      businessId,
      workspaceSlug,
    });
    // On error, return a fallback slug based on businessId
    return workspaceSlug || generateWorkspaceSlug(businessId);
  }
}

/**
 * Generate a workspace slug from a business ID
 * 
 * For V3, we create a simple slug from the businessId.
 * In production, this could be more sophisticated (e.g., use business name).
 * 
 * @param businessId - The business ID
 * @returns A workspace slug
 */
function generateWorkspaceSlug(businessId: string): string {
  // Simple slug generation: prefix + sanitized businessId
  // Replace any non-alphanumeric chars with hyphens and lowercase
  const sanitized = businessId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  
  return `obd-business-${sanitized}`;
}

/**
 * Get fallback workspace for testing/development
 * 
 * DEV-ONLY: In production, this will throw an error. Missing mappings must be resolved in production.
 * In development, returns a test workspace slug for testing without a mapping row.
 * 
 * @param userId - Optional user ID for personal workspace (ignored if AI_HELP_DESK_DEV_WORKSPACE_SLUG is set)
 * @returns A fallback workspace slug
 * @throws Error in production or if dev workspace slug is not configured in development
 */
export function getFallbackWorkspace(userId?: string): string {
  const isProduction = process.env.NODE_ENV === "production";

  // In production: NO fallback allowed - mappings are required
  if (isProduction) {
    throw new Error(
      "Workspace mapping is required in production. Please create a mapping in the database or use the setup wizard."
    );
  }

  // In development: Check for dev workspace slug env var
  const devWorkspaceSlug = process.env.AI_HELP_DESK_DEV_WORKSPACE_SLUG;

  if (devWorkspaceSlug && devWorkspaceSlug.trim()) {
    return devWorkspaceSlug.trim();
  }

  // Dev env var not set - throw helpful error
  throw new Error(
    `Development fallback workspace is not configured. Please set AI_HELP_DESK_DEV_WORKSPACE_SLUG environment variable in your .env.local file, or create a mapping in the database.\n\nExample: AI_HELP_DESK_DEV_WORKSPACE_SLUG=your-test-workspace-slug`
  );
}

