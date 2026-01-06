"use client";

import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";
import { formatEventDateRange } from "@/lib/apps/event-campaign-builder/handoff-utils";

interface OffersHandoffPayload {
  eventName?: string;
  title?: string;
  eventDate?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  startDate?: string;
  endDate?: string;
  date?: string;
  primaryCTA?: string;
  description?: string;
  location?: string;
  businessName?: string;
  businessType?: string;
  city?: string;
  state?: string;
  brandVoice?: string;
  personalityStyle?: string;
  language?: string;
  businessId?: string;
  tenantId?: string;
}

interface EventCampaignImportBannerProps {
  isDark: boolean;
  payload: OffersHandoffPayload;
  onApplyToInputs: () => void;
  onDismiss: () => void;
}

export default function EventCampaignImportBanner({
  isDark,
  payload,
  onApplyToInputs,
  onDismiss,
}: EventCampaignImportBannerProps) {
  // Build summary fields
  const eventName = payload.eventName || payload.title || "Untitled Event";
  
  // Format date range using utility
  let dateRange: string | null = null;
  if (payload.dateRange && typeof payload.dateRange === "object") {
    const range = payload.dateRange as { start?: unknown; end?: unknown };
    dateRange = formatEventDateRange(range.start, range.end);
  } else if (payload.startDate || payload.endDate) {
    dateRange = formatEventDateRange(payload.startDate, payload.endDate);
  } else if (payload.eventDate) {
    dateRange = formatEventDateRange(payload.eventDate);
  } else if (payload.date) {
    dateRange = formatEventDateRange(payload.date);
  }
  
  const primaryCTA = payload.primaryCTA;

  // Build summary text
  const summaryParts: string[] = [];
  
  if (eventName) {
    summaryParts.push(eventName);
  }
  
  if (dateRange) {
    summaryParts.push(dateRange);
  }
  
  if (primaryCTA) {
    summaryParts.push(`CTA: ${primaryCTA}`);
  }

  const summary = summaryParts.length > 0 ? summaryParts.join(" • ") : "Event details available";

  return (
    <div
      className={`mb-6 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDark
          ? "bg-teal-900/20 border-teal-700"
          : "bg-teal-50 border-teal-200"
      }`}
    >
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${
            isDark ? "text-teal-300" : "text-teal-800"
          }`}
        >
          <strong>Imported from Offers & Promotions Builder</strong>
        </p>
        <div className={`text-xs mt-1 space-y-1 ${
          isDark ? "text-teal-400" : "text-teal-700"
        }`}>
          <div>
            <span className="font-medium">Event:</span> {eventName}
          </div>
          {dateRange && (
            <div>
              <span className="font-medium">Date:</span> {dateRange}
            </div>
          )}
          {primaryCTA && (
            <div>
              <span className="font-medium">CTA:</span> {primaryCTA}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onApplyToInputs}
          className={SUBMIT_BUTTON_CLASSES}
        >
          Apply to inputs
        </button>
        <button
          onClick={onDismiss}
          className={getSecondaryButtonClasses(isDark)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

