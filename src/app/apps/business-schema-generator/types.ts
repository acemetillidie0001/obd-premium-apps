export interface SchemaGeneratorRequest {
  // Required
  businessName: string;
  businessType: string; // LocalBusiness subtype or "LocalBusiness"
  
  // Optional
  services?: string[]; // array of service strings
  streetAddress?: string;
  city?: string; // default "Ocala"
  state?: string; // default "Florida"
  postalCode?: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  socialLinks?: {
    facebookUrl?: string;
    instagramUrl?: string;
    xUrl?: string;
    linkedinUrl?: string;
  };
  hours?: {
    monday?: string; // e.g., "9:00 AM - 5:00 PM"
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  
  // Toggles
  includeFaqSchema?: boolean;
  includeWebPageSchema?: boolean;
  
  // FAQ fields
  faqs?: { question: string; answer: string }[];
  faqTemplateMode?: "none" | "basic";
  
  // WebPage fields
  pageUrl?: string;
  pageTitle?: string;
  pageDescription?: string;
  pageType?: "Homepage" | "ServicePage" | "LocationPage" | "About" | "Contact" | "Other";
}

export interface SchemaGeneratorResponse {
  ok: boolean;
  data?: {
    localBusinessJsonLd: string; // Pretty-printed JSON-LD string (2-space indent)
    faqJsonLd?: string;
    webPageJsonLd?: string;
    combinedJsonLd: string; // Combined bundle with @graph
    meta: {
      requestId: string;
      createdAtISO: string;
      schemaTypes: string[];
    };
  };
  error?: string;
  requestId?: string;
}

