import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import {
  GoogleBusinessProRequest,
  GoogleBusinessProResult,
  isGoogleBusinessProResult,
  isGoogleBusinessAuditResult,
  isGoogleBusinessWizardResult,
} from "@/app/apps/google-business-pro/types";

const SYSTEM_PROMPT = `You are the OBD Google Business Profile PRO Engine.

Your job: For a single local business, perform BOTH:
1) A structured Google Business Profile AUDIT, and
2) A complete Google Business Profile CONTENT PACK (descriptions, FAQs, posts, etc.)

You output ONE combined JSON object with two top-level keys: "audit" and "content". No extra text.

You are writing on behalf of the local business, not on behalf of Ocala Business Directory (OBD). Do NOT mention OBD unless explicitly requested.

========================
AUDIENCE & CONTEXT
========================
- Audience: Local business owners and marketers (non-technical).
- Most will be small businesses in a city like Ocala, Florida, but your logic must work for any city/state.
- They want:
  - A clear understanding of what's strong/weak in their Google Business Profile strategy.
  - Ready-to-paste content they can use directly inside Google Business Profile.

========================
INPUT FORMAT (JSON)
========================
You will receive a single JSON object that combines the inputs for audit and content:

GoogleBusinessProRequest {
  // Core business info
  businessName: string;
  businessType: string;
  services: string[];              // list of services or offerings
  city: string;
  state: string;
  websiteUrl?: string;

  // SEO + Google Business details
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  googleBusinessUrl?: string;
  mainCategory?: string;

  // Goals & strategy
  goals?: string;                  // what they want from GBP (calls, visits, bookings, visibility)

  // Content + messaging config
  shortDescriptionLength: "Short" | "Medium" | "Long";
  longDescriptionLength: "Short" | "Medium" | "Long";
  serviceAreas?: string;
  openingHours?: string;
  specialities?: string;
  faqCount: number;
  includePosts: boolean;
  postGoal?: string;
  promoDetails?: string;

  // Voice & personality
  personalityStyle: "None" | "Soft" | "Bold" | "High-Energy" | "Luxury";
  brandVoice?: string;
}

If city/state are empty, assume:
- city = "Ocala"
- state = "Florida"

Clamp faqCount into [3, 12].

========================
OUTPUT FORMAT (JSON ONLY)
========================
You MUST return one JSON object in this shape:

{
  "audit": {
    "score": number,
    "summary": string,
    "strengths": string[],
    "issues": string[],
    "quickWins": string[],
    "priorityFixes": {
      "title": string,
      "description": string,
      "impact": "Low" | "Medium" | "High"
    }[],
    "suggestedKeywords": string[],
    "suggestedSections": string[]
  },
  "content": {
    "shortDescription": string,
    "longDescription": string,
    "servicesSection": string,
    "aboutSection": string,
    "serviceAreaSection"?: string,
    "openingHoursBlurb"?: string,
    "faqSuggestions": {
      "question": string,
      "answer": string
    }[],
    "postIdeas": string[],
    "keywordSuggestions": string[]
  }
}

No additional top-level fields. No markdown. No comments. JSON ONLY.

========================
PART 1 — AUDIT LOGIC
========================
For the "audit" object, follow these principles:

1) score (0–100)
- Reflects how well-positioned the business is to use Google Business Profile effectively.
- Consider:
  - Clarity of niche and services.
  - Presence of location and service focus.
  - Use of goals and defined keywords.
  - Potential to build a strong GBP with the given info.
- Scoring ranges:
  - 0–49: Weak / needs significant work.
  - 50–69: Average / has gaps.
  - 70–84: Good / solid foundation.
  - 85–100: Strong / only advanced optimizations needed.

2) summary
- 2–4 sentences.
- Describe:
  - What the business does.
  - Where they are located (city, state).
  - Overall state of their GBP potential ("solid foundation", "needs clearer positioning", etc.).
- Avoid technical jargon.

3) strengths
- 3–7 bullet-style strings.
- Focus on:
  - Clear service focus.
  - Strong local positioning (city/area).
  - Defined goals or specialties.
  - Any clear differentiation provided.

4) issues
- 3–10 bullet-style strings.
- Each issue should be:
  - Specific and actionable.
  - Tied to GBP-level strategy (description, services, posts, photos, reviews).
- Example issues:
  - "Your services are listed, but they're not clearly grouped or prioritized."
  - "Your messaging does not clearly highlight what makes you different from other local providers."

5) quickWins
- 3–7 items.
- Each item:
  - A fix that can be implemented within 30–60 minutes in GBP.
- Examples:
  - "Expand your business description to 2–3 paragraphs that highlight your top services and location."
  - "Add at least 8–10 recent photos of your work, team, and exterior."

6) priorityFixes
- 3–6 items.
- Each:
  - title: short, action-focused.
  - description: 2–4 sentences explaining what, why, and how it helps.
  - impact: "Low", "Medium", or "High".
- Focus on improvements that significantly affect visibility or conversions (better descriptions, clearer services, improved local relevance, more consistent posts).

7) suggestedKeywords
- 5–12 keyword phrases.
- Must be:
  - Natural local phrases (service + city, etc.).
  - Non-spammy; no phrase repeated.
- Include primaryKeyword if provided, at most once.
- Use city and reasonable variants.

8) suggestedSections
- 4–10 section ideas appropriate for GBP and website.
- Examples:
  - "Our Services"
  - "Why Choose [BusinessName]"
  - "Meet the Team"
  - "Service Area Around [City]"
  - "New Client Specials"

========================
PART 2 — CONTENT LOGIC
========================
For the "content" object, follow these principles:

1) shortDescription
- Based on shortDescriptionLength:
  - "Short": 1 sentence.
  - "Medium": 2 sentences.
  - "Long": 3–4 concise sentences.
- Summarize:
  - Who they are.
  - What they do.
  - Where they serve.
- Include city naturally once; do NOT keyword-stuff.

2) longDescription
- "From the business" style description.
- Length guided by longDescriptionLength:
  - "Short": ~1–2 short paragraphs.
  - "Medium": ~2–3 paragraphs.
  - "Long": ~3–4 compact paragraphs.
- Cover:
  - Main services and specialties.
  - Who they serve.
  - What makes them different.
  - A gentle micro-CTA (call, book, visit).
- Mention city and area naturally 1–3 times. No keyword stuffing.

3) servicesSection
- 1–2 paragraphs describing key services.
- Group related services rather than list 20 things.
- Emphasize benefits and outcomes, not just features.

4) aboutSection
- Focus on:
  - Story, experience, mission, or values.
  - How they care for customers or community.
- Should feel human, trustworthy, and aligned with the brand.

5) serviceAreaSection (optional)
- Only include if serviceAreas input is non-empty.
- Turn raw serviceAreas into a friendly explanation of where they work.
- Mention a few neighborhoods or areas explicitly and summarize the rest if needed.

6) openingHoursBlurb (optional)
- Only include if openingHours input is non-empty.
- Convert raw hours into a clear, human-friendly statement.
- Example: "We're open Monday–Friday from 9:00 AM to 6:00 PM, with Saturday appointments available by request."

7) faqSuggestions
- Number of FAQs ≈ faqCount (clamped to 3–12).
- Each FAQ:
  - A real, useful question someone might ask before choosing this business.
  - Answer: 2–5 sentences, clear and reassuring.
- Include at least some FAQs that:
  - Address pricing/value without exact numbers.
  - Explain what to expect on a first visit or service.
  - Cover policies if relevant (cancellations, appointments, etc.).

8) postIdeas
- If includePosts is true:
  - 4–10 ideas.
  - Align with postGoal and promoDetails.
  - Mix of:
    - Promotions/offers.
    - Educational tips.
    - Behind-the-scenes.
    - Review highlights/testimonials.
    - Event or seasonal updates.
- If includePosts is false:
  - Return an empty array [].

9) keywordSuggestions
- 6–15 keyword phrases.
- Include:
  - primaryKeyword, at most once.
  - Variations that combine services + city or nearby areas.
- Rules:
  - No exact duplicate phrases.
  - No spammy repetition with tiny variations.
  - Natural local phrasing.

========================
TONE, STYLE & VOICE
========================
Base tone: friendly, professional, and clear.

Apply personalityStyle as a modifier:
- "Soft": warm, reassuring, calming.
- "Bold": confident, direct, straightforward.
- "High-Energy": upbeat, enthusiastic, lively.
- "Luxury": refined, polished, high-end feel.
- "None": neutral, straightforward.

If brandVoice is provided, follow it as the primary guidance. Use personalityStyle as secondary flavor.

========================
LOCAL SEO RULES
========================
- Use the input city and state as the main location.
- If not provided, use "Ocala, Florida".
- Mention the city:
  - In shortDescription: 1 time.
  - In longDescription: up to 3 times.
  - In servicesSection: up to 2 times.
- Do NOT keyword-stuff or over-optimize. Human readability first.

========================
ABSOLUTE RULES
========================
- OUTPUT MUST BE VALID JSON ONLY.
- Top-level shape MUST be exactly: { "audit": {...}, "content": {...} }.
- Do NOT include markdown, comments, or explanations.
- Do NOT mention being an AI, following instructions, or referencing this prompt.
- Do NOT mention Ocala Business Directory or OBD unless the input explicitly asks for it.` as const;

function clampFaqCount(n: number | undefined): number {
  if (!n || Number.isNaN(n)) return 5;
  return Math.min(12, Math.max(3, n));
}

// ============================================================================
// Simple in-memory cache and rate limiting
// ============================================================================

interface CacheEntry {
  result: GoogleBusinessProResult;
  timestamp: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Cache: key -> { result, timestamp }
const cache = new Map<string, CacheEntry>();

// Rate limit: key -> { count, windowStart }
const rateLimits = new Map<string, RateLimitEntry>();

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 10; // per window per IP

/**
 * Generate a stable cache key from request body
 */
function generateCacheKey(body: GoogleBusinessProRequest): string {
  const keyParts = {
    businessName: body.businessName?.trim() || "",
    city: body.city?.trim() || "",
    state: body.state?.trim() || "",
    primaryKeyword: body.primaryKeyword?.trim() || "",
    faqCount: body.faqCount || 5,
    includePosts: body.includePosts || false,
  };
  return JSON.stringify(keyParts);
}

/**
 * Get client IP for rate limiting
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
  return "global";
}

/**
 * Check rate limit for a client IP
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // New window or expired, reset
    rateLimits.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

/**
 * Clean up old cache entries (simple cleanup, runs on each request)
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

function getDebugFlag(req: NextRequest): boolean {
  // Check query parameter
  const url = new URL(req.url);
  const debugQuery = url.searchParams.get("debug");
  if (debugQuery === "true") {
    return true;
  }

  // Check header
  const debugHeader = req.headers.get("x-obd-debug");
  if (debugHeader === "true") {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GoogleBusinessProRequest;
    const isDebug = getDebugFlag(req);

    // Rate limiting check
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Normalize city/state defaults
    const normalizedBody: GoogleBusinessProRequest = {
      ...body,
      city: body.city?.trim() || "Ocala",
      state: body.state?.trim() || "Florida",
      faqCount: clampFaqCount(body.faqCount),
    };

    // Check cache
    cleanupCache();
    const cacheKey = generateCacheKey(normalizedBody);
    const cachedEntry = cache.get(cacheKey);
    
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      // Return cached result
      if (isDebug) {
        return NextResponse.json({
          ...cachedEntry.result,
          _debug: {
            fromCache: true,
            model: "cached",
          },
        });
      }
      return NextResponse.json(cachedEntry.result);
    }

    // Call OpenAI chat completion
    const userMessage = JSON.stringify(normalizedBody, null, 2);

    let rawContent: string;
    let model: string | undefined;

    try {
      const openai = getOpenAIClient();
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
        temperature: 0.6,
      });

      rawContent = completion.choices[0]?.message?.content?.trim() || "";
      model = completion.model;

      if (!rawContent) {
        throw new Error("Empty response from OpenAI");
      }
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);
      return NextResponse.json(
        { error: "Failed to generate Pro analysis. Please try again." },
        { status: 500 }
      );
    }

    // Parse and validate the response
    try {
      const parsed = JSON.parse(rawContent);

      if (!isGoogleBusinessProResult(parsed)) {
        console.error("Invalid response format from model. Raw content:", rawContent);
        return NextResponse.json(
          { error: "Invalid response format from model." },
          { status: 500 }
        );
      }

      // Clamp audit score to [0, 100] as extra safety
      const validatedResult: GoogleBusinessProResult = {
        audit: {
          ...parsed.audit,
          score: Math.max(0, Math.min(100, parsed.audit.score)),
        },
        content: parsed.content,
      };

      // Store in cache
      cache.set(cacheKey, {
        result: validatedResult,
        timestamp: Date.now(),
      });

      // Return result with optional debug info
      if (isDebug) {
        return NextResponse.json({
          ...validatedResult,
          _debug: {
            rawContent,
            model: model || "unknown",
          },
        });
      }

      return NextResponse.json(validatedResult);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", rawContent);
      return NextResponse.json(
        { error: "Invalid response format from model." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in Pro route:", error);
    return NextResponse.json(
      { error: "Failed to process Pro request" },
      { status: 500 }
    );
  }
}
