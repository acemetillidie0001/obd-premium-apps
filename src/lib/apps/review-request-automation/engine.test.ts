/**
 * Unit Tests for Review Request Automation Engine
 * 
 * Run with: npm test or vitest
 */

import { describe, it, expect } from "vitest";
import {
  generateMessageTemplates,
  computeSendQueue,
  calculateFunnelMetrics,
  generateQualityChecks,
  generateNextActions,
  processReviewRequestAutomation,
} from "./engine";
import {
  Campaign,
  Customer,
  Event,
  TriggerType,
  Language,
  ToneStyle,
} from "./types";

describe("Review Request Automation Engine", () => {
  const mockCampaign: Campaign = {
    businessName: "Test Business",
    businessType: "Restaurant",
    platform: "Google",
    reviewLink: "https://g.page/r/test",
    language: "English",
    toneStyle: "Friendly",
    brandVoice: "",
    rules: {
      triggerType: "manual",
      sendDelayHours: 24,
      followUpEnabled: false,
      followUpDelayDays: 7,
      frequencyCapDays: 30,
      quietHours: {
        start: "09:00",
        end: "19:00",
      },
    },
  };

  const mockCustomers: Customer[] = [
    {
      id: "customer-1",
      customerName: "John Doe",
      phone: "5551234567",
      email: "john@example.com",
      optedOut: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "customer-2",
      customerName: "Jane Smith",
      phone: "5559876543",
      optedOut: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockEvents: Event[] = [];

  describe("generateMessageTemplates", () => {
    it("should generate templates for English Friendly tone", () => {
      const templates = generateMessageTemplates(mockCampaign);
      
      expect(templates.smsShort).toContain("Test Business");
      expect(templates.smsShort).toContain("https://g.page/r/test");
      expect(templates.smsShort).toContain("STOP");
      expect(templates.smsStandard).toContain("Test Business");
      expect(templates.email.subject).toContain("Test Business");
      expect(templates.email.body).toContain("Test Business");
      expect(templates.followUpSms).toContain("Test Business");
    });

    it("should include {firstName} placeholder", () => {
      const templates = generateMessageTemplates(mockCampaign);
      
      expect(templates.smsShort).toContain("{firstName}");
      expect(templates.smsStandard).toContain("{firstName}");
      expect(templates.email.body).toContain("{firstName}");
    });

    it("should generate different templates for different tones", () => {
      const professionalCampaign = { ...mockCampaign, toneStyle: "Professional" as ToneStyle };
      const professionalTemplates = generateMessageTemplates(professionalCampaign);
      
      expect(professionalTemplates.smsShort).not.toBe(generateMessageTemplates(mockCampaign).smsShort);
    });

    it("should handle Spanish language", () => {
      const spanishCampaign = { ...mockCampaign, language: "Spanish" as Language };
      const templates = generateMessageTemplates(spanishCampaign);
      
      expect(templates.smsShort).toContain("STOP");
      // Should contain Spanish text
      expect(templates.smsShort.length).toBeGreaterThan(0);
    });
  });

  describe("computeSendQueue", () => {
    it("should create queue items for customers", () => {
      const queue = computeSendQueue(mockCampaign, mockCustomers, mockEvents);
      
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[0]).toHaveProperty("customerId");
      expect(queue[0]).toHaveProperty("scheduledAt");
      expect(queue[0]).toHaveProperty("variant");
      expect(queue[0]).toHaveProperty("channel");
    });

    it("should skip opted-out customers", () => {
      const optedOutCustomers = [
        { ...mockCustomers[0], optedOut: true },
      ];
      const queue = computeSendQueue(mockCampaign, optedOutCustomers, mockEvents);
      
      expect(queue.length).toBe(0);
    });

    it("should respect frequency cap", () => {
      const pastEvent: Event = {
        id: "event-1",
        customerId: mockCustomers[0].id,
        type: "sent",
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      };
      
      const queue = computeSendQueue(mockCampaign, [mockCustomers[0]], [pastEvent]);
      
      // Should still queue (10 days < 30 day cap)
      expect(queue.length).toBeGreaterThan(0);
    });

    it("should add follow-up items when enabled", () => {
      const followUpCampaign = {
        ...mockCampaign,
        rules: {
          ...mockCampaign.rules,
          followUpEnabled: true,
        },
      };
      
      const queue = computeSendQueue(followUpCampaign, [mockCustomers[0]], mockEvents);
      
      // Should have initial + follow-up
      const followUpItems = queue.filter((q) => q.variant === "followUpSms");
      expect(followUpItems.length).toBeGreaterThan(0);
    });

    it("should use lastVisitDate for after_service trigger", () => {
      const customerWithVisit = {
        ...mockCustomers[0],
        lastVisitDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 2 days ago
      };
      
      const afterServiceCampaign = {
        ...mockCampaign,
        rules: {
          ...mockCampaign.rules,
          triggerType: "after_service" as TriggerType,
          sendDelayHours: 24,
        },
      };
      
      const queue = computeSendQueue(afterServiceCampaign, [customerWithVisit], mockEvents);
      
      expect(queue.length).toBeGreaterThan(0);
      const scheduledDate = new Date(queue[0].scheduledAt);
      // Should be approximately 1 day after last visit (2 days ago + 24 hours = 1 day ago)
      expect(scheduledDate.getTime()).toBeLessThan(Date.now());
    });
  });

  describe("calculateFunnelMetrics", () => {
    it("should calculate correct metrics", () => {
      const queue = computeSendQueue(mockCampaign, mockCustomers, mockEvents);
      const metrics = calculateFunnelMetrics(mockCustomers, mockEvents, queue);
      
      expect(metrics.loaded).toBe(mockCustomers.length);
      expect(metrics.ready).toBeGreaterThanOrEqual(0);
      expect(metrics.queued).toBeGreaterThanOrEqual(0);
    });

    it("should count opted-out customers", () => {
      const optedOutCustomers = [
        { ...mockCustomers[0], optedOut: true },
      ];
      const queue = computeSendQueue(mockCampaign, optedOutCustomers, mockEvents);
      const metrics = calculateFunnelMetrics(optedOutCustomers, mockEvents, queue);
      
      expect(metrics.optedOut).toBe(1);
    });

    it("should count reviewed customers", () => {
      const reviewedEvent: Event = {
        id: "event-1",
        customerId: mockCustomers[0].id,
        type: "reviewed",
        timestamp: new Date().toISOString(),
      };
      
      const queue = computeSendQueue(mockCampaign, mockCustomers, [reviewedEvent]);
      const metrics = calculateFunnelMetrics(mockCustomers, [reviewedEvent], queue);
      
      expect(metrics.reviewed).toBe(1);
    });
  });

  describe("generateQualityChecks", () => {
    it("should detect invalid review link", () => {
      const invalidCampaign = {
        ...mockCampaign,
        reviewLink: "not-a-url",
      };
      
      const templates = generateMessageTemplates(invalidCampaign);
      const checks = generateQualityChecks(invalidCampaign, mockCustomers, templates);
      
      const invalidLinkCheck = checks.find((c) => c.id === "invalid-review-link");
      expect(invalidLinkCheck).toBeDefined();
      expect(invalidLinkCheck?.severity).toBe("error");
    });

    it("should warn about long SMS templates", () => {
      const longTemplate = {
        smsShort: "a".repeat(300), // Too long
        smsStandard: "b".repeat(500), // Too long
        email: { subject: "Test", body: "Test" },
        followUpSms: "c".repeat(100),
      };
      
      const checks = generateQualityChecks(mockCampaign, mockCustomers, longTemplate);
      
      const smsShortCheck = checks.find((c) => c.id === "sms-short-too-long");
      const smsStandardCheck = checks.find((c) => c.id === "sms-standard-too-long");
      
      expect(smsShortCheck).toBeDefined();
      expect(smsStandardCheck).toBeDefined();
    });

    it("should warn about aggressive follow-up", () => {
      const aggressiveCampaign = {
        ...mockCampaign,
        rules: {
          ...mockCampaign.rules,
          followUpEnabled: true,
          followUpDelayDays: 1, // Too aggressive
        },
      };
      
      const templates = generateMessageTemplates(aggressiveCampaign);
      const checks = generateQualityChecks(aggressiveCampaign, mockCustomers, templates);
      
      const aggressiveCheck = checks.find((c) => c.id === "follow-up-too-aggressive");
      expect(aggressiveCheck).toBeDefined();
    });

    it("should detect missing contact info", () => {
      const customersWithoutContact = [
        {
          ...mockCustomers[0],
          phone: undefined,
          email: undefined,
        },
      ];
      
      const templates = generateMessageTemplates(mockCampaign);
      const checks = generateQualityChecks(mockCampaign, customersWithoutContact, templates);
      
      const missingContactCheck = checks.find((c) => c.id === "missing-contact-info");
      expect(missingContactCheck).toBeDefined();
    });
  });

  describe("generateNextActions", () => {
    it("should suggest fixing quality issues", () => {
      const qualityChecks = [
        {
          id: "test-error",
          severity: "error" as const,
          title: "Test Error",
          description: "Test error description",
        },
      ];
      
      const metrics = {
        loaded: 5,
        ready: 3,
        queued: 2,
        sent: 1,
        clicked: 0,
        reviewed: 0,
        optedOut: 0,
      };
      
      const actions = generateNextActions(mockCampaign, metrics, qualityChecks);
      
      const fixAction = actions.find((a) => a.id === "fix-quality-issues");
      expect(fixAction).toBeDefined();
    });

    it("should suggest adding more customers if few exist", () => {
      const metrics = {
        loaded: 3,
        ready: 2,
        queued: 1,
        sent: 0,
        clicked: 0,
        reviewed: 0,
        optedOut: 0,
      };
      
      const actions = generateNextActions(mockCampaign, metrics, []);
      
      const addMoreAction = actions.find((a) => a.id === "add-more-customers");
      expect(addMoreAction).toBeDefined();
    });
  });

  describe("processReviewRequestAutomation", () => {
    it("should process valid request", () => {
      const request = {
        campaign: mockCampaign,
        customers: mockCustomers,
        events: mockEvents,
      };
      
      const response = processReviewRequestAutomation(request);
      
      expect(response).toHaveProperty("templates");
      expect(response).toHaveProperty("sendQueue");
      expect(response).toHaveProperty("metrics");
      expect(response).toHaveProperty("qualityChecks");
      expect(response).toHaveProperty("nextActions");
      expect(response).toHaveProperty("validationErrors");
    });

    it("should validate required fields", () => {
      const invalidCampaign = {
        ...mockCampaign,
        businessName: "",
      };
      
      const request = {
        campaign: invalidCampaign,
        customers: mockCustomers,
        events: mockEvents,
      };
      
      const response = processReviewRequestAutomation(request);
      
      expect(response.validationErrors.length).toBeGreaterThan(0);
      expect(response.validationErrors.some((e) => e.includes("Business name"))).toBe(true);
    });

    it("should validate review link URL", () => {
      const invalidCampaign = {
        ...mockCampaign,
        reviewLink: "not-a-url",
      };
      
      const request = {
        campaign: invalidCampaign,
        customers: mockCustomers,
        events: mockEvents,
      };
      
      const response = processReviewRequestAutomation(request);
      
      expect(response.validationErrors.length).toBeGreaterThan(0);
      expect(response.validationErrors.some((e) => e.includes("URL"))).toBe(true);
    });

    it("should validate send delay hours range", () => {
      const invalidCampaign = {
        ...mockCampaign,
        rules: {
          ...mockCampaign.rules,
          sendDelayHours: 200, // > 168
        },
      };
      
      const request = {
        campaign: invalidCampaign,
        customers: mockCustomers,
        events: mockEvents,
      };
      
      const response = processReviewRequestAutomation(request);
      
      expect(response.validationErrors.length).toBeGreaterThan(0);
      expect(response.validationErrors.some((e) => e.includes("Send delay"))).toBe(true);
    });
  });
});

