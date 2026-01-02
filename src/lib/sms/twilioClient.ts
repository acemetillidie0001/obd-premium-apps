/**
 * Twilio Client Wrapper (Tier 5.4A)
 * 
 * Lazy instantiation to prevent crashes when env vars are missing or Twilio package is not installed.
 * All functions are safe and will not expose secrets in error messages.
 */

// Type definition for Twilio (lazy import to avoid requiring the package at build time)
type TwilioClient = any;

let twilioClient: TwilioClient | null = null;
let twilioModule: any = null;

/**
 * Lazy load Twilio module (only when needed)
 * @throws Error if Twilio package is not installed
 */
function loadTwilioModule(): any {
  if (!twilioModule) {
    try {
      twilioModule = require("twilio");
    } catch (error) {
      throw new Error("Twilio package is not installed. Install with: npm install twilio");
    }
  }
  return twilioModule;
}

/**
 * Validate Twilio account SID format (basic check)
 */
function isValidAccountSid(sid: string | undefined): boolean {
  if (!sid || typeof sid !== "string") return false;
  // Twilio SIDs start with "AC" and are 34 characters
  return sid.startsWith("AC") && sid.length === 34;
}

/**
 * Validate phone number format (basic E.164 check)
 */
function isValidPhoneNumber(phone: string | undefined): boolean {
  if (!phone || typeof phone !== "string") return false;
  // Basic E.164 check: starts with + and has digits
  return /^\+[1-9]\d{1,14}$/.test(phone.trim());
}

/**
 * Check if SMS is enabled via environment variables
 * 
 * Returns false if:
 * - SMS_ENABLED is not "true"
 * - Required env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are missing
 */
export function isSmsEnabled(): boolean {
  // Check explicit flag first
  if (process.env.SMS_ENABLED !== "true") {
    return false;
  }

  // Check if required env vars are present
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return false;
  }

  // Basic validation
  if (!isValidAccountSid(accountSid)) {
    return false;
  }

  if (authToken.length < 32) {
    return false;
  }

  if (!isValidPhoneNumber(fromNumber)) {
    return false;
  }

  return true;
}

/**
 * Get Twilio client instance (lazy initialization)
 * 
 * @throws Error if Twilio package is not installed, env vars are missing, or invalid (error message does not contain secrets)
 */
export function getTwilioClient(): TwilioClient {
  if (!twilioClient) {
    const Twilio = loadTwilioModule().Twilio;
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid) {
      throw new Error("TWILIO_ACCOUNT_SID environment variable is required");
    }

    if (!authToken) {
      throw new Error("TWILIO_AUTH_TOKEN environment variable is required");
    }

    // Basic validation (don't expose actual values in errors)
    if (!isValidAccountSid(accountSid)) {
      throw new Error("TWILIO_ACCOUNT_SID format is invalid (must start with AC and be 34 characters)");
    }

    if (authToken.length < 32) {
      throw new Error("TWILIO_AUTH_TOKEN appears to be invalid (too short)");
    }

    try {
      twilioClient = new Twilio(accountSid, authToken);
    } catch (error) {
      // Don't expose secrets in error messages
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to initialize Twilio client: ${errorMsg}`);
    }
  }

  return twilioClient;
}

/**
 * Get SMS from number from environment
 * 
 * @throws Error if env var is missing or invalid (error message does not contain secrets)
 */
export function getSmsFromNumber(): string {
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  
  if (!fromNumber) {
    throw new Error("TWILIO_FROM_NUMBER environment variable is required");
  }

  // Basic validation
  if (!isValidPhoneNumber(fromNumber)) {
    throw new Error("TWILIO_FROM_NUMBER format is invalid (must be E.164 format, e.g., +1234567890)");
  }

  return fromNumber.trim();
}
