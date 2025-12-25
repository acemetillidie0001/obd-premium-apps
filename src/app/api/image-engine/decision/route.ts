/**
 * OBD Brand-Safe Image Generator - Decision API Route
 * 
 * POST /api/image-engine/decision
 * 
 * Returns a decision about image generation (Phase 1: no actual generation).
 */

import { NextRequest, NextResponse } from "next/server";
import { ImageEngine } from "@/lib/image-engine";
import type { ImageEngineRequest, ImageGenerationResult } from "@/lib/image-engine/types";
import { upsertImageRequestFromResult } from "@/lib/image-engine/db";
import { evaluateSafety } from "@/lib/image-engine/safety/evaluate";
import { logEngineEvent } from "@/lib/image-engine/events/log";

/**
 * POST /api/image-engine/decision
 * 
 * Validates request body and returns an image generation decision.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    // Validate request shape
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 }
      );
    }

    const req = body as Partial<ImageEngineRequest>;

    // Required fields validation
    if (!req.requestId || typeof req.requestId !== "string" || req.requestId.trim().length === 0) {
      return NextResponse.json(
        { error: "requestId is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!req.consumerApp || typeof req.consumerApp !== "string") {
      return NextResponse.json(
        { error: "consumerApp is required and must be a string" },
        { status: 400 }
      );
    }

    const validConsumerApps = [
      "social_auto_poster",
      "offers_promotions",
      "event_campaign",
      "review_responder",
      "brand_kit_builder",
      "seo_audit_roadmap",
      "other",
    ];
    if (!validConsumerApps.includes(req.consumerApp)) {
      return NextResponse.json(
        { error: `consumerApp must be one of: ${validConsumerApps.join(", ")}` },
        { status: 400 }
      );
    }

    if (!req.platform || typeof req.platform !== "string") {
      return NextResponse.json(
        { error: "platform is required and must be a string" },
        { status: 400 }
      );
    }

    const validPlatforms = ["instagram", "facebook", "x", "google_business_profile", "blog"];
    if (!validPlatforms.includes(req.platform)) {
      return NextResponse.json(
        { error: `platform must be one of: ${validPlatforms.join(", ")}` },
        { status: 400 }
      );
    }

    if (!req.category || typeof req.category !== "string") {
      return NextResponse.json(
        { error: "category is required and must be a string" },
        { status: 400 }
      );
    }

    const validCategories = ["educational", "promotion", "social_proof", "local_abstract", "evergreen"];
    if (!validCategories.includes(req.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    if (!req.intentSummary || typeof req.intentSummary !== "string") {
      return NextResponse.json(
        { error: "intentSummary is required and must be a string" },
        { status: 400 }
      );
    }

    // Optional fields validation
    if (req.brand !== undefined && (typeof req.brand !== "object" || req.brand === null)) {
      return NextResponse.json(
        { error: "brand must be an object if provided" },
        { status: 400 }
      );
    }

    if (req.locale !== undefined && (typeof req.locale !== "object" || req.locale === null)) {
      return NextResponse.json(
        { error: "locale must be an object if provided" },
        { status: 400 }
      );
    }

    if (req.allowTextOverlay !== undefined && typeof req.allowTextOverlay !== "boolean") {
      return NextResponse.json(
        { error: "allowTextOverlay must be a boolean if provided" },
        { status: 400 }
      );
    }

    if (req.safeMode !== undefined && req.safeMode !== "strict") {
      return NextResponse.json(
        { error: 'safeMode must be "strict" if provided' },
        { status: 400 }
      );
    }

    // Build validated request
    const validatedRequest: ImageEngineRequest = {
      requestId: req.requestId.trim(),
      consumerApp: req.consumerApp,
      platform: req.platform,
      category: req.category,
      intentSummary: req.intentSummary.trim(),
      brand: req.brand,
      locale: req.locale,
      allowTextOverlay: req.allowTextOverlay,
      safeMode: req.safeMode,
    };

    // Get decision
    const decision = ImageEngine.decide(validatedRequest);

    // Evaluate safety rules
    const safetyResult = evaluateSafety({
      platform: decision.platform,
      category: decision.category,
      aspect: decision.aspect,
      mode: decision.mode,
      negativeRules: decision.promptPlan.negativeRules,
      businessName: validatedRequest.brand?.industry, // Use industry as proxy for business context
      userText: validatedRequest.intentSummary, // Use intentSummary as userText
    });

    // Attach safety result to decision (will be included in decisionJson by db.ts)
    const decisionWithSafety = {
      ...decision,
      safetyResult, // Attach safety result for db.ts to include in decisionJson
    };

    // Persist to database (non-blocking)
    try {
      // Create minimal ImageGenerationResult for persistence (status=queued)
      const minimalResult: ImageGenerationResult = {
        requestId: validatedRequest.requestId,
        ok: true, // Decision computed successfully
        decision: decisionWithSafety as any, // Include safety in decision
        timingsMs: {
          decision: 0,
          total: 0,
        },
      };

      await upsertImageRequestFromResult(minimalResult);

      // Log decision event
      await logEngineEvent({
        requestId: validatedRequest.requestId,
        type: "decision",
        ok: true,
        messageSafe: "Decision computed",
        data: {
          platform: decision.platform,
          category: decision.category,
          aspect: decision.aspect,
          mode: decision.mode,
        },
      });

      // Log safety decision event
      await logEngineEvent({
        requestId: validatedRequest.requestId,
        type: "safety_decision",
        ok: safetyResult.verdict === "allow",
        messageSafe: safetyResult.reasonSafe,
        data: {
          verdict: safetyResult.verdict,
          tags: safetyResult.tags || [],
        },
      });
    } catch (dbError) {
      // Non-blocking: log but don't fail the request
      console.warn("[ImageEngine Decision API] DB persistence failed:", dbError);
    }

    // Return decision with safety attached
    return NextResponse.json(decisionWithSafety);
  } catch (error) {
    console.error("[ImageEngine API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

