import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export type UserRole = "user" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isPremium: boolean;
}

export type PremiumCheckResult = 
  | { ok: true; isPremium: boolean }
  | { ok: false; error: "UNAVAILABLE" | "UNAUTHORIZED"; message: string };

/**
 * Get the current user's session with premium status
 * 
 * Handles DB failures gracefully - does not treat DB unavailable as "not premium"
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const session = (await auth()) as Session | null;
    if (!session?.user) {
      return null;
    }
    
    const user = session.user as Session["user"] & {
      role?: string;
      isPremium?: boolean;
    };
    
    return {
      id: user.id,
      email: user.email!,
      name: user.name || undefined,
      role: ("role" in user && typeof user.role === "string" ? user.role : "user") as UserRole,
      isPremium: ("isPremium" in user && typeof user.isPremium === "boolean" ? user.isPremium : false),
    };
  } catch (error) {
    // If auth fails (e.g., DB unavailable), return null (not logged in)
    // Don't log the full error to avoid exposing internal details
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("database") || errorMessage.includes("connection") || errorMessage.includes("timeout")) {
      console.warn("[Premium] Database unavailable during auth check");
    }
    return null;
  }
}

/**
 * Check if user has premium access with DB fallback
 * 
 * Returns structured result to differentiate:
 * - "Not premium" (user exists, verified not premium)
 * - "Unable to verify" (DB unavailable, don't treat as non-premium)
 */
export async function hasPremiumAccessSafe(): Promise<PremiumCheckResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, error: "UNAUTHORIZED", message: "Not authenticated" };
    }
    
    // Admins always have premium access
    if (user.role === "admin") {
      return { ok: true, isPremium: true };
    }
    
    // If session has isPremium, use it (from DB via NextAuth)
    if (user.isPremium) {
      return { ok: true, isPremium: true };
    }
    
    // Try to verify premium status from DB (in case session is stale)
    // Identity source: User model (NextAuth user table) - see prisma/schema.prisma
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isPremium: true },
      });
      
      if (dbUser?.isPremium) {
        return { ok: true, isPremium: true };
      }
      
      // User exists, verified not premium
      return { ok: true, isPremium: false };
    } catch (dbError) {
      // DB query failed - don't treat as "not premium"
      const errorMessage = dbError instanceof Error ? dbError.message : "Unknown error";
      const isDbError = errorMessage.includes("database") || 
                       errorMessage.includes("connection") || 
                       errorMessage.includes("timeout") ||
                       errorMessage.includes("ECONNREFUSED") ||
                       errorMessage.includes("P1001");
      
      if (isDbError) {
        // Log structured error (no secrets)
        console.warn(`[Premium] Database unavailable during premium check: userId=${user.id}, errorCode=DB_UNAVAILABLE`);
        return { 
          ok: false, 
          error: "UNAVAILABLE", 
          message: "Unable to verify subscription status. Database is temporarily unavailable." 
        };
      }
      
      // Other error - log and treat as not premium (safer default)
      console.error(`[Premium] Premium check failed: userId=${user.id}, error=${errorMessage}`);
      return { ok: true, isPremium: false };
    }
  } catch (error) {
    // Auth or other error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Premium] Premium check error: ${errorMessage}`);
    return { ok: false, error: "UNAUTHORIZED", message: "Unable to verify authentication" };
  }
}

/**
 * Check if user has premium access (legacy function, maintains backward compatibility)
 * 
 * ⚠️  WARNING: This function treats DB unavailable as "not premium" for backward compatibility.
 * For new code, use hasPremiumAccessSafe() instead.
 */
export async function hasPremiumAccess(): Promise<boolean> {
  const result = await hasPremiumAccessSafe();
  if (!result.ok) {
    // For backward compatibility, treat unavailable as false
    // This maintains existing behavior but logs a warning
    if (result.error === "UNAVAILABLE") {
      console.warn("[Premium] Database unavailable - treating as non-premium for backward compatibility");
    }
    return false;
  }
  return result.isPremium;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin" || false;
}

/**
 * Check if Meta review mode is enabled
 * 
 * When enabled, allows connection testing even if premium check fails due to DB unavailability.
 * Does NOT override publishing gate (META_PUBLISHING_ENABLED still controls publishing).
 */
export function isMetaReviewMode(): boolean {
  return process.env.META_REVIEW_MODE === "true";
}

