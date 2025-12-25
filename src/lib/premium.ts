import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export type UserRole = "user" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isPremium: boolean;
}

/**
 * Get the current user's session with premium status
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
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
}

/**
 * Check if user has premium access
 */
export async function hasPremiumAccess(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  
  // Admins always have premium access
  if (user.role === "admin") return true;
  
  return user.isPremium;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin" || false;
}

