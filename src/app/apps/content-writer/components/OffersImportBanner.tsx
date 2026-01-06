"use client";

import { SUBMIT_BUTTON_CLASSES, getSecondaryButtonClasses } from "@/lib/obd-framework/layout-helpers";

interface OffersHandoffPayload {
  payloadVersion: number;
  sourceApp: "offers-builder";
  intent: "landing-page";
  payloadHash: string;
  ttlMs: number;
  createdAt: number;
  offerFacts: {
    promoTitle: string;
    promoType: string;
    offerValue: string;
    newCustomersOnly: boolean;
    redemptionLimits: string;
    endDate: string;
    primaryCTA: string;
    urgencyLevel: "low" | "medium" | "high";
    businessName: string;
    businessType: string;
  };
  copy?: {
    offerSummary?: {
      headline?: string;
      subheadline?: string;
      shortPitch?: string;
      fullPitch?: string;
    };
    websiteBanner?: {
      headline?: string;
      subheadline?: string;
      buttonText?: string;
    };
  };
  pageDraft: {
    pageGoal: string;
    primaryCTA: string;
    suggestedSections: string[];
    faqSeedQuestions: string[];
  };
}

interface OffersImportBannerProps {
  isDark: boolean;
  payload: OffersHandoffPayload;
  onApplyToInputs: () => void;
  onDismiss: () => void;
}

export default function OffersImportBanner({
  isDark,
  payload,
  onApplyToInputs,
  onDismiss,
}: OffersImportBannerProps) {
  const { offerFacts } = payload;
  
  // Build summary text with all required fields
  const summaryParts: string[] = [];
  
  // Offer title
  if (offerFacts.promoTitle) {
    summaryParts.push(offerFacts.promoTitle);
  }
  
  // Value
  if (offerFacts.offerValue) {
    summaryParts.push(offerFacts.offerValue);
  }
  
  // Expiration
  if (offerFacts.endDate) {
    try {
      const date = new Date(offerFacts.endDate);
      summaryParts.push(`Expires ${date.toLocaleDateString()}`);
    } catch {
      summaryParts.push(`Expires ${offerFacts.endDate}`);
    }
  }
  
  // CTA
  if (offerFacts.primaryCTA) {
    summaryParts.push(`CTA: ${offerFacts.primaryCTA}`);
  }
  
  // Business name/type
  const businessInfo: string[] = [];
  if (offerFacts.businessName) businessInfo.push(offerFacts.businessName);
  if (offerFacts.businessType) businessInfo.push(offerFacts.businessType);
  if (businessInfo.length > 0) {
    summaryParts.push(businessInfo.join(" • "));
  }
  
  const summary = summaryParts.length > 0 ? summaryParts.join(" • ") : "Special offer";

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

