// src/lib/local-keyword-metrics.ts

/**
 * OBD Local Keyword Metrics Helper
 * 
 * Provides keyword metrics (search volume, CPC, competition) from various sources.
 * 
 * Configuration:
 * - Set LOCAL_KEYWORD_METRICS_SOURCE env var to control which source is used:
 *   - "mock" (default): Returns mock/fake metrics for testing
 *   - "google-ads": Uses real Google Ads Keyword Planner API
 * 
 * Google Ads Setup (when using "google-ads"):
 * Required environment variables:
 * - GOOGLE_ADS_DEVELOPER_TOKEN: Your Google Ads API developer token
 * - GOOGLE_ADS_CLIENT_CUSTOMER_ID: Your Google Ads customer ID (format: XXX-XXX-XXXX)
 * - GOOGLE_ADS_CLIENT_ID: OAuth2 client ID
 * - GOOGLE_ADS_CLIENT_SECRET: OAuth2 client secret
 * - GOOGLE_ADS_REFRESH_TOKEN: OAuth2 refresh token
 * 
 * To get Google Ads credentials:
 * 1. Create a Google Ads API account at https://ads.google.com/aw/apicenter
 * 2. Set up OAuth2 credentials in Google Cloud Console
 * 3. Generate a refresh token using the OAuth2 flow
 * 4. Add all credentials to your .env.local file
 */

export interface RawKeywordMetric {
  keyword: string;
  monthlySearchesExact?: number | null;
  cpcUsd?: number | null;
  adsCompetitionIndex?: number | null; // 0–1 range if using Google Ads
  lowTopOfPageBidUsd?: number | null;
  highTopOfPageBidUsd?: number | null;
  dataSource?: "ai" | "google-ads" | "mock" | "mixed";
}

export type KeywordMetricsDiagnostics = {
  ok: boolean;
  source: "mock" | "google-ads";
  code?: string;
  message?: string;
  fallbackUsed?: boolean;
  partialFailures?: number;
};

/**
 * Mock metrics implementation for testing and development.
 * 
 * Returns fake but realistic-looking metrics so the UI and LLM prompt
 * can be tested without requiring Google Ads API access.
 */
export async function fetchKeywordMetricsMock(
  keywords: string[],
  city: string,
  state: string
): Promise<RawKeywordMetric[]> {
  const unique = Array.from(new Set(keywords.map((k) => k.trim()))).filter(
    Boolean
  );

  return unique.map((keyword, idx) => {
    // Very simple fake distribution just to make UI & logic testable
    const base = 50 + (idx % 40); // 50–89
    const volume = base * 5;      // 250–445 (completely fake)
    const cpc = 2 + (idx % 5) * 0.75; // 2.00–5.00 (fake)
    const competition = 0.2 + (idx % 4) * 0.2; // 0.2–0.8

    return {
      keyword,
      monthlySearchesExact: volume,
      cpcUsd: Number(cpc.toFixed(2)),
      adsCompetitionIndex: Number(competition.toFixed(2)),
      dataSource: "mock",
    };
  });
}

/**
 * Real Google Ads Keyword Planner implementation.
 * 
 * Fetches actual search volume, CPC, and competition data from Google Ads API.
 * 
 * TODO: Implement the following steps:
 * 
 * 1. Install Google Ads API client library:
 *    npm install google-ads-api
 * 
 * 2. Initialize the Google Ads client:
 *    import { GoogleAdsApi } from "google-ads-api";
 *    
 *    const client = new GoogleAdsApi({
 *      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
 *      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
 *      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
 *    });
 *    
 *    const customer = client.Customer({
 *      customer_id: process.env.GOOGLE_ADS_CLIENT_CUSTOMER_ID!,
 *      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
 *    });
 * 
 * 3. Build keyword plan request:
 *    - Use KeywordPlanIdeaService.generateKeywordIdeas() or
 *    - Use KeywordPlanIdeaService.generateKeywordHistoricalMetrics()
 *    - Include location targeting (city, state)
 *    - Request metrics for each keyword in the keywords array
 * 
 * 4. Map Google Ads response to RawKeywordMetric:
 *    - monthlySearchesExact: from keywordPlanIdea.keyword_idea_metrics.avg_monthly_searches
 *    - cpcUsd: from keywordPlanIdea.keyword_idea_metrics.low_top_of_page_bid_micros / 1_000_000 (convert micros to USD)
 *    - adsCompetitionIndex: from keywordPlanIdea.keyword_idea_metrics.competition (already 0-1 range)
 *    - dataSource: "google-ads"
 * 
 * 5. Handle errors gracefully:
 *    - If API call fails, return metrics with null values
 *    - Log errors for debugging
 *    - Consider rate limiting (Google Ads has quotas)
 * 
 * 6. Handle missing keywords:
 *    - Some keywords may not have data in Google Ads
 *    - Return null for missing metrics rather than omitting the keyword
 * 
 * Reference:
 * - Google Ads API docs: https://developers.google.com/google-ads/api/docs/start
 * - Keyword Plan Idea Service: https://developers.google.com/google-ads/api/docs/keyword-planning/overview
 */
export async function fetchKeywordMetricsGoogleAds(
  keywords: string[],
  city: string,
  state: string
): Promise<RawKeywordMetric[]> {
  const unique = Array.from(new Set(keywords.map((k) => k.trim()))).filter(
    Boolean
  );

  // Validate required environment variables
  const requiredEnvVars = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_CUSTOMER_ID",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error(
      `Missing required Google Ads env vars: ${missingVars.join(", ")}. Falling back to mock metrics.`
    );
    return fetchKeywordMetricsMock(unique, city, state);
  }

  // Real implementation via Google Ads REST + OAuth (no new dependencies).
  // Best-effort: partial failures return null metrics for affected keywords; never drop rows.
  try {
    const { fetchKeywordHistoricalMetricsGoogleAds } = await import("./google-ads/keywordPlanner");
    const { metrics, diagnostics } = await fetchKeywordHistoricalMetricsGoogleAds({
      keywords: unique,
      city,
      state,
      language: "English",
    });

    if (!diagnostics.ok) {
      console.warn("[LKRT][GoogleAds] metrics diagnostics", diagnostics);
    }

    return metrics.map((m) => {
      const low = m.lowTopOfPageBidUsd;
      const high = m.highTopOfPageBidUsd;
      const avgCpc = m.averageCpcUsd ?? (typeof low === "number" && typeof high === "number" ? (low + high) / 2 : null);
      return {
        keyword: m.keyword,
        monthlySearchesExact: m.avgMonthlySearches,
        cpcUsd: avgCpc,
        adsCompetitionIndex: m.competitionIndex01,
        lowTopOfPageBidUsd: m.lowTopOfPageBidUsd,
        highTopOfPageBidUsd: m.highTopOfPageBidUsd,
        dataSource: "google-ads" as const,
      };
    });
  } catch (err) {
    console.warn(
      "[LKRT][GoogleAds] Failed to fetch Keyword Planner metrics; falling back to mock.",
      err
    );
    return fetchKeywordMetricsMock(unique, city, state);
  }
}

export async function fetchKeywordMetricsWithDiagnostics(
  keywords: string[],
  city: string,
  state: string
): Promise<{ metrics: RawKeywordMetric[]; diagnostics: KeywordMetricsDiagnostics }> {
  const source = process.env.LOCAL_KEYWORD_METRICS_SOURCE || "mock";

  if (source !== "google-ads") {
    return {
      metrics: await fetchKeywordMetricsMock(keywords, city, state),
      diagnostics: { ok: true, source: "mock" },
    };
  }

  const hasCredentials =
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_CUSTOMER_ID &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!hasCredentials) {
    return {
      metrics: await fetchKeywordMetricsMock(keywords, city, state),
      diagnostics: {
        ok: false,
        source: "google-ads",
        code: "LKRT_GOOGLE_ADS_CONFIG_MISSING",
        message: "Google Ads source selected but required credentials are missing; using mock metrics.",
        fallbackUsed: true,
      },
    };
  }

  // If Google Ads call fails unexpectedly, fetchKeywordMetricsGoogleAds will fall back to mock.
  // We detect fallback by checking dataSource on returned metrics.
  const metrics = await fetchKeywordMetricsGoogleAds(keywords, city, state);
  const usedMockFallback = metrics.some((m) => m.dataSource === "mock");

  return {
    metrics,
    diagnostics: usedMockFallback
      ? {
          ok: false,
          source: "google-ads",
          code: "LKRT_GOOGLE_ADS_REQUEST_FAILED",
          message: "Google Ads Keyword Planner request failed; using mock metrics fallback.",
          fallbackUsed: true,
        }
      : { ok: true, source: "google-ads" },
  };
}

/**
 * Main dispatcher function for fetching keyword metrics.
 * 
 * Reads LOCAL_KEYWORD_METRICS_SOURCE env var to determine which source to use:
 * - "google-ads": Uses real Google Ads API (requires credentials)
 * - "mock" or unset: Uses mock metrics (default)
 * 
 * @param keywords - Array of keyword strings to fetch metrics for
 * @param city - City name for location targeting
 * @param state - State name for location targeting
 * @returns Promise<RawKeywordMetric[]> - Metrics for each keyword
 */
export async function fetchKeywordMetrics(
  keywords: string[],
  city: string,
  state: string
): Promise<RawKeywordMetric[]> {
  const { metrics } = await fetchKeywordMetricsWithDiagnostics(keywords, city, state);
  return metrics;
}

