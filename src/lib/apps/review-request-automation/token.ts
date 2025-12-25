/**
 * Token Signing and Verification for Review Request Automation
 * 
 * Creates signed tokens for click/reviewed tracking that don't require
 * user authentication. Uses HMAC-SHA256 with AUTH_SECRET/NEXTAUTH_SECRET.
 */

import { createHmac } from "crypto";

const getAuthSecret = (): string => {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set");
  }
  return secret;
};

/**
 * Create a signed token for a queue item ID.
 * Format: base64url(queueItemId + "." + hmac)
 */
export function createQueueItemToken(queueItemId: string): string {
  const secret = getAuthSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(queueItemId);
  const signature = hmac.digest("base64url");
  
  // Combine queueItemId and signature with a dot separator
  const payload = `${queueItemId}.${signature}`;
  
  // Base64url encode the entire payload
  return Buffer.from(payload).toString("base64url");
}

/**
 * Verify and extract queue item ID from a signed token.
 * 
 * @param token Signed token
 * @returns Queue item ID if valid, null if invalid
 */
export function verifyQueueItemToken(token: string): string | null {
  try {
    const secret = getAuthSecret();
    
    // Decode base64url
    const payload = Buffer.from(token, "base64url").toString("utf-8");
    
    // Split on the dot
    const [queueItemId, signature] = payload.split(".");
    if (!queueItemId || !signature) {
      return null;
    }
    
    // Verify signature
    const hmac = createHmac("sha256", secret);
    hmac.update(queueItemId);
    const expectedSignature = hmac.digest("base64url");
    
    // Constant-time comparison
    if (signature.length !== expectedSignature.length) {
      return null;
    }
    
    let match = 0;
    for (let i = 0; i < signature.length; i++) {
      match |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    if (match !== 0) {
      return null;
    }
    
    return queueItemId;
  } catch {
    return null;
  }
}

