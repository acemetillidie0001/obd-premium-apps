/**
 * Reputation Dashboard Engine
 * 
 * Pure calculation functions for reputation dashboard analytics.
 * All functions are deterministic and side-effect free.
 */

import {
  ReviewInput,
  KPIBlock,
  TimeSeriesPoint,
  Theme,
  SentimentMix,
  PriorityAction,
  DateRange,
  ScoreBreakdown,
  ReputationDashboardResponse,
  ReputationDashboardRequest,
  ReviewSentiment,
  SentimentDerivedFrom,
  ConfidenceLevel,
  QualitySignal,
  QualitySignalSeverity,
  DatasetInfo,
} from "./types";
import { generateSnapshotId } from "./hash";

/**
 * Calculate date range boundaries from a date range configuration
 */
export function getDateRangeBoundaries(dateRange: DateRange): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  let start: Date;
  if (dateRange.mode === "30d") {
    start = new Date();
    start.setDate(start.getDate() - 30);
  } else if (dateRange.mode === "90d") {
    start = new Date();
    start.setDate(start.getDate() - 90);
  } else {
    // custom
    start = new Date(dateRange.startDate!);
    end.setTime(new Date(dateRange.endDate!).getTime());
  }
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

/**
 * Filter reviews by date range
 */
export function filterReviewsByDateRange(
  reviews: ReviewInput[],
  dateRange: DateRange
): ReviewInput[] {
  const { start, end } = getDateRangeBoundaries(dateRange);
  return reviews.filter((review) => {
    const reviewDate = new Date(review.reviewDate);
    return reviewDate >= start && reviewDate <= end;
  });
}

/**
 * Calculate average rating
 */
export function calculateAvgRating(reviews: ReviewInput[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate response rate (0-100)
 */
export function calculateResponseRate(reviews: ReviewInput[]): number {
  if (reviews.length === 0) return 0;
  const respondedCount = reviews.filter((r) => r.responded).length;
  return Math.round((respondedCount / reviews.length) * 100);
}

/**
 * Calculate median response time in hours
 * Returns -1 if no responses (to distinguish from 0 hours)
 */
export function calculateMedianResponseTime(reviews: ReviewInput[]): number {
  const responseTimes: number[] = [];
  
  for (const review of reviews) {
    if (review.responded && review.reviewDate && review.responseDate) {
      const reviewDate = new Date(review.reviewDate);
      const responseDate = new Date(review.responseDate);
      const diffMs = responseDate.getTime() - reviewDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours < 365 * 24) { // Sanity check: < 1 year
        responseTimes.push(diffHours);
      }
    }
  }
  
  if (responseTimes.length === 0) return -1; // -1 means N/A (no responses)
  
  responseTimes.sort((a, b) => a - b);
  const mid = Math.floor(responseTimes.length / 2);
  return responseTimes.length % 2 === 0
    ? (responseTimes[mid - 1] + responseTimes[mid]) / 2
    : responseTimes[mid];
}

/**
 * Calculate reputation score with detailed breakdown
 * Formula: (avgRating / 5) * 60 + (responseRate / 100) * 40
 */
export function calculateReputationScoreWithBreakdown(reviews: ReviewInput[]): ScoreBreakdown {
  if (reviews.length === 0) {
    return {
      totalScore: 0,
      ratingComponent: {
        value: 0,
        weight: 60,
        avgRating: 0,
        contribution: 0,
      },
      responseComponent: {
        value: 0,
        weight: 40,
        responseRate: 0,
        contribution: 0,
      },
      rawInputs: {
        totalReviews: 0,
        totalRatings: 0,
        avgRating: 0,
        respondedCount: 0,
        totalResponseRate: 0,
      },
    };
  }
  
  const avgRating = calculateAvgRating(reviews);
  const responseRate = calculateResponseRate(reviews);
  const respondedCount = reviews.filter((r) => r.responded).length;
  const totalRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
  
  // Rating component: (avgRating / 5) * 60
  const ratingContribution = (avgRating / 5) * 60;
  
  // Response component: (responseRate / 100) * 40
  // If no responses, use neutral default (50% response rate = 20 points)
  const hasResponses = respondedCount > 0;
  const effectiveResponseRate = hasResponses ? responseRate : 50; // Neutral default
  const responseContribution = (effectiveResponseRate / 100) * 40;
  
  // Total score
  const totalScore = Math.round(Math.max(0, Math.min(100, ratingContribution + responseContribution)));
  
  return {
    totalScore,
    ratingComponent: {
      value: Math.round(ratingContribution * 10) / 10,
      weight: 60,
      avgRating,
      contribution: Math.round(ratingContribution * 10) / 10,
    },
    responseComponent: {
      value: Math.round(responseContribution * 10) / 10,
      weight: 40,
      responseRate: hasResponses ? responseRate : 50, // Show neutral default if no responses
      contribution: Math.round(responseContribution * 10) / 10,
    },
    rawInputs: {
      totalReviews: reviews.length,
      totalRatings,
      avgRating,
      respondedCount,
      totalResponseRate: responseRate,
    },
  };
}

/**
 * Calculate reputation score (0-100) - simplified version
 */
export function calculateReputationScore(reviews: ReviewInput[]): number {
  const breakdown = calculateReputationScoreWithBreakdown(reviews);
  return breakdown.totalScore;
}

/**
 * Simple sentiment analysis (heuristic-based) with confidence metadata
 */
export function analyzeSentimentWithConfidence(
  reviewText: string,
  rating: number
): ReviewSentiment {
  const text = reviewText.toLowerCase();
  const positiveWords = ["great", "excellent", "good", "love", "amazing", "wonderful", "perfect", "best", "recommend", "happy", "satisfied", "pleased"];
  const negativeWords = ["terrible", "awful", "horrible", "bad", "worst", "disappointed", "poor", "unhappy", "dissatisfied", "hate", "never", "avoid"];
  
  const positiveCount = positiveWords.filter((word) => text.includes(word)).length;
  const negativeCount = negativeWords.filter((word) => text.includes(word)).length;
  
  // Rating-based primary classification
  if (rating >= 4) {
    const derivedFrom: SentimentDerivedFrom = positiveCount > 0 ? "mixed" : "rating";
    const confidence: ConfidenceLevel = rating === 5 ? "high" : positiveCount > 0 ? "high" : "medium";
    return {
      sentiment: "positive",
      derivedFrom,
      confidence,
    };
  }
  
  if (rating <= 2) {
    const derivedFrom: SentimentDerivedFrom = negativeCount > 0 ? "mixed" : "rating";
    const confidence: ConfidenceLevel = rating === 1 ? "high" : negativeCount > 0 ? "high" : "medium";
    return {
      sentiment: "negative",
      derivedFrom,
      confidence,
    };
  }
  
  // For rating 3, use keyword-based heuristic
  let sentiment: "positive" | "neutral" | "negative";
  let derivedFrom: SentimentDerivedFrom;
  let confidence: ConfidenceLevel;
  
  if (positiveCount > negativeCount) {
    sentiment = "positive";
    derivedFrom = "textOverride";
    confidence = positiveCount >= 2 ? "medium" : "low";
  } else if (negativeCount > positiveCount) {
    sentiment = "negative";
    derivedFrom = "textOverride";
    confidence = negativeCount >= 2 ? "medium" : "low";
  } else {
    sentiment = "neutral";
    derivedFrom = "rating";
    confidence = "low";
  }
  
  return { sentiment, derivedFrom, confidence };
}

/**
 * Simple sentiment analysis (heuristic-based) - legacy function for compatibility
 */
export function analyzeSentiment(reviewText: string, rating: number): "positive" | "neutral" | "negative" {
  return analyzeSentimentWithConfidence(reviewText, rating).sentiment;
}

/**
 * Calculate sentiment mix with confidence metadata
 */
export function calculateSentimentMix(reviews: ReviewInput[]): SentimentMix {
  if (reviews.length === 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }
  
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  const reviewSentiments: ReviewSentiment[] = [];
  
  for (const review of reviews) {
    const sentimentData = analyzeSentimentWithConfidence(review.reviewText, review.rating);
    reviewSentiments.push(sentimentData);
    
    if (sentimentData.sentiment === "positive") positive++;
    else if (sentimentData.sentiment === "neutral") neutral++;
    else negative++;
  }
  
  return {
    positive: Math.round((positive / reviews.length) * 100),
    neutral: Math.round((neutral / reviews.length) * 100),
    negative: Math.round((negative / reviews.length) * 100),
    reviewSentiments,
  };
}

/**
 * Extract themes via simple keyword clustering with confidence metadata
 */
export function extractThemes(reviews: ReviewInput[]): Theme[] {
  if (reviews.length === 0) return [];
  
  // Common business-related keywords to look for
  const themeKeywords: Record<string, string[]> = {
    "Customer Service": ["service", "staff", "employee", "helpful", "friendly", "customer", "support"],
    "Quality": ["quality", "excellent", "great", "good", "amazing", "perfect", "best"],
    "Price": ["price", "affordable", "expensive", "cost", "value", "worth", "cheap", "budget"],
    "Speed": ["fast", "quick", "slow", "timely", "efficient", "wait", "time"],
    "Cleanliness": ["clean", "dirty", "messy", "organized", "tidy", "hygiene"],
    "Location": ["location", "convenient", "close", "near", "parking", "access"],
    "Communication": ["communication", "respond", "call", "email", "contact", "reach"],
    "Product/Service": ["product", "service", "work", "job", "result", "outcome"],
  };
  
  const themeCounts: Record<string, { 
    count: number; 
    snippets: string[]; 
    matchedKeywords: string[];
    reviewCoverage: number;
  }> = {};
  
  for (const review of reviews) {
    const text = review.reviewText.toLowerCase();
    for (const [themeName, keywords] of Object.entries(themeKeywords)) {
      const matches = keywords.filter((keyword) => text.includes(keyword));
      if (matches.length > 0) {
        if (!themeCounts[themeName]) {
          themeCounts[themeName] = { 
            count: 0, 
            snippets: [],
            matchedKeywords: [],
            reviewCoverage: 0,
          };
        }
        themeCounts[themeName].count++;
        themeCounts[themeName].reviewCoverage++;
        
        // Track matched keywords (top 3)
        for (const match of matches) {
          if (!themeCounts[themeName].matchedKeywords.includes(match) && 
              themeCounts[themeName].matchedKeywords.length < 3) {
            themeCounts[themeName].matchedKeywords.push(match);
          }
        }
        
        if (themeCounts[themeName].snippets.length < 3) {
          // Extract a snippet (first 100 chars)
          const snippet = review.reviewText.substring(0, 100).trim();
          if (snippet && !themeCounts[themeName].snippets.includes(snippet)) {
            themeCounts[themeName].snippets.push(snippet);
          }
        }
      }
    }
  }
  
  // Convert to Theme array with confidence, sort by count
  const themes: Theme[] = Object.entries(themeCounts)
    .map(([name, data]) => {
      // Calculate confidence based on hit counts + review coverage
      const coveragePercent = (data.reviewCoverage / reviews.length) * 100;
      let themeConfidence: ConfidenceLevel;
      
      if (data.count >= 5 && coveragePercent >= 30) {
        themeConfidence = "high";
      } else if (data.count >= 3 && coveragePercent >= 15) {
        themeConfidence = "medium";
      } else {
        themeConfidence = "low";
      }
      
      return {
        name,
        count: data.count,
        exampleSnippet: data.snippets[0] || "",
        matchedKeywords: data.matchedKeywords.slice(0, 3),
        themeConfidence,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5
  
  return themes;
}

/**
 * Generate time series for rating over time
 */
export function generateRatingOverTime(reviews: ReviewInput[], dateRange: DateRange): TimeSeriesPoint[] {
  const { start, end } = getDateRangeBoundaries(dateRange);
  const points: TimeSeriesPoint[] = [];
  
  // Group by week
  const weekMap = new Map<string, { ratings: number[] }>();
  
  for (const review of reviews) {
    const date = new Date(review.reviewDate);
    if (date < start || date > end) continue;
    
    // Get week start (Monday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split("T")[0];
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { ratings: [] });
    }
    weekMap.get(weekKey)!.ratings.push(review.rating);
  }
  
  // Calculate average rating per week
  for (const [dateStr, data] of weekMap.entries()) {
    const avg = data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length;
    points.push({
      date: dateStr,
      value: Math.round(avg * 10) / 10,
    });
  }
  
  // Sort by date
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Generate time series for reviews per week
 */
export function generateReviewsPerWeek(reviews: ReviewInput[], dateRange: DateRange): TimeSeriesPoint[] {
  const { start, end } = getDateRangeBoundaries(dateRange);
  const weekMap = new Map<string, number>();
  
  for (const review of reviews) {
    const date = new Date(review.reviewDate);
    if (date < start || date > end) continue;
    
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split("T")[0];
    
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
  }
  
  const points: TimeSeriesPoint[] = Array.from(weekMap.entries()).map(([date, value]) => ({
    date,
    value,
  }));
  
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Generate time series for responses per week
 */
export function generateResponsesPerWeek(reviews: ReviewInput[], dateRange: DateRange): TimeSeriesPoint[] {
  const { start, end } = getDateRangeBoundaries(dateRange);
  const weekMap = new Map<string, number>();
  
  for (const review of reviews) {
    if (!review.responded || !review.responseDate) continue;
    
    const date = new Date(review.responseDate);
    if (date < start || date > end) continue;
    
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split("T")[0];
    
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
  }
  
  const points: TimeSeriesPoint[] = Array.from(weekMap.entries()).map(([date, value]) => ({
    date,
    value,
  }));
  
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Generate priority actions
 */
export function generatePriorityActions(
  kpis: KPIBlock,
  sentimentMix: SentimentMix,
  reviews: ReviewInput[]
): PriorityAction[] {
  const actions: PriorityAction[] = [];
  
  // Action 1: Response rate
  if (kpis.responseRate < 80) {
    actions.push({
      id: "improve-response-rate",
      title: "Improve Response Rate",
      description: `Your response rate is ${kpis.responseRate}%. Aim for 80%+ to show customers you care.`,
      actionableText: `Set a goal to respond to ${Math.ceil((reviews.length * 0.8) - (reviews.length * kpis.responseRate / 100))} more reviews this month.`,
    });
  }
  
  // Action 2: Response time (only if there are responses)
  if (kpis.medianResponseTime > 0 && kpis.medianResponseTime > 48) {
    actions.push({
      id: "reduce-response-time",
      title: "Reduce Response Time",
      description: `Your median response time is ${Math.round(kpis.medianResponseTime)} hours. Try to respond within 24-48 hours.`,
      actionableText: "Set up daily review monitoring and aim to respond within 24 hours of each review.",
    });
  }
  
  // Action 3: Negative sentiment
  if (sentimentMix.negative > 20) {
    actions.push({
      id: "address-negative-reviews",
      title: "Address Negative Reviews",
      description: `${sentimentMix.negative}% of reviews are negative. Focus on addressing common complaints.`,
      actionableText: "Review negative feedback themes and create an action plan to address the top 3 issues mentioned.",
    });
  }
  
  // Action 4: Review volume
  if (kpis.reviewCount < 10) {
    actions.push({
      id: "increase-review-volume",
      title: "Increase Review Volume",
      description: `You have ${kpis.reviewCount} reviews. More reviews build trust and improve visibility.`,
      actionableText: "Implement a review request system: ask satisfied customers to leave reviews via email or SMS after service.",
    });
  }
  
  // Action 5: Rating improvement
  if (kpis.avgRating < 4.0) {
    actions.push({
      id: "improve-average-rating",
      title: "Improve Average Rating",
      description: `Your average rating is ${kpis.avgRating}/5. Focus on the themes mentioned in lower-rated reviews.`,
      actionableText: "Analyze 3-star and below reviews to identify patterns. Create a plan to address the most common issues.",
    });
  }
  
  // If we have fewer than 3 actions, add generic ones
  if (actions.length < 3) {
    if (actions.length === 0 || !actions.find((a) => a.id === "monitor-regularly")) {
      actions.push({
        id: "monitor-regularly",
        title: "Monitor Reviews Regularly",
        description: "Set up a weekly review monitoring routine to stay on top of customer feedback.",
        actionableText: "Schedule 30 minutes each week to review new feedback and respond to any unanswered reviews.",
      });
    }
    
    if (actions.length < 3 && !actions.find((a) => a.id === "thank-positive")) {
      actions.push({
        id: "thank-positive",
        title: "Thank Positive Reviewers",
        description: "Show appreciation to customers who leave positive reviews to encourage more feedback.",
        actionableText: "Respond to all positive reviews with a personalized thank-you message within 24 hours.",
      });
    }
  }
  
  return actions.slice(0, 5); // Max 5 actions
}

/**
 * Generate quality signals (deterministic insights)
 */
export function generateQualitySignals(
  kpis: KPIBlock,
  sentimentMix: SentimentMix,
  themes: Theme[],
  reviews: ReviewInput[],
  dateRange: DateRange
): QualitySignal[] {
  const signals: QualitySignal[] = [];
  
  // Signal 1: Response time
  if (kpis.medianResponseTime > 0 && kpis.medianResponseTime > 24) {
    const severity: QualitySignalSeverity = kpis.medianResponseTime > 72 ? "critical" : "warning";
    signals.push({
      id: "response-time-slow",
      severity,
      shortTitle: "Response time slower than goal",
      detail: `You respond slower than similar businesses (goal: <24h). Your median response time is ${Math.round(kpis.medianResponseTime)} hours.`,
      suggestedNextStep: "Set up daily review monitoring and aim to respond within 24 hours of each review.",
    });
  }
  
  // Signal 2: Negative review concentration
  if (sentimentMix.negative > 20) {
    const topNegativeTheme = themes.find((t) => {
      // Find theme most associated with negative reviews
      const negativeReviews = reviews.filter((r) => {
        const sentiment = analyzeSentiment(r.reviewText, r.rating);
        return sentiment === "negative";
      });
      return negativeReviews.some((r) => 
        t.matchedKeywords.some((kw) => r.reviewText.toLowerCase().includes(kw))
      );
    });
    
    if (topNegativeTheme) {
      signals.push({
        id: "negative-theme-concentration",
        severity: sentimentMix.negative > 40 ? "critical" : "warning",
        shortTitle: "Negative reviews concentrated around theme",
        detail: `${sentimentMix.negative}% of reviews are negative, with many mentioning: ${topNegativeTheme.name}.`,
        suggestedNextStep: `Focus on addressing ${topNegativeTheme.name} issues mentioned in negative feedback.`,
      });
    }
  }
  
  // Signal 3: Review velocity
  const { start, end } = getDateRangeBoundaries(dateRange);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const reviewsPerDay = kpis.reviewCount / daysDiff;
  
  if (reviewsPerDay < 0.1 && kpis.reviewCount < 10) {
    signals.push({
      id: "low-review-velocity",
      severity: "info",
      shortTitle: "Review velocity is low",
      detail: `Review velocity is low for the selected window (${kpis.reviewCount} reviews over ${Math.round(daysDiff)} days).`,
      suggestedNextStep: "Implement a review request system: ask satisfied customers to leave reviews via email or SMS after service.",
    });
  }
  
  // Signal 4: Response rate gap
  if (kpis.responseRate < 80 && kpis.reviewCount >= 5) {
    const gap = Math.ceil((kpis.reviewCount * 0.8) - (kpis.reviewCount * kpis.responseRate / 100));
    signals.push({
      id: "response-rate-gap",
      severity: kpis.responseRate < 50 ? "warning" : "info",
      shortTitle: "Response rate below target",
      detail: `Your response rate is ${kpis.responseRate}%. Aim for 80%+ to show customers you care.`,
      suggestedNextStep: `Respond to ${gap} more reviews to reach 80% response rate.`,
    });
  }
  
  // Signal 5: Rating trend (if we have enough data)
  if (kpis.reviewCount >= 10) {
    const recentReviews = reviews
      .sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime())
      .slice(0, Math.floor(kpis.reviewCount / 2));
    const recentAvg = calculateAvgRating(recentReviews);
    const olderAvg = calculateAvgRating(reviews.slice(Math.floor(kpis.reviewCount / 2)));
    
    if (recentAvg < olderAvg - 0.5) {
      signals.push({
        id: "rating-decline",
        severity: "warning",
        shortTitle: "Rating trend declining",
        detail: `Recent reviews average ${recentAvg.toFixed(1)}/5, down from ${olderAvg.toFixed(1)}/5 in earlier reviews.`,
        suggestedNextStep: "Analyze recent negative feedback to identify patterns and address common issues.",
      });
    }
  }
  
  return signals.slice(0, 5); // Max 5 signals
}

/**
 * Generate dataset info (for future V4 persistence)
 */
export function generateDatasetInfo(
  request: ReputationDashboardRequest,
  filteredCount: number
): DatasetInfo {
  return {
    datasetId: request.datasetId || `dataset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    businessName: request.businessName,
    businessType: request.businessType,
    dateRange: request.dateRange,
    reviewsNormalizedCount: filteredCount,
  };
}

/**
 * Main processing function - processes a reputation dashboard request
 */
export function processReputationDashboard(request: ReputationDashboardRequest): ReputationDashboardResponse {
  // Filter reviews by date range
  const filteredReviews = filterReviewsByDateRange(request.reviews, request.dateRange);
  
  // Calculate score breakdown
  const scoreBreakdown = calculateReputationScoreWithBreakdown(filteredReviews);
  
  // Calculate median response time (returns -1 if no responses)
  const medianResponseTime = calculateMedianResponseTime(filteredReviews);
  
  // Calculate KPIs
  const kpis: KPIBlock = {
    reputationScore: scoreBreakdown.totalScore,
    avgRating: scoreBreakdown.ratingComponent.avgRating,
    reviewCount: filteredReviews.length,
    responseRate: scoreBreakdown.responseComponent.responseRate,
    medianResponseTime: medianResponseTime === -1 ? 0 : medianResponseTime, // Convert -1 to 0 for display, but track in metadata
  };
  
  // Calculate sentiment mix with confidence
  const sentimentMix = calculateSentimentMix(filteredReviews);
  
  // Extract themes with confidence
  const topThemes = extractThemes(filteredReviews);
  
  // Generate time series
  const ratingOverTime = generateRatingOverTime(filteredReviews, request.dateRange);
  const reviewsPerWeek = generateReviewsPerWeek(filteredReviews, request.dateRange);
  const responsesPerWeek = generateResponsesPerWeek(filteredReviews, request.dateRange);
  
  // Generate priority actions
  const priorityActions = generatePriorityActions(kpis, sentimentMix, filteredReviews);
  
  // Generate quality signals
  const qualitySignals = generateQualitySignals(kpis, sentimentMix, topThemes, filteredReviews, request.dateRange);
  
  // Generate dataset info
  const datasetInfo = generateDatasetInfo(request, filteredReviews.length);
  
  // Generate deterministic snapshot ID
  // Uses filtered reviews (the actual data analyzed) + date range for unique identification
  const snapshotId = generateSnapshotId(
    request.businessName,
    request.businessType,
    request.dateRange,
    filteredReviews // Use filtered reviews (what was actually analyzed)
  );
  
  // Generate computed timestamp
  const computedAt = new Date().toISOString();
  
  // Calculate metadata
  const respondedReviews = filteredReviews.filter((r) => r.responded);
  const hasNoResponses = respondedReviews.length === 0;
  
  return {
    kpis,
    scoreBreakdown,
    ratingOverTime,
    reviewsPerWeek,
    responsesPerWeek,
    topThemes,
    sentimentMix,
    priorityActions,
    qualitySignals,
    datasetInfo,
    snapshotId,
    computedAt,
    metadata: {
      hasLowData: filteredReviews.length < 5,
      hasNoResponses,
      totalReviewsInDataset: request.reviews.length,
    },
  };
}

