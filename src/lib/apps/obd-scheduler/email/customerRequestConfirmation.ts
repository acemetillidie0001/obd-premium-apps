/**
 * Customer Request Confirmation Email Template
 * 
 * Email sent to customer when their booking request is received.
 */

import type { BookingRequest, BookingService } from "../types";
import { generateEmailLayout } from "./sharedLayout";

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format date/time for display
 */
function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "No preference";
  
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

/**
 * Convert HTML to plain text (simple version)
 */
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Generate customer request confirmation email
 */
export function generateCustomerRequestConfirmationEmail(args: {
  request: BookingRequest;
  service: BookingService;
  brand?: { name?: string; phone?: string; email?: string; };
}): { subject: string; html: string; text: string } {
  const { request, service, brand } = args;
  const businessName = brand?.name || "Business";

  const safeCustomerName = escapeHtml(request.customerName);
  const safeServiceName = service ? escapeHtml(service.name) : null;
  const formattedTime = formatDateTime(request.preferredStart);
  const safeMessage = request.message ? escapeHtml(request.message) : null;

  const bodyContent = `
    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; font-weight: 600;">
      Booking Request Received
    </h2>
    
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
      Thank you, ${safeCustomerName}! We have received your booking request.
    </p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      ${safeServiceName ? `
        <p style="margin: 0 0 12px 0; color: #333333; font-size: 14px; line-height: 1.5;">
          <strong style="color: #29c4a9;">Service:</strong> ${safeServiceName}
        </p>
      ` : ""}
      <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5;">
        <strong style="color: #29c4a9;">Tentative Start Time:</strong> ${escapeHtml(formattedTime)}
      </p>
    </div>
    
    ${safeMessage ? `
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #29c4a9;">
        <p style="margin: 0 0 8px 0; color: #333333; font-size: 14px; font-weight: 600;">
          Your Message:
        </p>
        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
          ${safeMessage}
        </p>
      </div>
    ` : ""}
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #ffc107;">
      <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
        <strong>Note:</strong> This is a booking request. The business may confirm or propose a new time.
      </p>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
      We will review your request and get back to you shortly.
    </p>
  `;

  const html = generateEmailLayout(businessName, bodyContent);
  const subject = `Booking Request Received - ${businessName}`;
  const text = htmlToText(html);

  return { subject, html, text };
}
