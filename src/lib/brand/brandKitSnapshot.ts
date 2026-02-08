/**
 * Brand Kit Snapshot Extractor (apply-only)
 *
 * Purpose:
 * - Deterministically extract a small, safe subset of already-stored Brand Profile/Kit fields
 * - Suitable for "apply Brand Kit" integrations (no generation, no external calls)
 */

export type BrandKitActiveSnapshot = {
  businessName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  toneSnippet: string | null;
  emailSignature: string | null;
  updatedAtISO: string | null;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isHexColor(value: string | null): value is string {
  return !!value && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function firstLine(value: string | null): string | null {
  if (!value) return null;
  const line = value.split(/\r?\n/)[0]?.trim() || "";
  return line ? line : null;
}

function clip(value: string | null, maxChars: number): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length <= maxChars) return v;
  return v.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

type ColorInfoLike = { name?: unknown; hex?: unknown } | null;

function pickColorHex(colors: unknown, desiredName: "Primary" | "Accent" | "Secondary"): string | null {
  if (!Array.isArray(colors)) return null;
  for (const c of colors) {
    const ci = c as ColorInfoLike;
    const name = asTrimmedString(ci?.name);
    const hex = asTrimmedString(ci?.hex);
    if (name === desiredName && isHexColor(hex)) return hex;
  }
  return null;
}

function extractFromKitJson(kitJson: unknown): Omit<BrandKitActiveSnapshot, "updatedAtISO"> {
  const kit = (kitJson && typeof kitJson === "object") ? (kitJson as Record<string, any>) : null;

  const businessName =
    asTrimmedString(kit?.brandSummary?.businessName) ??
    asTrimmedString(kit?.businessName) ??
    null;

  // The standard Brand Kit Builder schema does not include a logo URL,
  // but some deployments may store it in custom fields; pick common safe keys.
  const logoUrl =
    asTrimmedString(kit?.logoUrl) ??
    asTrimmedString(kit?.brandSummary?.logoUrl) ??
    asTrimmedString(kit?.assets?.logoUrl) ??
    asTrimmedString(kit?.assets?.logo?.url) ??
    null;

  const paletteColors = kit?.colorPalette?.colors;
  const primaryColor = pickColorHex(paletteColors, "Primary");
  const accentColor = pickColorHex(paletteColors, "Accent") ?? pickColorHex(paletteColors, "Secondary");

  const toneSnippet =
    clip(asTrimmedString(kit?.brandVoice?.description) ?? asTrimmedString(kit?.brandVoice), 140) ?? null;

  const emailSignature =
    asTrimmedString(kit?.readyToUseCopy?.emailSignature) ??
    asTrimmedString(kit?.emailSignature) ??
    null;

  return {
    businessName,
    logoUrl,
    primaryColor,
    accentColor,
    toneSnippet,
    emailSignature,
  };
}

/**
 * Extract a safe, minimal "active brand kit" snapshot from a stored BrandProfile row.
 * Accepts the Prisma `brandProfile` record shape (dates may be Date objects).
 */
export function extractBrandKitActiveSnapshot(profile: any | null): BrandKitActiveSnapshot {
  if (!profile) {
    return {
      businessName: null,
      logoUrl: null,
      primaryColor: null,
      accentColor: null,
      toneSnippet: null,
      emailSignature: null,
      updatedAtISO: null,
    };
  }

  const kitBased = extractFromKitJson(profile.kitJson);

  const businessName =
    asTrimmedString(profile.businessName) ??
    kitBased.businessName ??
    null;

  // Colors may exist either as full kitJson or as saved `colorsJson` array (ColorInfo[])
  const primaryColor =
    pickColorHex(profile.colorsJson, "Primary") ??
    kitBased.primaryColor ??
    null;

  const accentColor =
    pickColorHex(profile.colorsJson, "Accent") ??
    pickColorHex(profile.colorsJson, "Secondary") ??
    kitBased.accentColor ??
    null;

  const logoUrl =
    asTrimmedString(profile.logoUrl) ?? // not currently in schema, but harmless if present in some deployments
    kitBased.logoUrl ??
    null;

  const toneSnippet =
    clip(
      asTrimmedString(profile.brandVoice) ??
        asTrimmedString(profile.toneNotes) ??
        kitBased.toneSnippet,
      140
    ) ?? null;

  // Prefer stored signature from kitJson; otherwise derive a simple deterministic one from businessName.
  const signatureFromKit = firstLine(kitBased.emailSignature);
  const emailSignature =
    signatureFromKit ??
    (businessName ? `Best regards, ${businessName}` : null);

  const updatedAtISO =
    profile.updatedAt instanceof Date
      ? profile.updatedAt.toISOString()
      : asTrimmedString(profile.updatedAt) ?? null;

  return {
    businessName,
    logoUrl,
    primaryColor,
    accentColor,
    toneSnippet,
    emailSignature,
    updatedAtISO,
  };
}

