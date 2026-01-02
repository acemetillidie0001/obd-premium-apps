/**
 * OBD Scheduler & Booking Notifications (V3)
 * 
 * Email notification functions for booking request lifecycle events.
 * Uses Resend for email delivery with branded HTML templates.
 */

import { getResendClient } from "@/lib/email/resendClient";
import { generateCustomerRequestConfirmationEmail } from "./email/customerRequestConfirmation";
import { generateBusinessRequestNotificationEmail } from "./email/businessRequestNotification";
import type { BookingRequest, BookingService } from "./types";

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
    const resend = getResendClient();
    const from = getEmailFrom();

    const subject = `Booking Request Received - ${businessName || "Business"}`;
    const htmlBody = generateCustomerRequestConfirmationEmail({
      businessName,
      customerName: request.customerName,
      serviceName: service?.name || null,
      preferredStart: request.preferredStart,
      message: request.message || null,
    });

    const result = await resend.emails.send({
      from,
      to: request.customerEmail,
      subject,
      html: htmlBody,
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
    const resend = getResendClient();
    const from = getEmailFrom();

    const subject = `New Booking Request Received - ${businessName || "Business"}`;
    const htmlBody = generateBusinessRequestNotificationEmail({
      businessName,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone || null,
      serviceName: service?.name || null,
      preferredStart: request.preferredStart,
      message: request.message || null,
    });

    const result = await resend.emails.send({
      from,
      to: notificationEmail,
      subject,
      html: htmlBody,
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
    const resend = getResendClient();
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
    const resend = getResendClient();
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
    const resend = getResendClient();
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
    const resend = getResendClient();
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

// Helper functions (for other email functions that still use inline templates)

function escapeHtml(text: string): string {
  // Server-side HTML escaping
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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


