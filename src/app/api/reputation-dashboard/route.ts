import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
// Removed unused import
import { processReputationDashboard } from "@/lib/apps/reputation-dashboard/engine";

// Request validation schema
const reviewInputSchema = z.object({
  platform: z.enum(["Google", "Facebook", "Yelp", "Other"]),
  rating: z.number().min(1).max(5),
  reviewText: z.string().min(1, "Review text is required"),
  authorName: z.string().optional(),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid date format"),
  responded: z.boolean(),
  responseDate: z.string().optional(),
  responseText: z.string().optional(),
});

const dateRangeSchema = z.object({
  mode: z.enum(["30d", "90d", "custom"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine(
  (data) => {
    if (data.mode === "custom") {
      return !!data.startDate && !!data.endDate;
    }
    return true;
  },
  { message: "startDate and endDate are required for custom date range" }
);

const reputationDashboardRequestSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  businessType: z.string().optional(),
  dateRange: dateRangeSchema,
  reviews: z.array(reviewInputSchema).min(1, "At least one review is required to generate the dashboard"),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Validate request
    const validationResult = reputationDashboardRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }
    
    const validatedRequest = validationResult.data;
    
    // Guard: Ensure reviews array is not empty
    if (!validatedRequest.reviews || validatedRequest.reviews.length === 0) {
      return NextResponse.json(
        {
          error: "At least one review is required to generate the dashboard. Please add reviews and try again.",
        },
        { status: 400 }
      );
    }
    
    // Process the dashboard using the engine
    const response = processReputationDashboard(validatedRequest);
    
    return NextResponse.json(response);
  } catch (error) {
    // Log error without exposing sensitive data
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // In production, log to monitoring service instead of console
    if (process.env.NODE_ENV === "development") {
      console.error("Error processing reputation dashboard:", errorMessage);
    }
    return NextResponse.json(
      {
        error: "An error occurred while processing the reputation dashboard. Please try again.",
      },
      { status: 500 }
    );
  }
}
