export type SMPCPlatformKey =
  | "facebook"
  | "instagram"
  | "instagram_carousel"
  | "x"
  | "google_business_profile"
  | "linkedin"
  | "tiktok"
  | "youtube_shorts"
  | "pinterest"
  | "other";

const CANONICAL_LABELS: Record<Exclude<SMPCPlatformKey, "other">, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  instagram_carousel: "Instagram (Carousel)",
  x: "X",
  google_business_profile: "Google Business Profile",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  pinterest: "Pinterest",
};

const VARIANTS: Record<string, SMPCPlatformKey> = {
  // Facebook
  facebook: "facebook",
  fb: "facebook",

  // Instagram
  instagram: "instagram",
  ig: "instagram",

  // Instagram carousel
  "instagram (carousel)": "instagram_carousel",
  "instagram carousel": "instagram_carousel",

  // X / Twitter
  x: "x",
  twitter: "x",

  // Google Business Profile
  gbp: "google_business_profile",
  "google business": "google_business_profile",
  "google business profile": "google_business_profile",
  "google business listing": "google_business_profile",

  // Other common platforms (future-proof)
  linkedin: "linkedin",
  tiktok: "tiktok",
  "youtube shorts": "youtube_shorts",
  youtubeshorts: "youtube_shorts",
  pinterest: "pinterest",
};

export function normalizePlatform(
  input: string
): { key: SMPCPlatformKey; label: string } {
  const original = (input ?? "").trim();
  if (!original) return { key: "other", label: "" };

  const cleaned = original.toLowerCase().replace(/\s+/g, " ").trim();
  const key = VARIANTS[cleaned] ?? ("other" as const);

  if (key !== "other") {
    return { key, label: CANONICAL_LABELS[key] };
  }

  return { key: "other", label: original };
}

