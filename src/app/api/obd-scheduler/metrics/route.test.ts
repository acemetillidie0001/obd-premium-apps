/**
 * Unit Tests for OBD Scheduler Metrics API Route
 * P1-26: Critical Paths Untested
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/premium";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { BookingStatus } from "@prisma/client";

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

describe("GET /api/obd-scheduler/metrics", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };
  const mockRequests = [
    {
      id: "request-1",
      businessId: "user-123",
      status: BookingStatus.APPROVED,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      service: { id: "service-1", name: "Service A" },
      auditLogs: [
        {
          action: "approve",
          fromStatus: BookingStatus.REQUESTED,
          toStatus: BookingStatus.APPROVED,
          createdAt: new Date("2026-01-01T10:05:00Z"),
        },
      ],
    },
    {
      id: "request-2",
      businessId: "user-123",
      status: BookingStatus.DECLINED,
      createdAt: new Date("2026-01-02T14:00:00Z"),
      service: { id: "service-2", name: "Service B" },
      auditLogs: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePremiumAccess).mockResolvedValue(null);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
  });

  it("should return metrics for 30d range", async () => {
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue(mockRequests as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=30d");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.range).toBe("30d");
    expect(data.data.totalRequests).toBe(2);
    expect(data.data.requestsByStatus.APPROVED).toBe(1);
    expect(data.data.requestsByStatus.DECLINED).toBe(1);
  });

  it("should handle 7d range", async () => {
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue(mockRequests as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=7d");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.range).toBe("7d");
  });

  it("should handle 90d range", async () => {
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue(mockRequests as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=90d");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.range).toBe("90d");
  });

  it("should default to 30d if range is invalid", async () => {
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue(mockRequests as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=invalid");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.range).toBe("30d");
  });

  it("should enforce tenant isolation - only return metrics for current business", async () => {
    const otherBusinessRequests = [
      {
        ...mockRequests[0],
        businessId: "user-456", // Different business
      },
    ];
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue(otherBusinessRequests as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=30d");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should only query for user-123's requests
    expect(prisma.bookingRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: "user-123",
        }),
      })
    );
  });

  it("should calculate conversion rate correctly", async () => {
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue(mockRequests as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=30d");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.conversionRate).toBe(50); // 1 approved / 2 total = 50%
  });

  it("should return empty metrics when no requests exist", async () => {
    vi.mocked(prisma.bookingRequest.findMany).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/obd-scheduler/metrics?range=30d");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.totalRequests).toBe(0);
    expect(data.data.conversionRate).toBe(0);
  });
});

