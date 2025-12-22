/**
 * OBD Premium Apps Preview Text Configuration
 * 
 * Provides detailed preview/hover overlay text for dashboard app tiles.
 * These previews appear on hover or in expanded views to give users
 * a better understanding of what each app does.
 */

export const appPreviews: Record<string, string> = {
  "review-responder":
    "Generate polished, professional responses to customer reviews in seconds. Match your brand voice, handle negative feedback gracefully, and thank happy customers—all with AI assistance that keeps your responses authentic and on-brand.",
  
  "business-description-writer":
    "Create compelling, multi-channel business descriptions tailored to Ocala customers. Generate descriptions for your website, Google Business Profile, social media bios, and more—all optimized for local search and conversion.",
  
  "social-media-post-creator":
    "Generate engaging social media posts for Facebook, Instagram, X, and Google Business Profile. Create platform-optimized content that resonates with your Ocala audience, with options for carousel posts, stories, and more.",
  
  "faq-generator":
    "Create helpful FAQ sections for your website with SEO-friendly answers. Generate questions your customers actually ask, with clear, concise responses that improve your site's search visibility and user experience.",
  
  "content-writer":
    "Plan and write blogs, service pages, and marketing content for your Ocala business. Generate outlines, full articles, and structured content that ranks well and converts visitors into customers.",
  
  "image-caption-generator":
    "Turn your business photos into scroll-stopping, on-brand captions. Generate captions optimized for Instagram, Facebook, and other platforms with the right tone, hashtags, and call-to-action.",
  
  "offers-builder":
    "Create high-converting promotions in minutes. Generate headlines, body copy, social posts, and Google Business Profile updates from a single offer. Perfect for seasonal specials, discounts, and limited-time offers.",
  
  "event-campaign-builder":
    "Generate complete event marketing campaigns including landing copy, invitations, timelines, and social/GBP posts. Turn any event into a full marketing suite with consistent messaging across all channels.",
  
  "local-hiring-assistant":
    "Create professional job postings, interview questions, and hiring announcements for social media and Google Business Profile. Attract the right local talent with compelling, clear job listings.",
  
  "google-business-profile-pro":
    "Audit, optimize, and rebuild your Google Business Profile for maximum local visibility. Get detailed recommendations, optimized descriptions, and actionable insights to improve your local search ranking.",
  
  "local-keyword-research":
    "Discover what Ocala customers actually search for before they find you. Find high-value local keywords, analyze search trends, and optimize your content strategy based on real local search data.",
  
  "local-seo-page-builder":
    "Generate high-converting, search-optimized service pages for Ocala. Create pages that rank well in local search results while providing clear value propositions and compelling calls-to-action.",
  
  "business-schema-generator":
    "Create JSON-LD schema for your local business, FAQs, and articles. Improve your search engine visibility with structured data that helps Google understand and display your business information correctly.",
  
  "seo-audit-roadmap":
    "Get a prioritized checklist to improve your rankings over the next 90 days. Receive actionable SEO recommendations tailored to your Ocala business, with clear priorities and implementation guidance.",
  
  "social-auto-poster":
    "Schedule posts to Facebook, Instagram, Google Business, and more from one screen. Save time with automated social media scheduling while maintaining consistent engagement with your audience.",
  
  "scheduler-booking":
    "Let customers book appointments online with synced calendars and reminders. Reduce no-shows, streamline scheduling, and provide a better customer experience with automated booking and confirmations.",
  
  "light-crm":
    "Track leads, notes, and follow-ups in one simple dashboard. Manage customer relationships without the complexity of enterprise CRM systems—perfect for local businesses that need organization without overhead.",
  
  "obd-chatbot":
    "Add a smart assistant that answers questions, captures leads, and guides visitors. Provide instant support 24/7, qualify leads automatically, and improve customer satisfaction with AI-powered chat.",
  
  "logo-generator":
    "Explore logo concepts and refinements designed for local Ocala brands. Generate professional logo options that reflect your brand identity, with variations and refinements based on your feedback.",
  
  "brand-kit-builder":
    "Lock in your colors, fonts, and voice so all your marketing stays on-brand. Create a comprehensive brand guide that ensures consistency across all your marketing materials and channels.",
};

/**
 * Get preview text for an app by app ID
 */
export function getAppPreview(appId: string): string | undefined {
  return appPreviews[appId];
}