export type TargetAudience = "Residential" | "Commercial" | "Both";

export type OutputFormat = "PlainText" | "WordPress" | "HTML";

export interface LocalSEOPageBuilderRequest {
  businessName: string;
  businessType: string;
  primaryService: string;
  city: string;
  state: string;
  secondaryServices?: string[];
  neighborhoods?: string[];
  targetAudience?: TargetAudience;
  uniqueSellingPoints?: string;
  ctaPreference?: string;
  phone?: string;
  websiteUrl?: string;
  pageUrl?: string;
  outputFormat?: OutputFormat;
  includeSchema?: boolean;
}

export interface SEOPack {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  h1: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface LocalSEOPageBuilderResponse {
  seoPack: SEOPack;
  pageCopy: string;
  faqs: FAQItem[];
  schemaJsonLd?: string;
  meta: {
    requestId: string;
    createdAtISO: string;
  };
  warnings?: string[];
}
