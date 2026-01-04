/**
 * Convert BusinessDescriptionResponse to DestinationInput format
 * 
 * Helper to bridge existing BDW response format to destination formatters
 */

import type { BusinessDescriptionResponse } from "@/lib/utils/bdw-export-formatters";
import type { DestinationInput } from "./formatForGBP";

/**
 * Convert BusinessDescriptionResponse to DestinationInput
 */
export function convertToDestinationInput(
  result: BusinessDescriptionResponse
): DestinationInput {
  // Build sections from available content
  const sections: Array<{ heading?: string; body: string }> = [];

  // OBD Listing Description as first section
  if (result.obdListingDescription) {
    sections.push({
      heading: "OBD Listing Description",
      body: result.obdListingDescription,
    });
  }

  // Website About Us as a section
  if (result.websiteAboutUs) {
    sections.push({
      heading: "Website About Us",
      body: result.websiteAboutUs,
    });
  }

  // Google Business Description (can be used as description)
  const description = result.googleBusinessDescription || result.obdListingDescription || result.websiteAboutUs;

  // Convert FAQs
  const faqs = result.faqSuggestions?.map((faq) => ({
    q: faq.question,
    a: faq.answer,
  })) || [];

  // Convert taglines
  const taglines = result.taglineOptions || [];

  // Build platforms object from social bio pack
  const platforms: Record<string, string[]> = {};
  if (result.socialBioPack) {
    if (result.socialBioPack.facebookBio) {
      platforms.facebook = [result.socialBioPack.facebookBio];
    }
    if (result.socialBioPack.instagramBio) {
      platforms.instagram = [result.socialBioPack.instagramBio];
    }
    if (result.socialBioPack.xBio) {
      platforms.x = [result.socialBioPack.xBio];
    }
    if (result.socialBioPack.linkedinTagline) {
      platforms.linkedin = [result.socialBioPack.linkedinTagline];
    }
  }

  return {
    description,
    sections: sections.length > 0 ? sections : undefined,
    taglines: taglines.length > 0 ? taglines : undefined,
    faqs: faqs.length > 0 ? faqs : undefined,
    metaDescription: result.metaDescription || undefined,
    platforms: Object.keys(platforms).length > 0 ? platforms : undefined,
  };
}

