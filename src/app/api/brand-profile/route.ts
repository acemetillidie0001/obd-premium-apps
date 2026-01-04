import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// One-time log to check database URL (logs on module load/cold start)
const db = process.env.DATABASE_URL || "";
const safe = db.replace(/\/\/.*?:.*?@/, "//***:***@");
console.log("[db-check] DATABASE_URL=", safe);

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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

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
  const requestId = randomUUID();
  
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, requestId, message: "Invalid JSON" }, { status: 400 });
    }
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          requestId,
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
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

    // Upsert brand profile
    const profile = await prisma.brandProfile.upsert({
      where: { userId },
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
    console.error("[brand-kit-save]", { requestId, error });

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
        code: error.code,
        meta: error.meta,
        message: error.message,
      });

      // Handle specific Prisma error codes
      if (error.code === "P2002") {
        // Unique constraint violation
        return NextResponse.json(
          {
            ok: false,
            requestId,
            message: "A profile with this information already exists.",
            code: "UNIQUE_CONSTRAINT_ERROR",
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

      // Generic Prisma error - log full error details for debugging
      const errorDetails = {
        code: error.code || "UNKNOWN",
        message: error.message,
        meta: error.meta,
        name: error.name,
      };
      console.error("[brand-kit-save] Prisma error details:", {
        requestId,
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

