/**
 * OBD Scheduler & Booking Notifications (V3)
 * 
 * Email notification functions for booking request lifecycle events.
 * Uses existing Resend email utility.
 */

import { sendReviewRequestEmail } from "@/lib/email/resend";
import type { BookingRequest, BookingService } from "./types";

export interface NotificationContext {
  request: BookingRequest;
  service?: BookingService | null;
  businessName?: string;
}

/**
 * Send email confirmation to customer when booking request is received
 */
export async function sendCustomerRequestConfirmationEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  const subject = `Booking Request Received - ${businessName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #29c4a9;">Booking Request Received</h2>
      <p>Thank you, ${escapeHtml(request.customerName)}! We have received your booking request.</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        ${service ? `<p><strong>Service:</strong> ${escapeHtml(service.name)}</p>` : ""}
        ${request.preferredStart ? `<p><strong>Preferred Start:</strong> ${formatDateTime(request.preferredStart)}</p>` : ""}
        ${request.preferredEnd ? `<p><strong>Preferred End:</strong> ${formatDateTime(request.preferredEnd)}</p>` : ""}
      </div>
      
      <p>We will review your request and get back to you shortly.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated confirmation from ${businessName}.
      </p>
    </div>
  `;

  await sendReviewRequestEmail({
    to: request.customerEmail,
    subject,
    htmlBody,
  });
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

  const subject = `New Booking Request Received - ${businessName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #29c4a9;">New Booking Request</h2>
      <p>You have received a new booking request:</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Customer:</strong> ${escapeHtml(request.customerName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(request.customerEmail)}</p>
        ${request.customerPhone ? `<p><strong>Phone:</strong> ${escapeHtml(request.customerPhone)}</p>` : ""}
        ${service ? `<p><strong>Service:</strong> ${escapeHtml(service.name)}</p>` : ""}
        ${request.preferredStart ? `<p><strong>Preferred Start:</strong> ${formatDateTime(request.preferredStart)}</p>` : ""}
        ${request.preferredEnd ? `<p><strong>Preferred End:</strong> ${formatDateTime(request.preferredEnd)}</p>` : ""}
        ${request.message ? `<p><strong>Message:</strong><br>${escapeHtml(request.message)}</p>` : ""}
      </div>
      
      <p>Please log in to your OBD dashboard to review and respond to this request.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification from OBD Scheduler & Booking.
      </p>
    </div>
  `;

  await sendReviewRequestEmail({
    to: notificationEmail,
    subject,
    htmlBody,
  });
}

/**
 * Send email notification when a booking request is approved
 */
export async function sendRequestApprovedEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  const subject = `Booking Approved - ${businessName}`;
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
        If you need to make changes, please contact ${businessName} directly.
      </p>
    </div>
  `;

  await sendReviewRequestEmail({
    to: request.customerEmail,
    subject,
    htmlBody,
  });
}

/**
 * Send email notification when a booking request is declined
 */
export async function sendRequestDeclinedEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  const subject = `Booking Request Update - ${businessName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #666;">Booking Request Update</h2>
      <p>Thank you for your interest in booking with ${businessName}.</p>
      
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

  await sendReviewRequestEmail({
    to: request.customerEmail,
    subject,
    htmlBody,
  });
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

  const subject = `New Time Proposed for Your Booking - ${businessName}`;
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
        If you need to make changes, please contact ${businessName} directly.
      </p>
    </div>
  `;

  await sendReviewRequestEmail({
    to: request.customerEmail,
    subject,
    htmlBody,
  });
}

/**
 * Send email notification when a booking is marked as completed
 */
export async function sendBookingCompletedEmail(
  context: NotificationContext
): Promise<void> {
  const { request, service, businessName = "Business" } = context;

  const subject = `Thank You for Your Booking - ${businessName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #29c4a9;">Booking Completed</h2>
      <p>Thank you for booking with ${businessName}!</p>
      
      <p>We hope you had a great experience. We'd love to hear your feedback.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Thank you for choosing ${businessName}.
      </p>
    </div>
  `;

  await sendReviewRequestEmail({
    to: request.customerEmail,
    subject,
    htmlBody,
  });
}

// Helper functions

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

