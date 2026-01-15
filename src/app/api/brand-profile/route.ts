import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth/requireUserSession";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Validation schema for section-based PUT request
const SectionSaveSchema = z.object({
  sectionKey: z.string(),
  sectionValue: z.unknown(),
});

// Validation schema for full PUT request (legacy support)
const BrandProfileUpdateSchema = z.object({
  // Business Basics
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  // Brand Direction
  brandPersonality: z
    .enum([
      "Friendly",
      "Professional",
      "Bold",
      "High-Energy",
      "Luxury",
      "Trustworthy",
      "Playful",
    ])
    .optional(),
  targetAudience: z.string().optional(),
  differentiators: z.string().optional(),
  inspirationBrands: z.string().optional(),
  avoidStyles: z.string().optional(),

  // Voice & Language
  brandVoice: z.string().optional(),
  toneNotes: z.string().optional(),
  language: z.enum(["English", "Spanish", "Bilingual"]).optional(),

  // Output Controls
  industryKeywords: z.string().optional(),
  vibeKeywords: z.string().optional(),
  variationMode: z.enum(["Conservative", "Moderate", "Bold"]).optional(),
  includeHashtags: z.boolean().optional(),
  hashtagStyle: z.enum(["Local", "Branded", "Minimal"]).optional(),

  // Extras toggles
  includeSocialPostTemplates: z.boolean().optional(),
  includeFAQStarter: z.boolean().optional(),
  includeGBPDescription: z.boolean().optional(),
  includeMetaDescription: z.boolean().optional(),

  // JSON fields (optional, will be validated as objects)
  colorsJson: z.unknown().optional(),
  typographyJson: z.unknown().optional(),
  messagingJson: z.unknown().optional(),
  kitJson: z.unknown().optional(), // Full BrandKitBuilderResponse snapshot
});

export async function GET() {
  const requestId = randomUUID();

  try {
    // Authentication check
    const session = await requireUserSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, requestId, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // From here on, session is guaranteed to exist
    const userId = session.userId;

    // Fetch brand profile for user
    const profile = await prisma.brandProfile.findUnique({
      where: { userId },
    });

    // Return null if no profile exists (not an error)
    return NextResponse.json(profile);
  } catch (error) {
    console.error(`[Brand Profile API] GET error [${requestId}]:`, error);
    return NextResponse.json(
      {
        ok: false,
        requestId,
        message: "Failed to fetch brand profile",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const requestId = randomUUID();
  let userId: string | null = null;
  
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, requestId, message: "Invalid JSON" }, { status: 400 });
    }

    // Safety: Ignore userId field from request payload to prevent overrides
    if (body && typeof body === "object") {
      delete body.userId;
    }

    // Authentication check
    const session = await requireUserSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, requestId, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // From here on, session is guaranteed to exist
    userId = session.userId;
    
    // Prisma schema requires User.email (string). Session may not have it.
    // If we don't have an email, we cannot safely create the User row.
    if (!session.email) {
      return NextResponse.json(
        { ok: false, requestId, message: "Missing email for authenticated user" },
        { status: 400 }
      );
    }
    
    const email = session.email; // TypeScript now knows this is string
    const name = session.name;   // string | null is fine if name is optional/nullable in schema
    
    // Ensure the User row exists (upsert by id) before brandProfile.upsert to prevent FK (P2003)
    // Note: Do not update email (unique constraint) - only update non-unique fields like name
    // First check if User exists by id
    let user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      // User doesn't exist - try to create it
      // If email is already taken (P2002), this is a data inconsistency (user authenticated but User doesn't exist)
      // In this case, we can't create the User, so we'll fail the request
      try {
        user = await prisma.user.create({
          data: {
            id: userId,
            email, // required, always present
            ...(name !== null ? { name } : {}),
          },
        });
      } catch (error) {
        // Handle P2002 unique constraint violation on email
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          // Check if this is a User model email constraint violation
          const isUserModel = error.meta?.modelName === "User";
          const target = error.meta?.target as string[] | undefined;
          const constraintFields = (error.meta?.constraint as { fields?: string[] } | undefined)?.fields;
          const isEmailConstraint = 
            (target && Array.isArray(target) && target.includes("email")) ||
            (constraintFields && Array.isArray(constraintFields) && constraintFields.includes("email")) ||
            (error.message && error.message.includes("email"));
          
          if (isUserModel && isEmailConstraint) {
            // Data inconsistency: User with this email exists but different id
            // This shouldn't happen if authentication is working correctly
            // Log and return error
            console.error("[brand-kit-save] Data inconsistency: User email exists but different id:", {
              requestId,
              sessionUserId: userId,
              email,
            });
            return NextResponse.json(
              {
                ok: false,
                requestId,
                message: "User account data inconsistency. Please sign out and sign in again.",
                code: "DATA_INCONSISTENCY_ERROR",
              },
              { status: 400 }
            );
          }
        }
        throw error; // Re-throw other errors
      }
    } else {
      // User exists - update name if provided (don't update email due to unique constraint)
      if (name !== null && user.name !== name) {
        await prisma.user.update({
          where: { id: userId },
          data: { name },
        });
      }
    }
    
    // Prepare data for upsert
    const updateData: {
      businessName?: string | null;
      businessType?: string | null;
      city?: string | null;
      state?: string | null;
      brandPersonality?: string | null;
      targetAudience?: string | null;
      differentiators?: string | null;
      inspirationBrands?: string | null;
      avoidStyles?: string | null;
      brandVoice?: string | null;
      toneNotes?: string | null;
      language?: string | null;
      industryKeywords?: string | null;
      vibeKeywords?: string | null;
      variationMode?: string | null;
      includeHashtags?: boolean;
      hashtagStyle?: string | null;
      includeSocialPostTemplates?: boolean;
      includeFAQStarter?: boolean;
      includeGBPDescription?: boolean;
      includeMetaDescription?: boolean;
      colorsJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      typographyJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      messagingJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      kitJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    } = {};

    // Check if this is a section-based save
    const sectionSave = SectionSaveSchema.safeParse(body);
    if (!sectionSave.success) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: "Invalid section save payload",
          details: sectionSave.error.issues,
        },
        { status: 400 }
      );
    }
    
    // Handle section-based save
    const { sectionKey, sectionValue } = sectionSave.data;
    
    // Map sectionKey to updateData
    const validSectionKeys = [
      "businessName", "businessType", "city", "state",
      "brandPersonality", "targetAudience", "differentiators", "inspirationBrands", "avoidStyles",
      "brandVoice", "toneNotes", "language",
      "industryKeywords", "vibeKeywords", "variationMode", "includeHashtags", "hashtagStyle",
      "includeSocialPostTemplates", "includeFAQStarter", "includeGBPDescription", "includeMetaDescription",
      "colorsJson", "typographyJson", "messagingJson", "kitJson"
    ];
    
    if (!validSectionKeys.includes(sectionKey)) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: `Unknown sectionKey: ${sectionKey}`,
        },
        { status: 400 }
      );
    }

    // Map sectionValue to the appropriate field
    const stringFields = ["businessName", "businessType", "city", "state", "brandPersonality", 
      "targetAudience", "differentiators", "inspirationBrands", "avoidStyles", "brandVoice", 
      "toneNotes", "language", "industryKeywords", "vibeKeywords", "variationMode", "hashtagStyle"];
    const booleanFields = ["includeHashtags", "includeSocialPostTemplates", "includeFAQStarter", 
      "includeGBPDescription", "includeMetaDescription"];
    const jsonFields = ["colorsJson", "typographyJson", "messagingJson", "kitJson"];
    
    if (stringFields.includes(sectionKey)) {
      // Handle string values - convert to string, trim, or set to null if empty
      if (typeof sectionValue === "string") {
        const trimmed = sectionValue.trim();
        (updateData as Record<string, unknown>)[sectionKey] = trimmed || null;
      } else if (sectionValue === null || sectionValue === undefined) {
        (updateData as Record<string, unknown>)[sectionKey] = null;
      } else {
        // Convert non-string values to string
        (updateData as Record<string, unknown>)[sectionKey] = String(sectionValue) || null;
      }
    } else if (booleanFields.includes(sectionKey)) {
      (updateData as Record<string, unknown>)[sectionKey] = Boolean(sectionValue);
    } else if (jsonFields.includes(sectionKey)) {
      (updateData as Record<string, unknown>)[sectionKey] = sectionValue
        ? (sectionValue as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    // Idempotent write: upsert brand profile using unique key (userId)
    // This ensures the operation is safe to retry and won't throw UNIQUE_CONSTRAINT_ERROR
    const profile = await prisma.brandProfile.upsert({
      where: { userId: userId },
      create: {
        userId,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error) {
    console.error("[brand-kit-save]", { requestId, userId: userId ?? "unknown", error });

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: "Invalid request data. Please check your input and try again.",
          code: "VALIDATION_ERROR",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[brand-kit-save] Prisma error:", {
        requestId,
        userId: userId ?? "unknown",
        code: error.code,
        meta: error.meta,
        message: error.message,
      });

      // Handle specific Prisma error codes
      if (error.code === "P2002") {
        // Unique constraint violation
        const target = error.meta?.target as string[] | undefined;
        const targetField = target ? target.join(", ") : "unknown";
        
        console.error("[brand-kit-save] Unique constraint violation:", {
          requestId,
          userId: userId ?? "unknown",
          target: targetField,
          meta: error.meta,
        });
        
        return NextResponse.json(
          {
            ok: false,
            requestId,
            message: "A profile with this information already exists.",
            code: "UNIQUE_CONSTRAINT_ERROR",
            target: targetField,
          },
          { status: 409 }
        );
      }

      if (error.code === "P2025") {
        // Record not found
        return NextResponse.json(
          {
            ok: false,
            requestId,
            message: "Record not found.",
            code: "NOT_FOUND_ERROR",
          },
          { status: 404 }
        );
      }

      if (error.code === "P2003") {
        // Foreign key constraint violation
        console.error("[brand-kit-save] Foreign key constraint violation:", {
          requestId,
          userId: userId ?? "unknown",
          constraint: error.meta?.constraint,
        });
        return NextResponse.json(
          {
            ok: false,
            requestId,
            message: "User account not found. Please sign out and sign in again.",
            code: "FOREIGN_KEY_ERROR",
          },
          { status: 400 }
        );
      }

      // Generic Prisma error - log full error details for debugging
      const errorDetails = {
        code: error.code || "UNKNOWN",
        message: error.message,
        meta: error.meta,
        name: error.name,
      };
      console.error("[brand-kit-save] Prisma error details:", {
        requestId,
        userId: userId ?? "unknown",
        ...errorDetails,
      });

      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: "Database error occurred. Please try again.",
          code: "DATABASE_ERROR",
          // Include error code in response for debugging (safe to expose)
          errorCode: error.code || undefined,
        },
        { status: 500 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("[brand-kit-save] Prisma validation error:", {
        requestId,
        message: error.message,
      });
      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: "Invalid data format. Please check your input and try again.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[brand-kit-save] Unexpected error:", {
      requestId,
      errorMessage,
      errorType: error?.constructor?.name,
    });

    return NextResponse.json(
      {
        ok: false,
        requestId,
        message: "Save failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

