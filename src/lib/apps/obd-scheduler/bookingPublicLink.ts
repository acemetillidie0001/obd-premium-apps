/**
 * OBD Scheduler & Booking - Public Link Utilities
 * 
 * Helper functions for generating and resolving short public booking links.
 * Supports:
 * - Short codes (base62, 8-10 chars): /book/{code}
 * - Pretty URLs (slug-code): /book/{slug}-{code}
 * - Legacy bookingKey (backward compatibility): /book/{bookingKey}
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Base62 alphabet for short codes
 */
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random base62 code
 * 
 * @param length - Length of the code (default: 8)
 * @returns A random base62 string
 */
export function generateBase62Code(length: number = 8): string {
  const bytes = randomBytes(length);
  let result = "";
  
  for (let i = 0; i < bytes.length; i++) {
    // Use modulo to map byte value to base62 character
    result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
  }
  
  return result;
}

/**
 * Generate a unique short code for a booking link
 * Retries on collision (max 10 attempts)
 * 
 * @param length - Length of the code (default: 8)
 * @returns A unique base62 code
 */
export async function generateUniqueShortCode(length: number = 8): Promise<string> {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateBase62Code(length);
    
    // Check if code already exists
    const existing = await prisma.bookingPublicLink.findUnique({
      where: { code },
      select: { id: true },
    });
    
    if (!existing) {
      return code;
    }
  }
  
  // If all attempts failed (very unlikely), try with longer code
  if (length < 10) {
    return generateUniqueShortCode(length + 1);
  }
  
  // Last resort: use longer code with timestamp suffix
  const baseCode = generateBase62Code(8);
  const timestamp = Date.now().toString(36).slice(-2);
  return baseCode + timestamp;
}

/**
 * Normalize a slug to URL-safe format
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric and hyphens)
 * - Limit length
 * 
 * @param slug - The slug to normalize
 * @param maxLength - Maximum length (default: 50)
 * @returns Normalized slug or null if invalid
 */
export function normalizeSlug(slug: string | null | undefined, maxLength: number = 50): string | null {
  if (!slug) return null;
  
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove special characters
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .slice(0, maxLength);
}

/**
 * Validate slug format
 * 
 * @param slug - The slug to validate
 * @returns true if valid, false otherwise
 */
export function validateSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  
  const normalized = normalizeSlug(slug);
  if (!normalized) return false;
  
  // Must be at least 2 characters, max 50
  if (normalized.length < 2 || normalized.length > 50) return false;
  
  // Must contain at least one letter or number
  if (!/^[a-z0-9-]+$/.test(normalized)) return false;
  
  return true;
}

/**
 * Resolution result for booking link lookup
 */
export interface BookingLinkResolution {
  businessId: string;
  source: "short_code" | "slug_code" | "legacy_key";
}

/**
 * Resolve a booking link parameter to businessId
 * 
 * Supports three formats:
 * 1. Short code: "abc12345" -> lookup by code
 * 2. Pretty URL: "my-business-abc12345" -> extract code and lookup
 * 3. Legacy bookingKey: "64-char-hex" -> lookup by bookingKey (backward compatibility)
 * 
 * @param param - The URL parameter (code, slug-code, or bookingKey)
 * @returns Resolution result or null if not found
 */
export async function resolveBookingLink(param: string): Promise<BookingLinkResolution | null> {
  if (!param || typeof param !== "string") {
    return null;
  }
  
  // Check if it's a legacy bookingKey (64-char hex)
  if (param.length === 64 && /^[0-9a-f]+$/i.test(param)) {
    const settings = await prisma.bookingSettings.findUnique({
      where: { bookingKey: param },
      select: { businessId: true },
    });
    
    if (settings) {
      return {
        businessId: settings.businessId,
        source: "legacy_key",
      };
    }
  }
  
  // Check if it matches slug-code format: {slug}-{code}
  // Code is typically 8-10 chars, so look for last hyphen before code
  const slugCodeMatch = param.match(/^(.+)-([a-zA-Z0-9]{8,10})$/);
  if (slugCodeMatch) {
    const code = slugCodeMatch[2];
    const publicLink = await prisma.bookingPublicLink.findUnique({
      where: { code },
      select: { businessId: true },
    });
    
    if (publicLink) {
      return {
        businessId: publicLink.businessId,
        source: "slug_code",
      };
    }
  }
  
  // Try as short code (8-10 chars base62)
  if (param.length >= 8 && param.length <= 10 && /^[a-zA-Z0-9]+$/.test(param)) {
    const publicLink = await prisma.bookingPublicLink.findUnique({
      where: { code: param },
      select: { businessId: true },
    });
    
    if (publicLink) {
      return {
        businessId: publicLink.businessId,
        source: "short_code",
      };
    }
  }
  
  return null;
}

/**
 * Ensure a BookingPublicLink exists for a business
 * Creates one if it doesn't exist
 * 
 * @param businessId - The business ID
 * @returns The BookingPublicLink record
 */
export async function ensureBookingPublicLink(businessId: string): Promise<{
  id: string;
  businessId: string;
  code: string;
  slug: string | null;
}> {
  // Check if link already exists
  let publicLink = await prisma.bookingPublicLink.findUnique({
    where: { businessId },
  });
  
  if (publicLink) {
    return publicLink;
  }
  
  // Generate unique code
  const code = await generateUniqueShortCode();
  
  // Create new link
  publicLink = await prisma.bookingPublicLink.create({
    data: {
      businessId,
      code,
    },
  });
  
  return publicLink;
}

/**
 * Generate a slug from business name
 * Falls back to null if name is not available
 * 
 * @param businessName - The business name
 * @returns Normalized slug or null
 */
export function generateSlugFromBusinessName(businessName: string | null | undefined): string | null {
  if (!businessName) return null;
  return normalizeSlug(businessName);
}

