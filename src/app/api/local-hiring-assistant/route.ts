// src/app/api/local-hiring-assistant/route.ts
import { NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai-client';
import { requireUserSession } from "@/lib/auth/requireUserSession";
import { apiErrorResponse } from "@/lib/api/errorHandler";
import type {
  LocalHiringAssistantRequest,
  LocalHiringAssistantResponse,
  EmploymentType,
  WorkLocationType,
  PersonalityStyle,
  JobPostLength,
  LanguageOption,
} from '@/app/apps/local-hiring-assistant/types';

const SYSTEM_PROMPT = `
You are the "Local Hiring Assistant" for Ocala Business Directory (OBD).

Your job:
- Turn a local business owner's inputs into:
  1) A clear, structured job description
  2) Optional short social job posts for multiple platforms
  3) Optional screening questions
  4) Optional interview questions
  5) Optional benefits highlight bullets
  6) Optional application instructions

Global rules:
- Always output STRICT JSON that matches the LocalHiringAssistantResponse TypeScript interface.
- DO NOT include markdown fences, backticks, or any explanation.
- Respect the \`language\` field:
  - "English": write everything in English.
  - "Spanish": write everything in Spanish.
  - "Bilingual": write a short bilingual style (English first, then Spanish in parentheses) where natural.
- Use the \`brandVoice\` when provided; otherwise, use \`personalityStyle\`:
  - Soft: warm, reassuring, people-first
  - Bold: confident, direct, decisive
  - High-Energy: upbeat, enthusiastic, fast-paced
  - Luxury: refined, elevated, detail-focused
- Use the \`jobPostLength\` to control the overall job post and short posts:
  - Short: concise and punchy
  - Medium: balanced detail
  - Long: more thorough, but still scannable
- Use the \`city\` and \`state\` to keep the role grounded locally (e.g. highlight local community and area).

Job description structure:
- jobDescriptionSections is an ordered array, with suggested titles like:
  - "About the Role"
  - "Key Responsibilities"
  - "What We're Looking For"
  - "Must-Have Skills"
  - "Nice-to-Have Skills" (only if provided)
  - "Benefits & Perks" (only if provided)
  - "About [BusinessName]" (if aboutCompany or services present)

Short job post pack (shortJobPostPack):
- Only include if includeShortJobPostPack is true.
- If includeShortJobPostPack is false, DO NOT include this field in the JSON response at all (omit it completely).
- Create 3–5 posts for key platforms (Facebook, Instagram, GoogleBusinessProfile, X, LinkedIn).
- Each item must have:
  - platform: one of the allowed enum values (Facebook, Instagram, GoogleBusinessProfile, X, LinkedIn)
  - headline: hook that names the role and local area
  - body: 1–3 short paragraphs or lines
  - callToAction: clear, simple instruction on how to apply

Screening questions:
- Only include if includeScreeningQuestions is true.
- If includeScreeningQuestions is false, DO NOT include this field in the JSON response at all (omit it completely).
- Generate 4–7 concise questions.
- Focus on must-have skills, availability, experience level, and local fit.
- Each question must have a "question" field (string).
- Each question may optionally include a "rationale" field (string) explaining why it matters.

Interview questions:
- Only include if includeInterviewQuestions is true.
- If includeInterviewQuestions is false, DO NOT include this field in the JSON response at all (omit it completely).
- Generate 6–10 questions.
- Mix behavioral, situational, and skill-based questions.
- Each question must have a "question" field (string).
- Each question should include a "rationale" field (string) explaining what the interviewer should listen for.

Benefits highlight:
- Only include if includeBenefitsHighlight is true.
- If includeBenefitsHighlight is false, DO NOT include this field in the JSON response at all (omit it completely).
- Convert benefits list + other context into 3–7 punchy bullet points (array of strings).
- Tailor to local candidates and the specific business type.

Application instructions:
- Only include if includeApplicationInstructions is true.
- If includeApplicationInstructions is false, DO NOT include this field in the JSON response at all (omit it completely).
- Explain clearly how to apply based on hints in the input.
- If no clear instructions are provided in the input, use a simple default like:
  "To apply, please send your resume and a short note explaining why you'd be a great fit to our main contact email, and include your availability for an interview."
- Must be a string (not an array).

Important:
- Never invent compensation numbers if the user does not provide them. Instead, refer to "competitive pay" or "market-competitive compensation."
- Do NOT mention OBD, AI, or that this was machine-generated.
- Keep everything employer-facing and ready to paste into a job board or careers page.

Output format (STRICT JSON, no markdown):
{
  "jobTitle": string,
  "companyName": string,
  "location": string,
  "jobDescriptionSections": [{"title": string, "body": string}, ...],
  "shortJobPostPack": [{"platform": string, "headline": string, "body": string, "callToAction": string}, ...] (ONLY if includeShortJobPostPack is true, otherwise OMIT this field),
  "screeningQuestions": [{"question": string, "rationale": string}, ...] (ONLY if includeScreeningQuestions is true, otherwise OMIT this field),
  "interviewQuestions": [{"question": string, "rationale": string}, ...] (ONLY if includeInterviewQuestions is true, otherwise OMIT this field),
  "benefitsHighlight": [string, ...] (ONLY if includeBenefitsHighlight is true, otherwise OMIT this field),
  "applicationInstructions": string (ONLY if includeApplicationInstructions is true, otherwise OMIT this field),
  "meta": {
    "modelVersion": "local-hiring-v1",
    "createdAt": ISO-8601 timestamp string
  }
}

CRITICAL: Do NOT include optional fields if their corresponding toggle is false. Omit them from the JSON entirely. Do NOT set them to null or empty arrays/strings.
`.trim();

function parseJsonFromModel(raw: string): unknown {
  let text = raw.trim();

  if (text.startsWith('```')) {
    // Strip ```json or ``` and closing ```
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }

  return JSON.parse(text);
}

export async function POST(req: Request) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(req as any);
  if (demoBlock) return demoBlock;

  // Auth gate (repo pattern: NextAuth v5 via requireUserSession/auth())
  const session = await requireUserSession();
  if (!session) {
    return apiErrorResponse("Authentication required", "UNAUTHORIZED", 401);
  }

  try {
    const body = (await req.json()) as LocalHiringAssistantRequest & {
      businessId?: string;
    };

    // Tenant gate: require businessId (prefer body; allow query fallback)
    const url = new URL(req.url);
    const businessIdRaw = (body.businessId ?? url.searchParams.get("businessId") ?? "").trim();
    if (!businessIdRaw) {
      return apiErrorResponse("Business ID is required", "BUSINESS_REQUIRED", 400);
    }

    // Tenant safety: verify businessId is accessible to current session user/context
    // Suite pattern observed elsewhere: businessId == userId (V3: userId = businessId)
    if (businessIdRaw !== session.userId) {
      return apiErrorResponse("Business access denied", "FORBIDDEN", 403);
    }

    if (!body.businessName || !body.businessName.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: businessName' },
        { status: 400 },
      );
    }

    if (!body.businessType || !body.businessType.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: businessType' },
        { status: 400 },
      );
    }

    if (!body.roleTitle || !body.roleTitle.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: roleTitle' },
        { status: 400 },
      );
    }

    // Validate enum values
    const validEmploymentTypes: EmploymentType[] = [
      'Full-Time',
      'Part-Time',
      'Contract',
      'Seasonal',
      'Temporary',
    ];
    if (!validEmploymentTypes.includes(body.employmentType)) {
      return NextResponse.json(
        { error: 'Invalid employmentType value' },
        { status: 400 },
      );
    }

    const validWorkLocationTypes: WorkLocationType[] = [
      'On-site',
      'Hybrid',
      'Remote',
    ];
    if (!validWorkLocationTypes.includes(body.workLocationType)) {
      return NextResponse.json(
        { error: 'Invalid workLocationType value' },
        { status: 400 },
      );
    }

    const validPersonalityStyles: PersonalityStyle[] = [
      'None',
      'Soft',
      'Bold',
      'High-Energy',
      'Luxury',
    ];
    if (!validPersonalityStyles.includes(body.personalityStyle)) {
      return NextResponse.json(
        { error: 'Invalid personalityStyle value' },
        { status: 400 },
      );
    }

    const validJobPostLengths: JobPostLength[] = ['Short', 'Medium', 'Long'];
    if (!validJobPostLengths.includes(body.jobPostLength)) {
      return NextResponse.json(
        { error: 'Invalid jobPostLength value' },
        { status: 400 },
      );
    }

    const validLanguages: LanguageOption[] = ['English', 'Spanish', 'Bilingual'];
    if (!validLanguages.includes(body.language)) {
      return NextResponse.json(
        { error: 'Invalid language value' },
        { status: 400 },
      );
    }

    const city = body.city || 'Ocala';
    const state = body.state || 'Florida';

    // Check for demo mode - return canned sample instead of calling OpenAI
    const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
    if (isDemoRequest(req as any)) {
      const demoResponse = {
        jobTitle: body.roleTitle,
        companyName: body.businessName,
        location: `${city}, ${state}`,
        jobDescriptionSections: [
          {
            title: "About the Role",
            body: `We're seeking a ${body.roleTitle} to join our team in ${city}, ${state}. This is a ${body.employmentType} position with ${body.workLocationType} work arrangements.`,
          },
          {
            title: "Responsibilities",
            body: "Key responsibilities include supporting our team, contributing to business growth, and delivering excellent service to our customers.",
          },
          {
            title: "Requirements",
            body: "We're looking for someone with relevant experience, strong communication skills, and a commitment to excellence.",
          },
        ],
        meta: {
          modelVersion: "local-hiring-v1",
          createdAt: new Date().toISOString(),
        },
      };
      return NextResponse.json(demoResponse);
    }

    const userPrompt = {
      ...body,
      city,
      state,
    };

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.OBD_OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify(userPrompt),
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No content returned from model' },
        { status: 500 },
      );
    }

    let parsed: LocalHiringAssistantResponse;
    try {
      parsed = parseJsonFromModel(content) as LocalHiringAssistantResponse;
    } catch (err: unknown) {
      // Log error without exposing full content (privacy/security)
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown parse error';
      const contentPreview = content.substring(0, 200);
      console.error('JSON parse error:', errorMessage, 'Preview:', contentPreview);
      return NextResponse.json(
        { error: 'Failed to parse model response as JSON' },
        { status: 500 },
      );
    }

    // Enhanced validation
    if (!parsed.jobTitle || !parsed.companyName || !parsed.location) {
      return NextResponse.json(
        { error: 'Model response missing required top-level fields' },
        { status: 500 },
      );
    }

    // Validate jobDescriptionSections
    if (
      !Array.isArray(parsed.jobDescriptionSections) ||
      parsed.jobDescriptionSections.length === 0
    ) {
      return NextResponse.json(
        { error: 'Model response missing or empty jobDescriptionSections' },
        { status: 500 },
      );
    }

    // Validate each section has required fields
    for (const section of parsed.jobDescriptionSections) {
      if (!section.title || !section.body) {
        return NextResponse.json(
          { error: 'Invalid jobDescriptionSections structure' },
          { status: 500 },
        );
      }
    }

    // Ensure meta is set
    if (!parsed.meta) {
      parsed.meta = {
        modelVersion: 'local-hiring-v1',
        createdAt: new Date().toISOString(),
      };
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: 'Unexpected error in Local Hiring Assistant API' },
      { status: 500 },
    );
  }
}
