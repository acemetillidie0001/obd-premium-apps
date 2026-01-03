/**
 * BDW CRM Note Pack Utility
 * 
 * Builds a formatted "CRM Note Pack" from BDW results that can be:
 * - Copied to clipboard for manual pasting into CRM
 * - Used as content for CRM note creation (if endpoint supports it)
 * 
 * This is safe and additive-only - no database writes.
 */

export interface BDWResult {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: {
    facebookBio: string;
    instagramBio: string;
    xBio: string;
    linkedinTagline: string;
  };
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: Array<{
    question: string;
    answer: string;
  }>;
  metaDescription: string | null;
}

export interface BDWNotePackInput {
  businessName: string;
  city?: string;
  state?: string;
  result: BDWResult;
}

/**
 * Builds a formatted CRM Note Pack from BDW results
 * 
 * Format:
 * - Header with business name and date
 * - Website/About Us
 * - Google Business Profile
 * - Directory Listing
 * - Citations/Elevator Pitch
 * - Meta Description
 * - Social Bios (condensed)
 * - Taglines
 * - FAQs (if available)
 */
export function buildCrmNotePack({
  businessName,
  city,
  state,
  result,
}: BDWNotePackInput): string {
  const location = city && state ? `${city}, ${state}` : city || state || "";
  const locationSuffix = location ? ` — ${location}` : "";
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sections: string[] = [];

  // Header
  sections.push(`BDW Output — ${businessName}${locationSuffix}`);
  sections.push(`Generated: ${generatedDate}`);
  sections.push("");

  // Website/About Us (long description)
  if (result.websiteAboutUs) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("WEBSITE / ABOUT US");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push(result.websiteAboutUs);
    sections.push("");
  }

  // Google Business Profile
  if (result.googleBusinessDescription) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("GOOGLE BUSINESS PROFILE");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push(result.googleBusinessDescription);
    sections.push("");
  }

  // Directory Listing
  if (result.obdListingDescription) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("DIRECTORY LISTING");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push(result.obdListingDescription);
    sections.push("");
  }

  // Citations/Elevator Pitch
  if (result.elevatorPitch) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("CITATIONS / ELEVATOR PITCH");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push(result.elevatorPitch);
    sections.push("");
  }

  // Meta Description
  if (result.metaDescription) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("SEO META DESCRIPTION");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push(result.metaDescription);
    sections.push("");
  }

  // Social Bios (condensed)
  const hasSocialBios =
    result.socialBioPack.facebookBio ||
    result.socialBioPack.instagramBio ||
    result.socialBioPack.xBio ||
    result.socialBioPack.linkedinTagline;

  if (hasSocialBios) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("SOCIAL MEDIA BIOS");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (result.socialBioPack.facebookBio) {
      sections.push("Facebook:");
      sections.push(result.socialBioPack.facebookBio);
      sections.push("");
    }
    
    if (result.socialBioPack.instagramBio) {
      sections.push("Instagram:");
      sections.push(result.socialBioPack.instagramBio);
      sections.push("");
    }
    
    if (result.socialBioPack.xBio) {
      sections.push("X (Twitter):");
      sections.push(result.socialBioPack.xBio);
      sections.push("");
    }
    
    if (result.socialBioPack.linkedinTagline) {
      sections.push("LinkedIn:");
      sections.push(result.socialBioPack.linkedinTagline);
      sections.push("");
    }
  }

  // Taglines
  if (result.taglineOptions && result.taglineOptions.length > 0) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("TAGLINE OPTIONS");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    result.taglineOptions.forEach((tagline, idx) => {
      sections.push(`${idx + 1}. ${tagline}`);
    });
    sections.push("");
  }

  // FAQs (if available)
  if (result.faqSuggestions && result.faqSuggestions.length > 0) {
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    sections.push("FAQ SUGGESTIONS");
    sections.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    result.faqSuggestions.forEach((faq, idx) => {
      sections.push(`Q${idx + 1}: ${faq.question}`);
      sections.push(`A${idx + 1}: ${faq.answer}`);
      sections.push("");
    });
  }

  return sections.join("\n");
}

