import { NextRequest, NextResponse } from "next/server";
import {
  ReviewRequestAutomationRequest,
  ReviewRequestAutomationResponse,
} from "@/lib/apps/review-request-automation/types";
import { processReviewRequestAutomation } from "@/lib/apps/review-request-automation/engine";

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequestAutomationRequest = await request.json();

    // Validate request structure
    if (!body.campaign) {
      return NextResponse.json(
        { error: "Campaign is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.customers)) {
      return NextResponse.json(
        { error: "Customers must be an array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.events)) {
      return NextResponse.json(
        { error: "Events must be an array" },
        { status: 400 }
      );
    }

    // Process request
    const response: ReviewRequestAutomationResponse = processReviewRequestAutomation({
      campaign: body.campaign,
      customers: body.customers,
      events: body.events,
    });

    // Return response
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error processing review request automation:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong while processing the review request automation. Please try again later.",
      },
      { status: 500 }
    );
  }
}

