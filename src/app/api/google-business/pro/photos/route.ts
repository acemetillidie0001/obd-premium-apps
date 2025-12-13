import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  GoogleBusinessPhotoOptimizationRequest,
  GoogleBusinessPhotoOptimizationResult,
} from "@/app/apps/google-business-pro/types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a Google Business Profile Photo Optimization Specialist.

Your role: Generate photo caption ideas and album organization suggestions for a local business based on their services, location, and brand personality.

You will receive:
- A Google Business Profile Pro result (contains services, city, state, brand voice)
- Optional currentPhotoContext (description of existing photos)

You must return a JSON object with this exact structure:

{
  "captions": string[] (10-20 caption ideas),
  "albums": [
    {
      "albumName": string,
      "description": string,
      "suggestedImages": string[] (3-8 conceptual image ideas),
      "keywords": string[] (5-10 keywords for file naming/organization)
    }
  ] (3-6 album suggestions)
}

RULES:
- Captions should be plain language, no hashtags, suitable for GBP photo descriptions.
- Each caption should be 1-2 sentences, natural and engaging.
- Albums should group related photos logically (e.g., "Before & After", "Team Members", "Service Highlights").
- suggestedImages are conceptual descriptions (e.g., "Interior of renovated kitchen showing modern appliances").
- keywords should be useful for file naming and internal organization.

Return ONLY valid JSON, no markdown, no explanations.` as const;

function getDebugFlag(req: NextRequest): boolean {
  const url = new URL(req.url);
  const debugQuery = url.searchParams.get("debug");
  if (debugQuery === "true") return true;

  const debugHeader = req.headers.get("x-obd-debug");
  if (debugHeader === "true") return true;

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GoogleBusinessPhotoOptimizationRequest;
    const isDebug = getDebugFlag(req);

    if (!body.proResult) {
      return NextResponse.json(
        { error: "proResult is required." },
        { status: 400 }
      );
    }

    const userMessage = JSON.stringify({
      proResult: body.proResult,
      currentPhotoContext: body.currentPhotoContext || null,
    }, null, 2);

    let rawContent: string;
    let model: string | undefined;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
      });

      rawContent = completion.choices[0]?.message?.content?.trim() || "";
      model = completion.model;

      if (!rawContent) {
        throw new Error("Empty response from OpenAI");
      }
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);
      return NextResponse.json(
        { error: "Failed to generate photo suggestions. Please try again." },
        { status: 500 }
      );
    }

    try {
      const parsed = JSON.parse(rawContent);

      // Basic validation
      if (
        !Array.isArray(parsed.captions) ||
        !Array.isArray(parsed.albums) ||
        !parsed.captions.every((c: unknown) => typeof c === "string") ||
        !parsed.albums.every((a: unknown) =>
          a &&
          typeof a === "object" &&
          typeof (a as any).albumName === "string" &&
          typeof (a as any).description === "string" &&
          Array.isArray((a as any).suggestedImages) &&
          Array.isArray((a as any).keywords)
        )
      ) {
        throw new Error("Invalid response structure");
      }

      const result: GoogleBusinessPhotoOptimizationResult = {
        captions: parsed.captions,
        albums: parsed.albums,
      };

      if (isDebug) {
        return NextResponse.json({
          ...result,
          _debug: {
            rawContent,
            model: model || "unknown",
          },
        });
      }

      return NextResponse.json(result);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", rawContent);
      return NextResponse.json(
        { error: "Invalid response format from model." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in photos route:", error);
    return NextResponse.json(
      { error: "Failed to process photo optimization request" },
      { status: 500 }
    );
  }
}
