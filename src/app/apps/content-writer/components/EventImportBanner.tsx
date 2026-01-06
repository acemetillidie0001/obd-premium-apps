"use client";

import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

interface EventHandoffPayload {
  payloadVersion?: number;
  sourceApp: "event-campaign-builder";
  intent: "landing-page";
  payloadHash?: string;
  ttlMs?: number;
  createdAt: string;
  eventFacts: {
    eventName: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    eventType: "InPerson" | "Virtual" | "Hybrid";
    businessName: string;
    businessType: string;
    city: string;
    state: string;
  };
  description: string;
  agendaBullets: string[];
  cta: string;
  faqSeeds: string[];
}

interface EventImportBannerProps {
  isDark: boolean;
  payload: EventHandoffPayload;
  onApplyToInputs: () => void;
  onDismiss: () => void;
}

export default function EventImportBanner({
  isDark,
  payload,
  onApplyToInputs,
  onDismiss,
}: EventImportBannerProps) {
  const { eventFacts } = payload;
  
  // Build summary text with event details
  const summaryParts: string[] = [];
  
  // Event name
  if (eventFacts.eventName) {
    summaryParts.push(eventFacts.eventName);
  }
  
  // Date
  if (eventFacts.eventDate) {
    summaryParts.push(eventFacts.eventDate);
  }
  
  // Location
  if (eventFacts.eventLocation) {
    summaryParts.push(eventFacts.eventLocation);
  }
  
  // Event type
  if (eventFacts.eventType) {
    const typeLabels: Record<string, string> = {
      InPerson: "In-Person",
      Virtual: "Virtual",
      Hybrid: "Hybrid",
    };
    summaryParts.push(typeLabels[eventFacts.eventType] || eventFacts.eventType);
  }
  
  // Business name/type
  const businessInfo: string[] = [];
  if (eventFacts.businessName) businessInfo.push(eventFacts.businessName);
  if (eventFacts.businessType) businessInfo.push(eventFacts.businessType);
  if (businessInfo.length > 0) {
    summaryParts.push(businessInfo.join(" • "));
  }
  
  const summary = summaryParts.length > 0 ? summaryParts.join(" • ") : "Event";

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
          <strong>Imported from Event Campaign Builder</strong>
        </p>
        <p
          className={`text-xs mt-1 ${
            isDark ? "text-teal-400" : "text-teal-700"
          }`}
        >
          {summary}
        </p>
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

