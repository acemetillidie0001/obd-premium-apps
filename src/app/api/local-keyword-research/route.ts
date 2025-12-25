// src/app/api/local-keyword-research/route.ts

import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import type {
  LocalKeywordRequest,
  LocalKeywordResponse,
} from "./types";
import { fetchKeywordMetrics } from "@/lib/local-keyword-metrics";

interface RawKeywordIdea {
  keyword: string;
}

const ideasPrompt = `
You are the "OBD Local Keyword Scout", an expert at brainstorming LOCAL search terms for small businesses.

Your job:
- Given a local business description, generate a list of relevant keyword ideas only.
- Focus on LOCAL intent: include city, nearby areas, and "near me" variations when appropriate.
- Include short, medium, and long-tail phrases.

INPUT (JSON):
{
  "businessName": string,
  "businessType": string,
  "services": string,
  "city": string,
  "state": string,
  "primaryGoal": "SEO" | "Content" | "Ads" | "Mixed",
  "maxKeywords": number,
  "includeNearMeVariants": boolean,
  "includeZipCodes": boolean,
  "includeNeighborhoods": boolean,
  "language": "English" | "Spanish" | "Bilingual"
}

OUTPUT (JSON):
{
  "keywords": [
    { "keyword": string }
  ]
}

Rules:
- Do NOT include any extra fields, commentary, or markdown.
- Do NOT include search volume numbers.
- Generate up to maxKeywords keywords (fewer if you run out of good ideas).
- Keywords must be realistic phrases a local customer would actually type.
`;

const finalPrompt = `
You are the "OBD Local Keyword Research Pro", an expert local SEO strategist for Ocala Business Directory (OBD).

Goal:
Using the business info, a list of candidate keywords, and any available metric data, you will:
- Group keywords into smart clusters
- Assign intent and suggested page types
- Compute an opportunityScore (1–100, integer)
- Assign difficultyLabel (Easy, Medium, Hard)
- Highlight the BEST quick-win opportunities
- Optionally generate blog ideas, FAQ ideas, and Google Business post ideas

INPUT (JSON):
{
  "request": {
    "businessName": string,
    "businessType": string,
    "services": string,
    "city": string,
    "state": string,
    "websiteUrl"?: string,
    "primaryGoal": "SEO" | "Content" | "Ads" | "Mixed",
    "radiusMiles": number,
    "includeNearMeVariants": boolean,
    "includeZipCodes": boolean,
    "includeNeighborhoods": boolean,
    "maxKeywords": number,
    "personalityStyle": "None" | "Soft" | "Bold" | "High-Energy" | "Luxury",
    "brandVoice"?: string,
    "language": "English" | "Spanish" | "Bilingual",
    "includeBlogIdeas": boolean,
    "includeFaqIdeas": boolean,
    "includeGmbPostIdeas": boolean
  },
  "ideas": [
    { "keyword": string }
  ],
  "metrics": [
    {
      "keyword": string,
      "monthlySearchesExact"?: number | null,
      "cpcUsd"?: number | null,
      "adsCompetitionIndex"?: number | null,
      "dataSource"?: "ai" | "google-ads" | "mock" | "mixed"
    }
  ]
}

You may assume metrics may be partially missing. Some keywords may have metrics, others may not.

OUTPUT FORMAT (JSON):
Return a single JSON object with this EXACT shape:

{
  "summary": string,
  "overviewNotes": string[],
  "keywordClusters": [
    {
      "name": string,
      "description": string,
      "recommendedUse": string,
      "keywords": [
        {
          "keyword": string,
          "intent": "Informational" | "Transactional" | "Commercial" | "Navigational" | "Local" | "Mixed",
          "suggestedPageType": string,
          "opportunityScore": number,
          "difficultyLabel": "Easy" | "Medium" | "Hard",
          "notes"?: string,
          "monthlySearchesExact"?: number | null,
          "cpcUsd"?: number | null,
          "adsCompetitionIndex"?: number | null,
          "dataSource"?: "ai" | "google-ads" | "mock" | "mixed"
        }
      ]
    }
  ],
  "topPriorityKeywords": [
    {
      "keyword": string,
      "intent": "Informational" | "Transactional" | "Commercial" | "Navigational" | "Local" | "Mixed",
      "suggestedPageType": string,
      "opportunityScore": number,
      "difficultyLabel": "Easy" | "Medium" | "Hard",
      "notes"?: string,
      "monthlySearchesExact"?: number | null,
      "cpcUsd"?: number | null,
      "adsCompetitionIndex"?: number | null,
      "dataSource"?: "ai" | "google-ads" | "mock" | "mixed"
    }
  ],
  "blogIdeas"?: string[],
  "faqIdeas"?: [
    { "question": string, "answer": string }
  ],
  "gmbPostIdeas"?: string[]
}

GLOBAL RULES:
1) Focus on LOCAL intent and service-based businesses.
2) Use metrics when available:
   - Higher monthlySearchesExact increases potential.
   - Higher adsCompetitionIndex generally increases difficulty.
   - Higher cpcUsd often indicates strong commercial value.
3) opportunityScore:
   - Integer 1–100 only.
   - Reflect a balance of demand, local intent, and difficulty.
4) DifficultyLabel:
   - "Easy": realistic for a small local business with solid pages and local SEO to rank in 3–6 months.
   - "Medium": realistic with strong content & some authority in 6–12 months.
   - "Hard": highly competitive, generic, or dominated by big brands.
5) If metrics are missing, estimate based on keyword phrasing and local context, but never invent fake precise volumes.
6) Make "topPriorityKeywords" the BEST 5–15 terms based on primaryGoal and opportunityScore.
7) If brandVoice is provided, subtly reflect it in summary and notes.
8) Respect the flags:
   - Only include blogIdeas / faqIdeas / gmbPostIdeas if their flags are true.
9) Return ONLY valid JSON. Do not include explanations or markdown.
`;

function sanitizeAndClampRequest(body: Record<string, unknown>): LocalKeywordRequest {
  const maxKeywordsRaw = Number(body.maxKeywords ?? 60);
  const radiusRaw = Number(body.radiusMiles ?? 15);

  const maxKeywords = Math.min(Math.max(maxKeywordsRaw || 60, 20), 150);
  const radiusMiles = Math.min(Math.max(radiusRaw || 15, 1), 60);

  const request: LocalKeywordRequest = {
    businessName: (body.businessName || "").toString().slice(0, 200),
    businessType: (body.businessType || "").toString().slice(0, 200),
    services: (body.services || "").toString().slice(0, 2000),
    city: (body.city || "Ocala").toString().slice(0, 120),
    state: (body.state || "Florida").toString().slice(0, 120),
    websiteUrl: body.websiteUrl
      ? body.websiteUrl.toString().slice(0, 300)
      : undefined,
    primaryGoal: (["SEO", "Content", "Ads", "Mixed"].includes(body.primaryGoal)
      ? body.primaryGoal
      : "SEO") as LocalKeywordRequest["primaryGoal"],
    radiusMiles,
    includeNearMeVariants:
      typeof body.includeNearMeVariants === "boolean"
        ? body.includeNearMeVariants
        : true,
    includeZipCodes:
      typeof body.includeZipCodes === "boolean"
        ? body.includeZipCodes
        : true,
    includeNeighborhoods:
      typeof body.includeNeighborhoods === "boolean"
        ? body.includeNeighborhoods
        : true,
    maxKeywords,
    personalityStyle: ([
      "None",
      "Soft",
      "Bold",
      "High-Energy",
      "Luxury",
    ].includes(body.personalityStyle)
      ? body.personalityStyle
      : "None") as LocalKeywordRequest["personalityStyle"],
    brandVoice: body.brandVoice
      ? body.brandVoice.toString().slice(0, 2000)
      : undefined,
    language: (["English", "Spanish", "Bilingual"].includes(body.language)
      ? body.language
      : "English") as LocalKeywordRequest["language"],
    includeBlogIdeas:
      typeof body.includeBlogIdeas === "boolean"
        ? body.includeBlogIdeas
        : true,
    includeFaqIdeas:
      typeof body.includeFaqIdeas === "boolean"
        ? body.includeFaqIdeas
        : true,
    includeGmbPostIdeas:
      typeof body.includeGmbPostIdeas === "boolean"
        ? body.includeGmbPostIdeas
        : true,
  };

  return request;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.businessType || !body?.services) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: businessType and services are required.",
        },
        { status: 400 }
      );
    }

    const requestData = sanitizeAndClampRequest(body);

    // -------- STEP 1: generate raw keyword ideas --------
    const openai = getOpenAIClient();
    const ideasCompletion = await openai.chat.completions.create({
      model: process.env.OBD_OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ideasPrompt },
        {
          role: "user",
          content: JSON.stringify({
            businessName: requestData.businessName,
            businessType: requestData.businessType,
            services: requestData.services,
            city: requestData.city,
            state: requestData.state,
            primaryGoal: requestData.primaryGoal,
            maxKeywords: requestData.maxKeywords,
            includeNearMeVariants: requestData.includeNearMeVariants,
            includeZipCodes: requestData.includeZipCodes,
            includeNeighborhoods: requestData.includeNeighborhoods,
            language: requestData.language,
          }),
        },
      ],
    });

    const ideasContent = ideasCompletion.choices[0]?.message?.content;
    if (!ideasContent) {
      return NextResponse.json(
        { error: "No keyword ideas received from the keyword engine." },
        { status: 500 }
      );
    }

    let ideasJson: { keywords: RawKeywordIdea[] } = { keywords: [] };
    try {
      ideasJson = JSON.parse(ideasContent);
    } catch (err) {
      console.error("Failed to parse ideas JSON:", err, ideasContent);
      return NextResponse.json(
        {
          error:
            "The keyword idea engine returned an invalid response. Please try again.",
        },
        { status: 500 }
      );
    }

    const rawKeywords = (ideasJson.keywords || [])
      .map((k) => k.keyword?.toString().trim())
      .filter(Boolean);

    if (!rawKeywords.length) {
      return NextResponse.json(
        {
          error:
            "No keyword ideas were generated. Try adding more detail about your services.",
        },
        { status: 200 }
      );
    }

    // -------- STEP 2: fetch metrics (mock or Google Ads based on env) --------
    const metrics = await fetchKeywordMetrics(
      rawKeywords,
      requestData.city,
      requestData.state
    );

    // -------- STEP 3: final clustering + scoring --------
    const finalCompletion = await openai.chat.completions.create({
      model: process.env.OBD_OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: finalPrompt },
        {
          role: "user",
          content: JSON.stringify({
            request: requestData,
            ideas: rawKeywords.map((keyword) => ({ keyword })),
            metrics,
          }),
        },
      ],
    });

    const finalContent = finalCompletion.choices[0]?.message?.content;

    if (!finalContent) {
      return NextResponse.json(
        { error: "No content received from keyword strategy engine." },
        { status: 500 }
      );
    }

    let parsed: LocalKeywordResponse;
    try {
      parsed = JSON.parse(finalContent);
      
      // Validate and normalize response structure
      if (!parsed.summary) parsed.summary = "Your local keyword strategy has been generated.";
      if (!Array.isArray(parsed.overviewNotes)) parsed.overviewNotes = [];
      if (!Array.isArray(parsed.keywordClusters)) parsed.keywordClusters = [];
      if (!Array.isArray(parsed.topPriorityKeywords)) parsed.topPriorityKeywords = [];
      
      // Ensure opportunityScore is within valid range and preserve metrics
      const normalizeKeyword = (k: Record<string, unknown>) => ({
        ...k,
        opportunityScore: Math.max(1, Math.min(100, Number(k.opportunityScore) || 50)),
        // Preserve metrics if present
        monthlySearchesExact: typeof k.monthlySearchesExact === "number" ? k.monthlySearchesExact : k.monthlySearchesExact ?? null,
        cpcUsd: typeof k.cpcUsd === "number" ? k.cpcUsd : k.cpcUsd ?? null,
        adsCompetitionIndex: typeof k.adsCompetitionIndex === "number" ? k.adsCompetitionIndex : k.adsCompetitionIndex ?? null,
        dataSource: k.dataSource || null,
      });
      
      parsed.topPriorityKeywords = parsed.topPriorityKeywords.map(normalizeKeyword);
      parsed.keywordClusters = parsed.keywordClusters.map((cluster) => ({
        ...cluster,
        keywords: (cluster.keywords || []).map(normalizeKeyword),
      }));
    } catch (err) {
      console.error("Failed to parse final JSON from model:", err, finalContent);
      return NextResponse.json(
        {
          error:
            "The keyword strategy engine returned an invalid response. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Local keyword research API error:", err);
    return NextResponse.json(
      {
        error:
          "Something went wrong while generating your local keyword strategy. Please try again.",
      },
      { status: 500 }
    );
  }
}

