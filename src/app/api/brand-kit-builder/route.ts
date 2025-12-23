import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import OpenAI from "openai";
import { z } from "zod";
import {
  BrandKitBuilderRequest,
  BrandKitBuilderResponse,
} from "@/app/apps/brand-kit-builder/types";

const isDev = process.env.NODE_ENV !== "production";

// Rate limiting
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function getClientIP(req: Request): string {
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

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

const SYSTEM_PROMPT = `You are an expert brand identity consultant specializing in creating comprehensive brand kits for local businesses.

Your job is to transform raw brand information into a complete, actionable brand kit that ensures consistency across all marketing materials.

---

## INPUT FORMAT

You will receive a JSON object of type \`BrandKitBuilderRequest\`:

{
  "businessName": string,
  "businessType": string,
  "services": string[],
  "city": string,
  "state": string,
  "brandPersonality": "Friendly" | "Professional" | "Bold" | "High-Energy" | "Luxury" | "Trustworthy" | "Playful",
  "targetAudience"?: string,
  "differentiators"?: string,
  "inspirationBrands"?: string,
  "avoidStyles"?: string,
  "brandVoice"?: string,
  "toneNotes"?: string,
  "language": "English" | "Spanish" | "Bilingual",
  "industryKeywords"?: string,
  "vibeKeywords"?: string,
  "variationMode": "Conservative" | "Moderate" | "Bold",
  "includeHashtags": boolean,
  "hashtagStyle": "Local" | "Branded" | "Minimal",
  "includeSocialPostTemplates": boolean,
  "includeFAQStarter": boolean,
  "includeGBPDescription": boolean,
  "includeMetaDescription": boolean
}

---

## OUTPUT FORMAT

You MUST respond with a JSON object of type \`BrandKitBuilderResponse\`. 

**STRICT JSON SCHEMA:**

\`\`\`json
{
  "meta": {
    "model": "gpt-4o-mini",
    "createdAtISO": "2024-01-01T00:00:00.000Z",
    "latencyMs": 0,
    "requestId": "bkb-1234567890-abc123",
    "languageUsed": "English"
  },
  "brandSummary": {
    "businessName": "string",
    "tagline": "string (optional)",
    "positioning": "string"
  },
  "colorPalette": {
    "colors": [
      {
        "hex": "#RRGGBB",
        "name": "Primary" | "Secondary" | "Accent" | "Background" | "Text",
        "usageGuidance": "string",
        "accessibilityNote": "string"
      }
    ]
  },
  "typography": {
    "headlineFont": "string",
    "bodyFont": "string",
    "fallbackStack": "string",
    "usageNotes": "string"
  },
  "brandVoice": {
    "description": "string (1-2 paragraphs)",
    "do": ["string", "string", ...],
    "dont": ["string", "string", ...]
  },
  "messaging": {
    "taglines": ["string", "string", "string", "string", "string"],
    "valueProps": ["string", "string", "string", "string", "string"],
    "elevatorPitch": "string (80-120 words)"
  },
  "readyToUseCopy": {
    "websiteHero": {
      "headline": "string",
      "subheadline": "string"
    },
    "aboutUs": "string (150-220 words)",
    "socialBios": {
      "instagram": "string",
      "facebook": "string",
      "x": "string"
    },
    "emailSignature": "string"
  },
  "extras": {
    "socialPostTemplates": ["string", "string", "string"] (if includeSocialPostTemplates),
    "faqStarter": [{"question": "string", "answer": "string"}, ...] (if includeFAQStarter),
    "gbpDescription": "string (max 750 chars)" (if includeGBPDescription),
    "metaDescription": "string (140-160 chars)" (if includeMetaDescription)
  }
}
\`\`\`

You MUST respond with a JSON object of type \`BrandKitBuilderResponse\`:

{
  "meta": {
    "model": "gpt-4o-mini",
    "createdAtISO": "ISO 8601 string",
    "latencyMs": 0,
    "requestId": "unique-request-id",
    "languageUsed": "English" | "Spanish" | "Bilingual"
  },
  "brandSummary": {
    "businessName": string,
    "tagline"?: string,
    "positioning": string
  },
  "colorPalette": {
    "colors": [
      {
        "hex": "#RRGGBB",
        "name": "Primary" | "Secondary" | "Accent" | "Background" | "Text",
        "usageGuidance": string,
        "accessibilityNote": string
      }
    ] // MINIMUM 5 colors
  },
  "typography": {
    "headlineFont": string,
    "bodyFont": string,
    "fallbackStack": string,
    "usageNotes": string
  },
  "brandVoice": {
    "description": string, // 1-2 paragraphs
    "do": string[], // 5-8 items
    "dont": string[] // 5-8 items
  },
  "messaging": {
    "taglines": string[], // EXACTLY 5
    "valueProps": string[], // EXACTLY 5
    "elevatorPitch": string // 80-120 words
  },
  "readyToUseCopy": {
    "websiteHero": {
      "headline": string,
      "subheadline": string
    },
    "aboutUs": string, // 150-220 words
    "socialBios": {
      "instagram": string,
      "facebook": string,
      "x": string
    },
    "emailSignature": string
  },
  "extras"?: {
    "socialPostTemplates"?: string[], // 3 items if includeSocialPostTemplates
    "faqStarter"?: [{"question": string, "answer": string}], // 5 items if includeFAQStarter
    "gbpDescription"?: string, // 750 chars max if includeGBPDescription
    "metaDescription"?: string // 140-160 chars if includeMetaDescription
  }
}

---

## CRITICAL RULES

### 1) Language Rules

**English:**
- All content in English only.

**Spanish:**
- All content in Spanish only.
- Natural, conversational Spanish for local businesses.

**Bilingual:**
- Provide English first, then Spanish clearly separated.
- Format: "English: [text] | Spanish: [text]" or separate sections.

### 2) Brand Voice Priority

- If brandVoice is provided → use as PRIMARY guide.
- Otherwise use brandPersonality as primary guide.
- toneNotes provides additional flavor.
- Apply avoidStyles as constraints (e.g., no neon colors, avoid cursive fonts).

### 3) Keyword Limiting (STRICT)

- industryKeywords: Use MAXIMUM 1-2 mentions per output section total.
- NEVER keyword stuff or repeat keywords unnaturally.
- SEO should be natural and human-readable.

### 4) Color Palette Requirements

- MUST generate exactly 5 colors minimum:
  - Primary: Main brand color
  - Secondary: Complementary color
  - Accent: Highlight/CTA color
  - Background: Neutral background color
  - Text: Primary text color
- Each color needs:
  - Valid hex code (#RRGGBB format)
  - Usage guidance (when/where to use)
  - Accessibility note (contrast considerations, readability)

### 5) Typography Requirements

- Suggest headline font and body font pairing.
- Provide CSS fallback stack (e.g., "Inter, -apple-system, BlinkMacSystemFont, sans-serif").
- Include usage notes for when to use each font.

### 6) Output Lengths (STRICT)

- taglines: EXACTLY 5 options (each 4-12 words)
- valueProps: EXACTLY 5 bullets
- elevatorPitch: 80-120 words
- aboutUs: 150-220 words
- gbpDescription: 750 characters maximum
- metaDescription: 140-160 characters

### 7) Local Context

- If city/state indicates Ocala, Florida: reference naturally but don't overuse "Ocala".
- Consider local market in recommendations.
- Avoid generic big-city references.

### 8) Extras (Conditional)

- Only include extras if the corresponding toggle is true.
- socialPostTemplates: 3 short post templates
- faqStarter: 5 Q&A pairs
- gbpDescription: 750 chars max, SEO-friendly
- metaDescription: 140-160 chars, natural SEO

---

## PERSONALITY STYLES

Apply brandPersonality subtly:

- **Friendly**: Warm, approachable, conversational
- **Professional**: Trustworthy, polished, businesslike
- **Bold**: Confident, direct, attention-grabbing
- **High-Energy**: Upbeat, enthusiastic, dynamic
- **Luxury**: Refined, elegant, premium
- **Trustworthy**: Reliable, honest, dependable
- **Playful**: Fun, lighthearted, creative

---

## JSON ONLY

Your entire response MUST be a single valid JSON object.

- Do NOT wrap in markdown.
- Do NOT add explanations.
- Do NOT include comments.
- Do NOT include trailing commas.
- Set meta.createdAtISO to current ISO 8601 timestamp.
- Set meta.model to "gpt-4o-mini".
- Set meta.latencyMs to 0 (backend will update).
- Set meta.requestId to a unique identifier (e.g., "bkb-" + timestamp + "-" + random string).

If information is missing, make reasonable assumptions but still return a fully-formed response.`;

// Zod schemas
const colorInfoSchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  name: z.enum(["Primary", "Secondary", "Accent", "Background", "Text"]),
  usageGuidance: z.string(),
  accessibilityNote: z.string(),
});

const typographyPairingSchema = z.object({
  headlineFont: z.string(),
  bodyFont: z.string(),
  fallbackStack: z.string(),
  usageNotes: z.string(),
});

const brandVoiceGuideSchema = z.object({
  description: z.string(),
  do: z.array(z.string()).min(5).max(8),
  dont: z.array(z.string()).min(5).max(8),
});

const brandKitBuilderRequestSchema: z.ZodType<BrandKitBuilderRequest> = z.object({
  businessName: z.string().min(1),
  businessType: z.string().min(1),
  services: z.array(z.string()),
  city: z.string().default("Ocala"),
  state: z.string().default("Florida"),
  brandPersonality: z.enum([
    "Friendly",
    "Professional",
    "Bold",
    "High-Energy",
    "Luxury",
    "Trustworthy",
    "Playful",
  ]),
  targetAudience: z.string().optional(),
  differentiators: z.string().optional(),
  inspirationBrands: z.string().optional(),
  avoidStyles: z.string().optional(),
  brandVoice: z.string().optional(),
  toneNotes: z.string().optional(),
  language: z.enum(["English", "Spanish", "Bilingual"]),
  industryKeywords: z.string().optional(),
  vibeKeywords: z.string().optional(),
  variationMode: z.enum(["Conservative", "Moderate", "Bold"]),
  includeHashtags: z.boolean(),
  hashtagStyle: z.enum(["Local", "Branded", "Minimal"]),
  includeSocialPostTemplates: z.boolean(),
  includeFAQStarter: z.boolean(),
  includeGBPDescription: z.boolean(),
  includeMetaDescription: z.boolean(),
});

const brandKitBuilderResponseSchema: z.ZodType<BrandKitBuilderResponse> = z.object({
  meta: z.object({
    model: z.string(),
    createdAtISO: z.string(),
    latencyMs: z.number(),
    requestId: z.string(),
    languageUsed: z.enum(["English", "Spanish", "Bilingual"]),
  }),
  brandSummary: z.object({
    businessName: z.string(),
    tagline: z.string().optional(),
    positioning: z.string(),
  }),
  colorPalette: z.object({
    colors: z.array(colorInfoSchema).min(5),
  }),
  typography: typographyPairingSchema,
  brandVoice: brandVoiceGuideSchema,
  messaging: z.object({
    taglines: z.array(z.string()).length(5),
    valueProps: z.array(z.string()).length(5),
    elevatorPitch: z.string(),
  }),
  readyToUseCopy: z.object({
    websiteHero: z.object({
      headline: z.string(),
      subheadline: z.string(),
    }),
    aboutUs: z.string(),
    socialBios: z.object({
      instagram: z.string(),
      facebook: z.string(),
      x: z.string(),
    }),
    emailSignature: z.string(),
  }),
  extras: z
    .object({
      socialPostTemplates: z.array(z.string()).optional(),
      faqStarter: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .optional(),
      gbpDescription: z.string().optional(),
      metaDescription: z.string().optional(),
    })
    .optional(),
});

function extractAndParseJson(raw: string): unknown {
  const text = raw.trim();

  // Try direct parse first
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      // Fall through to extraction
    }
  }

  // Extract from markdown fences if present
  let cleaned = text;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object boundaries found in model response.");
  }

  const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice);
  } catch (err) {
    // Attempt repair: remove trailing commas
    const repaired = jsonSlice.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra || {}),
    },
    { status }
  );
}

function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `bkb-${timestamp}-${random}`;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    if (!process.env.OPENAI_API_KEY) {
      return errorResponse(
        "Server is not configured with an OpenAI API key.",
        500,
        { requestId }
      );
    }

    const json = await req.json().catch(() => null);
    if (!json) {
      return errorResponse("Invalid JSON body.", 400, { requestId });
    }

    // Validate input
    const parsed = brandKitBuilderRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse("Please fix the form errors.", 400, {
        issues: parsed.error.format(),
        requestId,
      });
    }

    let formValues = parsed.data;

    // Normalize form values
    formValues = {
      ...formValues,
      city: formValues.city || "Ocala",
      state: formValues.state || "Florida",
      variationMode: formValues.variationMode || "Conservative",
      // If includeHashtags is false, hashtagStyle doesn't matter, but ensure it's set
      hashtagStyle: formValues.includeHashtags
        ? formValues.hashtagStyle || "Local"
        : formValues.hashtagStyle || "Local",
    };

    // Rate limiting
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return errorResponse(
        "Rate limit exceeded. Please try again in a few minutes.",
        429,
        { requestId }
      );
    }

    // Call OpenAI
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 3000,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(formValues),
        },
      ],
      response_format: {
        type: "json_object",
      },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return errorResponse(
        `The AI did not return any content. Please try again.${isDev ? ` (Request ID: ${requestId})` : ""}`,
        500,
        { requestId }
      );
    }

    // Parse & validate JSON
    let parsedResponse: unknown;
    try {
      parsedResponse = extractAndParseJson(rawContent);
    } catch (err: unknown) {
      // Attempt repair via model (one attempt)
      console.warn("Initial JSON parse failed, attempting repair via model:", err);
      try {
        const repairCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.1,
          max_tokens: 100,
          messages: [
            {
              role: "system",
              content: "You are a JSON repair assistant. Fix the following invalid JSON by removing trailing commas, fixing quotes, and ensuring valid syntax. Return ONLY the fixed JSON, no explanation.",
            },
            {
              role: "user",
              content: `Fix this JSON:\n${rawContent.substring(0, 2000)}`,
            },
          ],
          response_format: { type: "json_object" },
        });

        const repairedContent = repairCompletion.choices[0]?.message?.content;
        if (repairedContent) {
          parsedResponse = extractAndParseJson(repairedContent);
        } else {
          throw new Error("Repair attempt returned no content");
        }
      } catch (repairErr) {
        return errorResponse(
          `There was a problem generating the brand kit. The AI response was not in a valid format. Please try again.${isDev ? ` (Request ID: ${requestId})` : ""}`,
          500,
          isDev
            ? {
                requestId,
                parseError: err instanceof Error ? err.message : String(err),
                repairError: repairErr instanceof Error ? repairErr.message : String(repairErr),
              }
            : { requestId }
        );
      }
    }

    const validated = brandKitBuilderResponseSchema.safeParse(parsedResponse);
    if (!validated.success) {
      return errorResponse(
        `The AI response was not in the expected format. Please try again.${isDev ? ` (Request ID: ${requestId})` : ""}`,
        500,
        isDev
          ? {
              requestId,
              validationIssues: validated.error.format(),
              rawContent: rawContent.substring(0, 500),
            }
          : { requestId }
      );
    }

    const result: BrandKitBuilderResponse = validated.data;
    const latency = Date.now() - startTime;

    // Normalization helper for meta description (140-160 chars)
    // GUARANTEES: result.length >= 140 && result.length <= 160
    function normalizeMetaDescription(
      text: string,
      fallbackContext: {
        businessName: string;
        businessType: string;
        city?: string;
        state?: string;
      }
    ): string {
      let result = text.trim();

      // Expand if too short (but ensure we don't exceed 160)
      if (result.length < 140) {
        const suffix = ` ${fallbackContext.businessName} is a trusted ${fallbackContext.businessType}${
          fallbackContext.city ? ` in ${fallbackContext.city}` : ""
        }${
          fallbackContext.state ? `, ${fallbackContext.state}` : ""
        }, delivering reliable service and quality results.`;

        const expanded = (result + suffix).trim();
        // Only use expanded if it fits within 160 chars
        if (expanded.length <= 160) {
          result = expanded;
        }
        // If expanded is too long, we'll handle truncation below
      }

      // Hard truncate to 160 chars (ensure we're within bounds)
      // Use safe "157 + ..." pattern to guarantee exactly 160 chars
      if (result.length > 160) {
        result = result.slice(0, 157).trimEnd() + "...";
        // After truncation, result.length should be exactly 160 (157 + 3)
        // But trimEnd might reduce it, so ensure it's at least 157 + 3 = 160
        if (result.length < 160) {
          result = result.slice(0, 157) + "...";
        }
      }

      // Final check: ensure minimum 140 chars
      // If still too short, pad with a natural continuation
      if (result.length < 140) {
        const needed = 140 - result.length;
        // Add a natural-sounding continuation instead of dots
        const continuation = ` Learn more about ${fallbackContext.businessName} and our ${fallbackContext.businessType} services.`;
        const withContinuation = (result + continuation).trim();
        
        if (withContinuation.length <= 160) {
          result = withContinuation;
        } else {
          // If continuation is too long, truncate the continuation part
          const maxContinuation = 160 - result.length;
          if (maxContinuation >= 10) {
            result = (result + continuation.slice(0, maxContinuation)).trim();
          } else {
            // Last resort: pad with spaces (better than dots)
            result = result + " ".repeat(needed);
          }
        }
        
        // Final safety: ensure we're still within bounds after padding
        if (result.length > 160) {
          result = result.slice(0, 157).trimEnd() + "...";
        }
        if (result.length < 140) {
          // Absolute fallback: pad to exactly 140
          result = result.padEnd(140, " ");
        }
      }

      // Final assertion: result MUST be 140-160 chars
      // This is a runtime guarantee
      if (result.length < 140 || result.length > 160) {
        console.error(`[normalizeMetaDescription] Invalid length: ${result.length}, text: ${result.substring(0, 50)}...`);
        // Force to valid range
        if (result.length < 140) {
          result = result.padEnd(140, " ");
        } else {
          result = result.slice(0, 157).trimEnd() + "...";
        }
      }

      return result;
    }

    // Normalize response to ensure requirements are met
    // Ensure color palette has at least 5 colors
    if (result.colorPalette.colors.length < 5) {
      const existingNames = new Set(result.colorPalette.colors.map(c => c.name));
      const fallbackColors: Array<{
        name: "Primary" | "Secondary" | "Accent" | "Background" | "Text";
        hex: string;
        usageGuidance: string;
        accessibilityNote: string;
      }> = [
        { name: "Primary", hex: "#2563EB", usageGuidance: "Primary brand color - use for main elements", accessibilityNote: "Fallback color - ensure sufficient contrast" },
        { name: "Secondary", hex: "#10B981", usageGuidance: "Secondary brand color - use for accents", accessibilityNote: "Fallback color - ensure sufficient contrast" },
        { name: "Accent", hex: "#F59E0B", usageGuidance: "Accent color - use for highlights and CTAs", accessibilityNote: "Fallback color - ensure sufficient contrast" },
        { name: "Background", hex: "#F9FAFB", usageGuidance: "Background color - use for page backgrounds", accessibilityNote: "Fallback color - ensure sufficient contrast" },
        { name: "Text", hex: "#1F2937", usageGuidance: "Text color - use for body text", accessibilityNote: "Fallback color - ensure sufficient contrast" },
      ];

      for (const fallback of fallbackColors) {
        if (result.colorPalette.colors.length >= 5) break;
        if (!existingNames.has(fallback.name)) {
          result.colorPalette.colors.push({
            hex: fallback.hex,
            name: fallback.name,
            usageGuidance: `${fallback.usageGuidance} (Fallback - auto-added)`,
            accessibilityNote: fallback.accessibilityNote,
          });
        }
      }
    }

    // Normalize taglines to exactly 5
    if (result.messaging.taglines.length < 5) {
      const safeFallbacks = [
        "Your trusted local partner",
        "Serving Ocala with excellence",
        "Where quality meets community",
        "Experience the difference",
        "Your satisfaction is our priority",
      ];
      while (result.messaging.taglines.length < 5) {
        const fallbackIndex = result.messaging.taglines.length;
        const fallback = safeFallbacks[fallbackIndex] || `Quality service for ${formValues.city || "your community"}`;
        result.messaging.taglines.push(fallback);
      }
    } else if (result.messaging.taglines.length > 5) {
      result.messaging.taglines = result.messaging.taglines.slice(0, 5);
    }

    // Normalize valueProps to exactly 5
    if (result.messaging.valueProps.length < 5) {
      const safeFallbacks = [
        "Quality service you can trust",
        "Dedicated to your satisfaction",
        "Professional and reliable",
        "Local expertise you can count on",
        "Committed to excellence",
      ];
      while (result.messaging.valueProps.length < 5) {
        const fallbackIndex = result.messaging.valueProps.length;
        const fallback = safeFallbacks[fallbackIndex] || "Excellence in every detail";
        result.messaging.valueProps.push(fallback);
      }
    } else if (result.messaging.valueProps.length > 5) {
      result.messaging.valueProps = result.messaging.valueProps.slice(0, 5);
    }

    // Truncate GBP description to 750 chars if it exists and exceeds limit
    if (result.extras?.gbpDescription && result.extras.gbpDescription.length > 750) {
      result.extras.gbpDescription = result.extras.gbpDescription.substring(0, 747) + "...";
    }

    // Normalize meta description to 140-160 chars
    if (result.extras?.metaDescription) {
      result.extras.metaDescription = normalizeMetaDescription(
        result.extras.metaDescription,
        {
          businessName: formValues.businessName,
          businessType: formValues.businessType,
          city: formValues.city,
          state: formValues.state,
        }
      );
    }

    // Update meta with actual values
    result.meta.latencyMs = latency;
    result.meta.createdAtISO = new Date().toISOString();
    result.meta.requestId = requestId;
    result.meta.model = "gpt-4o-mini";
    result.meta.languageUsed = formValues.language;

    return NextResponse.json(
      {
        ok: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Brand Kit Builder error:", err);

    if (err instanceof OpenAI.APIError) {
      return errorResponse(
        `OpenAI API error: ${err.message}${isDev ? ` (Request ID: ${requestId})` : ""}`,
        500,
        {
          requestId,
          ...(isDev
            ? {
                code: err.code,
                type: err.type,
                status: err.status,
              }
            : {}),
        }
      );
    }

    if ((err as { name?: string })?.name === "AbortError" || (err as { code?: string })?.code === "ECONNABORTED") {
      return errorResponse("Request timed out. Please try again.", 504, { requestId });
    }

    return errorResponse(
      `Something went wrong while generating your brand kit.${isDev ? ` (Request ID: ${requestId})` : ""}`,
      500,
      {
        requestId,
        ...(isDev
          ? {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            }
          : {}),
      }
    );
  }
}
