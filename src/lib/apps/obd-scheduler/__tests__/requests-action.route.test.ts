/**
 * Unit tests for OBD Scheduler Request Action API Route
 * Tests illegal transitions, reactivate from DECLINED, and audit logging
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/obd-scheduler/requests/[id]/action/route";
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

// Mock notification functions (non-blocking)
vi.mock("@/lib/apps/obd-scheduler/notifications", () => ({
  sendRequestApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendRequestDeclinedEmail: vi.fn().mockResolvedValue(undefined),
  sendProposedTimeEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = prisma as any;
const mockGetCurrentUser = getCurrentUser as any;
const mockRequirePremiumAccess = requirePremiumAccess as any;
const mockCheckRateLimit = checkRateLimit as any;

describe("POST /api/obd-scheduler/requests/[id]/action", () => {
  const requestId = "test-request-id";
  const businessId = "test-business-id";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePremiumAccess.mockResolvedValue(null);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue({ id: businessId });
    mockPrisma.brandProfile.findUnique.mockResolvedValue({
      businessName: "Test Business",
    });
  });

  const createMockRequest = (status: BookingStatus) => ({
    id: requestId,
    businessId,
    serviceId: null,
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: null,
    preferredStart: new Date(Date.now() + 3600000), // 1 hour from now
    preferredEnd: null,
    message: null,
    status,
    proposedStart: null,
    proposedEnd: null,
    internalNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    service: null,
  });

  it("should reject illegal transition with friendly message", async () => {
    // Try to approve a request that's already APPROVED (illegal transition)
    const existingRequest = createMockRequest(BookingStatus.APPROVED);
    mockPrisma.bookingRequest.findFirst.mockResolvedValue(existingRequest);

    const request = new NextRequest(
      `http://localhost/api/obd-scheduler/requests/${requestId}/action`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: requestId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toContain("status");
    expect(data.error).toContain("REQUESTED or PROPOSED_TIME");
  });

  it("should allow reactivate only from DECLINED status", async () => {
    // Reactivate from DECLINED (should succeed)
    const declinedRequest = createMockRequest(BookingStatus.DECLINED);
    mockPrisma.bookingRequest.findFirst.mockResolvedValue(declinedRequest);

    const updatedRequest = {
      ...declinedRequest,
      status: BookingStatus.REQUESTED,
      proposedStart: null,
      proposedEnd: null,
    };
    mockPrisma.bookingRequest.update.mockResolvedValue(updatedRequest);
    mockPrisma.bookingRequestAuditLog.create.mockResolvedValue({});

    const request = new NextRequest(
      `http://localhost/api/obd-scheduler/requests/${requestId}/action`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "reactivate",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: requestId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe(BookingStatus.REQUESTED);
    expect(mockPrisma.bookingRequest.update).toHaveBeenCalled();
  });

  it("should reject reactivate from non-DECLINED status", async () => {
    // Try to reactivate from REQUESTED (should fail)
    const requestedRequest = createMockRequest(BookingStatus.REQUESTED);
    mockPrisma.bookingRequest.findFirst.mockResolvedValue(requestedRequest);

    const request = new NextRequest(
      `http://localhost/api/obd-scheduler/requests/${requestId}/action`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "reactivate",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: requestId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toContain("DECLINED");
    expect(data.error).toContain("reactivate");
  });

  it("should return ok:true with warnings when audit logging fails", async () => {
    // Approve a REQUESTED request, but audit logging fails
    const requestedRequest = createMockRequest(BookingStatus.REQUESTED);
    mockPrisma.bookingRequest.findFirst.mockResolvedValue(requestedRequest);

    const updatedRequest = {
      ...requestedRequest,
      status: BookingStatus.APPROVED,
      proposedStart: requestedRequest.preferredStart,
      proposedEnd: new Date(requestedRequest.preferredStart!.getTime() + 30 * 60 * 1000),
    };
    mockPrisma.bookingRequest.update.mockResolvedValue(updatedRequest);

    // Mock audit logging failure
    mockPrisma.bookingRequestAuditLog.create.mockRejectedValue(
      new Error("Database error")
    );

    const request = new NextRequest(
      `http://localhost/api/obd-scheduler/requests/${requestId}/action`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: requestId }) });
    const data = await response.json();

    // Action should succeed despite audit logging failure
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe(BookingStatus.APPROVED);
    // Should include warnings about audit logging failure
    expect(data.data.warnings).toBeDefined();
    expect(data.data.warnings.length).toBeGreaterThan(0);
    expect(data.data.warnings[0]).toContain("Audit logging failed");
  });

  it("should succeed with audit logging when it works", async () => {
    // Approve a REQUESTED request with successful audit logging
    const requestedRequest = createMockRequest(BookingStatus.REQUESTED);
    mockPrisma.bookingRequest.findFirst.mockResolvedValue(requestedRequest);

    const updatedRequest = {
      ...requestedRequest,
      status: BookingStatus.APPROVED,
      proposedStart: requestedRequest.preferredStart,
      proposedEnd: new Date(requestedRequest.preferredStart!.getTime() + 30 * 60 * 1000),
    };
    mockPrisma.bookingRequest.update.mockResolvedValue(updatedRequest);
    mockPrisma.bookingRequestAuditLog.create.mockResolvedValue({});

    const request = new NextRequest(
      `http://localhost/api/obd-scheduler/requests/${requestId}/action`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: requestId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.status).toBe(BookingStatus.APPROVED);
    // Should not have warnings when audit logging succeeds
    expect(data.data.warnings).toBeUndefined();
  });
});

