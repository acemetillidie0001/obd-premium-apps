import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  GeneratePostsRequest,
  GeneratePostsResponse,
  SocialPostPreview,
  SocialPlatform,
  ContentTheme,
} from "@/lib/apps/social-auto-poster/types";
import {
  computeContentHash,
  computeContentFingerprint,
  similarityCheckRecent,
  determineContentTheme,
  generatePostReason,
  pickNextPillar,
  getHashtagSetForBusiness,
} from "@/lib/apps/social-auto-poster/utils";

const PLATFORM_MAX_CHARS: Record<SocialPlatform, number> = {
  facebook: 5000,
  instagram: 2200,
  x: 280,
  googleBusiness: 1500,
};

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

async function generatePosts(
  request: GeneratePostsRequest,
  userId: string
): Promise<GeneratePostsResponse> {
  if (!request.platforms || request.platforms.length === 0) {
    throw new Error("At least one platform must be specified");
  }

  // Load user settings to check platform enables and overrides
  const settings = await prisma.socialAutoposterSettings.findUnique({
    where: { userId },
  });

  // Filter out disabled platforms
  const platformsEnabled = (settings?.platformsEnabled as Record<string, boolean> | null) || {};
  const platformOverrides = (settings?.platformOverrides as Record<string, {
    emojiModeOverride?: string;
    hashtagLimitOverride?: number;
    ctaStyleOverride?: string;
  }> | null) || {};
  const enabledPlatforms = request.platforms.filter((platform) => {
    const isEnabled = platformsEnabled[platform] !== false; // Default to enabled if not set
    return isEnabled;
  });

  if (enabledPlatforms.length === 0) {
    throw new Error("All selected platforms are disabled. Please enable at least one platform in Settings.");
  }

  const openai = getOpenAIClient();

  // Determine pillar (use override if provided, otherwise pick from settings)
  const pillarSettings = (settings?.contentPillarSettings as {
    contentPillarMode?: "single" | "rotate";
    defaultPillar?: string;
    rotatePillars?: string[];
  } | null) || { contentPillarMode: "single" };

  let selectedPillar: string;
  if (request.pillarOverride) {
    selectedPillar = request.pillarOverride;
  } else if (pillarSettings.contentPillarMode === "rotate") {
    selectedPillar = await pickNextPillar(userId, {
      contentPillarMode: "rotate",
      rotatePillars: pillarSettings.rotatePillars as ("education" | "promotion" | "social_proof" | "community" | "seasonal")[] | undefined,
    });
  } else {
    selectedPillar = pillarSettings.defaultPillar || "education";
  }

  // Determine theme (use pillar as theme)
  const theme = selectedPillar as ContentTheme;
  const reason = generatePostReason(
    request.businessName,
    request.businessType,
    request.topic,
    request.campaignType,
    theme
  );

  // Get hashtag sets for each platform if enabled
  const hashtagSettings = (settings?.hashtagBankSettings as {
    includeLocalHashtags?: boolean;
    hashtagBankMode?: "auto" | "manual";
  } | null) || { includeLocalHashtags: false };

  const platformHashtags: Record<SocialPlatform, string[]> = {
    facebook: [],
    instagram: [],
    x: [],
    googleBusiness: [],
  };

  if (hashtagSettings.includeLocalHashtags) {
    for (const platform of enabledPlatforms) {
      const hashtagSet = await getHashtagSetForBusiness(userId, request.businessType, platform);
      
      // Apply platform-specific limits
      const overrides = platformOverrides[platform];
      const limit = overrides?.hashtagLimitOverride as number | undefined;
      const defaultLimits: Record<SocialPlatform, number> = {
        facebook: 4,
        instagram: 6,
        x: 3,
        googleBusiness: 4,
      };
      const maxHashtags = limit ?? defaultLimits[platform];
      
      platformHashtags[platform] = hashtagSet.slice(0, maxHashtags);
    }
  }

  // Build platform-specific override instructions (platformOverrides already declared above)
  const overrideInstructions: string[] = [];
  for (const platform of enabledPlatforms) {
    const overrides = platformOverrides[platform];
    if (overrides) {
      const parts: string[] = [];
      if (overrides.emojiModeOverride) {
        parts.push(`Emoji mode: ${overrides.emojiModeOverride}`);
      }
      if (overrides.hashtagLimitOverride) {
        parts.push(`Hashtag limit: ${overrides.hashtagLimitOverride}`);
      }
      if (overrides.ctaStyleOverride) {
        parts.push(`CTA style: ${overrides.ctaStyleOverride}`);
      }
      if (parts.length > 0) {
        overrideInstructions.push(`${platform}: ${parts.join(", ")}`);
      }
    }
  }

  // Build hashtag instructions
  const hashtagInstructions: string[] = [];
  if (hashtagSettings.includeLocalHashtags) {
    for (const platform of enabledPlatforms) {
      const hashtags = platformHashtags[platform];
      if (hashtags.length > 0) {
        hashtagInstructions.push(`${platform}: Include these hashtags: ${hashtags.join(", ")}`);
      }
    }
  }

  const systemPrompt = `You are the **OBD Social Auto-Poster V3**, a specialized assistant for the Ocala Business Directory (OBD). Your job is to generate platform-optimized social media posts for local Ocala businesses.

You ALWAYS follow:
- The JSON input format
- Platform-specific character limits and best practices
- The brand voice and tone guidelines
- The JSON output format exactly (no extra keys, no trailing commas, valid JSON)
- Include a "reason" field explaining WHY this post was created
- Include a "theme" field: one of "education", "promotion", "social_proof", "community", "seasonal", "general"
- Content Pillar: This post should focus on the "${selectedPillar}" pillar. Align the content, tone, and messaging to match this pillar's goals.
${hashtagInstructions.length > 0 ? `\n- Hashtags: ${hashtagInstructions.join("\n")}\n` : ""}

====================================
1) INPUT FORMAT (JSON YOU RECEIVE)
====================================

{
  "businessName": string (optional),
  "businessType": string (optional),
  "topic": string (required),
  "details": string (optional),
  "brandVoice": string (optional),
  "platforms": ["facebook" | "instagram" | "x" | "googleBusiness"],
  "postLength": "Short" | "Medium" | "Long",
  "campaignType": "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement"
}

====================================
2) PLATFORM-SPECIFIC RULES
====================================

Facebook:
- Character limit: 5000
- Style: Friendly, conversational, can be longer
- Use line breaks for readability
- Emojis are acceptable but not overdone

Instagram:
- Character limit: 2200
- Style: Visual, engaging, use line breaks
- Emojis are common and natural
- Hashtags can be included (but not in the main content field)

X (Twitter):
- Character limit: 280
- Style: Concise, punchy, direct
- Use line breaks sparingly
- Emojis are fine but keep it minimal

Google Business:
- Character limit: 1500
- Style: Professional, informative, clear
- Minimal emojis
- Focus on local value and services

${overrideInstructions.length > 0 ? `\n====================================
PLATFORM OVERRIDES
====================================\n${overrideInstructions.join("\n")}\n` : ""}

====================================
3) POST LENGTH GUIDELINES
====================================

Short:
- Facebook: 100-200 characters
- Instagram: 100-200 characters
- X: 100-200 characters (but must stay under 280)
- Google Business: 100-200 characters

Medium:
- Facebook: 200-500 characters
- Instagram: 200-500 characters
- X: 200-250 characters (must stay under 280)
- Google Business: 200-500 characters

Long:
- Facebook: 500-1000 characters
- Instagram: 500-1000 characters
- X: Not applicable (use Medium for X)
- Google Business: 500-1000 characters

====================================
4) BRAND VOICE & TONE
====================================

- If brandVoice is provided, use it as the primary guide
- Keep tone appropriate for the campaign type:
  - Everyday Post: Friendly, casual, community-focused
  - Event: Exciting, time-sensitive, clear details
  - Limited-Time Offer: Urgent but not pushy, value-focused
  - New Service Announcement: Informative, proud, clear benefits

====================================
5) LOCAL FOCUS (OCALA)
====================================

- When relevant, naturally mention Ocala or local community
- Use phrases like "here in Ocala", "our Ocala community", "local Ocala businesses"
- Don't overdo it - 1-2 mentions max per post
- Never mention competing directories

====================================
6) OUTPUT FORMAT (STRICT JSON)
====================================

You MUST respond with a single JSON object:

{
  "drafts": [
    {
      "platform": "facebook" | "instagram" | "x" | "googleBusiness",
      "content": string,
      "characterCount": number,
      "reason": string (required - explain why this post was created),
      "theme": "education" | "promotion" | "social_proof" | "community" | "seasonal" | "general" (required),
      "metadata": {
        "hashtags": string[] (optional),
        "mentions": string[] (optional),
        "imageUrl": string (optional),
        "linkUrl": string (optional)
      }
    }
  ],
  "previews": [
    {
      "platform": "facebook" | "instagram" | "x" | "googleBusiness",
      "content": string,
      "characterCount": number,
      "maxCharacters": number,
      "isValid": boolean,
      "preview": string (formatted preview with line breaks),
      "reason": string (required - same as draft reason),
      "theme": "education" | "promotion" | "social_proof" | "community" | "seasonal" | "general" (required),
      "metadata": {
        "hashtags": string[] (optional),
        "mentions": string[] (optional),
        "imageUrl": string (optional),
        "linkUrl": string (optional)
      }
    }
  ]${request.generateVariants ? `,
  "variants": {
    "facebook": [
      {
        "platform": "facebook",
        "content": string,
        "characterCount": number,
        "reason": string,
        "theme": string,
        "metadata": {}
      }
    ],
    "instagram": [...],
    "x": [...],
    "googleBusiness": [...]
  }` : ""}
}

Rules:
- Generate one draft and one preview per platform
- characterCount must be accurate
- isValid is true if characterCount <= maxCharacters, false otherwise
- preview should be the same as content but formatted for display
- reason must explain WHY this post was created (e.g., "Based on your services: Pressure Washing", "Seasonal Ocala prompt", "Promoting your current offer")
- theme must be one of the specified values
${request.generateVariants ? "- Generate 2 additional variants per platform with different phrasing but same topic" : ""}
- The JSON must be valid. No comments, no trailing commas, no extra text before or after.
- Do NOT wrap JSON in markdown code fences.`;

  const userMessage = `Generate social media posts for:
${request.businessName ? `Business: ${request.businessName}` : ""}
${request.businessType ? `Type: ${request.businessType}` : ""}
Topic: ${request.topic}
${request.details ? `Details: ${request.details}` : ""}
${request.brandVoice ? `Brand Voice: ${request.brandVoice}` : ""}
Platforms: ${enabledPlatforms.join(", ")}
Post Length: ${request.postLength || "Medium"}
Campaign Type: ${request.campaignType || "Everyday Post"}
${request.generateVariants ? "Generate 2 additional variants per platform with different phrasing." : ""}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: request.generateVariants ? 0.8 : 0.7, // Higher temp for variants
  });

  const rawResponse = completion.choices[0]?.message?.content;
  if (!rawResponse) {
    throw new Error("No response from AI");
  }

  // Parse JSON response (may be wrapped in markdown code blocks)
  let jsonString = stripMarkdownFences(rawResponse);

  try {
    const parsed: GeneratePostsResponse & { variants?: Record<SocialPlatform, Array<{
      platform: SocialPlatform;
      content: string;
      characterCount: number;
      reason: string;
      theme: ContentTheme;
      metadata?: Record<string, unknown>;
    }>> } = JSON.parse(jsonString);

    // Check for similarity and enrich previews
    const enrichedPreviews: SocialPostPreview[] = await Promise.all(
      parsed.previews.map(async (preview) => {
        const maxChars = PLATFORM_MAX_CHARS[preview.platform];
        const contentHash = computeContentHash(preview.content, preview.platform, preview.theme || theme);
        const similarity = await similarityCheckRecent(userId, preview.platform, contentHash, 14);

        // If similar, try regeneration once
        let isSimilar = similarity.isSimilar;
        if (isSimilar && !preview.isSimilar) {
          // Request regeneration with "make distinctly different" instruction
          // For now, we'll just flag it - in a full implementation, we'd regenerate
          isSimilar = true;
        }

        // Add hashtags to metadata if available
        const hashtagsForPlatform = platformHashtags[preview.platform] || [];
        const metadata = preview.metadata || {};
        if (hashtagsForPlatform.length > 0) {
          metadata.hashtags = hashtagsForPlatform;
        }

        return {
          ...preview,
          maxCharacters: maxChars,
          isValid: preview.characterCount <= maxChars,
          preview: preview.content, // Use content as preview
          reason: preview.reason || reason,
          theme: (preview.theme || theme) as ContentTheme,
          isSimilar,
          metadata,
        };
      })
    );

    // Process variants if present
    const processedVariants: Record<SocialPlatform, Array<{
      platform: SocialPlatform;
      content: string;
      characterCount: number;
      reason: string;
      theme: ContentTheme;
      isSimilar?: boolean;
      metadata?: Record<string, unknown>;
    }>> = {} as Record<SocialPlatform, Array<{
      platform: SocialPlatform;
      content: string;
      characterCount: number;
      reason: string;
      theme: ContentTheme;
      isSimilar?: boolean;
      metadata?: Record<string, unknown>;
    }>>;

    if (parsed.variants) {
      for (const [platform, variants] of Object.entries(parsed.variants)) {
        processedVariants[platform as SocialPlatform] = await Promise.all(
          variants.map(async (variant) => {
            const contentHash = computeContentHash(variant.content, variant.platform, variant.theme);
            const similarity = await similarityCheckRecent(userId, variant.platform, contentHash, 14);
            return {
              ...variant,
              theme: variant.theme as ContentTheme,
              isSimilar: similarity.isSimilar,
            };
          })
        );
      }
    }

    // Add hashtags to drafts as well
    const enrichedDrafts = parsed.drafts.map((draft) => {
      const hashtagsForPlatform = platformHashtags[draft.platform] || [];
      const metadata = draft.metadata || {};
      if (hashtagsForPlatform.length > 0) {
        metadata.hashtags = hashtagsForPlatform;
      }
      return {
        ...draft,
        reason: draft.reason || reason,
        theme: (draft.theme || theme) as ContentTheme,
        metadata,
      };
    });

    return {
      drafts: enrichedDrafts,
      previews: enrichedPreviews,
      variants: Object.keys(processedVariants).length > 0 ? processedVariants : undefined,
    };
  } catch (parseError) {
    console.error("Failed to parse AI response as JSON:", parseError);
    console.error("Raw response:", rawResponse);
    throw new Error("Invalid JSON response from AI");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body: GeneratePostsRequest = await request.json();

    // Validation
    if (!body.topic || typeof body.topic !== "string" || body.topic.trim().length === 0) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    if (!body.platforms || !Array.isArray(body.platforms) || body.platforms.length === 0) {
      return NextResponse.json(
        { error: "platforms must be a non-empty array" },
        { status: 400 }
      );
    }

    const validPlatforms: SocialPlatform[] = ["facebook", "instagram", "x", "googleBusiness"];
    for (const platform of body.platforms) {
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json(
          { error: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const response = await generatePosts(body, userId);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating social posts:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong while generating posts. Please try again later.",
      },
      { status: 500 }
    );
  }
}
