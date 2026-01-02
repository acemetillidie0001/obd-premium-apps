/**
 * Resend Client Wrapper
 * 
 * Provides a lazily-instantiated Resend client with safe error handling.
 * Uses dynamic import to avoid bundling issues if "resend" package isn't present.
 * Only throws errors when attempting to send emails, not at import time.
 */

type ResendClient = any; // Type for the Resend client instance

let resendClient: ResendClient | null = null;
let resendModule: any = null;

async function loadResendModule(): Promise<any> {
  if (!resendModule) {
    try {
      resendModule = await import("resend");
    } catch (error) {
      throw new Error(
        'Resend package is not installed. Install with: npm install resend'
      );
    }
  }
  return resendModule;
}

/**
 * Get or create a Resend client instance.
 * 
 * @returns Resend client instance
 * @throws Error if RESEND_API_KEY is missing or Resend package is not installed
 */
export async function getResendClient(): Promise<ResendClient> {
  // If client already exists, return it
  if (resendClient) {
    return resendClient;
  }

  // Check for API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "RESEND_API_KEY environment variable is not set. Email sending is disabled."
    );
  }

  // Dynamically import Resend module
  const { Resend } = await loadResendModule();

  // Create and cache client
  resendClient = new Resend(apiKey);
  return resendClient;
}

