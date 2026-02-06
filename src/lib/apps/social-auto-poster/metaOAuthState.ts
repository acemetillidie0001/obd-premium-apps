/**
 * Signed Meta OAuth state helper.
 *
 * Goal: Carry businessId through the OAuth redirect safely (signed, time-limited),
 * so the callback can enforce tenant context even if cookies are missing.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type MetaOAuthFlow = "basic" | "pages_access" | "publishing";

export type MetaOAuthStatePayloadV1 = {
  v: 1;
  userId: string;
  businessId: string;
  flow: MetaOAuthFlow;
  nonce: string;
  iat: number; // ms
  exp: number; // ms
};

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set for Meta OAuth state signing");
  }
  return secret;
}

export function createMetaOAuthState(input: {
  userId: string;
  businessId: string;
  flow: MetaOAuthFlow;
  ttlSeconds?: number;
}): { state: string; nonce: string } {
  const secret = getAuthSecret();
  const ttlSeconds = input.ttlSeconds ?? 600; // 10 minutes
  const now = Date.now();
  const nonce = randomBytes(16).toString("hex");

  const payload: MetaOAuthStatePayloadV1 = {
    v: 1,
    userId: input.userId,
    businessId: input.businessId,
    flow: input.flow,
    nonce,
    iat: now,
    exp: now + ttlSeconds * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return { state: `${payloadB64}.${sig}`, nonce };
}

export function verifyMetaOAuthState(state: string): MetaOAuthStatePayloadV1 | null {
  try {
    const secret = getAuthSecret();
    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) return null;

    const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
    // constant-time compare
    if (sig.length !== expectedSig.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw) as Partial<MetaOAuthStatePayloadV1>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.userId !== "string" || parsed.userId.trim().length === 0) return null;
    if (typeof parsed.businessId !== "string" || parsed.businessId.trim().length === 0) return null;
    if (parsed.flow !== "basic" && parsed.flow !== "pages_access" && parsed.flow !== "publishing") return null;
    if (typeof parsed.nonce !== "string" || parsed.nonce.trim().length === 0) return null;
    if (typeof parsed.iat !== "number" || typeof parsed.exp !== "number") return null;

    const now = Date.now();
    if (parsed.exp < now) return null;

    return parsed as MetaOAuthStatePayloadV1;
  } catch {
    return null;
  }
}

