import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  SaveSettingsRequest,
  SaveSettingsResponse,
  GetSettingsResponse,
  SocialPlatform,
  ContentPillarSettings,
  HashtagBankSettings,
  PlatformOverridesMap,
  PlatformsEnabled,
} from "@/lib/apps/social-auto-poster/types";

/**
 * GET /api/social-auto-poster/settings
 * 
 * Returns the user's social auto-poster settings.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const settings = await prisma.socialAutoposterSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({ settings: null } as GetSettingsResponse);
    }

    // Transform Prisma model to API response format
    const response: GetSettingsResponse = {
      settings: {
        id: settings.id,
        userId: settings.userId,
        brandVoice: settings.brandVoice || undefined,
        postingMode: settings.postingMode as "review" | "auto" | "campaign",
        schedulingRules: {
          frequency: settings.frequency || "daily",
          allowedDays: settings.allowedDays,
          timeWindow: {
            start: settings.timeWindowStart || "09:00",
            end: settings.timeWindowEnd || "17:00",
          },
          timezone: settings.timezone || "America/New_York",
        },
        enabledPlatforms: (settings.enabledPlatforms as SocialPlatform[]) || [],
        platformsEnabled: (settings.platformsEnabled as PlatformsEnabled | null) || undefined,
        platformOverrides: (settings.platformOverrides as PlatformOverridesMap | null) || undefined,
        contentPillarSettings: (settings.contentPillarSettings as ContentPillarSettings | null) || undefined,
        hashtagBankSettings: (settings.hashtagBankSettings as HashtagBankSettings | null) || undefined,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching social auto-poster settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social-auto-poster/settings
 * 
 * Creates or updates the user's social auto-poster settings.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body: SaveSettingsRequest = await request.json();

    // Validation
    if (!body.postingMode || !["review", "auto", "campaign"].includes(body.postingMode)) {
      return NextResponse.json(
        { error: "Invalid postingMode. Must be 'review', 'auto', or 'campaign'" },
        { status: 400 }
      );
    }

    if (!body.schedulingRules) {
      return NextResponse.json({ error: "schedulingRules is required" }, { status: 400 });
    }

    if (!body.enabledPlatforms || !Array.isArray(body.enabledPlatforms)) {
      return NextResponse.json({ error: "enabledPlatforms must be an array" }, { status: 400 });
    }

    // Validate platforms
    const validPlatforms = ["facebook", "instagram", "x", "googleBusiness"];
    for (const platform of body.enabledPlatforms) {
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json(
          { error: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate platform overrides if provided
    if (body.platformOverrides) {
      const validPlatforms: SocialPlatform[] = ["facebook", "instagram", "x", "googleBusiness"];
      for (const platform of Object.keys(body.platformOverrides) as SocialPlatform[]) {
        if (!validPlatforms.includes(platform)) {
          return NextResponse.json(
            { error: `Invalid platform in overrides: ${platform}` },
            { status: 400 }
          );
        }
        const overrides = body.platformOverrides[platform];
        if (overrides) {
          if (overrides.emojiModeOverride && !["allow", "limit", "none"].includes(overrides.emojiModeOverride)) {
            return NextResponse.json(
              { error: `Invalid emojiModeOverride for ${platform}. Must be 'allow', 'limit', or 'none'` },
              { status: 400 }
            );
          }
          if (overrides.ctaStyleOverride && !["none", "soft", "direct"].includes(overrides.ctaStyleOverride)) {
            return NextResponse.json(
              { error: `Invalid ctaStyleOverride for ${platform}. Must be 'none', 'soft', or 'direct'` },
              { status: 400 }
            );
          }
          if (overrides.hashtagLimitOverride !== undefined && (typeof overrides.hashtagLimitOverride !== "number" || overrides.hashtagLimitOverride < 0)) {
            return NextResponse.json(
              { error: `Invalid hashtagLimitOverride for ${platform}. Must be a non-negative number` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Upsert settings
    const settings = await prisma.socialAutoposterSettings.upsert({
      where: { userId },
      create: {
        userId,
        brandVoice: body.brandVoice || null,
        postingMode: body.postingMode,
        frequency: body.schedulingRules.frequency,
        allowedDays: body.schedulingRules.allowedDays,
        timeWindowStart: body.schedulingRules.timeWindow.start,
        timeWindowEnd: body.schedulingRules.timeWindow.end,
        timezone: body.schedulingRules.timezone || "America/New_York",
        enabledPlatforms: body.enabledPlatforms,
        platformsEnabled: body.platformsEnabled ? (body.platformsEnabled as unknown as Prisma.InputJsonValue) : undefined,
        platformOverrides: body.platformOverrides ? (body.platformOverrides as unknown as Prisma.InputJsonValue) : undefined,
        contentPillarSettings: body.contentPillarSettings ? (body.contentPillarSettings as unknown as Prisma.InputJsonValue) : undefined,
        hashtagBankSettings: body.hashtagBankSettings ? (body.hashtagBankSettings as unknown as Prisma.InputJsonValue) : undefined,
      },
      update: {
        brandVoice: body.brandVoice || null,
        postingMode: body.postingMode,
        frequency: body.schedulingRules.frequency,
        allowedDays: body.schedulingRules.allowedDays,
        timeWindowStart: body.schedulingRules.timeWindow.start,
        timeWindowEnd: body.schedulingRules.timeWindow.end,
        timezone: body.schedulingRules.timezone || "America/New_York",
        enabledPlatforms: body.enabledPlatforms,
        platformsEnabled: body.platformsEnabled ? (body.platformsEnabled as unknown as Prisma.InputJsonValue) : undefined,
        platformOverrides: body.platformOverrides ? (body.platformOverrides as unknown as Prisma.InputJsonValue) : undefined,
        contentPillarSettings: body.contentPillarSettings ? (body.contentPillarSettings as unknown as Prisma.InputJsonValue) : undefined,
        hashtagBankSettings: body.hashtagBankSettings ? (body.hashtagBankSettings as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    const response: SaveSettingsResponse = {
      settings: {
        id: settings.id,
        userId: settings.userId,
        brandVoice: settings.brandVoice || undefined,
        postingMode: settings.postingMode as "review" | "auto" | "campaign",
        schedulingRules: {
          frequency: settings.frequency || "daily",
          allowedDays: settings.allowedDays,
          timeWindow: {
            start: settings.timeWindowStart || "09:00",
            end: settings.timeWindowEnd || "17:00",
          },
          timezone: settings.timezone || "America/New_York",
        },
        enabledPlatforms: (settings.enabledPlatforms as SocialPlatform[]) || [],
        platformsEnabled: (settings.platformsEnabled as PlatformsEnabled | null) || undefined,
        platformOverrides: (settings.platformOverrides as PlatformOverridesMap | null) || undefined,
        contentPillarSettings: (settings.contentPillarSettings as ContentPillarSettings | null) || undefined,
        hashtagBankSettings: (settings.hashtagBankSettings as HashtagBankSettings | null) || undefined,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error saving social auto-poster settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}

