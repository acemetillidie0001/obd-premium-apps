/**
 * Event Campaign Builder Handoff Utilities
 * 
 * ARCHITECTURAL OVERVIEW:
 * 
 * This module provides integration helpers for the Event Campaign Builder app.
 * The Event Campaign Builder is a campaign orchestration planner for time-bound events.
 * It generates structured, multi-channel campaign drafts.
 * 
 * This app is NOT:
 * - A scheduler (does not schedule posts or send at specific times)
 * - A calendar (does not manage event calendars or dates)
 * - A ticketing system (does not handle ticket sales or reservations)
 * - A CRM (does not manage customer relationships or contacts)
 * - An automation engine (does not execute or trigger automated actions)
 * 
 * This app does NOT:
 * - Publish content to any platform
 * - Schedule posts or messages
 * - Send emails or SMS messages
 * - Sync with external systems
 * 
 * This app ONLY:
 * - Generates campaign content drafts (text, copy, suggestions)
 * - Provides structured campaign plans and recommendations
 * - Outputs content that users can manually review, edit, and use elsewhere
 * 
 * Lightweight helper utilities for receiving and validating Offers -> Event Campaign handoffs.
 * No heavy parsing libraries required.
 */

/**
 * Safely parse a date from various input formats
 * 
 * Handles:
 * - ISO date strings (e.g., "2024-03-31T00:00:00Z")
 * - Date strings (e.g., "March 31, 2024", "2024-03-31")
 * - Unix timestamps (numbers)
 * - Date objects
 * 
 * @param input - Date input in various formats
 * @returns Parsed Date object or null if parsing fails
 */
export function safeParseDate(input: unknown): Date | null {
  if (!input) return null;

  // Already a Date object
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Number (timestamp)
  if (typeof input === "number") {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  // String
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try parsing as ISO string or standard date string
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Format a date range for display
 * 
 * Examples:
 * - Same date: "Mar 31" (single date)
 * - Different dates: "Mar 31 – Apr 2" (range)
 * - Same month: "Mar 31 – Mar 15" (if end is before start, shows both)
 * 
 * @param startDate - Start date (string, Date, timestamp, or null)
 * @param endDate - End date (string, Date, timestamp, or null)
 * @returns Formatted date string or null if both dates are invalid
 */
export function formatEventDateRange(
  startDate: unknown,
  endDate?: unknown
): string | null {
  const start = safeParseDate(startDate);
  const end = endDate ? safeParseDate(endDate) : null;

  // If no valid start date, return null
  if (!start) return null;

  // Format single date
  const formatDate = (date: Date): string => {
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  // If no end date or end equals start, return single date
  if (!end || start.getTime() === end.getTime()) {
    return formatDate(start);
  }

  // Format range
  const startFormatted = formatDate(start);
  const endFormatted = formatDate(end);

  // If same month, only show month once: "Mar 31 – 2"
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });

  if (startMonth === endMonth) {
    return `${startFormatted} – ${end.getDate()}`;
  }

  // Different months: "Mar 31 – Apr 2"
  return `${startFormatted} – ${endFormatted}`;
}

/**
 * Validate an event handoff payload structure
 * 
 * Checks for:
 * - eventName OR title present
 * - eventDate/dateRange fields present OR parseable
 * - primaryCTA (optional but recommended)
 * 
 * @param payload - The handoff payload to validate
 * @returns Validation result with ok flag and optional reason
 */
export function validateEventHandoffPayload(payload: unknown): {
  ok: boolean;
  reason?: string;
} {
  // Check if payload is an object
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Invalid payload structure" };
  }

  const p = payload as Record<string, unknown>;

  // Check for eventName OR title
  const hasEventName =
    p.eventName &&
    typeof p.eventName === "string" &&
    p.eventName.trim().length > 0;
  const hasTitle =
    p.title && typeof p.title === "string" && p.title.trim().length > 0;

  if (!hasEventName && !hasTitle) {
    return { ok: false, reason: "Missing eventName or offer title" };
  }

  // Check for date fields
  const hasEventDate =
    p.eventDate &&
    typeof p.eventDate === "string" &&
    p.eventDate.trim().length > 0;
  const hasDateRange =
    p.dateRange &&
    typeof p.dateRange === "object" &&
    p.dateRange !== null &&
    "start" in p.dateRange;
  const hasStartDate = p.startDate && safeParseDate(p.startDate) !== null;
  const hasEndDate = p.endDate && safeParseDate(p.endDate) !== null;
  const hasDate = p.date && safeParseDate(p.date) !== null;

  // At least one date field must be present and parseable
  if (!hasEventDate && !hasDateRange && !hasStartDate && !hasEndDate && !hasDate) {
    return {
      ok: false,
      reason: "Missing or unparseable eventDate/dateRange",
    };
  }

  // Validate dateRange structure if present
  if (hasDateRange) {
    const range = p.dateRange as Record<string, unknown>;
    const rangeStart = safeParseDate(range.start);
    const rangeEnd = safeParseDate(range.end);

    if (!rangeStart && !rangeEnd) {
      return {
        ok: false,
        reason: "dateRange has unparseable start/end dates",
      };
    }
  }

  // primaryCTA is optional but recommended - no validation error if missing
  // All required fields are present
  return { ok: true };
}

