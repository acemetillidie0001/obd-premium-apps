import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  GoogleBusinessCompetitorInsightsRequest,
  GoogleBusinessCompetitorInsightsResult,
} from "@/app/apps/google-business-pro/types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a Local Business Competitive Intelligence Analyst.

Your role: Analyze how a local business compares to up to 3 competitors in their market, providing strategic positioning advice.

You will receive:
- Our business: proRequest (input data) + proResult (audit + content analysis)
- Up to 3 competitors: each with name, optional URL, and optional notes

You must return a JSON object with this exact structure:

{
  "overallSummary": string (2-4 sentences about market position),
  "ourPositioningAdvice": string (2-4 sentences on how to differentiate),
  "competitorScores": [
    {
      "name": string,
      "relativeScore": number (-20 to +20, where +20 means they're much stronger, -20 means we're much stronger),
      "summary": string (1-2 sentences),
      "strengths": string[] (2-5 items),
      "weaknesses": string[] (2-5 items),
      "subScores": {
        "visibility": number (0-100, how visible they likely are locally),
        "reputation": number (0-100, perceived trust/quality),
        "contentQuality": number (0-100, clarity and persuasiveness of messaging),
        "offerStrength": number (0-100, how compelling their offer or positioning is)
      }
    }
  ] (one entry per competitor, max 3)
}

RULES:
- Do NOT attempt to browse URLs or fetch external data. Use only the provided information.
- relativeScore: -20 to +20 scale where:
  * Positive = competitor is stronger/better positioned
  * Negative = our business is stronger/better positioned
  * 0 = roughly equal
- For each competitor, assign numerical scores 0-100 for:
  * visibility: How visible they likely are locally (based on notes, URL presence, mentions)
  * reputation: Perceived trust/quality (based on notes, content tone, positioning)
  * contentQuality: Clarity and persuasiveness of messaging (based on notes and inferred from positioning)
  * offerStrength: How compelling their offer or positioning is (based on notes and differentiation)
- Then derive relativeScore from the combination of those sub-scores vs our business.
- Base analysis on:
  * Service offerings comparison
  * Local SEO positioning (keywords, location mentions)
  * Content quality and completeness
  * Differentiation opportunities
- Provide actionable advice on how to stand out.

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
    const body = (await req.json()) as GoogleBusinessCompetitorInsightsRequest;
    const isDebug = getDebugFlag(req);

    if (!body.proRequest || !body.proResult || !body.competitors || body.competitors.length === 0) {
      return NextResponse.json(
        { error: "proRequest, proResult, and at least one competitor are required." },
        { status: 400 }
      );
    }

    // Limit to 3 competitors
    const competitors = body.competitors.slice(0, 3);

    const userMessage = JSON.stringify({
      ourBusiness: {
        request: body.proRequest,
        result: body.proResult,
      },
      competitors,
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
        { error: "Failed to generate competitor insights. Please try again." },
        { status: 500 }
      );
    }

    try {
      const parsed = JSON.parse(rawContent);

      // Basic validation
      if (
        typeof parsed.overallSummary !== "string" ||
        typeof parsed.ourPositioningAdvice !== "string" ||
        !Array.isArray(parsed.competitorScores) ||
        !parsed.competitorScores.every((cs: unknown) => {
          if (!cs || typeof cs !== "object") return false;
          const score = cs as any;
          if (
            typeof score.name !== "string" ||
            typeof score.relativeScore !== "number" ||
            score.relativeScore < -20 ||
            score.relativeScore > 20 ||
            typeof score.summary !== "string" ||
            !Array.isArray(score.strengths) ||
            !Array.isArray(score.weaknesses) ||
            !score.subScores ||
            typeof score.subScores !== "object"
          ) {
            return false;
          }
          const subScores = score.subScores;
          return (
            typeof subScores.visibility === "number" &&
            subScores.visibility >= 0 &&
            subScores.visibility <= 100 &&
            typeof subScores.reputation === "number" &&
            subScores.reputation >= 0 &&
            subScores.reputation <= 100 &&
            typeof subScores.contentQuality === "number" &&
            subScores.contentQuality >= 0 &&
            subScores.contentQuality <= 100 &&
            typeof subScores.offerStrength === "number" &&
            subScores.offerStrength >= 0 &&
            subScores.offerStrength <= 100
          );
        })
      ) {
        throw new Error("Invalid response structure");
      }

      const result: GoogleBusinessCompetitorInsightsResult = {
        overallSummary: parsed.overallSummary,
        ourPositioningAdvice: parsed.ourPositioningAdvice,
        competitorScores: parsed.competitorScores,
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
    console.error("Error in competitors route:", error);
    return NextResponse.json(
      { error: "Failed to process competitor insights request" },
      { status: 500 }
    );
  }
}
