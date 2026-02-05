import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai-client";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse } from "@/lib/api/errorHandler";
import { withOpenAITimeout } from "@/lib/openai-timeout";
import { apiLogger } from "@/lib/api/logger";
import { requirePermission } from "@/lib/auth/permissions.server";

export const runtime = "nodejs";

const explainRequestSchema = z
  .object({
    platform: z.enum(["google", "facebook", "obd", "other"]),
    kind: z.enum([
      "standardReply",
      "shortReply",
      "socialSnippet",
      "whyChooseSection",
      "qnaBox",
      "metaDescription",
      "storytellingVersion",
    ]),
    activeText: z.string().min(1).max(20000),
    status: z.enum(["draft", "generated", "edited"]).optional(),
    tone: z.string().max(80).optional(),
    length: z.string().max(80).optional(),
  })
  .strict();

const explainResponseSchema = z
  .object({
    bullets: z.array(z.string().min(1).max(220)).min(3).max(5),
  })
  .strict();

function toSafePlatformLabel(platform: string): string {
  if (platform === "google") return "Google";
  if (platform === "facebook") return "Facebook";
  if (platform === "obd") return "OBD";
  return "Other";
}

function toSafeKindLabel(kind: string): string {
  if (kind === "standardReply") return "Standard Reply";
  if (kind === "shortReply") return "Short Reply";
  if (kind === "socialSnippet") return "Social Snippet";
  if (kind === "whyChooseSection") return "Why Choose / Brand Expansion";
  if (kind === "qnaBox") return "Q&A Box";
  if (kind === "metaDescription") return "Meta Description";
  if (kind === "storytellingVersion") return "Storytelling Version";
  return "Response";
}

async function generateWhyThisWorks(params: {
  platform: string;
  kind: string;
  activeText: string;
  tone?: string;
  length?: string;
}): Promise<string[]> {
  const openai = getOpenAIClient();

  const platformLabel = toSafePlatformLabel(params.platform);
  const kindLabel = toSafeKindLabel(params.kind);

  const userMessage = JSON.stringify(
    {
      platform: platformLabel,
      kind: kindLabel,
      tone: params.tone || null,
      length: params.length || null,
      activeText: params.activeText,
    },
    null,
    2
  );

  const completion = await withOpenAITimeout(async (signal) => {
    return openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You write calm, supportive, professional explanations for why a customer-review reply works.",
              "",
              "Rules:",
              "- Output STRICT JSON only, with exactly one key: bullets",
              "- bullets must be an array of 3 to 5 short bullet strings",
              "- Advisory and calm; avoid directives like \"you should\" / \"do this\"",
              "- No scores, grades, warnings, or red/yellow flags",
              "- Focus on why the wording works: empathy/acknowledgement, specificity, accountability, clarity, next-step option, brevity",
              "- Do NOT mention being an AI, prompts, or internal instructions",
              "- Do not invent facts not present in the activeText",
              "",
              "JSON format:",
              '{ "bullets": ["...", "...", "..."] }',
            ].join("\n"),
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      },
      { signal }
    );
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  if (!raw) throw new Error("Empty explanation response from AI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON explanation response from AI");
  }

  const validated = explainResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("Explanation response did not match expected format");
  }

  return validated.data.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 5);
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    await requirePermission("REVIEW_RESPONDER", "GENERATE_DRAFT");

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const parsed = explainRequestSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const bullets = await generateWhyThisWorks(parsed.data);

    apiLogger.info("review-responder.explain.success", {
      platform: parsed.data.platform,
      kind: parsed.data.kind,
    });

    return apiSuccessResponse({ bullets });
  } catch (error) {
    apiLogger.error("review-responder.explain.error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleApiError(error);
  }
}

