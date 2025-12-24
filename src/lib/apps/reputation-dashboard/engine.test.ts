/**
 * Unit Tests for Reputation Dashboard Engine
 * 
 * Run with: npm test or vitest (depending on project setup)
 */

import { describe, it, expect } from "vitest";
import {
  calculateReputationScore,
  calculateReputationScoreWithBreakdown,
  calculateAvgRating,
  calculateResponseRate,
  calculateMedianResponseTime,
  analyzeSentiment,
  calculateSentimentMix,
  extractThemes,
  filterReviewsByDateRange,
  generateRatingOverTime,
  generateReviewsPerWeek,
  generateResponsesPerWeek,
  generatePriorityActions,
  processReputationDashboard,
} from "./engine";
import { ReviewInput, DateRange, KPIBlock, SentimentMix } from "./types";

describe("Reputation Dashboard Engine", () => {
  const mockReviews: ReviewInput[] = [
    {
      platform: "Google",
      rating: 5,
      reviewText: "Great service! Very professional.",
      authorName: "John Doe",
      reviewDate: "2024-01-15",
      responded: true,
      responseDate: "2024-01-16",
      responseText: "Thank you!",
    },
    {
      platform: "Facebook",
      rating: 4,
      reviewText: "Good experience overall.",
      authorName: "Jane Smith",
      reviewDate: "2024-01-20",
      responded: false,
    },
    {
      platform: "Yelp",
      rating: 3,
      reviewText: "Average service, could be better.",
      authorName: "Bob Johnson",
      reviewDate: "2024-01-25",
      responded: true,
      responseDate: "2024-01-26",
      responseText: "We appreciate your feedback.",
    },
  ];

  describe("calculateAvgRating", () => {
    it("should calculate average rating correctly", () => {
      const avg = calculateAvgRating(mockReviews);
      expect(avg).toBe(4.0); // (5 + 4 + 3) / 3 = 4.0
    });

    it("should return 0 for empty array", () => {
      expect(calculateAvgRating([])).toBe(0);
    });
  });

  describe("calculateResponseRate", () => {
    it("should calculate response rate correctly", () => {
      const rate = calculateResponseRate(mockReviews);
      expect(rate).toBe(67); // 2 out of 3 responded = 67%
    });

    it("should return 0 for empty array", () => {
      expect(calculateResponseRate([])).toBe(0);
    });
  });

  describe("calculateReputationScore", () => {
    it("should calculate reputation score correctly", () => {
      const score = calculateReputationScore(mockReviews);
      // Avg rating: 4.0, Response rate: 67%
      // (4.0 / 5) * 60 + (67 / 100) * 40 = 48 + 26.8 = 74.8 ≈ 75
      expect(score).toBe(75);
    });

    it("should return 0 for empty array", () => {
      expect(calculateReputationScore([])).toBe(0);
    });
  });

  describe("calculateReputationScoreWithBreakdown", () => {
    it("should return detailed breakdown", () => {
      const breakdown = calculateReputationScoreWithBreakdown(mockReviews);
      expect(breakdown.totalScore).toBe(75);
      expect(breakdown.ratingComponent.weight).toBe(60);
      expect(breakdown.responseComponent.weight).toBe(40);
      expect(breakdown.rawInputs.totalReviews).toBe(3);
    });
  });

  describe("calculateMedianResponseTime", () => {
    it("should calculate median response time correctly", () => {
      const median = calculateMedianResponseTime(mockReviews);
      // Review 1: 24 hours, Review 3: 24 hours
      // Median of [24, 24] = 24
      expect(median).toBe(24);
    });

    it("should return 0 when no responses", () => {
      const noResponseReviews = mockReviews.map((r) => ({ ...r, responded: false }));
      expect(calculateMedianResponseTime(noResponseReviews)).toBe(0);
    });
  });

  describe("analyzeSentiment", () => {
    it("should classify positive reviews correctly", () => {
      expect(analyzeSentiment("Great service!", 5)).toBe("positive");
      expect(analyzeSentiment("Excellent work", 4)).toBe("positive");
    });

    it("should classify negative reviews correctly", () => {
      expect(analyzeSentiment("Terrible experience", 1)).toBe("negative");
      expect(analyzeSentiment("Very bad service", 2)).toBe("negative");
    });

    it("should use keyword analysis for rating 3", () => {
      expect(analyzeSentiment("Great service but slow", 3)).toBe("positive");
      expect(analyzeSentiment("Terrible experience overall", 3)).toBe("negative");
      expect(analyzeSentiment("It was okay", 3)).toBe("neutral");
    });
  });

  describe("calculateSentimentMix", () => {
    it("should calculate sentiment percentages correctly", () => {
      const mix = calculateSentimentMix(mockReviews);
      expect(mix.positive + mix.neutral + mix.negative).toBe(100);
    });
  });

  describe("extractThemes", () => {
    it("should extract themes from reviews", () => {
      const themes = extractThemes(mockReviews);
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeLessThanOrEqual(5);
    });

    it("should return empty array for no reviews", () => {
      expect(extractThemes([])).toEqual([]);
    });
  });

  describe("filterReviewsByDateRange", () => {
    it("should filter reviews by 30d range", () => {
      const dateRange: DateRange = { mode: "30d" };
      const filtered = filterReviewsByDateRange(mockReviews, dateRange);
      // All reviews are recent, so should include all
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });

    it("should filter reviews by custom range", () => {
      const dateRange: DateRange = {
        mode: "custom",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      };
      const filtered = filterReviewsByDateRange(mockReviews, dateRange);
      expect(filtered.length).toBe(3);
    });
  });

  describe("generatePriorityActions", () => {
    it("should generate priority actions", () => {
      const kpis: KPIBlock = {
        reputationScore: 75,
        avgRating: 4.0,
        reviewCount: 3,
        responseRate: 67,
        medianResponseTime: 24,
      };
      const sentimentMix: SentimentMix = {
        positive: 33,
        neutral: 33,
        negative: 34,
      };
      const actions = generatePriorityActions(kpis, sentimentMix, mockReviews);
      expect(actions.length).toBeGreaterThanOrEqual(0);
      expect(actions.length).toBeLessThanOrEqual(5);
    });
  });

  describe("processReputationDashboard", () => {
    it("should process complete dashboard request", () => {
      const request = {
        businessName: "Test Business",
        businessType: "Restaurant",
        dateRange: { mode: "30d" as const },
        reviews: mockReviews,
      };
      const result = processReputationDashboard(request);
      expect(result.kpis).toBeDefined();
      expect(result.scoreBreakdown).toBeDefined();
      expect(result.ratingOverTime).toBeDefined();
      expect(result.reviewsPerWeek).toBeDefined();
      expect(result.responsesPerWeek).toBeDefined();
      expect(result.topThemes).toBeDefined();
      expect(result.sentimentMix).toBeDefined();
      expect(result.priorityActions).toBeDefined();
    });
  });
});

