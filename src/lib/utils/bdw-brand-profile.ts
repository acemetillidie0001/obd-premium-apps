/**
 * Brand Profile utilities for Business Description Writer
 * Handles localStorage persistence of brand profile settings
 */

export interface BrandProfile {
  brandVoice: string;
  targetAudience: string;
  uniqueSellingPoints: string;
  services: string;
  city: string;
  state: string;
}

const STORAGE_PREFIX = "bdw-brand-profile-";

/**
 * Get storage key for a business name
 */
function getStorageKey(businessName: string): string {
  // Use a normalized key based on business name
  // Trim and lowercase for consistency
  const normalized = businessName.trim().toLowerCase();
  return `${STORAGE_PREFIX}${normalized}`;
}

/**
 * Save brand profile to localStorage
 */
export function saveBrandProfile(businessName: string, profile: BrandProfile): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const key = getStorageKey(businessName);
    const serialized = JSON.stringify(profile);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error("Failed to save brand profile:", error);
    return false;
  }
}

/**
 * Load brand profile from localStorage
 */
export function loadBrandProfile(businessName: string): BrandProfile | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    const key = getStorageKey(businessName);
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as BrandProfile;
    // Validate structure
    if (
      typeof parsed.brandVoice === "string" &&
      typeof parsed.targetAudience === "string" &&
      typeof parsed.uniqueSellingPoints === "string" &&
      typeof parsed.services === "string" &&
      typeof parsed.city === "string" &&
      typeof parsed.state === "string"
    ) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error("Failed to load brand profile:", error);
    return null;
  }
}

/**
 * Clear brand profile from localStorage
 */
export function clearBrandProfile(businessName: string): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const key = getStorageKey(businessName);
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Failed to clear brand profile:", error);
    return false;
  }
}

/**
 * Brand profile presets
 */
export const BRAND_PROFILE_PRESETS: Record<string, BrandProfile> = {
  "Professional Local Service": {
    brandVoice: "Professional, trustworthy, and detail-oriented. We communicate with clarity and respect for our customers' time and needs.",
    targetAudience: "Homeowners and businesses seeking reliable, professional service providers in the local area.",
    uniqueSellingPoints: "Licensed and insured professionals, local expertise, responsive customer service, quality workmanship, competitive pricing.",
    services: "Professional services tailored to local needs, comprehensive solutions, timely completion, warranty-backed work.",
    city: "Ocala",
    state: "Florida",
  },
  "Luxury / Premium": {
    brandVoice: "Sophisticated, elegant, and refined. We speak to discerning clients who value quality, attention to detail, and exceptional service.",
    targetAudience: "Affluent clients seeking premium quality, personalized service, and exclusive experiences.",
    uniqueSellingPoints: "Premium materials and craftsmanship, exclusive access, personalized service, attention to detail, superior quality standards.",
    services: "High-end services, custom solutions, premium products, white-glove service, exclusive offerings.",
    city: "Ocala",
    state: "Florida",
  },
  "Family-Owned Friendly": {
    brandVoice: "Warm, friendly, and approachable. We treat every customer like family and pride ourselves on personal relationships and community values.",
    targetAudience: "Local families and community members who value personal service, trust, and local business support.",
    uniqueSellingPoints: "Family-owned for generations, community roots, personalized service, trusted reputation, caring approach.",
    services: "Family-friendly services, community-focused offerings, personalized attention, affordable options, trusted relationships.",
    city: "Ocala",
    state: "Florida",
  },
  "No-Fluff Direct": {
    brandVoice: "Straightforward, honest, and no-nonsense. We communicate clearly and directly, focusing on results without unnecessary complexity.",
    targetAudience: "Practical customers who value efficiency, transparency, and getting things done without the fluff.",
    uniqueSellingPoints: "Direct communication, transparent pricing, efficient service, results-focused, no hidden fees.",
    services: "Clear service offerings, straightforward solutions, efficient delivery, honest pricing, practical results.",
    city: "Ocala",
    state: "Florida",
  },
};

