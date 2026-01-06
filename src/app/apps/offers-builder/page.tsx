"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar from "@/components/obd/OBDStickyActionBar";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { isValidReturnUrl } from "@/lib/utils/crm-integration-helpers";
import { CrmIntegrationIndicator } from "@/components/crm/CrmIntegrationIndicator";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
  getSubtleButtonMediumClasses,
} from "@/lib/obd-framework/layout-helpers";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import {
  OffersBuilderRequest,
  OffersBuilderResponse,
  PromoOutput,
  PromoType,
  OutputPlatform,
  PersonalityStyle,
  LanguageOption,
} from "./types";
// Note: Using standardized sessionStorage transport with TTL
import { writeHandoff } from "@/lib/obd-framework/social-handoff-transport";
import { getHandoffHash } from "@/lib/utils/handoff-guard";

const defaultFormValues: OffersBuilderRequest = {
  businessName: "",
  businessType: "",
  services: [],
  city: "Ocala",
  state: "Florida",
  promoType: "Discount",
  promoTitle: "",
  promoDescription: "",
  offerValue: "",
  offerCode: "",
  startDate: "",
  endDate: "",
  goal: "",
  targetAudience: "",
  outputPlatforms: ["Facebook", "Instagram", "Google Business Profile"],
  brandVoice: "",
  personalityStyle: "None",
  length: "Medium",
  language: "English",
  includeHashtags: true,
  hashtagStyle: "Local",
  variationsCount: 1,
  variationMode: "Conservative",
  wizardMode: false,
};

const PROMO_TYPES: PromoType[] = [
  "Discount",
  "Limited-Time Offer",
  "Seasonal Promotion",
  "Holiday Special",
  "Flash Sale",
  "Referral Bonus",
  "Loyalty Reward",
  "New Customer Offer",
  "Bundle Deal",
  "Other",
];

const PLATFORM_OPTIONS: OutputPlatform[] = [
  "Facebook",
  "Instagram",
  "Google Business Profile",
  "X",
  "Email",
  "SMS",
  "Flyer",
  "Website Banner",
];

const PLATFORM_ICONS: Record<OutputPlatform, string> = {
  Facebook: "📘",
  Instagram: "📸",
  "Google Business Profile": "📍",
  X: "✖️",
  Email: "📧",
  SMS: "💬",
  Flyer: "📄",
  "Website Banner": "🖼️",
};

interface ResultCardProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  isDark: boolean;
  copyText?: string; // If provided, shows copy button
}

/**
 * ResultCard - Displays a result section with optional copy-to-clipboard functionality.
 * Shows "Copied!" feedback for 2 seconds after copying.
 */
function ResultCard({
  title,
  children,
  isDark,
  copyText,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("OffersBuilder Copy Error:", error);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark
          ? "bg-slate-800/50 border-slate-700"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      {(title || copyText) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3
              className={`text-sm font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {title}
            </h3>
          )}
          {copyText && (
            <button
              onClick={handleCopy}
              className={`text-xs px-2 py-1 rounded transition-colors ml-auto ${
                copied
                  ? "bg-[#29c4a9] text-white"
                  : isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
              )}
        </div>
      )}
      <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
        {children}
      </div>
    </div>
  );
}

function OffersBuilderPageContent() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  const [form, setForm] = useState<OffersBuilderRequest>(defaultFormValues);
  const [servicesInput, setServicesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OffersBuilderResponse | null>(null);
  const [lastPayload, setLastPayload] =
    useState<OffersBuilderRequest | null>(null);
  const [lastLockedFacts, setLastLockedFacts] = useState<OffersBuilderRequest["lockedFacts"] | null>(null);
  const [lastAdditionalState, setLastAdditionalState] = useState<{
    newCustomersOnly: boolean;
    primaryCTA: string;
    urgencyLevel: "low" | "medium" | "high";
    redemptionLimits: string;
  } | null>(null);

  // Version snapshot system
  const [lastGeneratedOutputs, setLastGeneratedOutputs] = useState<OffersBuilderResponse | null>(null);
  const [currentOutputs, setCurrentOutputs] = useState<OffersBuilderResponse | null>(null);
  const [editingOutputId, setEditingOutputId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<Record<string, any>>({});
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showDuplicateSendModal, setShowDuplicateSendModal] = useState(false);
  const [pendingHandoffHash, setPendingHandoffHash] = useState<string | null>(null);
  const [pendingHandoffPayload, setPendingHandoffPayload] = useState<any | null>(null);

  // Duplicate send guard: Check if same hash was sent within 30 minutes
  const checkDuplicateSend = (hash: string): boolean => {
    if (typeof window === "undefined") return false;
    
    try {
      const storageKey = "obd-offers-acw-last-sent";
      const stored = sessionStorage.getItem(storageKey);
      
      if (!stored) return false;
      
      const data = JSON.parse(stored);
      const { lastSentHash, timestamp } = data;
      
      // Check if same hash
      if (lastSentHash !== hash) return false;
      
      // Check if within 30 minutes (1800000 ms)
      const now = Date.now();
      const timeDiff = now - timestamp;
      const thirtyMinutes = 30 * 60 * 1000;
      
      return timeDiff < thirtyMinutes;
    } catch {
      return false;
    }
  };

  // Store last sent hash and timestamp
  const storeLastSentHash = (hash: string) => {
    if (typeof window === "undefined") return;
    
    try {
      const storageKey = "obd-offers-acw-last-sent";
      const data = {
        lastSentHash: hash,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Ignore sessionStorage errors
    }
  };

  // Actually send the handoff (called after duplicate check)
  const sendHandoffToACW = (payload: any, hash: string) => {
    try {
      // Store handoff payload in sessionStorage
      writeHandoff("offers-builder-to-content-writer", payload, 10 * 60 * 1000);
      
      // Store last sent hash
      storeLastSentHash(hash);
      
      // Show success toast
      showToast("Sent to AI Content Writer as a draft page.");
    } catch (error) {
      console.error("Failed to create landing page handoff:", error);
      showToast("Failed to create landing page. Please try again.");
    }
  };

  // Wizard state (6 steps: business basics → offer details → style → platforms → review)
  const [wizardStep, setWizardStep] = useState(1);
  const totalWizardSteps = 6;

  // Accordion state for Promotion Details sections
  const [accordionState, setAccordionState] = useState({
    offerBasics: true,
    eligibilityRules: false,
    messagingContext: false,
    platforms: false,
  });

  // Additional form fields for new UI (not sent to API)
  const [primaryCTA, setPrimaryCTA] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low" | "medium" | "high">("medium");
  const [newCustomersOnly, setNewCustomersOnly] = useState(false);
  const [redemptionLimits, setRedemptionLimits] = useState("");

  // Archived state (UI-only, stored in localStorage)
  const [isArchived, setIsArchived] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("offers-builder-archived");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const toggleArchived = () => {
    const newValue = !isArchived;
    setIsArchived(newValue);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("offers-builder-archived", String(newValue));
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  // Toggle accordion section
  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Helper to format date as "Mar 31" style
  const formatShortDate = (dateString: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    } catch {
      return dateString;
    }
  };

  // Expiration awareness helpers
  const getExpirationStatus = useMemo(() => {
    if (!form.endDate) return null;
    
    try {
      const expirationDate = new Date(form.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expirationDate.setHours(0, 0, 0, 0);
      
      const diffTime = expirationDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { type: "expired" as const, days: Math.abs(diffDays) };
      } else {
        return { type: "future" as const, days: diffDays };
      }
    } catch {
      return null;
    }
  }, [form.endDate]);

  // Offer Lifecycle State derivation
  type LifecycleState = "Draft" | "Active" | "Expired" | "Archived";
  
  const offerLifecycleState = useMemo((): LifecycleState => {
    // Archived takes precedence (UI-only toggle)
    if (isArchived) {
      return "Archived";
    }

    // Check if required fields are missing -> Draft
    const hasRequiredFields = 
      form.businessName?.trim() &&
      form.businessType?.trim() &&
      form.promoTitle?.trim() &&
      primaryCTA?.trim() &&
      form.promoDescription?.trim();

    if (!hasRequiredFields) {
      return "Draft";
    }

    // Check if expired -> Expired
    if (getExpirationStatus && getExpirationStatus.type === "expired") {
      return "Expired";
    }

    // Otherwise -> Active
    return "Active";
  }, [isArchived, form.businessName, form.businessType, form.promoTitle, primaryCTA, form.promoDescription, getExpirationStatus]);

  // Status pill styling helper
  const getStatusPillClasses = (state: LifecycleState): string => {
    const baseClasses = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium";
    switch (state) {
      case "Draft":
        return `${baseClasses} ${
          isDark 
            ? "bg-slate-700/50 text-slate-300 border border-slate-600" 
            : "bg-slate-100 text-slate-600 border border-slate-300"
        }`;
      case "Active":
        return `${baseClasses} ${
          isDark 
            ? "bg-green-900/30 text-green-300 border border-green-700/50" 
            : "bg-green-50 text-green-700 border border-green-200"
        }`;
      case "Expired":
        return `${baseClasses} ${
          isDark 
            ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" 
            : "bg-amber-50 text-amber-700 border border-amber-200"
        }`;
      case "Archived":
        return `${baseClasses} ${
          isDark 
            ? "bg-slate-800/50 text-slate-400 border border-slate-700" 
            : "bg-slate-50 text-slate-500 border border-slate-300"
        }`;
    }
  };

  // Summary functions for accordion sections - enhanced with live updates
  const getOfferBasicsSummary = (): string => {
    // Build a natural summary like "10% off for new customers"
    const parts: string[] = [];
    
    // Start with offer value if available (most prominent)
    if (form.offerValue?.trim()) {
      parts.push(form.offerValue.trim());
    }
    
    // Add target audience hint if available and relevant
    if (form.targetAudience?.trim() && !parts[0]?.toLowerCase().includes(form.targetAudience.toLowerCase())) {
      const audience = form.targetAudience.toLowerCase();
      if (audience.includes("new customer") || audience.includes("first-time")) {
        parts.push("for new customers");
      } else if (audience.trim()) {
        parts.push(`for ${form.targetAudience.trim()}`);
      }
    } else if (newCustomersOnly && !parts[0]?.toLowerCase().includes("new customer")) {
      parts.push("for new customers");
    }
    
    // Fallback to title if no value
    if (parts.length === 0 && form.promoTitle?.trim()) {
      parts.push(form.promoTitle.trim());
    }
    
    // Fallback to description snippet if nothing else
    if (parts.length === 0 && form.promoDescription?.trim()) {
      const desc = form.promoDescription.substring(0, 50).trim();
      if (desc) {
        parts.push(desc + (form.promoDescription.length > 50 ? "..." : ""));
      }
    }
    
    return parts.length > 0 ? parts.join(" ") : "Not set";
  };

  const getEligibilityRulesSummary = (): string => {
    const parts: string[] = [];
    
    if (newCustomersOnly) {
      parts.push("New customers only");
    }
    
    if (form.endDate) {
      const shortDate = formatShortDate(form.endDate);
      if (shortDate) {
        parts.push(`Expires ${shortDate}`);
      }
    }
    
    if (redemptionLimits) {
      // Show a shortened version of redemption limits
      const limitText = redemptionLimits.length > 30 
        ? redemptionLimits.substring(0, 30) + "..." 
        : redemptionLimits;
      parts.push(limitText);
    }
    
    return parts.length > 0 ? parts.join(" · ") : "No restrictions";
  };

  const getMessagingContextSummary = (): string => {
    const parts: string[] = [];
    
    if (primaryCTA?.trim()) {
      parts.push(primaryCTA.trim());
    }
    
    // Always show urgency level (capitalized)
    const urgencyLabel = urgencyLevel.charAt(0).toUpperCase() + urgencyLevel.slice(1);
    parts.push(`${urgencyLabel} urgency`);
    
    return parts.length > 0 ? parts.join(" · ") : "Not set";
  };

  const getPlatformsSummary = (): string => {
    const previewPlatforms: OutputPlatform[] = ["Facebook", "Instagram", "Google Business Profile", "Website Banner"];
    const selected = previewPlatforms.filter((p) => form.outputPlatforms.includes(p));
    
    if (selected.length === 0) {
      return "None selected";
    }
    
    // Shorten platform names for summary
    const shortNames: Record<OutputPlatform, string> = {
      "Facebook": "Facebook",
      "Instagram": "Instagram",
      "Google Business Profile": "GBP",
      "Website Banner": "Website",
      "X": "X",
      "Email": "Email",
      "SMS": "SMS",
      "Flyer": "Flyer",
    };
    
    return selected.map(p => shortNames[p] || p).join(", ");
  };

  // Get value input placeholder based on offer type
  const getValueInputPlaceholder = (): string => {
    switch (form.promoType) {
      case "Discount":
        return 'e.g., "20% off" or "$50 off"';
      case "Limited-Time Offer":
      case "Flash Sale":
        return 'e.g., "30% off" or "$25 off"';
      case "Bundle Deal":
        return 'e.g., "Buy 2 Get 1 Free" or "Bundle Save 15%"';
      case "New Customer Offer":
        return 'e.g., "First-time customers: 20% off"';
      default:
        return 'e.g., "20% off", "$50 off", or "Free add-on"';
    }
  };

  // Preview content generators (memoized for performance)
  const facebookPreview = useMemo(() => {
    const businessName = form.businessName || "Your Business";
    const offerValue = form.offerValue || "Special Offer";
    const description = form.promoDescription || "Check out our latest promotion!";
    const cta = primaryCTA || "Learn More";
    const expiration = form.endDate ? `Valid until ${formatShortDate(form.endDate)}` : null;
    
    return {
      businessName,
      headline: offerValue,
      description: description.length > 200 ? description.substring(0, 200) + "..." : description,
      cta,
      expiration,
    };
  }, [form.businessName, form.offerValue, form.promoDescription, form.endDate, primaryCTA]);

  const gbpPreview = useMemo(() => {
    const businessName = form.businessName || "Your Business";
    const offerValue = form.offerValue || "Special Offer";
    const description = form.promoDescription || "We're excited to share our latest promotion with you.";
    const cta = primaryCTA || "Contact Us";
    const expiration = form.endDate ? `Offer expires ${formatShortDate(form.endDate)}` : null;
    
    return {
      businessName,
      headline: offerValue,
      description: description.length > 500 ? description.substring(0, 500) + "..." : description,
      cta,
      expiration,
    };
  }, [form.businessName, form.offerValue, form.promoDescription, form.endDate, primaryCTA]);

  const websiteBannerPreview = useMemo(() => {
    const headline = form.offerValue || form.promoTitle || "Special Offer";
    const subheadline = form.promoDescription 
      ? (form.promoDescription.length > 80 ? form.promoDescription.substring(0, 80) + "..." : form.promoDescription)
      : "Don't miss out on this limited-time opportunity";
    const buttonText = primaryCTA || "Get Started";
    
    return {
      headline,
      subheadline,
      buttonText,
    };
  }, [form.offerValue, form.promoTitle, form.promoDescription, primaryCTA]);

  // CRM integration state
  const [crmContextLoaded, setCrmContextLoaded] = useState(false);
  const [crmReturnUrl, setCrmReturnUrl] = useState<string | null>(null);
  const crmPrefillApplied = useRef(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Brand Profile auto-apply toggle
  const [useBrandProfile, setUseBrandProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return hasBrandProfile();
    } catch {
      return false;
    }
  });

  // Auto-apply brand profile to form
  const { applied, brandFound } = useAutoApplyBrandProfile({
    enabled: useBrandProfile,
    form: form as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        setForm((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as OffersBuilderRequest);
      } else {
        setForm(formOrUpdater as unknown as OffersBuilderRequest);
      }
    },
    storageKey: "offers-builder-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "city") return "city";
      if (formKey === "state") return "state";
      if (formKey === "targetAudience") return "targetAudience";
      if (formKey === "brandVoice") return "brandVoice";
      if (formKey === "language") return "language";
      return undefined;
    },
  });

  // Show one-time toast when brand profile is applied
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (applied && !toastShownRef.current) {
      toastShownRef.current = true;
      showToast("Brand Profile applied to empty fields.");
    }
  }, [applied]);

  // Helper: Generate promoDescription seed based on CRM prefill
  const generatePromoDescriptionSeed = (
    offerGoal: string,
    contactName: string,
    offerType: string,
    offerHint?: string,
    lastNote?: string
  ): string => {
    let seed = `${offerGoal} offer for ${contactName}: ${offerType}`;
    if (offerHint) {
      seed += ` — ${offerHint}`;
    }
    if (lastNote) {
      const noteSnippet = lastNote.length > 100 ? lastNote.substring(0, 100) + "..." : lastNote;
      seed += ` (Context: ${noteSnippet})`;
    }
    return seed;
  };

  function updateFormValue<K extends keyof OffersBuilderRequest>(
    key: K,
    value: OffersBuilderRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handlePlatformToggle = (platform: OutputPlatform) => {
    const current = form.outputPlatforms;
    if (current.includes(platform)) {
      updateFormValue(
        "outputPlatforms",
        current.filter((p) => p !== platform)
      );
    } else {
      updateFormValue("outputPlatforms", [...current, platform]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, lockedFacts?: OffersBuilderRequest["lockedFacts"]) => {
    if (e) e.preventDefault();

    setError(null);
    setResult(null);

    // Validation
    if (!form.businessName.trim()) {
      setError("Please enter a business name to continue.");
      return;
    }

    if (!form.businessType.trim()) {
      setError("Please enter a business type to continue.");
      return;
    }

    if (!form.promoTitle?.trim()) {
      setError("Please enter an offer title to continue.");
      return;
    }

    if (!primaryCTA.trim()) {
      setError("Please enter a primary CTA to continue.");
      return;
    }

    if (!form.promoDescription.trim()) {
      setError("Please describe your promotion to generate your offers.");
      return;
    }

    if (form.outputPlatforms.length === 0) {
      setError("Please select at least one platform (Facebook, Instagram, etc.) to generate your offers.");
      return;
    }

    setLoading(true);

    try {
      // Convert services string to array (comma-separated input → string[])
      const servicesArray =
        servicesInput.trim() !== ""
          ? servicesInput
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];

      // Prepare payload with clamped variationsCount (1-5) and default hashtagStyle
      const apiPayload: OffersBuilderRequest = {
        ...form,
        services: servicesArray,
        variationsCount: Math.max(1, Math.min(5, form.variationsCount || 1)),
        hashtagStyle: form.hashtagStyle || "Local",
        lockedFacts, // Include locked facts if provided (for regeneration)
      };

      const res = await fetch("/api/offers-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: OffersBuilderResponse }
      let data: OffersBuilderResponse = jsonResponse.data || jsonResponse;
      
      // Offer Drift Detector: Check and fix any drift in generated content (if regeneration)
      if (lockedFacts) {
        const { fixed, driftDetected } = detectAndFixDrift(data, lockedFacts);
        data = fixed;
        
        if (driftDetected) {
          // Drift was detected and fixed - show toast
          showToast("We kept your offer details the same and updated only the wording.");
        } else {
          // No drift detected - show success toast
          showToast("Kept offer details unchanged; wording improved.");
        }
      }
      
      // Update version snapshots
      const snapshot = JSON.parse(JSON.stringify(data)); // Deep clone for immutable snapshot
      setLastGeneratedOutputs(snapshot);
      setCurrentOutputs(snapshot);
      setResult(data); // Keep result for display
      setLastPayload({ ...form });
      
      // Store additional state for regeneration
      setLastAdditionalState({
        newCustomersOnly,
        primaryCTA,
        urgencyLevel,
        redemptionLimits,
      });
      
      // Store locked facts if this was a regeneration (for future regenerations)
      if (lockedFacts) {
        setLastLockedFacts(lockedFacts);
      }
      
      // Clear editing state on new generation
      setEditingOutputId(null);
      setEditContent({});
    } catch (error) {
      console.error("OffersBuilder Submit Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Offer Drift Detector: Detects and fixes drift in generated content
  const detectAndFixDrift = (
    response: OffersBuilderResponse,
    lockedFacts: NonNullable<OffersBuilderRequest["lockedFacts"]>
  ): { fixed: OffersBuilderResponse; driftDetected: boolean } => {
    let driftDetected = false;
    const fixed = JSON.parse(JSON.stringify(response)); // Deep clone

    // Helper to extract numeric values from text (%, $)
    const extractNumericValue = (text: string): { value: number; type: "%" | "$" | null } | null => {
      // Match percentage: "10%", "20% off", etc.
      const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/i);
      if (percentMatch) {
        return { value: parseFloat(percentMatch[1]), type: "%" };
      }
      // Match dollar amount: "$50", "$25 off", etc.
      const dollarMatch = text.match(/\$(\d+(?:\.\d+)?)/i);
      if (dollarMatch) {
        return { value: parseFloat(dollarMatch[1]), type: "$" };
      }
      return null;
    };

    // Helper to check if locked value matches extracted value
    const checkNumericDrift = (lockedValue: string | undefined, text: string): boolean => {
      if (!lockedValue) return false;
      const lockedNumeric = extractNumericValue(lockedValue);
      const textNumeric = extractNumericValue(text);
      if (!lockedNumeric || !textNumeric) return false;
      if (lockedNumeric.type !== textNumeric.type) return true; // Different type (e.g., % vs $)
      return Math.abs(lockedNumeric.value - textNumeric.value) > 0.01; // Allow tiny floating point differences
    };

    // Helper to sanitize numeric drift from text
    const sanitizeNumericDrift = (text: string, lockedValue: string | undefined): string => {
      if (!lockedValue) return text;
      const lockedNumeric = extractNumericValue(lockedValue);
      if (!lockedNumeric) return text;

      // Replace percentage drift
      if (lockedNumeric.type === "%") {
        text = text.replace(/(\d+(?:\.\d+)?)\s*%/gi, `${lockedNumeric.value}%`);
      }
      // Replace dollar drift
      if (lockedNumeric.type === "$") {
        text = text.replace(/\$(\d+(?:\.\d+)?)/gi, `$${lockedNumeric.value}`);
      }
      return text;
    };

    // Helper to check for "new customers" restriction drift
    const checkNewCustomersDrift = (text: string, shouldBeRestricted: boolean | undefined): boolean => {
      if (shouldBeRestricted === undefined) return false;
      const lowerText = text.toLowerCase();
      const hasNewCustomerLanguage = /new\s+customer|first\s+time|first\s+visit|new\s+clients?/i.test(lowerText);
      return shouldBeRestricted !== hasNewCustomerLanguage;
    };

    // Helper to sanitize new customers restriction
    const sanitizeNewCustomers = (text: string, shouldBeRestricted: boolean | undefined): string => {
      if (shouldBeRestricted === undefined) return text;
      const lowerText = text.toLowerCase();
      const hasNewCustomerLanguage = /new\s+customer|first\s+time|first\s+visit|new\s+clients?/i.test(lowerText);
      
      if (shouldBeRestricted && !hasNewCustomerLanguage) {
        // Add new customer restriction (best effort - add at start if possible)
        // This is tricky, so we'll just note the drift
        return text;
      } else if (!shouldBeRestricted && hasNewCustomerLanguage) {
        // Remove new customer restriction language
        text = text.replace(/\b(new\s+customers?|first\s+time\s+customers?|first\s+visit|new\s+clients?)\b/gi, "");
        text = text.replace(/\s+/g, " ").trim();
      }
      return text;
    };

    // Helper to check expiration date drift
    const checkExpirationDrift = (text: string, lockedEndDate: string | undefined): boolean => {
      if (!lockedEndDate) return false;
      try {
        const lockedDate = new Date(lockedEndDate);
        const lockedDateStr = lockedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const lockedDateStrShort = lockedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        
        // Check if text contains a different date format
        // This is best-effort - we'll check for common date patterns
        const datePatterns = [
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i,
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b/i,
          /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
        ];
        
        // If locked date is mentioned, check if it matches
        const containsLockedDate = text.includes(lockedDateStr) || text.includes(lockedDateStrShort);
        if (containsLockedDate) return false; // Date matches
        
        // If any date pattern is found but doesn't match locked date, drift detected
        for (const pattern of datePatterns) {
          if (pattern.test(text)) {
            return true; // Date found but doesn't match
          }
        }
        return false;
      } catch {
        return false;
      }
    };

    // Helper to sanitize expiration date drift
    const sanitizeExpirationDrift = (text: string, lockedEndDate: string | undefined): string => {
      if (!lockedEndDate) return text;
      try {
        const lockedDate = new Date(lockedEndDate);
        const lockedDateStr = lockedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const lockedDateStrShort = lockedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        
        // Replace common date patterns with locked date
        text = text.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi, lockedDateStr);
        text = text.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, lockedDateStrShort);
        text = text.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, lockedDateStr);
        
        return text;
      } catch {
        return text;
      }
    };

    // Helper to check CTA drift
    const checkCTADrift = (text: string, lockedCTA: string | undefined): boolean => {
      if (!lockedCTA) return false;
      const lowerText = text.toLowerCase().trim();
      const lowerLocked = lockedCTA.toLowerCase().trim();
      // Check if locked CTA appears in text (allowing for some variation)
      return !lowerText.includes(lowerLocked) && lowerText !== lowerLocked;
    };

    // Helper to sanitize CTA drift
    const sanitizeCTADrift = (text: string, lockedCTA: string | undefined): string => {
      if (!lockedCTA) return text;
      // If text is just a CTA, replace it
      if (text.trim().length < 50) {
        return lockedCTA;
      }
      // Otherwise, try to find and replace CTA-like phrases at the end
      const ctaPattern = /(?:call|contact|visit|book|shop|buy|get|claim|learn more|sign up|register|start|begin)[\s\w]*$/i;
      if (ctaPattern.test(text)) {
        return text.replace(ctaPattern, lockedCTA);
      }
      return text;
    };

    // Check and fix general text fields (no CTA check)
    const checkAndFix = (text: string): string => {
      let fixedText = text;
      
      // Check numeric value drift
      if (checkNumericDrift(lockedFacts.offerValue, fixedText)) {
        driftDetected = true;
        fixedText = sanitizeNumericDrift(fixedText, lockedFacts.offerValue);
      }
      
      // Check new customers restriction
      if (checkNewCustomersDrift(fixedText, lockedFacts.newCustomersOnly)) {
        driftDetected = true;
        fixedText = sanitizeNewCustomers(fixedText, lockedFacts.newCustomersOnly);
      }
      
      // Check expiration date
      if (checkExpirationDrift(fixedText, lockedFacts.endDate)) {
        driftDetected = true;
        fixedText = sanitizeExpirationDrift(fixedText, lockedFacts.endDate);
      }
      
      return fixedText;
    };

    // Check and fix CTA fields (includes CTA check)
    const checkAndFixCTA = (text: string): string => {
      let fixedText = checkAndFix(text); // Apply general checks first
      
      // Check CTA drift (only for CTA fields)
      if (checkCTADrift(fixedText, lockedFacts.primaryCTA)) {
        driftDetected = true;
        fixedText = sanitizeCTADrift(fixedText, lockedFacts.primaryCTA);
      }
      
      return fixedText;
    };

    // Fix offerSummary fields
    fixed.offerSummary.headline = checkAndFix(fixed.offerSummary.headline);
    fixed.offerSummary.subheadline = checkAndFix(fixed.offerSummary.subheadline);
    fixed.offerSummary.shortPitch = checkAndFix(fixed.offerSummary.shortPitch);
    fixed.offerSummary.fullPitch = checkAndFix(fixed.offerSummary.fullPitch);

    // Fix headlineOptions
    fixed.headlineOptions.forEach((option: { label: string; headline: string }) => {
      option.headline = checkAndFix(option.headline);
    });

    // Fix bodyOptions
    fixed.bodyOptions.forEach((option: { label: string; body: string }) => {
      option.body = checkAndFix(option.body);
    });

    // Fix socialPosts
    fixed.socialPosts.forEach((post: PromoOutput) => {
      post.headline = checkAndFix(post.headline);
      post.mainCopy = checkAndFix(post.mainCopy);
      post.callToAction = checkAndFixCTA(post.callToAction); // CTA field
    });

    // Fix gbpPost
    fixed.gbpPost.headline = checkAndFix(fixed.gbpPost.headline);
    fixed.gbpPost.description = checkAndFix(fixed.gbpPost.description);
    fixed.gbpPost.suggestedCTA = checkAndFixCTA(fixed.gbpPost.suggestedCTA); // CTA field

    // Fix email
    fixed.email.subject = checkAndFix(fixed.email.subject);
    fixed.email.previewText = checkAndFix(fixed.email.previewText);
    fixed.email.body = checkAndFix(fixed.email.body);

    // Fix sms
    fixed.sms.message = checkAndFix(fixed.sms.message);

    // Fix websiteBanner
    fixed.websiteBanner.headline = checkAndFix(fixed.websiteBanner.headline);
    fixed.websiteBanner.subheadline = checkAndFix(fixed.websiteBanner.subheadline);
    fixed.websiteBanner.buttonText = checkAndFixCTA(fixed.websiteBanner.buttonText); // CTA field

    return { fixed, driftDetected };
  };

  const handleRegenerate = async () => {
    if (!lastPayload || !lastAdditionalState) return;
    
    // Check if there are any edits by comparing current vs last generated
    if (hasAnyEdits()) {
      setShowRegenerateConfirm(true);
      return;
    }
    
    await performRegenerate();
  };

  // Check if any outputs have been edited
  const hasAnyEdits = (): boolean => {
    if (!lastGeneratedOutputs || !currentOutputs) return false;
    
    // Check social posts
    if (currentOutputs.socialPosts && lastGeneratedOutputs.socialPosts) {
      for (let i = 0; i < currentOutputs.socialPosts.length; i++) {
        if (JSON.stringify(currentOutputs.socialPosts[i]) !== JSON.stringify(lastGeneratedOutputs.socialPosts[i])) {
          return true;
        }
      }
    }
    
    // Check GBP post
    if (currentOutputs.gbpPost && lastGeneratedOutputs.gbpPost) {
      if (JSON.stringify(currentOutputs.gbpPost) !== JSON.stringify(lastGeneratedOutputs.gbpPost)) {
        return true;
      }
    }
    
    // Check email
    if (currentOutputs.email && lastGeneratedOutputs.email) {
      if (JSON.stringify(currentOutputs.email) !== JSON.stringify(lastGeneratedOutputs.email)) {
        return true;
      }
    }
    
    // Check website banner
    if (currentOutputs.websiteBanner && lastGeneratedOutputs.websiteBanner) {
      if (JSON.stringify(currentOutputs.websiteBanner) !== JSON.stringify(lastGeneratedOutputs.websiteBanner)) {
        return true;
      }
    }
    
    // Check offer summary
    if (currentOutputs.offerSummary && lastGeneratedOutputs.offerSummary) {
      if (JSON.stringify(currentOutputs.offerSummary) !== JSON.stringify(lastGeneratedOutputs.offerSummary)) {
        return true;
      }
    }
    
    return false;
  };

  const performRegenerate = async () => {
    if (!lastPayload || !lastAdditionalState) return;
    
    // Build lockedFacts from last generation's state (not current form)
    const lockedFacts: NonNullable<OffersBuilderRequest["lockedFacts"]> = {
      promoTitle: lastPayload.promoTitle || undefined,
      promoType: lastPayload.promoType,
      offerValue: lastPayload.offerValue || undefined,
      newCustomersOnly: lastAdditionalState.newCustomersOnly || undefined,
      endDate: lastPayload.endDate || undefined,
      redemptionLimits: lastAdditionalState.redemptionLimits || undefined,
      primaryCTA: lastAdditionalState.primaryCTA || undefined,
      urgencyLevel: lastAdditionalState.urgencyLevel || undefined,
    };
    
    // Restore form from last payload
    setForm(lastPayload);
    
    // Restore additional state
    setNewCustomersOnly(lastAdditionalState.newCustomersOnly);
    setPrimaryCTA(lastAdditionalState.primaryCTA);
    setUrgencyLevel(lastAdditionalState.urgencyLevel);
    setRedemptionLimits(lastAdditionalState.redemptionLimits);
    
    // Clear editing state (regeneration resets edits)
    setEditingOutputId(null);
    setEditContent({});
    setShowRegenerateConfirm(false);
    
    // Submit with locked facts
    await handleSubmit(undefined, lockedFacts);
  };

  // Inline editing handlers
  const startEditing = (outputId: string, currentContent: any) => {
    setEditingOutputId(outputId);
    setEditContent({ ...currentContent });
  };

  const cancelEditing = () => {
    setEditingOutputId(null);
    setEditContent({});
  };

  const saveEditing = (outputId: string, updateCurrentOutputs: (content: any) => void) => {
    updateCurrentOutputs(editContent);
    setEditingOutputId(null);
    setEditContent({});
    showToast("Changes saved");
  };

  // Reset output to last generated version
  const resetToLastGenerated = (outputId: string, resetFn: () => void) => {
    resetFn();
    setEditingOutputId(null);
    setEditContent({});
    showToast("Reset to last generated");
  };

  // Check if a specific output section is edited
  const isOutputEdited = (section: string, index?: number): boolean => {
    if (!lastGeneratedOutputs || !currentOutputs) return false;
    
    try {
      switch (section) {
        case "social-post":
          if (index !== undefined && currentOutputs.socialPosts && lastGeneratedOutputs.socialPosts) {
            return JSON.stringify(currentOutputs.socialPosts[index]) !== JSON.stringify(lastGeneratedOutputs.socialPosts[index]);
          }
          break;
        case "gbp-post":
          return JSON.stringify(currentOutputs.gbpPost) !== JSON.stringify(lastGeneratedOutputs.gbpPost);
        case "email":
          return JSON.stringify(currentOutputs.email) !== JSON.stringify(lastGeneratedOutputs.email);
        case "website-banner":
          return JSON.stringify(currentOutputs.websiteBanner) !== JSON.stringify(lastGeneratedOutputs.websiteBanner);
        case "offer-summary":
          return JSON.stringify(currentOutputs.offerSummary) !== JSON.stringify(lastGeneratedOutputs.offerSummary);
      }
    } catch {
      return false;
    }
    
    return false;
  };

  // Get authoritative output (currentOutputs with edits, or fallback to result)
  // This ensures exports and copies always use the edited version
  const getAuthoritativeOutput = (): OffersBuilderResponse | null => {
    return currentOutputs || result;
  };

  // Calculate suggested posting window based on expiration date
  const getSuggestedPostingWindow = (): string | null => {
    if (!form.endDate) return null;
    
    try {
      const expirationDate = new Date(form.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expirationDate.setHours(0, 0, 0, 0);
      
      const diffTime = expirationDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        // Already expired - no suggestion
        return null;
      } else if (diffDays >= 1 && diffDays <= 3) {
        return "Post today";
      } else if (diffDays >= 4 && diffDays <= 10) {
        return "Post within the next 2–3 days";
      } else if (diffDays > 10) {
        return "Post this week";
      }
      
      return null;
    } catch {
      return null;
    }
  };

  // Detect if offer is event-like (for contextual Event Campaign Builder suggestion)
  const isEventLikeOffer = useMemo((): boolean => {
    // Check for date range (startDate and endDate both present)
    const hasDateRange = !!(form.startDate && form.endDate);
    
    // Check for event-like language in description
    const eventKeywords = [
      "this saturday", "this sunday", "this weekend", "this week",
      "open house", "grand opening", "holiday", "event", "celebration",
      "festival", "sale event", "special event", "launch", "anniversary",
      "party", "gathering", "meetup", "workshop", "seminar", "exhibition"
    ];
    
    const descriptionText = (
      form.promoDescription?.toLowerCase() || 
      getAuthoritativeOutput()?.offerSummary?.fullPitch?.toLowerCase() || 
      ""
    );
    
    const hasEventLanguage = eventKeywords.some(keyword => 
      descriptionText.includes(keyword)
    );
    
    return hasDateRange || hasEventLanguage;
  }, [form.startDate, form.endDate, form.promoDescription, result, currentOutputs]);

  // Dismissible state for event suggestion
  const DISMISS_KEY = "tier5c-offers-event-suggestion";
  const [isEventSuggestionDismissed, setIsEventSuggestionDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  const dismissEventSuggestion = () => {
    setIsEventSuggestionDismissed(true);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(DISMISS_KEY, "true");
      } catch {
        // Ignore sessionStorage errors
      }
    }
  };

  // Show event suggestion if offer is event-like and not dismissed
  const shouldShowEventSuggestion = isEventLikeOffer && !isEventSuggestionDismissed && result;

  // Dismissible state for AI Help Desk awareness callout
  const HELP_DESK_DISMISS_KEY = "tier5c-offers-helpdesk-awareness";
  const [isHelpDeskAwarenessDismissed, setIsHelpDeskAwarenessDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(HELP_DESK_DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  const dismissHelpDeskAwareness = () => {
    setIsHelpDeskAwarenessDismissed(true);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(HELP_DESK_DISMISS_KEY, "true");
      } catch {
        // Ignore sessionStorage errors
      }
    }
  };

  // Show AI Help Desk awareness callout if not dismissed and results exist
  const shouldShowHelpDeskAwareness = !isHelpDeskAwarenessDismissed && result;

  const handleStartNew = () => {
    setForm(defaultFormValues);
    setServicesInput("");
    setResult(null);
    setError(null);
    setWizardStep(1);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWizardNext = () => {
    // Validation before proceeding
    if (wizardStep === 1) {
      // Step 1: Business Basics
      if (!form.businessName.trim()) {
        setError("Business name is required.");
        return;
      }
      if (!form.businessType.trim()) {
        setError("Business type is required.");
        return;
      }
      setError(null);
    } else if (wizardStep === 2) {
      // Step 2: Offer Basics
      if (!form.promoDescription.trim()) {
        setError("Promotion description is required.");
        return;
      }
      setError(null);
    } else if (wizardStep === 5) {
      // Step 5: Platforms & Options
      if (form.outputPlatforms.length === 0) {
        setError("At least one output platform must be selected.");
        return;
      }
      setError(null);
    }

    if (wizardStep < totalWizardSteps) {
      setWizardStep(wizardStep + 1);
      // Scroll to top of form when moving to next step
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  // Render wizard step content
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        // Business Basics - collect business info first
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 1: Business Basics
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-businessName"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Business Name *
              </label>
              <input
                type="text"
                id="wizard-businessName"
                value={form.businessName}
                onChange={(e) =>
                  updateFormValue("businessName", e.target.value)
                }
                className={getInputClasses(isDark)}
                placeholder="e.g., Ocala Coffee Shop"
                required
              />
            </div>

            <div>
              <label
                htmlFor="wizard-businessType"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Business Type *
              </label>
              <input
                type="text"
                id="wizard-businessType"
                value={form.businessType}
                onChange={(e) =>
                  updateFormValue("businessType", e.target.value)
                }
                className={getInputClasses(isDark)}
                placeholder="e.g., Restaurant, Retail, Service"
                required
              />
            </div>

            <div>
              <label
                htmlFor="wizard-services"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Services (Optional)
              </label>
              <textarea
                id="wizard-services"
                value={servicesInput}
                onChange={(e) => setServicesInput(e.target.value)}
                rows={3}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Comma-separated: e.g., Pressure washing, Driveway cleaning"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="wizard-city"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  City
                </label>
                <input
                  type="text"
                  id="wizard-city"
                  value={form.city}
                  onChange={(e) => updateFormValue("city", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Ocala"
                />
              </div>

              <div>
                <label
                  htmlFor="wizard-state"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  State
                </label>
                <input
                  type="text"
                  id="wizard-state"
                  value={form.state}
                  onChange={(e) => updateFormValue("state", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Florida"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 2: Offer Basics
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-promoType"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Promotion Type
              </label>
              <select
                id="wizard-promoType"
                value={form.promoType}
                onChange={(e) =>
                  updateFormValue("promoType", e.target.value as PromoType)
                }
                className={getInputClasses(isDark)}
              >
                {PROMO_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="wizard-promoDescription"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Promotion Description *
              </label>
              <textarea
                id="wizard-promoDescription"
                value={form.promoDescription}
                onChange={(e) =>
                  updateFormValue("promoDescription", e.target.value)
                }
                rows={4}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Describe the offer, who it's for, and what makes it special."
                required
              />
            </div>

            <div>
              <label
                htmlFor="wizard-offerValue"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Offer Value (Optional)
              </label>
              <input
                type="text"
                id="wizard-offerValue"
                value={form.offerValue}
                onChange={(e) => updateFormValue("offerValue", e.target.value)}
                className={getInputClasses(isDark)}
                placeholder='e.g., "20% off dinner", "$50 off service"'
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="wizard-startDate"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  id="wizard-startDate"
                  value={form.startDate}
                  onChange={(e) => updateFormValue("startDate", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label
                  htmlFor="wizard-endDate"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  id="wizard-endDate"
                  value={form.endDate}
                  onChange={(e) => updateFormValue("endDate", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="wizard-goal"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Goal (Optional)
              </label>
              <input
                type="text"
                id="wizard-goal"
                value={form.goal}
                onChange={(e) => updateFormValue("goal", e.target.value)}
                className={getInputClasses(isDark)}
                placeholder="e.g., drive bookings, increase walk-ins"
              />
            </div>

            <div>
              <label
                htmlFor="wizard-targetAudience"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Target Audience (Optional)
              </label>
              <input
                type="text"
                id="wizard-targetAudience"
                value={form.targetAudience}
                onChange={(e) =>
                  updateFormValue("targetAudience", e.target.value)
                }
                className={getInputClasses(isDark)}
                placeholder="e.g., families, horse owners, Ocala locals"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 3: Headline Direction
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-length"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Content Length
              </label>
              <select
                id="wizard-length"
                value={form.length}
                onChange={(e) =>
                  updateFormValue(
                    "length",
                    e.target.value as "Short" | "Medium" | "Long"
                  )
                }
                className={getInputClasses(isDark)}
              >
                <option value="Short">Short</option>
                <option value="Medium">Medium</option>
                <option value="Long">Long</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="wizard-personalityStyle"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Personality Style
              </label>
              <select
                id="wizard-personalityStyle"
                value={form.personalityStyle}
                onChange={(e) =>
                  updateFormValue(
                    "personalityStyle",
                    e.target.value as PersonalityStyle
                  )
                }
                className={getInputClasses(isDark)}
              >
                <option value="None">None</option>
                <option value="Soft">Soft</option>
                <option value="Bold">Bold</option>
                <option value="High-Energy">High-Energy</option>
                <option value="Luxury">Luxury</option>
              </select>
              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                Sets the tone and style of your promotional content.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 4: Body & Story
            </OBDHeading>
            <div>
              <label
                htmlFor="wizard-brandVoice"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Brand Voice (Optional)
              </label>
              <textarea
                id="wizard-brandVoice"
                value={form.brandVoice}
                onChange={(e) => updateFormValue("brandVoice", e.target.value)}
                rows={4}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Paste 2–4 sentences that sound like your existing brand voice. This will override the personality style."
              />
            </div>

            <div>
              <label
                htmlFor="wizard-language"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Language
              </label>
              <select
                id="wizard-language"
                value={form.language}
                onChange={(e) =>
                  updateFormValue("language", e.target.value as LanguageOption)
                }
                className={getInputClasses(isDark)}
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="Bilingual">Bilingual</option>
              </select>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 5: Platforms & Options
            </OBDHeading>
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Output Platforms *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PLATFORM_OPTIONS.map((platform) => (
                  <label
                    key={platform}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      form.outputPlatforms.includes(platform)
                        ? isDark
                          ? "border-[#29c4a9] bg-[#29c4a9]/10"
                          : "border-[#29c4a9] bg-[#29c4a9]/5"
                        : isDark
                        ? "border-slate-700 hover:bg-slate-800"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.outputPlatforms.includes(platform)}
                      onChange={() => handlePlatformToggle(platform)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className={`text-xs ${themeClasses.labelText}`}>
                      {PLATFORM_ICONS[platform]} {platform}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-2 ${themeClasses.labelText}`}
              >
                <input
                  type="checkbox"
                  checked={form.includeHashtags}
                  onChange={(e) =>
                    updateFormValue("includeHashtags", e.target.checked)
                  }
                  className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                />
                <span className="text-sm">Include hashtags</span>
              </label>

              {form.includeHashtags && (
                <div className="ml-6">
                  <label
                    htmlFor="wizard-hashtagStyle"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Hashtag Style
                  </label>
                  <select
                    id="wizard-hashtagStyle"
                    value={form.hashtagStyle || "Local"}
                    onChange={(e) =>
                      updateFormValue("hashtagStyle", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                  >
                    <option value="Local">Local</option>
                    <option value="Branded">Branded</option>
                    <option value="Minimal">Minimal</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="wizard-variationsCount"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  Number of Variations (1–5)
                </label>
                <input
                  type="number"
                  id="wizard-variationsCount"
                  min={1}
                  max={5}
                  value={form.variationsCount}
                  onChange={(e) =>
                    updateFormValue(
                      "variationsCount",
                      Math.max(
                        1,
                        Math.min(5, parseInt(e.target.value) || 1)
                      )
                    )
                  }
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label
                  htmlFor="wizard-variationMode"
                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                >
                  Variation Mode
                </label>
                <select
                  id="wizard-variationMode"
                  value={form.variationMode}
                  onChange={(e) =>
                    updateFormValue(
                      "variationMode",
                      e.target.value as
                        | "Conservative"
                        | "Moderate"
                        | "Creative"
                    )
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Creative">Creative</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark} className="mb-4">
              Step 6: Review & Generate
            </OBDHeading>
            <div
              className={`rounded-lg border p-4 ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="space-y-2 text-sm">
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Business:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.businessName || "Not set"}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Business Type:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.businessType || "Not set"}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Promotion Type:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.promoType}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Platforms:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.outputPlatforms.join(", ") || "None selected"}
                  </span>
                </div>
                {form.offerValue && (
                  <div>
                    <span
                      className={`font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Offer Value:
                    </span>{" "}
                    <span className={themeClasses.mutedText}>
                      {form.offerValue}
                    </span>
                  </div>
                )}
                {form.promoDescription && (
                  <div>
                    <span
                      className={`font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Description:
                    </span>{" "}
                    <span className={themeClasses.mutedText}>
                      {form.promoDescription.substring(0, 100)}
                      {form.promoDescription.length > 100 ? "..." : ""}
                    </span>
                  </div>
                )}
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Content Length:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>{form.length}</span>
                </div>
                <div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Personality Style:
                  </span>{" "}
                  <span className={themeClasses.mutedText}>
                    {form.personalityStyle}
                  </span>
                </div>
              </div>
            </div>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              Review your selections above. Click "Generate Promotional Offers"
              to create your multi-platform promotional content.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="Offers & Promotions Builder"
      tagline="Create high-converting promotional offers with headlines, body copy, social posts, and Google Business Profile updates—all in one step."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      <CrmIntegrationIndicator
        isDark={isDark}
        showContextPill={crmContextLoaded}
        showBackLink={!!crmReturnUrl}
        returnUrl={crmReturnUrl}
        onDismissContext={() => setCrmContextLoaded(false)}
      />

      {/* Offer Lifecycle Status Pill */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className={`text-sm ${themeClasses.labelText}`}>Status:</span>
            <span className={getStatusPillClasses(offerLifecycleState)}>
              {offerLifecycleState}
            </span>
            {offerLifecycleState === "Draft" && (
              <span className={`text-xs ${themeClasses.mutedText}`}>
                Complete required fields to activate
              </span>
            )}
            {offerLifecycleState === "Expired" && (
              <span className={`text-xs ${themeClasses.mutedText}`}>
                Update expiration date or regenerate to reuse
              </span>
            )}
            {offerLifecycleState === "Archived" && (
              <span className={`text-xs ${themeClasses.mutedText}`}>
                This offer is archived
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleArchived}
            className={getSubtleButtonMediumClasses(isDark)}
          >
            {isArchived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </OBDPanel>

      {/* Wizard Mode Toggle */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={`text-sm font-medium mb-1 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Form Mode
            </h3>
            <p className={`text-xs ${themeClasses.mutedText}`}>
              {form.wizardMode
                ? "Step through Offer → Headlines → Copy → Social Posts → GBP Post → Graphic Prompt."
                : "Use the wizard for step-by-step guidance, or use the standard form for full control."}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-sm ${themeClasses.labelText}`}>Standard</span>
            <input
              type="checkbox"
              checked={form.wizardMode}
              onChange={(e) => {
                updateFormValue("wizardMode", e.target.checked);
                if (!e.target.checked) setWizardStep(1);
              }}
              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
            />
            <span className={`text-sm ${themeClasses.labelText}`}>Wizard</span>
          </label>
        </div>
      </OBDPanel>

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        {form.wizardMode ? (
          <div>
            {/* Wizard Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                  Step {wizardStep} of {totalWizardSteps}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-[#29c4a9] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(wizardStep / totalWizardSteps) * 100}%` }}
                />
              </div>
            </div>

            {renderWizardStep()}

            {/* Wizard Navigation */}
            <div className={`flex justify-between mt-6 pt-6 ${getDividerClass(isDark)}`}>
              <button
                type="button"
                onClick={handleWizardBack}
                disabled={wizardStep === 1}
                className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleWizardNext}
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                  {wizardStep === totalWizardSteps
                    ? loading
                      ? "Generating..."
                      : "Generate Promotional Offers"
                    : "Next"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Business Basics */}
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Business Basics
                </OBDHeading>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="businessName"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Business Name *
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      value={form.businessName}
                      onChange={(e) =>
                        updateFormValue("businessName", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="e.g., Ocala Coffee Shop"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="businessType"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Business Type *
                    </label>
                    <input
                      type="text"
                      id="businessType"
                      value={form.businessType}
                      onChange={(e) =>
                        updateFormValue("businessType", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="e.g., Restaurant, Retail, Service"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="services"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Services (Optional)
                    </label>
                    <textarea
                      id="services"
                      value={servicesInput}
                      onChange={(e) => setServicesInput(e.target.value)}
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Comma-separated: e.g., Pressure washing, Driveway cleaning, Deck staining"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="city"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        City
                      </label>
                      <input
                        type="text"
                        id="city"
                        value={form.city}
                        onChange={(e) => updateFormValue("city", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Ocala"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="state"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        State
                      </label>
                      <input
                        type="text"
                        id="state"
                        value={form.state}
                        onChange={(e) =>
                          updateFormValue("state", e.target.value)
                        }
                        className={getInputClasses(isDark)}
                        placeholder="Florida"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)} />

              {/* Promotion Details - Accordion Layout */}
              <div className="space-y-4">
                {/* Offer Basics Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("offerBasics")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Offer Basics
                      </h3>
                      {!accordionState.offerBasics && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getOfferBasicsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("offerBasics");
                      }}
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      {accordionState.offerBasics ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.offerBasics && (
                    <div className="p-4 space-y-4">
                      <div>
                        <label
                          htmlFor="promoTitle"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Offer Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="promoTitle"
                          value={form.promoTitle || ""}
                          onChange={(e) =>
                            updateFormValue("promoTitle", e.target.value)
                          }
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Spring Sale, New Customer Special"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="promoType"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Offer Type
                        </label>
                        <select
                          id="promoType"
                          value={form.promoType}
                          onChange={(e) =>
                            updateFormValue("promoType", e.target.value as PromoType)
                          }
                          className={getInputClasses(isDark)}
                        >
                          <option value="Discount">Discount</option>
                          <option value="Limited-Time Offer">Limited-Time</option>
                          <option value="Bundle Deal">Bundle</option>
                          <option value="Seasonal Promotion">Seasonal</option>
                          <option value="New Customer Offer">New Customer</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="offerValue"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Value Input
                        </label>
                        <input
                          type="text"
                          id="offerValue"
                          value={form.offerValue || ""}
                          onChange={(e) =>
                            updateFormValue("offerValue", e.target.value)
                          }
                          className={getInputClasses(isDark)}
                          placeholder={getValueInputPlaceholder()}
                        />
                        <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                          Enter percentage (%), dollar amount ($), or free add-on description
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="promoDescription"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Promotion Description
                        </label>
                        <textarea
                          id="promoDescription"
                          value={form.promoDescription}
                          onChange={(e) =>
                            updateFormValue("promoDescription", e.target.value)
                          }
                          rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                          placeholder="Describe the offer, who it's for, and what makes it special."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Eligibility & Rules Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("eligibilityRules")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          Eligibility & Rules
                        </h3>
                        {!accordionState.eligibilityRules && getExpirationStatus && getExpirationStatus.type === "future" && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isDark 
                              ? "bg-blue-900/30 text-blue-300 border border-blue-700/50" 
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            Expires in {getExpirationStatus.days} {getExpirationStatus.days === 1 ? "day" : "days"}
                          </span>
                        )}
                        {!accordionState.eligibilityRules && getExpirationStatus && getExpirationStatus.type === "expired" && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isDark 
                              ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            Expired
                          </span>
                        )}
                      </div>
                      {!accordionState.eligibilityRules && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getEligibilityRulesSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("eligibilityRules");
                      }}
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      {accordionState.eligibilityRules ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.eligibilityRules && (
                    <div className="p-4 space-y-4">
                      {/* Expired Offer Soft Guidance */}
                      {offerLifecycleState === "Expired" && (
                        <div className={`rounded-lg border p-3 ${
                          isDark
                            ? "bg-amber-950/20 border-amber-800/50"
                            : "bg-amber-50 border-amber-200"
                        }`}>
                          <p className={`text-sm ${
                            isDark ? "text-amber-200" : "text-amber-800"
                          }`}>
                            This offer is expired — update the expiration date or regenerate wording to reuse.
                          </p>
                        </div>
                      )}

                      <div>
                        <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                          <input
                            type="checkbox"
                            checked={newCustomersOnly}
                            onChange={(e) => setNewCustomersOnly(e.target.checked)}
                            className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className="text-sm">New customers only</span>
                        </label>
                      </div>

                      <div>
                        <label
                          htmlFor="endDate"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Expiration Date (Optional)
                        </label>
                        <input
                          type="date"
                          id="endDate"
                          value={form.endDate || ""}
                          onChange={(e) =>
                            updateFormValue("endDate", e.target.value)
                          }
                          className={getInputClasses(isDark)}
                        />
                        {getExpirationStatus && (
                          <div className="mt-2">
                            {getExpirationStatus.type === "future" ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                isDark 
                                  ? "bg-blue-900/30 text-blue-300 border border-blue-700/50" 
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}>
                                Expires in {getExpirationStatus.days} {getExpirationStatus.days === 1 ? "day" : "days"}
                              </span>
                            ) : (
                              <div className={`rounded-lg border p-3 ${
                                isDark
                                  ? "bg-amber-950/20 border-amber-800/50"
                                  : "bg-amber-50 border-amber-200"
                              }`}>
                                <p className={`text-sm ${
                                  isDark ? "text-amber-200" : "text-amber-800"
                                }`}>
                                  This offer is expired — update the expiration date or regenerate wording to reuse.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="redemptionLimits"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Redemption Limits (Optional)
                        </label>
                        <input
                          type="text"
                          id="redemptionLimits"
                          value={redemptionLimits}
                          onChange={(e) => setRedemptionLimits(e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Limited to first 50 customers, One per customer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Messaging Context Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("messagingContext")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Messaging Context
                      </h3>
                      {!accordionState.messagingContext && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getMessagingContextSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("messagingContext");
                      }}
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      {accordionState.messagingContext ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.messagingContext && (
                    <div className="p-4 space-y-4">
                      <div>
                        <label
                          htmlFor="primaryCTA"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Primary CTA <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="primaryCTA"
                          value={primaryCTA}
                          onChange={(e) => setPrimaryCTA(e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Shop Now, Book Today, Claim Offer"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="urgencyLevel"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Urgency Level
                        </label>
                        <select
                          id="urgencyLevel"
                          value={urgencyLevel}
                          onChange={(e) =>
                            setUrgencyLevel(e.target.value as "low" | "medium" | "high")
                          }
                          className={getInputClasses(isDark)}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Platforms (Preview Only) Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("platforms")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Platforms (Preview Only)
                      </h3>
                      {!accordionState.platforms && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getPlatformsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("platforms");
                      }}
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      {accordionState.platforms ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.platforms && (
                    <div className="p-4 space-y-4">
                      <p className={`text-xs ${themeClasses.mutedText} mb-3`}>
                        Select platforms for preview context only. No publishing logic.
                      </p>
                      <div className="space-y-2">
                        {(["Facebook", "Instagram", "Google Business Profile", "Website Banner"] as OutputPlatform[]).map((platform) => (
                          <label
                            key={platform}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              form.outputPlatforms.includes(platform)
                                ? isDark
                                  ? "border-[#29c4a9] bg-[#29c4a9]/10"
                                  : "border-[#29c4a9] bg-[#29c4a9]/5"
                                : isDark
                                ? "border-slate-700 hover:bg-slate-800"
                                : "border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.outputPlatforms.includes(platform)}
                              onChange={() => handlePlatformToggle(platform)}
                              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                            />
                            <span className={`text-sm ${themeClasses.labelText}`}>
                              {PLATFORM_ICONS[platform]} {platform}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={getDividerClass(isDark)} />

              {/* Platforms & Style */}
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Platforms & Style
                </OBDHeading>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Output Platforms *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {PLATFORM_OPTIONS.map((platform) => (
                        <label
                          key={platform}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            form.outputPlatforms.includes(platform)
                              ? isDark
                                ? "border-[#29c4a9] bg-[#29c4a9]/10"
                                : "border-[#29c4a9] bg-[#29c4a9]/5"
                              : isDark
                              ? "border-slate-700 hover:bg-slate-800"
                              : "border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.outputPlatforms.includes(platform)}
                            onChange={() => handlePlatformToggle(platform)}
                            className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className={`text-xs ${themeClasses.labelText}`}>
                            {PLATFORM_ICONS[platform]} {platform}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="brandVoice"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Brand Voice (Optional)
                    </label>
                    <textarea
                      id="brandVoice"
                      value={form.brandVoice}
                      onChange={(e) =>
                        updateFormValue("brandVoice", e.target.value)
                      }
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="personalityStyle"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Personality Style
                    </label>
                    <select
                      id="personalityStyle"
                      value={form.personalityStyle}
                      onChange={(e) =>
                        updateFormValue(
                          "personalityStyle",
                          e.target.value as PersonalityStyle
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="None">None</option>
                      <option value="Soft">Soft</option>
                      <option value="Bold">Bold</option>
                      <option value="High-Energy">High-Energy</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="length"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Content Length
                    </label>
                    <select
                      id="length"
                      value={form.length}
                      onChange={(e) =>
                        updateFormValue(
                          "length",
                          e.target.value as "Short" | "Medium" | "Long"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                      <option value="Long">Long</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="language"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Language
                    </label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(e) =>
                        updateFormValue("language", e.target.value as LanguageOption)
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Bilingual">Bilingual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)} />

              {/* Hashtags & Variations */}
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Hashtags & Variations
                </OBDHeading>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      className={`flex items-center gap-2 ${themeClasses.labelText}`}
                    >
                      <input
                        type="checkbox"
                        checked={form.includeHashtags}
                        onChange={(e) =>
                          updateFormValue("includeHashtags", e.target.checked)
                        }
                        className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      />
                      <span className="text-sm">Include hashtags</span>
                    </label>

                    {form.includeHashtags && (
                      <div className="ml-6">
                        <label
                          htmlFor="hashtagStyle"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Hashtag Style
                        </label>
                        <select
                          id="hashtagStyle"
                          value={form.hashtagStyle || "Local"}
                          onChange={(e) =>
                            updateFormValue("hashtagStyle", e.target.value)
                          }
                          className={getInputClasses(isDark)}
                        >
                          <option value="Local">Local</option>
                          <option value="Branded">Branded</option>
                          <option value="Minimal">Minimal</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="variationsCount"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Number of Variations (1–5)
                    </label>
                    <input
                      type="number"
                      id="variationsCount"
                      min={1}
                      max={5}
                      value={form.variationsCount}
                      onChange={(e) =>
                        updateFormValue(
                          "variationsCount",
                          Math.max(
                            1,
                            Math.min(5, parseInt(e.target.value) || 1)
                          )
                        )
                      }
                      className={getInputClasses(isDark)}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="variationMode"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Variation Mode
                    </label>
                    <select
                      id="variationMode"
                      value={form.variationMode}
                      onChange={(e) =>
                        updateFormValue(
                          "variationMode",
                          e.target.value as
                            | "Conservative"
                            | "Moderate"
                            | "Creative"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="Conservative">Conservative</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Creative">Creative</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Preview Cards */}
              <div className={getDividerClass(isDark)} />
              
              <div>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Live Previews
                </OBDHeading>
                <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                  Preview how your offer will appear across different platforms. These are display-only and update as you fill out the form.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Facebook Post Preview */}
                  <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                          <span className="text-lg">📘</span>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {facebookPreview.businessName}
                          </p>
                          <p className={`text-xs ${themeClasses.mutedText}`}>Facebook</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        Preview Only
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <p className={`font-semibold text-base mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                          {facebookPreview.headline}
                        </p>
                        <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                          {facebookPreview.description}
                        </p>
                      </div>
                      {facebookPreview.expiration && (
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {facebookPreview.expiration}
                        </p>
                      )}
                      <div className="pt-2">
                        <button
                          type="button"
                          disabled
                          className={`w-full py-2 px-4 rounded-lg text-sm font-medium ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"} cursor-not-allowed`}
                        >
                          {facebookPreview.cta}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Google Business Profile Post Preview */}
                  <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                          <span className="text-lg">📍</span>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {gbpPreview.businessName}
                          </p>
                          <p className={`text-xs ${themeClasses.mutedText}`}>Google Business Profile</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        Preview Only
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <p className={`font-semibold text-base mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                          {gbpPreview.headline}
                        </p>
                        <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                          {gbpPreview.description}
                        </p>
                      </div>
                      {gbpPreview.expiration && (
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {gbpPreview.expiration}
                        </p>
                      )}
                      <div className="pt-2">
                        <button
                          type="button"
                          disabled
                          className={`w-full py-2 px-4 rounded-lg text-sm font-medium ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"} cursor-not-allowed`}
                        >
                          {gbpPreview.cta}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Website Banner Preview */}
                  <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                          <span className="text-lg">🖼️</span>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            Website Banner
                          </p>
                          <p className={`text-xs ${themeClasses.mutedText}`}>Banner Copy</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        Preview Only
                      </span>
                    </div>
                    <div className={`p-6 text-center ${isDark ? "bg-slate-900/30" : "bg-gradient-to-br from-slate-50 to-slate-100"}`}>
                      <h3 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {websiteBannerPreview.headline}
                      </h3>
                      <p className={`text-sm mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {websiteBannerPreview.subheadline}
                      </p>
                      <button
                        type="button"
                        disabled
                        className={`px-6 py-2 rounded-lg font-medium text-sm ${isDark ? "bg-[#29c4a9] text-white opacity-50" : "bg-[#29c4a9] text-white opacity-50"} cursor-not-allowed`}
                      >
                        {websiteBannerPreview.buttonText}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating Offers..." : "Generate Promotional Offers"}
                </button>
                <p className={`text-xs text-center mt-2 ${themeClasses.mutedText}`}>
                  Offers are never published automatically. You're always in control.
                </p>
              </div>
            </div>
          </form>
        )}
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Results */}
      {result && (
        <OBDPanel isDark={isDark} className="mt-8 pb-24">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Generated Promotional Content
            </OBDHeading>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className={themeClasses.mutedText}>
                Generating promotional content...
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {/* Offer Summary */}
              {/* Offer Summary Section */}
              <div>
                <h3
                  className={`text-base font-semibold mb-3 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Offer Summary
                </h3>
                <ResultCard
                  title=""
                  isDark={isDark}
                  copyText={(() => {
                    const auth = getAuthoritativeOutput();
                    if (!auth?.offerSummary) return undefined;
                    return `${auth.offerSummary.headline}\n\n${auth.offerSummary.subheadline}\n\n${auth.offerSummary.fullPitch}`;
                  })()}
                >
                  <div className="space-y-4">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Headline
                      </p>
                      {(() => {
                        const auth = getAuthoritativeOutput();
                        const summary = auth?.offerSummary || result.offerSummary;
                        return (
                          <>
                            <p
                              className={`font-semibold text-lg ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {summary.headline}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Subheadline
                      </p>
                      {(() => {
                        const auth = getAuthoritativeOutput();
                        const summary = auth?.offerSummary || result.offerSummary;
                        return (
                          <p
                            className={`text-sm italic ${
                              isDark ? "text-slate-300" : "text-slate-600"
                            }`}
                          >
                            {summary.subheadline}
                          </p>
                        );
                      })()}
                    </div>
                    <div
                      className={`p-3 rounded-lg border ${
                        isDark
                          ? "bg-slate-900/50 border-slate-700"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Short Pitch
                      </p>
                      {(() => {
                        const auth = getAuthoritativeOutput();
                        const summary = auth?.offerSummary || result.offerSummary;
                        return <p>{summary.shortPitch}</p>;
                      })()}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Full Pitch
                      </p>
                      {(() => {
                        const auth = getAuthoritativeOutput();
                        const summary = auth?.offerSummary || result.offerSummary;
                        return (
                          <p className="whitespace-pre-wrap">
                            {summary.fullPitch}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </ResultCard>
              </div>

              {/* Copy Options Section */}
              {(result.headlineOptions.length > 0 ||
                result.bodyOptions.length > 0) && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-3 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Copy Options
                  </h3>

                  {/* Headline Options */}
                  {result.headlineOptions.length > 0 && (
                    <ResultCard title="Headline Options" isDark={isDark}>
                      <div className="space-y-4">
                        {result.headlineOptions.map((option, idx) => (
                          <div key={idx}>
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {option.label}
                            </p>
                            <p>{option.headline}</p>
                          </div>
                        ))}
                      </div>
                    </ResultCard>
                  )}

                  {/* Body Options */}
                  {result.bodyOptions.length > 0 && (
                    <div className="mt-4">
                      <ResultCard
                        title="Body Copy Options"
                        isDark={isDark}
                      >
                      <div className="space-y-4">
                        {result.bodyOptions.map((option, idx) => (
                          <div key={idx}>
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {option.label}
                            </p>
                            <p className="whitespace-pre-wrap">{option.body}</p>
                          </div>
                        ))}
                      </div>
                    </ResultCard>
                    </div>
                  )}
                </div>
              )}

              {/* Social Posts Section */}
              {result.socialPosts.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Social Media Posts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(currentOutputs?.socialPosts || result.socialPosts).map((post, idx) => {
                      const outputId = `social-post-${idx}`;
                      const isEditing = editingOutputId === outputId;
                      const displayPost = currentOutputs?.socialPosts?.[idx] || post;
                      const isEdited = isOutputEdited("social-post", idx);
                      const fullText = `${displayPost.headline}\n\n${displayPost.mainCopy}\n\n${displayPost.callToAction}${
                        displayPost.hashtags && displayPost.hashtags.length > 0
                          ? `\n\n${displayPost.hashtags.join(" ")}`
                          : ""
                      }`;
                      return (
                        <ResultCard
                          key={idx}
                          title={
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span>{`${PLATFORM_ICONS[post.platform as OutputPlatform] || ""} ${post.platform}`}</span>
                              <div className="flex items-center gap-2">
                                {isEdited && (
                                  <>
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      isDark 
                                        ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" 
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}>
                                      Edited
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => resetToLastGenerated(outputId, () => {
                                        if (currentOutputs && lastGeneratedOutputs?.socialPosts?.[idx]) {
                                          const updated = { ...currentOutputs };
                                          updated.socialPosts = [...(updated.socialPosts || [])];
                                          updated.socialPosts[idx] = { ...lastGeneratedOutputs.socialPosts[idx] };
                                          setCurrentOutputs(updated);
                                          setResult(updated);
                                        }
                                      })}
                                      className={`text-xs underline ${themeClasses.mutedText} hover:${isDark ? "text-slate-300" : "text-slate-700"}`}
                                    >
                                      Reset to last generated
                                    </button>
                                  </>
                                )}
                                {!isEditing ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditing(outputId, displayPost)}
                                    className={getSubtleButtonMediumClasses(isDark)}
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveEditing(outputId, (content) => {
                                        if (currentOutputs) {
                                          const updated = { ...currentOutputs };
                                          updated.socialPosts = [...(updated.socialPosts || [])];
                                          updated.socialPosts[idx] = { ...content };
                                          setCurrentOutputs(updated);
                                          setResult(updated);
                                        }
                                      })}
                                      className={getSubtleButtonMediumClasses(isDark)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      className={getSubtleButtonMediumClasses(isDark)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          }
                          isDark={isDark}
                          copyText={fullText}
                        >
                          <div className="space-y-3">
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Headline
                              </p>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editContent.headline || ""}
                                  onChange={(e) => setEditContent({ ...editContent, headline: e.target.value })}
                                  className={getInputClasses(isDark)}
                                />
                              ) : (
                                <p className="font-medium">{displayPost.headline}</p>
                              )}
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Body Copy
                              </p>
                              {isEditing ? (
                                <textarea
                                  value={editContent.mainCopy || ""}
                                  onChange={(e) => setEditContent({ ...editContent, mainCopy: e.target.value })}
                                  rows={4}
                                  className={getInputClasses(isDark, "resize-none")}
                                />
                              ) : (
                                <p className="whitespace-pre-wrap">{displayPost.mainCopy}</p>
                              )}
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Call to Action
                              </p>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editContent.callToAction || ""}
                                  onChange={(e) => setEditContent({ ...editContent, callToAction: e.target.value })}
                                  className={getInputClasses(isDark)}
                                />
                              ) : (
                                <p className="font-medium">{displayPost.callToAction}</p>
                              )}
                            </div>
                            {displayPost.hashtags && displayPost.hashtags.length > 0 && (
                              <div>
                                <p
                                  className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                    isDark ? "text-slate-400" : "text-slate-500"
                                  }`}
                                >
                                  Hashtags
                                </p>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={Array.isArray(editContent.hashtags) ? editContent.hashtags.join(" ") : (editContent.hashtags || "")}
                                    onChange={(e) => setEditContent({ ...editContent, hashtags: e.target.value.split(" ").filter((h: string) => h.trim()) })}
                                    className={getInputClasses(isDark)}
                                    placeholder="Separate with spaces"
                                  />
                                ) : (
                                  <p className={`text-xs opacity-75 ${themeClasses.mutedText}`}>
                                    {displayPost.hashtags.join(" ")}
                                  </p>
                                )}
                              </div>
                            )}
                            {displayPost.notes && (
                              <p
                                className={`text-xs italic mt-2 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                {displayPost.notes}
                              </p>
                            )}
                          </div>
                        </ResultCard>
                      );
                    })}
                  </div>

                  {/* Create Social Campaign CTA */}
                  <div className="mt-6">
                    <OBDPanel isDark={isDark}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <h4 className={`text-base font-semibold mb-1 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}>
                            Ready to launch?
                          </h4>
                          <p className={`text-sm ${
                            isDark ? "text-slate-400" : "text-slate-600"
                          }`}>
                            Create a social media campaign from this offer
                          </p>
                        </div>
                        <div>
                          <a
                            href="/apps/social-auto-poster/composer?handoff=1"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              try {
                                // Use authoritative output (includes user edits)
                                const auth = getAuthoritativeOutput();
                                if (!auth) {
                                  e.preventDefault();
                                  showToast("No offer data available");
                                  return;
                                }

                                // Build suggestedPosts array from authoritative social posts
                                const suggestedPosts = (auth.socialPosts || []).map((post) => ({
                                  platform: post.platform,
                                  headline: post.headline,
                                  body: post.mainCopy,
                                  cta: post.callToAction,
                                  hashtags: post.hashtags || [],
                                }));

                                // Map outputPlatforms to platformSuggestions
                                const platformSuggestions = form.outputPlatforms || [];

                                // Build Tier 5C handoff payload
                                const payload = {
                                  sourceApp: "offers-builder" as const,
                                  campaignTitle: form.promoTitle || auth.offerSummary?.headline || "Special Offer",
                                  platformSuggestions: platformSuggestions,
                                  suggestedPosts: suggestedPosts,
                                  expirationDate: form.endDate || undefined,
                                  // Include hash for duplicate detection
                                  payloadHash: getHandoffHash({
                                    sourceApp: "offers-builder",
                                    campaignTitle: form.promoTitle || auth.offerSummary?.headline || "Special Offer",
                                    suggestedPosts: suggestedPosts,
                                  }),
                                };

                                // Save to sessionStorage using standardized transport (10 min TTL)
                                writeHandoff("offers-builder", payload, 10 * 60 * 1000);

                                // Show toast
                                showToast("Sent to Social Auto-Poster as a draft campaign.");
                              } catch (error) {
                                e.preventDefault();
                                console.error("Failed to create social campaign:", error);
                                showToast("Failed to create campaign. Please try again.");
                              }
                            }}
                            className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                              isDark
                                ? "text-[#29c4a9] hover:text-[#24b09a] hover:bg-slate-800"
                                : "text-[#29c4a9] hover:text-[#24b09a] hover:bg-slate-50"
                            }`}
                          >
                            <span>Send to Social Auto-Poster</span>
                            <span className="text-xs">→</span>
                          </a>
                          <div className="text-center mt-2 space-y-1">
                            <p className={`text-xs ${themeClasses.mutedText}`}>
                              Nothing is posted automatically.
                            </p>
                            {getSuggestedPostingWindow() && (
                              <p className={`text-xs ${themeClasses.mutedText} italic`}>
                                💡 {getSuggestedPostingWindow()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </OBDPanel>
                  </div>

                  {/* Event Campaign Builder Contextual Suggestion */}
                  {shouldShowEventSuggestion && (
                    <div className="mt-4">
                      <OBDPanel isDark={isDark}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className={`text-sm font-semibold ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}>
                                Create an Event Campaign
                              </h4>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                              }`}>
                                Suggested
                              </span>
                            </div>
                            <p className={`text-xs mb-3 ${
                              isDark ? "text-slate-400" : "text-slate-600"
                            }`}>
                              Turn this offer into a full event campaign with multi-channel content.
                            </p>
                            <a
                              href="/apps/event-campaign-builder?handoff=1"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                try {
                                  const auth = getAuthoritativeOutput();
                                  if (!auth) {
                                    e.preventDefault();
                                    showToast("No offer data available");
                                    return;
                                  }

                                  // Format event date from offer dates
                                  let eventDate = "";
                                  if (form.startDate) {
                                    try {
                                      const date = new Date(form.startDate);
                                      eventDate = date.toLocaleDateString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric"
                                      });
                                    } catch {
                                      eventDate = form.startDate;
                                    }
                                  } else if (form.endDate) {
                                    try {
                                      const date = new Date(form.endDate);
                                      eventDate = date.toLocaleDateString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric"
                                      });
                                    } catch {
                                      eventDate = form.endDate;
                                    }
                                  }

                                  // Build event description from offer
                                  const eventDescription = [
                                    form.promoDescription || auth.offerSummary?.fullPitch || "",
                                    auth.offerSummary?.headline ? `Special: ${auth.offerSummary.headline}` : "",
                                  ].filter(Boolean).join("\n\n");

                                  // Build handoff payload for Event Campaign Builder
                                  const payload = {
                                    sourceApp: "offers-builder" as const,
                                    eventName: form.promoTitle || auth.offerSummary?.headline || "Special Event",
                                    eventDate: eventDate,
                                    eventDescription: eventDescription,
                                    primaryCTA: primaryCTA || "Learn More",
                                    promoCopy: auth.offerSummary?.fullPitch || form.promoDescription || "",
                                    // Include business context if available
                                    businessName: form.businessName || "",
                                    businessType: form.businessType || "",
                                    services: form.services?.join(", ") || "",
                                    city: form.city || "Ocala",
                                    state: form.state || "Florida",
                                  };

                                  // Store handoff payload for Event Campaign Builder
                                  // Event Campaign Builder will read from sessionStorage using the same HANDOFF_KEY
                                  // but will filter by source "offers-builder-to-event-campaign"
                                  writeHandoff("offers-builder-to-event-campaign", payload, 10 * 60 * 1000);

                                  showToast("Sent to Event Campaign Builder.");
                                } catch (error) {
                                  e.preventDefault();
                                  console.error("Failed to create event campaign:", error);
                                  showToast("Failed to create event campaign. Please try again.");
                                }
                              }}
                              className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "text-[#29c4a9] hover:text-[#24b09a] hover:bg-slate-800"
                                  : "text-[#29c4a9] hover:text-[#24b09a] hover:bg-slate-50"
                              }`}
                            >
                              <span>Create an Event Campaign</span>
                              <span className="text-xs">→</span>
                            </a>
                          </div>
                          <button
                            onClick={dismissEventSuggestion}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              isDark
                                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                            }`}
                            aria-label="Dismiss suggestion"
                          >
                            ✕
                          </button>
                        </div>
                      </OBDPanel>
                    </div>
                  )}

                  {/* AI Help Desk Awareness Callout */}
                  {shouldShowHelpDeskAwareness && (
                    <div className="mt-4">
                      <OBDPanel isDark={isDark}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className={`text-sm ${
                              isDark ? "text-slate-300" : "text-slate-700"
                            }`}>
                              Your AI Help Desk can answer questions about active offers.
                            </p>
                            <a
                              href="/apps/ai-help-desk"
                              className={`inline-flex items-center gap-1.5 mt-2 text-sm font-medium transition-colors ${
                                isDark
                                  ? "text-[#29c4a9] hover:text-[#24b09a]"
                                  : "text-[#29c4a9] hover:text-[#24b09a]"
                              }`}
                            >
                              <span>Visit AI Help Desk</span>
                              <span className="text-xs">→</span>
                            </a>
                          </div>
                          <button
                            onClick={dismissHelpDeskAwareness}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              isDark
                                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                            }`}
                            aria-label="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      </OBDPanel>
                    </div>
                  )}

                  {/* Turn Offer into Landing Page Link */}
                  {result && (
                    <div className="mt-4">
                      <OBDPanel isDark={isDark}>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex-1">
                            <a
                              href="/apps/content-writer?handoff=1"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                try {
                                  // Use authoritative output (includes user edits)
                                  const auth = getAuthoritativeOutput();
                                  if (!auth) {
                                    e.preventDefault();
                                    showToast("No offer data available");
                                    return;
                                  }

                                  // Build handoff payload for AI Content Writer
                                  // Use stable fields for hash calculation
                                  const stableHashFields = {
                                    sourceApp: "offers-builder",
                                    promoTitle: form.promoTitle || auth.offerSummary?.headline || "",
                                    offerValue: form.offerValue || "",
                                    endDate: form.endDate || "",
                                    primaryCTA: primaryCTA || "",
                                  };
                                  
                                  const payloadHash = getHandoffHash(stableHashFields);
                                  
                                  // Build complete payload with proper structure
                                  const payload = {
                                    payloadVersion: 1,
                                    sourceApp: "offers-builder" as const,
                                    intent: "landing-page" as const,
                                    payloadHash,
                                    ttlMs: 600000, // 10 minutes
                                    createdAt: Date.now(),
                                    offerFacts: {
                                      promoTitle: form.promoTitle || auth.offerSummary?.headline || "",
                                      promoType: form.promoType || "",
                                      offerValue: form.offerValue || "",
                                      newCustomersOnly: newCustomersOnly,
                                      redemptionLimits: redemptionLimits || "",
                                      endDate: form.endDate || "",
                                      primaryCTA: primaryCTA || "",
                                      urgencyLevel: urgencyLevel,
                                      businessName: form.businessName || "",
                                      businessType: form.businessType || "",
                                    },
                                    copy: {
                                      offerSummary: auth.offerSummary ? {
                                        headline: auth.offerSummary.headline || "",
                                        subheadline: auth.offerSummary.subheadline || "",
                                        shortPitch: auth.offerSummary.shortPitch || "",
                                        fullPitch: auth.offerSummary.fullPitch || "",
                                      } : undefined,
                                      socialPosts: auth.socialPosts && auth.socialPosts.length > 0 ? auth.socialPosts : undefined,
                                      gbpPost: auth.gbpPost ? {
                                        headline: auth.gbpPost.headline || "",
                                        description: auth.gbpPost.description || "",
                                        suggestedCTA: auth.gbpPost.suggestedCTA || "",
                                      } : undefined,
                                      email: auth.email ? {
                                        subject: auth.email.subject || "",
                                        previewText: auth.email.previewText || "",
                                        body: auth.email.body || "",
                                      } : undefined,
                                      websiteBanner: auth.websiteBanner ? {
                                        headline: auth.websiteBanner.headline || "",
                                        subheadline: auth.websiteBanner.subheadline || "",
                                        buttonText: auth.websiteBanner.buttonText || "",
                                      } : undefined,
                                    },
                                    pageDraft: {
                                      pageGoal: "Generate a dedicated landing page for this offer",
                                      primaryCTA: primaryCTA || "Get Started",
                                      suggestedSections: [
                                        "Hero (headline, subheadline, CTA)",
                                        "Offer details (what you get + who it's for)",
                                        "Eligibility & terms (rules, limits, redemption)",
                                        "Urgency / expiration",
                                        "FAQs about this offer",
                                        "Final CTA block"
                                      ],
                                      faqSeedQuestions: [
                                        "How do I redeem this offer?",
                                        "Who is eligible?",
                                        "When does this offer expire?",
                                        "Are there any limits or restrictions?",
                                        "Do I need an appointment?",
                                        "What should I bring or know before I come?"
                                      ],
                                    },
                                  };

                                  // Check for duplicate send
                                  if (checkDuplicateSend(payloadHash)) {
                                    e.preventDefault();
                                    // Store pending payload and hash for modal confirmation
                                    setPendingHandoffHash(payloadHash);
                                    setPendingHandoffPayload(payload);
                                    setShowDuplicateSendModal(true);
                                    return;
                                  }

                                  // No duplicate - send immediately
                                  sendHandoffToACW(payload, payloadHash);
                                } catch (error) {
                                  e.preventDefault();
                                  console.error("Failed to create landing page handoff:", error);
                                  showToast("Failed to create landing page. Please try again.");
                                }
                              }}
                              className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                                isDark
                                  ? "text-[#29c4a9] hover:text-[#24b09a] hover:bg-slate-800"
                                  : "text-[#29c4a9] hover:text-[#24b09a] hover:bg-slate-50"
                              }`}
                            >
                              <span>Turn this offer into a landing page</span>
                              <span className="text-xs">→</span>
                            </a>
                            <p className={`text-xs text-center mt-2 ${themeClasses.mutedText}`}>
                              Nothing is published automatically.
                            </p>
                          </div>
                        </div>
                      </OBDPanel>
                    </div>
                  )}
                </div>
              )}

              {/* Deep Copy Sections */}
              {(result.gbpPost ||
                result.email ||
                result.sms ||
                result.websiteBanner ||
                result.graphicPrompt) && (
                <>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Deep Copy Sections
                  </h3>
                </>
              )}

              {/* GBP Post */}
              {(currentOutputs?.gbpPost || result.gbpPost) && (() => {
                const outputId = "gbp-post";
                const isEditing = editingOutputId === outputId;
                const displayGbp = currentOutputs?.gbpPost || result.gbpPost;
                const isEdited = isOutputEdited("gbp-post");
                return (
                  <ResultCard
                    title={
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{`${PLATFORM_ICONS["Google Business Profile"]} Google Business Profile Post`}</span>
                        <div className="flex items-center gap-2">
                          {isEdited && (
                            <>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isDark 
                                  ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" 
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                Edited
                              </span>
                              <button
                                type="button"
                                onClick={() => resetToLastGenerated(outputId, () => {
                                  if (currentOutputs && lastGeneratedOutputs?.gbpPost) {
                                    const updated = { ...currentOutputs };
                                    updated.gbpPost = { ...lastGeneratedOutputs.gbpPost };
                                    setCurrentOutputs(updated);
                                    setResult(updated);
                                  }
                                })}
                                className={`text-xs underline ${themeClasses.mutedText} hover:${isDark ? "text-slate-300" : "text-slate-700"}`}
                              >
                                Reset to last generated
                              </button>
                            </>
                          )}
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditing(outputId, displayGbp)}
                              className={getSubtleButtonMediumClasses(isDark)}
                            >
                              Edit
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditing(outputId, (content) => {
                                  if (currentOutputs) {
                                    const updated = { ...currentOutputs };
                                    updated.gbpPost = { ...content };
                                    setCurrentOutputs(updated);
                                    setResult(updated);
                                  }
                                })}
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    isDark={isDark}
                    copyText={`${displayGbp.headline}\n\n${displayGbp.description}\n\n${displayGbp.suggestedCTA}`}
                  >
                    <div className="space-y-3">
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Headline
                        </p>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editContent.headline || ""}
                            onChange={(e) => setEditContent({ ...editContent, headline: e.target.value })}
                            className={getInputClasses(isDark)}
                          />
                        ) : (
                          <p className="font-medium">{displayGbp.headline}</p>
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Description
                        </p>
                        {isEditing ? (
                          <textarea
                            value={editContent.description || ""}
                            onChange={(e) => setEditContent({ ...editContent, description: e.target.value })}
                            rows={4}
                            className={getInputClasses(isDark, "resize-none")}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{displayGbp.description}</p>
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Call to Action
                        </p>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editContent.suggestedCTA || ""}
                            onChange={(e) => setEditContent({ ...editContent, suggestedCTA: e.target.value })}
                            className={getInputClasses(isDark)}
                          />
                        ) : (
                          <p>{displayGbp.suggestedCTA}</p>
                        )}
                      </div>
                    </div>
                  </ResultCard>
                );
              })()}

              {/* Email */}
              {(() => {
                const auth = getAuthoritativeOutput();
                const email = auth?.email || result.email;
                if (!email) return null;
                const outputId = "email-offer";
                const isEditing = editingOutputId === outputId;
                const displayEmail = currentOutputs?.email || email;
                const isEdited = isOutputEdited("email");
                return (
                  <ResultCard
                    title={
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{`${PLATFORM_ICONS.Email} Email Campaign`}</span>
                        <div className="flex items-center gap-2">
                          {isEdited && (
                            <>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isDark 
                                  ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" 
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                Edited
                              </span>
                              <button
                                type="button"
                                onClick={() => resetToLastGenerated(outputId, () => {
                                  if (currentOutputs && lastGeneratedOutputs?.email) {
                                    const updated = { ...currentOutputs };
                                    updated.email = { ...lastGeneratedOutputs.email };
                                    setCurrentOutputs(updated);
                                    setResult(updated);
                                  }
                                })}
                                className={`text-xs underline ${themeClasses.mutedText} hover:${isDark ? "text-slate-300" : "text-slate-700"}`}
                              >
                                Reset to last generated
                              </button>
                            </>
                          )}
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditing(outputId, displayEmail)}
                              className={getSubtleButtonMediumClasses(isDark)}
                            >
                              Edit
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditing(outputId, (content) => {
                                  if (currentOutputs) {
                                    const updated = { ...currentOutputs };
                                    updated.email = { ...content };
                                    setCurrentOutputs(updated);
                                    setResult(updated);
                                  }
                                })}
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    isDark={isDark}
                    copyText={`Subject: ${displayEmail.subject}\n\nPreview: ${displayEmail.previewText}\n\n${displayEmail.body}`}
                  >
                  <div className="space-y-4">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Subject
                      </p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editContent.subject || ""}
                          onChange={(e) => setEditContent({ ...editContent, subject: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      ) : (
                        <p>{displayEmail.subject}</p>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Preview Text
                      </p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editContent.previewText || ""}
                          onChange={(e) => setEditContent({ ...editContent, previewText: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      ) : (
                        <p className="text-xs italic">{displayEmail.previewText}</p>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Body
                      </p>
                      {isEditing ? (
                        <textarea
                          value={editContent.body || ""}
                          onChange={(e) => setEditContent({ ...editContent, body: e.target.value })}
                          rows={6}
                          className={getInputClasses(isDark, "resize-none")}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{displayEmail.body}</p>
                      )}
                    </div>
                  </div>
                </ResultCard>
                );
              })()}

              {/* SMS */}
              {(() => {
                const auth = getAuthoritativeOutput();
                const sms = auth?.sms || result.sms;
                if (!sms) return null;
                return (
                  <ResultCard
                    title={`${PLATFORM_ICONS.SMS} SMS Message`}
                    isDark={isDark}
                    copyText={sms.message}
                  >
                    <p className="whitespace-pre-wrap">{sms.message}</p>
                    <p
                      className={`text-xs mt-2 ${themeClasses.mutedText}`}
                    >
                      Length: {sms.message.length} characters
                    </p>
                  </ResultCard>
                );
              })()}

              {/* Website Banner */}
              {(() => {
                const auth = getAuthoritativeOutput();
                const banner = auth?.websiteBanner || result.websiteBanner;
                if (!banner) return null;
                const outputId = "website-banner";
                const isEditing = editingOutputId === outputId;
                const displayBanner = currentOutputs?.websiteBanner || banner;
                const isEdited = isOutputEdited("website-banner");
                return (
                  <ResultCard
                    title={
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{`${PLATFORM_ICONS["Website Banner"]} Website Banner`}</span>
                        <div className="flex items-center gap-2">
                          {isEdited && (
                            <>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isDark 
                                  ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" 
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                Edited
                              </span>
                              <button
                                type="button"
                                onClick={() => resetToLastGenerated(outputId, () => {
                                  if (currentOutputs && lastGeneratedOutputs?.websiteBanner) {
                                    const updated = { ...currentOutputs };
                                    updated.websiteBanner = { ...lastGeneratedOutputs.websiteBanner };
                                    setCurrentOutputs(updated);
                                    setResult(updated);
                                  }
                                })}
                                className={`text-xs underline ${themeClasses.mutedText} hover:${isDark ? "text-slate-300" : "text-slate-700"}`}
                              >
                                Reset to last generated
                              </button>
                            </>
                          )}
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditing(outputId, displayBanner)}
                              className={getSubtleButtonMediumClasses(isDark)}
                            >
                              Edit
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditing(outputId, (content) => {
                                  if (currentOutputs) {
                                    const updated = { ...currentOutputs };
                                    updated.websiteBanner = { ...content };
                                    setCurrentOutputs(updated);
                                    setResult(updated);
                                  }
                                })}
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    isDark={isDark}
                    copyText={`${displayBanner.headline}\n\n${displayBanner.subheadline}\n\nButton: ${displayBanner.buttonText}`}
                  >
                  <div className="space-y-4">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Preview
                      </p>
                      <div
                        className={`rounded-lg border-2 p-6 text-center ${
                          isDark
                            ? "bg-slate-900/50 border-[#29c4a9]"
                            : "bg-white border-[#29c4a9]"
                        }`}
                      >
                        <h4
                          className={`text-xl font-bold mb-2 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {displayBanner.headline}
                        </h4>
                        <p
                          className={`mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                        >
                          {displayBanner.subheadline}
                        </p>
                        <button
                          className={`px-6 py-2 rounded-lg font-medium ${
                            isDark
                              ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                              : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                          }`}
                        >
                          {displayBanner.buttonText}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Headline
                      </p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editContent.headline || ""}
                          onChange={(e) => setEditContent({ ...editContent, headline: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      ) : (
                        <p>{displayBanner.headline}</p>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Subheadline
                      </p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editContent.subheadline || ""}
                          onChange={(e) => setEditContent({ ...editContent, subheadline: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      ) : (
                        <p>{displayBanner.subheadline}</p>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Button Text
                      </p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editContent.buttonText || ""}
                          onChange={(e) => setEditContent({ ...editContent, buttonText: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      ) : (
                        <p>{displayBanner.buttonText}</p>
                      )}
                    </div>
                  </div>
                </ResultCard>
                );
              })()}

              {/* Graphic Prompt */}
              {result.graphicPrompt && (
                <ResultCard
                  title="Graphic / Design Prompt"
                  isDark={isDark}
                  copyText={result.graphicPrompt}
                >
                  <p className="whitespace-pre-wrap">{result.graphicPrompt}</p>
                  <p
                    className={`text-xs mt-2 italic ${themeClasses.mutedText}`}
                  >
                    Use this prompt with AI image generators like DALL-E,
                    Midjourney, or Canva AI
                  </p>
                </ResultCard>
              )}

              {/* Variations */}
              {result.variations && result.variations.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Alternate Variations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.variations.map((variation, idx) => {
                      const fullText = `${variation.headline}\n\n${variation.mainCopy}\n\n${variation.callToAction}${
                        variation.hashtags && variation.hashtags.length > 0
                          ? `\n\n${variation.hashtags.join(" ")}`
                          : ""
                      }`;
                      return (
                        <ResultCard
                          key={idx}
                          title={`Alternate Promo #${idx + 1} - ${variation.platform}`}
                          isDark={isDark}
                          copyText={fullText}
                        >
                          <div className="space-y-3">
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Headline
                              </p>
                              <p className="font-medium">{variation.headline}</p>
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Body Copy
                              </p>
                              <p className="whitespace-pre-wrap">
                                {variation.mainCopy}
                              </p>
                            </div>
                            <div>
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Call to Action
                              </p>
                              <p className="font-medium">{variation.callToAction}</p>
                            </div>
                            {variation.hashtags &&
                              variation.hashtags.length > 0 && (
                                <div>
                                  <p
                                    className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                      isDark ? "text-slate-400" : "text-slate-500"
                                    }`}
                                  >
                                    Hashtags
                                  </p>
                                  <p
                                    className={`text-xs opacity-75 ${themeClasses.mutedText}`}
                                  >
                                    {variation.hashtags.join(" ")}
                                  </p>
                                </div>
                              )}
                          </div>
                        </ResultCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.meta.warnings && result.meta.warnings.length > 0 && (
                <div
                  className={`rounded-xl border p-4 ${
                    isDark
                      ? "bg-amber-950/20 border-amber-800"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-amber-200" : "text-amber-800"
                    }`}
                  >
                    ⚠️ Warnings
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {result.meta.warnings.map((warning, idx) => (
                      <li
                        key={idx}
                        className={`text-sm ${
                          isDark ? "text-amber-100" : "text-amber-700"
                        }`}
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </OBDPanel>
      )}

      {!result && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-8">
          <p
            className={`italic obd-soft-text text-center py-8 ${
              isDark ? "text-slate-500" : "text-gray-400"
            }`}
          >
            Fill out the form above and click "Generate Promotional Offers" to
            create your multi-platform promotional content.
          </p>
        </OBDPanel>
      )}

      {/* Sticky Bottom Action Bar */}
      {result && !loading && (
        <OBDStickyActionBar isDark={isDark} className="mt-12">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleRegenerate()}
              disabled={loading}
              className={`px-6 py-2.5 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Regenerate with Same Inputs
            </button>
            <p className={`text-xs text-center ${themeClasses.mutedText}`}>
              We'll keep the offer details exactly the same and only improve the wording.
            </p>
          </div>
          <button
            onClick={handleStartNew}
            className={`px-6 py-2.5 font-medium rounded-xl transition-colors ${
              isDark
                ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
            }`}
          >
            Start New Promotion
          </button>
        </OBDStickyActionBar>
      )}

      {/* Regenerate Confirmation Modal */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <OBDPanel isDark={isDark} className="max-w-md w-full mx-4">
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              Confirm Regeneration
            </h3>
            <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
              Regenerating will overwrite your edits. Continue?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                className={getSubtleButtonMediumClasses(isDark)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performRegenerate}
                className={SUBMIT_BUTTON_CLASSES}
              >
                Continue
              </button>
            </div>
          </OBDPanel>
        </div>
      )}

      {/* Duplicate Send Confirmation Modal */}
      {showDuplicateSendModal && pendingHandoffHash && pendingHandoffPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <OBDPanel isDark={isDark} className="max-w-md w-full mx-4">
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              Already Sent Recently
            </h3>
            <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
              This offer was already sent to AI Content Writer recently. Send again anyway?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateSendModal(false);
                  setPendingHandoffHash(null);
                  setPendingHandoffPayload(null);
                }}
                className={getSubtleButtonMediumClasses(isDark)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  sendHandoffToACW(pendingHandoffPayload, pendingHandoffHash);
                  setShowDuplicateSendModal(false);
                  setPendingHandoffHash(null);
                  setPendingHandoffPayload(null);
                }}
                className={SUBMIT_BUTTON_CLASSES}
              >
                Send anyway
              </button>
            </div>
          </OBDPanel>
        </div>
      )}
    </OBDPageContainer>
  );
}

export default function OffersBuilderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OffersBuilderPageContent />
    </Suspense>
  );
}