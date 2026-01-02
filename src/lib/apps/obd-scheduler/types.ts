/**
 * OBD Scheduler & Booking Types (V3/V4)
 * 
 * Type definitions for the OBD Scheduler & Booking app.
 * V3 Principle: REQUEST-BASED BOOKING (not real-time calendar sync).
 * V4 Tier 1: Foundation for Calendly parity (settings, models, UI scaffolding).
 */

import { 
  BookingMode,
  PaymentRequired as PrismaPaymentRequired,
  AvailabilityExceptionType,
  BookingStatus
} from "@prisma/client";

export type PaymentRequired = PrismaPaymentRequired;
export { BookingMode, AvailabilityExceptionType, BookingStatus };

export interface BookingService {
  id: string;
  businessId: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  active: boolean;
  paymentRequired: PaymentRequired;
  depositAmountCents: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingSettings {
  id: string;
  businessId: string;
  bookingModeDefault: BookingMode;
  timezone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysOut: number;
  policyText: string | null;
  bookingKey: string;
  notificationEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRequest {
  id: string;
  businessId: string;
  serviceId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  preferredStart: string | null;
  preferredEnd: string | null;
  message: string | null;
  status: BookingStatus;
  proposedStart: string | null;
  proposedEnd: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  service?: BookingService | null;
}

// API Request/Response Types

export interface CreateServiceRequest {
  name: string;
  durationMinutes: number;
  description?: string | null;
  active?: boolean;
  paymentRequired?: PaymentRequired;
  depositAmountCents?: number | null;
  currency?: string | null;
}

export interface UpdateServiceRequest {
  name?: string;
  durationMinutes?: number;
  description?: string | null;
  active?: boolean;
  paymentRequired?: PaymentRequired;
  depositAmountCents?: number | null;
  currency?: string | null;
}

export interface CreateBookingRequestRequest {
  serviceId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  preferredStart?: string | null;
  message?: string | null;
  bookingKey?: string; // For public form
}

export interface UpdateBookingRequestRequest {
  status?: BookingStatus;
  proposedStart?: string | null;
  proposedEnd?: string | null;
  internalNotes?: string | null;
}

export interface UpdateBookingSettingsRequest {
  bookingModeDefault?: BookingMode;
  timezone?: string;
  bufferMinutes?: number;
  minNoticeHours?: number;
  maxDaysOut?: number;
  policyText?: string | null;
  notificationEmail?: string | null;
}

// V4 Tier 1 Types

export interface AvailabilityWindow {
  id: string;
  businessId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityException {
  id: string;
  businessId: string;
  date: string; // ISO date string
  startTime: string | null; // HH:mm format (optional)
  endTime: string | null; // HH:mm format (optional)
  type: AvailabilityExceptionType;
  createdAt: string;
  updatedAt: string;
}

export interface BookingTheme {
  id: string;
  businessId: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  headlineText: string | null;
  introText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityData {
  windows: AvailabilityWindow[];
  exceptions: AvailabilityException[];
}

export interface UpdateAvailabilityRequest {
  windows?: Omit<AvailabilityWindow, "id" | "businessId" | "createdAt" | "updatedAt">[];
  exceptions?: Omit<AvailabilityException, "id" | "businessId" | "createdAt" | "updatedAt">[];
}

export interface UpdateBookingThemeRequest {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  headlineText?: string | null;
  introText?: string | null;
}

export interface BookingRequestListQuery {
  status?: BookingStatus;
  serviceId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "createdAt" | "updatedAt" | "preferredStart";
  order?: "asc" | "desc";
}

export interface BookingRequestListResponse {
  requests: BookingRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BookingRequestAuditLog {
  id: string;
  action: string; // "approve", "propose", "decline", "complete", "archive", "reactivate"
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  actorUserId: string | null;
  createdAt: string;
  metadata: Record<string, any> | null;
}

export type MetricsRange = "7d" | "30d" | "90d";

export interface SchedulerMetrics {
  range: MetricsRange;
  period: {
    start: string;
    end: string;
  };
  totalRequests: number;
  requestsByStatus: Record<string, number>;
  conversionRate: number;
  medianTimeToFirstResponse: number | null; // minutes
  medianTimeToApproval: number | null; // minutes
  servicePopularity: Array<{
    serviceId: string;
    serviceName: string;
    count: number;
  }>;
  peakHours: Array<{
    hour: number;
    count: number;
  }>;
  peakDays: Array<{
    day: number;
    dayName: string;
    count: number;
  }>;
  cancellationCount: number;
  reactivateCount: number;
}

