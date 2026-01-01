/**
 * OBD Scheduler & Booking Types (V3)
 * 
 * Type definitions for the OBD Scheduler & Booking app.
 * V3 Principle: REQUEST-BASED BOOKING (not real-time calendar sync).
 */

export enum BookingStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  PROPOSED_TIME = "PROPOSED_TIME",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}

export interface BookingService {
  id: string;
  businessId: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingSettings {
  id: string;
  businessId: string;
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
}

export interface UpdateServiceRequest {
  name?: string;
  durationMinutes?: number;
  description?: string | null;
  active?: boolean;
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
  timezone?: string;
  bufferMinutes?: number;
  minNoticeHours?: number;
  maxDaysOut?: number;
  policyText?: string | null;
  notificationEmail?: string | null;
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

