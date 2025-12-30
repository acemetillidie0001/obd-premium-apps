// src/app/api/local-keyword-research/route.ts

import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import type {
  LocalKeywordRequest,
  LocalKeywordResponse,
  LocalKeywordIdea,
  LocalKeywordIntent,
} from "./types";
import { fetchKeywordMetrics } from "@/lib/local-keyword-metrics";

// Simple in-memory rate limiter (per-IP)
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 20; // per window per IP

/**
 * Get client IP from request headers
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  return "unknown";
}

/**
 * Check rate limit for an IP
 * Returns true if allowed, false if rate limited
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // New window or expired window - reset
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

/**
 * Prune old entries from rate limit map to prevent memory growth
 */
function pruneRateLimitMap(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}

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
    primaryGoal: (typeof body.primaryGoal === "string" && ["SEO", "Content", "Ads", "Mixed"].includes(body.primaryGoal)
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
    ].includes(typeof body.personalityStyle === "string" ? body.personalityStyle : "")
      ? (typeof body.personalityStyle === "string" ? body.personalityStyle : "None")
      : "None") as LocalKeywordRequest["personalityStyle"],
    brandVoice: body.brandVoice
      ? body.brandVoice.toString().slice(0, 2000)
      : undefined,
    language: (typeof body.language === "string" && ["English", "Spanish", "Bilingual"].includes(body.language)
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

export async function POST(req: NextRequest) {
  // Prune old entries periodically (more frequent if map is large)
  if (rateLimitMap.size > 1000 || Math.random() < 0.1) {
    pruneRateLimitMap();
  }

  // Check rate limit
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return apiErrorResponse(
      "Too many requests. Please try again in a few minutes.",
      "RATE_LIMITED",
      429
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiErrorResponse("Invalid request body.", "VALIDATION_ERROR", 400);
    }

    if (!body?.businessType || !body?.services) {
      return apiErrorResponse(
        "Missing required fields: businessType and services are required.",
        "VALIDATION_ERROR",
        400
      );
    }

    const requestData = sanitizeAndClampRequest(body as Record<string, unknown>);

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
      return apiErrorResponse(
        "No keyword ideas received from the keyword engine.",
        "UNKNOWN_ERROR",
        500
      );
    }

    let ideasJson: { keywords: RawKeywordIdea[] } = { keywords: [] };
    try {
      ideasJson = JSON.parse(ideasContent);
    } catch (err) {
      console.error("Failed to parse ideas JSON:", err, ideasContent);
      return apiErrorResponse(
        "The keyword idea engine returned an invalid response. Please try again.",
        "UNKNOWN_ERROR",
        500
      );
    }

    const rawKeywords = (ideasJson.keywords || [])
      .map((k) => k.keyword?.toString().trim())
      .filter(Boolean);

    if (!rawKeywords.length) {
      return apiErrorResponse(
        "No keyword ideas were generated. Try adding more detail about your services.",
        "VALIDATION_ERROR",
        400
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
      return apiErrorResponse(
        "No content received from keyword strategy engine.",
        "UNKNOWN_ERROR",
        500
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
      const normalizeKeyword = (k: unknown): LocalKeywordIdea => {
        const kw = k as Record<string, unknown>;
        
        // Validate intent - fallback to "Local" or "Mixed"
        const validIntents: LocalKeywordIntent[] = [
          "Informational",
          "Transactional",
          "Commercial",
          "Navigational",
          "Local",
          "Mixed",
        ];
        const intent = (typeof kw.intent === "string" && validIntents.includes(kw.intent as LocalKeywordIntent))
          ? (kw.intent as LocalKeywordIntent)
          : "Local";
        
        // Validate difficultyLabel - fallback to "Medium"
        const validDifficulties = ["Easy", "Medium", "Hard"] as const;
        const difficultyLabel = (typeof kw.difficultyLabel === "string" && validDifficulties.includes(kw.difficultyLabel as "Easy" | "Medium" | "Hard"))
          ? (kw.difficultyLabel as "Easy" | "Medium" | "Hard")
          : "Medium";
        
        // Validate dataSource - ensure it's one of the valid types, never null
        const validDataSources = ["ai", "google-ads", "mock", "mixed"] as const;
        const dataSource: "ai" | "google-ads" | "mock" | "mixed" = (typeof kw.dataSource === "string" && validDataSources.includes(kw.dataSource as "ai" | "google-ads" | "mock" | "mixed"))
          ? (kw.dataSource as "ai" | "google-ads" | "mock" | "mixed")
          : "ai";
        
        // Clamp opportunityScore to 1-100
        const opportunityScoreRaw = Number(kw.opportunityScore);
        const opportunityScore = Math.max(1, Math.min(100, Math.round(Number.isNaN(opportunityScoreRaw) ? 50 : opportunityScoreRaw)));
        
        // Safely extract optional notes
        const notes = typeof kw.notes === "string" ? kw.notes : undefined;
        
        // Safely extract metrics (number | null)
        const monthlySearchesExact = typeof kw.monthlySearchesExact === "number" ? kw.monthlySearchesExact : (kw.monthlySearchesExact === null ? null : undefined);
        const cpcUsd = typeof kw.cpcUsd === "number" ? kw.cpcUsd : (kw.cpcUsd === null ? null : undefined);
        const adsCompetitionIndex = typeof kw.adsCompetitionIndex === "number" ? kw.adsCompetitionIndex : (kw.adsCompetitionIndex === null ? null : undefined);
        
        // Explicitly return only known LocalKeywordIdea fields
        return {
          keyword: typeof kw.keyword === "string" ? kw.keyword : "",
          intent,
          suggestedPageType: typeof kw.suggestedPageType === "string" ? kw.suggestedPageType : "",
          opportunityScore,
          difficultyLabel,
          notes,
          monthlySearchesExact,
          cpcUsd,
          adsCompetitionIndex,
          dataSource,
        };
      };
      
      parsed.topPriorityKeywords = (parsed.topPriorityKeywords as unknown[]).map(normalizeKeyword) as LocalKeywordIdea[];
      interface RawCluster {
        name?: string;
        description?: string;
        recommendedUse?: string;
        keywords?: unknown[];
      }
      
      parsed.keywordClusters = (parsed.keywordClusters as RawCluster[]).map((cluster) => ({
        name: cluster.name || "",
        description: cluster.description || "",
        recommendedUse: cluster.recommendedUse || "",
        keywords: ((cluster.keywords || []) as unknown[]).map(normalizeKeyword) as LocalKeywordIdea[],
      }));
    } catch (err) {
      console.error("Failed to parse final JSON from model:", err, finalContent);
      return apiErrorResponse(
        "The keyword strategy engine returned an invalid response. Please try again.",
        "UNKNOWN_ERROR",
        500
      );
    }

    return apiSuccessResponse(parsed);
  } catch (err) {
    console.error("Local keyword research API error:", err);
    return apiErrorResponse(
      "Something went wrong while generating your local keyword strategy. Please try again.",
      "UNKNOWN_ERROR",
      500
    );
  }
}

