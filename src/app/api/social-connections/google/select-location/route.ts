import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { listBusinessLocations } from "@/lib/apps/social-auto-poster/publishers/googleBusinessPublisher";

/**
 * POST /api/social-connections/google/select-location
 * 
 * Updates the selected Google Business Profile location for the current user.
 * Accepts { locationId } in request body.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const body = await request.json().catch(() => ({}));
    const locationId = body.locationId as string | undefined;

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    // Get Google connection to fetch locations
    const googleConnection = await prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: "google_business",
      },
    });

    if (!googleConnection) {
      return NextResponse.json(
        { error: "Google Business Profile not connected" },
        { status: 404 }
      );
    }

    // Fetch locations to validate locationId and get display name
    const locationsResult = await listBusinessLocations({
      accessToken: googleConnection.accessToken,
      refreshToken: googleConnection.refreshToken,
      tokenExpiresAt: googleConnection.tokenExpiresAt,
    });

    if (!locationsResult.ok || !locationsResult.locations) {
      return NextResponse.json(
        { error: locationsResult.errorMessage || "Failed to fetch locations" },
        { status: 500 }
      );
    }

    const selectedLocation = locationsResult.locations.find((loc) => loc.id === locationId);
    if (!selectedLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Update destination selection
    await prisma.socialPostingDestination.upsert({
      where: {
        userId_platform: {
          userId,
          platform: "google_business",
        },
      },
      create: {
        userId,
        platform: "google_business",
        selectedAccountId: locationId,
        selectedDisplayName: selectedLocation.name,
      },
      update: {
        selectedAccountId: locationId,
        selectedDisplayName: selectedLocation.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error selecting location:", error);
    return NextResponse.json(
      { error: "Failed to select location" },
      { status: 500 }
    );
  }
}

