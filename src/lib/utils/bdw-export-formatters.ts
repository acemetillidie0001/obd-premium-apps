/**
 * Export formatters for Business Description Writer
 * Formats generated content into various export formats
 */

interface SocialBioPack {
  facebookBio: string;
  instagramBio: string;
  xBio: string;
  linkedinTagline: string;
}

interface FAQSuggestion {
  question: string;
  answer: string;
}

export interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: SocialBioPack;
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: FAQSuggestion[];
  metaDescription: string | null;
}

/**
 * Formats the full marketing pack as plain text
 */
export function formatFullPackPlainText(result: BusinessDescriptionResponse): string {
  const sections: string[] = [];

  if (result.obdListingDescription) {
    sections.push("OBD Directory Listing Description:");
    sections.push(result.obdListingDescription);
  }

  if (result.googleBusinessDescription) {
    sections.push("");
    sections.push("Google Business Profile Description:");
    sections.push(result.googleBusinessDescription);
  }

  if (result.websiteAboutUs) {
    sections.push("");
    sections.push("Website / About Page Description:");
    sections.push(result.websiteAboutUs);
  }

  if (result.elevatorPitch) {
    sections.push("");
    sections.push("Citations / Short Bio:");
    sections.push(result.elevatorPitch);
  }

  if (result.socialBioPack) {
    sections.push("");
    sections.push("Social Bio Pack:");
    if (result.socialBioPack.facebookBio) {
      sections.push(`Facebook: ${result.socialBioPack.facebookBio}`);
    }
    if (result.socialBioPack.instagramBio) {
      sections.push(`Instagram: ${result.socialBioPack.instagramBio}`);
    }
    if (result.socialBioPack.xBio) {
      sections.push(`X (Twitter): ${result.socialBioPack.xBio}`);
    }
    if (result.socialBioPack.linkedinTagline) {
      sections.push(`LinkedIn: ${result.socialBioPack.linkedinTagline}`);
    }
  }

  if (result.taglineOptions && result.taglineOptions.length > 0) {
    sections.push("");
    sections.push("Taglines:");
    result.taglineOptions.forEach((tagline) => {
      sections.push(`- ${tagline}`);
    });
  }

  if (result.faqSuggestions && result.faqSuggestions.length > 0) {
    sections.push("");
    sections.push("FAQ Suggestions:");
    result.faqSuggestions.forEach((faq) => {
      sections.push("");
      sections.push(`Q: ${faq.question}`);
      sections.push(`A: ${faq.answer}`);
    });
  }

  if (result.metaDescription) {
    sections.push("");
    sections.push("SEO Meta Description:");
    sections.push(result.metaDescription);
  }

  const content = sections.join("\n");
  return content || "No content available for this bundle yet. Generate content first.";
}

/**
 * Formats the full marketing pack as Markdown
 */
export function formatFullPackMarkdown(result: BusinessDescriptionResponse): string {
  const sections: string[] = [];

  if (result.obdListingDescription) {
    sections.push("## OBD Directory Listing Description");
    sections.push("");
    sections.push(result.obdListingDescription);
  }

  if (result.googleBusinessDescription) {
    sections.push("");
    sections.push("## Google Business Profile Description");
    sections.push("");
    sections.push(result.googleBusinessDescription);
  }

  if (result.websiteAboutUs) {
    sections.push("");
    sections.push("## Website / About Page Description");
    sections.push("");
    sections.push(result.websiteAboutUs);
  }

  if (result.elevatorPitch) {
    sections.push("");
    sections.push("## Citations / Short Bio");
    sections.push("");
    sections.push(result.elevatorPitch);
  }

  if (result.socialBioPack) {
    sections.push("");
    sections.push("## Social Bio Pack");
    sections.push("");
    if (result.socialBioPack.facebookBio) {
      sections.push("### Facebook");
      sections.push(result.socialBioPack.facebookBio);
      sections.push("");
    }
    if (result.socialBioPack.instagramBio) {
      sections.push("### Instagram");
      sections.push(result.socialBioPack.instagramBio);
      sections.push("");
    }
    if (result.socialBioPack.xBio) {
      sections.push("### X (Twitter)");
      sections.push(result.socialBioPack.xBio);
      sections.push("");
    }
    if (result.socialBioPack.linkedinTagline) {
      sections.push("### LinkedIn");
      sections.push(result.socialBioPack.linkedinTagline);
      sections.push("");
    }
  }

  if (result.taglineOptions && result.taglineOptions.length > 0) {
    sections.push("## Taglines");
    sections.push("");
    result.taglineOptions.forEach((tagline) => {
      sections.push(`- ${tagline}`);
    });
  }

  if (result.faqSuggestions && result.faqSuggestions.length > 0) {
    sections.push("");
    sections.push("## FAQ Suggestions");
    sections.push("");
    result.faqSuggestions.forEach((faq) => {
      sections.push(`### ${faq.question}`);
      sections.push("");
      sections.push(faq.answer);
      sections.push("");
    });
  }

  if (result.metaDescription) {
    sections.push("");
    sections.push("## SEO Meta Description");
    sections.push("");
    sections.push(result.metaDescription);
  }

  const content = sections.join("\n").replace(/\n\n\n+/g, "\n\n");
  return content || "No content available. Generate content to enable exports.";
}

/**
 * Formats the Website/About section as an HTML snippet
 */
export function formatWebsiteHtmlSnippet(result: BusinessDescriptionResponse): string {
  if (!result.websiteAboutUs) {
    return "<!-- No content available. Generate content to enable exports. -->";
  }

  // Convert line breaks to <p> tags or <br> tags
  const paragraphs = result.websiteAboutUs
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => p.trim());

  if (paragraphs.length === 0) {
    return "<!-- No content available. Generate content to enable exports. -->";
  }

  const htmlContent = paragraphs.map((para) => `  <p>${para.replace(/\n/g, "<br>\n    ")}</p>`).join("\n");

  return `<section class="about-us">
${htmlContent}
</section>`;
}

/**
 * Formats GBP Pack as plain text (for Copy Bundles)
 * Matches the exact format used in Copy Bundles - GBP Bundle
 */
export function formatGBPPackPlainText(result: BusinessDescriptionResponse): string {
  const sections: string[] = [];

  if (result.googleBusinessDescription) {
    sections.push("Google Business Profile Description:");
    sections.push(result.googleBusinessDescription);
  }

  if (result.metaDescription) {
    sections.push("");
    sections.push("SEO Meta Description:");
    sections.push(result.metaDescription);
  }

  if (result.taglineOptions && result.taglineOptions.length > 0) {
    sections.push("");
    sections.push("Taglines:");
    const taglinesToInclude = result.taglineOptions.slice(0, 3);
    taglinesToInclude.forEach((tagline) => {
      sections.push(`- ${tagline}`);
    });
  }

  if (result.elevatorPitch) {
    sections.push("");
    sections.push("Elevator Pitch:");
    sections.push(result.elevatorPitch);
  }

  const content = sections.join("\n");
  return content || "No content available for this bundle yet. Generate content first.";
}

/**
 * Formats GBP block (Google Business Profile + Meta Description + Taglines + Elevator Pitch)
 */
export function formatGBPBlock(result: BusinessDescriptionResponse): string {
  const sections: string[] = [];

  if (result.googleBusinessDescription) {
    sections.push("Google Business Profile Description:");
    sections.push(result.googleBusinessDescription);
  }

  if (result.metaDescription) {
    if (sections.length > 0) sections.push("");
    sections.push("SEO Meta Description:");
    sections.push(result.metaDescription);
  }

  if (result.taglineOptions && result.taglineOptions.length > 0) {
    if (sections.length > 0) sections.push("");
    sections.push("Taglines:");
    result.taglineOptions.slice(0, 3).forEach((tagline) => {
      sections.push(`- ${tagline}`);
    });
  }

  if (result.elevatorPitch) {
    if (sections.length > 0) sections.push("");
    sections.push("Elevator Pitch:");
    sections.push(result.elevatorPitch);
  }

  return sections.join("\n") || "Generate content to enable exports.";
}

/**
 * Formats Website Pack as plain text (for Copy Bundles)
 * Matches the exact format used in Copy Bundles - Website Bundle
 */
export function formatWebsitePackPlainText(result: BusinessDescriptionResponse): string {
  const sections: string[] = [];

  if (result.websiteAboutUs) {
    sections.push("Website / About Page Description:");
    sections.push(result.websiteAboutUs);
  }

  if (result.elevatorPitch) {
    sections.push("");
    sections.push("Elevator Pitch:");
    sections.push(result.elevatorPitch);
  }

  if (result.faqSuggestions && result.faqSuggestions.length > 0) {
    sections.push("");
    sections.push("FAQ Suggestions:");
    const faqsToInclude = result.faqSuggestions.slice(0, 5);
    faqsToInclude.forEach((faq) => {
      sections.push("");
      sections.push(`Q: ${faq.question}`);
      sections.push(`A: ${faq.answer}`);
    });
  }

  const content = sections.join("\n");
  return content || "No content available for this bundle yet. Generate content first.";
}

/**
 * Formats Website/About block
 */
export function formatWebsiteAboutBlock(result: BusinessDescriptionResponse): string {
  if (!result.websiteAboutUs) {
    return "Generate content to enable exports.";
  }
  return result.websiteAboutUs;
}

/**
 * Formats Social Bio block
 */
export function formatSocialBioBlock(result: BusinessDescriptionResponse): string {
  const sections: string[] = [];

  if (result.socialBioPack) {
    if (result.socialBioPack.facebookBio) {
      sections.push("Facebook:");
      sections.push(result.socialBioPack.facebookBio);
    }
    if (result.socialBioPack.instagramBio) {
      if (sections.length > 0) sections.push("");
      sections.push("Instagram:");
      sections.push(result.socialBioPack.instagramBio);
    }
    if (result.socialBioPack.xBio) {
      if (sections.length > 0) sections.push("");
      sections.push("X (Twitter):");
      sections.push(result.socialBioPack.xBio);
    }
    if (result.socialBioPack.linkedinTagline) {
      if (sections.length > 0) sections.push("");
      sections.push("LinkedIn:");
      sections.push(result.socialBioPack.linkedinTagline);
    }
  }

  return sections.join("\n") || "Generate content to enable exports.";
}

/**
 * Formats FAQ block
 */
export function formatFAQBlock(result: BusinessDescriptionResponse): string {
  if (!result.faqSuggestions || result.faqSuggestions.length === 0) {
    return "Generate content to enable exports.";
  }

  const sections: string[] = [];
  result.faqSuggestions.forEach((faq) => {
    sections.push(`Q: ${faq.question}`);
    sections.push(`A: ${faq.answer}`);
    sections.push("");
  });

  return sections.join("\n").trim();
}

/**
 * Formats Meta block
 */
export function formatMetaBlock(result: BusinessDescriptionResponse): string {
  if (!result.metaDescription) {
    return "Generate content to enable exports.";
  }
  return result.metaDescription;
}

