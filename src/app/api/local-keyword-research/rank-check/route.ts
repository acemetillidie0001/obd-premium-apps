// src/app/api/local-keyword-research/rank-check/route.ts

import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { checkRank } from "@/lib/local-rank-check";
import type { RankCheckResult } from "../types";

/**
 * Validate URL to prevent SSRF attacks
 */
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Must be http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    
    const hostname = parsed.hostname;
    
    // Block localhost
    if (hostname === "localhost") {
      return false;
    }
    
    // Block IPv4 loopback (127.0.0.1 and 127.*)
    if (hostname === "127.0.0.1" || hostname.startsWith("127.")) {
      return false;
    }
    
    // Block IPv6 loopback
    if (hostname === "::1") {
      return false;
    }
    
    // Block private IP ranges: 10.*
    if (hostname.startsWith("10.")) {
      return false;
    }
    
    // Block private IP ranges: 192.168.*
    if (hostname.startsWith("192.168.")) {
      return false;
    }
    
    // Block private IP ranges: 172.16.* through 172.31.*
    if (hostname.startsWith("172.")) {
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1] || "0", 10);
        if (secondOctet >= 16 && secondOctet <= 31) {
          return false;
        }
      }
    }
    
    // Block link-local/metadata: 169.254.* (including 169.254.169.254)
    if (hostname.startsWith("169.254.")) {
      return false;
    }
    
    // Block .local hostnames
    if (hostname.endsWith(".local")) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiErrorResponse("Invalid request body.", "VALIDATION_ERROR", 400);
    }

    // Validate required fields
    if (!body?.keyword || typeof body.keyword !== "string" || !body.keyword.trim()) {
      return apiErrorResponse(
        "Missing required field: keyword is required.",
        "VALIDATION_ERROR",
        400
      );
    }

    if (!body?.targetUrl || typeof body.targetUrl !== "string" || !body.targetUrl.trim()) {
      return apiErrorResponse(
        "Missing required field: targetUrl is required.",
        "VALIDATION_ERROR",
        400
      );
    }

    // Sanitize and set defaults
    const keyword = body.keyword.toString().trim().slice(0, 200);
    const targetUrl = body.targetUrl.toString().trim().slice(0, 500);
    const city = (body.city || "Ocala").toString().trim().slice(0, 120);
    const state = (body.state || "Florida").toString().trim().slice(0, 120);

    // Validate URL to prevent SSRF
    if (!validateUrl(targetUrl)) {
      return apiErrorResponse(
        "Invalid URL format. Must be http:// or https://",
        "VALIDATION_ERROR",
        400
      );
    }

    // Call rank check helper with timeout
    const raw = await Promise.race([
      checkRank(keyword, targetUrl, city, state),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("RANK_TIMEOUT")), 15000)
      ),
    ]).catch((err) => {
      if (err instanceof Error && err.message === "RANK_TIMEOUT") {
        throw new Error("TIMEOUT");
      }
      throw err;
    });

    // Normalize to RankCheckResult
    const result: RankCheckResult = {
      keyword: raw.keyword,
      targetUrl: raw.targetUrl,
      currentPositionOrganic: raw.currentPositionOrganic ?? null,
      currentPositionMaps: raw.currentPositionMaps ?? null,
      serpSampleUrls: raw.serpSampleUrls || [],
      checkedAt: raw.checkedAt || new Date().toISOString(),
      dataSource: raw.dataSource || "mock",
    };

    return apiSuccessResponse({ result });
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.message === "TIMEOUT") {
      return apiErrorResponse(
        "Rank check timed out. Please try again.",
        "TIMEOUT",
        504
      );
    }
    
    console.error("Rank check API error:", err);
    return apiErrorResponse(
      "Something went wrong while checking your ranking. Please try again.",
      "UNKNOWN_ERROR",
      500
    );
  }
}

