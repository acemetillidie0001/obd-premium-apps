/**
 * Resend Email Helper for Review Request Automation
 * 
 * Provides a safe wrapper around Resend API for sending review request emails.
 */

import { Resend } from "resend";

const getResendClient = (): Resend => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
};

const getEmailFrom = (): string => {
  const emailFrom = process.env.EMAIL_FROM;
  if (!emailFrom) {
    throw new Error("EMAIL_FROM environment variable is not set");
  }
  return emailFrom;
};

export interface SendReviewRequestEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/**
 * Send a review request email via Resend.
 * 
 * @param params Email parameters
 * @returns Resend email result
 * @throws Error if RESEND_API_KEY or EMAIL_FROM is missing
 */
export async function sendReviewRequestEmail(
  params: SendReviewRequestEmailParams
): Promise<{ id: string }> {
  const resend = getResendClient();
  const from = getEmailFrom();

  // Use provided subject or safe default
  const subject = params.subject.trim() || "We'd love your feedback!";

  try {
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject,
      html: params.htmlBody,
      text: params.textBody || params.htmlBody.replace(/<[^>]*>/g, ""), // Basic HTML stripping
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message || "Unknown error"}`);
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID");
    }

    return { id: result.data.id };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send email: ${String(error)}`);
  }
}

