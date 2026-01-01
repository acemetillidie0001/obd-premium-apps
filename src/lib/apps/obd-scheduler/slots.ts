/**
 * OBD Scheduler & Booking - Slot Generation Engine (V4 Tier 1B)
 * 
 * Generates available booking slots based on:
 * - Availability windows (business hours by day)
 * - Availability exceptions (closed days, custom hours)
 * - Existing bookings (conflict blocking)
 * - Booking settings (min notice, max days out, buffer minutes)
 * - Service duration (if provided)
 * 
 * All slots are in 15-minute increments.
 */

import type {
  AvailabilityWindow,
  AvailabilityException,
  BookingRequest,
} from "./types";
import { AvailabilityExceptionType, BookingStatus } from "./types";

export interface SlotGenerationInput {
  businessTimezone: string;
  minNoticeHours: number;
  maxDaysOut: number;
  bufferMinutes: number;
  availabilityWindows: AvailabilityWindow[];
  availabilityExceptions: AvailabilityException[];
  existingBookings: BookingRequest[];
  serviceDurationMinutes?: number; // If not provided, defaults to 60
  targetDate: string; // YYYY-MM-DD format
}

export interface Slot {
  startTime: string; // ISO 8601 format
  displayTime: string; // Human-readable format (e.g., "9:00 AM")
}

/**
 * Generate available slots for a given date
 */
export function generateSlots(input: SlotGenerationInput): Slot[] {
  const {
    businessTimezone,
    minNoticeHours,
    maxDaysOut,
    bufferMinutes,
    availabilityWindows,
    availabilityExceptions,
    existingBookings,
    serviceDurationMinutes = 60, // Default 60 minutes if not provided
    targetDate,
  } = input;

  // Parse target date
  const targetDateObj = new Date(`${targetDate}T00:00:00`);
  const dayOfWeek = targetDateObj.getDay(); // 0 = Sunday, 6 = Saturday

  // Check if date is within maxDaysOut
  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + maxDaysOut);
  
  if (targetDateObj > maxDate) {
    return []; // Date is too far out
  }

  // Check for exceptions first
  const exception = availabilityExceptions.find(
    (e) => e.date === targetDate
  );

  if (exception) {
    if (exception.type === AvailabilityExceptionType.CLOSED_ALL_DAY) {
      return []; // Closed all day
    }

    if (exception.type === AvailabilityExceptionType.CUSTOM_HOURS) {
      // Use custom hours if provided
      if (exception.startTime && exception.endTime) {
        return generateSlotsForTimeRange(
          targetDate,
          exception.startTime,
          exception.endTime,
          businessTimezone,
          minNoticeHours,
          bufferMinutes,
          serviceDurationMinutes,
          existingBookings,
          now
        );
      }
      // If custom hours exception but no times, treat as closed
      return [];
    }
  }

  // Find availability window for this day
  const window = availabilityWindows.find(
    (w) => w.dayOfWeek === dayOfWeek && w.isEnabled
  );

  if (!window) {
    return []; // No availability window for this day
  }

  // Generate slots for the window
  return generateSlotsForTimeRange(
    targetDate,
    window.startTime,
    window.endTime,
    businessTimezone,
    minNoticeHours,
    bufferMinutes,
    serviceDurationMinutes,
    existingBookings,
    now
  );
}

/**
 * Generate slots for a specific time range
 */
function generateSlotsForTimeRange(
  date: string,
  startTimeStr: string,
  endTimeStr: string,
  timezone: string,
  minNoticeHours: number,
  bufferMinutes: number,
  serviceDurationMinutes: number,
  existingBookings: BookingRequest[],
  now: Date
): Slot[] {
  // Parse start and end times (HH:mm format)
  const [startHour, startMinute] = startTimeStr.split(":").map(Number);
  const [endHour, endMinute] = endTimeStr.split(":").map(Number);

  // Create date objects for start and end of the day in the business timezone
  // Note: We're working in UTC and will convert to business timezone for display
  const dayStart = new Date(`${date}T00:00:00Z`);
  const slotStart = new Date(dayStart);
  slotStart.setUTCHours(startHour, startMinute, 0, 0);

  const slotEnd = new Date(dayStart);
  slotEnd.setUTCHours(endHour, endMinute, 0, 0);

  const slots: Slot[] = [];
  const slotDurationMs = 15 * 60 * 1000; // 15 minutes in milliseconds

  // Generate candidate slots in 15-minute increments
  let currentSlot = new Date(slotStart);

  while (currentSlot < slotEnd) {
    // Round to next 15-minute boundary if needed
    const minutes = currentSlot.getUTCMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    
    if (roundedMinutes >= 60) {
      currentSlot.setUTCHours(currentSlot.getUTCHours() + 1);
      currentSlot.setUTCMinutes(0);
    } else {
      currentSlot.setUTCMinutes(roundedMinutes);
    }
    currentSlot.setUTCSeconds(0);
    currentSlot.setUTCMilliseconds(0);

    if (currentSlot >= slotEnd) {
      break; // Past end time
    }

    // Calculate slot end time (start + service duration)
    const slotEndTime = new Date(
      currentSlot.getTime() + serviceDurationMinutes * 60 * 1000
    );

    // Check if slot end time exceeds window end time
    if (slotEndTime > slotEnd) {
      currentSlot = new Date(currentSlot.getTime() + slotDurationMs);
      continue; // Skip this slot, it doesn't fit
    }

    // Apply min notice check (relative to NOW in business timezone)
    // For simplicity, we'll check in UTC and adjust
    const minNoticeTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
    
    if (currentSlot < minNoticeTime) {
      currentSlot = new Date(currentSlot.getTime() + slotDurationMs);
      continue; // Too soon, skip
    }

    // Check for conflicts with existing bookings
    const hasConflict = existingBookings.some((booking) => {
      // Only check bookings with conflict statuses
      if (
        booking.status !== BookingStatus.APPROVED &&
        booking.status !== BookingStatus.COMPLETED &&
        booking.status !== BookingStatus.PROPOSED_TIME
      ) {
        return false; // REQUESTED, DECLINED, CANCELED don't block
      }

      // Check if booking has a time
      if (!booking.proposedStart || !booking.proposedEnd) {
        // If no proposed time, check preferredStart (for old bookings)
        if (!booking.preferredStart) {
          return false;
        }
        
        // Use preferredStart and estimate end based on service duration
        const bookingStart = new Date(booking.preferredStart);
        const bookingEnd = new Date(
          bookingStart.getTime() + serviceDurationMinutes * 60 * 1000
        );
        
        // Check overlap: slot overlaps if it starts before booking ends and ends after booking starts
        return currentSlot < bookingEnd && slotEndTime > bookingStart;
      }

      // Use proposed times
      const bookingStart = new Date(booking.proposedStart);
      const bookingEnd = new Date(booking.proposedEnd);

      // Check overlap
      return currentSlot < bookingEnd && slotEndTime > bookingStart;
    });

    if (hasConflict) {
      currentSlot = new Date(currentSlot.getTime() + slotDurationMs);
      continue; // Conflict, skip
    }

    // Check buffer minutes: ensure there's buffer space before and after
    // Check if any booking ends within bufferMinutes before this slot
    const bufferBefore = new Date(currentSlot.getTime() - bufferMinutes * 60 * 1000);
    const bufferAfter = new Date(slotEndTime.getTime() + bufferMinutes * 60 * 1000);

    const hasBufferConflict = existingBookings.some((booking) => {
      if (
        booking.status !== BookingStatus.APPROVED &&
        booking.status !== BookingStatus.COMPLETED &&
        booking.status !== BookingStatus.PROPOSED_TIME
      ) {
        return false;
      }

      let bookingStart: Date;
      let bookingEnd: Date;

      if (booking.proposedStart && booking.proposedEnd) {
        bookingStart = new Date(booking.proposedStart);
        bookingEnd = new Date(booking.proposedEnd);
      } else if (booking.preferredStart) {
        bookingStart = new Date(booking.preferredStart);
        bookingEnd = new Date(
          bookingStart.getTime() + serviceDurationMinutes * 60 * 1000
        );
      } else {
        return false;
      }

      // Check if booking overlaps with buffer zones
      return (
        (bookingStart < bufferAfter && bookingEnd > bufferBefore) ||
        (bookingStart < slotEndTime && bookingEnd > currentSlot)
      );
    });

    if (hasBufferConflict) {
      currentSlot = new Date(currentSlot.getTime() + slotDurationMs);
      continue; // Buffer conflict, skip
    }

    // Slot is available!
    const slotISO = currentSlot.toISOString();
    const displayTime = formatSlotTime(currentSlot, timezone);

    slots.push({
      startTime: slotISO,
      displayTime,
    });

    // Move to next 15-minute slot
    currentSlot = new Date(currentSlot.getTime() + slotDurationMs);
  }

  return slots;
}

/**
 * Format slot time for display
 */
function formatSlotTime(date: Date, timezone: string): string {
  // For now, use local time formatting
  // In production, you might want to use a library like date-fns-tz
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

