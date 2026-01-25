import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccessSafe } from "@/lib/premium";
import { Prisma } from "@prisma/client";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import type {
  SaveSettingsRequest,
  SaveSettingsResponse,
  GetSettingsResponse,
  SocialPlatform,
  ContentPillarSettings,
  HashtagBankSettings,
  PlatformOverridesMap,
  PlatformsEnabled,
  ImageSettings,
} from "@/lib/apps/social-auto-poster/types";
import {
  isValidSocialPlatformArray,
  isValidPlatformsEnabled,
  isValidPlatformOverridesMap,
  isValidContentPillarSettings,
  isValidHashtagBankSettings,
} from "@/lib/apps/social-auto-poster/utils";

/**
 * GET /api/social-auto-poster/settings
 * 
 * Returns the user's social auto-poster settings.
 */
export async function GET() {
  try {
    const { userId } = await requireTenant();

    // Use safe premium check that distinguishes between "not premium" and "DB unavailable"
    const premiumCheck = await hasPremiumAccessSafe();
    if (!premiumCheck.ok) {
      if (premiumCheck.error === "UNAVAILABLE") {
        // DB unavailable - return 503 Service Unavailable, not 403 Forbidden
        // This prevents UI from showing "Upgrade to Premium" CTA
        return NextResponse.json(
          { error: "Subscription status temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }
      // UNAUTHORIZED - user not logged in (shouldn't reach here due to auth check above)
      return NextResponse.json(
        { error: premiumCheck.message || "Unauthorized" },
        { status: 401 }
      );
    }
    if (!premiumCheck.isPremium) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const settings = await prisma.socialAutoposterSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({ settings: null } as GetSettingsResponse);
    }

    // Validate and parse Prisma JSON fields with runtime checks
    let enabledPlatforms: SocialPlatform[];
    if (isValidSocialPlatformArray(settings.enabledPlatforms)) {
      enabledPlatforms = settings.enabledPlatforms;
    } else {
      if (settings.enabledPlatforms !== null && settings.enabledPlatforms !== undefined) {
        console.warn("[Settings GET] Invalid enabledPlatforms, using empty array");
      }
      enabledPlatforms = [];
    }

    let platformsEnabled: PlatformsEnabled | undefined;
    if (isValidPlatformsEnabled(settings.platformsEnabled)) {
      platformsEnabled = settings.platformsEnabled;
    } else {
      if (settings.platformsEnabled !== null && settings.platformsEnabled !== undefined) {
        console.warn("[Settings GET] Invalid platformsEnabled, using undefined");
      }
      platformsEnabled = undefined;
    }

    let platformOverrides: PlatformOverridesMap | undefined;
    if (isValidPlatformOverridesMap(settings.platformOverrides)) {
      platformOverrides = settings.platformOverrides;
    } else {
      if (settings.platformOverrides !== null && settings.platformOverrides !== undefined) {
        console.warn("[Settings GET] Invalid platformOverrides, using undefined");
      }
      platformOverrides = undefined;
    }

    let contentPillarSettings: ContentPillarSettings | undefined;
    if (isValidContentPillarSettings(settings.contentPillarSettings)) {
      contentPillarSettings = settings.contentPillarSettings;
    } else {
      if (settings.contentPillarSettings !== null && settings.contentPillarSettings !== undefined) {
        console.warn("[Settings GET] Invalid contentPillarSettings, using undefined");
      }
      contentPillarSettings = undefined;
    }

    let hashtagBankSettings: HashtagBankSettings | undefined;
    if (isValidHashtagBankSettings(settings.hashtagBankSettings)) {
      hashtagBankSettings = settings.hashtagBankSettings;
    } else {
      if (settings.hashtagBankSettings !== null && settings.hashtagBankSettings !== undefined) {
        console.warn("[Settings GET] Invalid hashtagBankSettings, using undefined");
      }
      hashtagBankSettings = undefined;
    }

    let imageSettings: ImageSettings | undefined;
    if (settings.imageSettings) {
      const imgSettings = settings.imageSettings as unknown;
      if (
        typeof imgSettings === "object" &&
        imgSettings !== null &&
        "enableImages" in imgSettings &&
        typeof (imgSettings as { enableImages: unknown }).enableImages === "boolean"
      ) {
        imageSettings = imgSettings as ImageSettings;
      }
    }

    // Transform Prisma model to API response format
    const response: GetSettingsResponse = {
      settings: {
        id: settings.id,
        userId: settings.userId,
        brandVoice: settings.brandVoice || undefined,
        useBrandKit: settings.useBrandKit ?? true, // Default true for backward compatibility
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
        enabledPlatforms,
        platformsEnabled,
        platformOverrides,
        contentPillarSettings,
        hashtagBankSettings,
        imageSettings,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const { userId } = await requireTenant();
    await requirePermission("SOCIAL_AUTO_POSTER", "MANAGE_SETTINGS");

    // Use safe premium check that distinguishes between "not premium" and "DB unavailable"
    const premiumCheck = await hasPremiumAccessSafe();
    if (!premiumCheck.ok) {
      if (premiumCheck.error === "UNAVAILABLE") {
        // DB unavailable - return 503 Service Unavailable, not 403 Forbidden
        // This prevents UI from showing "Upgrade to Premium" CTA
        return NextResponse.json(
          { error: "Subscription status temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }
      // UNAUTHORIZED - user not logged in (shouldn't reach here due to auth check above)
      return NextResponse.json(
        { error: premiumCheck.message || "Unauthorized" },
        { status: 401 }
      );
    }
    if (!premiumCheck.isPremium) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

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
        useBrandKit: body.useBrandKit ?? true, // Default true for backward compatibility
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
        imageSettings: body.imageSettings ? (body.imageSettings as unknown as Prisma.InputJsonValue) : undefined,
      },
      update: {
        brandVoice: body.brandVoice || null,
        useBrandKit: body.useBrandKit ?? true, // Default true for backward compatibility
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
        imageSettings: body.imageSettings ? (body.imageSettings as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    // Validate and parse Prisma JSON fields with runtime checks
    let responseEnabledPlatforms: SocialPlatform[];
    if (isValidSocialPlatformArray(settings.enabledPlatforms)) {
      responseEnabledPlatforms = settings.enabledPlatforms;
    } else {
      if (settings.enabledPlatforms !== null && settings.enabledPlatforms !== undefined) {
        console.warn("[Settings POST] Invalid enabledPlatforms, using empty array");
      }
      responseEnabledPlatforms = [];
    }

    let responsePlatformsEnabled: PlatformsEnabled | undefined;
    if (isValidPlatformsEnabled(settings.platformsEnabled)) {
      responsePlatformsEnabled = settings.platformsEnabled;
    } else {
      if (settings.platformsEnabled !== null && settings.platformsEnabled !== undefined) {
        console.warn("[Settings POST] Invalid platformsEnabled, using undefined");
      }
      responsePlatformsEnabled = undefined;
    }

    let responsePlatformOverrides: PlatformOverridesMap | undefined;
    if (isValidPlatformOverridesMap(settings.platformOverrides)) {
      responsePlatformOverrides = settings.platformOverrides;
    } else {
      if (settings.platformOverrides !== null && settings.platformOverrides !== undefined) {
        console.warn("[Settings POST] Invalid platformOverrides, using undefined");
      }
      responsePlatformOverrides = undefined;
    }

    let responseContentPillarSettings: ContentPillarSettings | undefined;
    if (isValidContentPillarSettings(settings.contentPillarSettings)) {
      responseContentPillarSettings = settings.contentPillarSettings;
    } else {
      if (settings.contentPillarSettings !== null && settings.contentPillarSettings !== undefined) {
        console.warn("[Settings POST] Invalid contentPillarSettings, using undefined");
      }
      responseContentPillarSettings = undefined;
    }

    let responseHashtagBankSettings: HashtagBankSettings | undefined;
    if (isValidHashtagBankSettings(settings.hashtagBankSettings)) {
      responseHashtagBankSettings = settings.hashtagBankSettings;
    } else {
      if (settings.hashtagBankSettings !== null && settings.hashtagBankSettings !== undefined) {
        console.warn("[Settings POST] Invalid hashtagBankSettings, using undefined");
      }
      responseHashtagBankSettings = undefined;
    }

    let responseImageSettings: ImageSettings | undefined;
    if (settings.imageSettings) {
      const imgSettings = settings.imageSettings as unknown;
      if (
        typeof imgSettings === "object" &&
        imgSettings !== null &&
        "enableImages" in imgSettings &&
        typeof (imgSettings as { enableImages: unknown }).enableImages === "boolean"
      ) {
        responseImageSettings = imgSettings as ImageSettings;
      }
    }

    const response: SaveSettingsResponse = {
      settings: {
        id: settings.id,
        userId: settings.userId,
        brandVoice: settings.brandVoice || undefined,
        useBrandKit: settings.useBrandKit ?? true, // Default true for backward compatibility
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
        enabledPlatforms: responseEnabledPlatforms,
        platformsEnabled: responsePlatformsEnabled,
        platformOverrides: responsePlatformOverrides,
        contentPillarSettings: responseContentPillarSettings,
        hashtagBankSettings: responseHashtagBankSettings,
        imageSettings: responseImageSettings,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error saving social auto-poster settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}

