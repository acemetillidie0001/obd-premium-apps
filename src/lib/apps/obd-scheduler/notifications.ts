/**
 * OBD Scheduler & Booking Notifications (V3)
 * 
 * Email notification functions for booking request lifecycle events.
 * Uses Resend for email delivery with branded HTML templates.
 * 
 * Server-only module - all exports are async functions that use Node.js APIs.
 */

import { getResendClient } from "@/lib/email/resendClient";
import { generateCustomerRequestConfirmationEmail } from "./email/customerRequestConfirmation";
import { generateBusinessRequestNotificationEmail } from "./email/businessRequestNotification";
import type { BookingRequest, BookingService } from "./types";

/**
 * Email content structure returned by email generator functions
 */
export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

export interface NotificationContext {
  request: BookingRequest;
  service?: BookingService | null;
  businessName?: string;
}

/**
 * Get the email "from" address with fallback
 */
function getEmailFrom(): string {
  return (
    process.env.RESEND_FROM ||
    "Ocala Business Directory <support@ocalabusinessdirectory.com>"
  );
}

/**
 * Send email confirmation to customer when booking request is received
 */
export async function sendCustomerRequestConfirmationEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  try {
    // Lazy-load Resend client (only called when function is invoked)
    const resend = await getResendClient();
    const from = getEmailFrom();

    if (!service) {
      throw new Error("Service is required for customer confirmation email");
    }

    const emailContent: EmailContent = generateCustomerRequestConfirmationEmail({
      request,
      service,
      brand: { name: businessName },
    });

    const result = await resend.emails.send({
      from,
      to: request.customerEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (result.error) {
      throw new Error(
        `Failed to send customer confirmation email: ${result.error.message || "Unknown Resend error"}`
      );
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID for customer confirmation");
    }
  } catch (error) {
    // Re-throw as meaningful Error object
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Failed to send customer confirmation email: ${String(error)}`
    );
  }
}

/**
 * Send email notification to business when booking request is received
 * 
 * @param notificationEmail - Email address from BookingSettings.notificationEmail
 */
export async function sendBusinessRequestNotificationEmail(
  context: NotificationContext,
  notificationEmail: string
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  try {
    // Lazy-load Resend client (only called when function is invoked)
    const resend = await getResendClient();
    const from = getEmailFrom();

    if (!service) {
      throw new Error("Service is required for business notification email");
    }

    const emailContent: EmailContent = generateBusinessRequestNotificationEmail({
      request,
      service,
      brand: { name: businessName },
    });

    const result = await resend.emails.send({
      from,
      to: notificationEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (result.error) {
      throw new Error(
        `Failed to send business notification email: ${result.error.message || "Unknown Resend error"}`
      );
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID for business notification");
    }
  } catch (error) {
    // Re-throw as meaningful Error object
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Failed to send business notification email: ${String(error)}`
    );
  }
}

/**
 * Send email notification when a booking request is approved
 */
export async function sendRequestApprovedEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  try {
    // Lazy-load Resend client (only called when function is invoked)
    const resend = await getResendClient();
    const from = getEmailFrom();

    const subject = `Booking Approved - ${businessName || "Business"}`;
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #29c4a9;">Booking Approved</h2>
      <p>Great news! Your booking request has been approved.</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        ${service ? `<p><strong>Service:</strong> ${escapeHtml(service.name)}</p>` : ""}
        ${request.proposedStart ? `<p><strong>Scheduled Time:</strong> ${formatDateTime(request.proposedStart)}</p>` : ""}
        ${request.proposedEnd ? `<p><strong>End Time:</strong> ${formatDateTime(request.proposedEnd)}</p>` : ""}
      </div>
      
      <p>We look forward to serving you!</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        If you need to make changes, please contact ${escapeHtml(businessName || "Business")} directly.
      </p>
    </div>
  `;

    const result = await resend.emails.send({
      from,
      to: request.customerEmail,
      subject,
      html: htmlBody,
    });

    if (result.error) {
      throw new Error(
        `Failed to send approval email: ${result.error.message || "Unknown Resend error"}`
      );
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID for approval email");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send approval email: ${String(error)}`);
  }
}

/**
 * Send email notification when a booking request is declined
 */
export async function sendRequestDeclinedEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  try {
    // Lazy-load Resend client (only called when function is invoked)
    const resend = await getResendClient();
    const from = getEmailFrom();

    const subject = `Booking Request Update - ${businessName || "Business"}`;
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #666;">Booking Request Update</h2>
      <p>Thank you for your interest in booking with ${escapeHtml(businessName || "Business")}.</p>
      
      <p>Unfortunately, we are unable to accommodate your booking request at this time.</p>
      
      ${request.internalNotes ? `
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Note:</strong> ${escapeHtml(request.internalNotes)}</p>
        </div>
      ` : ""}
      
      <p>Please feel free to contact us directly if you have any questions or would like to discuss alternative options.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Thank you for your understanding.
      </p>
    </div>
  `;

    const result = await resend.emails.send({
      from,
      to: request.customerEmail,
      subject,
      html: htmlBody,
    });

    if (result.error) {
      throw new Error(
        `Failed to send declined email: ${result.error.message || "Unknown Resend error"}`
      );
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID for declined email");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send declined email: ${String(error)}`);
  }
}

/**
 * Send email notification when a new time is proposed
 */
export async function sendProposedTimeEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  if (!request.proposedStart || !request.proposedEnd) {
    throw new Error("Proposed start and end times are required");
  }

  try {
    // Lazy-load Resend client (only called when function is invoked)
    const resend = await getResendClient();
    const from = getEmailFrom();

    const subject = `New Time Proposed for Your Booking - ${businessName || "Business"}`;
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #29c4a9;">New Time Proposed</h2>
      <p>We've proposed a new time for your booking request:</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        ${service ? `<p><strong>Service:</strong> ${escapeHtml(service.name)}</p>` : ""}
        <p><strong>Proposed Start:</strong> ${formatDateTime(request.proposedStart)}</p>
        <p><strong>Proposed End:</strong> ${formatDateTime(request.proposedEnd)}</p>
      </div>
      
      <p>Please log in to your OBD dashboard to review and respond to this proposal.</p>
      
      ${request.internalNotes ? `
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Note:</strong> ${escapeHtml(request.internalNotes)}</p>
        </div>
      ` : ""}
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        If you need to make changes, please contact ${escapeHtml(businessName || "Business")} directly.
      </p>
    </div>
  `;

    const result = await resend.emails.send({
      from,
      to: request.customerEmail,
      subject,
      html: htmlBody,
    });

    if (result.error) {
      throw new Error(
        `Failed to send proposed time email: ${result.error.message || "Unknown Resend error"}`
      );
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID for proposed time email");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send proposed time email: ${String(error)}`);
  }
}

/**
 * Send email notification when a booking is marked as completed
 */
export async function sendBookingCompletedEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  try {
    // Lazy-load Resend client (only called when function is invoked)
    const resend = await getResendClient();
    const from = getEmailFrom();

    const subject = `Thank You for Your Booking - ${businessName || "Business"}`;
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #29c4a9;">Booking Completed</h2>
      <p>Thank you for booking with ${escapeHtml(businessName || "Business")}!</p>
      
      <p>We hope you had a great experience. We'd love to hear your feedback.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Thank you for choosing ${escapeHtml(businessName || "Business")}.
      </p>
    </div>
  `;

    const result = await resend.emails.send({
      from,
      to: request.customerEmail,
      subject,
      html: htmlBody,
    });

    if (result.error) {
      throw new Error(
        `Failed to send completion email: ${result.error.message || "Unknown Resend error"}`
      );
    }

    if (!result.data?.id) {
      throw new Error("Resend API returned no email ID for completion email");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send completion email: ${String(error)}`);
  }
}

// Helper functions (for inline email templates in functions above)

/**
 * Escape HTML special characters to prevent XSS
 * Server-side only - used for inline email templates
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format date/time ISO string for display
 * Server-side only - uses Node.js Date API
 */
function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return isoString;
  }
}
