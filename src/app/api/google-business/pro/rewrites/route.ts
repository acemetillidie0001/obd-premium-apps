import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  GoogleBusinessRewritesRequest,
  GoogleBusinessRewritesResult,
} from "@/app/apps/google-business-pro/types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a Premium Google Business Profile Content Optimizer.

Your role: Take an existing Google Business Profile Pro result and generate optimized, rewritten versions of the content sections with a specific tone and emphasis.

You will receive:
- The original Pro result (audit + content)
- A target tone: "Default", "Soft", "Bold", "High-Energy", or "Luxury"
- Optional emphasis notes (what to emphasize in the rewrite)

You must return a JSON object with this exact structure:

{
  "shortDescription": string,
  "longDescription": string,
  "servicesSection": string,
  "aboutSection": string,
  "premiumNotes": string (optional)
}

RULES:
- Rewrite each section to match the requested tone while keeping the core information.
- If emphasisNotes are provided, weave those themes naturally into the content.
- shortDescription: Keep it concise (1-2 sentences), but optimize wording for the tone.
- longDescription: Full rewrite maintaining structure but adapting voice to tone.
- servicesSection: Rewrite to match tone while keeping service details accurate.
- aboutSection: Rewrite the story/mission section with the new tone.
- premiumNotes: Optional 2-3 sentence summary of optimization highlights (e.g., "This rewrite emphasizes family-friendly service and late hours, using a warm, approachable tone that builds trust with local Ocala families.").

TONE GUIDELINES:
- Default: Professional, clear, balanced
- Soft: Warm, gentle, reassuring, approachable
- Bold: Confident, direct, decisive, strong
- High-Energy: Upbeat, enthusiastic, dynamic, lively
- Luxury: Refined, elegant, premium, sophisticated

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
    const body = (await req.json()) as GoogleBusinessRewritesRequest;
    const isDebug = getDebugFlag(req);

    if (!body.proResult || !body.tone) {
      return NextResponse.json(
        { error: "proResult and tone are required." },
        { status: 400 }
      );
    }

    const userMessage = JSON.stringify({
      proResult: body.proResult,
      tone: body.tone,
      emphasisNotes: body.emphasisNotes || null,
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
        { error: "Failed to generate rewrites. Please try again." },
        { status: 500 }
      );
    }

    try {
      const parsed = JSON.parse(rawContent);

      // Basic validation
      if (
        typeof parsed.shortDescription !== "string" ||
        typeof parsed.longDescription !== "string" ||
        typeof parsed.servicesSection !== "string" ||
        typeof parsed.aboutSection !== "string"
      ) {
        throw new Error("Invalid response structure");
      }

      const result: GoogleBusinessRewritesResult = {
        shortDescription: parsed.shortDescription,
        longDescription: parsed.longDescription,
        servicesSection: parsed.servicesSection,
        aboutSection: parsed.aboutSection,
        premiumNotes: parsed.premiumNotes || undefined,
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
    console.error("Error in rewrites route:", error);
    return NextResponse.json(
      { error: "Failed to process rewrites request" },
      { status: 500 }
    );
  }
}
