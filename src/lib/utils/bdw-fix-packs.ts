/**
 * BDW Fix Packs Utility
 * 
 * Client-side transformation suggestions for BDW outputs based on health check findings.
 * Provides previews and safe edits. No API calls, no DB writes, no side effects.
 */

import type { HealthCheckReport } from "./bdw-health-check";
import { safeTrimToLimit } from "./safeTrimToLimit";

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
 * Tier 2A: Extracts primary service keyword from services string
 */
function extractPrimaryServiceKeyword(services: string | undefined, businessType: string | undefined): string {
  if (!services && !businessType) return "";
  
  const serviceList = services ? extractServices(services) : [];
  
  // Try to find a short, keyword-friendly service term
  if (serviceList.length > 0) {
    // Prefer shorter, more specific terms
    const shortServices = serviceList.filter(s => s.length <= 25);
    if (shortServices.length > 0) {
      return shortServices[0].toLowerCase();
    }
    return serviceList[0].toLowerCase();
  }
  
  // Fallback to business type
  if (businessType) {
    return businessType.toLowerCase();
  }
  
  return "";
}

/**
 * Tier 2A: Builds optimized meta description (150-160 chars)
 * Keeps: business name, service keyword, location
 */
function buildOptimizedMetaDescription(
  original: string,
  businessName: string,
  services: string | undefined,
  businessType: string | undefined,
  city: string | undefined,
  state: string | undefined
): string {
  const targetLength = 155; // Middle of 150-160 range
  const businessNameClean = businessName.trim();
  const serviceKeyword = extractPrimaryServiceKeyword(services, businessType);
  const locationProvided = !!(city || state);
  
  // Build components
  const parts: string[] = [];
  
  // Start with business name if it fits
  if (businessNameClean && businessNameClean.length <= 40) {
    parts.push(businessNameClean);
  }
  
  // Add service keyword
  if (serviceKeyword) {
    const servicePhrase = serviceKeyword.length > 0 ? ` ${serviceKeyword} services` : "";
    if (servicePhrase && (parts.join(" ").length + servicePhrase.length) < targetLength - 30) {
      parts.push(servicePhrase.trim());
    }
  }
  
  // Extract key value proposition from original (first sentence or key phrase)
  const originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (originalSentences.length > 0) {
    const firstSentence = originalSentences[0].trim();
    // Remove business name if already included
    const cleanedSentence = firstSentence
      .replace(new RegExp(businessNameClean, "gi"), "")
      .trim();
    
    if (cleanedSentence.length > 0 && cleanedSentence.length < 80) {
      parts.push(cleanedSentence);
    }
  }
  
  // Add location at the end
  if (locationProvided) {
    const locationPhrase = city && state 
      ? ` in ${city}, ${state}`
      : city 
      ? ` in ${city}`
      : state 
      ? ` in ${state}`
      : "";
    
    if (locationPhrase) {
      parts.push(locationPhrase);
    }
  }
  
  // Combine and trim to target length
  let optimized = parts.join(" ").trim();
  
  // Remove duplicate spaces
  optimized = optimized.replace(/\s+/g, " ");
  
  // If too long, trim intelligently
  if (optimized.length > targetLength) {
    // Try to keep business name + location + service, trim the middle
    if (businessNameClean && locationProvided) {
      const locationPhrase = city && state 
        ? ` in ${city}, ${state}`
        : city 
        ? ` in ${city}`
        : ` in ${state}`;
      
      const essential = `${businessNameClean}${serviceKeyword ? ` ${serviceKeyword}` : ""}${locationPhrase}`;
      if (essential.length < targetLength - 20) {
        const remaining = targetLength - essential.length - 3;
        if (remaining > 20 && originalSentences.length > 0) {
          const snippet = originalSentences[0].substring(0, remaining).trim();
          optimized = `${businessNameClean}${serviceKeyword ? ` ${serviceKeyword}` : ""} — ${snippet}${locationPhrase}`;
        } else {
          optimized = essential;
        }
      }
    }
    
    // Final trim if still too long
    if (optimized.length > 160) {
      optimized = safeTrimToLimit(optimized, 160);
    }
  }
  
  // Ensure we're in the target range
  if (optimized.length < 140) {
    // Too short, add a bit more context if available
    if (originalSentences.length > 1 && optimized.length < 130) {
      const secondSentence = originalSentences[1].trim().substring(0, 30);
      optimized = `${optimized} ${secondSentence}`.trim();
      if (optimized.length > 160) {
        optimized = safeTrimToLimit(optimized, 160);
      }
    }
  }
  
  // Final safety trim to ensure we're within 160 chars
  return safeTrimToLimit(optimized, 160);
}

/**
 * Tier 2A: Optimizes destination description length while preserving meaning
 */
function optimizeDestinationLength(
  text: string,
  targetType: "obd" | "gbp" | "website" | "citations"
): string {
  if (!text) return text;
  
  let targetLength: number;
  let minLength: number;
  
  switch (targetType) {
    case "obd":
      // OBD: 80-180 words or ~200-400 chars (reasonable range)
      // Use safeTrimToLimit with 400 max, target around 300 where feasible
      if (text.length > 400) {
        // Try to remove redundant intro phrases first
        const fluffPatterns = [
          /^(Welcome to|At|We are|We're|Our company|We specialize in|We provide|We offer)[\s,]/i,
        ];
        
        let cleaned = text;
        for (const pattern of fluffPatterns) {
          cleaned = cleaned.replace(pattern, "").trim();
        }
        
        // If cleaning helped, use cleaned version
        if (cleaned.length < text.length && cleaned.length >= 200) {
          text = cleaned;
        }
        
        return safeTrimToLimit(text, 400);
      }
      return text;
    case "gbp":
      // GBP: <= 750 chars
      if (text.length > 750) {
        return safeTrimToLimit(text, 750);
      }
      return text;
    case "website":
      // Website: keep longer but remove fluff, max 800 chars
      if (text.length > 800) {
        // Remove common fluff phrases at the start
        const fluffPatterns = [
          /^(Welcome to|At|We are|We're|Our company|We specialize in|We provide|We offer)[\s,]/i,
        ];
        
        let cleaned = text;
        for (const pattern of fluffPatterns) {
          cleaned = cleaned.replace(pattern, "").trim();
        }
        
        // If cleaning helped, use cleaned version
        if (cleaned.length < text.length && cleaned.length >= 400) {
          text = cleaned;
        }
        
        return safeTrimToLimit(text, 800);
      }
      return text;
    case "citations":
      // Citations: 200-300 chars, target around 250 where feasible
      if (text.length > 300) {
        return safeTrimToLimit(text, 300);
      }
      return text;
    default:
      return text;
  }
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

  // B) trim_length - Tier 2A: Optimize destination descriptions
  const needsTrimming: OutputField[] = [];
  
  // OBD listing: optimize if > 400 chars (reasonable upper limit)
  if (result.obdListingDescription && result.obdListingDescription.length > 400) {
    needsTrimming.push("directory");
  }
  
  // GBP: optimize if > 750 chars
  if (result.googleBusinessDescription && result.googleBusinessDescription.length > 750) {
    needsTrimming.push("gbp");
  }
  
  // Website: optimize if > 1000 chars (remove fluff)
  if (result.websiteAboutUs && result.websiteAboutUs.length > 1000) {
    needsTrimming.push("website");
  }
  
  // Citations (elevator pitch): optimize if > 300 chars
  if (result.elevatorPitch && result.elevatorPitch.length > 300) {
    needsTrimming.push("citations");
  }
  
  // Note: meta description is handled by meta_optimize, not trim_length

  if (needsTrimming.length > 0) {
    suggestions.push({
      id: "trim_length",
      title: "Optimize Length",
      description: `Optimize ${needsTrimming.length} description${needsTrimming.length > 1 ? "s" : ""} to fit recommended character limits.`,
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
      // Tier 2A: Optimize destination descriptions with specific targets
      if (result.obdListingDescription) {
        const original = result.obdListingDescription;
        const optimized = optimizeDestinationLength(original, "obd");
        if (optimized !== original) {
          updated.obdListingDescription = optimized;
          notes.push(`Optimized directory listing from ${original.length} to ${optimized.length} characters.`);
        }
      }
      
      if (result.googleBusinessDescription) {
        const original = result.googleBusinessDescription;
        const optimized = optimizeDestinationLength(original, "gbp");
        if (optimized !== original) {
          updated.googleBusinessDescription = optimized;
          notes.push(`Optimized Google Business Profile from ${original.length} to ${optimized.length} characters.`);
        }
      }
      
      if (result.websiteAboutUs) {
        const original = result.websiteAboutUs;
        const optimized = optimizeDestinationLength(original, "website");
        if (optimized !== original) {
          updated.websiteAboutUs = optimized;
          notes.push(`Optimized website About page from ${original.length} to ${optimized.length} characters.`);
        }
      }
      
      if (result.elevatorPitch) {
        const original = result.elevatorPitch;
        const optimized = optimizeDestinationLength(original, "citations");
        if (optimized !== original) {
          updated.elevatorPitch = optimized;
          notes.push(`Optimized elevator pitch from ${original.length} to ${optimized.length} characters.`);
        }
      }
      
      // Meta description is handled by meta_optimize, not trim_length
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
      // Tier 2A: Build optimized meta description (150-160 chars)
      // Keep: business name, service keyword, location
      if (result.metaDescription) {
        const original = result.metaDescription;
        const optimized = buildOptimizedMetaDescription(
          original,
          formValues.businessName || "",
          formValues.services,
          formValues.businessType,
          city,
          state
        );

        if (optimized !== original && optimized.length >= 140 && optimized.length <= 160) {
          updated.metaDescription = optimized;
          notes.push(`Optimized meta description from ${original.length} to ${optimized.length} characters (target: 150-160).`);
        } else if (optimized !== original) {
          // Still update if improved, even if slightly outside range
          updated.metaDescription = optimized;
          notes.push(`Optimized meta description from ${original.length} to ${optimized.length} characters.`);
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

/**
 * Tier 2B-1: Get proposed changes for a fix pack
 * Returns proposed changes and list of changed keys
 */
export function getProposedChangesForFix(
  fixId: FixPackId,
  formValues: BDWFormValues,
  baseResult: BDWResult
): { proposed: Partial<BDWResult>; changedKeys: string[] } {
  const preview = previewFixPack(fixId, formValues, baseResult);
  const changedKeys: string[] = [];
  
  // Compare each proposed field to baseResult to find actual changes
  Object.keys(preview.updated).forEach((key) => {
    const typedKey = key as keyof BDWResult;
    const proposedValue = preview.updated[typedKey];
    const baseValue = baseResult[typedKey];
    
    // Only include if values actually differ
    if (proposedValue !== baseValue && proposedValue !== null && proposedValue !== undefined) {
      changedKeys.push(key);
    }
  });
  
  return {
    proposed: preview.updated,
    changedKeys,
  };
}

/**
 * Tier 2B-1: Get eligibility status for a fix pack
 * Returns whether the fix is eligible and a reason if not
 */
export function getFixEligibility(
  fixId: FixPackId,
  formValues: BDWFormValues,
  baseResult: BDWResult
): { eligible: boolean; reason?: string; changedKeys?: string[] } {
  const { changedKeys } = getProposedChangesForFix(fixId, formValues, baseResult);
  
  if (changedKeys.length === 0) {
    // Not eligible - determine reason based on fix type
    let reason: string;
    switch (fixId) {
      case "meta_optimize":
        reason = "Meta description already within recommended length.";
        break;
      case "trim_length":
        reason = "Descriptions already within recommended limits.";
        break;
      case "add_location":
        reason = "Location references already present.";
        break;
      case "service_mention":
        reason = "Service mentions already present.";
        break;
      case "safer_claims":
        reason = "No risky claims found.";
        break;
      default:
        reason = "No changes needed for this fix pack.";
    }
    
    return {
      eligible: false,
      reason,
      changedKeys: [],
    };
  }
  
  return {
    eligible: true,
    changedKeys,
  };
}

