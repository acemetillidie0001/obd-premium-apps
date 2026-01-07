import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  SchemaGeneratorRequest,
  SchemaGeneratorResponse,
} from "@/app/apps/business-schema-generator/types";

const isDev = process.env.NODE_ENV !== "production";

// Zod schema for validation
const schemaGeneratorRequestSchema: z.ZodType<SchemaGeneratorRequest> = z.object({
  businessName: z.string().min(1, "Business name is required"),
  businessType: z.string().min(1, "Business type is required"),
  services: z.array(z.string()).optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  socialLinks: z.object({
    facebookUrl: z.string().url().optional().or(z.literal("")),
    instagramUrl: z.string().url().optional().or(z.literal("")),
    xUrl: z.string().url().optional().or(z.literal("")),
    linkedinUrl: z.string().url().optional().or(z.literal("")),
  }).optional(),
  hours: z.object({
    monday: z.string().optional(),
    tuesday: z.string().optional(),
    wednesday: z.string().optional(),
    thursday: z.string().optional(),
    friday: z.string().optional(),
    saturday: z.string().optional(),
    sunday: z.string().optional(),
  }).optional(),
  includeFaqSchema: z.boolean().optional(),
  includeWebPageSchema: z.boolean().optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  faqTemplateMode: z.enum(["none", "basic"]).optional(),
  pageUrl: z.string().url().optional().or(z.literal("")),
  pageTitle: z.string().optional(),
  pageDescription: z.string().optional(),
  pageType: z.enum(["Homepage", "ServicePage", "LocationPage", "About", "Contact", "Other"]).optional(),
}).refine((data) => {
  // If includeWebPageSchema is true, pageUrl is required
  if (data.includeWebPageSchema && !data.pageUrl?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Page URL is required when including WebPage schema",
  path: ["pageUrl"],
});

function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `sg-${timestamp}-${random}`;
}

function errorResponse(
  message: string,
  status = 400,
  requestId?: string,
  extra?: Record<string, unknown>
): NextResponse<SchemaGeneratorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      requestId: requestId || generateRequestId(),
      ...(extra || {}),
    },
    { status }
  );
}

// Convert hours object to openingHoursSpecification array
function buildOpeningHoursSpecification(
  hours?: SchemaGeneratorRequest["hours"]
): Array<{
  "@type": string;
  dayOfWeek: string;
  opens: string;
  closes: string;
} | null> {
  if (!hours) return [];

  const dayMap: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };

  const result: Array<{
    "@type": string;
    dayOfWeek: string;
    opens: string;
    closes: string;
  } | null> = [];

  for (const [key, dayName] of Object.entries(dayMap)) {
    const hoursStr = hours[key as keyof typeof hours];
    if (!hoursStr) {
      result.push(null);
      continue;
    }

    // Parse simple format like "9:00 AM - 5:00 PM"
    const match = hoursStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      const [, openH, openM, openPeriod, closeH, closeM, closePeriod] = match;
      const opens = `${openH.padStart(2, "0")}:${openM} ${openPeriod.toUpperCase()}`;
      const closes = `${closeH.padStart(2, "0")}:${closeM} ${closePeriod.toUpperCase()}`;
      
      result.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${dayName}`,
        opens,
        closes,
      });
    } else {
      // If format doesn't match, skip this day
      result.push(null);
    }
  }

  return result.filter((item): item is NonNullable<typeof item> => item !== null);
}

// Build LocalBusiness JSON-LD object
function buildLocalBusinessSchema(request: SchemaGeneratorRequest): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": request.businessType || "LocalBusiness",
    name: request.businessName,
  };

  // URL
  if (request.websiteUrl) {
    schema.url = request.websiteUrl;
  }

  // Telephone
  if (request.phone) {
    schema.telephone = request.phone;
  }

  // Address
  if (request.streetAddress || request.city || request.state || request.postalCode) {
    const address: Record<string, string> = {
      "@type": "PostalAddress",
    };
    if (request.streetAddress) address.streetAddress = request.streetAddress;
    if (request.city) address.addressLocality = request.city;
    if (request.state) address.addressRegion = request.state;
    if (request.postalCode) address.postalCode = request.postalCode;
    if (request.city && request.state) {
      address.addressCountry = "US"; // Default to US for Ocala businesses
    }
    schema.address = address;
  }

  // Services
  if (request.services && request.services.length > 0) {
    schema.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: request.services.map((service, index) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service,
        },
        position: index + 1,
      })),
    };
  }

  // Opening hours
  const openingHours = buildOpeningHoursSpecification(request.hours);
  if (openingHours.length > 0) {
    schema.openingHoursSpecification = openingHours;
  }

  // Social links (sameAs)
  const sameAs: string[] = [];
  if (request.socialLinks?.facebookUrl?.trim()) sameAs.push(request.socialLinks.facebookUrl.trim());
  if (request.socialLinks?.instagramUrl?.trim()) sameAs.push(request.socialLinks.instagramUrl.trim());
  if (request.socialLinks?.xUrl?.trim()) sameAs.push(request.socialLinks.xUrl.trim());
  if (request.socialLinks?.linkedinUrl?.trim()) sameAs.push(request.socialLinks.linkedinUrl.trim());
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}

// Build FAQPage JSON-LD object
function buildFAQPageSchema(faqs: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// Build WebPage JSON-LD object
function buildWebPageSchema(
  request: SchemaGeneratorRequest
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: request.pageUrl,
  };

  if (request.pageTitle) {
    schema.name = request.pageTitle;
  } else if (request.businessName && request.pageType) {
    schema.name = `${request.businessName} - ${request.pageType}`;
  }

  if (request.pageDescription) {
    schema.description = request.pageDescription;
  }

  if (request.websiteUrl) {
    schema.isPartOf = {
      "@type": "WebSite",
      url: request.websiteUrl,
    };
  }

  return schema;
}

export async function POST(req: Request) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(req as any);
  if (demoBlock) return demoBlock;

  const requestId = generateRequestId();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse(
        "Authentication required",
        401,
        requestId
      );
    }

    const json = await req.json().catch(() => null);
    if (!json) {
      return errorResponse("Invalid JSON body.", 400, requestId);
    }

    // Validate input
    const parsed = schemaGeneratorRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse("Please fix the form errors.", 400, requestId, {
        issues: parsed.error.format(),
      });
    }

    const request = parsed.data;

    // Normalize defaults
    const normalizedRequest: SchemaGeneratorRequest = {
      ...request,
      city: request.city || "Ocala",
      state: request.state || "Florida",
    };

    // Build LocalBusiness schema (always included)
    const localBusinessSchema = buildLocalBusinessSchema(normalizedRequest);
    const localBusinessJsonLd = JSON.stringify(localBusinessSchema, null, 2);

    // Build FAQPage schema (if enabled and FAQs exist)
    let faqSchema: Record<string, unknown> | null = null;
    let faqJsonLd: string | undefined = undefined;
    if (normalizedRequest.includeFaqSchema && normalizedRequest.faqs && normalizedRequest.faqs.length > 0) {
      // Filter out empty FAQs
      const validFAQs = normalizedRequest.faqs.filter(
        (faq) => faq.question.trim() && faq.answer.trim()
      );
      if (validFAQs.length > 0) {
        faqSchema = buildFAQPageSchema(validFAQs);
        faqJsonLd = JSON.stringify(faqSchema, null, 2);
      }
    }

    // Build WebPage schema (if enabled)
    let webPageSchema: Record<string, unknown> | null = null;
    let webPageJsonLd: string | undefined = undefined;
    if (normalizedRequest.includeWebPageSchema && normalizedRequest.pageUrl) {
      webPageSchema = buildWebPageSchema(normalizedRequest);
      webPageJsonLd = JSON.stringify(webPageSchema, null, 2);
    }

    // Build combined bundle with @graph
    const graphArray: Record<string, unknown>[] = [localBusinessSchema];
    if (faqSchema) graphArray.push(faqSchema);
    if (webPageSchema) graphArray.push(webPageSchema);

    const combinedSchema = {
      "@context": "https://schema.org",
      "@graph": graphArray,
    };
    const combinedJsonLd = JSON.stringify(combinedSchema, null, 2);

    // Build schema types array for meta
    const schemaTypes: string[] = ["LocalBusiness"];
    if (faqSchema) schemaTypes.push("FAQPage");
    if (webPageSchema) schemaTypes.push("WebPage");

    // Build response
    const response: SchemaGeneratorResponse = {
      ok: true,
      data: {
        localBusinessJsonLd,
        ...(faqJsonLd ? { faqJsonLd } : {}),
        ...(webPageJsonLd ? { webPageJsonLd } : {}),
        combinedJsonLd,
        meta: {
          requestId,
          createdAtISO: new Date().toISOString(),
          schemaTypes,
        },
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    console.error("Schema Generator error:", err);

    return errorResponse(
      `Something went wrong while generating your schema.${isDev ? ` (Request ID: ${requestId})` : ""}`,
      500,
      requestId,
      isDev
        ? {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          }
        : undefined
    );
  }
}

