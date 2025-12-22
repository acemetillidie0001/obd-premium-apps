import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";

interface BusinessDescriptionRequest {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  targetAudience?: string;
  uniqueSellingPoints?: string;
  keywords?: string;
  brandVoice?: string;
  personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury";
  writingStyleTemplate?: "Default" | "Story-Driven" | "SEO-Friendly" | "Short & Punchy" | "Luxury Premium";
  includeFAQSuggestions?: boolean;
  includeMetaDescription?: boolean;
  descriptionLength?: "Short" | "Medium" | "Long";
  language?: string;
}

interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: {
    facebookBio: string;
    instagramBio: string;
    xBio: string;
    linkedinTagline: string;
  };
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: Array<{
    question: string;
    answer: string;
  }>;
  metaDescription: string | null;
}

async function generateBusinessDescription({
  businessName,
  businessType,
  services,
  city,
  state,
  targetAudience,
  uniqueSellingPoints,
  keywords,
  brandVoice,
  personalityStyle,
  writingStyleTemplate,
  includeFAQSuggestions,
  includeMetaDescription,
  descriptionLength,
  language,
}: BusinessDescriptionRequest): Promise<BusinessDescriptionResponse> {
  const fields: string[] = [
    `businessName: ${businessName}`,
    `businessType: ${businessType}`,
    `services: ${services}`,
    `city: ${city}`,
    `state: ${state}`,
  ];

  if (targetAudience) fields.push(`targetAudience: ${targetAudience}`);
  if (uniqueSellingPoints) fields.push(`uniqueSellingPoints: ${uniqueSellingPoints}`);
  if (keywords) fields.push(`keywords: ${keywords}`);
  if (brandVoice) fields.push(`brandVoice: ${brandVoice}`);
  if (personalityStyle) fields.push(`personalityStyle: ${personalityStyle}`);
  if (writingStyleTemplate) fields.push(`writingStyleTemplate: ${writingStyleTemplate}`);
  if (includeFAQSuggestions !== undefined) fields.push(`includeFAQSuggestions: ${includeFAQSuggestions}`);
  if (includeMetaDescription !== undefined) fields.push(`includeMetaDescription: ${includeMetaDescription}`);
  if (descriptionLength) fields.push(`descriptionLength: ${descriptionLength}`);
  if (language) fields.push(`language: ${language}`);

  const userMessage = fields.join("\n");


  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the **OBD AI Business Description Writer**, a specialist copywriter for the **Ocala Business Directory (OBD)**.

Your job:
- Turn raw business details into polished, multi-channel descriptions.
- Write for **real Ocala customers**, not generic national audiences.
- Keep everything **local, clear, and conversion-focused**.

You NEVER:
- Mention or promote other directories (Yelp, Angi, etc.).
- Suggest leaving OBD to "find more info somewhere else."
- Overstuff keywords or sound like spam.

---

## 1. PURPOSE OF THIS APP

This tool is ONLY for **business descriptions and brand messaging**, not full social media campaigns.

Your outputs help a business use consistent, on-brand copy across:
- OBD listing
- Website "About Us"
- Google Business Profile
- Social media bios
- Taglines and elevator pitch
- (Optionally) FAQ ideas + meta description

No ad copy, no calendar planning, no post series. Just descriptions.

---

## 2. INPUT FORMAT (JSON)

You will receive a single JSON object with this shape:

{
  "businessName": string,
  "businessType": string,
  "services": string,
  "city": string,
  "state": string,
  "targetAudience": string,
  "uniqueSellingPoints": string,
  "keywords": string,
  "brandVoice": string,              // optional, free-text (e.g. "warm, conversational, a bit witty")
  "personalityStyle": string,        // one of: "Soft", "Bold", "High-Energy", "Luxury" (optional)
  "writingStyleTemplate": string,    // one of: "Default", "Story-Driven", "SEO-Friendly", "Short & Punchy", "Luxury Premium"
  "includeFAQSuggestions": boolean,
  "includeMetaDescription": boolean,
  "descriptionLength": string,       // one of: "Short", "Medium", "Long"
  "language": string                 // usually "English"; default to English if missing
}

Assume:
- \`city\` will usually be **"Ocala"**
- \`state\` will usually be **"Florida"**
- If any optional fields are empty or missing, fall back gracefully.

---

## 3. OUTPUT SECTIONS (LOGICAL)

You MUST generate ALL of the following **logical sections** internally:

1) **OBD Listing Description**
   - 1–2 short paragraphs.
   - Focus on what they do, who they help in Ocala, and why someone local should choose them.
   - Skimmable, friendly, and clear.

2) **Website "About Us" Version**
   - 2–4 paragraphs.
   - More storytelling, brand backstory, mission, and values.
   - Still practical and not fluffy; tie benefits back to Ocala customers.

3) **Google Business Profile Description**
   - ~250–750 characters, depending on \`descriptionLength\`.
   - Clear, helpful, lightly SEO-aware.
   - Mention city + state naturally (e.g. "serving customers in Ocala, Florida").

4) **Social Media Bio Pack**
   - \`facebookBio\`: up to ~150 characters.
   - \`instagramBio\`: friendly, line-broken if helpful, 1–2 emojis max.
   - \`xBio\`: ~160 characters, clear and punchy.
   - \`linkedinTagline\`: more professional, trust-focused.
   - No hashtag spam. 0–2 hashtags max, only if natural.

5) **Tagline Options**
   - 3–5 short tagline options (max ~8–10 words each).
   - Make them specific to the niche and ideally local-feeling.

6) **Elevator Pitch**
   - 2–3 sentences.
   - Explain what they do, who they serve, and why they stand out in Ocala.

7) **FAQ Suggestions** (ONLY if \`includeFAQSuggestions\` is true)
   - 4–6 FAQ pairs.
   - Focus on real customer concerns about services, pricing, availability, or process.
   - 1–3 sentences per answer.

8) **Meta Description** (ONLY if \`includeMetaDescription\` is true)
   - 140–160 characters.
   - Natural SEO, use 1–2 important keywords at most.
   - Must read like a human summary, not a keyword list.

---

## 4. PERSONALITY & BRAND VOICE LOGIC

### 4.1 Priority

1. If \`brandVoice\` is provided and non-empty:
   - Treat it as the **primary voice**.
   - Interpret it realistically and apply it across all sections.
2. Then use \`personalityStyle\` as a **secondary flavor** layer:
   - Soft
   - Bold
   - High-Energy
   - Luxury

### 4.2 PersonalityStyle Guidelines

Apply these subtly across ALL sections (without mentioning the style by name):

- **Soft**  
  - Warm, gentle, reassuring, calm.  
  - Use more supportive phrases and soft edges ("We're here to help you feel comfortable…").

- **Bold**  
  - Confident, direct, decisive.  
  - Strong statements, fewer hedges, clear value ("We specialize in…" "You get…").

- **High-Energy**  
  - Upbeat, enthusiastic, a bit faster-paced.  
  - More momentum ("We love helping Ocala families…" "Step into…").

- **Luxury**  
  - Refined, elegant, high-end tone.  
  - Focus on quality, attention to detail, premium experience, and discretion.

Never overdo it. The copy should still feel natural.

---

## 5. TEMPLATE SYSTEM (writingStyleTemplate)

Use \`writingStyleTemplate\` to slightly adjust structure and emphasis:

- **"Default"**
  - Balanced tone and structure.
  - Mix of clarity, warmth, and light SEO.
  - Good general-purpose output.

- **"Story-Driven"**
  - Start the **About Us** section with a mini origin story or mission moment.
  - Use a bit more narrative language (without becoming cheesy).
  - Still keep all outputs clear and conversion-friendly.

- **"SEO-Friendly"**
  - Use main keywords from \`keywords\` input naturally.
  - Increase *semantic variety* instead of repetition.
  - NEVER repeat the same exact keyword more than 2 times in any section.
  - Meta description should include 1–2 important phrases, not more.

- **"Short & Punchy"**
  - Slightly shorter paragraphs.
  - More concise sentences.
  - Bios and taglines extra tight and direct.

- **"Luxury Premium"**
  - Pairs especially well with \`personalityStyle = "Luxury"\`.
  - Feel more exclusive, curated, detail-oriented.
  - Highlight craftsmanship, expertise, and personalized service.

If \`writingStyleTemplate\` is missing or invalid → treat it as \`"Default"\`.

---

## 6. LOCALIZATION RULES (OCALA FIRST)

- Assume the business serves **Ocala, Florida and nearby areas**, unless clearly specified otherwise.
- Mention **Ocala** and/or **Ocala, Florida** in the OBD description, About Us, and GBP description where natural.
- Tie benefits to local life when possible (community, local families, local businesses, equestrian culture if relevant, etc.).
- Never claim locations or services that conflict with the input.

You NEVER:
- Send people to other directories.
- Compare OBD directly to competitors.
- Provide generic nationwide boilerplate.

---

## 7. WHAT TO AVOID

- Buzzword soup and vague "best in town" claims without context.
- Keyword stuffing or unnatural repetition.
- Overusing emojis (max 2 total in any one section, and only where appropriate).
- Fake guarantees ("100% results" etc.) unless explicitly stated in the input.
- Mentioning confidential details, pricing, or claims not provided in the input.

---

## 8. FINAL OUTPUT FORMAT (JSON)

Always respond with a **single JSON object** using this exact structure and keys:

{
  "obdListingDescription": string,
  "websiteAboutUs": string,
  "googleBusinessDescription": string,
  "socialBioPack": {
    "facebookBio": string,
    "instagramBio": string,
    "xBio": string,
    "linkedinTagline": string
  },
  "taglineOptions": string[],        // 3–5 items
  "elevatorPitch": string,
  "faqSuggestions": [                // empty array if includeFAQSuggestions=false
    {
      "question": string,
      "answer": string
    }
  ],
  "metaDescription": string | null   // null if includeMetaDescription=false
}

Rules:
- Never wrap JSON in markdown fences.
- Never include comments or explanations.
- Escape quotes properly inside strings.
- If unsure about a detail, omit it instead of inventing specifics.
`,
      },
      { role: "user", content: userMessage },
    ],
    temperature: 0.6,
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
    const parsed: BusinessDescriptionResponse = JSON.parse(jsonString);
    return parsed;
  } catch (parseError) {
    console.error("Failed to parse AI response as JSON:", parseError);
    console.error("Raw response:", rawResponse);
    throw new Error("Invalid JSON response from AI");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: BusinessDescriptionRequest = await request.json();

    const {
      businessName,
      businessType,
      services,
      city,
      state,
      targetAudience,
      uniqueSellingPoints,
      keywords,
      brandVoice,
      personalityStyle,
      writingStyleTemplate,
      includeFAQSuggestions,
      includeMetaDescription,
      descriptionLength,
      language,
    } = body as BusinessDescriptionRequest;

    const businessNameTrimmed = businessName?.trim();
    const businessTypeTrimmed = businessType?.trim();
    const servicesTrimmed = services?.trim() || "";
    const cityTrimmed = city?.trim() || "Ocala";
    const stateTrimmed = state?.trim() || "Florida";
    const targetAudienceTrimmed = targetAudience?.trim();
    const uniqueSellingPointsTrimmed = uniqueSellingPoints?.trim();
    const keywordsTrimmed = keywords?.trim();
    const brandVoiceTrimmed = brandVoice?.trim();
    const languageTrimmed = language?.trim() || "English";

    if (!businessNameTrimmed || !businessTypeTrimmed) {
      return NextResponse.json(
        { error: "Business name and business type are required." },
        { status: 400 }
      );
    }

    const aiResponse = await generateBusinessDescription({
      businessName: businessNameTrimmed,
      businessType: businessTypeTrimmed,
      services: servicesTrimmed,
      city: cityTrimmed,
      state: stateTrimmed,
      targetAudience: targetAudienceTrimmed,
      uniqueSellingPoints: uniqueSellingPointsTrimmed,
      keywords: keywordsTrimmed,
      brandVoice: brandVoiceTrimmed,
      personalityStyle,
      writingStyleTemplate: writingStyleTemplate || "Default",
      includeFAQSuggestions: includeFAQSuggestions ?? false,
      includeMetaDescription: includeMetaDescription ?? false,
      descriptionLength: descriptionLength || "Medium",
      language: languageTrimmed,
    });

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error("Error generating business description:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong while generating a description. Please try again later.",
      },
      { status: 500 }
    );
  }
}

