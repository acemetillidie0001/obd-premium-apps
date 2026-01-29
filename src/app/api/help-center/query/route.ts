import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiLogger } from "@/lib/api/logger";
import { chatWorkspaceHelpCenter } from "@/lib/integrations/anythingllm/client";

export const runtime = "nodejs";

const SAFE_UPSTREAM_ERROR =
  "Help Center is temporarily unavailable. Please try again.";

const requestSchema = z
  .object({
    query: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, "Query is required")
      .refine((s) => s.length <= 500, "Query is too long"),
  })
  // Hard rule: do not accept any other fields (no businessId, no workspaceSlug)
  .strict();

type RateLimitEntry = { count: number; windowStart: number };
const rateLimits = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "global";
}

function getRateLimitPerMinute(): number {
  const raw = process.env.HELP_CENTER_RATE_LIMIT_PER_MINUTE;
  if (!raw) return 30;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }

  const limit = getRateLimitPerMinute();
  if (entry.count >= limit) {
    const remainingMs = WINDOW_MS - (now - entry.windowStart);
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return { ok: false, retryAfterSeconds };
  }

  entry.count++;
  return { ok: true };
}

function getWorkspaceSlug(): string {
  const envSlug = process.env.HELP_CENTER_WORKSPACE_SLUG?.trim();
  return envSlug && envSlug.length > 0 ? envSlug : "obd-help-center";
}

export async function POST(req: NextRequest) {
  // Rate limit (public-safe; no auth)
  const ip = getClientIP(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { answer: "Rate limit exceeded. Please wait and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { answer: "Please enter a question and try again." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { answer: "Please enter a question and try again." },
      { status: 400 }
    );
  }

  const workspaceSlug = getWorkspaceSlug();
  const query = parsed.data.query;
  const queryLength = query.length;

  try {
    const result = await chatWorkspaceHelpCenter(workspaceSlug, query);

    // Temporary, env-gated debug logging to inspect upstream shape safely.
    // Never log query text, API keys, IP, or identity.
    if (process.env.HELP_CENTER_DEBUG === "1") {
      const r: any = result;
      const isArray = Array.isArray(r);

      const topLevelKeys =
        r && typeof r === "object" ? Object.keys(r as Record<string, unknown>) : [];

      const firstItemKeys =
        isArray && r?.[0] && typeof r[0] === "object"
          ? Object.keys(r[0] as Record<string, unknown>)
          : undefined;

      const upstreamStatus =
        typeof r?.upstreamStatus === "number"
          ? r.upstreamStatus
          : typeof r?.status === "number"
            ? r.status
            : typeof r?.statusCode === "number"
              ? r.statusCode
              : undefined;

      const contentType =
        typeof r?.contentType === "string"
          ? r.contentType
          : typeof r?.headers?.get === "function"
            ? String(r.headers.get("content-type") ?? "")
            : typeof r?.headers?.["content-type"] === "string"
              ? r.headers["content-type"]
              : typeof r?.headers?.["Content-Type"] === "string"
                ? r.headers["Content-Type"]
                : undefined;

      const preview = (value: unknown): string | undefined => {
        if (typeof value !== "string") return undefined;
        const compact = value.replace(/\s+/g, " ").trim();
        if (!compact) return undefined;
        return compact.length > 200 ? compact.slice(0, 200) : compact;
      };

      const previews: Record<string, string> = {};
      const addPreview = (label: string, value: unknown) => {
        const p = preview(value);
        if (p) previews[label] = p;
      };

      addPreview("result.text", r?.text);
      addPreview("result.answer", r?.answer);
      addPreview("result.response", r?.response);
      addPreview("result.message", r?.message);
      addPreview("result.data.text", r?.data?.text);
      addPreview("result.data.answer", r?.data?.answer);
      addPreview("result.data.response", r?.data?.response);

      apiLogger.info("help-center.query.ok shape=upstream", {
        workspace: workspaceSlug,
        queryLength,
        upstreamStatus,
        contentType: contentType || undefined,
        typeofResult: typeof r,
        topLevelKeys,
        isArray,
        arrayLength: isArray ? r.length : undefined,
        firstItemKeys,
        previews: Object.keys(previews).length > 0 ? previews : undefined,
      });
    }

    // Log only non-sensitive metadata (never log query text, IP, or identity)
    apiLogger.info("help-center.query.ok", {
      workspace: workspaceSlug,
      queryLength,
    });

    return NextResponse.json({
      answer: result.answer,
      ...(result.sources ? { sources: result.sources } : {}),
      meta: { workspace: workspaceSlug },
    });
  } catch (error) {
    // Never leak upstream details to the public client
    const err = error as { code?: unknown; status?: unknown };
    const code = typeof err?.code === "string" ? err.code : undefined;
    const status = typeof err?.status === "number" ? err.status : undefined;

    apiLogger.error("help-center.query.failed", {
      code,
      status,
      workspace: workspaceSlug,
      queryLength,
    });

    return NextResponse.json(
      { answer: SAFE_UPSTREAM_ERROR, meta: { workspace: workspaceSlug } },
      { status: 503 }
    );
  }
}

