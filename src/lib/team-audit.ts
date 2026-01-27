import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type TeamAuditAction =
  | "INVITE_CREATED"
  | "INVITE_CANCELED"
  | "MEMBER_ROLE_UPDATED"
  | "MEMBER_STATUS_UPDATED"
  | "MEMBER_REMOVED"
  // Existing/optional actions (kept for compatibility)
  | "INVITE_ACCEPTED"
  | "INVITE_RESENT";

type WriteTeamAuditArgs = {
  businessId: string;
  actorUserId: string;
  action: TeamAuditAction | (string & {});
  targetUserId?: string;
  targetEmail?: string;
  meta?: Record<string, unknown>;
};

function truncateString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}

function isSensitiveMetaKey(key: string): boolean {
  // Never log invite tokens (or their hashes) or links that might contain tokens.
  const k = key.trim().toLowerCase();
  if (!k) return false;
  if (k.includes("token")) return true; // token, tokenHash, inviteToken, etc.
  if (k.includes("invitelink")) return true;
  if (k.includes("invite_link")) return true;
  return false;
}

function scrubSensitiveStrings(value: string): string {
  // Defensive: redact query-string token parameters if they ever appear in meta.
  // Example: /accept?token=abc... → /accept?token=[REDACTED]
  return value.replace(/([?&]token=)[^&#\s]+/gi, "$1[REDACTED]");
}

function sanitizeJsonValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "string") return truncateString(scrubSensitiveStrings(value), 500);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();

  if (Array.isArray(value)) {
    if (depth <= 0) return ["[MaxDepth]"] as unknown as Prisma.InputJsonArray;
    const items = value.slice(0, 20).map((v) => sanitizeJsonValue(v, depth - 1, seen));
    // Prisma allows nulls inside JSON arrays; undefineds must be removed.
    return items.filter((v) => v !== undefined) as unknown as Prisma.InputJsonArray;
  }

  if (typeof value === "object") {
    if (depth <= 0) return { truncated: true, reason: "MaxDepth" } as unknown as Prisma.InputJsonObject;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    const obj = value as Record<string, unknown>;
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    let count = 0;
    for (const [k, v] of Object.entries(obj)) {
      if (count >= 25) break;
      if (isSensitiveMetaKey(k)) continue;
      const cleaned = sanitizeJsonValue(v, depth - 1, seen);
      if (cleaned === undefined) continue;
      out[truncateString(k, 80)] = cleaned as Prisma.InputJsonValue | null;
      count += 1;
    }
    return out as unknown as Prisma.InputJsonObject;
  }

  // functions / symbols, etc.
  return null;
}

function sanitizeMeta(meta: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined {
  if (!meta) return undefined;
  const cleaned = sanitizeJsonValue(meta, 6, new WeakSet<object>());
  if (!cleaned || typeof cleaned !== "object" || Array.isArray(cleaned)) return undefined;

  // Ensure meta stays small and JSON-safe.
  const json = JSON.stringify(cleaned);
  if (json.length > 10_000) {
    return { truncated: true };
  }
  return cleaned as Prisma.InputJsonObject;
}

/**
 * Write a single team audit entry (tenant-scoped by businessId).
 *
 * CRITICAL:
 * - Never pass secrets (invite token / raw invite codes).
 * - Keep meta JSON-safe and small.
 */
export async function writeTeamAudit(args: WriteTeamAuditArgs): Promise<void> {
  const businessId = args.businessId?.trim();
  const actorUserId = args.actorUserId?.trim();
  const action = args.action?.trim();
  const targetUserId = args.targetUserId?.trim() || undefined;
  const targetEmail = args.targetEmail?.trim().toLowerCase() || undefined;
  const metaJson = sanitizeMeta(args.meta);

  if (!businessId || !actorUserId || !action) return;

  await prisma.teamAuditLog.create({
    data: {
      businessId,
      actorUserId,
      action,
      ...(targetUserId ? { targetUserId } : {}),
      ...(targetEmail ? { targetEmail } : {}),
      ...(metaJson ? { metaJson } : {}),
    },
  });
}

