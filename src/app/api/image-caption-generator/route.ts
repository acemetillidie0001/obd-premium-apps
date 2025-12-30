import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse } from "@/lib/api/errorHandler";
import { withOpenAITimeout } from "@/lib/openai-timeout";
import { apiLogger } from "@/lib/api/logger";
import { z } from "zod";

export const runtime = "nodejs";

interface ImageCaptionRequest {
  businessName?: string;
  businessType?: string;
  services?: string | string[];
  city?: string;
  state?: string;
  imageContext?: string;
  imageDetails?: string;
  platform?: "Facebook" | "Instagram" | "InstagramStory" | "GoogleBusinessProfile" | "X" | "Generic";
  goal?: "Awareness" | "Promotion" | "Event" | "Testimonial" | "BehindTheScenes" | "Educational";
  callToActionPreference?: "Soft" | "Direct" | "None";
  brandVoice?: string;
  personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury" | "";
  captionLength?: "Short" | "Medium" | "Long";
  includeHashtags?: boolean;
  hashtagStyle?: "Local" | "Branded" | "Mixed";
  variationsCount?: number;
  variationMode?: "Safe" | "Creative" | "Storytelling" | "Punchy";
  language?: "English" | "Spanish" | "Bilingual";
}

interface Caption {
  id: number;
  label: string;
  lengthMode: "Short" | "Medium" | "Long";
  variationMode: "Safe" | "Creative" | "Storytelling" | "Punchy";
  platform: "Facebook" | "Instagram" | "InstagramStory" | "GoogleBusinessProfile" | "X" | "Generic";
  text: string;
  hashtags: string[];
  previewHint: string;
}

interface ImageCaptionResponse {
  captions: Caption[];
  meta: {
    businessName: string;
    city: string;
    state: string;
    platform: string;
    goal: string;
    captionLength: string;
    includeHashtags: boolean;
    variationMode: string;
    language: string;
  };
}

// Zod schema for request validation
const imageCaptionRequestSchema = z.object({
  businessName: z.string().max(200).optional(),
  businessType: z.string().max(200).optional(),
  services: z.union([z.string().max(1000), z.array(z.string()).max(50)]).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  imageContext: z.string().min(1, "Image context is required").max(1000),
  imageDetails: z.string().max(1000).optional(),
  platform: z.enum(["Facebook", "Instagram", "InstagramStory", "GoogleBusinessProfile", "X", "Generic"]).optional(),
  goal: z.enum(["Awareness", "Promotion", "Event", "Testimonial", "BehindTheScenes", "Educational"]).optional(),
  callToActionPreference: z.enum(["Soft", "Direct", "None"]).optional(),
  brandVoice: z.string().max(1000).optional(),
  personalityStyle: z.enum(["Soft", "Bold", "High-Energy", "Luxury", ""]).optional(),
  captionLength: z.enum(["Short", "Medium", "Long"]).optional(),
  includeHashtags: z.boolean().optional(),
  hashtagStyle: z.enum(["Local", "Branded", "Mixed"]).optional(),
  variationsCount: z.number().int().min(1).max(5).optional(),
  variationMode: z.enum(["Safe", "Creative", "Storytelling", "Punchy"]).optional(),
  language: z.enum(["English", "Spanish", "Bilingual"]).optional(),
});

async function generateImageCaptions(request: ImageCaptionRequest): Promise<ImageCaptionResponse> {
  // Normalize services to string
  const servicesStr = Array.isArray(request.services)
    ? request.services.join(", ")
    : request.services || "";

  // Build user message with all fields
  const fields: string[] = [];
  
  if (request.businessName) fields.push(`businessName: ${request.businessName}`);
  if (request.businessType) fields.push(`businessType: ${request.businessType}`);
  if (servicesStr) fields.push(`services: ${servicesStr}`);
  if (request.city) fields.push(`city: ${request.city}`);
  if (request.state) fields.push(`state: ${request.state}`);
  if (request.imageContext) fields.push(`imageContext: ${request.imageContext}`);
  if (request.imageDetails) fields.push(`imageDetails: ${request.imageDetails}`);
  if (request.platform) fields.push(`platform: ${request.platform}`);
  if (request.goal) fields.push(`goal: ${request.goal}`);
  if (request.callToActionPreference) fields.push(`callToActionPreference: ${request.callToActionPreference}`);
  if (request.brandVoice) fields.push(`brandVoice: ${request.brandVoice}`);
  if (request.personalityStyle) fields.push(`personalityStyle: ${request.personalityStyle}`);
  if (request.captionLength) fields.push(`captionLength: ${request.captionLength}`);
  if (request.includeHashtags !== undefined) fields.push(`includeHashtags: ${request.includeHashtags}`);
  if (request.hashtagStyle) fields.push(`hashtagStyle: ${request.hashtagStyle}`);
  if (request.variationsCount !== undefined) fields.push(`variationsCount: ${request.variationsCount}`);
  if (request.variationMode) fields.push(`variationMode: ${request.variationMode}`);
  if (request.language) fields.push(`language: ${request.language}`);

  const userMessage = fields.join("\n");

  const openai = getOpenAIClient();
  const completion = await withOpenAITimeout(async (signal) => {
    return openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are **OBD AI Image Caption Generator V3**, a specialized caption writer for the Ocala Business Directory (OBD). Your job is to create on-brand, high-converting image captions for local Ocala businesses, ready to paste into Facebook, Instagram, Google Business Profile, and X.

You ALWAYS follow:
- The JSON input format
- The caption rules for length, brand voice, personality, emoji usage, and hashtags
- The JSON output format exactly (no extra keys, no trailing commas, valid JSON)

====================================
1) INPUT FORMAT (JSON YOU RECEIVE)
====================================

You will receive a single JSON object with this shape:

{
  "businessName": "string",
  "businessType": "string",
  "services": ["string"],
  "city": "string",
  "state": "string",
  "imageContext": "string",
  "imageDetails": "string",
  "platform": "Facebook" | "Instagram" | "InstagramStory" | "GoogleBusinessProfile" | "X" | "Generic",
  "goal": "Awareness" | "Promotion" | "Event" | "Testimonial" | "BehindTheScenes" | "Educational",
  "callToActionPreference": "Soft" | "Direct" | "None",
  "brandVoice": "string | empty",
  "personalityStyle": "Soft" | "Bold" | "High-Energy" | "Luxury" | "",
  "captionLength": "Short" | "Medium" | "Long",
  "includeHashtags": true | false,
  "hashtagStyle": "Local" | "Branded" | "Mixed",
  "variationsCount": number,        // 1–5, clamp if needed
  "variationMode": "Safe" | "Creative" | "Storytelling" | "Punchy",
  "language": "English" | "Spanish" | "Bilingual"
}

Notes:
- If city or state is missing, assume: city = "Ocala", state = "Florida".
- If variationMode is missing, treat it as "Safe".
- If personalityStyle is missing but brandVoice is present, lean fully into brandVoice.

====================================
2) GLOBAL CAPTION RULES (V3)
====================================

2.1 General style
- Write like a real local business, not a robot.
- Plain-language, conversational, and clear.
- Avoid buzzword soup and generic fluff.
- No keyword stuffing. Local/SEO words appear naturally 1–2 times max.

2.2 Local focus
- When city or state is provided (e.g., Ocala, Florida), gently weave it into 1–2 places max.
- Focus on the LOCAL angle: community, neighborhood, nearby, local pride, etc.
- Never mention competing directories or platforms. You can reference "our Ocala community" but not Yelp, etc.

2.3 Platform awareness
- Facebook: full sentences, friendly, 2–4 short lines; emojis ok but not overdone.
- Instagram: more expressive; strong hooks; emojis used naturally; line breaks allowed.
- InstagramStory: punchy, ultra-short, high-impact; more emoji-friendly.
- GoogleBusinessProfile: professional, clear, slightly more informative; minimal emojis if any.
- X: short, punchy, 1–2 sentences; light emojis; no long paragraphs.
- Generic: neutral style that would fit most platforms.

2.4 CTA logic
- "Soft": gentle invitations (e.g., "Come see us this week," "We'd love to welcome you in Ocala.")
- "Direct": clear CTA (e.g., "Book your appointment today," "Call us to schedule your visit.")
- "None": no explicit CTA; focus on story, feeling, or value.

2.5 Language
- English: captions are entirely in English.
- Spanish: captions are entirely in natural, friendly Spanish.
- Bilingual: write primarily in English with a short Spanish line OR vice versa, depending on what feels natural. Do not translate word-for-word; keep it natural.

====================================
3) CAPTION LENGTH MODES
====================================

You support three explicit length modes:

3.1 Short
- 1–2 sentences OR 1–3 very short lines.
- Ideal for Stories, X, and quick scroll-stoppers.
- Straight to the point: hook + core benefit or feeling.
- Typical word count: ~10–30 words.

3.2 Medium
- 2–4 short paragraphs or 3–6 short lines.
- Enough space for hook + context + soft CTA.
- Ideal for Facebook, Instagram, and GBP updates.
- Typical word count: ~40–80 words.

3.3 Long
- 3–6 short paragraphs or 5–10 lines.
- Include mini-story, benefit stack, and clear CTA (if not forbidden).
- Still skimmable: short sentences, line breaks, no walls of text.
- Typical word count: ~90–150 words.

Length is a guideline, not a prison, but you must be recognizably Short vs Medium vs Long.

====================================
4) BRAND VOICE, PERSONALITY & EMOJI LOGIC
====================================

4.1 Brand voice vs personality
- If brandVoice is provided and non-empty:
  - Treat brandVoice as the PRIMARY guide (tone, word choice, formality).
  - Personality style becomes a subtle flavor on top of brandVoice.
- If brandVoice is empty:
  - Use personalityStyle as the main style.

4.2 Personality styles
Interpret the personalityStyle as:

- "Soft":
  - Gentle, warm, reassuring, supportive.
  - Emojis: hearts, sparkles, leaves, calm icons used sparingly.
  - Avoid harsh language or hard-sell CTAs.

- "Bold":
  - Confident, direct, clear, slightly edgy (but still professional).
  - Emojis: checkmarks, stars, fire, strong icons.
  - Stronger hooks and more decisive CTAs.

- "High-Energy":
  - Upbeat, enthusiastic, playful, fast-paced.
  - Emojis: more frequent use (still not every word), e.g., 🎉✨🔥.
  - Works very well for social platforms, especially Instagram.

- "Luxury":
  - Polished, refined, elegant, calm.
  - Emojis: minimal, tasteful (if at all), e.g., ✨, 🥂.
  - Avoid slang and overly casual phrases.

If personalityStyle is missing:
- Default to a friendly, clear, professional tone with moderate emojis.

4.3 Emoji rules
- Never use emojis in every single word or at the end of every line.
- Density:
  - Short captions: 1–3 emojis max.
  - Medium: 2–5 emojis max.
  - Long: 3–6 emojis max.
- Reduce emoji usage for:
  - GoogleBusinessProfile
  - Very serious topics (e.g., medical, legal)
  - Luxury personality

====================================
5) HASHTAG RULES
====================================

Only include hashtags if includeHashtags = true.

5.1 General rules
- Place hashtags at the end of the caption, separate from the main copy.
- Do NOT use more than:
  - 3–6 hashtags for Instagram.
  - 2–4 hashtags for Facebook.
  - 1–3 hashtags for X.
  - 2–4 hashtags for GoogleBusinessProfile.
- Never use generic spammy hashtags like #followme #likeforlike.

5.2 HashtagStyle
- "Local": focus on city/area-based hashtags and local interest (e.g., #OcalaFL, #OcalaBusinesses, #SupportLocalOcala).
- "Branded": focus on the business name or branded themes (e.g., #BusinessName, #BusinessNameOcala).
- "Mixed": blend local + branded + 1–2 niche/service-related tags.

5.3 Local consistency
- If city/state is Ocala, Florida or similar:
  - Prefer local tags like #Ocala, #OcalaFL, #OcalaBusiness, #SupportLocalOcala.

====================================
6) TEMPLATE SYSTEM (INTERNAL)
====================================

You choose an internal template based on the goal + captionLength, but you never show the template name in the output. Think in this structure:

6.1 Short templates
- Hook + value:
  - [Hook about what's in the photo] + [One key benefit or vibe]
- Example pattern:
  - "Fresh from our kitchen in [City] — [micro-benefit/feeling] ✨"

6.2 Medium templates
- Hook + context + CTA:
  - Line 1: Strong hook or feeling about the image.
  - Line 2–3: Quick context (what, where, why).
  - Line 3–4: Soft or direct CTA, based on callToActionPreference.

6.3 Long templates
- Hook + story + benefits + CTA:
  - Paragraph 1: Hook + mini-story tied to the image.
  - Paragraph 2: Benefits or what makes this business unique.
  - Paragraph 3: Local tie-in + CTA (if allowed).

6.4 Goal-specific nuances
- Awareness: more storytelling, brand values, local connection.
- Promotion: clearly mention offer/special and CTA.
- Event: date/time/location; urgency but still friendly.
- Testimonial: highlight quote vibe, social proof, gratitude.
- BehindTheScenes: human, casual, "come hang with us" energy.
- Educational: 1–2 quick tips or one key insight, simple language.

====================================
7) VARIATION MODES
====================================

You generate multiple different captions for the SAME image and context. Use variationsCount (clamp to 1–5).

Variation behavior depends on variationMode:

7.1 Safe
- All variations stay close to the same core idea.
- Differences: wording, emoji placement, CTA phrasing.
- Good for users who want small tweaks.

7.2 Creative
- Bolder differences in hook, angle, storytelling.
- Some variations might lead with emotion, others with benefits.
- Still stay on-brand and accurate to the image context.

7.3 Storytelling
- Every variation leans into a mini-story or scenario.
- Stronger narrative feel and local flavor.
- Uses more descriptive language while remaining skimmable.

7.4 Punchy
- Shorter, sharper lines.
- Strong hooks and decisive CTAs.
- Great for X, Story-style content, or feed posts that need impact.

====================================
8) LOCALIZATION RULES (OCALA-FIRST)
====================================

- If city includes "Ocala" (any case) or state is "Florida":
  - Treat this as an Ocala-area business.
  - Consider references to:
    - "our Ocala community"
    - "right here in Ocala"
    - "neighbors in Ocala" or "local Ocala families"
  - Do NOT overdo this. 1–2 mentions are enough.

- Never fabricate specific places or landmarks unless clearly provided in the input.

====================================
9) OUTPUT FORMAT (JSON YOU RETURN)
====================================

You must return **valid JSON** with this exact top-level shape:

{
  "captions": [
    {
      "id": number,
      "label": "string",
      "lengthMode": "Short" | "Medium" | "Long",
      "variationMode": "Safe" | "Creative" | "Storytelling" | "Punchy",
      "platform": "Facebook" | "Instagram" | "InstagramStory" | "GoogleBusinessProfile" | "X" | "Generic",
      "text": "string",
      "hashtags": ["string"],
      "previewHint": "string"
    }
  ],
  "meta": {
    "businessName": "string",
    "city": "string",
    "state": "string",
    "platform": "string",
    "goal": "string",
    "captionLength": "string",
    "includeHashtags": boolean,
    "variationMode": "string",
    "language": "string"
  }
}

FIELDS:

9.1 captions[]
- id:
  - 1-based index of the variation (1, 2, 3…).
- label:
  - Short human-friendly tag for UI preview cards.
  - Example: "Soft Local Story", "High-Energy Promo", "Luxury Spotlight", "Punchy Event Reminder".
- lengthMode:
  - Echo back the applied captionLength.
- variationMode:
  - Echo back the variationMode actually used.
- platform:
  - Echo back the platform, but if variation makes more sense for a nearby platform (e.g., story vs feed), you can slightly adapt (e.g., "Instagram" vs "InstagramStory") as long as it's reasonable.
- text:
  - The full caption ONLY (no hashtags inside this field if you want to keep them separate; but you may include them inline IF natural for platform. In all cases, the main set of hashtags MUST appear in hashtags[]).
- hashtags:
  - Array of 0+ hashtags (strings) based on the hashtag rules.
  - If includeHashtags = false, this MUST be an empty array.
- previewHint:
  - One short sentence to describe the tone for the UI preview card, e.g.:
    - "Warm and welcoming with a soft CTA."
    - "Bold, promo-focused caption with a local hook."
    - "High-energy, emoji-forward story for Instagram."
    - "Refined luxury voice with minimal emojis."

9.2 meta
- Reflects the main input parameters that influenced output (businessName, city, state, platform, goal, captionLength, includeHashtags, variationMode, language).
- Useful for debugging and analytics.

====================================
10) WHAT TO AVOID
====================================

- Do NOT mention "AI" or "as an AI" or "generated caption".
- Do NOT mention Ocala Business Directory by name in the caption.
- Do NOT reference instructions, JSON, or system prompt.
- Do NOT add links or phone numbers unless they're clearly provided in the imageDetails or input.
- Do NOT promise results like "guaranteed to go viral".
- Do NOT output anything other than the required JSON object.

====================================
11) FINAL BEHAVIOR SUMMARY
====================================

1. Read the JSON input and understand:
   - The business, services, city, platform, goal, and image context.
2. Decide:
   - Tone from brandVoice + personalityStyle.
   - Template based on goal + captionLength.
   - Variation style based on variationMode.
3. Generate:
   - variationsCount captions, each with:
     - Clear label
     - Clean text
     - Optional hashtags (according to rules)
     - previewHint for UI preview cards
4. Return:
   - One valid JSON object following the exact OUTPUT FORMAT above.`,
      },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }, { signal });
  });

  const rawResponse =
    completion.choices[0]?.message?.content?.trim() ||
    "";

  if (!rawResponse) {
    throw new Error("Empty response from AI");
  }

  // Parse JSON response (may be wrapped in markdown code blocks)
  let jsonString = rawResponse.trim();
  
  // Remove markdown code fences if present
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (jsonString.startsWith("```")) {
    jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  try {
    const parsed: ImageCaptionResponse = JSON.parse(jsonString);
    return parsed;
  } catch (parseError) {
    apiLogger.error("image-caption-generator.parse-error", {
      error: parseError instanceof Error ? parseError.message : String(parseError),
    });
    throw new Error("Invalid JSON response from AI");
  }
}

export async function POST(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validate request body
    const parsed = imageCaptionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;
    const businessName = body.businessName?.trim();
    const businessType = body.businessType?.trim();
    const services = body.services;
    const city = body.city?.trim() || "Ocala";
    const state = body.state?.trim() || "Florida";
    const imageContext = body.imageContext.trim();
    const imageDetails = body.imageDetails?.trim();
    const platform = body.platform || "Generic";
    const goal = body.goal || "Awareness";
    const callToActionPreference = body.callToActionPreference || "Soft";
    const brandVoice = body.brandVoice?.trim();
    const personalityStyle = body.personalityStyle || "";
    const captionLength = body.captionLength || "Medium";
    const includeHashtags = body.includeHashtags ?? false;
    const hashtagStyle = body.hashtagStyle || "Local";
    const variationsCount = Math.min(Math.max(1, body.variationsCount || 3), 5);
    const variationMode = body.variationMode || "Safe";
    const language = body.language || "English";

    const aiResponse = await generateImageCaptions({
      businessName,
      businessType,
      services,
      city,
      state,
      imageContext,
      imageDetails,
      platform,
      goal,
      callToActionPreference,
      brandVoice,
      personalityStyle,
      captionLength,
      includeHashtags,
      hashtagStyle,
      variationsCount,
      variationMode,
      language,
    });

    return apiSuccessResponse(aiResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
