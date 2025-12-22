import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import type { NextAuthConfig } from "next-auth";
import type { PrismaClient } from "@prisma/client";

// Lazy-load Prisma adapter to avoid importing Node.js modules in Edge Runtime
// Only needed for database sessions, but we're using JWT strategy
// Set to undefined - NextAuth will work fine without it for JWT strategy
let adapter: any = undefined;

function getAdapter() {
  if (adapter !== undefined) return adapter;
  
  try {
    // Try to load Prisma adapter (will fail in Edge Runtime, which is fine)
    const { PrismaAdapter } = require("@auth/prisma-adapter");
    const { prisma } = require("@/lib/prisma");
    adapter = PrismaAdapter(prisma);
    return adapter;
  } catch (error) {
    // In Edge Runtime, Prisma can't be loaded (uses Node.js 'stream' module)
    // This is fine since we're using JWT strategy and don't need database sessions
    adapter = null;
    return null;
  }
}

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

  // Check Resend API key
  if (!process.env.RESEND_API_KEY) {
    missing.push("RESEND_API_KEY");
  }

  // Check email from
  if (!process.env.EMAIL_FROM) {
    missing.push("EMAIL_FROM");
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
// Instead, log warnings and let NextAuth handle the error
try {
  validateAuthEnv();
} catch (error) {
  // Log error but don't throw - NextAuth will handle missing config gracefully
  console.error("[NextAuth] Environment validation failed:", error instanceof Error ? error.message : String(error));
  console.warn("[NextAuth] Continuing with fallback values - this may cause Configuration errors");
}

// Get email from address with validation
const getEmailFrom = (): string => {
  const emailFrom = process.env.EMAIL_FROM;
  // Allow fallback during build, but validate at runtime
  if (!emailFrom) {
    const isBuildTime = process.env.NEXT_PHASE === "phase-production-build" ||
                        process.env.NEXT_PHASE === "phase-development-build";
    if (isBuildTime) {
      return "noreply@example.com"; // Fallback for build only
    }
    // At runtime, this will be caught by validateAuthEnv or email sending will fail
    return "noreply@example.com"; // Temporary fallback
  }
  return emailFrom;
};

export const authConfig = {
  adapter: undefined, // Don't call getAdapter() at module load - causes Edge Runtime issues
  providers: [
    Email({
      from: getEmailFrom(),
      // NextAuth v5 requires server config even when using sendVerificationRequest
      // This config is validated but not used when sendVerificationRequest is provided
      // We provide minimal valid config to satisfy NextAuth validation
      server: {
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY || "dummy-placeholder",
        },
      },
      sendVerificationRequest: async ({ identifier, url }) => {
        // Log which email provider is active (for debugging in Vercel logs)
        console.log("[NextAuth Email] Using Resend SDK for email delivery");
        const emailFrom = process.env.EMAIL_FROM;
        console.log("[NextAuth Email] From address:", emailFrom ? `${emailFrom.substring(0, 3)}***@${emailFrom.split("@")[1]}` : "NOT SET");
        console.log("[NextAuth Email] Resend API key:", process.env.RESEND_API_KEY ? "SET" : "NOT SET");
        
        const { Resend } = await import("resend");
        const resendApiKey = getEnvVar("RESEND_API_KEY"); // Validate when actually sending email
        const resend = new Resend(resendApiKey);

        try {
          await resend.emails.send({
            from: getEnvVar("EMAIL_FROM"), // Validate when actually sending email
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
          console.log("[NextAuth Email] Verification email sent successfully to:", identifier);
        } catch (error) {
          console.error("[NextAuth Email] Error sending email via Resend:", error);
          // Provide more specific error message for debugging
          if (error instanceof Error) {
            console.error("[NextAuth Email] Error details:", error.message);
          }
          throw new Error(`Failed to send verification email: ${error instanceof Error ? error.message : "Unknown error"}`);
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
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || "user";
        token.isPremium = user.isPremium || false;
      }
      
      // Refresh user data on session update
      if (trigger === "update") {
        // Lazy-load Prisma only when needed (not in Edge Runtime)
        try {
          const prismaModule = await import("@/lib/prisma");
          const prisma = prismaModule.prisma as any; // Dynamic import requires type assertion
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
          });
          if (dbUser) {
            token.role = dbUser.role === "admin" ? "admin" : "user";
            token.isPremium = dbUser.isPremium;
          }
        } catch (error) {
          // If Prisma can't be loaded (e.g., in Edge Runtime), skip database update
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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname.startsWith("/login");
      const isOnUnlockPage = nextUrl.pathname.startsWith("/unlock");
      
      // Allow access to login and unlock pages
      if (isOnLoginPage || isOnUnlockPage) {
        return true;
      }
      
      // Dashboard is public
      if (nextUrl.pathname === "/") {
        return true;
      }
      
      // All other routes require login
      if (!isLoggedIn) {
        return false;
      }
      
      return true;
    },
  },
  secret: (() => {
    const secret = getAuthSecret();
    const isBuildTime = process.env.NEXT_PHASE === "phase-production-build" ||
                        process.env.NEXT_PHASE === "phase-development-build";
    
    // Allow fallback only during build
    if (isBuildTime) {
      return secret || "fallback-secret-for-build";
    }
    
    // At runtime, return the secret (even if empty)
    // NextAuth will throw Configuration error if it's invalid, which is better than crashing module load
    if (!secret || secret === "fallback-secret-for-build") {
      console.error("[NextAuth] AUTH_SECRET or NEXTAUTH_SECRET is missing or invalid. NextAuth will show Configuration error.");
      // Return empty string - NextAuth will reject it and show Configuration error
      return "";
    }
    
    return secret;
  })(),
  // Trust host for production (Vercel handles this automatically)
  // Supports AUTH_TRUST_HOST env var or defaults to true
  trustHost: getTrustHost(),
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

