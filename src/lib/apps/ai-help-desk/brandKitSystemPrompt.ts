import type { BrandKitBuilderResponse } from "@/app/apps/brand-kit-builder/types";
import type { BrandProfile } from "@/lib/brand/brand-profile-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function extractBrandKitSnapshot(
  profile: BrandProfile | null
): BrandKitBuilderResponse | null {
  const kit = profile?.kitJson;
  if (!isRecord(kit)) return null;

  const brandSummary = kit.brandSummary;
  const brandVoice = kit.brandVoice;

  if (!isRecord(brandSummary) || !isRecord(brandVoice)) return null;
  if (typeof brandSummary.businessName !== "string" || !brandSummary.businessName.trim()) {
    return null;
  }
  if (typeof brandSummary.positioning !== "string" || !brandSummary.positioning.trim()) {
    return null;
  }
  if (typeof brandVoice.description !== "string" || !brandVoice.description.trim()) {
    return null;
  }

  // This is a best-effort runtime check; treat the stored JSON as the source of truth.
  return kit as unknown as BrandKitBuilderResponse;
}

export function buildHelpDeskSystemPromptFromBrandKit(args: {
  brandKit: BrandKitBuilderResponse;
  brandProfile?: BrandProfile | null;
  locationHint?: { city?: string | null; state?: string | null; postalCode?: string | null };
}): string {
  const { brandKit, brandProfile, locationHint } = args;

  const businessName =
    brandKit.brandSummary.businessName?.trim() ||
    brandProfile?.businessName?.trim() ||
    "this business";

  const city =
    locationHint?.city?.trim() ||
    brandProfile?.city?.trim() ||
    "Ocala";

  const state =
    locationHint?.state?.trim() ||
    brandProfile?.state?.trim() ||
    "Florida";

  const postalCode = locationHint?.postalCode?.trim() || "";

  const location = [city, state, postalCode].filter(Boolean).join(", ");

  const tagline =
    (brandKit.brandSummary.tagline || "").trim() ||
    (brandKit.messaging.taglines?.[0] || "").trim();

  const positioning = (brandKit.brandSummary.positioning || "").trim();

  const voiceDescription = (brandKit.brandVoice.description || "").trim();
  const doPhrases = Array.isArray(brandKit.brandVoice.do) ? brandKit.brandVoice.do : [];
  const dontPhrases = Array.isArray(brandKit.brandVoice.dont) ? brandKit.brandVoice.dont : [];

  const audience =
    (brandProfile?.targetAudience || "").trim();

  const categories = [
    (brandProfile?.businessType || "").trim(),
    (brandProfile?.industryKeywords || "").trim(),
  ]
    .filter(Boolean)
    .join(" / ");

  const lines: string[] = [];

  lines.push(`You are the AI Help Desk assistant for ${businessName}${location ? ` in ${location}` : ""}.`);
  if (tagline) lines.push(`Tagline: ${tagline}`);
  if (positioning) lines.push(`Positioning: ${positioning}`);
  if (categories) lines.push(`Service categories: ${categories}`);
  if (audience) lines.push(`Audience: ${audience}`);
  lines.push("");

  lines.push("Core behavior:");
  lines.push("- Be concise and helpful.");
  lines.push("- Prefer answers grounded in the business’s knowledge base and provided context.");
  lines.push("- If you don’t know, say so and suggest a next step (contact us, request a quote, booking link, or visit during business hours).");
  lines.push("- Do not claim to browse the web or verify information online.");
  lines.push("- When relevant, ask 1 clarifying question rather than guessing.");
  lines.push("");

  lines.push("Brand voice:");
  lines.push(`- ${voiceDescription}`);
  lines.push("- Tone should feel friendly, professional, and local.");
  if (doPhrases.length > 0) {
    lines.push("");
    lines.push("Do:");
    for (const phrase of doPhrases.slice(0, 8)) {
      if (typeof phrase === "string" && phrase.trim()) lines.push(`- ${phrase.trim()}`);
    }
  }
  if (dontPhrases.length > 0) {
    lines.push("");
    lines.push("Don’t:");
    for (const phrase of dontPhrases.slice(0, 8)) {
      if (typeof phrase === "string" && phrase.trim()) lines.push(`- ${phrase.trim()}`);
    }
  }

  return lines.join("\n").trim() + "\n";
}

