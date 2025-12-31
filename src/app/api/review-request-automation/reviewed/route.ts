import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReviewRequestStatus } from "@prisma/client";
import { verifyQueueItemToken } from "@/lib/apps/review-request-automation/token";
import { upsertContactFromExternalSource, addActivityNote } from "@/lib/apps/obd-crm/crmService";

/**
 * GET /api/review-request-automation/reviewed
 * 
 * Tracks when a customer confirms they left a review.
 * Updates queue item status to REVIEWED and redirects to Reputation Dashboard.
 * 
 * Query params:
 * - token: Signed token containing queueItemId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify token and extract queue item ID
    const queueItemId = verifyQueueItemToken(token);
    if (!queueItemId) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    // Fetch queue item with customer data for CRM integration
    const queueItem = await prisma.reviewRequestQueueItem.findUnique({
      where: { id: queueItemId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!queueItem) {
      return NextResponse.json(
        { error: "Queue item not found" },
        { status: 404 }
      );
    }

    const wasAlreadyReviewed = queueItem.status === ReviewRequestStatus.REVIEWED;

    // Update status to REVIEWED if not already reviewed
    if (!wasAlreadyReviewed) {
      await prisma.reviewRequestQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: ReviewRequestStatus.REVIEWED,
          reviewedAt: new Date(),
          // Also set clickedAt if not already set
          clickedAt: queueItem.clickedAt || new Date(),
        },
      });

      // Best-effort CRM integration (doesn't block main flow)
      try {
        // Skip CRM if name missing OR (email and phone both missing)
        const customerName = queueItem.customer.name?.trim();
        const customerEmail = queueItem.customer.email?.trim() || null;
        const customerPhone = queueItem.customer.phone?.trim() || null;

        if (!customerName || (!customerEmail && !customerPhone)) {
          // Skip CRM integration - insufficient data
          if (process.env.NODE_ENV !== "production") {
            console.log(`[CRM Integration] Skipping contact upsert for reviewed queue item ${queueItemId}: missing name or identifiers`);
          }
        } else {
          const contact = await upsertContactFromExternalSource({
            businessId: queueItem.userId,
            source: "reviews",
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            tagNames: ["Review Received"],
          });

          // Add activity note - we don't have review text/rating at this point
          // (customer just confirmed they left a review)
          await addActivityNote({
            businessId: queueItem.userId,
            contactId: contact.id,
            note: "Review received (confirmed by customer)",
          });
        }
      } catch (crmError) {
        // Log error but don't fail the review tracking
        if (process.env.NODE_ENV !== "production") {
          console.error(`[CRM Integration] Failed to sync contact for reviewed queue item ${queueItemId}:`, crmError);
        }
      }
    }

    // Redirect to Reputation Dashboard with from=rra parameter
    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://apps.ocalabusinessdirectory.com";
    const redirectUrl = `${baseUrl}/apps/reputation-dashboard?from=rra`;

    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error("Error in reviewed tracking:", error);
    return NextResponse.json(
      {
        error: "Failed to process reviewed tracking",
      },
      { status: 500 }
    );
  }
}

