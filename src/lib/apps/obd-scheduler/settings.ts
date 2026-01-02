/**
 * OBD Scheduler & Booking - Settings Utilities
 * 
 * Helper functions for ensuring booking settings exist with safe defaults.
 */

import { prisma } from "@/lib/prisma";
import { generateBookingKey } from "@/lib/apps/obd-scheduler/bookingKey";

/**
 * Ensure BookingSettings exists for a business
 * Creates one with safe defaults if it doesn't exist
 * 
 * @param businessId - The business ID
 * @param userEmail - Optional user email to use as notificationEmail
 * @returns The BookingSettings record
 */
export async function ensureSchedulerSettings(
  businessId: string,
  userEmail?: string | null
): Promise<{
  id: string;
  businessId: string;
  bookingModeDefault: string;
  timezone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysOut: number;
  policyText: string | null;
  bookingKey: string;
  notificationEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Validate businessId
  if (!businessId || typeof businessId !== "string") {
    throw new Error("Invalid businessId");
  }

  try {
    // Check if settings already exist
    let settings = await prisma.bookingSettings.findUnique({
      where: { businessId },
    });

    if (settings) {
      return settings;
    }

    // Create default settings
    // Note: instantBookingEnabled and calendarFilteringEnabled don't exist in schema
    // bookingModeDefault: "REQUEST_ONLY" effectively means instant booking is disabled
    settings = await prisma.bookingSettings.create({
      data: {
        businessId,
        bookingModeDefault: "REQUEST_ONLY",
        timezone: "America/New_York",
        bufferMinutes: 15,
        minNoticeHours: 24,
        maxDaysOut: 90,
        bookingKey: generateBookingKey(),
        notificationEmail: userEmail || null,
      },
    });

    return settings;
  } catch (error) {
    // Re-throw Prisma/database errors (connection issues, constraint violations, etc.)
    // These are real errors that should be handled by the API route
    throw error;
  }
}

