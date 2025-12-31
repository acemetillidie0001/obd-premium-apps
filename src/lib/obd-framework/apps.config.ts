/**
 * OBD Premium Apps Registry
 * 
 * Central configuration for all OBD Premium apps, including their categories,
 * statuses, and routing information.
 */

export type AppCategory = "content" | "reputation" | "google" | "seo" | "productivity" | "branding";

export type AppStatus = "live" | "in-progress" | "coming-soon";

export interface ObdAppDefinition {
  id: string;             // machine id / slug, e.g. "review-responder"
  name: string;           // display name, e.g. "AI Review Responder"
  description: string;    // short one-line description
  href?: string;          // link to the app route if live/in-progress
  category: AppCategory;
  status: AppStatus;
  ctaLabel?: string;      // button label, e.g. "Open Tool", "Start Writing"
  badgeLabel?: string;    // optional label like "In Development" or "Coming Soon"
  appRequirements?: string; // optional requirements/availability info for coming soon apps
  showRibbon?: boolean;   // optional luxury ribbon display
  ribbonText?: string;    // optional ribbon text
  icon?: string;          // icon key for Lucide icon mapping
}

/**
 * Validates that premium apps (live/in-progress) use /apps/* namespace for auth protection
 * 
 * Safety: Only throws in development. In production, logs warnings to prevent runtime crashes.
 */
function validateAppRoutes(apps: ObdAppDefinition[]): void {
  // Only validate in browser runtime (client-side), not during build/server-side
  // This prevents build failures while still catching issues in development
  if (typeof window === "undefined") {
    return;
  }
  
  const isDev = process.env.NODE_ENV !== "production";
  const isPremiumStatus = (status: AppStatus) => status === "live" || status === "in-progress";
  
  for (const app of apps) {
    if (isPremiumStatus(app.status) && app.href) {
      if (!app.href.startsWith("/apps/")) {
        // Include app id and href in message for debugging
        const message = `[apps.config.ts] Premium app "${app.id}" (${app.status}) has href "${app.href}" but should start with "/apps/" for auth protection.`;
        if (isDev) {
          throw new Error(message);
        } else {
          // Production: warn only, never throw (prevents runtime crashes)
          console.warn(`[ROUTE VALIDATION] ${message}`);
        }
      }
    }
  }
}

export const OBD_APPS: ObdAppDefinition[] = [
  // CATEGORY: "content"
  {
    id: "review-responder",
    name: "AI Review Responder",
    description: "Generate polished, professional responses to customer reviews in seconds.",
    href: "/apps/review-responder",
    category: "content",
    status: "live",
    ctaLabel: "Write a Reply",
    icon: "message-square",
  },
  {
    id: "business-description-writer",
    name: "AI Business Description Writer",
    description: "Create compelling, long and short business descriptions tailored to Ocala customers.",
    href: "/apps/business-description-writer",
    category: "content",
    status: "live",
    ctaLabel: "Create Description",
    icon: "file-text",
  },
  {
    id: "social-media-post-creator",
    name: "AI Social Media Post Creator",
    description: "Generate engaging posts for Facebook, Instagram, X, and Google Business.",
    href: "/apps/social-media-post-creator",
    category: "content",
    status: "live",
    ctaLabel: "Create Posts",
    icon: "megaphone",
  },
  {
    id: "faq-generator",
    name: "AI FAQ Generator",
    description: "Create helpful FAQ sections for your website, with SEO-friendly answers.",
    href: "/apps/faq-generator",
    category: "content",
    status: "live",
    ctaLabel: "Generate FAQs",
    icon: "help-circle",
  },
  {
    id: "content-writer",
    name: "AI Content Writer",
    description: "Plan and write blogs, service pages, and marketing content for your Ocala business.",
    href: "/apps/content-writer",
    category: "content",
    status: "live",
    ctaLabel: "Start Writing",
    icon: "pencil-line",
  },
  {
    id: "image-caption-generator",
    name: "AI Image Caption Generator",
    description: "Turn your business photos into scroll-stopping, on-brand captions.",
    href: "/apps/image-caption-generator",
    category: "content",
    status: "live",
    ctaLabel: "Write Captions",
    icon: "image",
  },
  {
    id: "offers-builder",
    name: "Offers & Promotions Builder",
    description: "Generate complete promotional offers with headlines, social posts, and GBP updates.",
    href: "/apps/offers-builder",
    category: "content",
    status: "live",
    ctaLabel: "Create Promo",
    icon: "tag",
  },
  {
    id: "event-campaign-builder",
    name: "Event Campaign Builder",
    description: "Turn your event details into a full multi-channel promo campaign for Ocala.",
    href: "/apps/event-campaign-builder",
    category: "content",
    status: "live",
    ctaLabel: "Create Campaign",
    icon: "calendar-plus",
  },
  {
    id: "local-hiring-assistant",
    name: "Local Hiring Assistant",
    description: "Build clear job descriptions, social hiring posts, and interview questions for your next local hire.",
    href: "/apps/local-hiring-assistant",
    category: "content",
    status: "live",
    ctaLabel: "Open Tool",
    icon: "users",
  },
  
  // CATEGORY: "reputation"
  {
    id: "reputation-dashboard",
    name: "Reputation Dashboard",
    description: "See all your reviews, trends, and sentiment in one place.",
    href: "/apps/reputation-dashboard",
    category: "reputation",
    status: "live",
    ctaLabel: "Open Dashboard",
    icon: "shield-check",
  },
  {
    id: "review-request-automation",
    name: "Review Request Automation",
    description: "Send automatic review requests by email or SMS after each visit.",
    href: "/apps/review-request-automation",
    category: "reputation",
    status: "live",
    ctaLabel: "Open Tool",
    icon: "send",
  },
  
  // CATEGORY: "google"
  {
    id: "google-business-profile-pro",
    name: "Google Business Profile Pro",
    description: "Audit, optimize, and rebuild your Google Business Profile for maximum local visibility.",
    href: "/apps/google-business-pro",
    category: "google",
    status: "live",
    ctaLabel: "Open Tool",
    icon: "map-pin",
  },
  {
    id: "local-keyword-research",
    name: "Local Keyword Research Tool",
    description: "Discover what Ocala customers actually search for before they find you.",
    href: "/apps/local-keyword-research",
    category: "google",
    status: "live",
    ctaLabel: "Open Tool",
    icon: "search",
  },
  
  // CATEGORY: "seo"
  {
    id: "local-seo-page-builder",
    name: "Local SEO Page Builder",
    description: "Generate high-converting, search-optimized service pages for Ocala.",
    href: "/apps/local-seo-page-builder",
    category: "seo",
    status: "live",
    ctaLabel: "Build SEO Page",
    icon: "globe",
  },
  {
    id: "business-schema-generator",
    name: "Business Schema Generator",
    description: "Create JSON-LD schema for your local business, FAQs, and articles.",
    href: "/apps/business-schema-generator",
    category: "seo",
    status: "live",
    ctaLabel: "Generate Schema",
    icon: "code-2",
  },
  {
    id: "seo-audit-roadmap",
    name: "SEO Audit & Roadmap",
    description: "Audit a local page and get a prioritized SEO improvement plan with deterministic scoring.",
    category: "seo",
    status: "live",
    href: "/apps/seo-audit-roadmap",
    ctaLabel: "Run SEO Audit",
    icon: "bar-chart-3",
  },
  
  // CATEGORY: "productivity"
  {
    id: "social-auto-poster",
    name: "OBD Social Auto-Poster",
    description: "Schedule posts to Facebook, Instagram, Google Business, and more from one screen.",
    href: "/apps/social-auto-poster",
    category: "productivity",
    status: "live",
    ctaLabel: "Open Tool",
    icon: "share-2",
  },
  {
    id: "scheduler-booking",
    name: "OBD Scheduler & Booking",
    description: "Let customers book appointments online with synced calendars and reminders.",
    category: "productivity",
    status: "coming-soon",
    icon: "calendar-clock",
  },
  {
    id: "obd-crm",
    name: "OBD CRM",
    description: "Track customers, notes, and relationships in one place.",
    href: "/apps/obd-crm",
    category: "productivity",
    status: "live",
    ctaLabel: "Open CRM",
    icon: "contact",
  },
  {
    id: "ai-help-desk",
    name: "AI Help Desk",
    description: "Search your business knowledge base and get AI-powered answers to customer questions.",
    href: "/apps/ai-help-desk",
    category: "productivity",
    status: "live",
    ctaLabel: "Open Help Desk",
    icon: "help-circle",
  },
  
  // CATEGORY: "branding"
  {
    id: "ai-logo-generator",
    name: "AI Logo Generator",
    description: "Create professional logo concepts and designs tailored to your Ocala business.",
    href: "/apps/ai-logo-generator",
    category: "branding",
    status: "live",
    ctaLabel: "Generate Logos",
    icon: "sparkles",
  },
  {
    id: "brand-kit-builder",
    name: "Brand Kit Builder",
    description: "Lock in your colors, fonts, and voice so all your marketing stays on-brand.",
    href: "/apps/brand-kit-builder",
    category: "branding",
    status: "live",
    ctaLabel: "Build Brand Kit",
    icon: "palette",
  },
];

// Validate app routes on module load
validateAppRoutes(OBD_APPS);
