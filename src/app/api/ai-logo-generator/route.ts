import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { generateImage } from "@/lib/image/generateImage";
import { auth } from "@/lib/auth";
import { incrementUsage, checkUsage } from "@/lib/usage/usageTracker";
import type {
  LogoGeneratorRequest,
  LogoGeneratorResponse,
  LogoConcept,
  LogoImage,
} from "@/app/apps/ai-logo-generator/types";

// ---- RATE LIMITING ---- //

interface RateLimitEntry {
  hourlyCount: number;
  hourlyWindowStart: number;
  dailyCount: number;
  dailyWindowStart: number;
}

// Rate limit: IP -> { hourlyCount, hourlyWindowStart, dailyCount, dailyWindowStart }
const rateLimits = new Map<string, RateLimitEntry>();

const RATE_LIMIT_HOURLY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX_REQUESTS_PER_HOUR = 10;
const RATE_LIMIT_MAX_REQUESTS_PER_DAY = 30;

/**
 * Get client IP for rate limiting
 */
function getClientIP(req: Request): string {
  // Try various headers (for proxies, load balancers, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  // Fallback (may not work in all environments)
  return "global";
}

/**
 * Check rate limit for a client IP
 * Returns { allowed: boolean, retryAfterSeconds?: number }
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  // Initialize entry if it doesn't exist
  if (!entry) {
    const newEntry: RateLimitEntry = {
      hourlyCount: 1,
      hourlyWindowStart: now,
      dailyCount: 1,
      dailyWindowStart: now,
    };
    rateLimits.set(ip, newEntry);
    return { allowed: true };
  }

  // Reset daily window if expired
  if (now - entry.dailyWindowStart >= RATE_LIMIT_DAILY_WINDOW_MS) {
    entry.dailyCount = 1;
    entry.dailyWindowStart = now;
  } else {
    entry.dailyCount++;
  }

  // Reset hourly window if expired
  if (now - entry.hourlyWindowStart >= RATE_LIMIT_HOURLY_WINDOW_MS) {
    entry.hourlyCount = 1;
    entry.hourlyWindowStart = now;
    return { allowed: true };
  }

  // Check daily limit
  if (entry.dailyCount > RATE_LIMIT_MAX_REQUESTS_PER_DAY) {
    const retryAfter = Math.ceil((RATE_LIMIT_DAILY_WINDOW_MS - (now - entry.dailyWindowStart)) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  // Check hourly limit
  if (entry.hourlyCount >= RATE_LIMIT_MAX_REQUESTS_PER_HOUR) {
    const retryAfter = Math.ceil((RATE_LIMIT_HOURLY_WINDOW_MS - (now - entry.hourlyWindowStart)) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  entry.hourlyCount++;
  return { allowed: true };
}

// ---- SAFETY CHECKS ---- //

/**
 * List of blocked brand terms that should not appear in generated content
 * Case-insensitive matching, minimal list to avoid false positives
 */
const BLOCKED_BRAND_TERMS = [
  "disney",
  "nike",
  "apple",
  "starbucks",
  "mcdonald",
  "marvel",
  "pokemon",
  "coca-cola",
  "pepsi",
  "adidas",
  "gucci",
  "louis vuitton",
  "chanel",
  "versace",
  "prada",
  "dolce",
  "gabbana",
  "hermes",
  "cartier",
  "tiffany",
  "rolex",
  "mercedes",
  "bmw",
  "audi",
  "ferrari",
  "lamborghini",
  "porsche",
  "tesla",
  "amazon",
  "google",
  "microsoft",
  "facebook",
  "meta",
  "twitter",
  "x.com",
  "instagram",
  "netflix",
  "spotify",
  "uber",
  "airbnb",
  "samsung",
  "sony",
  "nintendo",
  "xbox",
  "playstation",
  "warner bros",
  "paramount",
  "universal studios",
  "pixar",
  "dreamworks",
];

/**
 * Check if text contains any blocked brand terms
 * Returns the first blocked term found, or null if safe
 */
function containsBlockedTerm(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const term of BLOCKED_BRAND_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

/**
 * Check if a logo concept contains blocked terms
 * Returns the blocked term if found, or null if safe
 */
function checkConceptSafety(concept: LogoConcept): string | null {
  // Check description
  const descBlocked = containsBlockedTerm(concept.description);
  if (descBlocked) return descBlocked;

  // Check styleNotes
  const styleBlocked = containsBlockedTerm(concept.styleNotes);
  if (styleBlocked) return styleBlocked;

  return null;
}

/**
 * Generate a safe fallback concept to replace a blocked one
 */
function generateSafeFallbackConcept(
  conceptId: number,
  businessName: string,
  businessType: string,
  logoStyle: string
): LogoConcept {
  return {
    id: conceptId,
    description: `A clean, professional logo design for ${businessName}, a ${businessType} business. The design features simple geometric shapes and modern typography, suitable for versatile use across digital and print media.`,
    styleNotes: `${logoStyle} style with clean lines and balanced composition`,
    colorPalette: ["#2C3E50", "#3498DB", "#ECF0F1"],
  };
}

async function generateLogoConcepts(
  request: LogoGeneratorRequest
): Promise<LogoConcept[]> {
  const fields: string[] = [
    `businessName: ${request.businessName}`,
    `businessType: ${request.businessType}`,
  ];

  if (request.services) fields.push(`services: ${request.services}`);
  if (request.city) fields.push(`city: ${request.city}`);
  if (request.state) fields.push(`state: ${request.state}`);
  if (request.brandVoice) fields.push(`brandVoice: ${request.brandVoice}`);
  if (request.personalityStyle) fields.push(`personalityStyle: ${request.personalityStyle}`);
  if (request.logoStyle) fields.push(`logoStyle: ${request.logoStyle}`);
  if (request.colorPreferences) fields.push(`colorPreferences: ${request.colorPreferences}`);
  if (request.includeText !== undefined) fields.push(`includeText: ${request.includeText}`);

  const userMessage = fields.join("\n");

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the **OBD AI Logo Generator V3**, a specialist designer for the **Ocala Business Directory (OBD)**. Your job is to create compelling logo concept descriptions for local Ocala businesses.

You generate:
- 3-5 distinct logo concept descriptions
- Each concept includes: description, style notes, and color palette suggestions
- Concepts should be suitable for DALL-E image generation

## INPUT FORMAT

You will receive business details in this format:
- businessName: string
- businessType: string
- services: string (optional)
- city: string (optional, usually "Ocala")
- state: string (optional, usually "Florida")
- brandVoice: string (optional)
- personalityStyle: "Soft" | "Bold" | "High-Energy" | "Luxury" (optional)
- logoStyle: "Modern" | "Classic" | "Minimalist" | "Vintage" | "Playful" | "Professional" (optional)
- colorPreferences: string (optional)
- includeText: boolean (optional)

## OUTPUT FORMAT (JSON)

Return a JSON array of logo concepts:

[
  {
    "id": 1,
    "description": "Detailed description of the logo concept suitable for DALL-E prompt generation",
    "styleNotes": "Brief style notes (e.g., 'Modern geometric with soft edges')",
    "colorPalette": ["#hex1", "#hex2", "#hex3"]
  },
  ...
]

## LOGO CONCEPT GUIDELINES

1. **Description Quality**
   - Write detailed, visual descriptions that work well for DALL-E
   - Include: shape style, icon style, layout, text treatment (if includeText is true)
   - Be specific about visual elements (e.g., "rounded geometric shapes" not just "geometric")

2. **Style Alignment**
   - Match logoStyle if provided
   - Reflect personalityStyle subtly in the design approach
   - Honor brandVoice if provided

3. **Color Palette**
   - Provide 2-4 colors per concept
   - Use hex codes
   - Consider local/Ocala context (e.g., warm Florida colors if appropriate)
   - Match personality: Soft = pastels, Bold = vibrant, Luxury = deep/rich, High-Energy = bright

4. **Local Context**
   - If city is Ocala or state is Florida, consider subtle local elements (but don't force it)
   - Keep designs professional and versatile

5. **Variety**
   - Each concept should be distinctly different
   - Vary: icon style, layout, color approach, complexity

## WHAT TO AVOID

- Generic clipart-style descriptions
- Overly complex designs that won't render well
- Text-heavy descriptions (focus on visual elements)
- Mentioning AI or generation process
- Including actual business contact info in descriptions

## SAFETY & ORIGINALITY REQUIREMENTS (CRITICAL)

You MUST generate ONLY original logo concepts. You are STRICTLY FORBIDDEN from:

1. **Copying or Imitating Well-Known Brand Logos**
   - Do NOT create concepts that resemble, mimic, or reference logos from major brands (e.g., Nike swoosh, Apple apple, McDonald's arches, Starbucks siren, etc.)
   - Do NOT use distinctive visual elements that are strongly associated with famous brands
   - All concepts must be completely original and unique

2. **Using Copyrighted Characters or Brand Names**
   - Do NOT reference or incorporate copyrighted characters (e.g., Disney characters, Marvel superheroes, Pokemon, etc.)
   - Do NOT use well-known brand names, mascots, or character designs in any form
   - Do NOT create concepts that could be confused with existing trademarked logos

3. **Using Trademarked Slogans**
   - Do NOT include or reference trademarked slogans or taglines from major brands
   - All text and messaging must be original

4. **Using "Official" Claims**
   - Do NOT use language that implies official endorsement, certification, or affiliation with any brand, organization, or entity
   - Do NOT claim "official" status unless explicitly provided in the business context

5. **Original Concepts Only**
   - Every concept must be a fresh, original design idea
   - Draw inspiration from design principles, not from existing brand identities
   - Focus on creating unique visual identities that stand on their own

If you cannot create an original concept that avoids these restrictions, generate a safe, generic alternative that still matches the business requirements.

Return ONLY valid JSON array, no markdown, no explanations.`,
      },
      { role: "user", content: userMessage },
    ],
    temperature: 0.8,
  });

  const rawResponse = completion.choices[0]?.message?.content?.trim() || "";

  if (!rawResponse) {
    throw new Error("Empty response from AI");
  }

  // Parse JSON response (may be wrapped in markdown code blocks)
  let jsonString = rawResponse.trim();
  
  // Remove markdown code fences if present
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  } else if (jsonString.startsWith("```")) {
    jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  // Extract first '[' and last ']' if extra text exists (for array responses)
  const firstBrace = jsonString.indexOf("[");
  const lastBrace = jsonString.lastIndexOf("]");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  try {
    const concepts: LogoConcept[] = JSON.parse(jsonString);
    
    // Validate parsed concepts
    if (!Array.isArray(concepts)) {
      throw new Error("AI response is not an array");
    }
    
    if (concepts.length === 0) {
      throw new Error("AI response contains no concepts");
    }
    
    // Validate each concept has required fields
    for (const concept of concepts) {
      if (!concept.id || !concept.description || !concept.styleNotes || !Array.isArray(concept.colorPalette)) {
        throw new Error("Invalid concept structure in AI response");
      }
    }
    
    return concepts;
  } catch (parseError) {
    console.error("Failed to parse AI response as JSON:", parseError);
    console.error("Raw response (first 500 chars):", rawResponse.substring(0, 500));
    throw new Error("Invalid JSON response from AI. Please try again.");
  }
}

async function generateLogoImages(
  concepts: LogoConcept[],
  businessName: string,
  includeText: boolean
): Promise<LogoImage[]> {
  const images: LogoImage[] = [];

  for (const concept of concepts) {
    // Build DALL-E prompt
    let prompt = `A professional logo design: ${concept.description}`;
    
    if (includeText) {
      prompt += ` The logo includes the business name "${businessName}" integrated into the design.`;
    } else {
      prompt += ` This is an icon-only logo, no text.`;
    }
    
    prompt += ` Style: ${concept.styleNotes}. Colors: ${concept.colorPalette.join(", ")}. Clean, professional, high-quality logo design suitable for business use. Original design only, no references to existing brands or copyrighted material.`;

    try {
      const result = await generateImage({ prompt });
      images.push({
        id: images.length + 1,
        conceptId: concept.id,
        imageUrl: result.url,
        prompt,
      });
    } catch (error) {
      console.error(`Error generating image for concept ${concept.id}:`, error);
      // Continue with other concepts even if one fails
      images.push({
        id: images.length + 1,
        conceptId: concept.id,
        imageUrl: null,
        prompt,
        imageError: error instanceof Error ? error.message : "Failed to generate image",
      });
    }
  }

  return images;
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // Rate limiting check (IP-based, separate from user quotas)
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // Read and check request body size (limit to 50KB)
    const bodyText = await request.text();
    if (bodyText.length > 50 * 1024) {
      return NextResponse.json(
        { error: "Request body too large. Maximum size is 50KB. Please reduce the length of your descriptions." },
        { status: 413 }
      );
    }

    let body: LogoGeneratorRequest;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    // Request validation
    if (!body.businessName || typeof body.businessName !== "string") {
      return NextResponse.json(
        { error: "Business name is required and must be a string." },
        { status: 400 }
      );
    }

    if (!body.businessType || typeof body.businessType !== "string") {
      return NextResponse.json(
        { error: "Business type is required and must be a string." },
        { status: 400 }
      );
    }

    // Validate and clamp text field lengths
    const businessNameTrimmed = body.businessName.trim();
    const businessTypeTrimmed = body.businessType.trim();

    if (!businessNameTrimmed || !businessTypeTrimmed) {
      return NextResponse.json(
        { error: "Business name and business type cannot be empty." },
        { status: 400 }
      );
    }

    if (businessNameTrimmed.length > 80) {
      return NextResponse.json(
        { error: "Business name must be 80 characters or less." },
        { status: 400 }
      );
    }

    if (businessTypeTrimmed.length > 80) {
      return NextResponse.json(
        { error: "Business type must be 80 characters or less." },
        { status: 400 }
      );
    }

    // Clamp optional text fields
    const brandVoiceTrimmed = body.brandVoice?.trim();
    if (brandVoiceTrimmed && brandVoiceTrimmed.length > 600) {
      return NextResponse.json(
        { error: "Brand voice must be 600 characters or less." },
        { status: 400 }
      );
    }

    // Validate and clamp variationsCount (3-8)
    let variationsCount = body.variationsCount ?? 3;
    if (typeof variationsCount !== "number" || !Number.isFinite(variationsCount)) {
      variationsCount = 3;
    }
    // Clamp to valid range
    variationsCount = Math.min(8, Math.max(3, Math.round(variationsCount)));

    const cityTrimmed = body.city?.trim() || "Ocala";
    const stateTrimmed = body.state?.trim() || "Florida";
    const logoStyle = body.logoStyle || "Modern";
    const personalityStyle = body.personalityStyle || "";

    // Check for demo mode - return canned sample instead of calling OpenAI
    const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
    if (isDemoRequest(request)) {
      const demoConcepts: LogoConcept[] = Array.from({ length: variationsCount }, (_, i) => ({
        id: i + 1,
        description: `A ${logoStyle.toLowerCase()} logo design for ${businessNameTrimmed}, featuring clean lines and professional styling suitable for ${businessTypeTrimmed}.`,
        styleNotes: "Modern and professional design",
        colorPalette: ["#1E88E5", "#43A047", "#FFB300"],
      }));
      const demoResponse: LogoGeneratorResponse & { countUsed: number } = {
        concepts: demoConcepts,
        images: body.generateImages ? demoConcepts.map((c) => ({
          id: c.id,
          conceptId: c.id,
          imageUrl: null,
          prompt: c.description,
        })) : [],
        meta: {
          businessName: businessNameTrimmed,
          city: cityTrimmed,
          state: stateTrimmed,
          logoStyle,
          personalityStyle: personalityStyle || "",
        },
        countUsed: demoConcepts.length,
      };
      return NextResponse.json(demoResponse);
    }

    // Check and increment usage quotas (before making OpenAI calls)
    const generateImages = body.generateImages === true;
    const usageResult = await incrementUsage({
      userId,
      generateImages,
    });

    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: "Daily limit reached",
          message: "You've reached today's limit for this tool. Please try again tomorrow.",
          limits: {
            conceptsPerDay: usageResult.conceptsLimit,
            imagesPerDay: usageResult.imagesLimit,
          },
          usage: {
            conceptsUsed: usageResult.conceptsUsed,
            imagesUsed: usageResult.imagesUsed,
          },
          resetsAt: usageResult.resetsAt,
        },
        { status: 429 }
      );
    }

    // Generate logo concepts
    const concepts = await generateLogoConcepts({
      businessName: businessNameTrimmed,
      businessType: businessTypeTrimmed,
      services: body.services?.trim(),
      city: cityTrimmed,
      state: stateTrimmed,
      brandVoice: brandVoiceTrimmed || undefined,
      personalityStyle: body.personalityStyle || undefined,
      logoStyle: logoStyle,
      colorPreferences: body.colorPreferences?.trim(),
      includeText: body.includeText ?? true,
    });

    // Safety check: scan concepts for blocked brand terms
    const safeConcepts: LogoConcept[] = [];
    let blockedCount = 0;

    for (const concept of concepts) {
      const blockedTerm = checkConceptSafety(concept);
      if (blockedTerm) {
        console.warn(
          `Blocked term "${blockedTerm}" detected in concept ${concept.id}. Replacing with safe fallback.`
        );
        blockedCount++;
        // Replace with safe fallback
        safeConcepts.push(
          generateSafeFallbackConcept(concept.id, businessNameTrimmed, businessTypeTrimmed, logoStyle)
        );
      } else {
        safeConcepts.push(concept);
      }
    }

    // If more than half of concepts were blocked, return error instead of proceeding with mostly fallbacks
    if (blockedCount > concepts.length / 2) {
      return NextResponse.json(
        { error: "Requested content references protected brands. Please revise your input and try again." },
        { status: 400 }
      );
    }

    // Limit to requested number of variations
    const selectedConcepts = safeConcepts.slice(0, variationsCount);
    const countUsed = selectedConcepts.length;

    // Generate images only if requested
    let images: LogoImage[] = [];
    if (body.generateImages === true) {
      images = await generateLogoImages(
        selectedConcepts,
        businessNameTrimmed,
        body.includeText ?? true
      );
      
      // Ensure every concept has a corresponding image entry (safety check)
      // This handles edge cases where image generation might not return entries for all concepts
      const imageConceptIds = new Set(images.map((img) => img.conceptId));
      for (const concept of selectedConcepts) {
        if (!imageConceptIds.has(concept.id)) {
          // Missing image entry for this concept - create a fallback
          let prompt = `A professional logo design: ${concept.description}`;
          if (body.includeText ?? true) {
            prompt += ` The logo includes the business name "${businessNameTrimmed}" integrated into the design.`;
          } else {
            prompt += ` This is an icon-only logo, no text.`;
          }
          prompt += ` Style: ${concept.styleNotes}. Colors: ${concept.colorPalette.join(", ")}. Clean, professional, high-quality logo design suitable for business use. Original design only, no references to existing brands or copyrighted material.`;
          
          images.push({
            id: images.length + 1,
            conceptId: concept.id,
            imageUrl: null,
            prompt,
            imageError: "Image generation was attempted but no entry was created",
          });
        }
      }
    } else {
      // Generate prompts only (no image generation) for cost control
      images = selectedConcepts.map((concept, idx) => {
        let prompt = `A professional logo design: ${concept.description}`;
        
        if (body.includeText ?? true) {
          prompt += ` The logo includes the business name "${businessNameTrimmed}" integrated into the design.`;
        } else {
          prompt += ` This is an icon-only logo, no text.`;
        }
        
        prompt += ` Style: ${concept.styleNotes}. Colors: ${concept.colorPalette.join(", ")}. Clean, professional, high-quality logo design suitable for business use. Original design only, no references to existing brands or copyrighted material.`;

        return {
          id: idx + 1,
          conceptId: concept.id,
          imageUrl: null,
          prompt,
        };
      });
    }

    // Get current usage for response (after increment)
    const currentUsage = await checkUsage(userId);

    const response: LogoGeneratorResponse & {
      countUsed: number;
      usage?: {
        conceptsUsed: number;
        imagesUsed: number;
        conceptsLimit: number;
        imagesLimit: number;
        resetsAt: string;
      };
    } = {
      concepts: selectedConcepts,
      images,
      meta: {
        businessName: businessNameTrimmed,
        city: cityTrimmed,
        state: stateTrimmed,
        logoStyle: logoStyle,
        personalityStyle: personalityStyle || "None",
      },
      countUsed,
      usage: {
        conceptsUsed: currentUsage.conceptsUsed,
        imagesUsed: currentUsage.imagesUsed,
        conceptsLimit: currentUsage.conceptsLimit,
        imagesLimit: currentUsage.imagesLimit,
        resetsAt: currentUsage.resetsAt,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error generating logos:", error);
    // Note: Usage was already incremented before OpenAI calls, so we don't rollback
    // This is intentional to prevent quota abuse via intentional failures
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating logos. Please try again later.",
      },
      { status: 500 }
    );
  }
}

