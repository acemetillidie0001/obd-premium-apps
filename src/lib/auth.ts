/**
 * ⚠️ AUTH IS STABLE AND FROZEN ⚠️
 * 
 * DO NOT MODIFY THIS FILE unless you are intentionally changing login behavior.
 * 
 * If login breaks, check:
 * - /api/health/auth endpoint for configuration status
 * - Server logs for [AUTH] lines to see email delivery method
 * 
 * Auth configuration is critical infrastructure - changes here affect all users.
 */

import "server-only";

import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import type { NextAuthConfig } from "next-auth";

// Environment variable helpers supporting both NextAuth v5 (AUTH_*) and legacy (NEXTAUTH_*) naming
const getAuthSecret = (): string => {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
};

const getAuthUrl = (): string => {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
};

const getTrustHost = (): boolean => {
  if (process.env.AUTH_TRUST_HOST === "true") return true;
  if (process.env.AUTH_TRUST_HOST === "false") return false;
  // Default to true for Vercel/production
  return true;
};

// Access env vars directly (works in Edge Runtime)
// Access them lazily inside functions, not at module load
const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// Validate required environment variables on server startup
// This runs when the module is imported in Node.js runtime (not Edge Runtime)
function validateAuthEnv() {
  // Skip validation during build/static generation
  const isBuildTime = process.env.NEXT_PHASE === "phase-production-build" ||
                      process.env.NEXT_PHASE === "phase-development-build" ||
                      (typeof window === "undefined" && !process.env.DATABASE_URL);

  if (isBuildTime) {
    return; // Skip validation during build
  }

  // Only validate in Node.js runtime (not Edge Runtime)
  // Edge Runtime doesn't have access to process.env in the same way
  if (process.env.NEXT_RUNTIME === "edge") {
    return; // Skip validation in Edge Runtime
  }

  const missing: string[] = [];

  // Check auth secret (supports both naming conventions)
  const authSecret = getAuthSecret();
  if (!authSecret || authSecret === "fallback-secret-for-build") {
    missing.push("AUTH_SECRET or NEXTAUTH_SECRET");
  }

  // Check auth URL (supports both naming conventions)
  const authUrl = getAuthUrl();
  if (!authUrl) {
    missing.push("AUTH_URL or NEXTAUTH_URL");
  }

  // Skip email config validation in development (we'll log magic links instead)
  const isDevMode = process.env.NODE_ENV === "development";
  
  if (!isDevMode) {
    // Check Resend API key (only required in production)
    if (!process.env.RESEND_API_KEY) {
      missing.push("RESEND_API_KEY");
    }

    // Check email from (only required in production)
    if (!process.env.EMAIL_FROM) {
      missing.push("EMAIL_FROM");
    }
  }

  // Check database URL
  if (!process.env.DATABASE_URL) {
    missing.push("DATABASE_URL");
  }

  if (missing.length > 0) {
    const errorMessage = `
❌ Missing required environment variables:

${missing.map((key) => `  - ${key}`).join("\n")}

Please set these variables in:
  - .env.local (for local development)
  - Vercel Project Settings → Environment Variables (for production)

See ENV_VARS_CHECKLIST.md for detailed instructions.
    `.trim();

    throw new Error(errorMessage);
  }
}

// Run validation on module load (only in Node.js runtime, not during build)
// Don't throw during module load - it prevents NextAuth from initializing
// In development, skip validation entirely to allow dev mode email logging
const isDevMode = process.env.NODE_ENV === "development";
if (!isDevMode) {
  try {
    validateAuthEnv();
  } catch (error) {
    // Log error but don't throw - NextAuth will handle missing config gracefully
    console.error("[NextAuth] Environment validation failed:", error instanceof Error ? error.message : String(error));
    console.warn("[NextAuth] Continuing with fallback values - this may cause Configuration errors");
  }
} else {
  console.log("[NextAuth] Development mode: Email validation skipped, magic links will be logged to console");
}

// Log email delivery method at startup (invariant check)
const hasResendKey = !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "placeholder_resend_key_please_update";
const hasEmailFrom = !!process.env.EMAIL_FROM && process.env.EMAIL_FROM !== "noreply@example.com";
if (hasResendKey && hasEmailFrom) {
  console.log("[AUTH] Email delivery: RESEND (enabled)");
} else {
  console.warn("[AUTH WARNING] Email delivery disabled — console fallback active");
}

// Get email from address with validation
// Handles formats like "Display Name <email@domain.com>" or just "email@domain.com"
const getEmailFrom = (): string => {
  const emailFrom = process.env.EMAIL_FROM;
  const isDevelopment = process.env.NODE_ENV === "development";
  
  // In development, we don't actually send emails, so a placeholder is fine
  if (!emailFrom) {
    const isBuildTime = process.env.NEXT_PHASE === "phase-production-build" ||
                        process.env.NEXT_PHASE === "phase-development-build";
    if (isBuildTime || isDevelopment) {
      return "noreply@example.com"; // Fallback for build/dev
    }
    // At runtime in production, log warning but return fallback to prevent NextAuth initialization failure
    console.warn("[NextAuth] EMAIL_FROM not set, using fallback. Email sending will fail.");
    return "noreply@example.com"; // Fallback to prevent config error
  }
  
  // Extract email from "Display Name <email@domain.com>" format if present
  let extractedEmail = emailFrom;
  const emailMatch = emailFrom.match(/<([^>]+)>/);
  if (emailMatch) {
    extractedEmail = emailMatch[1].trim();
  }
  
  // Validate email format
  if (!extractedEmail.includes("@")) {
    console.error("[NextAuth] EMAIL_FROM is not a valid email address:", emailFrom);
    return "noreply@example.com"; // Fallback
  }
  
  return extractedEmail;
};

export const authConfig = {
  // NextAuth v5 Email provider REQUIRES an adapter
  // Use static import - PrismaAdapter(prisma) wired directly
  // Type assertion needed due to NextAuth v5 beta type compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Email({
      from: process.env.NODE_ENV === "development" ? "noreply@localhost" : getEmailFrom(),
      // Normalize email identifier to prevent AdapterError with undefined
      // This ensures the email is always valid before it reaches the adapter
      normalizeIdentifier: (identifier: string) => {
        if (!identifier || typeof identifier !== "string") {
          throw new Error("Email identifier is required and must be a string");
        }
        // Trim and lowercase the email
        const normalized = identifier.trim().toLowerCase();
        // Validate email format: must have @ and characters before and after @
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!normalized || !emailRegex.test(normalized)) {
          throw new Error("Invalid email format");
        }
        return normalized;
      },
      // NextAuth v5 requires server config even when using sendVerificationRequest
      // This config is validated but not used when sendVerificationRequest is provided
      // Provide minimal valid config to satisfy NextAuth validation
      // In development, use dummy values (won't be used since we log to console)
      server: {
        host: process.env.NODE_ENV === "development" ? "localhost" : "smtp.resend.com",
        port: process.env.NODE_ENV === "development" ? 587 : 465,
        secure: process.env.NODE_ENV !== "development",
        auth: {
          user: process.env.NODE_ENV === "development" ? "dev" : "resend",
          pass: process.env.NODE_ENV === "development" ? "dev" : (process.env.RESEND_API_KEY || "dummy-placeholder"),
        },
      },
      /**
       * INVARIANT: Magic-link email delivery behavior
       * 
       * REQUIRED BEHAVIOR (DO NOT VIOLATE):
       * - If RESEND_API_KEY + EMAIL_FROM exist → magic links MUST be emailed via Resend
       * - Console magic-link logging is ONLY allowed when email delivery is NOT configured
       * - Production must NEVER log magic links to console
       * - Email delivery is the default and expected behavior
       * 
       * Any change that violates this invariant (e.g., logging to console when Resend is configured,
       * or making email delivery conditional on NODE_ENV when credentials exist) is a REGRESSION.
       */
      sendVerificationRequest: async ({ identifier, url }) => {
        if (!identifier || typeof identifier !== "string" || !identifier.includes("@")) {
          throw new Error(`Invalid email identifier: ${identifier}`);
        }
        
        // Check if Resend is configured
        const hasResendKey = !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "placeholder_resend_key_please_update";
        const hasEmailFrom = !!process.env.EMAIL_FROM && process.env.EMAIL_FROM !== "noreply@example.com";
        
        // If Resend is configured, send email (default behavior)
        if (hasResendKey && hasEmailFrom) {
          try {
            const { Resend } = await import("resend");
            const resendApiKey = process.env.RESEND_API_KEY!;
            const resend = new Resend(resendApiKey);

            await resend.emails.send({
              from: process.env.EMAIL_FROM!,
              to: identifier,
              subject: "Sign in to OBD Premium Apps",
              html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #1EB9A7 0%, #0AC8E9 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">OBD Premium Apps</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Ocala Business Directory</p>
                  </div>
                  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #050816; margin-top: 0;">Sign in to your account</h2>
                    <p style="color: #6b7280; margin-bottom: 30px;">Click the button below to securely sign in to your OBD Premium Apps account. This link will expire in 24 hours.</p>
                    <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #1EB9A7 0%, #0AC8E9 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-weight: 600; font-size: 16px; text-align: center; margin: 20px 0;">Sign In</a>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">If you didn't request this email, you can safely ignore it.</p>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">Or copy and paste this link into your browser:</p>
                    <p style="color: #6b7280; font-size: 12px; word-break: break-all; background: #f9fafb; padding: 10px; border-radius: 5px; margin-top: 5px;">${url}</p>
                  </div>
                  <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} OBD Business Suite · Ocala Business Directory</p>
                  </div>
                </body>
              </html>
            `,
            text: `Sign in to OBD Premium Apps\n\nClick this link to sign in: ${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this email, you can safely ignore it.`,
            });
          } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            const errorCode = (err as { code?: string | number } | undefined)?.code ?? null;
            console.error("[NextAuth Email] Failed to send verification email:", {
              area: "auth_email_send",
              message: error.message,
              code: errorCode,
            });
            throw err;
          }
        } else {
          // Fallback: Only log to console in development when Resend is NOT configured
          if (process.env.NODE_ENV === "development") {
            console.warn("\n" + "=".repeat(80));
            console.warn("[AUTH WARNING] Email delivery disabled — console fallback active");
            console.warn("=".repeat(80));
            console.warn("DEV MAGIC LINK: " + url);
            console.warn(`Email: ${identifier}`);
            console.warn("Copy the URL above and paste it into your browser to sign in.");
            console.warn(`Note: Email sending skipped (RESEND_API_KEY or EMAIL_FROM not configured)`);
            console.warn("=".repeat(80) + "\n");
          } else {
            throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured to send verification emails");
          }
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Set domain to parent domain for subdomain support
        // e.g., .ocalabusinessdirectory.com works for apps.ocalabusinessdirectory.com
        domain: process.env.NODE_ENV === "production" 
          ? process.env.AUTH_COOKIE_DOMAIN || undefined
          : undefined,
      },
    },
    callbackUrl: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" 
          ? process.env.AUTH_COOKIE_DOMAIN || undefined
          : undefined,
      },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // CSRF token should NOT have domain set (security best practice)
        domain: undefined,
      },
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || "user";
        token.isPremium = user.isPremium || false;
      }
      
      // Refresh user data on session update
      // Identity source: User model (NextAuth user table) - see prisma/schema.prisma
      if (trigger === "update") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
          });
          if (dbUser) {
            token.role = dbUser.role === "admin" ? "admin" : "user";
            token.isPremium = dbUser.isPremium;
          }
        } catch {
          // If database query fails, skip update
          // This is fine since we're using JWT strategy and the token already has the data
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isPremium = token.isPremium;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If redirecting to /login and user is authenticated, redirect to dashboard instead
      if (url.includes("/login")) {
        return baseUrl + "/";
      }
      // If url is relative, make it absolute
      if (url.startsWith("/")) {
        return baseUrl + url;
      }
      // If url is on same origin, allow it
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      // Default to dashboard
      return baseUrl + "/";
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname.startsWith("/login");
      const isOnUnlockPage = nextUrl.pathname.startsWith("/unlock");
      
      // Allow access to login and unlock pages
      if (isOnLoginPage || isOnUnlockPage) {
        return true;
      }
      
      // All routes (including homepage) require login
      if (!isLoggedIn) {
        return false;
      }
      
      return true;
    },
  },
  secret: getAuthSecret(),
  // Trust host for production (Vercel handles this automatically)
  // Supports AUTH_TRUST_HOST env var or defaults to true
  trustHost: getTrustHost(),
} satisfies NextAuthConfig;

// Initialize NextAuth
let nextAuthInstance: ReturnType<typeof NextAuth> | null = null;
try {
  nextAuthInstance = NextAuth(authConfig);
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[NextAuth] Initialization failed:", errorMessage);
  throw new Error(`NextAuth initialization failed: ${errorMessage}`);
}

export const { handlers, auth, signIn, signOut } = nextAuthInstance;

