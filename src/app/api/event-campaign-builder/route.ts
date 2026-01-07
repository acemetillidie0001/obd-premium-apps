// src/app/api/event-campaign-builder/route.ts
import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse } from "@/lib/api/errorHandler";
import { withOpenAITimeout } from "@/lib/openai-timeout";
import { apiLogger } from "@/lib/api/logger";
import OpenAI from "openai";
import { z } from "zod";
import {
  EventCampaignFormValues,
  EventCampaignResponse,
} from "@/app/apps/event-campaign-builder/types";

export const runtime = "nodejs";

const isDev = process.env.NODE_ENV !== "production";

// Rate limiting is handled by shared utility (src/lib/api/rateLimit.ts)

// TODO: Paste your full system prompt here (the big one we wrote)
const SYSTEM_PROMPT = `You are an expert event marketing copywriter for local businesses in Ocala, Florida.

You generate COMPLETE, READY-TO-POST **event promo campaigns** across multiple channels based on structured JSON input.

You ALWAYS respond with a single valid JSON object that matches the \`EventCampaignResponse\` TypeScript interface below. You NEVER include markdown, backticks, comments, or any text outside the JSON itself.

---

## INPUT FORMAT

You will receive a JSON object of type \`EventCampaignFormValues\` with the following shape:

{
  "businessName": string,
  "businessType": string,
  "services": string,
  "city": string,
  "state": string,

  "eventName": string,
  "eventDate": string,
  "eventTime": string,
  "eventLocation": string,
  "eventType": "InPerson" | "Virtual" | "Hybrid",
  "eventDescription": string,

  "audience": string,
  "mainGoal": "Awareness" | "RSVPs" | "TicketSales" | "WalkIns" | "Leads" | "Other",
  "budgetLevel": "Free" | "Low" | "Moderate" | "Premium",
  "urgencyLevel": "Normal" | "Last-Minute",

  "brandVoice": string,
  "personalityStyle": "None" | "Soft" | "Bold" | "High-Energy" | "Luxury",
  "language": "English" | "Spanish" | "Bilingual",

  "includeFacebook": boolean,
  "includeInstagram": boolean,
  "includeX": boolean,
  "includeGoogleBusiness": boolean,
  "includeEmail": boolean,
  "includeSms": boolean,
  "includeImageCaption": boolean,

  "campaignDurationDays": number,
  "notesForAI": string
}

Assume:
- The business is local unless otherwise stated.
- If city/state are "Ocala" and "Florida", lean into Ocala-local flavor (community, neighborhoods, local pride) but avoid overusing the word "Ocala".

---

## OUTPUT FORMAT

You MUST respond with a JSON object of type \`EventCampaignResponse\`:

{
  "meta": {
    "primaryTagline": string,
    "primaryCallToAction": string,
    "recommendedStartDateNote": string,
    "timezoneNote": string
  },
  "assets": {
    "eventTitles": string[],
    "shortDescriptions": string[],
    "longDescription": string,

    "facebookPosts": string[],
    "instagramCaptions": string[],
    "instagramStoryIdeas": string[],
    "xPosts": string[],
    "googleBusinessPosts": string[],

    "emailAnnouncement"?: {
      "subject": string,
      "previewText": string,
      "bodyText": string,
      "bodyHtml": string
    },

    "smsBlasts"?: string[],
    "imageCaption"?: string,

    "hashtagBundles": {
      "platform": "Facebook" | "Instagram" | "X" | "GoogleBusiness" | "Generic",
      "tags": string[]
    }[],

    "scheduleIdeas": {
      "dayOffset": number,
      "label": string,
      "channel": string,
      "suggestion": string
    }[]
  }
}

RULES FOR OPTIONAL FIELDS:
- If \`includeEmail\` is false, either omit \`emailAnnouncement\` or set it to null.
- If \`includeSms\` is false, either omit \`smsBlasts\` or return an empty array.
- If \`includeImageCaption\` is false, omit \`imageCaption\`.
- All array fields (\`eventTitles\`, \`shortDescriptions\`, etc.) MUST be present but may be empty arrays if the channel is not included.

---

## CONTENT RULES

### 1) Language

Respect the \`language\` field:

- "English": All content in English.
- "Spanish": All content in Spanish.
- "Bilingual":
  - For major text fields (titles, descriptions, posts, email subject/body, SMS), provide BOTH languages in this format:
    - "English: ... \\nEspañol: ..."
  - Hashtags can be mostly English with a few Spanish tags when appropriate.

Never mix languages randomly. Be intentional and readable.

### 2) Personality Style

Use \`personalityStyle\` to influence tone:

- "None": Neutral, clear, professional.
- "Soft": Warm, friendly, reassuring.
- "Bold": Confident, direct, punchy.
- "High-Energy": Upbeat, enthusiastic, fast-paced.
- "Luxury": Refined, elegant, premium.

If \`brandVoice\` is non-empty, treat it as primary guidance and use \`personalityStyle\` only as a subtle flavor.

### 3) Local Context (Ocala, Florida)

When city and state indicate Ocala, Florida:

- Reference the local community in a tasteful way: "our Ocala neighbors", "local community", "here in Central Florida".
- Do NOT overstuff "Ocala" in every sentence.
- Avoid generic big-city references that don't fit a mid-sized, local market.

### 4) Channels

Use channel toggles:

- If includeFacebook = false, \`facebookPosts\` should be [].
- If includeInstagram = false, \`instagramCaptions\` and \`instagramStoryIdeas\` can be [].
- If includeX = false, \`xPosts\` = [].
- If includeGoogleBusiness = false, \`googleBusinessPosts\` = [].
- If includeEmail = false, omit or null \`emailAnnouncement\`.
- If includeSms = false, omit or [] for \`smsBlasts\`.
- If includeImageCaption = false, omit \`imageCaption\`.

### 5) Field-by-field guidance

**meta.primaryTagline**
- 1 sentence.
- Captures the essence of the event and why someone should care.

**meta.primaryCallToAction**
- Short imperative phrase like:
  - "Reserve your spot today."
  - "RSVP now and bring a friend."
  - "Grab your tickets before they sell out."

**meta.recommendedStartDateNote**
- 1–2 sentences about when to start promoting based on \`urgencyLevel\` and \`campaignDurationDays\`.

**meta.timezoneNote**
- Default: "All times are in Eastern Time (Ocala, Florida)."

**assets.eventTitles**
- 3–7 strong options.
- Mix of straightforward and creative.
- Avoid clickbait and all caps.

**assets.shortDescriptions**
- 2–4 blurbs (1–2 sentences each).
- Focus on what, who it's for, and key benefit.

**assets.longDescription**
- 2–4 short paragraphs.
- Include what will happen, who it's for, and what attendees walk away with.
- If ticket sales or RSVPs are likely, include a gentle CTA.

**Channel-specific content:**

- \`facebookPosts\`:
  - 2–4 posts.
  - Friendly, community-focused.
  - Mix of early promo and "last chance" if urgencyLevel = "Last-Minute".

- \`instagramCaptions\`:
  - 2–4 captions for feed posts.
  - Use line breaks, a conversational tone, and 1–3 emojis max per caption (if language and style fit).

- \`instagramStoryIdeas\`:
  - 3–6 short prompts or captions for Stories.
  - Example: "Behind-the-scenes setup + poll: 'Coming to our workshop?'"

- \`xPosts\`:
  - 2–4 concise posts.
  - Clear and to the point, with 0–2 hashtags.

- \`googleBusinessPosts\`:
  - 1–3 posts.
  - Professional, informative, focused on local value and key details.

**EmailAnnouncement (if included):**
- \`subject\`: Compelling but not spammy; avoid all caps and excessive punctuation.
- \`previewText\`: 1 short sentence that teases the value of opening.
- \`bodyText\`: Plain-text email body, 3–6 short paragraphs, with a clear CTA.
- \`bodyHtml\`: HTML version of the same content using basic tags only (<p>, <strong>, <br>, <ul>, <li>). No inline styles.

**smsBlasts (if included):**
- 2–4 options.
- Around 140 characters or less.
- Include event name or key hook + clear CTA + timing note if relevant.
- Avoid all caps and over-promising.

**imageCaption (if included):**
- 1–2 sentences.
- Suitable as text on a flyer or social image overlay.

**hashtagBundles:**
- At least 2–3 bundles.
- Example platforms: "Facebook", "Instagram", "X", "GoogleBusiness", "Generic".
- 5–12 hashtags per bundle.
- Mix of:
  - Branded tags (based on businessName/eventName).
  - Local tags (e.g., #OcalaEvents, #OcalaFlorida).
  - Relevant category tags (e.g., #WineTasting, #SmallBusiness, #FamilyFriendly).
- Avoid repetitive keyword stuffing and long, unreadable tags.

**scheduleIdeas:**
- 4–8 ideas.
- Vary by \`dayOffset\`: e.g., 10, 7, 3, 1, 0 days before the event.
- \`label\`: human-readable like "10 days before the event".
- \`channel\`: e.g., "Facebook", "Instagram Feed", "Instagram Stories", "Email", "SMS".
- \`suggestion\`: one concise sentence describing the type of content to post.

---

## STYLE & COMPLIANCE

- Be honest and realistic. No guarantees, no misleading claims.
- Avoid sensitive or controversial topics.
- No profanity, no adult content, no discriminatory language.
- Respect that this is for a real local business.

---

## JSON ONLY

Your entire response MUST be a single valid JSON object conforming to \`EventCampaignResponse\`.

- Do NOT wrap it in markdown.
- Do NOT add explanations.
- Do NOT include comments.
- Do NOT include trailing commas.

If some information is missing from the input, make reasonable assumptions and continue, but still return a fully-formed \`EventCampaignResponse\` object.`;

// ---- ZOD SCHEMAS FOR RUNTIME VALIDATION ---- //

const eventCampaignFormSchema: z.ZodType<EventCampaignFormValues> = z.object({
  businessName: z.string().min(1, "Business name is required."),
  businessType: z.string().min(1, "Business type is required."),
  services: z.string().default(""),

  city: z.string().default("Ocala"),
  state: z.string().default("Florida"),

  eventName: z.string().min(1, "Event name is required."),
  eventDate: z.string().min(1, "Event date is required."),
  eventTime: z.string().min(1, "Event time is required."),
  eventLocation: z.string().min(1, "Event location is required."),
  eventType: z.enum(["InPerson", "Virtual", "Hybrid"]),

  eventDescription: z
    .string()
    .min(10, "Please provide a bit more detail about the event."),

  audience: z.string().default(""),
  mainGoal: z.enum([
    "Awareness",
    "RSVPs",
    "TicketSales",
    "WalkIns",
    "Leads",
    "Other",
  ]),
  budgetLevel: z.enum(["Free", "Low", "Moderate", "Premium"]),
  urgencyLevel: z.enum(["Normal", "Last-Minute"]),

  brandVoice: z.string().default(""),
  personalityStyle: z.enum(["None", "Soft", "Bold", "High-Energy", "Luxury"]),
  language: z.enum(["English", "Spanish", "Bilingual"]),

  includeFacebook: z.boolean().default(true),
  includeInstagram: z.boolean().default(true),
  includeX: z.boolean().default(false),
  includeGoogleBusiness: z.boolean().default(true),
  includeEmail: z.boolean().default(false),
  includeSms: z.boolean().default(false),
  includeImageCaption: z.boolean().default(false),

  campaignDurationDays: z
    .number()
    .int()
    .min(3)
    .max(30)
    .default(10),
  notesForAI: z.string().default(""),
});

// We don't need to validate every nested string content,
// but we DO want to guard against totally malformed responses.
const hashtagBundleSchema = z.object({
  platform: z.enum([
    "Facebook",
    "Instagram",
    "X",
    "GoogleBusiness",
    "Generic",
  ]),
  tags: z.array(z.string()),
});

const scheduleIdeaSchema = z.object({
  dayOffset: z.number().int(),
  label: z.string(),
  channel: z.string(),
  suggestion: z.string(),
});

const emailAnnouncementSchema = z.object({
  subject: z.string(),
  previewText: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string(),
});

const eventCampaignResponseSchema: z.ZodType<EventCampaignResponse> = z.object({
  meta: z.object({
    primaryTagline: z.string(),
    primaryCallToAction: z.string(),
    recommendedStartDateNote: z.string(),
    timezoneNote: z.string(),
  }),
  assets: z.object({
    eventTitles: z.array(z.string()),
    shortDescriptions: z.array(z.string()),
    longDescription: z.string(),

    facebookPosts: z.array(z.string()),
    instagramCaptions: z.array(z.string()),
    instagramStoryIdeas: z.array(z.string()),
    xPosts: z.array(z.string()),
    googleBusinessPosts: z.array(z.string()),

    emailAnnouncement: emailAnnouncementSchema.optional(),
    smsBlasts: z.array(z.string()).optional(),
    imageCaption: z.string().optional(),

    hashtagBundles: z.array(hashtagBundleSchema),
    scheduleIdeas: z.array(scheduleIdeaSchema),
  }),
});

// ---- SMALL HELPERS ---- //

/**
 * Clamp campaignDurationDays into a safe range.
 */
function normalizeFormValues(
  data: EventCampaignFormValues,
): EventCampaignFormValues {
  const clampedDays = Math.min(Math.max(data.campaignDurationDays || 10, 3), 30);

  return {
    ...data,
    city: data.city || "Ocala",
    state: data.state || "Florida",
    campaignDurationDays: clampedDays,
  };
}

/**
 * Parse JSON from OpenAI response.
 * 
 * With response_format: { type: "json_object" }, the model should return pure JSON.
 * This function tries direct parsing first, then falls back to extraction if needed
 * (e.g., if the model occasionally adds whitespace or formatting).
 */
function extractAndParseJson(raw: string): Record<string, unknown> {
  const text = raw.trim();

  // With JSON mode enabled, try direct parse first (most common case)
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      // Fall through to extraction if direct parse fails
    }
  }

  // Fallback: Extract JSON from markdown code fences or other wrappers
  // (Should rarely be needed with JSON mode, but kept as safety net)
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
  return JSON.parse(jsonSlice);
}

function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(isDev && extra ? { debug: extra } : {}),
    },
    { status },
  );
}

// ---- MAIN HANDLER ---- //

export async function POST(req: Request) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(req as any);
  if (demoBlock) return demoBlock;

  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  apiLogger.info("event-campaign-builder.request.start");

  try {
    const json = await req.json().catch(() => null);
    if (!json) {
      return errorResponse("Invalid JSON body.", 400);
    }

    // 1) Validate and normalize input
    const parsed = eventCampaignFormSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const formValues = normalizeFormValues(parsed.data);

    // 2) Validate at least one channel is enabled
    if (
      !formValues.includeFacebook &&
      !formValues.includeInstagram &&
      !formValues.includeX &&
      !formValues.includeGoogleBusiness &&
      !formValues.includeEmail &&
      !formValues.includeSms
    ) {
      return errorResponse(
        "At least one channel must be enabled.",
        400,
      );
    }

    // Check for demo mode - return canned sample instead of calling OpenAI
    const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
    if (isDemoRequest(req as any)) {
      const demoResponse = {
        campaignName: formValues.eventName || "Special Event",
        summary: "Event campaign for Ocala community",
        channels: {
          ...(formValues.includeFacebook ? {
            facebook: {
              post: "Join us for our special event! We're excited to share this with the Ocala community.",
              cta: "Learn more and RSVP today!",
            },
          } : {}),
          ...(formValues.includeInstagram ? {
            instagram: {
              post: "Exciting event coming up! ✨ Join us for this special occasion.",
              cta: "Save the date!",
            },
          } : {}),
        },
      };
      return apiSuccessResponse(demoResponse);
    }

    // 3) Rate limiting check
    const rateLimitCheck = await checkRateLimit(req);
    if (rateLimitCheck) {
      return rateLimitCheck;
    }

    if (!process.env.OPENAI_API_KEY) {
      apiLogger.error("event-campaign-builder.openai-key-missing");
      return errorResponse(
        "Server is not configured with an OpenAI API key.",
        500,
      );
    }

    // 4) Calculate dynamic token limit based on language and channels
    // Bilingual responses with email/SMS can be very long
    const isBilingual = formValues.language === "Bilingual";
    const hasEmailOrSms = formValues.includeEmail || formValues.includeSms;
    const maxTokens = isBilingual && hasEmailOrSms ? 3000 : 2200;

    // 5) Call OpenAI
    // Configuration:
    // - model: gpt-4o-mini (cost-effective, fast, good for structured JSON output)
    // - temperature: 0.7 (balanced creativity vs consistency for marketing copy)
    // - max_tokens: Dynamic (2200 for standard, 3000 for bilingual + email/SMS)
    // - response_format: json_object (ensures strict JSON output, reduces parsing errors)
    const openai = getOpenAIClient();
    const completion = await withOpenAITimeout(async (signal) => {
      return openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7, // Slightly more deterministic than 0.8
        max_tokens: maxTokens,
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
          type: "json_object", // Enforces JSON-only output, reduces markdown wrapping issues
        },
      }, { signal });
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      apiLogger.error("event-campaign-builder.openai-empty-response");
      return errorResponse(
        "The AI did not return any content. Please try again.",
        500,
      );
    }

    // 6) Parse & validate JSON
    // With response_format: json_object, the response should be pure JSON,
    // but we use extractAndParseJson as a safety net for edge cases.
    let parsedResponse: unknown;
    try {
      parsedResponse = extractAndParseJson(rawContent);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return errorResponse(
        "There was a problem generating the campaign. Please try again.",
        500,
        { parseError: errorMessage },
      );
    }

    // Pre-process the response to handle common AI response issues with optional fields
    // Convert null values to undefined for optional fields (schema expects undefined, not null)
    if (parsedResponse && typeof parsedResponse === 'object' && 'assets' in parsedResponse) {
      const assets = (parsedResponse as any).assets;
      if (assets) {
        // Handle SMS field
        if ('smsBlasts' in assets) {
          if (assets.smsBlasts === null) {
            delete assets.smsBlasts;
          } else if (!Array.isArray(assets.smsBlasts)) {
            assets.smsBlasts = typeof assets.smsBlasts === 'string' ? [assets.smsBlasts] : [];
          }
        }
        
        // Handle emailAnnouncement field - convert null to undefined
        if ('emailAnnouncement' in assets && assets.emailAnnouncement === null) {
          delete assets.emailAnnouncement;
        }
        
        // Handle imageCaption field - convert null to undefined
        if ('imageCaption' in assets && assets.imageCaption === null) {
          delete assets.imageCaption;
        }
      }
    }

    const validated = eventCampaignResponseSchema.safeParse(parsedResponse);
    if (!validated.success) {
      // Log validation errors for debugging
      apiLogger.error("event-campaign-builder.validation-failed", {
        errorCount: validated.error.issues.length,
        errorPaths: validated.error.issues.slice(0, 5).map(issue => issue.path.join('.')),
        responseLength: rawContent.length,
      });
      
      // Try to provide a more helpful error message by identifying the issue
      const errorIssues = validated.error.issues;
      const errorPaths: string[] = [];
      
      errorIssues.forEach(issue => {
        const path = issue.path.join('.') || 'root';
        errorPaths.push(path);
      });
      
      // Build detailed error message with specific field issues
      const firstFewIssues = validated.error.issues.slice(0, 3);
      let detailedError = "The AI response was not in the expected format.\n";
      
      firstFewIssues.forEach((issue, idx) => {
        const path = issue.path.join('.') || 'root';
        detailedError += `\n${idx + 1}. Field "${path}": ${issue.message}`;
      });
      
      if (validated.error.issues.length > 3) {
        detailedError += `\n... and ${validated.error.issues.length - 3} more issue(s)`;
      }
      
      detailedError += "\n\nPlease try again.";
      
      // Always include debug info in development, but also include a summary in production
      const debugInfo = {
        validationIssues: validated.error.format(),
        errorPaths: errorPaths.slice(0, 10),
        parsedKeys: Object.keys(parsedResponse as Record<string, unknown>),
        rawContentPreview: rawContent.substring(0, 1000), // First 1000 chars
        topIssues: firstFewIssues.map(issue => ({
          path: issue.path.join('.') || 'root',
          message: issue.message,
          code: issue.code,
        })),
      };
      
      return errorResponse(
        detailedError,
        500,
        isDev ? debugInfo : { 
          errorPaths: errorPaths.slice(0, 5),
          topIssues: debugInfo.topIssues,
        },
      );
    }

    const result: EventCampaignResponse = validated.data;

    // 7) Enforce channel toggles on the final output (extra safety layer)
    const assets = result.assets;
    const enforcedResult: EventCampaignResponse = {
      meta: result.meta,
      assets: {
        ...assets,
        facebookPosts: formValues.includeFacebook ? assets.facebookPosts : [],
        instagramCaptions: formValues.includeInstagram
          ? assets.instagramCaptions
          : [],
        instagramStoryIdeas: formValues.includeInstagram
          ? assets.instagramStoryIdeas
          : [],
        xPosts: formValues.includeX ? assets.xPosts : [],
        googleBusinessPosts: formValues.includeGoogleBusiness
          ? assets.googleBusinessPosts
          : [],
        emailAnnouncement: formValues.includeEmail
          ? assets.emailAnnouncement
          : undefined,
        smsBlasts: formValues.includeSms 
          ? (assets.smsBlasts && Array.isArray(assets.smsBlasts) ? assets.smsBlasts : [])
          : undefined,
        imageCaption: formValues.includeImageCaption
          ? assets.imageCaption
          : undefined,
      },
    };

    apiLogger.info("event-campaign-builder.request.success", {
      channelsEnabled: {
        facebook: formValues.includeFacebook,
        instagram: formValues.includeInstagram,
        x: formValues.includeX,
        googleBusiness: formValues.includeGoogleBusiness,
        email: formValues.includeEmail,
        sms: formValues.includeSms,
      },
    });

    return apiSuccessResponse(enforcedResult);
  } catch (error) {
    apiLogger.error("event-campaign-builder.request.error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error);
  }
}
