/**
 * Unit tests for OBD Scheduler Metrics API Route
 * Tests range parsing (7d/30d/90d) and response shape
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/obd-scheduler/metrics/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/premium";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { BookingStatus } from "@prisma/client";
import type { SchedulerMetrics } from "@/lib/apps/obd-scheduler/types";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingRequest: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/premium", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api/premiumGuard", () => ({
  requirePremiumAccess: vi.fn(),
}));

vi.mock("@/lib/api/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

const mockPrisma = prisma as any;
const mockGetCurrentUser = getCurrentUser as any;
const mockRequirePremiumAccess = requirePremiumAccess as any;
const mockCheckRateLimit = checkRateLimit as any;

describe("GET /api/obd-scheduler/metrics", () => {
  const businessId = "test-business-id";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePremiumAccess.mockResolvedValue(null);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue({ id: businessId });
  });

  const createMockRequest = (status: BookingStatus, createdAt: Date) => ({
    id: `request-${status}`,
    businessId,
    serviceId: null,
    customerName: "John Doe",
    customerEmail: "john@example.com",
    status,
    createdAt,
    updatedAt: createdAt,
    service: null,
    auditLogs: [],
  });

  it("should support 7d range", async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    mockPrisma.bookingRequest.findMany.mockResolvedValue([
      createMockRequest(BookingStatus.REQUESTED, sevenDaysAgo),
      createMockRequest(BookingStatus.APPROVED, new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
    ]);

    const request = new NextRequest(
      "http://localhost/api/obd-scheduler/metrics?range=7d"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.range).toBe("7d");
    expect(data.data.period.start).toBeDefined();
    expect(data.data.period.end).toBeDefined();

    // Verify date range is approximately 7 days (allow 1 day tolerance)
    const start = new Date(data.data.period.start);
    const end = new Date(data.data.period.end);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(7, -1);
  });

  it("should support 30d range (default)", async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    mockPrisma.bookingRequest.findMany.mockResolvedValue([
      createMockRequest(BookingStatus.REQUESTED, thirtyDaysAgo),
      createMockRequest(BookingStatus.APPROVED, new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)),
    ]);

    const request = new NextRequest(
      "http://localhost/api/obd-scheduler/metrics?range=30d"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.range).toBe("30d");

    const start = new Date(data.data.period.start);
    const end = new Date(data.data.period.end);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(30, -1);
  });

  it("should default to 30d when range is missing", async () => {
    const now = new Date();

    mockPrisma.bookingRequest.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/obd-scheduler/metrics"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.range).toBe("30d");
  });

  it("should support 90d range", async () => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    mockPrisma.bookingRequest.findMany.mockResolvedValue([
      createMockRequest(BookingStatus.REQUESTED, ninetyDaysAgo),
    ]);

    const request = new NextRequest(
      "http://localhost/api/obd-scheduler/metrics?range=90d"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.range).toBe("90d");

    const start = new Date(data.data.period.start);
    const end = new Date(data.data.period.end);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(90, -1);
  });

  it("should return response shape matching SchedulerMetrics type", async () => {
    const now = new Date();
    const requestDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    mockPrisma.bookingRequest.findMany.mockResolvedValue([
      createMockRequest(BookingStatus.REQUESTED, requestDate),
      createMockRequest(BookingStatus.APPROVED, requestDate),
      createMockRequest(BookingStatus.DECLINED, requestDate),
    ]);

    const request = new NextRequest(
      "http://localhost/api/obd-scheduler/metrics?range=30d"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);

    const metrics: SchedulerMetrics = data.data;

    // Verify all required fields exist
    expect(metrics.range).toBeDefined();
    expect(["7d", "30d", "90d"]).toContain(metrics.range);
    expect(metrics.period).toBeDefined();
    expect(metrics.period.start).toBeDefined();
    expect(metrics.period.end).toBeDefined();
    expect(typeof metrics.totalRequests).toBe("number");
    expect(metrics.requestsByStatus).toBeDefined();
    expect(typeof metrics.requestsByStatus.REQUESTED).toBe("number");
    expect(typeof metrics.requestsByStatus.APPROVED).toBe("number");
    expect(typeof metrics.requestsByStatus.DECLINED).toBe("number");
    expect(typeof metrics.conversionRate).toBe("number");
    expect(metrics.medianTimeToFirstResponse === null || typeof metrics.medianTimeToFirstResponse === "number").toBe(true);
    expect(metrics.medianTimeToApproval === null || typeof metrics.medianTimeToApproval === "number").toBe(true);
    expect(Array.isArray(metrics.servicePopularity)).toBe(true);
    expect(Array.isArray(metrics.peakHours)).toBe(true);
    expect(metrics.peakHours.length).toBe(24);
    expect(Array.isArray(metrics.peakDays)).toBe(true);
    expect(metrics.peakDays.length).toBe(7);
    expect(typeof metrics.cancellationCount).toBe("number");
    expect(typeof metrics.reactivateCount).toBe("number");
  });

  it("should handle invalid range parameter by defaulting to 30d", async () => {
    mockPrisma.bookingRequest.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/obd-scheduler/metrics?range=invalid"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.range).toBe("30d"); // Should default to 30d
  });
});

