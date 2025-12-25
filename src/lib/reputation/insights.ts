/**
 * Reputation Intelligence Insights Engine
 * 
 * Analyzes Review Request Automation dataset data (totalsJson + warningsJson)
 * to generate actionable insights and recommendations.
 */

export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendedAction?: {
    label: string;
    deepLink: string;
  };
}

export interface TotalsJson {
  sent?: number;
  clicked?: number;
  reviewed?: number;
  queued?: number;
  loaded?: number;
  ready?: number;
  optedOut?: number;
  clickedRate?: number;
  reviewedRate?: number;
}

export interface WarningsJson {
  missingReviewLink?: boolean;
  noCustomerContacts?: boolean;
  smsTooLong?: boolean;
  followUpTooSoon?: boolean;
  highQueueSkipRate?: boolean;
}

export interface InsightsInput {
  totalsJson?: TotalsJson | Record<string, unknown> | null;
  warningsJson?: WarningsJson | Record<string, unknown> | null;
}

/**
 * Generate insights from Review Request Automation dataset
 */
export function generateInsights(input: InsightsInput): Insight[] {
  const insights: Insight[] = [];
  const { totalsJson, warningsJson } = input;

  // If no data at all, return empty
  if (!totalsJson && !warningsJson) {
    return [];
  }

  // Check warningsJson first (these are critical issues)
  if (warningsJson && typeof warningsJson === "object") {
    const warnings = warningsJson as WarningsJson;
    // Missing review link - CRITICAL
    if (warnings.missingReviewLink) {
      insights.push({
        id: "missing-review-link",
        severity: "critical",
        title: "No review link detected",
        message: "Customers cannot leave reviews without a direct link. Add a review link to your campaign settings so customers can easily leave feedback.",
        recommendedAction: {
          label: "Add review link",
          deepLink: "/apps/review-request-automation?tab=campaign&focus=reviewLinkUrl&from=rd",
        },
      });
    }

    // No customer contacts - CRITICAL
    if (warnings.noCustomerContacts) {
      insights.push({
        id: "no-customer-contacts",
        severity: "critical",
        title: "Missing customer contact information",
        message: "Your customers don't have email or phone numbers on file. Add contact information so review requests can be delivered.",
        recommendedAction: {
          label: "Update customer data",
          deepLink: "/apps/review-request-automation?tab=customers&focus=contacts&from=rd",
        },
      });
    }

    // Follow-up too soon - WARNING
    if (warnings.followUpTooSoon) {
      insights.push({
        id: "follow-up-too-soon",
        severity: "warning",
        title: "Follow-ups are too aggressive",
        message: "Sending follow-ups within 2 days may reduce trust and response rate. Consider waiting at least 2-3 days before sending follow-up requests.",
        recommendedAction: {
          label: "Adjust follow-up timing",
          deepLink: "/apps/review-request-automation?tab=campaign&focus=followUpDelayDays&from=rd",
        },
      });
    }

    // SMS too long - WARNING
    if (warnings.smsTooLong) {
      insights.push({
        id: "sms-too-long",
        severity: "warning",
        title: "SMS messages are too long",
        message: "Your SMS templates exceed 300 characters. Long messages may be split into multiple segments and reduce readability. Consider shortening your messages.",
        recommendedAction: {
          label: "Review message templates",
          deepLink: "/apps/review-request-automation?tab=templates&focus=sms&from=rd",
        },
      });
    }

    // High queue skip rate - WARNING
    if (warnings.highQueueSkipRate) {
      insights.push({
        id: "high-skip-rate",
        severity: "warning",
        title: "Many requests are being skipped",
        message: "More than 25% of your review requests are being skipped. This may indicate issues with customer data, frequency caps, or quiet hours settings.",
        recommendedAction: {
          label: "Review queue settings",
          deepLink: "/apps/review-request-automation?tab=queue&focus=skips&from=rd",
        },
      });
    }
  }

  // Check metrics from totalsJson
  if (totalsJson && typeof totalsJson === "object") {
    const totals = totalsJson as TotalsJson;
    const sent = totals.sent || 0;
    const clicked = totals.clicked || 0;
    const reviewed = totals.reviewed || 0;
    const clickedRate = totals.clickedRate || (sent > 0 ? (clicked / sent) * 100 : 0);
    const reviewedRate = totals.reviewedRate || (sent > 0 ? (reviewed / sent) * 100 : 0);

    // Only show insights if we have meaningful data (at least some sent requests)
    if (sent > 0) {
      // Low click-through rate - WARNING
      if (clickedRate < 10) {
        insights.push({
          id: "low-click-rate",
          severity: "warning",
          title: "Low click-through rate",
          message: `Only ${clickedRate.toFixed(1)}% of customers are clicking your review links. Your message content may not be compelling enough, or the link placement could be improved.`,
          recommendedAction: {
            label: "Review message templates",
            deepLink: "/apps/review-request-automation?tab=templates&focus=cta&from=rd",
          },
        });
      }

      // Low review conversion - WARNING
      if (clickedRate >= 10 && reviewedRate < 5) {
        insights.push({
          id: "low-review-conversion",
          severity: "warning",
          title: "Low review conversion rate",
          message: `While ${clickedRate.toFixed(1)}% of customers click your links, only ${reviewedRate.toFixed(1)}% actually leave reviews. Consider making your review process simpler or following up with customers who clicked but didn't review.`,
          recommendedAction: {
            label: "Improve review process",
            deepLink: "/apps/review-request-automation?tab=campaign&focus=timing&from=rd",
          },
        });
      }

      // High opt-out rate - WARNING
      if (totals.optedOut && totals.optedOut > 0 && sent > 0) {
        const optOutRate = (totals.optedOut / sent) * 100;
        if (optOutRate > 5) {
          insights.push({
            id: "high-opt-out",
            severity: "warning",
            title: "High opt-out rate",
            message: `${optOutRate.toFixed(1)}% of customers are opting out of review requests. This may indicate you're sending too frequently or the content isn't relevant.`,
            recommendedAction: {
              label: "Review frequency settings",
              deepLink: "/apps/review-request-automation?tab=campaign&focus=frequencyCapDays&from=rd",
            },
          });
        }
      }

      // Good performance - INFO (only if no critical/warning insights)
      if (reviewedRate >= 15 && clickedRate >= 20 && insights.length === 0) {
        insights.push({
          id: "strong-performance",
          severity: "info",
          title: "Looking healthy",
          message: `Your review request strategy is performing well with ${reviewedRate.toFixed(1)}% of sent requests resulting in reviews. Keep up the great work!`,
        });
      }

      // No reviews yet but sent requests - INFO
      if (reviewed === 0 && sent > 0) {
        insights.push({
          id: "awaiting-reviews",
          severity: "info",
          title: "Awaiting customer responses",
          message: `You've sent ${sent} review request${sent !== 1 ? "s" : ""}. It may take a few days for customers to respond. Monitor your queue for updates.`,
        });
      }
    }
  }

  // Sort by severity: critical > warning > info
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 3,
    warning: 2,
    info: 1,
  };

  return insights.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
}

