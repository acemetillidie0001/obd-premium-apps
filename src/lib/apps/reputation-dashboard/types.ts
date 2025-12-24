/**
 * Reputation Dashboard - Type Definitions
 * 
 * V3 app that provides a comprehensive reputation dashboard for local businesses.
 * Computes KPIs, charts, sentiment, and themes from manually entered or CSV-imported reviews.
 */

export type ReviewPlatform = "Google" | "Facebook" | "Yelp" | "Other";

export interface ReviewInput {
  platform: ReviewPlatform;
  rating: number; // 1-5
  reviewText: string; // required
  authorName?: string;
  reviewDate: string; // ISO date string, required
  responded: boolean;
  responseDate?: string; // ISO date string
  responseText?: string;
}

export type DateRangeMode = "30d" | "90d" | "custom";

export interface DateRange {
  mode: DateRangeMode;
  startDate?: string; // ISO date string, required if mode is "custom"
  endDate?: string; // ISO date string, required if mode is "custom"
}

export interface ReputationDashboardRequest {
  businessName: string; // required
  businessType?: string;
  dateRange: DateRange;
  reviews: ReviewInput[];
  datasetId?: string; // optional, for future V4 persistence
}

export interface KPIBlock {
  reputationScore: number; // 0-100
  avgRating: number; // 1-5
  reviewCount: number;
  responseRate: number; // 0-100 percentage
  medianResponseTime: number; // in hours
}

export interface TimeSeriesPoint {
  date: string; // ISO date string
  value: number;
}

export type SentimentDerivedFrom = "rating" | "textOverride" | "mixed";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface ReviewSentiment {
  sentiment: "positive" | "neutral" | "negative";
  derivedFrom: SentimentDerivedFrom;
  confidence: ConfidenceLevel;
}

export interface Theme {
  name: string;
  count: number;
  exampleSnippet: string;
  matchedKeywords: string[]; // top 3 keyword hits used
  themeConfidence: ConfidenceLevel; // based on hit counts + review coverage
}

export interface SentimentMix {
  positive: number; // percentage 0-100
  neutral: number; // percentage 0-100
  negative: number; // percentage 0-100
  reviewSentiments?: ReviewSentiment[]; // per-review sentiment metadata
}

export interface PriorityAction {
  id: string;
  title: string;
  description: string;
  actionableText: string; // text to copy
}

export type QualitySignalSeverity = "info" | "warning" | "critical";

export interface QualitySignal {
  id: string;
  severity: QualitySignalSeverity;
  shortTitle: string;
  detail: string;
  suggestedNextStep: string;
}

export interface DatasetInfo {
  datasetId: string; // uuid
  createdAt: string; // ISO date string
  businessName: string;
  businessType?: string;
  dateRange: DateRange;
  reviewsNormalizedCount: number;
}

export interface ScoreBreakdown {
  totalScore: number; // 0-100
  ratingComponent: {
    value: number; // 0-60
    weight: number; // 60
    avgRating: number; // 1-5
    contribution: number; // calculated points
  };
  responseComponent: {
    value: number; // 0-40
    weight: number; // 40
    responseRate: number; // 0-100 percentage
    contribution: number; // calculated points
  };
  rawInputs: {
    totalReviews: number;
    totalRatings: number;
    avgRating: number;
    respondedCount: number;
    totalResponseRate: number;
  };
}

export interface ReputationDashboardResponse {
  kpis: KPIBlock;
  scoreBreakdown: ScoreBreakdown;
  ratingOverTime: TimeSeriesPoint[];
  reviewsPerWeek: TimeSeriesPoint[];
  responsesPerWeek: TimeSeriesPoint[];
  topThemes: Theme[]; // top 5
  sentimentMix: SentimentMix;
  priorityActions: PriorityAction[]; // 3-5 items
  qualitySignals: QualitySignal[]; // 3-5 deterministic insights
  datasetInfo?: DatasetInfo; // optional dataset metadata
  snapshotId: string; // Deterministic snapshot ID (RD-XXXXXXXX format)
  computedAt: string; // ISO date string of when dashboard was computed
  metadata: {
    hasLowData: boolean; // reviewCount < 5
    hasNoResponses: boolean; // respondedReviews === 0
    totalReviewsInDataset: number; // before date filtering
  };
}


