/**
 * Business Request Notification Email Template
 * 
 * Email sent to business when a new booking request is received.
 */

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

export interface BusinessRequestNotificationParams {
  businessName: string | null | undefined;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null | undefined;
  serviceName: string | null | undefined;
  preferredStart: string | null | undefined;
  message: string | null | undefined;
}

/**
 * Generate business request notification email HTML
 */
export function generateBusinessRequestNotificationEmail(
  params: BusinessRequestNotificationParams
): string {
  const {
    businessName,
    customerName,
    customerEmail,
    customerPhone,
    serviceName,
    preferredStart,
    message,
  } = params;

  const safeCustomerName = escapeHtml(customerName);
  const safeCustomerEmail = escapeHtml(customerEmail);
  const safeCustomerPhone = customerPhone ? escapeHtml(customerPhone) : null;
  const safeServiceName = serviceName ? escapeHtml(serviceName) : null;
  const formattedTime = formatDateTime(preferredStart);
  const safeMessage = message ? escapeHtml(message) : null;

  const bodyContent = `
    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; font-weight: 600;">
      New Booking Request
    </h2>
    
    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
      You have received a new booking request:
    </p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; color: #333333; font-size: 14px; line-height: 1.5;">
        <strong style="color: #29c4a9;">Customer:</strong> ${safeCustomerName}
      </p>
      <p style="margin: 0 0 12px 0; color: #333333; font-size: 14px; line-height: 1.5;">
        <strong style="color: #29c4a9;">Email:</strong> <a href="mailto:${safeCustomerEmail}" style="color: #29c4a9; text-decoration: none;">${safeCustomerEmail}</a>
      </p>
      ${safeCustomerPhone ? `
        <p style="margin: 0 0 12px 0; color: #333333; font-size: 14px; line-height: 1.5;">
          <strong style="color: #29c4a9;">Phone:</strong> <a href="tel:${safeCustomerPhone}" style="color: #29c4a9; text-decoration: none;">${safeCustomerPhone}</a>
        </p>
      ` : ""}
      ${safeServiceName ? `
        <p style="margin: 0 0 12px 0; color: #333333; font-size: 14px; line-height: 1.5;">
          <strong style="color: #29c4a9;">Service:</strong> ${safeServiceName}
        </p>
      ` : ""}
      <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5;">
        <strong style="color: #29c4a9;">Preferred Start:</strong> ${escapeHtml(formattedTime)}
      </p>
      ${safeMessage ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
          <p style="margin: 0 0 8px 0; color: #333333; font-size: 14px; font-weight: 600;">
            Message:
          </p>
          <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
            ${safeMessage}
          </p>
        </div>
      ` : ""}
    </div>
    
    <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #29c4a9;">
      <p style="margin: 0; color: #004085; font-size: 14px; line-height: 1.5; font-weight: 600;">
        Review this request in your dashboard
      </p>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
      Please log in to your OBD dashboard to review and respond to this request.
    </p>
  `;

  return generateEmailLayout(businessName, bodyContent);
}

