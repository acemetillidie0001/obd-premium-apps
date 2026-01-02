/**
 * Unit Tests for OBD Scheduler Request Action API Route
 * P1-26: Critical Paths Untested
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/premium";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { BookingStatus } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    bookingService: {
      findFirst: vi.fn(),
    },
    bookingRequestAuditLog: {
      create: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/apps/obd-scheduler/notifications", () => ({
  sendRequestApprovedEmail: vi.fn(),
  sendRequestDeclinedEmail: vi.fn(),
  sendProposedTimeEmail: vi.fn(),
}));

describe("POST /api/obd-scheduler/requests/[id]/action", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };
  const mockService = {
    id: "service-123",
    businessId: "user-123",
    name: "Test Service",
    durationMinutes: 60,
    description: "Test description",
    active: true,
    paymentRequired: "NONE",
    depositAmountCents: null,
    currency: "USD",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const mockRequest = {
    id: "request-123",
    businessId: "user-123",
    serviceId: "service-123",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: "555-1234",
    status: BookingStatus.REQUESTED,
    preferredStart: new Date("2026-01-15T10:00:00Z"),
    preferredEnd: new Date("2026-01-15T11:00:00Z"),
    proposedStart: null,
    proposedEnd: null,
    message: "Test message",
    internalNotes: null,
    createdAt: new Date("2026-01-15T09:00:00Z"),
    updatedAt: new Date("2026-01-15T09:00:00Z"),
    service: mockService,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePremiumAccess).mockResolvedValue(null);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.bookingService.findFirst).mockResolvedValue(mockService as any);
    vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue(null);
  });

  it("should approve a request", async () => {
    vi.mocked(prisma.bookingRequest.findFirst).mockResolvedValue(mockRequest as any);
    const updatedRequest = {
      ...mockRequest,
      status: BookingStatus.APPROVED,
      proposedStart: mockRequest.preferredStart,
      proposedEnd: mockRequest.preferredEnd,
      updatedAt: new Date("2026-01-15T10:05:00Z"),
    };
    vi.mocked(prisma.bookingRequest.update).mockResolvedValue(updatedRequest as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests/request-123/action", {
      method: "POST",
      body: JSON.stringify({
        action: "approve",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "request-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe("APPROVED");
    expect(prisma.bookingRequestAuditLog.create).toHaveBeenCalled();
  });

  it("should decline a request", async () => {
    vi.mocked(prisma.bookingRequest.findFirst).mockResolvedValue(mockRequest as any);
    const declinedRequest = {
      ...mockRequest,
      status: BookingStatus.DECLINED,
      updatedAt: new Date("2026-01-15T10:05:00Z"),
    };
    vi.mocked(prisma.bookingRequest.update).mockResolvedValue(declinedRequest as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests/request-123/action", {
      method: "POST",
      body: JSON.stringify({
        action: "decline",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "request-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe("DECLINED");
  });

  it("should reactivate a declined request", async () => {
    const declinedRequest = {
      ...mockRequest,
      status: BookingStatus.DECLINED,
    };
    vi.mocked(prisma.bookingRequest.findFirst).mockResolvedValue(declinedRequest as any);
    const reactivatedRequest = {
      ...declinedRequest,
      status: BookingStatus.REQUESTED,
      proposedStart: null,
      proposedEnd: null,
      updatedAt: new Date("2026-01-15T10:05:00Z"),
    };
    vi.mocked(prisma.bookingRequest.update).mockResolvedValue(reactivatedRequest as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests/request-123/action", {
      method: "POST",
      body: JSON.stringify({
        action: "reactivate",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "request-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe("REQUESTED");
    expect(data.data.proposedStart).toBeNull();
    expect(data.data.proposedEnd).toBeNull();
  });

  it("should reject reactivate on non-declined request", async () => {
    vi.mocked(prisma.bookingRequest.findFirst).mockResolvedValue(mockRequest as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests/request-123/action", {
      method: "POST",
      body: JSON.stringify({
        action: "reactivate",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "request-123" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should validate service is still active", async () => {
    const inactiveService = { ...mockService, active: false };
    vi.mocked(prisma.bookingRequest.findFirst).mockResolvedValue(mockRequest as any);
    vi.mocked(prisma.bookingService.findFirst).mockResolvedValue(inactiveService as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests/request-123/action", {
      method: "POST",
      body: JSON.stringify({
        action: "approve",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "request-123" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("INVALID_SERVICE");
  });

  it("should enforce tenant isolation", async () => {
    const otherBusinessRequest = {
      ...mockRequest,
      businessId: "user-456", // Different business
    };
    vi.mocked(prisma.bookingRequest.findFirst).mockResolvedValue(otherBusinessRequest as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests/request-123/action", {
      method: "POST",
      body: JSON.stringify({
        action: "approve",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "request-123" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("NOT_FOUND");
  });
});

