import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  LocalSEOPageBuilderRequest,
  LocalSEOPageBuilderResponse,
  OutputFormat,
} from "@/app/apps/local-seo-page-builder/types";

const isDev = process.env.NODE_ENV !== "production";

function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `lseo-${timestamp}-${random}`;
}

function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra || {}),
    },
    { status }
  );
}

// Helper functions
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeState(state: string): { display: string; slug: string } {
  const stateLower = state.trim().toLowerCase();
  const stateMap: Record<string, { display: string; slug: string }> = {
    alabama: { display: "Alabama", slug: "al" },
    alaska: { display: "Alaska", slug: "ak" },
    arizona: { display: "Arizona", slug: "az" },
    arkansas: { display: "Arkansas", slug: "ar" },
    california: { display: "California", slug: "ca" },
    colorado: { display: "Colorado", slug: "co" },
    connecticut: { display: "Connecticut", slug: "ct" },
    delaware: { display: "Delaware", slug: "de" },
    florida: { display: "Florida", slug: "fl" },
    georgia: { display: "Georgia", slug: "ga" },
    hawaii: { display: "Hawaii", slug: "hi" },
    idaho: { display: "Idaho", slug: "id" },
    illinois: { display: "Illinois", slug: "il" },
    indiana: { display: "Indiana", slug: "in" },
    iowa: { display: "Iowa", slug: "ia" },
    kansas: { display: "Kansas", slug: "ks" },
    kentucky: { display: "Kentucky", slug: "ky" },
    louisiana: { display: "Louisiana", slug: "la" },
    maine: { display: "Maine", slug: "me" },
    maryland: { display: "Maryland", slug: "md" },
    massachusetts: { display: "Massachusetts", slug: "ma" },
    michigan: { display: "Michigan", slug: "mi" },
    minnesota: { display: "Minnesota", slug: "mn" },
    mississippi: { display: "Mississippi", slug: "ms" },
    missouri: { display: "Missouri", slug: "mo" },
    montana: { display: "Montana", slug: "mt" },
    nebraska: { display: "Nebraska", slug: "ne" },
    nevada: { display: "Nevada", slug: "nv" },
    "new hampshire": { display: "New Hampshire", slug: "nh" },
    "new jersey": { display: "New Jersey", slug: "nj" },
    "new mexico": { display: "New Mexico", slug: "nm" },
    "new york": { display: "New York", slug: "ny" },
    "north carolina": { display: "North Carolina", slug: "nc" },
    "north dakota": { display: "North Dakota", slug: "nd" },
    ohio: { display: "Ohio", slug: "oh" },
    oklahoma: { display: "Oklahoma", slug: "ok" },
    oregon: { display: "Oregon", slug: "or" },
    pennsylvania: { display: "Pennsylvania", slug: "pa" },
    "rhode island": { display: "Rhode Island", slug: "ri" },
    "south carolina": { display: "South Carolina", slug: "sc" },
    "south dakota": { display: "South Dakota", slug: "sd" },
    tennessee: { display: "Tennessee", slug: "tn" },
    texas: { display: "Texas", slug: "tx" },
    utah: { display: "Utah", slug: "ut" },
    vermont: { display: "Vermont", slug: "vt" },
    virginia: { display: "Virginia", slug: "va" },
    washington: { display: "Washington", slug: "wa" },
    "west virginia": { display: "West Virginia", slug: "wv" },
    wisconsin: { display: "Wisconsin", slug: "wi" },
    wyoming: { display: "Wyoming", slug: "wy" },
  };

  const normalized = stateMap[stateLower];
  if (normalized) {
    return normalized;
  }

  // Fallback: try to match by abbreviation
  if (stateLower.length === 2) {
    const found = Object.values(stateMap).find((s) => s.slug === stateLower);
    if (found) {
      return found;
    }
  }

  // Final fallback: use slugified version of input
  return {
    display: state.trim(),
    slug: slugify(state),
  };
}

function smartTrimMetaTitle(title: string, max = 60): { value: string; trimmed: boolean } {
  if (title.length <= max) {
    return { value: title, trimmed: false };
  }

  // Try to trim at word boundary
  let trimmed = title.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > max * 0.7) {
    trimmed = trimmed.slice(0, lastSpace);
  } else {
    trimmed = trimmed.slice(0, max - 3) + "...";
  }

  return { value: trimmed, trimmed: true };
}

function smartTrimMetaDescription(desc: string, max = 160): { value: string; trimmed: boolean } {
  if (desc.length <= max) {
    return { value: desc, trimmed: false };
  }

  // Try to trim at sentence or word boundary
  let trimmed = desc.slice(0, max);
  const lastPeriod = trimmed.lastIndexOf(".");
  const lastSpace = trimmed.lastIndexOf(" ");

  if (lastPeriod > max * 0.7) {
    trimmed = trimmed.slice(0, lastPeriod + 1);
  } else if (lastSpace > max * 0.7) {
    trimmed = trimmed.slice(0, lastSpace);
  } else {
    trimmed = trimmed.slice(0, max - 3) + "...";
  }

  return { value: trimmed, trimmed: true };
}

// Render page copy in different formats
function renderPageCopy(
  format: OutputFormat,
  data: {
    businessName: string;
    businessType: string;
    primaryService: string;
    city: string;
    state: string;
    secondaryServices?: string[];
    neighborhoods?: string[];
    targetAudience?: "Residential" | "Commercial" | "Both";
    uniqueSellingPoints?: string;
    ctaPreference?: string;
  }
): string {
  const {
    businessName,
    businessType,
    primaryService,
    city,
    state,
    secondaryServices,
    neighborhoods,
    targetAudience,
    uniqueSellingPoints,
    ctaPreference,
  } = data;

  if (format === "HTML") {
    let html = `<h1>${primaryService} in ${city}, ${state}</h1>\n`;
    html += `<p>${businessName} is your trusted ${businessType} specializing in ${primaryService.toLowerCase()} services throughout ${city}, ${state}. `;

    if (targetAudience === "Residential") {
      html += `We serve homeowners and residents with professional, reliable service. `;
    } else if (targetAudience === "Commercial") {
      html += `We serve businesses and commercial properties with professional, reliable service. `;
    } else {
      html += `We serve both residential and commercial customers with professional, reliable service. `;
    }

    if (neighborhoods && neighborhoods.length > 0) {
      html += `Our service area includes ${neighborhoods.join(", ")} and surrounding areas. `;
    }

    html += `</p>\n\n`;

    html += `<h2>Our ${primaryService} Services</h2>\n`;
    html += `<p>At ${businessName}, we provide comprehensive ${primaryService.toLowerCase()} solutions tailored to your needs. `;

    if (secondaryServices && secondaryServices.length > 0) {
      html += `In addition to ${primaryService.toLowerCase()}, we also offer:</p>\n<ul>\n`;
      secondaryServices.forEach((service) => {
        html += `  <li>${service}</li>\n`;
      });
      html += `</ul>\n`;
    } else {
      html += `Our team brings years of experience and local knowledge to every project.</p>\n`;
    }

    html += `\n<h2>Why Choose ${businessName}?</h2>\n`;

    if (uniqueSellingPoints && uniqueSellingPoints.trim()) {
      html += `<p>${uniqueSellingPoints}</p>\n`;
    } else {
      html += `<p>When you choose ${businessName} for your ${primaryService.toLowerCase()} needs in ${city}, you're choosing:</p>\n<ul>\n`;
      html += `  <li><strong>Local Expertise</strong>: We understand the unique needs of ${city} residents and businesses</li>\n`;
      html += `  <li><strong>Professional Service</strong>: Our team is trained, licensed, and insured</li>\n`;
      html += `  <li><strong>Quality Results</strong>: We stand behind our work with a commitment to excellence</li>\n`;
      html += `  <li><strong>Customer Focus</strong>: Your satisfaction is our top priority</li>\n`;
      html += `</ul>\n`;
    }

    html += `\n<h2>Serving ${city}, ${state}</h2>\n`;
    html += `<p>${businessName} proudly serves ${city}, ${state} and the surrounding communities. `;
    if (neighborhoods && neighborhoods.length > 0) {
      html += `We regularly work in ${neighborhoods.join(", ")} and nearby areas. `;
    }
    html += `Whether you're a homeowner or business owner, we're here to help with all your ${primaryService.toLowerCase()} needs.</p>\n`;

    const cta = ctaPreference && ctaPreference.trim() ? ctaPreference : "Contact us today";

    html += `\n<h2>${cta}</h2>\n`;
    html += `<p>Ready to get started with professional ${primaryService.toLowerCase()} services in ${city}? `;
    html += `${businessName} is here to help. ${cta} to schedule your service or request a free quote. We look forward to serving you!</p>`;

    return html;
  }

  if (format === "WordPress") {
    let wp = `${primaryService} in ${city}, ${state}\n\n`;
    wp += `${businessName} is your trusted ${businessType} specializing in ${primaryService.toLowerCase()} services throughout ${city}, ${state}. `;

    if (targetAudience === "Residential") {
      wp += `We serve homeowners and residents with professional, reliable service. `;
    } else if (targetAudience === "Commercial") {
      wp += `We serve businesses and commercial properties with professional, reliable service. `;
    } else {
      wp += `We serve both residential and commercial customers with professional, reliable service. `;
    }

    if (neighborhoods && neighborhoods.length > 0) {
      wp += `Our service area includes ${neighborhoods.join(", ")} and surrounding areas. `;
    }

    wp += `\n\n`;

    wp += `Our ${primaryService} Services\n\n`;
    wp += `At ${businessName}, we provide comprehensive ${primaryService.toLowerCase()} solutions tailored to your needs. `;

    if (secondaryServices && secondaryServices.length > 0) {
      wp += `In addition to ${primaryService.toLowerCase()}, we also offer:\n\n`;
      secondaryServices.forEach((service) => {
        wp += `• ${service}\n`;
      });
      wp += `\n`;
    } else {
      wp += `Our team brings years of experience and local knowledge to every project.\n\n`;
    }

    wp += `Why Choose ${businessName}?\n\n`;

    if (uniqueSellingPoints && uniqueSellingPoints.trim()) {
      wp += `${uniqueSellingPoints}\n\n`;
    } else {
      wp += `When you choose ${businessName} for your ${primaryService.toLowerCase()} needs in ${city}, you're choosing:\n\n`;
      wp += `• Local Expertise: We understand the unique needs of ${city} residents and businesses\n`;
      wp += `• Professional Service: Our team is trained, licensed, and insured\n`;
      wp += `• Quality Results: We stand behind our work with a commitment to excellence\n`;
      wp += `• Customer Focus: Your satisfaction is our top priority\n\n`;
    }

    wp += `Serving ${city}, ${state}\n\n`;
    wp += `${businessName} proudly serves ${city}, ${state} and the surrounding communities. `;
    if (neighborhoods && neighborhoods.length > 0) {
      wp += `We regularly work in ${neighborhoods.join(", ")} and nearby areas. `;
    }
    wp += `Whether you're a homeowner or business owner, we're here to help with all your ${primaryService.toLowerCase()} needs.\n\n`;

    const cta = ctaPreference && ctaPreference.trim() ? ctaPreference : "Contact us today";

    wp += `${cta}\n\n`;
    wp += `Ready to get started with professional ${primaryService.toLowerCase()} services in ${city}? `;
    wp += `${businessName} is here to help. ${cta} to schedule your service or request a free quote. We look forward to serving you!`;

    return wp;
  }

  // PlainText (default)
  let text = `${primaryService} in ${city}, ${state}\n`;
  text += "=".repeat(50) + "\n\n";
  text += `${businessName} is your trusted ${businessType} specializing in ${primaryService.toLowerCase()} services throughout ${city}, ${state}. `;

  if (targetAudience === "Residential") {
    text += `We serve homeowners and residents with professional, reliable service. `;
  } else if (targetAudience === "Commercial") {
    text += `We serve businesses and commercial properties with professional, reliable service. `;
  } else {
    text += `We serve both residential and commercial customers with professional, reliable service. `;
  }

  if (neighborhoods && neighborhoods.length > 0) {
    text += `Our service area includes ${neighborhoods.join(", ")} and surrounding areas. `;
  }

  text += `\n\n`;

  text += `Our ${primaryService} Services\n`;
  text += "-".repeat(50) + "\n";
  text += `At ${businessName}, we provide comprehensive ${primaryService.toLowerCase()} solutions tailored to your needs. `;

  if (secondaryServices && secondaryServices.length > 0) {
    text += `In addition to ${primaryService.toLowerCase()}, we also offer:\n\n`;
    secondaryServices.forEach((service) => {
      text += `- ${service}\n`;
    });
    text += `\n`;
  } else {
    text += `Our team brings years of experience and local knowledge to every project.\n\n`;
  }

  text += `Why Choose ${businessName}?\n`;
  text += "-".repeat(50) + "\n";

  if (uniqueSellingPoints && uniqueSellingPoints.trim()) {
    text += `${uniqueSellingPoints}\n\n`;
  } else {
    text += `When you choose ${businessName} for your ${primaryService.toLowerCase()} needs in ${city}, you're choosing:\n\n`;
    text += `- Local Expertise: We understand the unique needs of ${city} residents and businesses\n`;
    text += `- Professional Service: Our team is trained, licensed, and insured\n`;
    text += `- Quality Results: We stand behind our work with a commitment to excellence\n`;
    text += `- Customer Focus: Your satisfaction is our top priority\n\n`;
  }

  text += `Serving ${city}, ${state}\n`;
  text += "-".repeat(50) + "\n";
  text += `${businessName} proudly serves ${city}, ${state} and the surrounding communities. `;
  if (neighborhoods && neighborhoods.length > 0) {
    text += `We regularly work in ${neighborhoods.join(", ")} and nearby areas. `;
  }
  text += `Whether you're a homeowner or business owner, we're here to help with all your ${primaryService.toLowerCase()} needs.\n\n`;

  const cta = ctaPreference && ctaPreference.trim() ? ctaPreference : "Contact us today";

  text += `${cta}\n`;
  text += "-".repeat(50) + "\n";
  text += `Ready to get started with professional ${primaryService.toLowerCase()} services in ${city}? `;
  text += `${businessName} is here to help. ${cta} to schedule your service or request a free quote. We look forward to serving you!`;

  return text;
}

// Render FAQs in different formats
function renderFAQs(format: OutputFormat, faqs: Array<{ question: string; answer: string }>): string {
  if (format === "HTML") {
    let html = `<h2>Frequently Asked Questions</h2>\n`;
    faqs.forEach((faq) => {
      html += `<h3>${faq.question}</h3>\n`;
      html += `<p>${faq.answer}</p>\n\n`;
    });
    return html;
  }

  if (format === "WordPress") {
    let wp = `Frequently Asked Questions\n\n`;
    faqs.forEach((faq) => {
      wp += `${faq.question}\n\n`;
      wp += `${faq.answer}\n\n`;
    });
    return wp;
  }

  // PlainText
  let text = `Frequently Asked Questions\n`;
  text += "=".repeat(50) + "\n\n";
  faqs.forEach((faq, i) => {
    text += `Q${i + 1}: ${faq.question}\n`;
    text += `A${i + 1}: ${faq.answer}\n\n`;
  });
  return text;
}

// Generate SEO pack with smart trimming
function generateSEOPack(
  primaryService: string,
  city: string,
  state: string,
  businessName: string,
  warnings: string[]
): { seoPack: { metaTitle: string; metaDescription: string; slug: string; h1: string }; warnings: string[] } {
  const stateNormalized = normalizeState(state);
  const h1 = `${primaryService} in ${city}, ${stateNormalized.display}`;
  const metaTitleRaw = `${primaryService} in ${city}, ${stateNormalized.display} | ${businessName}`;
  const metaTitleResult = smartTrimMetaTitle(metaTitleRaw, 60);
  if (metaTitleResult.trimmed) {
    warnings.push(`Meta title was trimmed from ${metaTitleRaw.length} to ${metaTitleResult.value.length} characters`);
  }

  const metaDescriptionRaw = `Looking for ${primaryService.toLowerCase()} in ${city}, ${stateNormalized.display}? ${businessName} delivers professional service with local expertise. ${primaryService} services you can trust. Contact us today!`;
  const metaDescriptionResult = smartTrimMetaDescription(metaDescriptionRaw, 160);
  if (metaDescriptionResult.trimmed) {
    warnings.push(`Meta description was trimmed from ${metaDescriptionRaw.length} to ${metaDescriptionResult.value.length} characters`);
  }

  const slug = `${slugify(primaryService)}-${slugify(city)}-${stateNormalized.slug}`;

  return {
    seoPack: {
      metaTitle: metaTitleResult.value,
      metaDescription: metaDescriptionResult.value,
      slug,
      h1,
    },
    warnings,
  };
}

// Generate exactly 6 FAQs
function generateFAQs(
  primaryService: string,
  city: string,
  state: string,
  businessName: string,
  businessType: string
): Array<{ question: string; answer: string }> {
  return [
    {
      question: `What ${primaryService.toLowerCase()} services do you offer in ${city}?`,
      answer: `${businessName} provides comprehensive ${primaryService.toLowerCase()} services throughout ${city}, ${state}. We specialize in ${primaryService.toLowerCase()} and are equipped to handle projects of all sizes for both residential and commercial customers.`,
    },
    {
      question: `How quickly can you provide ${primaryService.toLowerCase()} service in ${city}?`,
      answer: `We understand that timing matters. Contact ${businessName} to discuss your timeline and schedule. We work to accommodate your needs while ensuring quality service.`,
    },
    {
      question: `Do you serve both residential and commercial customers in ${city}?`,
      answer: `Yes, ${businessName} serves both residential and commercial customers throughout ${city}, ${state}. Our team has experience working with homeowners, property managers, and business owners.`,
    },
    {
      question: `What areas in ${city} do you cover?`,
      answer: `${businessName} serves ${city}, ${state} and the surrounding communities. We're committed to providing reliable ${primaryService.toLowerCase()} services throughout the area. Contact us to confirm service availability for your specific location.`,
    },
    {
      question: `How do I get a quote for ${primaryService.toLowerCase()} services?`,
      answer: `Getting a quote is easy. Contact ${businessName} and we'll discuss your ${primaryService.toLowerCase()} needs, provide information about our services, and give you a detailed estimate. We're happy to answer any questions you may have.`,
    },
    {
      question: `What makes ${businessName} different from other ${businessType.toLowerCase()} companies in ${city}?`,
      answer: `${businessName} combines local expertise with professional service. We're committed to quality work, customer satisfaction, and building lasting relationships with our ${city} customers. Our team brings experience and attention to detail to every project.`,
    },
  ];
}

// Generate schema bundle
function generateSchemaBundle(
  pageUrl: string,
  businessName: string,
  primaryService: string,
  city: string,
  state: string,
  metaDescription: string,
  faqs: Array<{ question: string; answer: string }>
): string {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: `${primaryService} in ${city}, ${state} | ${businessName}`,
        description: metaDescription,
        inLanguage: "en-US",
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faqpage`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return JSON.stringify(schema, null, 2);
}

// Zod validation schema with array constraints
const localSEOPageBuilderRequestSchema: z.ZodType<LocalSEOPageBuilderRequest> = z.object({
  businessName: z.string().min(1, "Business name is required"),
  businessType: z.string().min(1, "Business type is required"),
  primaryService: z.string().min(1, "Primary service is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  secondaryServices: z
    .array(z.string().max(40, "Each service must be 40 characters or less"))
    .max(12, "Maximum 12 secondary services allowed")
    .optional()
    .transform((arr) => {
      if (!arr) return undefined;
      return Array.from(new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0))).slice(0, 12);
    }),
  neighborhoods: z
    .array(z.string().max(40, "Each neighborhood must be 40 characters or less"))
    .max(12, "Maximum 12 neighborhoods allowed")
    .optional()
    .transform((arr) => {
      if (!arr) return undefined;
      return Array.from(new Set(arr.map((n) => n.trim()).filter((n) => n.length > 0))).slice(0, 12);
    }),
  targetAudience: z.enum(["Residential", "Commercial", "Both"]).optional(),
  uniqueSellingPoints: z.string().optional(),
  ctaPreference: z.string().optional(),
  phone: z.string().optional(),
  websiteUrl: z.union([z.string().url("Please enter a valid URL"), z.literal("")]).optional(),
  pageUrl: z.union([z.string().url("Please enter a valid URL"), z.literal("")]).optional(),
  outputFormat: z.enum(["PlainText", "WordPress", "HTML"]).optional().default("PlainText"),
  includeSchema: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse(
        "Authentication required. Please log in to use this tool.",
        401,
        { requestId }
      );
    }

    const json = await req.json().catch(() => null);
    if (!json) {
      return errorResponse("Invalid JSON body.", 400, { requestId });
    }

    // Validate input
    const parsed = localSEOPageBuilderRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse("Please fix the form errors.", 400, {
        issues: parsed.error.format(),
        requestId,
      });
    }

    const formValues = parsed.data;
    const warnings: string[] = [];

    // Generate SEO Pack with warnings
    const { seoPack, warnings: seoWarnings } = generateSEOPack(
      formValues.primaryService,
      formValues.city,
      formValues.state,
      formValues.businessName,
      warnings
    );
    warnings.push(...seoWarnings);

    // Generate FAQs
    const faqs = generateFAQs(
      formValues.primaryService,
      formValues.city,
      formValues.state,
      formValues.businessName,
      formValues.businessType
    );

    // Render page copy in chosen format
    const pageCopy = renderPageCopy(formValues.outputFormat || "PlainText", {
      businessName: formValues.businessName,
      businessType: formValues.businessType,
      primaryService: formValues.primaryService,
      city: formValues.city,
      state: formValues.state,
      secondaryServices: formValues.secondaryServices,
      neighborhoods: formValues.neighborhoods,
      targetAudience: formValues.targetAudience,
      uniqueSellingPoints: formValues.uniqueSellingPoints,
      ctaPreference: formValues.ctaPreference,
    });

    // Generate Schema if enabled and pageUrl exists
    let schemaJsonLd: string | undefined;
    if (formValues.includeSchema) {
      if (formValues.pageUrl && formValues.pageUrl.trim()) {
        schemaJsonLd = generateSchemaBundle(
          formValues.pageUrl,
          formValues.businessName,
          formValues.primaryService,
          formValues.city,
          formValues.state,
          seoPack.metaDescription,
          faqs
        );
      } else {
        warnings.push("Schema generation was requested but pageUrl is missing. Schema not generated.");
      }
    }

    const result: LocalSEOPageBuilderResponse = {
      seoPack,
      pageCopy,
      faqs,
      ...(schemaJsonLd ? { schemaJsonLd } : {}),
      meta: {
        requestId,
        createdAtISO: new Date().toISOString(),
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return NextResponse.json(
      {
        ok: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Local SEO Page Builder error:", err);

    return errorResponse(
      `Something went wrong while generating your SEO page content.${isDev ? ` (Request ID: ${requestId})` : ""}`,
      500,
      {
        requestId,
        ...(isDev
          ? {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            }
          : {}),
      }
    );
  }
}
