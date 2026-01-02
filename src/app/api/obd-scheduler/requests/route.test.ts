/**
 * Unit Tests for OBD Scheduler Requests API Route
 * P1-26: Critical Paths Untested
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/premium";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    bookingService: {
      findFirst: vi.fn(),
    },
    bookingSettings: {
      findFirst: vi.fn(),
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
  sendCustomerRequestConfirmationEmail: vi.fn(),
  sendBusinessRequestNotificationEmail: vi.fn(),
}));

vi.mock("@/lib/apps/obd-scheduler/integrations/crm", () => ({
  syncBookingToCrm: vi.fn(),
}));

describe("POST /api/obd-scheduler/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePremiumAccess).mockResolvedValue(null);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
  });

  it("should create a booking request with valid data", async () => {
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
    const mockSettings = {
      id: "settings-123",
      businessId: "user-123",
      bookingKey: "test-key",
    };
    const mockRequest = {
      id: "request-123",
      businessId: "user-123",
      serviceId: "service-123",
      customerName: "John Doe",
      customerEmail: "john@example.com",
      customerPhone: "555-1234",
      preferredStart: new Date("2026-01-15T10:00:00Z"),
      preferredEnd: new Date("2026-01-15T11:00:00Z"),
      proposedStart: null,
      proposedEnd: null,
      message: "Test message",
      internalNotes: null,
      status: "REQUESTED",
      createdAt: new Date("2026-01-15T09:00:00Z"),
      updatedAt: new Date("2026-01-15T09:00:00Z"),
      service: mockService,
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.bookingService.findFirst).mockResolvedValue(mockService as any);
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue(mockSettings as any);
    vi.mocked(prisma.bookingSettings.findUnique).mockResolvedValue(mockSettings as any);
    vi.mocked(prisma.bookingRequest.create).mockResolvedValue(mockRequest as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests", {
      method: "POST",
      body: JSON.stringify({
        bookingKey: "test-key",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        customerPhone: "555-1234",
        preferredStart: "2026-01-15T10:00:00Z",
        message: "Test message",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.customerName).toBe("John Doe");
    expect(prisma.bookingRequest.create).toHaveBeenCalled();
  });

  it("should reject request with invalid email", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests", {
      method: "POST",
      body: JSON.stringify({
        bookingKey: "test-key",
        customerName: "John Doe",
        customerEmail: "invalid-email",
        customerPhone: "555-1234",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should enforce tenant isolation - reject request for different business", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSettings = {
      id: "settings-123",
      businessId: "user-456", // Different business
      bookingKey: "test-key",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue(mockSettings as any);

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests", {
      method: "POST",
      body: JSON.stringify({
        bookingKey: "test-key",
        customerName: "John Doe",
        customerEmail: "john@example.com",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should handle rate limiting", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: "Rate limit exceeded", code: "RATE_LIMITED" }),
        { status: 429 }
      ) as any
    );

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests", {
      method: "POST",
      body: JSON.stringify({
        bookingKey: "test-key",
        customerName: "John Doe",
        customerEmail: "john@example.com",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("RATE_LIMITED");
  });

  it("should require premium access", async () => {
    vi.mocked(requirePremiumAccess).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: "Premium required", code: "PREMIUM_REQUIRED" }),
        { status: 403 }
      ) as any
    );

    const request = new NextRequest("http://localhost/api/obd-scheduler/requests", {
      method: "POST",
      body: JSON.stringify({
        bookingKey: "test-key",
        customerName: "John Doe",
        customerEmail: "john@example.com",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("PREMIUM_REQUIRED");
  });
});

