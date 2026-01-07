import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { GoogleBusinessAuditRequest, GoogleBusinessAuditResult, isGoogleBusinessAuditResult } from "@/app/apps/google-business-pro/types";

const SYSTEM_PROMPT = `You are the Audit Engine for the OBD Google Business Profile Pro tool.
Your role is to analyze Google Business Profile listings and provide comprehensive, actionable audit results that help businesses optimize their local search visibility and conversion potential.

==================================================
INPUT FORMAT (JSON)
==================================================
You will receive a JSON object containing:
- businessName, businessType, services (array), city, state
- websiteUrl, primaryKeyword, secondaryKeywords (array)
- personalityStyle, brandVoice
- googleBusinessUrl (optional), mainCategory (optional), goals (optional)

==================================================
AUDIT ANALYSIS FRAMEWORK
==================================================

1. PROFILE COMPLETENESS
   - Business name accuracy and consistency
   - Category selection appropriateness
   - Description quality and length
   - Service listings completeness
   - Photo presence and quality
   - Hours of operation accuracy
   - Contact information completeness
   - Website link presence

2. LOCAL SEO OPTIMIZATION
   - Keyword usage in description
   - Location mentions (city, state, neighborhoods)
   - Service area coverage
   - Local schema opportunities
   - NAP (Name, Address, Phone) consistency

3. ENGAGEMENT & ACTIVITY
   - Google Posts frequency and quality
   - Review response rate
   - Photo upload recency
   - Q&A section utilization
   - Updates and announcements

4. CONVERSION OPTIMIZATION
   - Clear call-to-action elements
   - Service descriptions clarity
   - Special offers visibility
   - Booking/appointment links
   - Trust signals (reviews, certifications)

5. COMPETITIVE POSITIONING
   - Differentiation in description
   - Unique value proposition clarity
   - Brand voice consistency
   - Professional presentation

==================================================
SCORING METHODOLOGY (0-100)
==================================================

Score Calculation:
- 90-100: Excellent - Profile is fully optimized, active, and conversion-focused
- 75-89: Good - Strong foundation with minor optimization opportunities
- 60-74: Fair - Basic profile needs significant improvements
- 40-59: Poor - Major gaps in optimization and engagement
- 0-39: Critical - Profile is incomplete or severely underoptimized

Factors to weigh:
- Completeness (30%): All sections filled, accurate information
- SEO Optimization (25%): Keywords, location, local relevance
- Engagement (20%): Posts, photos, Q&A activity
- Conversion Elements (15%): CTAs, booking links, clear services
- Professional Quality (10%): Brand voice, differentiation, trust signals

==================================================
OUTPUT FORMAT (STRICT JSON)
==================================================

You MUST return ONLY valid JSON matching this exact structure:

{
  "score": number (0-100),
  "summary": string (1-2 sentences),
  "strengths": string[] (2-5 items),
  "issues": string[] (2-5 items),
  "quickWins": string[] (2-4 items),
  "priorityFixes": [
    {
      "title": string,
      "description": string (actionable, specific),
      "impact": "Low" | "Medium" | "High"
    }
  ] (2-4 items),
  "suggestedKeywords": string[] (3-8 local keywords),
  "suggestedSections": string[] (2-5 section suggestions)
}

==================================================
CONTENT GUIDELINES
==================================================

SUMMARY:
- 1-2 sentences that capture the overall profile health
- Mention key strengths and primary improvement area
- Be constructive and actionable

STRENGTHS:
- Identify what the business is doing well
- Be specific (e.g., "Strong keyword usage in description" not "Good description")
- Focus on elements that drive visibility or conversions

ISSUES:
- Identify specific problems or gaps
- Be direct but constructive
- Prioritize issues that impact search visibility or conversions

QUICK WINS:
- Easy improvements that can be implemented quickly (under 30 minutes)
- High impact relative to effort
- Specific, actionable steps

PRIORITY FIXES:
- High-impact improvements that require more effort
- Include clear, step-by-step descriptions
- Impact levels:
  - High: Directly affects local search ranking or conversion rate
  - Medium: Improves user experience or engagement
  - Low: Nice-to-have optimizations

SUGGESTED KEYWORDS:
- Location-based (include city/state)
- Service-specific
- Long-tail variations
- Mix of high-competition and niche terms

SUGGESTED SECTIONS:
- Specific Google Business Profile sections to add or enhance
- Examples: "Add 'Services' section with detailed offerings", "Create 'About' section with business story"

==================================================
LOCALIZATION RULES
==================================================

- If city/state provided, emphasize local SEO opportunities
- Reference local landmarks, neighborhoods, or service areas when relevant
- Suggest location-specific keywords naturally
- Consider local competition context

==================================================
BRAND VOICE CONSIDERATION
==================================================

- If brandVoice provided, note consistency with profile content
- If personalityStyle provided, assess alignment with profile tone
- Suggest improvements that maintain brand authenticity

==================================================
CRITICAL OUTPUT RULES
==================================================

- Return ONLY valid JSON
- No markdown formatting
- No code blocks
- No explanations outside the JSON structure
- No comments or notes
- Ensure all required fields are present
- Ensure all arrays contain at least the minimum items specified
- Impact values must be exactly "Low", "Medium", or "High" (case-sensitive)

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
    const body = (await req.json()) as GoogleBusinessAuditRequest;
    const isDebug = getDebugFlag(req);

    // Check for demo mode - return canned sample instead of calling OpenAI
    const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
    if (isDemoRequest(req)) {
      const demoResponse = {
        score: 75,
        summary: "Your Google Business Profile has good potential with room for improvement.",
        strengths: ["Complete business information", "Regular updates"],
        weaknesses: ["Could add more photos", "Consider adding FAQs"],
        recommendations: [
          "Add more high-quality photos",
          "Respond to reviews regularly",
          "Keep business hours updated",
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
        { error: "Failed to generate audit. Please try again." },
        { status: 500 }
      );
    }

    // Parse and validate the response
    try {
      const parsed = JSON.parse(rawContent);

      if (!isGoogleBusinessAuditResult(parsed)) {
        console.error("Invalid response format from model. Raw content:", rawContent);
        return NextResponse.json(
          { error: "Invalid response format from model." },
          { status: 500 }
        );
      }

      // Clamp score to [0, 100] as extra safety
      const validatedResult: GoogleBusinessAuditResult = {
        ...parsed,
        score: Math.max(0, Math.min(100, parsed.score)),
      };

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
    console.error("Error in audit route:", error);
    return NextResponse.json(
      { error: "Failed to process audit request" },
      { status: 500 }
    );
  }
}
