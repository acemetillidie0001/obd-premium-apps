import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Generate request ID for error tracking
function generateRequestId(): string {
  return `bp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validation schema for PUT request
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
  const requestId = generateRequestId();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Authentication required",
          requestId,
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
    console.error("[Brand Profile API] GET error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch brand profile",
        requestId,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Authentication required",
          requestId,
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const validated = BrandProfileUpdateSchema.parse(body);

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

    // Map validated fields to update data
    if (validated.businessName !== undefined)
      updateData.businessName = validated.businessName || null;
    if (validated.businessType !== undefined)
      updateData.businessType = validated.businessType || null;
    if (validated.city !== undefined) updateData.city = validated.city || null;
    if (validated.state !== undefined)
      updateData.state = validated.state || null;
    if (validated.brandPersonality !== undefined)
      updateData.brandPersonality = validated.brandPersonality || null;
    if (validated.targetAudience !== undefined)
      updateData.targetAudience = validated.targetAudience || null;
    if (validated.differentiators !== undefined)
      updateData.differentiators = validated.differentiators || null;
    if (validated.inspirationBrands !== undefined)
      updateData.inspirationBrands = validated.inspirationBrands || null;
    if (validated.avoidStyles !== undefined)
      updateData.avoidStyles = validated.avoidStyles || null;
    if (validated.brandVoice !== undefined)
      updateData.brandVoice = validated.brandVoice || null;
    if (validated.toneNotes !== undefined)
      updateData.toneNotes = validated.toneNotes || null;
    if (validated.language !== undefined)
      updateData.language = validated.language || null;
    if (validated.industryKeywords !== undefined)
      updateData.industryKeywords = validated.industryKeywords || null;
    if (validated.vibeKeywords !== undefined)
      updateData.vibeKeywords = validated.vibeKeywords || null;
    if (validated.variationMode !== undefined)
      updateData.variationMode = validated.variationMode || null;
    if (validated.includeHashtags !== undefined)
      updateData.includeHashtags = validated.includeHashtags;
    if (validated.hashtagStyle !== undefined)
      updateData.hashtagStyle = validated.hashtagStyle || null;
    if (validated.includeSocialPostTemplates !== undefined)
      updateData.includeSocialPostTemplates =
        validated.includeSocialPostTemplates;
    if (validated.includeFAQStarter !== undefined)
      updateData.includeFAQStarter = validated.includeFAQStarter;
    if (validated.includeGBPDescription !== undefined)
      updateData.includeGBPDescription = validated.includeGBPDescription;
    if (validated.includeMetaDescription !== undefined)
      updateData.includeMetaDescription = validated.includeMetaDescription;
    if (validated.colorsJson !== undefined)
      updateData.colorsJson = validated.colorsJson
        ? (validated.colorsJson as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    if (validated.typographyJson !== undefined)
      updateData.typographyJson = validated.typographyJson
        ? (validated.typographyJson as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    if (validated.messagingJson !== undefined)
      updateData.messagingJson = validated.messagingJson
        ? (validated.messagingJson as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    if (validated.kitJson !== undefined)
      updateData.kitJson = validated.kitJson
        ? (validated.kitJson as Prisma.InputJsonValue)
        : Prisma.JsonNull;

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
      success: true,
      profile,
      requestId,
    });
  } catch (error) {
    console.error("[Brand Profile API] PUT error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const isDev = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request data. Please check your input and try again.",
          ...(isDev ? { details: error.issues } : {}),
          requestId,
        },
        { status: 400 }
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to save brand profile. Please try again.",
        requestId,
        ...(isDev && error instanceof Error
          ? { details: { message: error.message, stack: error.stack } }
          : {}),
      },
      { status: 500 }
    );
  }
}

