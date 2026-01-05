import "server-only";

import { auth } from "@/lib/auth";

/**
 * User session data returned by requireUserSession
 */
export interface UserSession {
  userId: string;
  email: string | null;
  name: string | null;
}

/**
 * Requires a valid user session from NextAuth v5.
 * 
 * @returns {Promise<UserSession | null>} User session data if authenticated, null otherwise
 * 
 * @example
 * ```ts
 * const session = await requireUserSession();
 * if (!session) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * const { userId, email, name } = session;
 * ```
 */
export async function requireUserSession(): Promise<UserSession | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

