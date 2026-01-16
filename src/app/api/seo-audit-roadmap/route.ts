import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  SEOAuditRoadmapRequest,
  SEOAuditRoadmapResponse,
  AuditCategoryResult,
  RoadmapItem,
  CategoryStatus,
} from "@/app/apps/seo-audit-roadmap/types";
import { isDemoRequest } from "@/lib/demo/assert-not-demo";
import { cookies } from "next/headers";
import { resolveBusinessIdServer } from "@/lib/utils/resolve-business-id.server";
import type { SeoAuditReport, SeoAuditReportStatus } from "@prisma/client";

/**
 * FIXTURE TEST HELPER
 * 
 * For deterministic QA, paste these HTML snippets into the pageContent field:
 * 
 * BAD (0-30 points):
 * <html><head><title>Test</title></head><body><h1>Hello</h1><p>Short content.</p></body></html>
 * 
 * MID (40-60 points):
 * <html><head><title>Plumbing Services in Ocala - 30 chars</title><meta name="description" content="Professional plumbing services in Ocala, Florida. We provide quality work."></head><body><h1>Plumbing Services Ocala</h1><h2>Our Services</h2><p>We offer plumbing services in Ocala, Florida. Our team provides quality plumbing work for residential and commercial clients. Contact us for plumbing needs in Ocala.</p><img src="plumber.jpg" alt="Plumber"><a href="/about">About</a></body></html>
 * 
 * GREAT (80-100 points):
 * <html><head><title>Plumbing Services in Ocala, Florida - Expert Repairs</title><meta name="description" content="Expert plumbing services in Ocala, Florida. Licensed plumbers providing quality repairs, installations, and maintenance for residential and commercial properties."><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><h1>Expert Plumbing Services in Ocala, Florida</h1><h2>Our Services</h2><p>We provide comprehensive plumbing services in Ocala, Florida. Our licensed plumbers specialize in residential and commercial plumbing work. Whether you need emergency repairs, installations, or maintenance, our Ocala plumbing team is ready to help. Contact us today for quality plumbing services in Ocala, Florida.</p><h2>Why Choose Us</h2><p>Our Ocala plumbing professionals have years of experience serving Florida residents and businesses.</p><img src="plumber.jpg" alt="Licensed plumber in Ocala"><img src="work.jpg" alt="Plumbing work"><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a><a href="tel:+1234567890">Call Us</a><a href="mailto:info@example.com">Email</a></body></html>
 */

// Request validation schema
const seoAuditRoadmapRequestSchema = z.object({
  pageUrl: z.string().url().refine(
    (url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Only HTTP and HTTPS URLs are allowed" }
  ).optional(),
  pageContent: z.string().optional(),
  primaryService: z.string().min(1, "Primary service is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  businessType: z.string().optional(),
  targetAudience: z.enum(["Residential", "Commercial", "Both"]).optional(),
}).refine(
  (data) => data.pageUrl || data.pageContent,
  {
    message: "Either pageUrl or pageContent must be provided",
    path: ["pageUrl"],
  }
).refine(
  (data) => !(data.pageUrl && data.pageContent),
  {
    message: "Provide either pageUrl OR pageContent, not both",
    path: ["pageUrl"],
  }
);

// Generate request ID
function generateRequestId(): string {
  return `seo-audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function buildAuditFromReport(report: SeoAuditReport): SEOAuditRoadmapResponse | null {
  if (!report || report.status !== "COMPLETED") return null;

  const findings = report.findings as any;
  const roadmap = report.roadmap as any;

  if (!findings || typeof findings !== "object") return null;

  return {
    score: typeof findings.score === "number" ? findings.score : 0,
    band: typeof findings.band === "string" ? findings.band : "Unknown",
    summary: typeof findings.summary === "string" ? findings.summary : "",
    auditedUrl: typeof findings.auditedUrl === "string" ? findings.auditedUrl : undefined,
    categoryResults: Array.isArray(findings.categoryResults) ? findings.categoryResults : [],
    roadmap: Array.isArray(roadmap) ? roadmap : [],
    meta: {
      requestId: report.id,
      auditedAtISO: (report.completedAt ?? report.updatedAt).toISOString(),
    },
  };
}

// Fetch page content from URL with security hardening
async function fetchPageContent(url: string): Promise<string> {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS URLs are allowed");
    }

    // Prevent SSRF: block localhost and private IPs
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      (hostname.startsWith("172.") && parseInt(hostname.split(".")[1] || "0") >= 16 && parseInt(hostname.split(".")[1] || "0") <= 31) ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]"
    ) {
      throw new Error("Local and private network URLs are not allowed");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEOAuditBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      // Check final URL after redirects for SSRF protection
      const finalUrl = response.url;
      if (finalUrl) {
        try {
          const finalUrlObj = new URL(finalUrl);
          const finalHostname = finalUrlObj.hostname.toLowerCase();
          if (
            finalHostname === "localhost" ||
            finalHostname === "127.0.0.1" ||
            finalHostname.startsWith("192.168.") ||
            finalHostname.startsWith("10.") ||
            (finalHostname.startsWith("172.") && parseInt(finalHostname.split(".")[1] || "0") >= 16 && parseInt(finalHostname.split(".")[1] || "0") <= 31) ||
            finalHostname === "0.0.0.0" ||
            finalHostname === "[::1]"
          ) {
            throw new Error("Redirected to a blocked host. Private/local network URLs are not allowed.");
          }
        } catch (urlError) {
          if (urlError instanceof Error && urlError.message.includes("blocked host")) {
            throw urlError;
          }
          // If URL parsing fails, continue (might be relative redirect)
        }
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        throw new Error(`Invalid content type: ${contentType}. Only HTML pages are supported.`);
      }

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied (403). The page may require authentication or be blocked.");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Cap max bytes to prevent memory exhaustion (5MB limit)
      const MAX_BYTES = 5 * 1024 * 1024;
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
        throw new Error("Page content is too large (over 5MB). Please use the page content field instead.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read page content");
      }

      let html = "";
      let totalBytes = 0;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.length;
        if (totalBytes > MAX_BYTES) {
          reader.cancel();
          throw new Error("Page content exceeds size limit (5MB). Please use the page content field instead.");
        }

        html += decoder.decode(value, { stream: true });
      }

      return html;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          throw new Error("Request timed out. The page took too long to load.");
        }
        throw fetchError;
      }
      throw new Error("Failed to fetch page: Unknown error");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
    throw new Error("Failed to fetch page: Unknown error");
  }
}

// Escape special regex characters for safe pattern matching
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extract text content from HTML (safely, no execution)
function extractTextFromHTML(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// Extract HTML elements for audit
interface ExtractedData {
  title: string;
  metaDescription: string;
  h1Texts: string[];
  h2Count: number;
  h3Count: number;
  bodyText: string;
  wordCount: number;
  images: Array<{ hasAlt: boolean }>;
  links: Array<{ href: string; isInternal: boolean }>;
  viewportMeta: string | null;
}

function truncateForEvidence(value: string, maxLen: number): string {
  const s = (value || "").trim().replace(/\s+/g, " ");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function buildEvidenceAndConfidence(args: {
  category: AuditCategoryResult;
  data: ExtractedData;
  context: SEOAuditRoadmapRequest;
  auditedUrl?: string;
}): Pick<AuditCategoryResult, "evidence" | "confidence"> {
  const { category, data, context, auditedUrl } = args;
  const checked: string[] = [];
  const observed: string[] = [];

  const hasUrl = !!(auditedUrl && auditedUrl.trim());
  const sourceNote = hasUrl ? "Input source: page URL fetch" : "Input source: pasted page content";

  const city = context.city?.trim() || "";
  const state = context.state?.trim() || "";
  const service = context.primaryService?.trim() || "";

  // Default: if we can't confidently produce evidence, omit evidence and set LOW.
  // In this implementation, we can deterministically derive evidence for all categories from extracted HTML.
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  let notes: string | undefined = undefined;

  switch (category.key) {
    case "title-tag": {
      checked.push("<title> tag present");
      checked.push("Length between 20–60 characters");
      checked.push("Contains city or primary service keyword");
      observed.push(`Title present: ${data.title ? "Yes" : "No"}`);
      if (data.title) {
        observed.push(`Title length: ${data.title.length} characters`);
        observed.push(`Title text: "${truncateForEvidence(data.title, 90)}"`);
      }
      confidence = "HIGH";
      break;
    }
    case "meta-description": {
      checked.push('<meta name="description" ...> present');
      checked.push("Length between 70–160 characters");
      checked.push("Contains city or primary service keyword");
      observed.push(`Meta description present: ${data.metaDescription ? "Yes" : "No"}`);
      if (data.metaDescription) {
        observed.push(`Meta description length: ${data.metaDescription.length} characters`);
        observed.push(`Meta description: "${truncateForEvidence(data.metaDescription, 120)}"`);
      }
      confidence = "HIGH";
      break;
    }
    case "h1-tag": {
      checked.push("<h1> tags count (exactly one recommended)");
      checked.push("H1 contains primary service and city");
      observed.push(`H1 count: ${data.h1Texts.length}`);
      if (data.h1Texts.length > 0) {
        observed.push(`H1 text: "${truncateForEvidence(data.h1Texts[0] || "", 90)}"`);
      }
      notes =
        "Some themes inject H1 tags dynamically via JavaScript; this audit is based on the provided static HTML/content.";
      confidence = "HIGH";
      break;
    }
    case "heading-structure": {
      checked.push("At least one H2 heading");
      checked.push("H2/H3 hierarchy present (if using H3, prefer H2 first)");
      observed.push(`H2 count: ${data.h2Count}`);
      observed.push(`H3 count: ${data.h3Count}`);
      confidence = "HIGH";
      break;
    }
    case "content-length": {
      checked.push("Body text extracted (scripts/styles removed)");
      checked.push("Word count threshold (400 minimum, 600+ recommended)");
      observed.push(`Word count (approx): ${data.wordCount}`);
      confidence = "HIGH";
      break;
    }
    case "images-alt": {
      checked.push("<img> tags detected");
      checked.push("Alt attribute coverage (aim for 80%+)");
      const total = data.images.length;
      const withAlt = data.images.filter((img) => img.hasAlt).length;
      const missing = Math.max(0, total - withAlt);
      observed.push(`Images found: ${total}`);
      observed.push(`Images with alt text: ${withAlt}`);
      observed.push(`Images missing alt text: ${missing}`);
      confidence = "HIGH";
      break;
    }
    case "internal-links": {
      checked.push("Internal links count (3+ recommended)");
      checked.push("Internal link classification using page hostname when available");
      const internal = data.links.filter((l) => l.isInternal).length;
      observed.push(`Internal links found: ${internal}`);
      if (!hasUrl) {
        notes =
          "Internal link classification is less precise when auditing pasted content without a page URL (no hostname context).";
        confidence = "MEDIUM";
      } else {
        confidence = "HIGH";
      }
      break;
    }
    case "local-keywords": {
      checked.push(`Mentions city keyword ("${city}") in body text`);
      checked.push(`Mentions state keyword ("${state}") in body text`);
      checked.push(`Mentions primary service keyword ("${service}") in body text`);
      // Note: runAudit already uses regex counting; we don't repeat counts here to avoid duplicate logic,
      // but we can deterministically re-check simple includes to provide verifiable evidence.
      const bodyLower = data.bodyText.toLowerCase();
      observed.push(`City found in body: ${city ? (bodyLower.includes(city.toLowerCase()) ? "Yes" : "No") : "Unknown"}`);
      observed.push(
        `State found in body: ${state ? (bodyLower.includes(state.toLowerCase()) ? "Yes" : "No") : "Unknown"}`
      );
      observed.push(
        `Primary service found in body: ${service ? (bodyLower.includes(service.toLowerCase()) ? "Yes" : "No") : "Unknown"}`
      );
      notes = "Keyword detection is based on the extracted text from the provided HTML/content (not a live crawl).";
      confidence = "MEDIUM";
      break;
    }
    case "mobile-friendly": {
      checked.push('<meta name="viewport" ...> present');
      checked.push('Viewport contains "width=device-width"');
      observed.push(`Viewport meta present: ${data.viewportMeta ? "Yes" : "No"}`);
      if (data.viewportMeta) {
        observed.push(`Viewport content: "${truncateForEvidence(data.viewportMeta, 90)}"`);
      }
      confidence = "HIGH";
      break;
    }
    case "conversion-signals": {
      checked.push("CTA keywords present (call/book/request/quote/schedule/contact)");
      checked.push("Contact method present (tel:/mailto: link or /contact link)");
      const bodyLower = data.bodyText.toLowerCase();
      const ctaKeywords = ["call", "book", "request", "quote", "schedule", "contact"];
      const matched = ctaKeywords.filter((k) => bodyLower.includes(k));
      const hasPhoneLink = data.links.some((l) => l.href.toLowerCase().startsWith("tel:"));
      const hasEmailLink = data.links.some((l) => l.href.toLowerCase().startsWith("mailto:"));
      const hasContactLink = data.links.some((l) => l.href.toLowerCase().includes("/contact"));
      observed.push(`CTA keywords found: ${matched.length ? matched.join(", ") : "None"}`);
      observed.push(`Phone link (tel:) present: ${hasPhoneLink ? "Yes" : "No"}`);
      observed.push(`Email link (mailto:) present: ${hasEmailLink ? "Yes" : "No"}`);
      observed.push(`Contact page link (/contact) present: ${hasContactLink ? "Yes" : "No"}`);
      notes = "Conversion signals are heuristic (keyword + link presence) and may not capture all CTA patterns.";
      confidence = "MEDIUM";
      break;
    }
    default: {
      confidence = "LOW";
      notes = sourceNote;
      break;
    }
  }

  // Always include source note (keeps evidence honest without becoming a crawler).
  if (notes) {
    notes = `${sourceNote}${notes ? ` · ${notes}` : ""}`;
  } else {
    notes = sourceNote;
  }

  // If nothing meaningful was observed, omit evidence and keep LOW per spec.
  const hasMeaningfulEvidence = checked.length > 0 || observed.length > 0 || (notes?.trim().length ?? 0) > 0;
  if (!hasMeaningfulEvidence) {
    return { confidence: "LOW" };
  }

  return {
    evidence: {
      checked: checked.length ? checked : undefined,
      observed: observed.length ? observed : undefined,
      notes: notes?.trim() || undefined,
    },
    confidence,
  };
}

function attachEvidenceAndConfidence(args: {
  categoryResults: AuditCategoryResult[];
  data: ExtractedData;
  context: SEOAuditRoadmapRequest;
  auditedUrl?: string;
}): AuditCategoryResult[] {
  return args.categoryResults.map((cat) => ({
    ...cat,
    ...buildEvidenceAndConfidence({
      category: cat,
      data: args.data,
      context: args.context,
      auditedUrl: args.auditedUrl,
    }),
    // Stable id for compare (Tier 5B+). Backwards compatible: optional field.
    findingId:
      typeof cat.findingId === "string" && cat.findingId.trim().length > 0
        ? cat.findingId
        : `seo-finding:${cat.key}`,
  }));
}

function extractHTMLData(html: string, baseUrl?: string): ExtractedData {
  // Title - robust extraction handling nested tags
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = "";
  if (titleMatch) {
    const innerHtml = titleMatch[1];
    title = extractTextFromHTML(innerHtml).trim();
  }

  // Meta description - robust extraction handling attribute order and whitespace variations
  let metaDescription = "";
  const metaTags = html.match(/<meta[^>]*>/gi) || [];
  for (const metaTag of metaTags) {
    // Support name=description with/without quotes and whitespace variations
    const nameMatch = metaTag.match(/\bname\s*=\s*["']?description["']?\b/i);
    if (nameMatch) {
      // Support content="..." with whitespace variations
      const contentMatch = metaTag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
      if (contentMatch) {
        metaDescription = contentMatch[1].trim();
        break;
      }
    }
  }

  // H1 tags - robust extraction handling nested tags
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Texts = h1Matches.map(m => {
    const innerMatch = m.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (innerMatch) {
      // Extract text from inner HTML (handles nested tags)
      const innerHtml = innerMatch[1];
      const text = extractTextFromHTML(innerHtml);
      return text.trim();
    }
    return "";
  }).filter(t => t.length > 0);

  // H2 and H3 counts
  const h2Matches = html.match(/<h2[^>]*>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>/gi) || [];
  const h2Count = h2Matches.length;
  const h3Count = h3Matches.length;

  // Body text
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const bodyText = extractTextFromHTML(bodyHtml);
  const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

  // Images
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const images = imgMatches.map(img => {
    const altMatch = img.match(/alt=["']([^"']*)["']/i);
    const hasAlt = !!altMatch && altMatch[1].trim().length > 0;
    return { hasAlt };
  });

  // Links - include all links but exclude non-page links from internal count
  // tel:/mailto: links are included for conversion signals detection
  const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || [];
  const baseHostname = baseUrl ? new URL(baseUrl).hostname : null;
  const links = linkMatches.map(link => {
    const hrefMatch = link.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return { href: "", isInternal: false };
    const href = hrefMatch[1];
    const lowerHref = href.toLowerCase();
    let isInternal = false;
    
    // Exclude from internal count: anchors, javascript, data URIs
    // tel:/mailto:/sms: are included in links array but marked as isInternal=false
    if (
      lowerHref.startsWith("#") ||
      lowerHref.startsWith("javascript:") ||
      lowerHref.startsWith("data:")
    ) {
      isInternal = false;
    } else if (
      lowerHref.startsWith("mailto:") ||
      lowerHref.startsWith("tel:") ||
      lowerHref.startsWith("sms:")
    ) {
      // Include tel:/mailto:/sms: in links array but mark as not internal
      isInternal = false;
    } else if (href.startsWith("/")) {
      // Relative path starting with / is internal
      isInternal = true;
    } else if (!href.startsWith("http")) {
      // Relative path without / (e.g., "about-us") - treat as internal if not a scheme
      isInternal = true;
    } else if (baseHostname) {
      // Absolute URL - check if same hostname
      try {
        const linkUrl = new URL(href);
        isInternal = linkUrl.hostname === baseHostname;
      } catch {
        // Invalid URL, don't count as internal
        isInternal = false;
      }
    }
    return { href, isInternal };
  });

  // Viewport meta - robust extraction handling attribute order and whitespace variations
  let viewportMeta: string | null = null;
  for (const metaTag of metaTags) {
    // Support name=viewport with/without quotes and whitespace variations
    const nameMatch = metaTag.match(/\bname\s*=\s*["']?viewport["']?\b/i);
    if (nameMatch) {
      // Support content="..." with whitespace variations
      const contentMatch = metaTag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
      if (contentMatch) {
        viewportMeta = contentMatch[1];
        break;
      }
    }
  }

  return {
    title,
    metaDescription,
    h1Texts,
    h2Count,
    h3Count,
    bodyText,
    wordCount,
    images,
    links,
    viewportMeta,
  };
}

// Run audit with exact 10 categories
function runAudit(
  data: ExtractedData,
  context: SEOAuditRoadmapRequest
): AuditCategoryResult[] {
  const results: AuditCategoryResult[] = [];
  const lowerBody = data.bodyText.toLowerCase();
  const lowerTitle = data.title.toLowerCase();
  const lowerMeta = data.metaDescription.toLowerCase();
  const cityLower = context.city.toLowerCase();
  const serviceLower = context.primaryService.toLowerCase();
  const stateLower = context.state.toLowerCase();

  // 1. Title Tag (0-10)
  let titlePoints = 0;
  let titleStatus: CategoryStatus = "missing";
  let titleExplanation = "";
  let titleFix = "";

  if (!data.title) {
    titleExplanation = "Title tag is missing";
    titleFix = "Add a title tag between 20-60 characters that includes your city or primary service";
  } else {
    const titleLen = data.title.length;
    const hasCity = lowerTitle.includes(cityLower);
    const hasService = lowerTitle.includes(serviceLower);
    const hasKeyword = hasCity || hasService;

    if (titleLen >= 20 && titleLen <= 60 && hasKeyword) {
      titlePoints = 10;
      titleStatus = "pass";
      titleExplanation = "Title tag is well-optimized (20-60 chars, includes keywords)";
      titleFix = "Keep your title tag optimized";
    } else if (titleLen >= 20 && titleLen <= 60) {
      titlePoints = 5;
      titleStatus = "needs-improvement";
      titleExplanation = "Title tag length is good but missing local keywords";
      titleFix = "Add your city or primary service to the title tag";
    } else {
      titlePoints = 0;
      titleStatus = "needs-improvement"; // Present but wrong length, not missing
      titleExplanation = `Title tag is ${titleLen < 20 ? "too short" : "too long"} (${titleLen} chars, should be 20-60)`;
      titleFix = "Update title tag to be 20-60 characters and include your city or primary service";
    }
  }

  results.push({
    key: "title-tag",
    label: "Title Tag",
    pointsEarned: titlePoints,
    pointsMax: 10,
    status: titleStatus,
    shortExplanation: titleExplanation,
    fixRecommendation: titleFix,
  });

  // 2. Meta Description (0-10)
  let metaPoints = 0;
  let metaStatus: CategoryStatus = "missing";
  let metaExplanation = "";
  let metaFix = "";

  if (!data.metaDescription) {
    metaExplanation = "Meta description is missing";
    metaFix = "Add a meta description between 70-160 characters that includes your city or primary service";
  } else {
    const metaLen = data.metaDescription.length;
    const hasCity = lowerMeta.includes(cityLower);
    const hasService = lowerMeta.includes(serviceLower);
    const hasKeyword = hasCity || hasService;

    if (metaLen >= 70 && metaLen <= 160 && hasKeyword) {
      metaPoints = 10;
      metaStatus = "pass";
      metaExplanation = "Meta description is well-optimized (70-160 chars, includes keywords)";
      metaFix = "Keep your meta description optimized";
    } else if (metaLen >= 70 && metaLen <= 160) {
      metaPoints = 5;
      metaStatus = "needs-improvement";
      metaExplanation = "Meta description length is good but missing local keywords";
      metaFix = "Add your city or primary service to the meta description";
    } else {
      metaPoints = 0;
      metaStatus = "needs-improvement"; // Present but wrong length, not missing
      metaExplanation = `Meta description is ${metaLen < 70 ? "too short" : "too long"} (${metaLen} chars, should be 70-160)`;
      metaFix = "Update meta description to be 70-160 characters and include your city or primary service";
    }
  }

  results.push({
    key: "meta-description",
    label: "Meta Description",
    pointsEarned: metaPoints,
    pointsMax: 10,
    status: metaStatus,
    shortExplanation: metaExplanation,
    fixRecommendation: metaFix,
  });

  // 3. H1 Tag (0-10)
  let h1Points = 0;
  let h1Status: CategoryStatus = "missing";
  let h1Explanation = "";
  let h1Fix = "";

  if (data.h1Texts.length === 0) {
    h1Explanation = "H1 tag is missing. Note: Some themes inject H1 tags dynamically via JavaScript, which may not be detected in static HTML.";
    h1Fix = "Add exactly one H1 tag that includes your primary service and city. If your theme adds H1 dynamically, ensure it includes your keywords.";
  } else if (data.h1Texts.length > 1) {
    h1Points = 5;
    h1Status = "needs-improvement";
    h1Explanation = `Multiple H1 tags found (${data.h1Texts.length}), should be exactly one`;
    h1Fix = "Remove extra H1 tags, keep only one that includes your primary service and city";
  } else {
    const h1Text = data.h1Texts[0].toLowerCase();
    const hasService = h1Text.includes(serviceLower);
    const hasCity = h1Text.includes(cityLower);

    if (hasService && hasCity) {
      h1Points = 10;
      h1Status = "pass";
      h1Explanation = "H1 tag is present and includes both primary service and city";
      h1Fix = "Keep your H1 tag optimized";
    } else if (hasService || hasCity) {
      h1Points = 5;
      h1Status = "needs-improvement";
      h1Explanation = "H1 tag exists but missing one keyword (service or city)";
      h1Fix = "Add the missing keyword (city or primary service) to your H1 tag";
    } else {
      h1Points = 0;
      h1Status = "missing";
      h1Explanation = "H1 tag exists but missing both keywords";
      h1Fix = "Update H1 tag to include your primary service and city";
    }
  }

  results.push({
    key: "h1-tag",
    label: "H1 Tag",
    pointsEarned: h1Points,
    pointsMax: 10,
    status: h1Status,
    shortExplanation: h1Explanation,
    fixRecommendation: h1Fix,
  });

  // 4. Heading Structure (0-10)
  let headingPoints = 0;
  let headingStatus: CategoryStatus = "missing";
  let headingExplanation = "";
  let headingFix = "";

  if (data.h2Count === 0 && data.h3Count === 0) {
    headingExplanation = "No H2 or H3 headings found";
    headingFix = "Add at least one H2 heading to structure your content";
  } else if (data.h2Count === 0) {
    headingPoints = 5;
    headingStatus = "needs-improvement";
    headingExplanation = "Has H3 headings but no H2 headings (weak structure)";
    headingFix = "Add H2 headings to create a logical content hierarchy";
  } else if (data.h1Texts.length > 1) {
    headingPoints = 5;
    headingStatus = "needs-improvement";
    headingExplanation = "Multiple H1 tags found (weak structure)";
    headingFix = "Use one H1 and multiple H2 headings for better structure";
  } else {
    headingPoints = 10;
    headingStatus = "pass";
    headingExplanation = `Good heading structure (${data.h2Count} H2${data.h3Count > 0 ? `, ${data.h3Count} H3` : ""})`;
    headingFix = "Maintain your heading structure";
  }

  results.push({
    key: "heading-structure",
    label: "Heading Structure",
    pointsEarned: headingPoints,
    pointsMax: 10,
    status: headingStatus,
    shortExplanation: headingExplanation,
    fixRecommendation: headingFix,
  });

  // 5. Content Length (0-10)
  let contentPoints = 0;
  let contentStatus: CategoryStatus = "missing";
  let contentExplanation = "";
  let contentFix = "";

  if (data.wordCount >= 600) {
    contentPoints = 10;
    contentStatus = "pass";
    contentExplanation = `Content length is excellent (${data.wordCount} words)`;
    contentFix = "Maintain comprehensive content";
  } else if (data.wordCount >= 400) {
    contentPoints = 5;
    contentStatus = "needs-improvement";
    contentExplanation = `Content length is adequate (${data.wordCount} words, 600+ recommended)`;
    contentFix = "Expand content to at least 600 words for better SEO";
  } else {
    contentPoints = 0;
    contentStatus = "missing";
    contentExplanation = `Content is too short (${data.wordCount} words, minimum 400 recommended)`;
    contentFix = "Expand content to at least 400-600 words with valuable information";
  }

  results.push({
    key: "content-length",
    label: "Content Length",
    pointsEarned: contentPoints,
    pointsMax: 10,
    status: contentStatus,
    shortExplanation: contentExplanation,
    fixRecommendation: contentFix,
  });

  // 6. Images with Alt Text (0-10)
  let imagePoints = 0;
  let imageStatus: CategoryStatus = "missing";
  let imageExplanation = "";
  let imageFix = "";

  if (data.images.length === 0) {
    imagePoints = 0; // No images = missing, not a free pass
    imageStatus = "missing";
    imageExplanation = "No images found";
    imageFix = "Add at least one relevant image with descriptive alt text to improve accessibility and image search visibility";
  } else {
    const withAlt = data.images.filter(img => img.hasAlt).length;
    const coverage = (withAlt / data.images.length) * 100;

    if (coverage >= 80) {
      imagePoints = 10;
      imageStatus = "pass";
      imageExplanation = `All images have alt text (${withAlt}/${data.images.length}, ${Math.round(coverage)}%)`;
      imageFix = "Keep alt text on all images";
    } else {
      imagePoints = 5;
      imageStatus = "needs-improvement";
      imageExplanation = `Some images missing alt text (${withAlt}/${data.images.length}, ${Math.round(coverage)}%)`;
      imageFix = `Add alt text to ${data.images.length - withAlt} image(s) (aim for 80%+ coverage)`;
    }
  }

  results.push({
    key: "images-alt",
    label: "Images with Alt Text",
    pointsEarned: imagePoints,
    pointsMax: 10,
    status: imageStatus,
    shortExplanation: imageExplanation,
    fixRecommendation: imageFix,
  });

  // 7. Internal Links (0-10)
  const internalLinks = data.links.filter(l => l.isInternal);
  let linkPoints = 0;
  let linkStatus: CategoryStatus = "missing";
  let linkExplanation = "";
  let linkFix = "";

  if (internalLinks.length >= 3) {
    linkPoints = 10;
    linkStatus = "pass";
    linkExplanation = `Good internal linking (${internalLinks.length} internal links)`;
    linkFix = "Maintain internal linking strategy";
  } else if (internalLinks.length >= 1) {
    linkPoints = 5;
    linkStatus = "needs-improvement";
    linkExplanation = `Some internal links found (${internalLinks.length}, 3+ recommended)`;
    linkFix = `Add ${3 - internalLinks.length} more internal links to related pages`;
  } else {
    linkPoints = 0;
    linkStatus = "missing";
    linkExplanation = "No internal links found";
    linkFix = "Add at least 3 internal links to other relevant pages on your site";
  }

  results.push({
    key: "internal-links",
    label: "Internal Links",
    pointsEarned: linkPoints,
    pointsMax: 10,
    status: linkStatus,
    shortExplanation: linkExplanation,
    fixRecommendation: linkFix,
  });

  // 8. Local Keywords (0-10) - use escaped regex to handle special characters
  const cityEscaped = escapeRegExp(cityLower);
  const stateEscaped = escapeRegExp(stateLower);
  const serviceEscaped = escapeRegExp(serviceLower);
  
  // Use word boundaries for single-token keywords (no spaces) to reduce false positives
  const cityPattern = cityLower.includes(" ") ? cityEscaped : `\\b${cityEscaped}\\b`;
  const statePattern = stateLower.includes(" ") ? stateEscaped : `\\b${stateEscaped}\\b`;
  const servicePattern = serviceLower.includes(" ") ? serviceEscaped : `\\b${serviceEscaped}\\b`;
  
  const cityMatches = (lowerBody.match(new RegExp(cityPattern, "gi")) || []).length;
  const stateMatches = (lowerBody.match(new RegExp(statePattern, "gi")) || []).length;
  const serviceMatches = (lowerBody.match(new RegExp(servicePattern, "gi")) || []).length;
  let localPoints = 0;
  let localStatus: CategoryStatus = "missing";
  let localExplanation = "";
  let localFix = "";

  if (cityMatches >= 2 && stateMatches >= 1 && serviceMatches >= 1) {
    localPoints = 10;
    localStatus = "pass";
    localExplanation = `Local keywords well-distributed (city: ${cityMatches}x, state: ${stateMatches}x, service: ${serviceMatches}x)`;
    localFix = "Maintain local keyword usage";
  } else if (cityMatches >= 1 || stateMatches >= 1 || serviceMatches >= 1) {
    localPoints = 5;
    localStatus = "needs-improvement";
    localExplanation = `Partial local keyword usage (city: ${cityMatches}x, state: ${stateMatches}x, service: ${serviceMatches}x)`;
    localFix = "Increase local keyword usage: city 2+ times, state 1+ time, service in body";
  } else {
    localPoints = 0;
    localStatus = "missing";
    localExplanation = "Local keywords not found in content";
    localFix = "Naturally incorporate your city (2+ times), state (1+ time), and primary service throughout the content";
  }

  results.push({
    key: "local-keywords",
    label: "Local Keywords",
    pointsEarned: localPoints,
    pointsMax: 10,
    status: localStatus,
    shortExplanation: localExplanation,
    fixRecommendation: localFix,
  });

  // 9. Mobile-Friendly (0-10)
  let mobilePoints = 0;
  let mobileStatus: CategoryStatus = "missing";
  let mobileExplanation = "";
  let mobileFix = "";

  if (!data.viewportMeta) {
    mobileExplanation = "Viewport meta tag is missing";
    mobileFix = "Add viewport meta tag: <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">";
  } else {
    const hasWidth = data.viewportMeta.includes("width=device-width");
    if (hasWidth) {
      mobilePoints = 10;
      mobileStatus = "pass";
      mobileExplanation = "Viewport meta tag is present and correct";
      mobileFix = "Keep viewport meta tag optimized";
    } else {
      mobilePoints = 5;
      mobileStatus = "needs-improvement";
      mobileExplanation = "Viewport meta tag present but missing width=device-width";
      mobileFix = "Update viewport meta tag to include width=device-width";
    }
  }

  results.push({
    key: "mobile-friendly",
    label: "Mobile-Friendly",
    pointsEarned: mobilePoints,
    pointsMax: 10,
    status: mobileStatus,
    shortExplanation: mobileExplanation,
    fixRecommendation: mobileFix,
  });

  // 10. Conversion Signals (0-10)
  const ctaKeywords = ["call", "book", "request", "quote", "schedule", "contact"];
  const hasCTA = ctaKeywords.some(keyword => lowerBody.includes(keyword));
  // Check for contact links (phone/email/contact page) - use isInternal=false links that are tel:/mailto: or contact paths
  const hasPhoneLink = data.links.some(l => l.href.toLowerCase().startsWith("tel:"));
  const hasEmailLink = data.links.some(l => l.href.toLowerCase().startsWith("mailto:"));
  const hasContactLink = data.links.some(l => {
    const lowerHref = l.href.toLowerCase();
    return (l.isInternal && lowerHref.includes("/contact")) || lowerHref.includes("/contact");
  });
  const hasContactMethod = hasPhoneLink || hasEmailLink || hasContactLink;
  let conversionPoints = 0;
  let conversionStatus: CategoryStatus = "missing";
  let conversionExplanation = "";
  let conversionFix = "";

  if (hasCTA && hasContactMethod) {
    conversionPoints = 10;
    conversionStatus = "pass";
    conversionExplanation = "Both CTA keywords and contact methods found";
    conversionFix = "Maintain clear CTAs and contact methods";
  } else if (hasCTA || hasContactMethod) {
    conversionPoints = 5;
    conversionStatus = "needs-improvement";
    conversionExplanation = hasCTA ? "CTA keywords found but missing contact links" : "Contact links found but missing CTA keywords";
    conversionFix = hasCTA ? "Add phone/email links or /contact page link" : "Add CTA keywords (call, book, request, quote, schedule, contact)";
  } else {
    conversionPoints = 0;
    conversionStatus = "missing";
    conversionExplanation = "Neither CTA keywords nor contact methods found";
    conversionFix = "Add CTA keywords (call, book, request, quote, schedule, contact) and phone/email links or /contact page link";
  }

  results.push({
    key: "conversion-signals",
    label: "Conversion Signals",
    pointsEarned: conversionPoints,
    pointsMax: 10,
    status: conversionStatus,
    shortExplanation: conversionExplanation,
    fixRecommendation: conversionFix,
  });

  return results;
}

// Generate roadmap items
function generateRoadmap(
  categoryResults: AuditCategoryResult[],
  context: SEOAuditRoadmapRequest
): RoadmapItem[] {
  const roadmap: RoadmapItem[] = [];
  let itemId = 1;

  for (const category of categoryResults) {
    // Deterministic priority based on exact point values (0/5/10)
    // HIGH: missing OR pointsEarned === 0
    // MEDIUM: needs-improvement OR pointsEarned === 5
    // OPTIONAL: otherwise (pass with 8-9 points)
    let priority: "HIGH" | "MEDIUM" | "OPTIONAL";
    if (category.status === "missing" || category.pointsEarned === 0) {
      priority = "HIGH";
    } else if (category.status === "needs-improvement" || category.pointsEarned === 5) {
      priority = "MEDIUM";
    } else {
      priority = "OPTIONAL";
    }

    // Skip OPTIONAL items for pass status with 10 points
    if (priority === "OPTIONAL" && category.pointsEarned === 10) {
      continue;
    }

    // Determine effort
    let effort: "Low" | "Medium" | "High";
    if (["title-tag", "meta-description", "mobile-friendly"].includes(category.key)) {
      effort = "Low";
    } else if (["content-length", "local-keywords"].includes(category.key)) {
      effort = "High";
    } else {
      effort = "Medium";
    }

    // Determine related app
    let relatedApp: { name: string; href: string } | undefined;
    if (["heading-structure", "content-length"].includes(category.key)) {
      relatedApp = { name: "AI Content Writer", href: "/apps/content-writer" };
    } else if (category.key === "internal-links") {
      relatedApp = { name: "Local SEO Page Builder", href: "/apps/local-seo-page-builder" };
    } else if (category.key === "conversion-signals") {
      relatedApp = { name: "Business Description Writer", href: "/apps/business-description-writer" };
    }

    // Deterministic "why it matters" copy (separate from fixRecommendation)
    const whyItMattersMap: Record<string, string> = {
      "title-tag": "Title tags directly affect search relevance and click-through rates. They appear in search results and help users understand your page.",
      "meta-description": "Meta descriptions appear in search results and can significantly improve click-through rates when optimized.",
      "h1-tag": "H1 tags help search engines understand the main topic of your page and reinforce your primary keywords.",
      "heading-structure": "Good heading structure improves readability for users and helps search engines understand your content hierarchy.",
      "content-length": "Longer, comprehensive content tends to rank better and provides more value to visitors, supporting topical authority.",
      "images-alt": "Alt text improves accessibility for screen readers and helps images rank in image search results.",
      "internal-links": "Internal linking helps search engines crawl and index your site better while distributing page authority.",
      "local-keywords": "Local keywords reinforce your geographic relevance and help you rank for local searches in your area.",
      "mobile-friendly": "Mobile-friendliness is a ranking factor and essential for user experience, as most searches happen on mobile.",
      "conversion-signals": "Clear CTAs and contact methods increase leads and encourage user action, improving conversion rates.",
    };
    const whyItMatters = whyItMattersMap[category.key] || "Improves overall SEO performance and user experience.";

    // Build next steps
    const nextSteps: string[] = [];
    if (category.key === "title-tag") {
      nextSteps.push("Edit your page's <title> tag in the HTML head");
      nextSteps.push("Keep it between 20-60 characters");
      nextSteps.push("Include your city or primary service");
    } else if (category.key === "meta-description") {
      nextSteps.push("Edit your page's meta description in the HTML head");
      nextSteps.push("Keep it between 70-160 characters");
      nextSteps.push("Include your city or primary service");
    } else if (category.key === "h1-tag") {
      nextSteps.push("Ensure exactly one <h1> tag on the page");
      nextSteps.push("Include your primary service and city in the H1");
    } else if (category.key === "heading-structure") {
      nextSteps.push("Add H2 headings to break up content sections");
      nextSteps.push("Use H3 for subsections if needed");
      nextSteps.push("Maintain logical hierarchy (H1 → H2 → H3)");
    } else if (category.key === "content-length") {
      nextSteps.push("Expand content to at least 600 words");
      nextSteps.push("Add valuable, relevant information for your audience");
      nextSteps.push("Use headings to organize longer content");
    } else if (category.key === "images-alt") {
      nextSteps.push("Edit each <img> tag to add or update alt attribute");
      nextSteps.push("Describe what the image shows");
      nextSteps.push("Include relevant keywords when appropriate");
    } else if (category.key === "internal-links") {
      nextSteps.push("Add links to other relevant pages on your site");
      nextSteps.push("Use descriptive anchor text");
      nextSteps.push("Link to related services, about page, or contact page");
    } else if (category.key === "local-keywords") {
      nextSteps.push(`Mention "${context.city}" at least 2 times naturally`);
      nextSteps.push(`Mention "${context.state}" at least once`);
      nextSteps.push(`Include "${context.primaryService}" in the body content`);
    } else if (category.key === "mobile-friendly") {
      nextSteps.push("Add viewport meta tag to <head>");
      nextSteps.push("Use: <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
    } else if (category.key === "conversion-signals") {
      nextSteps.push("Add CTA keywords: call, book, request, quote, schedule, contact");
      nextSteps.push("Add phone link: <a href=\"tel:+1234567890\">Call Us</a>");
      nextSteps.push("Add email link: <a href=\"mailto:info@example.com\">Email Us</a>");
      nextSteps.push("Or link to /contact page");
    }

    roadmap.push({
      id: `item-${itemId++}`,
      priority,
      category: category.key, // Store category key for sorting
      title: `Fix ${category.label}`,
      whatIsWrong: category.shortExplanation,
      whyItMatters: whyItMatters, // Use deterministic copy, not fixRecommendation
      nextSteps,
      estimatedEffort: effort,
      pointsAvailable: category.pointsMax - category.pointsEarned,
      relatedApp,
    });
  }

  // Sort by priority, then by points available, then by structural priority (structural SEO before metadata)
  const priorityOrder = { HIGH: 0, MEDIUM: 1, OPTIONAL: 2 };
  // Structural SEO items (H1, headings, content) should come before metadata (title, meta description)
  // When multiple HIGH priority items have equal pointsAvailable, prefer structural SEO items
  const structuralPriority: Record<string, number> = {
    "h1-tag": 1,
    "heading-structure": 2,
    "content-length": 3,
    "title-tag": 4,
    "meta-description": 5,
    "images-alt": 6,
    "internal-links": 7,
    "local-keywords": 8,
    "mobile-friendly": 9,
    "conversion-signals": 10,
  };
  roadmap.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const pointsDiff = b.pointsAvailable - a.pointsAvailable;
    if (pointsDiff !== 0) return pointsDiff;
    // When priority and points are equal, prefer structural SEO items (H1) before metadata (Title)
    const aStructural = structuralPriority[a.category] || 99;
    const bStructural = structuralPriority[b.category] || 99;
    return aStructural - bStructural;
  });

  // Tier 5B+: simple deterministic dependency model + stable topological ordering
  const categoryToId = new Map<string, string>();
  for (const item of roadmap) categoryToId.set(item.category, item.id);

  const getPrerequisiteCategories = (categoryKey: string): string[] => {
    switch (categoryKey) {
      case "meta-description":
        return ["title-tag"];
      case "heading-structure":
        return ["h1-tag"];
      case "content-length":
        return ["heading-structure"];
      case "local-keywords":
        return ["content-length"];
      case "internal-links":
        return ["content-length"];
      case "conversion-signals":
        return ["content-length"];
      default:
        return [];
    }
  };

  const enriched = roadmap.map((item) => {
    const prereqCats = getPrerequisiteCategories(item.category).filter((c) => c !== item.category);
    const dependsOnRoadmapIds = prereqCats
      .map((c) => categoryToId.get(c))
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const dependsOnFindingIds = prereqCats.map((c) => `seo-finding:${c}`);

    return {
      ...item,
      ...(dependsOnFindingIds.length ? { dependsOnFindingIds } : {}),
      ...(dependsOnRoadmapIds.length ? { dependsOnRoadmapIds } : {}),
    };
  });

  const baseRank = new Map<string, number>();
  enriched.forEach((item, idx) => baseRank.set(item.id, idx));

  // Stable Kahn topo sort using baseRank as tie-breaker
  const byId = new Map<string, RoadmapItem>(enriched.map((i) => [i.id, i]));
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const item of enriched) {
    inDegree.set(item.id, 0);
    outgoing.set(item.id, []);
  }

  for (const item of enriched) {
    const deps = item.dependsOnRoadmapIds ?? [];
    for (const depId of deps) {
      if (!byId.has(depId)) continue;
      outgoing.get(depId)!.push(item.id);
      inDegree.set(item.id, (inDegree.get(item.id) ?? 0) + 1);
    }
  }

  const available: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) available.push(id);
  }
  available.sort((a, b) => (baseRank.get(a)! - baseRank.get(b)!));

  const sorted: RoadmapItem[] = [];
  while (available.length > 0) {
    const id = available.shift()!;
    const item = byId.get(id);
    if (item) sorted.push(item);

    for (const nextId of outgoing.get(id) ?? []) {
      const nextDeg = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, nextDeg);
      if (nextDeg === 0) {
        available.push(nextId);
        available.sort((a, b) => (baseRank.get(a)! - baseRank.get(b)!));
      }
    }
  }

  // If a cycle is introduced, fail safely by returning the base sorted ordering.
  if (sorted.length !== enriched.length) {
    return enriched;
  }

  return sorted;
}

// Calculate score and band
function calculateScoreAndBand(categoryResults: AuditCategoryResult[]): { score: number; band: string; summary: string } {
  const totalScore = categoryResults.reduce((sum, cat) => sum + cat.pointsEarned, 0);
  const maxScore = categoryResults.reduce((sum, cat) => sum + cat.pointsMax, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);

  let band: string;
  let summary: string;

  if (percentage >= 90) {
    band = "Excellent";
    summary = "Your page is well-optimized for SEO. Minor improvements can further enhance performance.";
  } else if (percentage >= 75) {
    band = "Strong";
    summary = "Your page has good SEO fundamentals. Focus on the recommended improvements to reach excellent.";
  } else if (percentage >= 60) {
    band = "Needs improvement";
    summary = "Your page needs several SEO improvements. Prioritize the high-priority fixes to see significant gains.";
  } else {
    band = "High priority fixes required";
    summary = "Your page requires immediate SEO attention. Start with the high-priority fixes to improve search visibility.";
  }

  return { score: percentage, band, summary };
}

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  let requestId = generateRequestId();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Authentication required. Please log in to use this tool." },
          requestId,
        },
        { status: 401 }
      );
    }

    // Resolve tenant (businessId) with demo-cookie safety; default to session user id.
    const cookieStore = await cookies();
    const resolvedBusinessId = await resolveBusinessIdServer(
      cookieStore,
      request.nextUrl?.searchParams ?? null
    );
    const businessId = resolvedBusinessId ?? session.user.id;

    // Tenant safety: never allow URL businessId to access other tenants (except demo mode, which is blocked above anyway).
    if (!isDemoRequest(request) && businessId !== session.user.id) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Tenant mismatch. Invalid business context." },
          requestId,
        },
        { status: 403 }
      );
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Invalid JSON body." },
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate input
    const parsed = seoAuditRoadmapRequestSchema.safeParse(json);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      parsed.error.issues.forEach((err) => {
        const path = err.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(err.message);
      });

      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Please fix the form errors.",
            fieldErrors,
          },
          requestId,
        },
        { status: 400 }
      );
    }

    const formValues = parsed.data;

    // Tier 5B: create draft report row BEFORE generation (never overwrite on rerun)
    const draft = await prisma.seoAuditReport.create({
      data: {
        businessId,
        status: "DRAFT",
        sourceInput: formValues as any,
        findings: {},
        roadmap: [],
      },
    });

    // Use report id as canonical request id (stable snapshot)
    requestId = draft.id;

    // Get page content
    let html = "";
    let textContent = "";
    let auditedUrl: string | undefined;

    if (formValues.pageUrl) {
      try {
        auditedUrl = formValues.pageUrl;
        html = await fetchPageContent(formValues.pageUrl);
        textContent = extractTextFromHTML(html);
      } catch (error) {
        // Keep draft as-is (not completed). Store the error for later debugging.
        try {
          await prisma.seoAuditReport.update({
            where: { id: draft.id },
            data: {
              findings: {
                error: error instanceof Error ? error.message : "Failed to fetch page content",
              } as any,
            },
          });
        } catch {
          // ignore
        }
        return NextResponse.json(
          {
            ok: false,
            error: {
              message: error instanceof Error ? error.message : "Failed to fetch page content",
            },
            requestId,
          },
          { status: 400 }
        );
      }
    } else if (formValues.pageContent) {
      html = formValues.pageContent;
      textContent = extractTextFromHTML(html);
    }

    if (textContent.length === 0) {
      try {
        await prisma.seoAuditReport.update({
          where: { id: draft.id },
          data: {
            findings: {
              error: "No content found to audit. Please provide valid page content.",
            } as any,
          },
        });
      } catch {
        // ignore
      }
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "No content found to audit. Please provide valid page content.",
          },
          requestId,
        },
        { status: 400 }
      );
    }

    // Extract HTML data
    const extractedData = extractHTMLData(html, formValues.pageUrl);

    // Run audit
    const baseCategoryResults = runAudit(extractedData, formValues);
    const categoryResults = attachEvidenceAndConfidence({
      categoryResults: baseCategoryResults,
      data: extractedData,
      context: formValues,
      auditedUrl,
    });
    const { score, band, summary } = calculateScoreAndBand(categoryResults);
    const roadmap = generateRoadmap(categoryResults, formValues);

    const completedAt = new Date();

    // Persist canonical snapshot and mark completed
    await prisma.seoAuditReport.update({
      where: { id: draft.id },
      data: {
        status: "COMPLETED",
        findings: {
          score,
          band,
          summary,
          auditedUrl,
          categoryResults,
        } as any,
        roadmap: roadmap as any,
        completedAt,
      },
    });

    // Optional metadata for exports (does not affect audit snapshot integrity)
    const profile = await prisma.brandProfile.findUnique({
      where: { userId: businessId },
      select: { businessName: true },
    });

    // Build response (from snapshot)
    const response: SEOAuditRoadmapResponse = {
      score,
      band,
      summary,
      auditedUrl,
      categoryResults,
      roadmap,
      meta: {
        requestId: draft.id,
        auditedAtISO: completedAt.toISOString(),
      },
    };

    return NextResponse.json({
      ok: true,
      data: {
        audit: response,
        sourceInput: formValues,
        businessName: profile?.businessName ?? null,
      },
    });
  } catch (error) {
    console.error("SEO Audit Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      {
        ok: false,
        error: { message: errorMessage },
        requestId,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Authentication required. Please log in to use this tool." },
          requestId,
        },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const resolvedBusinessId = await resolveBusinessIdServer(
      cookieStore,
      request.nextUrl?.searchParams ?? null
    );
    const businessId = resolvedBusinessId ?? session.user.id;

    // Tenant safety: never allow URL businessId to access other tenants.
    if (!isDemoRequest(request) && businessId !== session.user.id) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Tenant mismatch. Invalid business context." },
          requestId,
        },
        { status: 403 }
      );
    }

    const latestTwo = await prisma.seoAuditReport.findMany({
      where: {
        businessId,
        status: "COMPLETED" as SeoAuditReportStatus,
      },
      orderBy: [
        { completedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 2,
    });

    const active = latestTwo[0] ?? null;
    const previous = latestTwo[1] ?? null;

    if (!active) {
      return NextResponse.json({ ok: true, data: null });
    }

    const audit = buildAuditFromReport(active);
    if (!audit) {
      return NextResponse.json({ ok: true, data: null });
    }

    const previousAudit = previous ? buildAuditFromReport(previous) : null;

    const profile = await prisma.brandProfile.findUnique({
      where: { userId: businessId },
      select: { businessName: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        audit,
        previousAudit,
        sourceInput: active.sourceInput,
        businessName: profile?.businessName ?? null,
      },
    });
  } catch (error) {
    console.error("SEO Audit GET Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      {
        ok: false,
        error: { message: errorMessage },
        requestId,
      },
      { status: 500 }
    );
  }
}
