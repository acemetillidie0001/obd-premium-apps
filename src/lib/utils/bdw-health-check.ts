/**
 * BDW Health Check Utility
 * 
 * Client-side analysis of BDW outputs for quality, local relevance, and best practices.
 * This is analysis-only; no API calls, no DB writes, no side effects.
 */

export type HealthCheckSeverity = "ok" | "warn" | "info";

export interface HealthCheckItem {
  id: string;
  severity: HealthCheckSeverity;
  title: string;
  detail: string;
  fixHint?: string;
}

export interface HealthCheckReport {
  score: number;
  items: HealthCheckItem[];
}

interface BDWHealthCheckInputs {
  businessName: string;
  city?: string;
  state?: string;
  services?: string; // Can be comma-separated or newline-separated
  businessType?: string;
  tone?: string;
}

interface BDWHealthCheckOutputs {
  obdListingDescription?: string | null;
  googleBusinessDescription?: string | null;
  websiteAboutUs?: string | null;
  elevatorPitch?: string | null;
  metaDescription?: string | null;
}

interface BDWHealthCheckArgs {
  inputs: BDWHealthCheckInputs;
  outputs: BDWHealthCheckOutputs;
}

/**
 * Counts words in a string (simple whitespace split)
 */
function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Counts sentences in a string (split on .!?)
 */
function countSentences(text: string | null | undefined): number {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.length || 1; // At least 1 sentence
}

/**
 * Calculates average sentence length in words
 */
function averageSentenceLength(text: string | null | undefined): number {
  if (!text) return 0;
  const words = countWords(text);
  const sentences = countSentences(text);
  return sentences > 0 ? words / sentences : 0;
}

/**
 * Checks if text contains any of the search terms (case-insensitive)
 */
function containsAny(text: string | null | undefined, searchTerms: string[]): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return searchTerms.some((term) => lowerText.includes(term.toLowerCase()));
}

/**
 * Extracts services from a string (handles comma/newline separation)
 */
function extractServices(services: string | undefined): string[] {
  if (!services || !services.trim()) return [];
  return services
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Checks if text contains at least one service (case-insensitive partial match)
 */
function containsServices(text: string | null | undefined, services: string[]): boolean {
  if (!text || services.length === 0) return true; // No services to check = pass
  const lowerText = text.toLowerCase();
  return services.some((service) => {
    const serviceWords = service.toLowerCase().split(/\s+/);
    // Check if any significant word from the service appears
    return serviceWords.some((word) => word.length > 3 && lowerText.includes(word));
  });
}

/**
 * Runs health check analysis on BDW inputs and outputs
 */
export function runBDWHealthCheck(args: BDWHealthCheckArgs): HealthCheckReport {
  const { inputs, outputs } = args;
  const items: HealthCheckItem[] = [];
  let score = 100;

  const city = inputs.city?.trim();
  const state = inputs.state?.trim();
  const services = extractServices(inputs.services);
  const locationProvided = !!(city || state);

  // A) Local relevance check
  if (locationProvided) {
    const locationTerms: string[] = [];
    if (city) locationTerms.push(city);
    if (state) locationTerms.push(state);
    if (city && state) locationTerms.push(`${city}, ${state}`);

    // Check Google Business Profile
    if (outputs.googleBusinessDescription) {
      const hasLocation = containsAny(outputs.googleBusinessDescription, locationTerms);
      if (!hasLocation) {
        items.push({
          id: "gbp-local",
          severity: "warn",
          title: "Google Business Profile: Missing local reference",
          detail: `Your GBP description doesn't mention ${city || state}. Adding your location helps local SEO.`,
          fixHint: `Consider adding "${city || state}" naturally in your GBP description.`,
        });
        score -= 5;
      }
    }

    // Check Website/About Us
    if (outputs.websiteAboutUs) {
      const hasLocation = containsAny(outputs.websiteAboutUs, locationTerms);
      if (!hasLocation) {
        items.push({
          id: "website-local",
          severity: "warn",
          title: "Website About: Missing local reference",
          detail: `Your About page doesn't mention ${city || state}. Local references build trust.`,
          fixHint: `Consider mentioning "${city || state}" in your About page content.`,
        });
        score -= 3;
      }
    }

    // Check Directory Listing
    if (outputs.obdListingDescription) {
      const hasLocation = containsAny(outputs.obdListingDescription, locationTerms);
      if (!hasLocation) {
        items.push({
          id: "directory-local",
          severity: "warn",
          title: "Directory Listing: Missing local reference",
          detail: `Your directory listing doesn't mention ${city || state}.`,
          fixHint: `Add "${city || state}" to help local customers find you.`,
        });
        score -= 5;
      }
    }
  }

  // B) Services coverage check
  if (services.length > 0) {
    const serviceChecks = [
      { key: "gbp", text: outputs.googleBusinessDescription, label: "Google Business Profile" },
      { key: "website", text: outputs.websiteAboutUs, label: "Website About" },
      { key: "directory", text: outputs.obdListingDescription, label: "Directory Listing" },
    ];

    serviceChecks.forEach((check) => {
      if (check.text && !containsServices(check.text, services)) {
        items.push({
          id: `services-${check.key}`,
          severity: "warn",
          title: `${check.label}: Services not mentioned`,
          detail: `Your ${check.label.toLowerCase()} doesn't clearly mention your services.`,
          fixHint: "Consider adding 1–2 key services to help customers understand what you offer.",
        });
        score -= 4;
      }
    });
  }

  // C) Length guidance
  // Directory Listing: 80–180 chars
  if (outputs.obdListingDescription) {
    const len = outputs.obdListingDescription.length;
    if (len < 80) {
      items.push({
        id: "length-directory-short",
        severity: "info",
        title: "Directory Listing: Consider adding more detail",
        detail: `Your directory listing is ${len} characters. Aim for 80–180 characters for better SEO.`,
        fixHint: "Add a bit more detail about your services or unique value.",
      });
      score -= 2;
    } else if (len > 180) {
      items.push({
        id: "length-directory-long",
        severity: "info",
        title: "Directory Listing: Consider condensing",
        detail: `Your directory listing is ${len} characters. Shorter listings (80–180 chars) are easier to scan.`,
        fixHint: "Focus on the most important points.",
      });
      score -= 1;
    }
  }

  // Elevator Pitch: 60–140 chars
  if (outputs.elevatorPitch) {
    const len = outputs.elevatorPitch.length;
    if (len < 60) {
      items.push({
        id: "length-pitch-short",
        severity: "info",
        title: "Elevator Pitch: Could be more descriptive",
        detail: `Your elevator pitch is ${len} characters. Aim for 60–140 characters.`,
        fixHint: "Add a bit more context about what makes you unique.",
      });
      score -= 2;
    } else if (len > 140) {
      items.push({
        id: "length-pitch-long",
        severity: "info",
        title: "Elevator Pitch: Consider shortening",
        detail: `Your elevator pitch is ${len} characters. Shorter pitches (60–140 chars) are more memorable.`,
        fixHint: "Focus on the core message.",
      });
      score -= 1;
    }
  }

  // Google Business Profile: 300–700 chars (soft)
  if (outputs.googleBusinessDescription) {
    const len = outputs.googleBusinessDescription.length;
    if (len < 300) {
      items.push({
        id: "length-gbp-short",
        severity: "info",
        title: "Google Business Profile: Could include more detail",
        detail: `Your GBP description is ${len} characters. Google allows up to 750 characters.`,
        fixHint: "Consider adding more details about services, hours, or what makes you unique.",
      });
      score -= 1;
    } else if (len > 700) {
      items.push({
        id: "length-gbp-long",
        severity: "info",
        title: "Google Business Profile: May be truncated",
        detail: `Your GBP description is ${len} characters. Google may truncate after 750 characters.`,
        fixHint: "Consider condensing to ensure all important info is visible.",
      });
      score -= 1;
    }
  }

  // Website About: 600–1500 chars (soft)
  if (outputs.websiteAboutUs) {
    const len = outputs.websiteAboutUs.length;
    if (len < 600) {
      items.push({
        id: "length-website-short",
        severity: "info",
        title: "Website About: Could be more comprehensive",
        detail: `Your About page is ${len} characters. Longer content (600–1500 chars) helps with SEO and trust.`,
        fixHint: "Consider adding your story, mission, or more details about your services.",
      });
      score -= 1;
    } else if (len > 1500) {
      items.push({
        id: "length-website-long",
        severity: "info",
        title: "Website About: Consider breaking into sections",
        detail: `Your About page is ${len} characters. Very long content can be hard to read.`,
        fixHint: "Consider breaking into sections with headings or a shorter summary.",
      });
      score -= 1;
    }
  }

  // Meta Description: 70–160 chars (soft)
  if (outputs.metaDescription) {
    const len = outputs.metaDescription.length;
    if (len < 70) {
      items.push({
        id: "length-meta-short",
        severity: "info",
        title: "Meta Description: Could be more descriptive",
        detail: `Your meta description is ${len} characters. Aim for 70–160 characters for best SERP display.`,
        fixHint: "Add a bit more detail to entice clicks from search results.",
      });
      score -= 2;
    } else if (len > 160) {
      items.push({
        id: "length-meta-long",
        severity: "warn",
        title: "Meta Description: Will be truncated in search results",
        detail: `Your meta description is ${len} characters. Google typically shows 120–160 characters.`,
        fixHint: "Shorten to ensure your key message appears in search results.",
      });
      score -= 3;
    }
  }

  // D) Risky claims check
  const riskyPhrases = [
    "guarantee",
    "guaranteed",
    "best",
    "#1",
    "cure",
    "miracle",
    "always",
    "never",
    "100%",
    "proven",
  ];

  const textsToCheck = [
    { key: "gbp", text: outputs.googleBusinessDescription, label: "Google Business Profile" },
    { key: "website", text: outputs.websiteAboutUs, label: "Website About" },
    { key: "directory", text: outputs.obdListingDescription, label: "Directory Listing" },
    { key: "meta", text: outputs.metaDescription, label: "Meta Description" },
  ];

  textsToCheck.forEach((check) => {
    if (check.text) {
      const foundPhrases = riskyPhrases.filter((phrase) =>
        check.text!.toLowerCase().includes(phrase.toLowerCase())
      );
      if (foundPhrases.length > 0) {
        items.push({
          id: `risky-${check.key}`,
          severity: "warn",
          title: `${check.label}: Potentially risky claims`,
          detail: `Found phrases like "${foundPhrases.slice(0, 2).join('", "')}". These can reduce trust or violate advertising guidelines.`,
          fixHint: "Consider softening absolute claims. Focus on benefits rather than guarantees.",
        });
        score -= 3;
      }
    }
  });

  // E) Readability check (average sentence length)
  const readabilityChecks = [
    { key: "gbp", text: outputs.googleBusinessDescription, label: "Google Business Profile" },
    { key: "website", text: outputs.websiteAboutUs, label: "Website About" },
    { key: "directory", text: outputs.obdListingDescription, label: "Directory Listing" },
  ];

  readabilityChecks.forEach((check) => {
    if (check.text) {
      const avgLength = averageSentenceLength(check.text);
      if (avgLength > 25) {
        items.push({
          id: `readability-${check.key}`,
          severity: "warn",
          title: `${check.label}: Long sentences`,
          detail: `Average sentence length is ${avgLength.toFixed(1)} words. Shorter sentences (15–20 words) are easier to read.`,
          fixHint: "Break long sentences into shorter, clearer ones.",
        });
        score -= 2;
      }
    }
  });

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    score,
    items,
  };
}

