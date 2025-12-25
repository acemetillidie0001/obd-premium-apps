/**
 * Review Request Automation - Database Access Layer
 * 
 * Handles all database operations for Review Request Automation campaigns,
 * customers, queue items, and datasets with strict userId scoping.
 */

import { prisma } from "@/lib/prisma";
import type {
  Campaign,
  Customer,
  SendQueueItem,
  ReviewRequestAutomationResponse,
} from "./types";
import {
  ReviewRequestChannel,
  ReviewRequestVariant,
  ReviewRequestStatus,
} from "@prisma/client";

export interface SaveCampaignData {
  userId: string;
  campaign: Campaign;
  customers: Customer[];
  queue: SendQueueItem[];
  results: ReviewRequestAutomationResponse;
}

export interface SavedCampaignResult {
  campaignId: string;
  datasetId: string;
  computedAt: Date;
}

export interface LatestDatasetResult {
  datasetId: string;
  campaignId: string;
  businessName: string;
  computedAt: Date;
  metrics: {
    sent: number;
    clicked: number;
    reviewed: number;
    clickedRate: number;
    reviewedRate: number;
  };
  totalsJson: Record<string, unknown>;
  warningsJson: Record<string, unknown> | null;
}

/**
 * Save a complete campaign with customers, queue items, and results to the database.
 * Creates a campaign, customers, queue items, and a dataset snapshot.
 */
export async function saveCampaignWithCustomersAndQueue(
  data: SaveCampaignData
): Promise<SavedCampaignResult> {
  const { userId, campaign, customers, queue, results } = data;

  // Validate userId
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }

  // Generate snapshot ID (short form like "RRA-12345678")
  const snapshotId = `RRA-${Date.now().toString().slice(-8)}`;

  // Compute warningsJson (minimal V3 heuristics - informational only)
  const warnings: Record<string, boolean> = {};
  
  // Check for missing review link
  if (!campaign.reviewLink || campaign.reviewLink.trim() === "") {
    warnings.missingReviewLink = true;
  }

  // Check for no customer contacts
  const hasContacts = customers.some(
    (c) => (c.phone && c.phone.trim() !== "") || (c.email && c.email.trim() !== "")
  );
  if (!hasContacts || customers.length === 0) {
    warnings.noCustomerContacts = true;
  }

  // Check for SMS too long (if templates exist)
  if (results.templates) {
    const smsShort = results.templates.smsShort || "";
    const smsStandard = results.templates.smsStandard || "";
    const followUpSms = results.templates.followUpSms || "";
    
    if (smsShort.length > 300 || smsStandard.length > 300 || followUpSms.length > 300) {
      warnings.smsTooLong = true;
    }
  }

  // Check for follow-up too soon
  if (
    campaign.rules.followUpEnabled &&
    campaign.rules.followUpDelayDays !== null &&
    campaign.rules.followUpDelayDays !== undefined &&
    campaign.rules.followUpDelayDays < 2
  ) {
    warnings.followUpTooSoon = true;
  }

  // Check for high queue skip rate
  if (queue.length > 0) {
    const skippedCount = queue.filter((q) => q.status === "skipped").length;
    const skipRate = skippedCount / queue.length;
    if (skipRate > 0.25) {
      warnings.highQueueSkipRate = true;
    }
  }

  // Extract metrics from results
  // Note: sent/clicked/reviewed counts will be updated dynamically from queue items
  // when fetching datasets, so these initial values are just snapshots
  const totals = {
    sent: results.metrics.sent,
    clicked: results.metrics.clicked,
    reviewed: results.metrics.reviewed,
    queued: results.metrics.queued,
    loaded: results.metrics.loaded,
    ready: results.metrics.ready,
    optedOut: results.metrics.optedOut,
    clickedRate:
      results.metrics.sent > 0
        ? (results.metrics.clicked / results.metrics.sent) * 100
        : 0,
    reviewedRate:
      results.metrics.sent > 0
        ? (results.metrics.reviewed / results.metrics.sent) * 100
        : 0,
    // These will be computed dynamically from queue items when fetching
    sentCount: 0, // Will be updated from queue items
    clickedCount: 0, // Will be updated from queue items
    reviewedCount: 0, // Will be updated from queue items
    optOutCount: 0, // Will be updated from queue items
  };

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create campaign
    const dbCampaign = await tx.reviewRequestCampaign.create({
      data: {
        userId,
        businessName: campaign.businessName,
        businessType: campaign.businessType || null,
        campaignName: null, // Can be added later if needed
        platform: campaign.platform,
        reviewLinkUrl: campaign.reviewLink,
        languageMode: campaign.language,
        toneStyle: campaign.toneStyle,
        brandVoice: campaign.brandVoice || null,
        channelMode: queue.some((q) => q.channel === "sms") && queue.some((q) => q.channel === "email")
          ? "both"
          : queue.some((q) => q.channel === "sms")
          ? "sms"
          : "email",
        triggerType: campaign.rules.triggerType,
        sendDelayHours: campaign.rules.sendDelayHours,
        followUpEnabled: campaign.rules.followUpEnabled,
        followUpDelayDays: campaign.rules.followUpEnabled
          ? campaign.rules.followUpDelayDays
          : null,
        frequencyCapDays: campaign.rules.frequencyCapDays,
        quietHoursStart: campaign.rules.quietHours.start || null,
        quietHoursEnd: campaign.rules.quietHours.end || null,
      },
    });

    // Create customers
    const customerMap = new Map<string, string>(); // originalId -> dbId
    for (const customer of customers) {
      const dbCustomer = await tx.reviewRequestCustomer.create({
        data: {
          userId,
          campaignId: dbCampaign.id,
          name: customer.customerName,
          email: customer.email || null,
          phone: customer.phone || null,
          tags: customer.tags || [],
          lastVisitDate: customer.lastVisitDate
            ? new Date(customer.lastVisitDate)
            : null,
          serviceType: customer.serviceType || null,
          jobId: customer.jobId || null,
          optedOut: customer.optedOut || false,
        },
      });
      customerMap.set(customer.id, dbCustomer.id);
    }

    // Create queue items
    for (const queueItem of queue) {
      const dbCustomerId = customerMap.get(queueItem.customerId);
      if (!dbCustomerId) {
        console.warn(`Skipping queue item with unknown customerId: ${queueItem.customerId}`);
        continue;
      }

      // Map string values to enum types
      const channelEnum =
        queueItem.channel === "sms"
          ? ReviewRequestChannel.SMS
          : ReviewRequestChannel.EMAIL;

      const variantEnum = (() => {
        switch (queueItem.variant) {
          case "smsShort":
            return ReviewRequestVariant.SMS_SHORT;
          case "smsStandard":
            return ReviewRequestVariant.SMS_STANDARD;
          case "email":
            return ReviewRequestVariant.EMAIL;
          case "followUpSms":
            return ReviewRequestVariant.FOLLOW_UP_SMS;
          default:
            return ReviewRequestVariant.SMS_SHORT; // fallback
        }
      })();

      const statusEnum = (() => {
        switch (queueItem.status) {
          case "sent":
            return ReviewRequestStatus.SENT;
          case "clicked":
            return ReviewRequestStatus.CLICKED;
          case "reviewed":
            return ReviewRequestStatus.REVIEWED;
          case "optedOut":
            return ReviewRequestStatus.OPTED_OUT;
          case "skipped":
            return ReviewRequestStatus.SKIPPED;
          default:
            return ReviewRequestStatus.PENDING;
        }
      })();

      await tx.reviewRequestQueueItem.create({
        data: {
          userId,
          campaignId: dbCampaign.id,
          customerId: dbCustomerId,
          scheduledAt: new Date(queueItem.scheduledAt),
          channel: channelEnum,
          variant: variantEnum,
          status: statusEnum,
          skippedReason: queueItem.skippedReason || null,
          sentAt: null, // Will be updated when marked as sent
          clickedAt: null,
          reviewedAt: null,
          optedOutAt: null,
        },
      });
    }

    // Create dataset
    const dataset = await tx.reviewRequestDataset.create({
      data: {
        userId,
        campaignId: dbCampaign.id,
        snapshotId,
        computedAt: new Date(),
        totalsJson: totals as any, // Prisma Json type
        warningsJson: Object.keys(warnings).length > 0 ? (warnings as any) : null,
      },
    });

    return {
      campaignId: dbCampaign.id,
      datasetId: dataset.id,
      computedAt: dataset.computedAt,
    };
  });

  return result;
}

/**
 * Get the latest dataset for a user, including aggregated metrics.
 * Returns null if no dataset exists.
 */
export async function getLatestDatasetForUser(
  userId: string
): Promise<LatestDatasetResult | null> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }

  // Find latest dataset - order by computedAt desc, then createdAt desc for tie-breaking
  const dataset = await prisma.reviewRequestDataset.findFirst({
    where: { userId },
    orderBy: [
      { computedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      campaign: true,
    },
  });

  if (!dataset) {
    return null;
  }

  // Get aggregated metrics from queue items for this campaign
  const queueItems = await prisma.reviewRequestQueueItem.findMany({
    where: {
      userId,
      campaignId: dataset.campaignId,
    },
  });

  // Compute metrics from actual queue item statuses
  const sent = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.SENT || q.sentAt
  ).length;
  const clicked = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.CLICKED || q.status === ReviewRequestStatus.REVIEWED || q.clickedAt
  ).length;
  const reviewed = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.REVIEWED || q.reviewedAt
  ).length;
  const optOut = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.OPTED_OUT || q.optedOutAt
  ).length;

  const clickedRate = sent > 0 ? (clicked / sent) * 100 : 0;
  const reviewedRate = sent > 0 ? (reviewed / sent) * 100 : 0;

  // Update totalsJson with current counts
  const updatedTotalsJson = {
    ...(dataset.totalsJson as Record<string, unknown>),
    sentCount: sent,
    clickedCount: clicked,
    reviewedCount: reviewed,
    optOutCount: optOut,
    sent,
    clicked,
    reviewed,
    clickedRate: Math.round(clickedRate * 100) / 100,
    reviewedRate: Math.round(reviewedRate * 100) / 100,
  };

  return {
    datasetId: dataset.id,
    campaignId: dataset.campaignId,
    businessName: dataset.campaign.businessName,
    computedAt: dataset.computedAt,
    metrics: {
      sent,
      clicked,
      reviewed,
      clickedRate: Math.round(clickedRate * 100) / 100, // Round to 2 decimals
      reviewedRate: Math.round(reviewedRate * 100) / 100,
    },
    totalsJson: updatedTotalsJson,
    warningsJson: (dataset.warningsJson as Record<string, unknown> | null) || null,
  };
}

/**
 * Get a campaign by ID, ensuring it belongs to the userId.
 */
export async function getCampaignById(
  userId: string,
  campaignId: string
): Promise<{
  id: string;
  businessName: string;
  businessType: string | null;
  createdAt: Date;
} | null> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }
  if (!campaignId || typeof campaignId !== "string") {
    throw new Error("Invalid campaignId");
  }

  const campaign = await prisma.reviewRequestCampaign.findFirst({
    where: {
      id: campaignId,
      userId, // Strict userId scoping
    },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      createdAt: true,
    },
  });

  return campaign;
}

/**
 * Get the latest dataset for a specific campaign.
 * Returns null if no dataset exists for this campaign.
 */
export async function getLatestDatasetForCampaign(
  userId: string,
  campaignId: string
): Promise<LatestDatasetResult | null> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }
  if (!campaignId || typeof campaignId !== "string") {
    throw new Error("Invalid campaignId");
  }

  // Find latest dataset for this campaign - order by computedAt desc
  const dataset = await prisma.reviewRequestDataset.findFirst({
    where: {
      userId,
      campaignId,
    },
    orderBy: [
      { computedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      campaign: true,
    },
  });

  if (!dataset) {
    return null;
  }

  // Get aggregated metrics from queue items for this campaign
  const queueItems = await prisma.reviewRequestQueueItem.findMany({
    where: {
      userId,
      campaignId: dataset.campaignId,
    },
  });

  // Compute metrics from actual queue item statuses
  const sent = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.SENT || q.sentAt
  ).length;
  const clicked = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.CLICKED || q.status === ReviewRequestStatus.REVIEWED || q.clickedAt
  ).length;
  const reviewed = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.REVIEWED || q.reviewedAt
  ).length;
  const optOut = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.OPTED_OUT || q.optedOutAt
  ).length;

  const clickedRate = sent > 0 ? (clicked / sent) * 100 : 0;
  const reviewedRate = sent > 0 ? (reviewed / sent) * 100 : 0;

  // Update totalsJson with current counts
  const updatedTotalsJson = {
    ...(dataset.totalsJson as Record<string, unknown>),
    sentCount: sent,
    clickedCount: clicked,
    reviewedCount: reviewed,
    optOutCount: optOut,
    sent,
    clicked,
    reviewed,
    clickedRate: Math.round(clickedRate * 100) / 100,
    reviewedRate: Math.round(reviewedRate * 100) / 100,
  };

  return {
    datasetId: dataset.id,
    campaignId: dataset.campaignId,
    businessName: dataset.campaign.businessName,
    computedAt: dataset.computedAt,
    metrics: {
      sent,
      clicked,
      reviewed,
      clickedRate: Math.round(clickedRate * 100) / 100,
      reviewedRate: Math.round(reviewedRate * 100) / 100,
    },
    totalsJson: updatedTotalsJson,
    warningsJson: (dataset.warningsJson as Record<string, unknown> | null) || null,
  };
}

/**
 * Get a dataset by ID, ensuring it belongs to the userId.
 */
export async function getDatasetById(
  userId: string,
  datasetId: string
): Promise<LatestDatasetResult | null> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }
  if (!datasetId || typeof datasetId !== "string") {
    throw new Error("Invalid datasetId");
  }

  const dataset = await prisma.reviewRequestDataset.findFirst({
    where: {
      id: datasetId,
      userId, // Strict userId scoping
    },
    include: {
      campaign: true,
    },
  });

  if (!dataset) {
    return null;
  }

  // Get aggregated metrics from queue items for this campaign
  const queueItems = await prisma.reviewRequestQueueItem.findMany({
    where: {
      userId,
      campaignId: dataset.campaignId,
    },
  });

  // Compute metrics from actual queue item statuses
  const sent = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.SENT || q.sentAt
  ).length;
  const clicked = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.CLICKED || q.status === ReviewRequestStatus.REVIEWED || q.clickedAt
  ).length;
  const reviewed = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.REVIEWED || q.reviewedAt
  ).length;
  const optOut = queueItems.filter(
    (q) => q.status === ReviewRequestStatus.OPTED_OUT || q.optedOutAt
  ).length;

  const clickedRate = sent > 0 ? (clicked / sent) * 100 : 0;
  const reviewedRate = sent > 0 ? (reviewed / sent) * 100 : 0;

  // Update totalsJson with current counts
  const updatedTotalsJson = {
    ...(dataset.totalsJson as Record<string, unknown>),
    sentCount: sent,
    clickedCount: clicked,
    reviewedCount: reviewed,
    optOutCount: optOut,
    sent,
    clicked,
    reviewed,
    clickedRate: Math.round(clickedRate * 100) / 100,
    reviewedRate: Math.round(reviewedRate * 100) / 100,
  };

  return {
    datasetId: dataset.id,
    campaignId: dataset.campaignId,
    businessName: dataset.campaign.businessName,
    computedAt: dataset.computedAt,
    metrics: {
      sent,
      clicked,
      reviewed,
      clickedRate: Math.round(clickedRate * 100) / 100,
      reviewedRate: Math.round(reviewedRate * 100) / 100,
    },
    totalsJson: updatedTotalsJson,
    warningsJson: (dataset.warningsJson as Record<string, unknown> | null) || null,
  };
}

