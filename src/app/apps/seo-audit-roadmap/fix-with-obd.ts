export type FixWithOBDToolId =
  | "local-seo-page-builder"
  | "business-schema-generator"
  | "content-writer"
  | "faq-generator";

export type FixWithOBDSuggestion = {
  id: FixWithOBDToolId;
  name: string;
  href: string; // internal route only (no params)
  description: string; // one-line explanation
};

export type FindingStatus = "pass" | "needs-improvement" | "missing";

export type Tier5SectionId =
  | "technical"
  | "on-page"
  | "local"
  | "content"
  | "trust"
  | "schema";

const TOOLS: Record<FixWithOBDToolId, Omit<FixWithOBDSuggestion, "description">> = {
  "local-seo-page-builder": {
    id: "local-seo-page-builder",
    name: "Local SEO Page Builder",
    href: "/apps/local-seo-page-builder",
  },
  "business-schema-generator": {
    id: "business-schema-generator",
    name: "Business Schema Generator",
    href: "/apps/business-schema-generator",
  },
  "content-writer": {
    id: "content-writer",
    name: "AI Content Writer",
    href: "/apps/content-writer",
  },
  "faq-generator": {
    id: "faq-generator",
    name: "AI FAQ Generator",
    href: "/apps/faq-generator",
  },
};

function isSchemaRelated(sectionId: Tier5SectionId, categoryKey: string) {
  if (sectionId === "schema") return true;
  const k = categoryKey.toLowerCase();
  return k.includes("schema") || k.includes("structured");
}

/**
 * Tier 5C (link-only): deterministic ecosystem routing.
 * - Links only (no handoffs / no payloads)
 * - Must be deterministic based on finding.category + finding.type (we use status as type)
 * - Returns 0–4 suggested tools
 */
export function getFixWithOBDSuggestions(args: {
  sectionId: Tier5SectionId;
  categoryKey: string;
  status: FindingStatus;
}): FixWithOBDSuggestion[] {
  const { sectionId, categoryKey, status } = args;

  // Good findings: don't suggest anything (keeps UI noise low and deterministic).
  if (status === "pass") return [];

  const suggestions: FixWithOBDSuggestion[] = [];

  const add = (id: FixWithOBDToolId, description: string) => {
    if (suggestions.some((s) => s.id === id)) return;
    suggestions.push({ ...TOOLS[id], description });
  };

  // Priority rule: schema-related -> Schema Generator first.
  if (isSchemaRelated(sectionId, categoryKey)) {
    add("business-schema-generator", "Generate or validate JSON-LD structured data.");
  }

  // Deterministic routing by category key (current deterministic audit categories).
  switch (categoryKey) {
    case "content-length":
      add("content-writer", "Draft a stronger service page section with better topical coverage.");
      add("faq-generator", "Add FAQ content to expand coverage and match search intent.");
      break;
    case "heading-structure":
    case "h1-tag":
      add("content-writer", "Rewrite headings and section structure for clarity and SEO.");
      break;
    case "title-tag":
    case "meta-description":
      add("content-writer", "Generate optimized title/meta copy aligned to your service + city.");
      break;
    case "local-keywords":
    case "internal-links":
      add("local-seo-page-builder", "Create a service-area landing page draft with local intent baked in.");
      break;
    case "conversion-signals":
      add("local-seo-page-builder", "Generate a conversion-focused page draft with strong CTAs.");
      add("content-writer", "Rewrite key sections to improve clarity and calls-to-action.");
      break;
    case "images-alt":
      add("content-writer", "Generate descriptive image alt text suggestions for accessibility and SEO.");
      break;
    case "mobile-friendly":
      // No direct OBD tool for technical viewport fixes yet (keep deterministic and honest).
      break;
    default:
      break;
  }

  // If still empty and schema wasn’t added, provide no suggestions (allowed 0).
  // Cap to 0–4 deterministically.
  const cap = status === "missing" ? 4 : 2;
  return suggestions.slice(0, cap);
}


