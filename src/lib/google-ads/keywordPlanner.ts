import {
  GoogleAdsRequestError,
  getGoogleAdsAccessToken,
  getGoogleAdsConfigFromEnv,
  googleAdsFetchJson,
} from "./googleAdsRest";

export type KeywordPlannerLanguage = "English" | "Spanish" | "Bilingual";

export type KeywordPlannerDiagnostics = {
  ok: boolean;
  code?: string;
  message?: string;
  partialFailures?: number;
  attempted?: number;
};

export type KeywordPlannerHistoricalMetric = {
  keyword: string;
  avgMonthlySearches: number | null;
  competitionIndex01: number | null; // 0..1
  lowTopOfPageBidUsd: number | null;
  highTopOfPageBidUsd: number | null;
  averageCpcUsd: number | null;
  dataSource: "google-ads";
};

function uniqTrim(keywords: string[]): string[] {
  return Array.from(new Set(keywords.map((k) => k.trim()))).filter(Boolean);
}

function microsToUsd(micros: unknown): number | null {
  if (micros === null || micros === undefined) return null;
  const asNum = typeof micros === "string" ? Number(micros) : (micros as number);
  if (typeof asNum !== "number" || Number.isNaN(asNum)) return null;
  return asNum / 1_000_000;
}

function normalizeCompetitionIndex01(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const raw = typeof input === "string" ? Number(input) : (input as number);
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;

  // Google Ads can expose competition_index as 0..100. Normalize to 0..1.
  if (raw > 1) return Math.max(0, Math.min(1, raw / 100));
  return Math.max(0, Math.min(1, raw));
}

function languageConstant(language: KeywordPlannerLanguage | undefined): string {
  // Default to English.
  if (!language || language === "Bilingual") return "languageConstants/1000";
  if (language === "Spanish") return "languageConstants/1003";
  return "languageConstants/1000";
}

async function suggestGeoTargetConstants(args: {
  accessToken: string;
  locationText: string;
}): Promise<string[]> {
  // Best-effort. If this fails, callers will fall back to US-only geoTargetConstant.
  type Resp = {
    geoTargetConstantSuggestions?: Array<{
      geoTargetConstant?: { resourceName?: string };
    }>;
  };

  const { req } = getGoogleAdsConfigFromEnv();
  const resp = await googleAdsFetchJson<Resp>({
    accessToken: args.accessToken,
    req,
    path: "/geoTargetConstants:suggest",
    body: {
      locale: "en",
      countryCode: "US",
      locationNames: { names: [args.locationText] },
    },
    timeoutMs: 8_000,
  });

  const suggestions = resp.geoTargetConstantSuggestions || [];
  const resourceNames = suggestions
    .map((s) => s.geoTargetConstant?.resourceName)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  return Array.from(new Set(resourceNames));
}

function shouldRetryGoogleAdsError(err: unknown): boolean {
  if (err instanceof GoogleAdsRequestError) {
    if (err.code === "LKRT_GOOGLE_ADS_TIMEOUT") return true;
    if (err.code === "LKRT_GOOGLE_ADS_REQUEST_FAILED") {
      const s = err.httpStatus;
      if (s === 408 || s === 429) return true;
      if (typeof s === "number" && s >= 500) return true;
    }
    return false;
  }
  // Network-ish errors (best-effort)
  const msg = err instanceof Error ? err.message : String(err);
  return /network|fetch|timeout|econn|socket|abort/i.test(msg);
}

export async function fetchKeywordHistoricalMetricsGoogleAds(args: {
  keywords: string[];
  city: string;
  state: string;
  language?: KeywordPlannerLanguage;
  batchSize?: number;
}): Promise<{ metrics: KeywordPlannerHistoricalMetric[]; diagnostics: KeywordPlannerDiagnostics }> {
  const unique = uniqTrim(args.keywords);
  if (unique.length === 0) {
    return { metrics: [], diagnostics: { ok: true, attempted: 0 } };
  }

  let accessToken: string;
  let reqConfig: ReturnType<typeof getGoogleAdsConfigFromEnv>["req"];
  try {
    const cfg = getGoogleAdsConfigFromEnv();
    reqConfig = cfg.req;
    accessToken = await getGoogleAdsAccessToken(cfg.auth);
  } catch (err) {
    return {
      metrics: unique.map((keyword) => ({
        keyword,
        avgMonthlySearches: null,
        competitionIndex01: null,
        lowTopOfPageBidUsd: null,
        highTopOfPageBidUsd: null,
        averageCpcUsd: null,
        dataSource: "google-ads",
      })),
      diagnostics: {
        ok: false,
        code: err instanceof GoogleAdsRequestError ? err.code : "LKRT_GOOGLE_ADS_AUTH_FAILED",
        message: "Google Ads credentials/config invalid; falling back behavior should apply upstream.",
        attempted: unique.length,
        partialFailures: unique.length,
      },
    };
  }

  // Location targeting: best-effort city/state, fallback to US.
  const locationText = `${args.city || ""}${args.city && args.state ? ", " : ""}${args.state || ""}`.trim();
  let geoTargets: string[] = [];
  try {
    if (locationText) {
      geoTargets = await suggestGeoTargetConstants({ accessToken, locationText });
    }
  } catch {
    geoTargets = [];
  }
  if (geoTargets.length === 0) {
    geoTargets = ["geoTargetConstants/2840"]; // United States fallback
  }

  const langConst = languageConstant(args.language);
  const batchSize = Math.max(1, Math.min(100, args.batchSize ?? 80));

  type HistResp = {
    results?: Array<{
      text?: string;
      keywordMetrics?: {
        avgMonthlySearches?: number | string | null;
        competitionIndex?: number | string | null;
        lowTopOfPageBidMicros?: string | number | null;
        highTopOfPageBidMicros?: string | number | null;
        averageCpcMicros?: string | number | null;
      };
    }>;
  };

  const outMap = new Map<string, KeywordPlannerHistoricalMetric>();
  let partialFailures = 0;
  let timeouts = 0;
  let retriedBatches = 0;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      const makeRequest = () =>
        googleAdsFetchJson<HistResp>({
          accessToken,
          req: reqConfig,
          path: `/customers/${reqConfig.clientCustomerId}:generateKeywordHistoricalMetrics`,
          body: {
            keywords: batch,
            geoTargetConstants: geoTargets,
            language: langConst,
            keywordPlanNetwork: "GOOGLE_SEARCH",
          },
          timeoutMs: 15_000,
        });

      let resp: HistResp;
      try {
        resp = await makeRequest();
      } catch (err) {
        if (err instanceof GoogleAdsRequestError && err.code === "LKRT_GOOGLE_ADS_TIMEOUT") timeouts += 1;
        if (shouldRetryGoogleAdsError(err)) {
          retriedBatches += 1;
          resp = await makeRequest(); // single deterministic retry
        } else {
          throw err;
        }
      }

      const results = resp.results || [];
      results.forEach((r) => {
        const text = (r.text || "").trim();
        if (!text) return;
        const m = r.keywordMetrics || {};
        const avgMonthlySearches =
          m.avgMonthlySearches === null || m.avgMonthlySearches === undefined
            ? null
            : typeof m.avgMonthlySearches === "string"
            ? Number(m.avgMonthlySearches)
            : m.avgMonthlySearches;
        const avgMonthlySearchesNorm =
          typeof avgMonthlySearches === "number" && !Number.isNaN(avgMonthlySearches)
            ? avgMonthlySearches
            : null;

        const competitionIndex01 = normalizeCompetitionIndex01(m.competitionIndex);
        const lowTopOfPageBidUsd = microsToUsd(m.lowTopOfPageBidMicros);
        const highTopOfPageBidUsd = microsToUsd(m.highTopOfPageBidMicros);
        const averageCpcUsd = microsToUsd(m.averageCpcMicros);

        outMap.set(text.toLowerCase(), {
          keyword: text,
          avgMonthlySearches: avgMonthlySearchesNorm,
          competitionIndex01,
          lowTopOfPageBidUsd,
          highTopOfPageBidUsd,
          averageCpcUsd,
          dataSource: "google-ads",
        });
      });
    } catch (err) {
      // Batch failure: don't drop keywords; mark as partial failure and leave null metrics for that batch.
      partialFailures += batch.length;
      // eslint-disable-next-line no-console
      console.warn("[LKRT][GoogleAds] Keyword Planner batch failed", {
        code: err instanceof GoogleAdsRequestError ? err.code : "LKRT_GOOGLE_ADS_REQUEST_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const metrics: KeywordPlannerHistoricalMetric[] = unique.map((keyword) => {
    const found = outMap.get(keyword.toLowerCase());
    if (found) return found;
    return {
      keyword,
      avgMonthlySearches: null,
      competitionIndex01: null,
      lowTopOfPageBidUsd: null,
      highTopOfPageBidUsd: null,
      averageCpcUsd: null,
      dataSource: "google-ads",
    };
  });

  const ok = partialFailures === 0;
  return {
    metrics,
    diagnostics: ok
      ? { ok: true, attempted: unique.length, partialFailures: 0 }
      : {
          ok: false,
          code: timeouts > 0 ? "LKRT_GOOGLE_ADS_TIMEOUT" : "LKRT_GOOGLE_ADS_REQUEST_FAILED",
          message:
            timeouts > 0
              ? `One or more Google Ads Keyword Planner batches timed out (retried ${retriedBatches} batch${retriedBatches === 1 ? "" : "es"}).`
              : `One or more Google Ads Keyword Planner batches failed (retried ${retriedBatches} batch${retriedBatches === 1 ? "" : "es"}).`,
          attempted: unique.length,
          partialFailures,
        },
  };
}


