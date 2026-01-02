/**
 * OBD Scheduler & Booking - Shared Validation Helpers (P1-12)
 * 
 * Pure validation functions (no React dependencies) for consistent validation
 * across client and server code.
 */

/**
 * Validate email address format (aligned with Zod email() pattern)
 * 
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) {
    return false;
  }
  
  // Zod-like email pattern: requires @ and domain with at least one dot
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return false;
  }
  
  // Additional checks: domain must have at least 2 chars after dot
  const parts = trimmed.split("@");
  if (parts.length !== 2 || parts[1].split(".").length < 2 || parts[1].split(".")[parts[1].split(".").length - 1].length < 2) {
    return false;
  }
  
  return true;
}

/**
 * Validate phone number format (US-friendly, E.164 compatible)
 * Allows common formatting characters, requires 10-15 digits
 * 
 * @param phone - Phone number to validate (optional)
 * @returns true if valid or empty (optional field), false otherwise
 */
export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone || !phone.trim()) {
    return true; // Phone is optional
  }
  
  const trimmed = phone.trim();
  
  // Remove all non-digit characters for validation
  const digitsOnly = trimmed.replace(/\D/g, "");
  
  // Require at least 10 digits (US minimum)
  if (digitsOnly.length < 10) {
    return false;
  }
  
  // Cap at 15 digits (E.164 maximum, including country code)
  if (digitsOnly.length > 15) {
    return false;
  }
  
  // Check for valid formatting characters only (digits, spaces, (), -, +, .)
  const validFormatPattern = /^[\d\s()+\-\.]+$/;
  if (!validFormatPattern.test(trimmed)) {
    return false;
  }
  
  return true;
}

/**
 * Validate preferred start time against business rules
 * 
 * @param preferredStartISO - ISO string of preferred start time
 * @param opts - Validation options
 * @param opts.minNoticeHours - Minimum hours notice required
 * @param opts.maxDaysOut - Maximum days in the future allowed
 * @returns Validation result with ok status and optional error message
 */
export function validatePreferredStart(
  preferredStartISO: string,
  opts: { minNoticeHours: number; maxDaysOut: number }
): { ok: true } | { ok: false; message: string } {
  try {
    const preferredDate = new Date(preferredStartISO);
    if (isNaN(preferredDate.getTime())) {
      return { ok: false, message: "Invalid preferred start time. Please select a valid date and time." };
    }

    const now = new Date();
    const minNoticeHours = opts.minNoticeHours ?? 24;
    const maxDaysOut = opts.maxDaysOut ?? 90;

    // Check minimum notice (must be >= now + minNoticeHours)
    const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
    if (preferredDate < minAllowedTime) {
      const hoursText = minNoticeHours === 1 ? "1 hour" : `${minNoticeHours} hours`;
      return { ok: false, message: `Preferred time must be at least ${hoursText} in the future.` };
    }

    // Check maximum days out (must be <= now + maxDaysOut)
    const maxAllowedTime = new Date(now.getTime() + maxDaysOut * 24 * 60 * 60 * 1000);
    if (preferredDate > maxAllowedTime) {
      const daysText = maxDaysOut === 1 ? "1 day" : `${maxDaysOut} days`;
      return { ok: false, message: `Preferred time cannot be more than ${daysText} in the future.` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: "Invalid preferred start time. Please select a valid date and time." };
  }
}

