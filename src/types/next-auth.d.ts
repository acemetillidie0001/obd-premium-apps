import NextAuth, { DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role: "user" | "admin";
      isPremium: boolean;
    };
  }

  interface User {
    id: string;
    role: "user" | "admin";
    isPremium: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "user" | "admin";
    isPremium?: boolean;
  }
}

export {};
