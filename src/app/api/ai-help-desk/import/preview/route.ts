/**
 * AI Help Desk Website Import Preview API Route
 * 
 * Crawls a website (limited pages, same domain) and extracts content for preview.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import * as cheerio from "cheerio";
import { z } from "zod";

export const runtime = "nodejs";

// Maximum pages to crawl
const MAX_PAGES = 10;

// Preferred pages to crawl first
const PREFERRED_PATHS = [
  "/about",
  "/services",
  "/faq",
  "/contact",
  "/policies",
  "/privacy",
  "/terms",
  "/refund",
  "/returns",
];

// Zod schema for request validation
const previewRequestSchema = z.object({
  // Transitional: clients may still send businessId. It is ignored for tenant scoping.
  businessId: z.string().optional(),
  url: z.string().url("Invalid URL format"),
});

interface ExtractedPage {
  url: string;
  title: string;
  content: string;
  preview: string; // First 200 chars of content
  suggestedType: "FAQ" | "SERVICE" | "POLICY" | "NOTE";
}

/**
 * Extract readable text from HTML
 */
function extractText(html: string): string {
  const $ = cheerio.load(html);

  // Remove script and style elements
  $("script, style, nav, footer, header").remove();

  // Get main content (prefer main, article, or body)
  let content = "";
  const main = $("main, article, [role='main']");
  if (main.length > 0) {
    content = main.text();
  } else {
    content = $("body").text();
  }

  // Clean up whitespace
  return content
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

/**
 * Suggest entry type based on URL and content
 */
function suggestType(url: string, title: string, content: string): "FAQ" | "SERVICE" | "POLICY" | "NOTE" {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  // Check for FAQ indicators
  if (
    urlLower.includes("faq") ||
    titleLower.includes("faq") ||
    titleLower.includes("frequently asked") ||
    contentLower.includes("frequently asked")
  ) {
    return "FAQ";
  }

  // Check for Services
  if (
    urlLower.includes("service") ||
    titleLower.includes("service") ||
    contentLower.includes("we offer") ||
    contentLower.includes("our services")
  ) {
    return "SERVICE";
  }

  // Check for Policies
  if (
    urlLower.includes("policy") ||
    urlLower.includes("privacy") ||
    urlLower.includes("terms") ||
    urlLower.includes("refund") ||
    urlLower.includes("return") ||
    titleLower.includes("policy") ||
    titleLower.includes("privacy") ||
    titleLower.includes("terms")
  ) {
    return "POLICY";
  }

  // Default to NOTE
  return "NOTE";
}

/**
 * Get base URL from a full URL
 */
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is on the same domain
 */
function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);
    return urlObj.host === baseObj.host;
  } catch {
    return false;
  }
}

/**
 * Normalize URL (resolve relative URLs)
 */
function normalizeUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Fetch and parse a single page
 */
async function fetchPage(url: string): Promise<ExtractedPage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OBD-HelpDesk-Importer/1.0)",
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Get page title
    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Untitled Page";

    // Extract content
    const content = extractText(html);

    if (!content || content.length < 50) {
      // Skip pages with too little content
      return null;
    }

    // Create preview (first 200 chars)
    const preview = content.substring(0, 200).trim() + (content.length > 200 ? "..." : "");

    // Suggest type
    const suggestedType = suggestType(url, title, content);

    return {
      url,
      title,
      content,
      preview,
      suggestedType,
    };
  } catch (error) {
    console.error(`Error fetching page ${url}:`, error);
    return null;
  }
}

/**
 * Find links on a page (same domain only)
 */
function findLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, baseUrl);
    if (isSameDomain(normalized, baseUrl)) {
      links.push(normalized);
    }
  });

  return [...new Set(links)]; // Remove duplicates
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId, role, userId } = await requireTenant();
    void businessId;
    void role;
    void userId;
    await requirePermission("AI_HELP_DESK", "VIEW");

    // Parse and validate request body
    const body = await request.json();
    const validationResult = previewRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { url } = validationResult.data as { url: string; businessId?: string };

    // Validate and normalize URL
    let normalizedUrl: string;
    try {
      const urlObj = new URL(url);
      normalizedUrl = urlObj.href;
    } catch {
      return apiErrorResponse(
        "Invalid URL format",
        "VALIDATION_ERROR",
        400
      );
    }

    const baseUrl = getBaseUrl(normalizedUrl);
    const visited = new Set<string>();
    const pages: ExtractedPage[] = [];

    // Start with the provided URL
    const queue: string[] = [normalizedUrl];

    // Also add preferred paths if they exist
    for (const path of PREFERRED_PATHS) {
      try {
        const preferredUrl = new URL(path, baseUrl).href;
        if (!visited.has(preferredUrl)) {
          queue.push(preferredUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    // Crawl pages (BFS, limited to MAX_PAGES)
    while (queue.length > 0 && pages.length < MAX_PAGES) {
      const currentUrl = queue.shift()!;

      if (visited.has(currentUrl)) {
        continue;
      }

      visited.add(currentUrl);

      // Fetch and parse page
      const page = await fetchPage(currentUrl);
      if (page) {
        pages.push(page);

        // If we haven't reached the limit, find links on this page
        if (pages.length < MAX_PAGES) {
          try {
            const response = await fetch(currentUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; OBD-HelpDesk-Importer/1.0)",
              },
              signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
              const html = await response.text();
              const links = findLinks(html, baseUrl);

              // Add new links to queue (prioritize preferred paths)
              for (const link of links) {
                if (!visited.has(link) && queue.length + pages.length < MAX_PAGES * 2) {
                  // Check if link matches preferred paths
                  const isPreferred = PREFERRED_PATHS.some((path) =>
                    link.toLowerCase().includes(path.toLowerCase())
                  );

                  if (isPreferred) {
                    queue.unshift(link); // Add to front
                  } else {
                    queue.push(link); // Add to back
                  }
                }
              }
            }
          } catch (error) {
            // Continue with other pages if this one fails
            console.error(`Error finding links on ${currentUrl}:`, error);
          }
        }
      }
    }

    return apiSuccessResponse({
      pages,
      totalPages: pages.length,
      baseUrl,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

