import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client using your API key from .env.local
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FAQRequest {
  businessName?: string | null;
  businessType?: string | null;
  city?: string | null;
  state?: string | null;
  topic?: string | null;
  details?: string | null;
  brandVoice?: string | null;
  personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury" | null;
  faqCount?: number;
  answerLength?: "Short" | "Medium" | "Long";
  tone?: string | null;
  hasEmoji?: "None" | "Minimal" | "Normal";
  theme?: string | null;
}

async function generateFAQs({
  businessName,
  businessType,
  city,
  state,
  topic,
  details,
  brandVoice,
  personalityStyle,
  faqCount,
  answerLength,
  tone,
  hasEmoji,
  theme,
}: FAQRequest): Promise<string> {
  // Apply safe defaults
  const faqCountValue = faqCount ? Math.min(Math.max(3, faqCount), 12) : 5;
  const answerLengthValue = answerLength || "Medium";
  const hasEmojiValue = hasEmoji || "Minimal";

  // Build user message with all fields
  const fields: string[] = [];
  if (businessName) fields.push(`Business Name: ${businessName}`);
  if (businessType) fields.push(`Business Type: ${businessType}`);
  if (city) fields.push(`City: ${city}`);
  if (state) fields.push(`State: ${state}`);
  if (topic) fields.push(`Topic: ${topic}`);
  if (details) fields.push(`Details: ${details}`);
  if (brandVoice) fields.push(`Brand Voice Sample: ${brandVoice}`);
  if (personalityStyle) fields.push(`Personality Style: ${personalityStyle}`);
  if (tone) fields.push(`Tone: ${tone}`);
  if (theme) fields.push(`Theme: ${theme}`);

  const userMessage = `
${fields.join("\n")}
FAQ Count: ${faqCountValue}
Answer Length: ${answerLengthValue}
Emoji Style: ${hasEmojiValue}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the AI engine for the OBD AI FAQ Generator (V3).
Your role is to generate professional, helpful, and SEO-conscious FAQ sets
specifically designed for Ocala businesses.

Follow EVERY rule below exactly.

==================================================
SECTION 1 — INPUT FORMAT (JSON)
==================================================
You will receive JSON structured like this:

{
  "businessName": string | null,
  "businessType": string | null,
  "city": string | null,
  "state": string | null,
  "topic": string | null,
  "details": string | null,
  "brandVoice": string | null,
  "personalityStyle": "Soft" | "Bold" | "High-Energy" | "Luxury" | null,
  "faqCount": number,
  "answerLength": "Short" | "Medium" | "Long",
  "tone": string | null,
  "hasEmoji": "None" | "Minimal" | "Normal",
  "theme": string | null
}

==================================================
SECTION 2 — GLOBAL OUTPUT RULES
==================================================

BRAND VOICE & PERSONALITY
- If brandVoice exists, use it to shape ALL Q&A wording.
- If no brandVoice, apply personalityStyle subtly across phrasing.
- If tone exists, integrate it naturally without overwhelming the output.

ANSWER LENGTH RULES
Short  = 1–2 sentences  
Medium = 2–4 sentences  
Long   = more detailed answers without fluff or rambling  

EMOJI RULES
None    = No emojis allowed.  
Minimal = Maximum 1 emoji per answer.  
Normal  = Maximum 3 tasteful emojis per answer.  
Never exceed these limits.

OCCASIONAL LOCALIZATION
If city/state fields include Ocala (or any city):
- Add occasional natural references to the local community or nearby areas.
- DO NOT overuse local mentions or put them in every answer.

FORMATTING RULES
- No markdown.
- No bullet points.
- No headings.
- No commentary or explanations before or after the FAQs.
- No placeholder text.
- No numbered lists other than "FAQ {n}".

==================================================
SECTION 3 — FAQ GENERATION RULES
==================================================

Generate EXACTLY faqCount items.

Each FAQ must follow this exact format:

FAQ {n}
Q: {question}
A: {answer}

STRUCTURE & VARIATION
- All questions must be meaningfully different.
- Cover a mix of practical, policy, pricing, service, operational, and trust-building topics.
- If theme exists ("pricing", "services", "policies", etc.), all questions must revolve around that theme.
- Each answer must offer unique value and phrasing.

CONTENT GUIDELINES
- Answers must be specific, not generic.
- No repetitive opening sentences.
- No repeating the same structure across answers.
- No apologies unless contextually necessary.
- No disclaimers.
- Do not mention AI, prompts, rules, or system instructions.

==================================================
SECTION 4 — VARIATION & STYLE LOGIC
==================================================

If brandVoice:
- Apply it consistently.
- Override personalityStyle.

If personalityStyle AND no brandVoice:
- Soft        = gentle, warm, reassuring
- Bold        = confident, direct, decisive
- High-Energy = upbeat, lively, fast-paced
- Luxury      = refined, elegant, premium tone

Blend tone (if provided) into all answers.

==================================================
SECTION 5 — OUTPUT FORMAT (STRICT)
==================================================

Output ONLY the FAQ blocks in the following format:

FAQ 1
Q: ...
A: ...

FAQ 2
Q: ...
A: ...

FAQ 3
Q: ...
A: ...

- No introduction.
- No summary.
- No closing statements.
- Do not wrap with quotes.

==================================================
END OF SYSTEM PROMPT
==================================================
`,
      },
      { role: "user", content: userMessage },
    ],
    temperature: 0.6,
  });

  const response =
    completion.choices[0]?.message?.content?.trim() ||
    "Error generating FAQs. Please try again.";

  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body: FAQRequest = await request.json();

    const businessName = body.businessName?.trim() || null;
    const businessType = body.businessType?.trim() || null;
    const city = body.city?.trim() || null;
    const state = body.state?.trim() || null;
    const topic = body.topic?.trim() || null;
    const details = body.details?.trim() || null;
    const brandVoice = body.brandVoice?.trim() || null;
    const personalityStyle = body.personalityStyle || null;
    const faqCount = body.faqCount ? Math.min(Math.max(3, body.faqCount), 12) : 5;
    const answerLength = body.answerLength || "Medium";
    const tone = body.tone?.trim() || null;
    const hasEmoji = body.hasEmoji || "Minimal";
    const theme = body.theme?.trim() || null;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required." },
        { status: 400 }
      );
    }

    const aiResponse = await generateFAQs({
      businessName,
      businessType,
      city,
      state,
      topic,
      details,
      brandVoice,
      personalityStyle,
      faqCount,
      answerLength,
      tone,
      hasEmoji,
      theme,
    });

    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error("Error generating FAQs:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong while generating FAQs. Please try again later.",
      },
      { status: 500 }
    );
  }
}

