import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

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
  const raw = await request.text();
  console.log("[brand-kit-save]", { requestId, bytes: raw.length });

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, requestId, message: "Invalid JSON" }, { status: 400 });
  }

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
      (updateData as Record<string, unknown>)[sectionKey] = (sectionValue as string) || null;
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

    return NextResponse.json(
      {
        ok: false,
        requestId,
        message: "Save failed",
      },
      { status: 500 }
    );
  }
}

