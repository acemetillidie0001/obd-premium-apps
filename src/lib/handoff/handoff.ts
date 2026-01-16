/**
 * Tier 5C+ Handoff Utilities (Suite-Level)
 *
 * Goals:
 * - Session-scoped (sessionStorage)
 * - TTL-guarded (expiresAt)
 * - Deterministic, no background jobs
 * - Safe defaults: expired handoffs are cleared silently
 */

export type HandoffValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_business_context"
        | "tenant_mismatch"
        | "expired"
        | "invalid_source"
        | "invalid_payload";
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function computeExpiresAt(createdAtIso: string, ttlMs: number): string {
  const createdAt = new Date(createdAtIso);
  return new Date(createdAt.getTime() + ttlMs).toISOString();
}

/**
 * Create a session-scoped handoff payload with TTL.
 *
 * Notes:
 * - We write `createdAt` and `expiresAt` onto object payloads.
 * - For non-object payloads, we wrap in `{ payload, createdAt, expiresAt }`.
 */
export function createHandoff<T>(
  key: string,
  payload: T,
  ttlMs: number
): (T & { createdAt: string; expiresAt: string }) | null {
  if (typeof window === "undefined") return null;
  if (!ttlMs || !Number.isFinite(ttlMs) || ttlMs <= 0) return null;

  const createdAt = nowIso();
  const expiresAt = computeExpiresAt(createdAt, ttlMs);

  try {
    if (isPlainObject(payload)) {
      const next = {
        ...(payload as Record<string, unknown>),
        createdAt,
        expiresAt,
      } as T & { createdAt: string; expiresAt: string };

      window.sessionStorage.setItem(key, JSON.stringify(next));
      return next;
    }

    const wrapped = { payload, createdAt, expiresAt };
    window.sessionStorage.setItem(key, JSON.stringify(wrapped));
    return null;
  } catch {
    return null;
  }
}

export function readHandoff<T = unknown>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    // TTL enforcement if expiresAt exists
    const expiresAt =
      isPlainObject(parsed) && typeof parsed.expiresAt === "string"
        ? parsed.expiresAt
        : "";
    if (expiresAt) {
      const exp = Date.parse(expiresAt);
      if (!Number.isFinite(exp) || exp <= Date.now()) {
        clearHandoff(key);
        return null;
      }
    }

    return parsed as T;
  } catch {
    return null;
  }
}

export function validateHandoff(
  payload: unknown,
  opts: { businessId: string | null; now: number; expectedSourceApp?: string }
): HandoffValidationResult {
  if (!isPlainObject(payload)) return { ok: false, reason: "invalid_payload" };

  const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt : "";
  if (!expiresAt) return { ok: false, reason: "invalid_payload" };

  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp) || exp <= opts.now) return { ok: false, reason: "expired" };

  const payloadBusinessId =
    typeof payload.businessId === "string" ? payload.businessId.trim() : "";
  if (!opts.businessId || opts.businessId.trim().length === 0) {
    return { ok: false, reason: "missing_business_context" };
  }
  if (!payloadBusinessId || payloadBusinessId !== opts.businessId.trim()) {
    return { ok: false, reason: "tenant_mismatch" };
  }

  if (opts.expectedSourceApp) {
    const sourceApp = typeof payload.sourceApp === "string" ? payload.sourceApp : "";
    if (!sourceApp || sourceApp !== opts.expectedSourceApp) {
      return { ok: false, reason: "invalid_source" };
    }
  }

  return { ok: true };
}

export function clearHandoff(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}


