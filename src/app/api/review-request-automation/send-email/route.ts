import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewRequestChannel, ReviewRequestStatus } from "@prisma/client";
import { sendReviewRequestEmail } from "@/lib/email/resend";
import { createQueueItemToken } from "@/lib/apps/review-request-automation/token";
import { generateMessageTemplates } from "@/lib/apps/review-request-automation/engine";
import type { Campaign } from "@/lib/apps/review-request-automation/types";
import { upsertContactFromExternalSource, addActivityNote } from "@/lib/apps/obd-crm/crmService";

const MAX_BATCH_SIZE = 25;

/**
 * POST /api/review-request-automation/send-email
 * 
 * Sends review request emails for queue items via Resend.
 * 
 * Body:
 * - mode: "batch" | "single"
 * - queueItemIds: string[]
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { queueItemIds } = body;

    let idsToProcess: string[];

    if (queueItemIds && Array.isArray(queueItemIds) && queueItemIds.length > 0) {
      // Use provided IDs
      idsToProcess = queueItemIds.slice(0, MAX_BATCH_SIZE);
    } else {
      // Fetch all pending EMAIL items from the user's latest campaign
      const latestDataset = await prisma.reviewRequestDataset.findFirst({
        where: { userId },
        orderBy: [{ computedAt: "desc" }, { createdAt: "desc" }],
        include: {
          campaign: {
            select: { id: true },
          },
        },
      });

      if (!latestDataset) {
        return NextResponse.json(
          { error: "No saved campaign found. Please save your campaign first." },
          { status: 404 }
        );
      }

      const pendingItems = await prisma.reviewRequestQueueItem.findMany({
        where: {
          userId,
          campaignId: latestDataset.campaignId,
          channel: ReviewRequestChannel.EMAIL,
          status: ReviewRequestStatus.PENDING,
        },
        select: { id: true },
        take: MAX_BATCH_SIZE,
      });

      if (pendingItems.length === 0) {
        return NextResponse.json({
          ok: true,
          sent: 0,
          failed: 0,
          results: [],
          message: "No pending EMAIL queue items found",
        });
      }

      idsToProcess = pendingItems.map((item) => item.id);
    }

    // Fetch queue items with related data
    const queueItems = await prisma.reviewRequestQueueItem.findMany({
      where: {
        id: { in: idsToProcess },
        userId, // Strict userId scoping
        channel: ReviewRequestChannel.EMAIL,
        status: ReviewRequestStatus.PENDING, // Only send pending items
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        campaign: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            platform: true,
            reviewLinkUrl: true,
            languageMode: true,
            toneStyle: true,
            brandVoice: true,
          },
        },
      },
    });

    if (queueItems.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        failed: 0,
        results: [],
        message: "No pending EMAIL queue items found",
      });
    }

    // Get base URL for tracking links
    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://apps.ocalabusinessdirectory.com";

    const results: Array<{
      queueItemId: string;
      ok: boolean;
      error?: string;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    // Process each queue item
    for (const queueItem of queueItems) {
      try {
        // Validate customer has email
        if (!queueItem.customer.email || !queueItem.customer.email.trim()) {
          results.push({
            queueItemId: queueItem.id,
            ok: false,
            error: "Customer email is missing",
          });
          failedCount++;
          continue;
        }

        // Reconstruct campaign object for template generation
        const campaign: Campaign = {
          businessName: queueItem.campaign.businessName,
          businessType: queueItem.campaign.businessType || undefined,
          platform: queueItem.campaign.platform as "Google" | "Facebook" | "Yelp" | "Other",
          reviewLink: queueItem.campaign.reviewLinkUrl,
          language: queueItem.campaign.languageMode as "English" | "Spanish" | "Bilingual",
          toneStyle: queueItem.campaign.toneStyle as "Friendly" | "Professional" | "Bold" | "Luxury",
          brandVoice: queueItem.campaign.brandVoice || undefined,
          rules: {
            triggerType: "manual",
            sendDelayHours: 24,
            followUpEnabled: false,
            followUpDelayDays: 7,
            frequencyCapDays: 30,
            quietHours: {
              start: "09:00",
              end: "19:00",
            },
          },
        };

        // Generate email template
        const templates = generateMessageTemplates(campaign);
        const emailTemplate = templates.email;

        // Extract first name from customer name
        const customerName = queueItem.customer.name.trim();
        const firstName = customerName.split(" ")[0] || customerName;

        // Substitute {firstName} in subject and body
        const subject = emailTemplate.subject.replace(/{firstName}/g, firstName);
        let htmlBody = emailTemplate.body.replace(/{firstName}/g, firstName);

        // Replace review link with tracking URL
        const clickToken = createQueueItemToken(queueItem.id);
        const clickTrackingUrl = `${baseUrl}/api/review-request-automation/click?token=${clickToken}`;
        
        // Replace the review link in the body
        htmlBody = htmlBody.replace(
          new RegExp(queueItem.campaign.reviewLinkUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          clickTrackingUrl
        );

        // Convert plain text body to HTML (basic conversion)
        htmlBody = htmlBody.replace(/\n/g, "<br>");

        // Add reviewed confirmation link at the end
        const reviewedToken = createQueueItemToken(queueItem.id);
        const reviewedUrl = `${baseUrl}/api/review-request-automation/reviewed?token=${reviewedToken}`;
        htmlBody += `<br><br><small>After you leave a review, <a href="${reviewedUrl}">tap here to confirm</a>.</small>`;

        // Send email via Resend
        await sendReviewRequestEmail({
          to: queueItem.customer.email,
          subject,
          htmlBody,
        });

        // Update queue item status
        await prisma.reviewRequestQueueItem.update({
          where: { id: queueItem.id },
          data: {
            status: ReviewRequestStatus.SENT,
            sentAt: new Date(),
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
              console.log(`[CRM Integration] Skipping contact upsert for queue item ${queueItem.id}: missing name or identifiers`);
            }
          } else {
            const contact = await upsertContactFromExternalSource({
              businessId: userId,
              source: "reviews",
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
              tagNames: ["Review Request"],
            });

            // Build activity note with channel and campaign name
            const sentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
            let note = `Review request sent via email on ${sentDate}`;
            if (queueItem.campaign.businessName) {
              note += ` | Campaign: ${queueItem.campaign.businessName}`;
            }

            await addActivityNote({
              businessId: userId,
              contactId: contact.id,
              note,
            });
          }
        } catch (crmError) {
          // Log error but don't fail the email send
          if (process.env.NODE_ENV !== "production") {
            console.error(`[CRM Integration] Failed to sync contact for review request ${queueItem.id}:`, crmError);
          }
        }

        results.push({
          queueItemId: queueItem.id,
          ok: true,
        });
        sentCount++;
      } catch (error) {
        console.error(`Error sending email for queue item ${queueItem.id}:`, error);
        results.push({
          queueItemId: queueItem.id,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        failedCount++;
        // Continue processing other items
      }
    }

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error("Error in send-email route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send emails",
      },
      { status: 500 }
    );
  }
}

