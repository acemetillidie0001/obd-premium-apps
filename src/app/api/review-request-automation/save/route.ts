import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  saveCampaignWithCustomersAndQueue,
  type SaveCampaignData,
} from "@/lib/apps/review-request-automation/db";
import type {
  ReviewRequestAutomationRequest,
  ReviewRequestAutomationResponse,
} from "@/lib/apps/review-request-automation/types";

export async function POST(request: NextRequest) {
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

    // Validate request structure
    if (!body.campaign || !body.customers || !body.queue || !body.results) {
      return NextResponse.json(
        {
          error:
            "Missing required fields. Expected: campaign, customers, queue, results",
        },
        { status: 400 }
      );
    }

    const data: SaveCampaignData = {
      userId,
      campaign: body.campaign,
      customers: body.customers,
      queue: body.queue,
      results: body.results,
    };

    const result = await saveCampaignWithCustomersAndQueue(data);

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      datasetId: result.datasetId,
      computedAt: result.computedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error saving review request campaign:", error);
    
    // Provide more specific error messages
    let errorMessage = "Failed to save campaign to database";
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check for common database connection errors
      if (error.message.includes("DATABASE_URL") || error.message.includes("connection")) {
        errorMessage = "Database connection error. Please check your DATABASE_URL environment variable.";
      } else if (error.message.includes("P2002") || error.message.includes("Unique constraint")) {
        errorMessage = "A campaign with this data already exists.";
      } else if (error.message.includes("P2003") || error.message.includes("Foreign key")) {
        errorMessage = "Invalid data reference. Please check your campaign data.";
      } else if (error.message.includes("PrismaClient")) {
        errorMessage = "Database client error. Please ensure Prisma migrations are up to date.";
      }
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

