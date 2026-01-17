// src/app/api/local-keyword-research/types.ts

export type LocalKeywordPrimaryGoal = "SEO" | "Content" | "Ads" | "Mixed";
export type LocalKeywordPersonalityStyle =
  | "None"
  | "Soft"
  | "Bold"
  | "High-Energy"
  | "Luxury";

export type LocalKeywordLanguage = "English" | "Spanish" | "Bilingual";

export interface LocalKeywordRequest {
  businessName: string;
  businessType: string;
  services: string; // comma- or line-separated services
  city: string;
  state: string;
  websiteUrl?: string;
  primaryGoal: LocalKeywordPrimaryGoal;
  radiusMiles: number;
  includeNearMeVariants: boolean;
  includeZipCodes: boolean;
  includeNeighborhoods: boolean;
  maxKeywords: number; // 25–150
  personalityStyle: LocalKeywordPersonalityStyle;
  brandVoice?: string;
  language: LocalKeywordLanguage;
  includeBlogIdeas: boolean;
  includeFaqIdeas: boolean;
  includeGmbPostIdeas: boolean;
}

export type LocalKeywordIntent =
  | "Informational"
  | "Transactional"
  | "Commercial"
  | "Navigational"
  | "Local"
  | "Mixed";

export interface LocalKeywordIdea {
  keyword: string;
  intent: LocalKeywordIntent;
  suggestedPageType: string; // e.g. "Service Page", "Blog Post", "FAQ Section", "Google Business Post", "Ad Group"
  opportunityScore: number; // 1–100 (higher = better)
  difficultyLabel: "Easy" | "Medium" | "Hard";
  notes?: string;

  // --- V2 optional real metrics ---
  monthlySearchesExact?: number | null;   // e.g. 320
  cpcUsd?: number | null;                 // e.g. 4.50
  adsCompetitionIndex?: number | null;    // 0–1 if from Google Ads
  lowTopOfPageBidUsd?: number | null;     // USD, from Google Ads micros
  highTopOfPageBidUsd?: number | null;    // USD, from Google Ads micros
  dataSource?: "ai" | "google-ads" | "mock" | "mixed";
}

export interface LocalKeywordCluster {
  name: string;
  description: string;
  recommendedUse: string;
  keywords: LocalKeywordIdea[];
}

export interface LocalKeywordResponse {
  summary: string;
  overviewNotes: string[];
  keywordClusters: LocalKeywordCluster[];
  topPriorityKeywords: LocalKeywordIdea[]; // 5–15 best ones
  blogIdeas?: string[];
  faqIdeas?: { question: string; answer: string }[];
  gmbPostIdeas?: string[];
}

// Rank Check types
export interface RankCheckRequest {
  keyword: string;
  targetUrl: string;
  city: string;
  state: string;
}

export interface RankCheckResult {
  keyword: string;
  targetUrl: string;
  currentPositionOrganic?: number | null; // 1–100 or null if not found
  currentPositionMaps?: number | null; // optional for later
  serpSampleUrls?: string[]; // the first ~10 organic URLs (or mock)
  checkedAt: string; // ISO timestamp
  dataSource?: "mock" | "serpapi" | "scraper";
}

export interface RankHistoryItem {
  id: string; // future DB primary key (uuid)
  keyword: string;
  targetUrl: string;
  city: string;
  state: string;
  positionOrganic: number | null;
  positionMaps?: number | null;
  checkedAt: string; // ISO timestamp
  dataSource?: "mock" | "serpapi" | "scraper";
}

