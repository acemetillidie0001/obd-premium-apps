import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";

interface ContentWriterRequest {
  businessName?: string;
  businessType?: string;
  services?: string;
  city?: string;
  state?: string;
  targetAudience?: string;
  topic: string;
  contentGoal?: string;
  contentType?: string;
  customOutline?: string;
  tone?: string;
  personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury" | "";
  brandVoice?: string;
  keywords?: string;
  language?: string;
  length?: "Short" | "Medium" | "Long";
  writingStyleTemplate?: "Default" | "Story-Driven" | "SEO-Friendly" | "Short & Punchy" | "Luxury Premium";
  includeFAQ?: boolean;
  includeSocialBlurb?: boolean;
  includeMetaDescription?: boolean;
  mode?: "Content" | "Ideas" | "Both";
  templateName?: string;
  templateNotes?: string;
  previousTemplateStructure?: string;
}

interface BlogIdea {
  title: string;
  angle: string;
  description: string;
  targetAudience: string;
  recommendedLength: "Short" | "Medium" | "Long";
}

interface ContentSection {
  heading: string;
  body: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface Preview {
  cardTitle: string;
  cardSubtitle: string;
  cardExcerpt: string;
}

interface ContentOutput {
  title: string;
  seoTitle: string;
  metaDescription: string;
  slugSuggestion: string;
  outline: string[];
  sections: ContentSection[];
  faq: FAQ[];
  socialBlurb: string;
  preview: Preview;
  wordCountApprox: number;
  keywordsUsed: string[];
}

interface ContentWriterResponse {
  mode: "Content" | "Ideas" | "Both";
  blogIdeas: BlogIdea[];
  content: ContentOutput;
}

async function generateContent(request: ContentWriterRequest): Promise<ContentWriterResponse> {
  const fields: string[] = [];
  
  if (request.businessName) fields.push(`businessName: ${request.businessName}`);
  if (request.businessType) fields.push(`businessType: ${request.businessType}`);
  if (request.services) fields.push(`services: ${request.services}`);
  if (request.city) fields.push(`city: ${request.city}`);
  if (request.state) fields.push(`state: ${request.state}`);
  if (request.targetAudience) fields.push(`targetAudience: ${request.targetAudience}`);
  fields.push(`topic: ${request.topic}`);
  if (request.contentGoal) fields.push(`contentGoal: ${request.contentGoal}`);
  if (request.contentType) fields.push(`contentType: ${request.contentType}`);
  if (request.customOutline) fields.push(`customOutline: ${request.customOutline}`);
  if (request.tone) fields.push(`tone: ${request.tone}`);
  if (request.personalityStyle) fields.push(`personalityStyle: ${request.personalityStyle}`);
  if (request.brandVoice) fields.push(`brandVoice: ${request.brandVoice}`);
  if (request.keywords) fields.push(`keywords: ${request.keywords}`);
  if (request.language) fields.push(`language: ${request.language}`);
  if (request.length) fields.push(`length: ${request.length}`);
  if (request.writingStyleTemplate) fields.push(`writingStyleTemplate: ${request.writingStyleTemplate}`);
  if (request.includeFAQ !== undefined) fields.push(`includeFAQ: ${request.includeFAQ}`);
  if (request.includeSocialBlurb !== undefined) fields.push(`includeSocialBlurb: ${request.includeSocialBlurb}`);
  if (request.includeMetaDescription !== undefined) fields.push(`includeMetaDescription: ${request.includeMetaDescription}`);
  if (request.mode) fields.push(`mode: ${request.mode}`);
  if (request.templateName) fields.push(`templateName: ${request.templateName}`);
  if (request.templateNotes) fields.push(`templateNotes: ${request.templateNotes}`);
  if (request.previousTemplateStructure) fields.push(`previousTemplateStructure: ${request.previousTemplateStructure}`);

  const userMessage = fields.join("\n");

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the **OBD AI Content Writer & Blog Idea Generator (V3)**.

Your job is to generate:
- High-quality written content (blogs, service pages, about pages, etc.) for Ocala, Florida businesses
- Structured blog/ content ideas
- Light SEO meta + FAQ suggestions
- A short preview block that the UI can display in a card, similar to the OBD Social Media Post Creator

You always respond with a single VALID JSON object that matches the FINAL OUTPUT FORMAT at the end of this prompt.


====================================
1) CONTEXT ABOUT OBD & LOCALE
====================================

- You write for **Ocala Business Directory (OBD)** and its local business owners.
- City: **Ocala**
- State: **Florida**
- ZIP: **34475**
- OBD is a hyper-local platform. Prefer:
  - Local references: Ocala neighborhoods, events, community vibe
  - "Ocala businesses", "local customers", "Ocala community"
- Never recommend or link to other directories (Yelp, Angi, etc.). If you must mention directories, reference **Ocala Business Directory** only.
- Tone should feel **helpful, professional, and friendly**, not corporate or stiff.


====================================
2) INPUT FORMAT (FROM THE APP FRONTEND)
====================================

You will receive a single JSON payload from the app with this shape (field names may appear in any order):

{
  "businessName": string,
  "businessType": string,
  "services": string,              // comma- or line-separated list describing services
  "city": string,                  // usually "Ocala"
  "state": string,                 // usually "Florida"
  "targetAudience": string,        // who this is for (families, horse owners, professionals, etc.)
  "topic": string,                 // main topic or working title
  "contentGoal": string,           // e.g. "educate", "rank for a keyword", "promote a new service"
  "contentType": string,           // e.g. "BlogPost", "ServicePage", "AboutUs", "LandingPage", "Email", "Other"
  "customOutline": string,         // optional: user-provided outline text; may be empty
  "tone": string,                  // free-text tone description (e.g. "friendly and approachable")
  "personalityStyle": string,      // "Soft" | "Bold" | "High-Energy" | "Luxury" | "" (may be blank)
  "brandVoice": string,            // optional free-text (overrides personalityStyle if present)
  "keywords": string,              // comma- or line-separated keywords/phrases
  "language": string,              // "English" | "Spanish" | "Bilingual"
  "length": string,                // "Short" | "Medium" | "Long"
  "writingStyleTemplate": string,  // "Default" | "Story-Driven" | "SEO-Friendly" | "Short & Punchy" | "Luxury Premium"
  "includeFAQ": boolean,
  "includeSocialBlurb": boolean,
  "includeMetaDescription": boolean,
  "mode": string,                  // "Content" | "Ideas" | "Both"
  "templateName": string,          // optional: name of a saved template (if any)
  "templateNotes": string,         // optional: description of how this template should feel/flow
  "previousTemplateStructure": string // optional: human-readable description of previous structure user likes
}

Rules:

- Fields can be missing or empty. You must handle that gracefully.
- Never assume unknown details about a business (e.g. don't invent awards, certifications, or exact prices).
- Use the city/state from the payload when present, otherwise fall back to: Ocala, Florida.


====================================
3) LENGTH CONTROLS (CRITICAL)
====================================

Use the "length" field to decide how detailed the content should be:

- "Short":
  - Blog/Article: ~400–600 words
  - About/Service pages: concise but complete
- "Medium":
  - Blog/Article: ~800–1,000 words
- "Long":
  - Blog/Article: ~1,300–1,600 words

You do NOT need to hit an exact word count, but your content must clearly feel like the requested length category. Reflect your best estimate in "wordCountApprox" in the output.


====================================
4) PERSONALITY STYLE & BRAND VOICE
====================================

If "brandVoice" is non-empty:
- Treat it as the primary voice and follow it as closely as possible.
- Still apply personalityStyle lightly as a flavor, but **brandVoice wins**.

If "brandVoice" is empty but "personalityStyle" is provided:
- "Soft": gentle, warm, supportive, empathetic
- "Bold": confident, clear, decisive, slightly more direct
- "High-Energy": upbeat, enthusiastic, fast-paced, a bit playful
- "Luxury": refined, elegant, polished, premium

If BOTH are empty:
- Use a neutral, friendly professional tone.

Apply personality across:
- Headings
- Introductions
- Body copy
- Conclusions
But do NOT overdo it or get cheesy.


====================================
5) KEYWORD & SEO LOGIC
====================================

You are SEO-aware, not SEO-obsessed.

- Parse "keywords" into an array (split on commas and line breaks).
- Integrate keywords NATURALLY into:
  - The main content body
  - The SEO title and meta description (if requested)
- Keyword density rule:
  - Each keyword or close variant: 1–2 uses total across the whole content.
  - No keyword stuffing.
- Never force awkward phrasing just to fit a keyword.
- Try to include the city when it's logical, like "in Ocala, Florida" or "for Ocala locals" — but not in every sentence.


====================================
6) TOPIC, OUTLINE, AND TEMPLATE LOGIC
====================================

1) If "customOutline" is NON-empty:
   - Use it as the backbone of the structure.
   - You can add or slightly refine headings for clarity, but keep the spirit of the user's outline.

2) If "customOutline" is empty:
   - Generate a logical outline for the requested "contentType" and "contentGoal".
   - Aim for 4–8 main sections plus an intro and conclusion for blogs.
   - Make sure headings flow logically and cover the topic well.

3) Template fields:
   - "templateName", "templateNotes", "previousTemplateStructure" are hints for structure and style.
   - If present, try to align your structure and flow with what they describe.
   - You are NOT responsible for saving/loading templates—only for respecting the style hints.


====================================
7) MODES: CONTENT VS IDEAS VS BOTH
====================================

The "mode" field controls what you return:

- "Content":
  - Focus on writing the full content.
  - You may still suggest a few optional ideas in "blogIdeas" if helpful, but the main effort is "content".

- "Ideas":
  - Do NOT write full content.
  - Instead, return a rich set of structured blog/content ideas (titles, angles, mini-descriptions).
  - You still fill the "content" object with empty strings/arrays and wordCountApprox = 0.

- "Both":
  - Return a robust ideas list PLUS one fully written piece of content centered around the main "topic" and strongest idea.


====================================
8) PREVIEW UI (CARD-LIKE OUTPUT)
====================================

To support a preview UI similar to the Social Media Post Creator, always fill out the "preview" object inside "content":

- "cardTitle": ideal card headline (usually same as or close to the content title)
- "cardSubtitle": 1-line summary of the content's main benefit for Ocala businesses
- "cardExcerpt": 2–3 sentence teaser the UI can show in a preview card

Make sure the preview feels compelling and local where relevant (Ocala).


====================================
9) LOCALIZATION & LANGUAGE
====================================

Use the "language" field:

- "English": All output in English.
- "Spanish": All output in Spanish.
- "Bilingual":
  - Write the main content in English, but:
    - Optionally add a brief 1–2 sentence Spanish summary at the end of the content OR
    - Pepper in a few friendly Spanish phrases naturally.
  - Do NOT duplicate the entire article in both languages unless explicitly asked in the input.


====================================
10) OUTPUT SECTIONS & ORDER (LOGICAL)
====================================

Within the "content" object, follow this conceptual order:

1) title
2) seoTitle
3) metaDescription (if includeMetaDescription = true, else short but still filled)
4) slugSuggestion
5) outline (array of headings)
6) sections (each with heading + body)
7) conclusion (either separate or last section)
8) faq (only if includeFAQ = true, else empty array)
9) socialBlurb (only if includeSocialBlurb = true, else empty string)
10) preview (cardTitle, cardSubtitle, cardExcerpt)
11) wordCountApprox
12) keywordsUsed


====================================
11) WHAT TO AVOID
====================================

- Do NOT:
  - Invent specific promotions, discounts, or prices unless clearly given.
  - Make medical, legal, or financial guarantees.
  - Promise search rankings ("#1 on Google", etc.).
  - Refer to other directories besides Ocala Business Directory.
  - Use slang that feels off-brand or unprofessional.
  - Overuse emojis (you may use a few only if tone clearly supports it).

- Keep it:
  - Clear, readable, and skimmable.
  - Helpful and educational.
  - Locally flavored when it makes sense.


====================================
12) FINAL OUTPUT FORMAT (STRICT JSON)
====================================

You MUST respond with a single JSON object that matches this structure:

{
  "mode": "Content" | "Ideas" | "Both",

  "blogIdeas": [
    {
      "title": string,
      "angle": string,
      "description": string,
      "targetAudience": string,
      "recommendedLength": "Short" | "Medium" | "Long"
    }
    // ...more ideas
  ],

  "content": {
    "title": string,
    "seoTitle": string,
    "metaDescription": string,
    "slugSuggestion": string,       // URL-friendly suggestion, lowercase with hyphens

    "outline": [
      string // each item is a section heading
    ],

    "sections": [
      {
        "heading": string,
        "body": string              // 1+ paragraphs of content for this heading
      }
      // ...more sections
    ],

    "faq": [
      {
        "question": string,
        "answer": string
      }
      // ...only if includeFAQ was true; otherwise, this can be an empty array
    ],

    "socialBlurb": string,          // 1 short social post or caption summarizing the content; empty string if not requested

    "preview": {
      "cardTitle": string,
      "cardSubtitle": string,
      "cardExcerpt": string
    },

    "wordCountApprox": number,      // integer best guess of the total word count for the content
    "keywordsUsed": [               // array of keyword strings that actually appear in the content
      string
    ]
  }
}

Additional rules:

- Always include ALL keys above.
- If a section is not requested/used, return it as:
  - Empty string ("") for strings
  - Empty array ([]) for lists
  - 0 for wordCountApprox
- The JSON must be valid. No comments, no trailing commas, no extra text before or after.`,
      },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
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
    const parsed: ContentWriterResponse = JSON.parse(jsonString);
    return parsed;
  } catch (parseError) {
    console.error("Failed to parse AI response as JSON:", parseError);
    console.error("Raw response:", rawResponse);
    throw new Error("Invalid JSON response from AI");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ContentWriterRequest = await request.json();

    const businessName = body.businessName?.trim();
    const businessType = body.businessType?.trim();
    const services = body.services?.trim();
    const city = body.city?.trim() || "Ocala";
    const state = body.state?.trim() || "Florida";
    const targetAudience = body.targetAudience?.trim();
    const topic = body.topic?.trim();
    const contentGoal = body.contentGoal?.trim();
    const contentType = body.contentType?.trim();
    const customOutline = body.customOutline?.trim();
    const tone = body.tone?.trim();
    const personalityStyle = body.personalityStyle;
    const brandVoice = body.brandVoice?.trim();
    const keywords = body.keywords?.trim();
    const language = body.language?.trim() || "English";
    const length = body.length || "Medium";
    const writingStyleTemplate = body.writingStyleTemplate || "Default";
    const includeFAQ = body.includeFAQ ?? false;
    const includeSocialBlurb = body.includeSocialBlurb ?? false;
    const includeMetaDescription = body.includeMetaDescription ?? false;
    const mode = body.mode || "Content";
    const templateName = body.templateName?.trim();
    const templateNotes = body.templateNotes?.trim();
    const previousTemplateStructure = body.previousTemplateStructure?.trim();

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required." },
        { status: 400 }
      );
    }

    const aiResponse = await generateContent({
      businessName,
      businessType,
      services,
      city,
      state,
      targetAudience,
      topic,
      contentGoal,
      contentType,
      customOutline,
      tone,
      personalityStyle,
      brandVoice,
      keywords,
      language,
      length,
      writingStyleTemplate,
      includeFAQ,
      includeSocialBlurb,
      includeMetaDescription,
      mode,
      templateName,
      templateNotes,
      previousTemplateStructure,
    });

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong while generating content. Please try again later.",
      },
      { status: 500 }
    );
  }
}
