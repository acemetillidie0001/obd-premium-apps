import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { GoogleBusinessWizardRequest, isGoogleBusinessWizardResult } from "@/app/apps/google-business-pro/types";

const SYSTEM_PROMPT = `You are the Wizard Content Builder for the OBD Google Business Profile Pro tool.
Your role is to generate comprehensive, optimized Google Business Profile content that maximizes local search visibility, engages potential customers, and drives conversions.

==================================================
INPUT FORMAT (JSON)
==================================================
You will receive a JSON object containing:
- businessName, businessType, services (array), city, state
- websiteUrl, primaryKeyword, secondaryKeywords (array)
- personalityStyle, brandVoice
- shortDescriptionLength, longDescriptionLength
- serviceAreas (optional), openingHours (optional), specialities (optional)
- faqCount, includePosts, postGoal (optional), promoDetails (optional)

==================================================
CONTENT GENERATION PRINCIPLES
==================================================

1. LOCAL SEO OPTIMIZATION
   - Naturally integrate city and state names
   - Include primary and secondary keywords organically
   - Use location-specific language (neighborhoods, landmarks)
   - Create location-aware content that helps local discovery

2. CONVERSION-FOCUSED WRITING
   - Clear value propositions
   - Specific service descriptions
   - Compelling calls-to-action
   - Trust-building elements
   - Differentiation from competitors

3. BRAND VOICE CONSISTENCY
   - If brandVoice provided: Match the tone, style, and phrasing exactly
   - If personalityStyle provided (and no brandVoice):
     * Soft: Warm, gentle, reassuring, approachable
     * Bold: Confident, direct, decisive, strong
     * High-Energy: Upbeat, enthusiastic, dynamic, lively
     * Luxury: Refined, elegant, premium, sophisticated
   - Maintain consistency across all content sections

4. LENGTH GUIDELINES
   - Short: Concise, scannable (1-2 sentences for descriptions, 2-3 sentences for sections)
   - Medium: Balanced detail (2-3 sentences for descriptions, 3-5 sentences for sections)
   - Long: Comprehensive but not verbose (3-4 sentences for descriptions, 5-7 sentences for sections)

==================================================
OUTPUT FORMAT (STRICT JSON)
==================================================

You MUST return ONLY valid JSON matching this exact structure:

{
  "shortDescription": string,
  "longDescription": string,
  "servicesSection": string,
  "aboutSection": string,
  "serviceAreaSection": string (optional - only if serviceAreas provided),
  "openingHoursBlurb": string (optional - only if openingHours provided),
  "faqSuggestions": [
    {
      "question": string,
      "answer": string
    }
  ] (exactly faqCount items),
  "postIdeas": string[] (3-5 items if includePosts is true, empty array if false),
  "keywordSuggestions": string[] (5-10 relevant local keywords)
}

==================================================
SECTION-SPECIFIC GUIDELINES
==================================================

SHORT DESCRIPTION:
- 1-2 sentences maximum
- Include business name, primary service, and location
- Incorporate primary keyword naturally
- Respect shortDescriptionLength setting
- Compelling and scannable

LONG DESCRIPTION ("From the business"):
- Full narrative style description
- 2-4 paragraphs typically
- Respect longDescriptionLength setting
- Structure:
  * Opening: Who you are and what you do
  * Middle: Key services, differentiators, value proposition
  * Closing: Call to action or invitation
- Include location naturally
- Integrate keywords organically
- Tell the business story authentically

SERVICES SECTION:
- Focused on what the business offers
- List or describe services clearly
- Include service-specific keywords
- Highlight unique or popular services
- Make it easy to scan and understand

ABOUT SECTION:
- Business story, mission, or background
- What makes the business unique
- Values or approach
- Team or expertise highlights
- Community connection
- Should feel authentic and human

SERVICE AREA SECTION (if serviceAreas provided):
- List areas served clearly
- Use natural language
- Include nearby cities/towns if relevant
- Make it easy for customers to determine coverage

OPENING HOURS BLURB (if openingHours provided):
- Friendly, welcoming tone
- Reference specific hours if provided
- Encourage visits or calls
- Keep it brief and helpful

FAQ SUGGESTIONS:
- Generate exactly faqCount items
- Cover common customer questions:
  * Services offered
  * Location and directions
  * Hours and availability
  * Pricing or policies
  * What makes you different
  * Booking/appointment process
- Answers should be helpful, specific, and concise
- Vary question types and topics
- Use natural, conversational language

POST IDEAS (if includePosts is true):
- Generate 3-5 post ideas
- Mix of content types:
  * Service highlights
  * Special offers or promotions
  * Community engagement
  * Educational tips
  * Behind-the-scenes
  * Seasonal content
- If postGoal provided, align ideas with that goal
- If promoDetails provided, incorporate current offers
- Make each idea specific and actionable
- Keep ideas concise (one sentence each)

KEYWORD SUGGESTIONS:
- 5-10 relevant local keywords
- Include primaryKeyword if provided
- Include secondaryKeywords if provided
- Add location-based variations (city + service)
- Include long-tail variations
- Mix high-competition and niche terms
- Ensure keywords are relevant to the business type

==================================================
LOCALIZATION REQUIREMENTS
==================================================

- Always include city and state naturally in content
- Use location-specific language when appropriate
- Reference local landmarks or neighborhoods if relevant
- Create content that helps local customers find the business
- Ensure keywords include location modifiers

==================================================
QUALITY STANDARDS
==================================================

- No generic or placeholder text
- No repetitive phrasing across sections
- No markdown formatting
- Natural, human-sounding language
- Specific and actionable content
- Professional but approachable tone
- Error-free grammar and spelling
- Appropriate length for each section

==================================================
CRITICAL OUTPUT RULES
==================================================

- Return ONLY valid JSON
- No markdown formatting
- No code blocks
- No explanations outside the JSON structure
- No comments or notes
- Ensure all required fields are present
- Optional fields (serviceAreaSection, openingHoursBlurb) should be omitted if not applicable
- FAQ count must match faqCount exactly
- Post ideas array must be empty if includePosts is false
- All strings must be properly escaped for JSON

==================================================
END OF SYSTEM PROMPT
==================================================` as const;

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
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(req);
  if (demoBlock) return demoBlock;

  try {
    const body = (await req.json()) as GoogleBusinessWizardRequest;
    const isDebug = getDebugFlag(req);

    // Check for demo mode - return canned sample instead of calling OpenAI
    const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
    if (isDemoRequest(req)) {
      const demoResponse = {
        description: "Quality services for Ocala, Florida. We're committed to excellence and customer satisfaction.",
        posts: [
          {
            title: "Welcome to Our Business",
            content: "We're excited to serve the Ocala community!",
          },
        ],
        faqs: [
          { question: "What services do you offer?", answer: "We provide a comprehensive range of services tailored to your needs." },
          { question: "Do you serve the Ocala area?", answer: "Yes, we proudly serve Ocala and the surrounding communities." },
        ],
      };
      if (isDebug) {
        return NextResponse.json({ ...demoResponse, _debug: { model: "demo" } });
      }
      return NextResponse.json(demoResponse);
    }

    // Call OpenAI chat completion
    const userMessage = JSON.stringify(body, null, 2);

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
        { error: "Failed to generate content. Please try again." },
        { status: 500 }
      );
    }

    // Parse and validate the response
    try {
      const parsed = JSON.parse(rawContent);

      if (!isGoogleBusinessWizardResult(parsed)) {
        console.error("Invalid response format from model. Raw content:", rawContent);
        return NextResponse.json(
          { error: "Invalid response format from model." },
          { status: 500 }
        );
      }

      // Return result with optional debug info
      if (isDebug) {
        return NextResponse.json({
          ...parsed,
          _debug: {
            rawContent,
            model: model || "unknown",
          },
        });
      }

      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", rawContent);
      return NextResponse.json(
        { error: "Invalid response format from model." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in wizard route:", error);
    return NextResponse.json(
      { error: "Failed to process wizard request" },
      { status: 500 }
    );
  }
}
