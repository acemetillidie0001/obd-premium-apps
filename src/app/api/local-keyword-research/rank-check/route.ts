// src/app/api/local-keyword-research/rank-check/route.ts

import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { checkRank } from "@/lib/local-rank-check";
import type { RankCheckResult } from "../types";
import { requireUserSession } from "@/lib/auth/requireUserSession";
import { NextResponse } from "next/server";
import * as dns from "node:dns";
import * as net from "node:net";

/**
 * Check if a hostname is an IP literal (IPv4 or IPv6)
 */
function isIpLiteral(hostname: string): boolean {
  return net.isIP(hostname) > 0;
}

/**
 * Check if an IP address is private, loopback, link-local, or blocked
 */
function isPrivateOrBlockedIp(ip: string): boolean {
  // IPv4 checks
  if (net.isIPv4(ip)) {
    // Block 0.0.0.0
    if (ip === "0.0.0.0") {
      return true;
    }
    
    // Block loopback: 127.0.0.0/8
    if (ip.startsWith("127.")) {
      return true;
    }
    
    // Block private: 10.0.0.0/8
    if (ip.startsWith("10.")) {
      return true;
    }
    
    // Block private: 192.168.0.0/16
    if (ip.startsWith("192.168.")) {
      return true;
    }
    
    // Block private: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (ip.startsWith("172.")) {
      const parts = ip.split(".");
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1] || "0", 10);
        if (secondOctet >= 16 && secondOctet <= 31) {
          return true;
        }
      }
    }
    
    // Block link-local/metadata: 169.254.0.0/16
    if (ip.startsWith("169.254.")) {
      return true;
    }
    
    return false;
  }
  
  // IPv6 checks
  if (net.isIPv6(ip)) {
    // Block ::1 (loopback)
    if (ip === "::1") {
      return true;
    }
    
    // Block :: (unspecified)
    if (ip === "::") {
      return true;
    }
    
    // Block fc00::/7 (ULA - Unique Local Addresses)
    // fc00::/7 means first 7 bits are fc00:0000:0000:0000:0000:0000:0000:0000
    // This covers fc00:: through fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
    const ipv6Parts = ip.split(":");
    if (ipv6Parts.length > 0) {
      const firstPart = ipv6Parts[0].toLowerCase();
      // Block ULA (fc00::/7)
      if (firstPart.startsWith("fc") || firstPart.startsWith("fd")) {
        return true;
      }
      // Block fe80::/10 (link-local)
      // fe80::/10 means first 10 bits are fe80:0000:0000:0000:0000:0000:0000:0000
      // This covers fe80:: through febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
      if (firstPart.startsWith("fe8") || firstPart.startsWith("fe9") || 
          firstPart.startsWith("fea") || firstPart.startsWith("feb")) {
        return true;
      }
    }
    
    return false;
  }
  
  return false;
}

/**
 * Validate URL to prevent SSRF attacks
 * Includes DNS resolution check to prevent DNS rebinding attacks
 */
async function validateUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    
    // Must be http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    
    const hostname = parsed.hostname;
    
    // Block explicit hostname strings
    if (hostname === "localhost") {
      return false;
    }
    
    // Block metadata endpoints
    if (hostname === "metadata.google.internal" || hostname === "metadata") {
      return false;
    }
    
    // Block .local hostnames
    if (hostname.endsWith(".local")) {
      return false;
    }
    
    // Block explicit IP strings
    if (hostname === "0.0.0.0" || hostname === "::") {
      return false;
    }
    
    // If hostname is an IP literal, check it directly
    if (isIpLiteral(hostname)) {
      return !isPrivateOrBlockedIp(hostname);
    }
    
    // For non-IP hostnames, resolve DNS and check all returned addresses
    // This prevents DNS rebinding attacks where a public hostname resolves to a private IP
    try {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      
      // Check all resolved addresses - if ANY is private/blocked, reject
      for (const addr of addresses) {
        const ip = addr.address;
        if (isPrivateOrBlockedIp(ip)) {
          return false;
        }
      }
      
      return true;
    } catch (dnsError) {
      // DNS resolution failed - reject for safety
      return false;
    }
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(req as any);
  if (demoBlock) return demoBlock;

  // Auth + tenant scoping (repo canonical pattern: session.user.id is businessId)
  const session = await requireUserSession();
  if (!session?.userId) {
    return apiErrorResponse(
      "Authentication required. Please log in to use this tool.",
      "UNAUTHORIZED",
      401
    );
  }
  const businessId = session.userId;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiErrorResponse("Invalid request body.", "VALIDATION_ERROR", 400);
    }

    // Reject attempts to override business/tenant scope via body
    if (Object.prototype.hasOwnProperty.call(body, "tenantId")) {
      return apiErrorResponse("Tenant access denied", "FORBIDDEN", 403);
    }
    if (Object.prototype.hasOwnProperty.call(body, "businessId")) {
      const bodyBusinessId = (body as any)?.businessId;
      const normalized = typeof bodyBusinessId === "string" ? bodyBusinessId.trim() : "";
      if (!normalized || normalized !== businessId) {
        return apiErrorResponse("Business access denied", "FORBIDDEN", 403);
      }
      // If it matches, allow (but rank-check does not rely on it).
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
    if (!(await validateUrl(targetUrl))) {
      return apiErrorResponse(
        "Invalid URL format. Must be http:// or https:// and point to a public address.",
        "VALIDATION_ERROR",
        400
      );
    }

    // Check for demo mode - return canned sample instead of calling OpenAI
    const { isDemoRequest } = await import("@/lib/demo/assert-not-demo");
    if (isDemoRequest(req as any)) {
      const demoResponse = {
        keyword,
        targetUrl,
        city,
        state,
        rank: 5,
        position: "Top 10",
        estimatedTraffic: 50,
        notes: "Demo mode: Sample rank check result",
      };
      return NextResponse.json(
        { ok: true, data: demoResponse, scope: { businessId } },
        { status: 200 }
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

    return NextResponse.json(
      { ok: true, data: { result }, scope: { businessId } },
      { status: 200 }
    );
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

/*
 * SSRF Validation Test Cases (sanity checks)
 * 
 * Should PASS (public URLs):
 * - https://example.com
 * - https://www.google.com
 * - http://8.8.8.8 (public DNS)
 * - https://[2001:4860:4860::8888] (public IPv6 DNS)
 * 
 * Should FAIL (private/blocked):
 * - http://localhost
 * - http://127.0.0.1
 * - http://10.0.0.1
 * - http://192.168.1.1
 * - http://172.16.0.1
 * - http://169.254.169.254 (metadata)
 * - http://0.0.0.0
 * - http://::1
 * - http://::
 * - http://example.local
 * - http://metadata.google.internal
 * - http://metadata
 * - Any hostname that resolves to private IPs (DNS rebinding protection)
 */

