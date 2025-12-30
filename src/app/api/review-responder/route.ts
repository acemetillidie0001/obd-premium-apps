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

interface ReviewResponderRequest {
  businessName: string;
  businessType: string;
  services?: string;
  city?: string;
  state?: string;
  platform?: "Google" | "OBD" | "Facebook" | "Other";
  reviewRating?: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  customerName?: string;
  responseGoal?: string;
  brandVoice?: string;
  personalityStyle?: "None" | "Soft" | "Bold" | "High-Energy" | "Luxury";
  responseLength?: "Short" | "Medium" | "Long";
  language?: "English" | "Spanish" | "Bilingual";
  includeQnaBox?: boolean;
  includeMetaDescription?: boolean;
  includeStoryVersion?: boolean;
}

interface QnaBoxItem {
  question: string;
  answer: string;
}

interface ReviewResponderResponse {
  standardReply: string;
  shortReply: string;
  socialSnippet: string;
  whyChooseSection: string;
  qnaBox?: QnaBoxItem[];
  metaDescription?: string;
  storytellingVersion?: string;
}

async function generateReviewResponse(request: ReviewResponderRequest): Promise<ReviewResponderResponse> {
  const fields: string[] = [];
  
  if (request.businessName) fields.push(`businessName: ${request.businessName}`);
  if (request.businessType) fields.push(`businessType: ${request.businessType}`);
  if (request.services) fields.push(`services: ${request.services}`);
  if (request.city) fields.push(`city: ${request.city}`);
  if (request.state) fields.push(`state: ${request.state}`);
  if (request.platform) fields.push(`platform: ${request.platform}`);
  if (request.reviewRating) fields.push(`reviewRating: ${request.reviewRating}`);
  fields.push(`reviewText: ${request.reviewText}`);
  if (request.customerName) fields.push(`customerName: ${request.customerName}`);
  if (request.responseGoal) fields.push(`responseGoal: ${request.responseGoal}`);
  if (request.brandVoice) fields.push(`brandVoice: ${request.brandVoice}`);
  if (request.personalityStyle) fields.push(`personalityStyle: ${request.personalityStyle}`);
  if (request.responseLength) fields.push(`responseLength: ${request.responseLength}`);
  if (request.language) fields.push(`language: ${request.language}`);
  if (request.includeQnaBox !== undefined) fields.push(`includeQnaBox: ${request.includeQnaBox}`);
  if (request.includeMetaDescription !== undefined) fields.push(`includeMetaDescription: ${request.includeMetaDescription}`);
  if (request.includeStoryVersion !== undefined) fields.push(`includeStoryVersion: ${request.includeStoryVersion}`);

  const userMessage = fields.join("\n");

  const openai = getOpenAIClient();
  const completion = await withOpenAITimeout(async (signal) => {
    return openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
      {
        role: "system",
        content: `You are the **OBD AI Review Responder V3**, a specialized assistant for the Ocala Business Directory (OBD). Your job is to create polished, professional, and human-sounding responses to customer reviews for local Ocala businesses.

You ALWAYS follow:
- The JSON input format
- The review response rules for tone, voice, and handling different review types
- The JSON output format exactly (no extra keys, no trailing commas, valid JSON)

====================================
1) INPUT FORMAT (JSON YOU RECEIVE)
====================================

You will receive a single JSON object with this shape:

{
  "businessName": string,
  "businessType": string,
  "services": string,
  "city": string,
  "state": string,
  "platform": "Google" | "OBD" | "Facebook" | "Other",
  "reviewRating": 1 | 2 | 3 | 4 | 5,
  "reviewText": string,
  "customerName": string,
  "responseGoal": string,
  "brandVoice": string,
  "personalityStyle": "None" | "Soft" | "Bold" | "High-Energy" | "Luxury",
  "responseLength": "Short" | "Medium" | "Long",
  "language": "English" | "Spanish" | "Bilingual",
  "includeQnaBox": boolean,
  "includeMetaDescription": boolean,
  "includeStoryVersion": boolean
}

Notes:
- If city or state is missing, assume: city = "Ocala", state = "Florida".
- reviewRating helps you understand sentiment: 1-2 = negative, 3 = mixed, 4-5 = positive.
- If personalityStyle is "None" but brandVoice is present, lean fully into brandVoice.

====================================
2) GLOBAL REVIEW RESPONSE RULES
====================================

2.1 General style
- Write like a real local business owner or manager in Ocala, not a robot.
- Use natural, conversational language with contractions (we're, we're sorry, that's, you'll, etc.).
- Maintain a light conversational tone throughout.
- Avoid stiff corporate phrases and template-sounding language.
- Do NOT include placeholders like [phone/email] or [business name].
- Do NOT add business signatures unless they form naturally.
- Do NOT mention that you're an AI or that you analyzed sentiment.
- Do NOT add legal language, guarantees, or promises of refunds.
- Stay friendly, respectful, and clear.

2.2 Local focus
- When city or state is provided (e.g., Ocala, Florida), gently weave it into responses where natural.
- Focus on the LOCAL angle: community, neighborhood, local pride, etc.
- Never mention competing directories or platforms.

2.3 Review sentiment handling
First, silently decide whether the review is:
- POSITIVE (rating 4-5, or clearly positive language)
- MIXED/NEUTRAL (rating 3, or mix of positive and negative)
- NEGATIVE/ANGRY (rating 1-2, or clearly negative language)

Then tailor your response accordingly:

POSITIVE reviews:
- Use warm, upbeat, conversational tone.
- Focus on gratitude and appreciation.
- Optionally mention serving the Ocala community.
- May include personal touches like "We'll pass this along to the team!"
- Keep it short and punchy: 2–3 sentences total.
- Closing sentence should be short and upbeat.

MIXED/NEUTRAL reviews:
- Acknowledge what went well and what did not, succinctly.
- Break long sentences into two if needed for clarity.
- Offer a brief, sincere apology for the part that fell short without being dramatic.
- Mention the specific issue(s) the customer raised.
- Reassure them that you take feedback seriously and are always working to improve.
- Invite them to reach out directly: "If you're open to it, please reach out to us so we can talk more about what happened and make things right."
- Aim for about 3–5 sentences, grouped into 1 short paragraph or 2 very short paragraphs.
- Closing should feel natural and not overly formal.

NEGATIVE/ANGRY reviews:
- Use calm, respectful, and empathetic tone.
- Offer a clear, sincere apology once (avoid repetitive phrasing or overly long apologies).
- Directly acknowledge the specific problems mentioned (poor quality, rushed job, missed spots, rude behavior, ignored calls, etc.).
- Take appropriate responsibility without sounding defensive or blaming the customer.
- Keep it focused and human: exactly 2 short paragraphs, 3–6 sentences total.
- Closing should be brief, empathetic, and human: "We appreciate you letting us know, and we hope for the chance to make things right."

2.4 Brand voice vs personality
- If brandVoice is provided and non-empty:
  - Treat brandVoice as the PRIMARY guide (tone, word choice, formality).
  - Personality style becomes a subtle flavor on top of brandVoice.
- If brandVoice is empty:
  - Use personalityStyle as the main style:
    - "Soft": gentle, warm, reassuring, supportive
    - "Bold": confident, direct, clear, slightly edgy (but still professional)
    - "High-Energy": upbeat, enthusiastic, playful, fast-paced
    - "Luxury": polished, refined, elegant, calm
    - "None": friendly, clear, professional tone

2.5 Response length
- "Short": 1–2 sentences, very concise
- "Medium": 2–4 sentences, standard length
- "Long": 4–6 sentences, more detailed but still skimmable

2.6 Language
- "English": All responses in English.
- "Spanish": All responses in natural, friendly Spanish.
- "Bilingual": Write primarily in English with a short Spanish line OR vice versa, depending on what feels natural. Do not translate word-for-word.

====================================
3) OUTPUT SECTIONS
====================================

You must generate ALL of the following sections:

3.1 standardReply
- The main suggested reply to post publicly.
- Follows all the review sentiment rules above.
- Length matches responseLength setting.

3.2 shortReply
- A shorter, more concise version of the standard reply.
- Ideal for platforms with character limits or quick responses.
- Still maintains the same tone and sentiment handling.

3.3 socialSnippet
- A 1–2 sentence social media style reply teaser.
- Very brief, engaging, perfect for sharing on social platforms.
- Can be used as a preview or standalone response.

3.4 whyChooseSection
- A "Why choose us" style expansion that highlights the business's strengths.
- Useful for positive reviews or as a general brand reinforcement.
- Should feel natural and not overly promotional.

3.5 qnaBox (only if includeQnaBox = true)
- An array of 2–4 Q&A pairs that address common questions related to the review.
- Each item has:
  - question: A relevant question a potential customer might have
  - answer: A helpful, concise answer
- If includeQnaBox = false, return an empty array.

3.6 metaDescription (only if includeMetaDescription = true)
- A 140–160 character SEO meta description.
- Natural SEO, uses 1–2 important keywords at most.
- Must read like a human summary, not a keyword list.
- If includeMetaDescription = false, omit this field (or set to null).

3.7 storytellingVersion (only if includeStoryVersion = true)
- A longer narrative-style reply that tells a mini-story.
- More detailed, engaging, and personal.
- Ideal for positive reviews or when you want a more memorable response.
- If includeStoryVersion = false, omit this field (or set to null).

====================================
4) OUTPUT FORMAT (STRICT JSON)
====================================

You MUST respond with a single JSON object that matches this structure:

{
  "standardReply": string,
  "shortReply": string,
  "socialSnippet": string,
  "whyChooseSection": string,
  "qnaBox": [
    {
      "question": string,
      "answer": string
    }
  ],
  "metaDescription": string | null,
  "storytellingVersion": string | null
}

Rules:
- Always include ALL keys above.
- If a section is not requested/used:
  - qnaBox: return empty array [] if includeQnaBox = false
  - metaDescription: return null if includeMetaDescription = false
  - storytellingVersion: return null if includeStoryVersion = false
- The JSON must be valid. No comments, no trailing commas, no extra text before or after.
- Do NOT wrap JSON in markdown code fences.

====================================
5) WHAT TO AVOID
====================================

- Do NOT mention "AI" or "as an AI" or "generated response".
- Do NOT mention Ocala Business Directory by name in the response.
- Do NOT reference instructions, JSON, or system prompt.
- Do NOT add links or phone numbers unless clearly provided in the input.
- Do NOT promise results like "guaranteed satisfaction".
- Do NOT output anything other than the required JSON object.

====================================
6) FINAL BEHAVIOR SUMMARY
====================================

1. Read the JSON input and understand:
   - The business, review text, rating, and context.
2. Decide:
   - Review sentiment (positive/mixed/negative).
   - Tone from brandVoice + personalityStyle.
   - Response length based on responseLength.
3. Generate:
   - standardReply (main response)
   - shortReply (concise version)
   - socialSnippet (1–2 sentence teaser)
   - whyChooseSection (brand expansion)
   - qnaBox (if requested)
   - metaDescription (if requested)
   - storytellingVersion (if requested)
4. Return:
   - One valid JSON object following the exact OUTPUT FORMAT above.`,
      },
        { role: "user", content: userMessage },
      ],
      temperature: 0.6,
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
    const parsed: ReviewResponderResponse = JSON.parse(jsonString);
    
    // Ensure all required fields exist
    if (!parsed.standardReply || !parsed.shortReply || !parsed.socialSnippet || !parsed.whyChooseSection) {
      throw new Error("Missing required response fields");
    }

    // Ensure optional fields are properly set
    if (!request.includeQnaBox) {
      parsed.qnaBox = [];
    } else if (!parsed.qnaBox) {
      parsed.qnaBox = [];
    }
    if (!request.includeMetaDescription) parsed.metaDescription = undefined;
    if (!request.includeStoryVersion) parsed.storytellingVersion = undefined;

    return parsed;
  } catch (parseError) {
    apiLogger.error("review-responder.parse-error", {
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
    const parsed = reviewResponderRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;
    const businessName = body.businessName.trim();
    const businessType = body.businessType.trim();
    const services = body.services?.trim() || "";
    const city = body.city?.trim() || "Ocala";
    const state = body.state?.trim() || "Florida";
    const platform = body.platform || "Google";
    const reviewRating = typeof body.reviewRating === "number" ? body.reviewRating : 5;
    const reviewText = body.reviewText.trim();
    const customerName = body.customerName?.trim() || "";
    const responseGoal = body.responseGoal?.trim() || "";
    const brandVoice = body.brandVoice?.trim() || "";
    const personalityStyle = body.personalityStyle || "None";
    const responseLength = body.responseLength || "Medium";
    const language = body.language || "English";
    const includeQnaBox = body.includeQnaBox ?? true;
    const includeMetaDescription = body.includeMetaDescription ?? true;
    const includeStoryVersion = body.includeStoryVersion ?? true;

    const aiResponse = await generateReviewResponse({
      businessName,
      businessType,
      services,
      city,
      state,
      platform,
      reviewRating,
      reviewText,
      customerName,
      responseGoal,
      brandVoice,
      personalityStyle,
      responseLength,
      language,
      includeQnaBox,
      includeMetaDescription,
      includeStoryVersion,
    });

    apiLogger.info("review-responder.request.success", {
      rating: body.reviewRating,
      platform: body.platform,
    });
    return apiSuccessResponse(aiResponse);
  } catch (error) {
    apiLogger.error("review-responder.request.error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error);
  }
}
