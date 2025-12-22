export type EventGoal =
  | "Awareness"
  | "RSVPs"
  | "TicketSales"
  | "WalkIns"
  | "Leads"
  | "Other";

export type EventType = "InPerson" | "Virtual" | "Hybrid";

export type PersonalityStyle = "None" | "Soft" | "Bold" | "High-Energy" | "Luxury";

export type LanguageOption = "English" | "Spanish" | "Bilingual";

export interface EventCampaignFormValues {
  // Business basics
  businessName: string;
  businessType: string;
  services: string; // freeform text, can be a comma-separated list
  city: string;
  state: string;

  // Event core details
  eventName: string;
  eventDate: string; // simple string input (e.g. "March 15, 2026" or "2026-03-15")
  eventTime: string; // simple string (e.g. "6:00 PM – 9:00 PM")
  eventLocation: string;
  eventType: EventType;
  eventDescription: string; // what is happening, key details

  // Strategy
  audience: string; // who is this for?
  mainGoal: EventGoal;
  budgetLevel: "Free" | "Low" | "Moderate" | "Premium";
  urgencyLevel: "Normal" | "Last-Minute";

  // Brand & style
  brandVoice: string;
  personalityStyle: PersonalityStyle;
  language: LanguageOption;

  // Channels toggles
  includeFacebook: boolean;
  includeInstagram: boolean;
  includeX: boolean;
  includeGoogleBusiness: boolean;
  includeEmail: boolean;
  includeSms: boolean;
  includeImageCaption: boolean;

  // Extra options
  campaignDurationDays: number; // e.g. 3–14 days
  notesForAI: string;
}

export interface HashtagBundle {
  platform: "Facebook" | "Instagram" | "X" | "GoogleBusiness" | "Generic";
  tags: string[];
}

export interface ScheduleIdea {
  dayOffset: number; // 0 = today, 1 = tomorrow, etc.
  label: string; // e.g. "1 week before event"
  channel: string; // e.g. "Facebook", "Instagram Stories"
  suggestion: string; // description of what to post
}

export interface EmailAnnouncement {
  subject: string;
  previewText: string;
  bodyText: string;
  bodyHtml: string;
}

export interface EventCampaignAssets {
  eventTitles: string[]; // 3–7 options
  shortDescriptions: string[]; // 2–4 short blurbs
  longDescription: string; // 1 main long-form event description

  facebookPosts: string[];
  instagramCaptions: string[];
  instagramStoryIdeas: string[];
  xPosts: string[];
  googleBusinessPosts: string[];

  emailAnnouncement?: EmailAnnouncement;
  smsBlasts?: string[]; // short 140-char SMS options
  imageCaption?: string;

  hashtagBundles: HashtagBundle[];
  scheduleIdeas: ScheduleIdea[];
}

export interface EventCampaignMeta {
  primaryTagline: string;
  primaryCallToAction: string;
  recommendedStartDateNote: string; // freeform text like "Start promoting 10 days before the event."
  timezoneNote: string; // e.g. "All times in Eastern Time (Ocala, FL)."
}

export interface EventCampaignResponse {
  meta: EventCampaignMeta;
  assets: EventCampaignAssets;
}
