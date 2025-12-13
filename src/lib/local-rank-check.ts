// src/lib/local-rank-check.ts

/**
 * OBD Local Rank Check Helper
 * 
 * Provides rank checking functionality to see where a target URL appears
 * in Google search results for a specific keyword.
 * 
 * Configuration:
 * - Set LOCAL_RANK_PROVIDER env var to control which provider is used:
 *   - "mock" (default): Returns mock/fake rank data for testing
 *   - "serpapi": Uses real SerpAPI to check actual Google search results
 * 
 * SerpAPI Setup (when using "serpapi"):
 * Required environment variables:
 * - LOCAL_RANK_PROVIDER=serpapi
 * - SERPAPI_API_KEY: Your SerpAPI API key
 * 
 * To get SerpAPI credentials:
 * 1. Sign up at https://serpapi.com/
 * 2. Get your API key from the dashboard
 * 3. Add SERPAPI_API_KEY to your .env.local file
 * 
 * Note: SerpAPI has usage limits based on your plan.
 */

export interface RawRankResult {
  keyword: string;
  targetUrl: string;
  currentPositionOrganic?: number | null;
  currentPositionMaps?: number | null;
  serpSampleUrls?: string[];
  checkedAt: string;
  dataSource?: "mock" | "serpapi" | "scraper";
}

/**
 * Mock rank check implementation for testing and development.
 * 
 * Returns fake but realistic-looking rank data so the UI can be tested
 * without requiring SerpAPI access.
 */
export async function checkRankMock(
  keyword: string,
  targetUrl: string,
  city: string,
  state: string
): Promise<RawRankResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Generate a fake position (sometimes null to simulate "not found")
  const random = Math.random();
  const position =
    random > 0.2
      ? Math.floor(Math.random() * 28) + 3 // Position 3-30
      : null; // 20% chance of not found

  // Generate fake SERP sample URLs
  const fakeDomains = [
    "example.com",
    "competitor1.com",
    "competitor2.com",
    "localbusiness.com",
    "serviceprovider.net",
    "businessdirectory.org",
    "yelp.com",
    "thumbtack.com",
    "homeadvisor.com",
    "angieslist.com",
  ];

  const serpSampleUrls = Array.from({ length: 10 }, (_, i) => {
    const domain = fakeDomains[i % fakeDomains.length];
    const path = keyword.toLowerCase().replace(/\s+/g, "-");
    return `https://www.${domain}/${path}`;
  });

  // If we have a position, insert the target URL at that position
  if (position !== null && position <= 10) {
    serpSampleUrls[position - 1] = targetUrl;
  }

  return {
    keyword,
    targetUrl,
    currentPositionOrganic: position,
    currentPositionMaps: null,
    serpSampleUrls,
    checkedAt: new Date().toISOString(),
    dataSource: "mock",
  };
}

/**
 * Real SerpAPI implementation for checking actual Google search rankings.
 * 
 * TODO: Implement the following steps:
 * 
 * 1. Install SerpAPI client library:
 *    npm install serpapi
 * 
 * 2. Initialize SerpAPI client:
 *    import { getJson } from "serpapi";
 *    
 *    const apiKey = process.env.SERPAPI_API_KEY!;
 * 
 * 3. Build search query with location:
 *    const query = `${keyword} ${city} ${state}`;
 *    
 *    const params = {
 *      q: query,
 *      location: `${city}, ${state}, United States`,
 *      api_key: apiKey,
 *      engine: "google",
 *      num: 100, // Get top 100 results
 *    };
 * 
 * 4. Call SerpAPI:
 *    const response = await getJson(params);
 * 
 * 5. Parse organic results:
 *    const organicResults = response.organic_results || [];
 *    const serpSampleUrls = organicResults
 *      .slice(0, 10)
 *      .map((result: any) => result.link);
 * 
 * 6. Find target URL position:
 *    const targetIndex = organicResults.findIndex(
 *      (result: any) => result.link === targetUrl || result.link.includes(new URL(targetUrl).hostname)
 *    );
 *    const currentPositionOrganic = targetIndex >= 0 ? targetIndex + 1 : null;
 * 
 * 7. Handle Maps results (optional):
 *    const localResults = response.local_results || [];
 *    const mapsIndex = localResults.findIndex(
 *      (result: any) => result.link === targetUrl
 *    );
 *    const currentPositionMaps = mapsIndex >= 0 ? mapsIndex + 1 : null;
 * 
 * 8. Handle errors:
 *    - If API call fails, return result with null position
 *    - Log errors for debugging
 *    - Consider rate limiting (SerpAPI has quotas)
 * 
 * 9. Return RawRankResult:
 *    return {
 *      keyword,
 *      targetUrl,
 *      currentPositionOrganic,
 *      currentPositionMaps,
 *      serpSampleUrls,
 *      checkedAt: new Date().toISOString(),
 *      dataSource: "serpapi",
 *    };
 * 
 * Reference:
 * - SerpAPI docs: https://serpapi.com/search-api
 * - SerpAPI Node.js: https://github.com/serpapi/google-search-results-nodejs
 */
export async function checkRankSerpApi(
  keyword: string,
  targetUrl: string,
  city: string,
  state: string
): Promise<RawRankResult> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    console.error(
      "SERPAPI_API_KEY is missing. Falling back to mock rank check."
    );
    return checkRankMock(keyword, targetUrl, city, state);
  }

  // TODO: Initialize SerpAPI client
  // import { getJson } from "serpapi";

  // TODO: Build search query with location
  // const query = `${keyword} ${city} ${state}`;
  // const params = {
  //   q: query,
  //   location: `${city}, ${state}, United States`,
  //   api_key: apiKey,
  //   engine: "google",
  //   num: 100,
  // };

  // TODO: Call SerpAPI
  // const response = await getJson(params);

  // TODO: Parse organic results
  // const organicResults = response.organic_results || [];
  // const serpSampleUrls = organicResults.slice(0, 10).map((r: any) => r.link);

  // TODO: Find target URL position
  // const targetIndex = organicResults.findIndex(
  //   (result: any) => result.link === targetUrl || result.link.includes(new URL(targetUrl).hostname)
  // );
  // const currentPositionOrganic = targetIndex >= 0 ? targetIndex + 1 : null;

  // TODO: Handle Maps results (optional)
  // const localResults = response.local_results || [];
  // const mapsIndex = localResults.findIndex((r: any) => r.link === targetUrl);
  // const currentPositionMaps = mapsIndex >= 0 ? mapsIndex + 1 : null;

  // For now, return empty result (will be filled in when SerpAPI is implemented)
  return {
    keyword,
    targetUrl,
    currentPositionOrganic: null,
    currentPositionMaps: null,
    serpSampleUrls: [],
    checkedAt: new Date().toISOString(),
    dataSource: "serpapi",
  };
}

/**
 * Main dispatcher function for checking keyword rankings.
 * 
 * Reads LOCAL_RANK_PROVIDER env var to determine which provider to use:
 * - "serpapi": Uses real SerpAPI (requires SERPAPI_API_KEY)
 * - "mock" or unset: Uses mock rank check (default)
 * 
 * @param keyword - The keyword to check ranking for
 * @param targetUrl - The URL to find in search results
 * @param city - City name for location targeting
 * @param state - State name for location targeting
 * @returns Promise<RawRankResult> - Rank check result with position and sample URLs
 */
export async function checkRank(
  keyword: string,
  targetUrl: string,
  city: string,
  state: string
): Promise<RawRankResult> {
  const provider = process.env.LOCAL_RANK_PROVIDER || "mock";

  if (provider === "serpapi") {
    // Check if SerpAPI credentials are present
    if (process.env.SERPAPI_API_KEY) {
      return checkRankSerpApi(keyword, targetUrl, city, state);
    } else {
      console.warn(
        "LOCAL_RANK_PROVIDER is set to 'serpapi' but SERPAPI_API_KEY is missing. Falling back to mock rank check."
      );
      return checkRankMock(keyword, targetUrl, city, state);
    }
  }

  // Default to mock
  return checkRankMock(keyword, targetUrl, city, state);
}

