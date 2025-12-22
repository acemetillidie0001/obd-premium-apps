import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { env } from "@/lib/env";
import type { NextAuthConfig } from "next-auth";
import type { PrismaClient } from "@prisma/client";

// Validate environment variables on module load
// This ensures we fail fast if required env vars are missing
env;

// Lazy-load Prisma adapter to avoid importing Node.js modules in Edge Runtime
// Only needed for database sessions, but we're using JWT strategy
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

export const authConfig = {
  adapter: getAdapter() as any,
  providers: [
    Email({
      from: env.EMAIL_FROM,
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: env.RESEND_API_KEY,
        },
      },
      sendVerificationRequest: async ({ identifier, url }) => {
        const { Resend } = await import("resend");
        const resend = new Resend(env.RESEND_API_KEY);

        try {
          await resend.emails.send({
            from: env.EMAIL_FROM,
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
        } catch (error) {
          console.error("Error sending email:", error);
          throw new Error("Failed to send verification email");
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
        token.role = (user as any).role || "user";
        token.isPremium = (user as any).isPremium || false;
      }
      
      // Refresh user data on session update
      if (trigger === "update") {
        // Lazy-load Prisma only when needed (not in Edge Runtime)
        try {
          const prismaModule = await import("@/lib/prisma");
          const prisma = prismaModule.prisma as any; // Use 'any' to bypass TS type checking for dynamic import
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          if (dbUser) {
            token.role = (dbUser.role === "admin" ? "admin" : "user") as "user" | "admin";
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
        session.user.id = token.id as string;
        session.user.role = token.role as "user" | "admin";
        session.user.isPremium = token.isPremium as boolean;
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
  secret: env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

