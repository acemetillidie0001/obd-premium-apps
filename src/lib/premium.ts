import { auth } from "@/lib/auth";

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
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  
  return {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name || undefined,
    role: (session.user as any).role || "user",
    isPremium: (session.user as any).isPremium || false,
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

