/**
 * BDW Fix Packs Utility
 * 
 * Client-side transformation suggestions for BDW outputs based on health check findings.
 * Provides previews and safe edits. No API calls, no DB writes, no side effects.
 */

import type { HealthCheckReport } from "./bdw-health-check";

export type FixPackId =
  | "add_location"
  | "trim_length"
  | "service_mention"
  | "safer_claims"
  | "meta_optimize";

export type OutputField = "directory" | "gbp" | "website" | "citations" | "meta";

export interface FixSuggestion {
  id: FixPackId;
  title: string;
  description: string;
  appliesTo: OutputField[];
  priority: number; // Higher priority = more important (sort descending)
}

export interface FixPreview {
  updated: Partial<{
    obdListingDescription: string;
    googleBusinessDescription: string;
    websiteAboutUs: string;
    elevatorPitch: string;
    metaDescription: string;
  }>;
  notes: string[];
}

interface BDWFormValues {
  businessName: string;
  city?: string;
  state?: string;
  services?: string;
  businessType?: string;
}

interface BDWResult {
  obdListingDescription?: string | null;
  googleBusinessDescription?: string | null;
  websiteAboutUs?: string | null;
  elevatorPitch?: string | null;
  metaDescription?: string | null;
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
 * Checks if text contains location terms (case-insensitive)
 */
function containsLocation(text: string | null | undefined, city?: string, state?: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  if (city && lowerText.includes(city.toLowerCase())) return true;
  if (state && lowerText.includes(state.toLowerCase())) return true;
  if (city && state && lowerText.includes(`${city.toLowerCase()}, ${state.toLowerCase()}`)) return true;
  return false;
}

/**
 * Checks if text contains any service keywords (case-insensitive partial match)
 */
function containsServices(text: string | null | undefined, services: string[]): boolean {
  if (!text || services.length === 0) return false;
  const lowerText = text.toLowerCase();
  return services.some((service) => {
    const serviceWords = service.toLowerCase().split(/\s+/);
    return serviceWords.some((word) => word.length > 3 && lowerText.includes(word));
  });
}

/**
 * Truncates text to max length, trying to break at sentence boundary
 */
function truncateAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to find a sentence boundary before maxLength
  const beforeMax = text.substring(0, maxLength);
  const lastPeriod = beforeMax.lastIndexOf(".");
  const lastExclamation = beforeMax.lastIndexOf("!");
  const lastQuestion = beforeMax.lastIndexOf("?");
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.7) {
    // Found a sentence boundary reasonably close to max
    return text.substring(0, lastSentenceEnd + 1).trim();
  }
  
  // No good sentence boundary, truncate at word boundary
  const lastSpace = beforeMax.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.8) {
    return text.substring(0, lastSpace).trim() + "...";
  }
  
  // Fallback: hard truncate
  return text.substring(0, maxLength).trim() + "...";
}

/**
 * Builds fix suggestions based on form values, result, and health check report
 */
export function buildFixSuggestions(
  formValues: BDWFormValues,
  result: BDWResult,
  report: HealthCheckReport
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  const city = formValues.city?.trim();
  const state = formValues.state?.trim();
  const services = extractServices(formValues.services);
  const locationProvided = !!(city || state);

  // A) add_location
  if (locationProvided) {
    const needsLocation: OutputField[] = [];
    if (result.obdListingDescription && !containsLocation(result.obdListingDescription, city, state)) {
      needsLocation.push("directory");
    }
    if (result.googleBusinessDescription && !containsLocation(result.googleBusinessDescription, city, state)) {
      needsLocation.push("gbp");
    }
    if (result.websiteAboutUs && !containsLocation(result.websiteAboutUs, city, state)) {
      needsLocation.push("website");
    }
    if (result.elevatorPitch && !containsLocation(result.elevatorPitch, city, state)) {
      needsLocation.push("citations");
    }

    if (needsLocation.length > 0) {
      suggestions.push({
        id: "add_location",
        title: "Add Local References",
        description: `Add "${city || state}" to ${needsLocation.length} description${needsLocation.length > 1 ? "s" : ""} to improve local SEO.`,
        appliesTo: needsLocation,
        priority: 5, // High priority - local SEO is important
      });
    }
  }

  // B) trim_length
  const needsTrimming: OutputField[] = [];
  if (result.obdListingDescription && result.obdListingDescription.length > 180) {
    needsTrimming.push("directory");
  }
  if (result.elevatorPitch && result.elevatorPitch.length > 140) {
    needsTrimming.push("citations");
  }
  if (result.metaDescription && result.metaDescription.length > 160) {
    needsTrimming.push("meta");
  }

  if (needsTrimming.length > 0) {
    suggestions.push({
      id: "trim_length",
      title: "Optimize Length",
      description: `Trim ${needsTrimming.length} description${needsTrimming.length > 1 ? "s" : ""} to fit recommended character limits.`,
      appliesTo: needsTrimming,
      priority: 3, // Medium priority
    });
  }

  // C) service_mention
  if (services.length > 0) {
    const needsServices: OutputField[] = [];
    if (result.obdListingDescription && !containsServices(result.obdListingDescription, services)) {
      needsServices.push("directory");
    }
    if (result.googleBusinessDescription && !containsServices(result.googleBusinessDescription, services)) {
      needsServices.push("gbp");
    }
    if (result.websiteAboutUs && !containsServices(result.websiteAboutUs, services)) {
      needsServices.push("website");
    }

    if (needsServices.length > 0) {
      suggestions.push({
        id: "service_mention",
        title: "Add Service Mentions",
        description: `Add your key services to ${needsServices.length} description${needsServices.length > 1 ? "s" : ""} to help customers understand what you offer.`,
        appliesTo: needsServices,
        priority: 4, // High priority - helps customers understand offerings
      });
    }
  }

  // D) safer_claims
  const riskyPhrases = ["guarantee", "guaranteed", "best", "#1", "cure", "miracle", "always", "never", "100%"];
  const needsSaferClaims: OutputField[] = [];

  const checkText = (text: string | null | undefined, field: OutputField) => {
    if (text) {
      const lowerText = text.toLowerCase();
      if (riskyPhrases.some((phrase) => lowerText.includes(phrase))) {
        needsSaferClaims.push(field);
      }
    }
  };

  checkText(result.obdListingDescription, "directory");
  checkText(result.googleBusinessDescription, "gbp");
  checkText(result.websiteAboutUs, "website");
  checkText(result.metaDescription, "meta");

  if (needsSaferClaims.length > 0) {
    suggestions.push({
      id: "safer_claims",
      title: "Soften Risky Claims",
      description: `Replace potentially risky phrases in ${needsSaferClaims.length} description${needsSaferClaims.length > 1 ? "s" : ""} with more trustworthy language.`,
      appliesTo: needsSaferClaims,
      priority: 4, // High priority - avoids compliance issues
    });
  }

  // E) meta_optimize
  if (result.metaDescription) {
    const needsMetaOptimize: OutputField[] = [];
    if (locationProvided && !containsLocation(result.metaDescription, city, state)) {
      needsMetaOptimize.push("meta");
    } else if (result.metaDescription.length > 160) {
      needsMetaOptimize.push("meta");
    }

    if (needsMetaOptimize.length > 0) {
      suggestions.push({
        id: "meta_optimize",
        title: "Optimize Meta Description",
        description: "Improve meta description for better search result display and local SEO.",
        appliesTo: needsMetaOptimize,
        priority: 5, // High priority - meta description is critical for SEO
      });
    }
  }

  // Sort by priority descending (highest priority first)
  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Previews a fix pack transformation
 */
export function previewFixPack(
  packId: FixPackId,
  formValues: BDWFormValues,
  result: BDWResult
): FixPreview {
  const updated: FixPreview["updated"] = {};
  const notes: string[] = [];
  const city = formValues.city?.trim();
  const state = formValues.state?.trim();
  const services = extractServices(formValues.services);

  switch (packId) {
    case "add_location": {
      const locationSentence = city && state
        ? ` Proudly serving ${city}, ${state} and nearby areas.`
        : city
        ? ` Proudly serving ${city} and nearby areas.`
        : state
        ? ` Proudly serving ${state} and nearby areas.`
        : "";

      if (locationSentence) {
        if (result.obdListingDescription && !containsLocation(result.obdListingDescription, city, state)) {
          updated.obdListingDescription = result.obdListingDescription + locationSentence;
          notes.push("Added location reference to directory listing.");
        }
        if (result.googleBusinessDescription && !containsLocation(result.googleBusinessDescription, city, state)) {
          updated.googleBusinessDescription = result.googleBusinessDescription + locationSentence;
          notes.push("Added location reference to Google Business Profile.");
        }
        if (result.websiteAboutUs && !containsLocation(result.websiteAboutUs, city, state)) {
          updated.websiteAboutUs = result.websiteAboutUs + locationSentence;
          notes.push("Added location reference to website About page.");
        }
        if (result.elevatorPitch && !containsLocation(result.elevatorPitch, city, state)) {
          updated.elevatorPitch = result.elevatorPitch + locationSentence;
          notes.push("Added location reference to elevator pitch.");
        }
      }
      break;
    }

    case "trim_length": {
      if (result.obdListingDescription && result.obdListingDescription.length > 180) {
        updated.obdListingDescription = truncateAtSentence(result.obdListingDescription, 180);
        notes.push(`Trimmed directory listing from ${result.obdListingDescription.length} to ${updated.obdListingDescription.length} characters.`);
      }
      if (result.elevatorPitch && result.elevatorPitch.length > 140) {
        updated.elevatorPitch = truncateAtSentence(result.elevatorPitch, 140);
        notes.push(`Trimmed elevator pitch from ${result.elevatorPitch.length} to ${updated.elevatorPitch.length} characters.`);
      }
      if (result.metaDescription && result.metaDescription.length > 160) {
        updated.metaDescription = truncateAtSentence(result.metaDescription, 160);
        notes.push(`Trimmed meta description from ${result.metaDescription.length} to ${updated.metaDescription.length} characters.`);
      }
      break;
    }

    case "service_mention": {
      if (services.length > 0) {
        const serviceList = services.slice(0, 2).join(" and ");
        const serviceSentence = ` We specialize in ${serviceList}.`;

        if (result.obdListingDescription && !containsServices(result.obdListingDescription, services)) {
          updated.obdListingDescription = result.obdListingDescription + serviceSentence;
          notes.push(`Added service mention to directory listing.`);
        }
        if (result.googleBusinessDescription && !containsServices(result.googleBusinessDescription, services)) {
          updated.googleBusinessDescription = result.googleBusinessDescription + serviceSentence;
          notes.push(`Added service mention to Google Business Profile.`);
        }
        if (result.websiteAboutUs && !containsServices(result.websiteAboutUs, services)) {
          updated.websiteAboutUs = result.websiteAboutUs + serviceSentence;
          notes.push(`Added service mention to website About page.`);
        }
      }
      break;
    }

    case "safer_claims": {
      const replacements: Array<[RegExp, string]> = [
        [/\bguarantee\b/gi, "committed to"],
        [/\bguaranteed\b/gi, "committed to"],
        [/\bbest\b/gi, "trusted"],
        [/#1\b/gi, "highly rated"],
        [/\bcure\b/gi, "help with"],
        [/\bmiracle\b/gi, "effective solution"],
        [/\balways\b/gi, "consistently"],
        [/\bnever\b/gi, "rarely"],
        [/\b100%\b/gi, "thoroughly"],
      ];

      const applyReplacements = (text: string): string => {
        let updated = text;
        replacements.forEach(([pattern, replacement]) => {
          updated = updated.replace(pattern, replacement);
        });
        return updated;
      };

      if (result.obdListingDescription) {
        const original = result.obdListingDescription;
        const replaced = applyReplacements(original);
        if (replaced !== original) {
          updated.obdListingDescription = replaced;
          notes.push("Softened risky claims in directory listing.");
        }
      }
      if (result.googleBusinessDescription) {
        const original = result.googleBusinessDescription;
        const replaced = applyReplacements(original);
        if (replaced !== original) {
          updated.googleBusinessDescription = replaced;
          notes.push("Softened risky claims in Google Business Profile.");
        }
      }
      if (result.websiteAboutUs) {
        const original = result.websiteAboutUs;
        const replaced = applyReplacements(original);
        if (replaced !== original) {
          updated.websiteAboutUs = replaced;
          notes.push("Softened risky claims in website About page.");
        }
      }
      if (result.metaDescription) {
        const original = result.metaDescription;
        const replaced = applyReplacements(original);
        if (replaced !== original) {
          updated.metaDescription = replaced;
          notes.push("Softened risky claims in meta description.");
        }
      }
      break;
    }

    case "meta_optimize": {
      if (result.metaDescription) {
        let optimized = result.metaDescription;
        const locationProvided = !!(city || state);

        // Add location if missing
        if (locationProvided && !containsLocation(optimized, city, state)) {
          if (city && state) {
            optimized = `${optimized} Serving ${city}, ${state}.`;
          } else if (city) {
            optimized = `${optimized} Serving ${city}.`;
          } else if (state) {
            optimized = `${optimized} Serving ${state}.`;
          }
          notes.push("Added location to meta description.");
        }

        // Trim if too long
        if (optimized.length > 160) {
          optimized = truncateAtSentence(optimized, 160);
          notes.push(`Trimmed meta description to ${optimized.length} characters for optimal SERP display.`);
        }

        if (optimized !== result.metaDescription) {
          updated.metaDescription = optimized;
        }
      }
      break;
    }
  }

  return {
    updated,
    notes,
  };
}

