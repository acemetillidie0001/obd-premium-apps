/**
 * Event Campaign Builder
 * 
 * ARCHITECTURAL OVERVIEW:
 * 
 * This app is a campaign orchestration planner for time-bound events.
 * It generates structured, multi-channel campaign drafts.
 * 
 * This app is NOT:
 * - A scheduler (does not schedule posts or send at specific times)
 * - A calendar (does not manage event calendars or dates)
 * - A ticketing system (does not handle ticket sales or reservations)
 * - A CRM (does not manage customer relationships or contacts)
 * - An automation engine (does not execute or trigger automated actions)
 * 
 * This app does NOT:
 * - Publish content to any platform
 * - Schedule posts or messages
 * - Send emails or SMS messages
 * - Sync with external systems
 * 
 * This app ONLY:
 * - Generates campaign content drafts (text, copy, suggestions)
 * - Provides structured campaign plans and recommendations
 * - Outputs content that users can manually review, edit, and use elsewhere
 */

"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import ResultCard from "@/components/obd/ResultCard";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
  getSubtleButtonMediumClasses,
  getSubtleButtonSmallClasses,
  getSecondaryButtonClasses,
} from "@/lib/obd-framework/layout-helpers";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import {
  EventCampaignFormValues,
  EventCampaignResponse,
  EventGoal,
  EventType,
  PersonalityStyle,
  LanguageOption,
} from "./types";
// Note: Using standardized sessionStorage transport with TTL
import { writeHandoff, readHandoff, clearHandoff } from "@/lib/obd-framework/social-handoff-transport";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";
import {
  safeParseDate,
  formatEventDateRange,
  validateEventHandoffPayload,
} from "@/lib/apps/event-campaign-builder/handoff-utils";
import { mapCampaignToItems } from "@/lib/apps/event-campaign-builder/campaign-mapper";
import { getActiveCampaign } from "@/lib/apps/event-campaign-builder/getActiveCampaign";
import {
  getItemsForChannel,
  getItemsByType,
  getMetaItem,
  getSingleAsset,
  getHashtagBundles,
  getScheduleIdeas,
} from "@/lib/apps/event-campaign-builder/campaign-selectors";
import {
  applyVariantToContent,
  getAvailableVariants,
  type CountdownVariant as VariantType,
} from "@/lib/apps/event-campaign-builder/variant-generator";
import type { CampaignItem } from "./types";
import EventCampaignImportBanner from "./components/EventCampaignImportBanner";

const defaultFormValues: EventCampaignFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  eventName: "",
  eventDate: "",
  eventTime: "",
  eventLocation: "",
  eventType: "InPerson",
  eventDescription: "",
  audience: "",
  mainGoal: "Awareness",
  budgetLevel: "Free",
  urgencyLevel: "Normal",
  brandVoice: "",
  personalityStyle: "None",
  language: "English",
  includeFacebook: true,
  includeInstagram: true,
  includeX: false,
  includeGoogleBusiness: true,
  includeEmail: false,
  includeSms: false,
  includeImageCaption: false,
  campaignDurationDays: 10,
  notesForAI: "",
};

const EVENT_GOALS: EventGoal[] = [
  "Awareness",
  "RSVPs",
  "TicketSales",
  "WalkIns",
  "Leads",
  "Other",
];

const EVENT_TYPES: EventType[] = ["InPerson", "Virtual", "Hybrid"];

const BUDGET_LEVELS: ("Free" | "Low" | "Moderate" | "Premium")[] = [
  "Free",
  "Low",
  "Moderate",
  "Premium",
];

const URGENCY_LEVELS: ("Normal" | "Last-Minute")[] = ["Normal", "Last-Minute"];

function EventCampaignBuilderPageContent() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  const [form, setForm] = useState<EventCampaignFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Legacy result state - kept for debugging only, NOT used for display/export/handoff
  // All UI rendering uses canonical state: activeCampaign (CampaignItem[])
  const [result, setResult] = useState<EventCampaignResponse | null>(null);
  const [lastPayload, setLastPayload] =
    useState<EventCampaignFormValues | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  
  // Handoff payload state
  const [handoffPayload, setHandoffPayload] = useState<any | null>(null);

  // Canonical state model: generatedCampaign and editedCampaign (using CampaignItem[])
  const [generatedCampaign, setGeneratedCampaign] = useState<CampaignItem[]>([]);
  const [editedCampaign, setEditedCampaign] = useState<CampaignItem[] | null>(null);

  // Editing state: which campaign item is being edited and its current edit text
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  // AI Help Desk awareness banner dismissal state
  const [showHelpDeskBanner, setShowHelpDeskBanner] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const dismissed = sessionStorage.getItem("event-campaign-builder.help-desk-banner-dismissed");
      return dismissed !== "true";
    } catch {
      return true;
    }
  });

  const handleDismissHelpDeskBanner = () => {
    try {
      sessionStorage.setItem("event-campaign-builder.help-desk-banner-dismissed", "true");
      setShowHelpDeskBanner(false);
    } catch {
      setShowHelpDeskBanner(false);
    }
  };

  // Variant selector state
  type CountdownVariant = "7-days" | "3-days" | "day-of";
  const [selectedVariant, setSelectedVariant] = useState<CountdownVariant>(() => {
    if (typeof window === "undefined") return "7-days";
    try {
      const stored = sessionStorage.getItem("event-campaign-builder.selected-variant");
      if (stored === "7-days" || stored === "3-days" || stored === "day-of") {
        return stored;
      }
    } catch {
      // Ignore storage errors
    }
    return "7-days";
  });

  // Check if variant switching is locked (any item is edited)
  const isVariantLocked = useMemo(() => {
    return editedCampaign !== null && editedCampaign.length > 0;
  }, [editedCampaign]);

  // Persist variant selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("event-campaign-builder.selected-variant", selectedVariant);
    } catch {
      // Ignore storage errors
    }
  }, [selectedVariant]);

  // Handle variant change (only if not locked)
  const handleVariantChange = (variant: CountdownVariant) => {
    if (isVariantLocked) {
      showToast("Variant switching is locked after editing to prevent content loss");
      return;
    }
    setSelectedVariant(variant);
  };

  // Reset all edits to unlock variants
  const handleResetAllEdits = () => {
    if (!editedCampaign || editedCampaign.length === 0) return;
    
    setEditedCampaign(null);
    setEditingId(null);
    setEditText("");
    showToast("All edits reset - variant switching unlocked");
  };

  // Canonical selector: returns edited campaign if present, otherwise generated campaign
  const getActiveCampaignList = (): CampaignItem[] => {
    return getActiveCampaign(generatedCampaign, editedCampaign);
  };

  // Memoized active campaign for use throughout component
  const activeCampaign = useMemo(() => getActiveCampaignList(), [generatedCampaign, editedCampaign]);

  // Memoized selectors for rendering
  const facebookPosts = useMemo(() => getItemsForChannel(activeCampaign, "facebook"), [activeCampaign]);
  const instagramCaptions = useMemo(() => getItemsForChannel(activeCampaign, "instagram").filter((i) => i.type === "asset-instagramCaption"), [activeCampaign]);
  const instagramStories = useMemo(() => getItemsForChannel(activeCampaign, "instagram").filter((i) => i.type === "asset-instagramStory"), [activeCampaign]);
  const xPosts = useMemo(() => getItemsForChannel(activeCampaign, "x"), [activeCampaign]);
  const googleBusinessPosts = useMemo(() => getItemsForChannel(activeCampaign, "googleBusiness"), [activeCampaign]);
  const emailItems = useMemo(() => getItemsForChannel(activeCampaign, "email"), [activeCampaign]);
  const smsBlasts = useMemo(() => getItemsForChannel(activeCampaign, "sms"), [activeCampaign]);
  const eventTitles = useMemo(() => getItemsByType(activeCampaign, "asset-eventTitle"), [activeCampaign]);
  const shortDescriptions = useMemo(() => getItemsByType(activeCampaign, "asset-shortDescription"), [activeCampaign]);
  const longDescription = useMemo(() => getSingleAsset(activeCampaign, "longDescription"), [activeCampaign]);
  const imageCaption = useMemo(() => getSingleAsset(activeCampaign, "imageCaption"), [activeCampaign]);
  const hashtagBundles = useMemo(() => getHashtagBundles(activeCampaign), [activeCampaign]);
  const scheduleIdeas = useMemo(() => getScheduleIdeas(activeCampaign), [activeCampaign]);
  
  // Meta items
  const primaryTagline = useMemo(() => getMetaItem(activeCampaign, "primaryTagline"), [activeCampaign]);
  const primaryCallToAction = useMemo(() => getMetaItem(activeCampaign, "primaryCallToAction"), [activeCampaign]);
  const recommendedStartDateNote = useMemo(() => getMetaItem(activeCampaign, "recommendedStartDateNote"), [activeCampaign]);
  const timezoneNote = useMemo(() => getMetaItem(activeCampaign, "timezoneNote"), [activeCampaign]);

  // Status tracking for sticky action bar
  const campaignStatus: "Draft" | "Generated" | "Edited" = 
    editedCampaign !== null ? "Edited" : generatedCampaign.length > 0 ? "Generated" : "Draft";

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Use utility functions for date parsing and validation

  // Apply handoff payload to form (additive - only fills empty fields)
  const applyHandoffToForm = (envelopePayload: any) => {
    setForm(prev => {
      const updatedForm: Partial<EventCampaignFormValues> = {};

      // Map offer title to eventName (only if field is empty)
      if (!prev.eventName.trim()) {
        if (envelopePayload.eventName) {
          updatedForm.eventName = envelopePayload.eventName;
        } else if (envelopePayload.title) {
          updatedForm.eventName = envelopePayload.title;
        }
      }

      // Map date fields (only if field is empty)
      if (!prev.eventDate.trim()) {
        // Try to get date from various sources
        let dateValue: string | null = null;
        
        if (envelopePayload.eventDate) {
          dateValue = String(envelopePayload.eventDate);
        } else if (envelopePayload.dateRange && typeof envelopePayload.dateRange === "object") {
          const range = envelopePayload.dateRange as Record<string, unknown>;
          if (range.start) {
            dateValue = String(range.start);
          }
        } else if (envelopePayload.startDate) {
          dateValue = String(envelopePayload.startDate);
        } else if (envelopePayload.date) {
          dateValue = String(envelopePayload.date);
        }
        
        if (dateValue) {
          // Validate the date can be parsed before setting
          const parsed = safeParseDate(dateValue);
          if (parsed) {
            updatedForm.eventDate = dateValue;
          }
        }
      }

      // Map eventDescription (combine description + summary if provided, only if empty)
      if (!prev.eventDescription.trim()) {
        const descriptionParts: string[] = [];
        if (envelopePayload.description) {
          descriptionParts.push(envelopePayload.description);
        }
        if (envelopePayload.summary) {
          descriptionParts.push(envelopePayload.summary);
        }
        if (descriptionParts.length > 0) {
          updatedForm.eventDescription = descriptionParts.join("\n\n");
        }
      }

      // Map location (only if field is empty)
      if (!prev.eventLocation.trim() && envelopePayload.location) {
        updatedForm.eventLocation = envelopePayload.location;
      }

      // Map primaryCTA to notesForAI (additive - append if notesForAI has content)
      if (envelopePayload.primaryCTA) {
        if (prev.notesForAI.trim()) {
          updatedForm.notesForAI = `${prev.notesForAI}\n\nPrimary CTA: ${envelopePayload.primaryCTA}`;
        } else {
          updatedForm.notesForAI = `Primary CTA: ${envelopePayload.primaryCTA}`;
        }
      }

      // Map promoCopy to notesForAI (additive - append)
      if (envelopePayload.promoCopy) {
        const existingNotes = updatedForm.notesForAI || prev.notesForAI;
        if (existingNotes.trim()) {
          updatedForm.notesForAI = `${existingNotes}\n\nPromo Copy: ${envelopePayload.promoCopy}`;
        } else {
          updatedForm.notesForAI = `Promo Copy: ${envelopePayload.promoCopy}`;
        }
      }

      // Map business context fields (only if fields are empty)
      if (!prev.businessName.trim() && envelopePayload.businessName) {
        updatedForm.businessName = envelopePayload.businessName;
      }
      if (!prev.businessType.trim() && envelopePayload.businessType) {
        updatedForm.businessType = envelopePayload.businessType;
      }
      if (!prev.services.trim() && envelopePayload.services) {
        updatedForm.services = envelopePayload.services;
      }
      if (!prev.city.trim() && envelopePayload.city) {
        updatedForm.city = envelopePayload.city;
      }
      if (!prev.state.trim() && envelopePayload.state) {
        updatedForm.state = envelopePayload.state;
      }

      // Map brand voice (only if field is empty)
      if (!prev.brandVoice.trim() && envelopePayload.brandVoice) {
        updatedForm.brandVoice = envelopePayload.brandVoice;
      }

      // Map personality style (only if not set or is "None")
      if ((!prev.personalityStyle || prev.personalityStyle === "None") && envelopePayload.personalityStyle) {
        updatedForm.personalityStyle = envelopePayload.personalityStyle as PersonalityStyle;
      }

      // Map language (only if field is empty or default)
      if ((!prev.language || prev.language === "English") && envelopePayload.language) {
        updatedForm.language = envelopePayload.language as LanguageOption;
      }

      return { ...prev, ...updatedForm };
    });
  };

  // Handle "Apply to inputs" button
  const handleApplyHandoff = () => {
    if (handoffPayload) {
      applyHandoffToForm(handoffPayload);
      clearHandoff();
      setHandoffPayload(null);
      showToast("Offer imported into Event Campaign Builder");
      
      // Remove handoff query param from URL
      if (typeof window !== "undefined") {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }
      
      // Scroll to form/top of builder section
      setTimeout(() => {
        const formElement = document.querySelector('form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 100);
    }
  };

  // Handle "Dismiss" button
  const handleDismissHandoff = () => {
    clearHandoff();
    setHandoffPayload(null);
    
    // Remove handoff query param from URL
    if (typeof window !== "undefined") {
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);
    }
  };

  // Handle Offers Builder handoff on page load
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!searchParams) return;

    // Only check for handoff if URL includes ?handoff=1
    if (searchParams.get("handoff") !== "1") {
      return;
    }

    try {
      const handoffResult = readHandoff();

      // Handle expired payload
      if (handoffResult.expired) {
        clearHandoff();
        showToast("Handoff expired.");
        return;
      }

      // Handle errors
      if (handoffResult.error) {
        clearHandoff();
        console.error("Handoff error:", handoffResult.error);
        return;
      }

      if (handoffResult.envelope) {
        const { source, payload: envelopePayload } = handoffResult.envelope;

        // Check if this is an offers-builder-to-event-campaign handoff
        if (source === "offers-builder-to-event-campaign" && envelopePayload) {
          // Validate payload shape using utility
          const validation = validateEventHandoffPayload(envelopePayload);
          if (!validation.ok) {
            clearHandoff();
            showToast(validation.reason || "Invalid handoff payload.");
            return;
          }

          // Tenant safety: Check businessId if present in payload
          if (envelopePayload.businessId || envelopePayload.tenantId) {
            const currentBusinessId = resolveBusinessId(searchParams);
            if (envelopePayload.businessId && currentBusinessId && envelopePayload.businessId !== currentBusinessId) {
              clearHandoff();
              showToast("Invalid handoff for this business.");
              return;
            }
            // If tenantId is present, validate it matches current session (future enhancement)
            // For now, tenant safety is handled at the session/auth level
          }

          // Store payload for banner display (no auto-apply)
          setHandoffPayload(envelopePayload);
        }
      }
    } catch (error) {
      console.error("Failed to read offers handoff from sessionStorage:", error);
      clearHandoff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        setForm((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as EventCampaignFormValues);
      } else {
        setForm(formOrUpdater as unknown as EventCampaignFormValues);
      }
    },
    storageKey: "event-campaign-builder-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "city") return "city";
      if (formKey === "state") return "state";
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

  // Accordion state for form sections
  const [accordionState, setAccordionState] = useState({
    businessBasics: false,
    eventDetails: true, // Default open
    audienceStrategy: false,
    brandStyle: false,
    channels: false,
    campaignTiming: false,
    advancedNotes: false,
  });

  // Toggle accordion section
  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Summary functions for accordion sections
  const getBusinessBasicsSummary = (): string => {
    const parts: string[] = [];
    if (form.businessName) parts.push(form.businessName);
    if (form.businessType) parts.push(form.businessType);
    return parts.length > 0 ? parts.join(" • ") : "Not filled";
  };

  const getEventDetailsSummary = (): string => {
    const parts: string[] = [];
    if (form.eventName) parts.push(form.eventName);
    if (form.eventDate) {
      // Try to extract just the date part (e.g., "Mar 15" from "March 15, 2026")
      const dateStr = form.eventDate.trim();
      parts.push(dateStr.length > 15 ? dateStr.substring(0, 15) + "..." : dateStr);
    }
    if (form.eventType && form.eventType !== "InPerson") {
      const typeLabel = form.eventType === "Virtual" ? "Virtual" : form.eventType === "Hybrid" ? "Hybrid" : form.eventType;
      parts.push(typeLabel);
    } else if (form.eventType === "InPerson") {
      parts.push("In-Person");
    }
    return parts.length > 0 ? parts.join(" • ") : "Not filled";
  };

  const getAudienceStrategySummary = (): string => {
    const parts: string[] = [];
    if (form.audience) parts.push(form.audience);
    if (form.mainGoal) parts.push(form.mainGoal);
    if (form.budgetLevel && form.budgetLevel !== "Free") parts.push(form.budgetLevel);
    if (form.urgencyLevel && form.urgencyLevel !== "Normal") parts.push(form.urgencyLevel);
    return parts.length > 0 ? parts.join(" • ") : "Not set";
  };

  const getBrandStyleSummary = (): string => {
    const parts: string[] = [];
    if (form.brandVoice) parts.push("Brand Voice");
    if (form.personalityStyle && form.personalityStyle !== "None") parts.push(form.personalityStyle);
    if (form.language && form.language !== "English") parts.push(form.language);
    return parts.length > 0 ? parts.join(" • ") : "Not set";
  };

  const getChannelsSummary = (): string => {
    const channels: string[] = [];
    if (form.includeFacebook) channels.push("Facebook");
    if (form.includeInstagram) channels.push("Instagram");
    if (form.includeX) channels.push("X");
    if (form.includeGoogleBusiness) channels.push("Google Business");
    if (form.includeEmail) channels.push("Email");
    if (form.includeSms) channels.push("SMS");
    if (form.includeImageCaption) channels.push("Image Caption");
    return channels.length > 0 ? channels.join(", ") : "None selected";
  };

  const getCampaignTimingSummary = (): string => {
    return `${form.campaignDurationDays} days`;
  };

  const getAdvancedNotesSummary = (): string => {
    if (!form.notesForAI.trim()) return "No notes";
    const preview = form.notesForAI.trim().substring(0, 50);
    return preview.length < form.notesForAI.trim().length ? `${preview}...` : preview;
  };

  function updateFormValue<K extends keyof EventCampaignFormValues>(
    key: K,
    value: EventCampaignFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async (e?: React.FormEvent) => {
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

    if (!form.eventName.trim()) {
      setError("Please enter an event name to continue.");
      return;
    }

    if (!form.eventDescription.trim()) {
      setError("Please describe your event—add a bit more detail so we can create the best campaign for you.");
      return;
    }

    if (!form.eventDate.trim()) {
      setError("Please enter an event date to continue.");
      return;
    }

    if (!form.eventTime.trim()) {
      setError("Please enter an event time to continue.");
      return;
    }

    if (!form.eventLocation.trim()) {
      setError("Please enter an event location to continue.");
      return;
    }

    if (
      !form.includeFacebook &&
      !form.includeInstagram &&
      !form.includeX &&
      !form.includeGoogleBusiness &&
      !form.includeEmail &&
      !form.includeSms
    ) {
      setError("Please select at least one channel (Facebook, Instagram, Email, etc.) to generate your campaign.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/event-campaign-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: EventCampaignResponse }
      const response = jsonResponse.data || jsonResponse;
      setResult(response);
      
      // Map response to canonical CampaignItem[] format
      const campaignItems = mapCampaignToItems(response);
      setGeneratedCampaign(campaignItems);
      setEditedCampaign(null); // Clear any previous edits on new generation
      
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      // Scroll to results
      setTimeout(() => {
        const resultsElement = document.getElementById("campaign-results");
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      
      setLastPayload({ ...form });
    } catch (error) {
      console.error("EventCampaignBuilder Submit Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    setForm(lastPayload);
    await handleSubmit();
  };

  // Editing handlers
  const handleEdit = (id: string) => {
    const item = activeCampaign.find((c) => c.id === id);
    if (item) {
      setEditingId(item.id);
      // Use variant content for variant-supported channels, otherwise use base content
      const variantChannels: CampaignItem["type"][] = [
        "asset-xPost",
        "asset-smsBlast",
        "asset-googleBusinessPost",
      ];
      if (variantChannels.includes(item.type) && !isItemEdited(item.id)) {
        // For variant channels that haven't been edited, use variant-transformed content
        setEditText(getVariantContent(item));
      } else {
        // For non-variant channels or already-edited items, use base content
        setEditText(item.content);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = (itemId: string) => {
    const trimmedText = editText.trim();
    
    // Validation: prevent empty content save
    if (!trimmedText) {
      showToast("Content cannot be empty");
      return;
    }

    // Get current active campaign (this will be generatedCampaign if editedCampaign is null)
    const currentActive = getActiveCampaignList();
    
    // Find the item being edited
    const itemToUpdate = currentActive.find((c) => c.id === itemId);
    if (!itemToUpdate) {
      showToast("Item not found");
      return;
    }

    // Create updated item with new content
    const updatedItem: CampaignItem = {
      ...itemToUpdate,
      content: trimmedText,
    };

    // Create new edited campaign array
    // If editedCampaign is null, start with a copy of generatedCampaign
    // Otherwise, use the existing editedCampaign
    const baseCampaign = editedCampaign ?? generatedCampaign;
    const newEditedCampaign = baseCampaign.map((c) => 
      c.id === itemId ? updatedItem : c
    );

    // Set edited campaign (this will trigger the "Edited" badge)
    // Set edited campaign - UI will render from canonical state (activeCampaign)
    setEditedCampaign(newEditedCampaign);
    
    // Clear editing state
    setEditingId(null);
    setEditText("");
    
    showToast("Edit saved");
  };

  // Reset a specific item to its generated version
  const handleResetItem = (itemId: string) => {
    if (!editedCampaign || !generatedCampaign.length) return;
    
    // Find the generated version
    const generatedItem = generatedCampaign.find((c) => c.id === itemId);
    if (!generatedItem) {
      showToast("Original version not found");
      return;
    }

    // Remove this item from edited campaign (revert to generated)
    const newEditedCampaign = editedCampaign.map((c) => 
      c.id === itemId ? generatedItem : c
    );

    // Check if all items are back to generated (if so, clear editedCampaign)
    const allReverted = newEditedCampaign.every((editedItem) => {
      const genItem = generatedCampaign.find((g) => g.id === editedItem.id);
      return genItem && genItem.content === editedItem.content;
    });

    if (allReverted) {
      setEditedCampaign(null);
      // UI will render from canonical state (activeCampaign)
    } else {
      setEditedCampaign(newEditedCampaign);
      // UI will render from canonical state (activeCampaign)
    }
    
    showToast("Reset to generated version");
  };

  // Helper to check if a specific item has been edited
  const isItemEdited = (itemId: string): boolean => {
    if (!editedCampaign) return false;
    const editedItem = editedCampaign.find((c) => c.id === itemId);
    const generatedItem = generatedCampaign.find((c) => c.id === itemId);
    if (!editedItem || !generatedItem) return false;
    return editedItem.content !== generatedItem.content;
  };

  // Helper to get the active content for a specific item
  const getActiveContent = (itemId: string): string => {
    const active = getActiveCampaignList();
    const item = active.find((c) => c.id === itemId);
    return item?.content || "";
  };

  // Get variant-specific content for countdown variant channels
  const getVariantContent = (item: CampaignItem): string => {
    const baseContent = getActiveContent(item.id);
    
    // Only apply variant transformation to channels that support countdown variants
    const variantChannels: CampaignItem["type"][] = [
      "asset-xPost",
      "asset-smsBlast",
      "asset-googleBusinessPost",
    ];
    
    if (!variantChannels.includes(item.type)) {
      return baseContent;
    }
    
    // If item is edited, don't apply variant transformation (user has customized it)
    if (isItemEdited(item.id)) {
      return baseContent;
    }
    
    // Apply variant transformation to generated content
    const eventDate = form.eventDate.trim();
    if (!eventDate) {
      return baseContent;
    }
    
    try {
      return applyVariantToContent(
        baseContent,
        selectedVariant,
        eventDate,
        form.eventName.trim() || "Event"
      );
    } catch {
      return baseContent;
    }
  };


  const handleStartNew = () => {
    setForm(defaultFormValues);
    setResult(null);
    setError(null);
    setGeneratedCampaign([]);
    setEditedCampaign(null);
    setEditingId(null);
    setEditText("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Event Campaign Builder"
      tagline="Turn your event details into a complete, ready-to-post promotional campaign in minutes."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      {/* Import Banner - Near top, above form sections */}
      {handoffPayload && (
        <EventCampaignImportBanner
          isDark={isDark}
          payload={handoffPayload}
          onApplyToInputs={handleApplyHandoff}
          onDismiss={handleDismissHandoff}
        />
      )}

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className={`space-y-4 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
            {/* Business Basics Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("businessBasics")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                Business Basics
                  </h3>
                  {!accordionState.businessBasics && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getBusinessBasicsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("businessBasics");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.businessBasics ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.businessBasics && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder="Ocala Coffee Shop"
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
                </div>

                <div>
                  <label
                    htmlFor="services"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Services
                  </label>
                  <textarea
                    id="services"
                    value={form.services}
                    onChange={(e) => updateFormValue("services", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Pressure washing, driveway cleaning, window cleaning"
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
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                    />
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Event Details Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("eventDetails")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                Event Details
                  </h3>
                  {!accordionState.eventDetails && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getEventDetailsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("eventDetails");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.eventDetails ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.eventDetails && (
                <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="eventName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Name *
                  </label>
                  <input
                    type="text"
                    id="eventName"
                    value={form.eventName}
                    onChange={(e) =>
                      updateFormValue("eventName", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Spring Open House"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="eventDate"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Event Date *
                    </label>
                    <input
                      type="text"
                      id="eventDate"
                      value={form.eventDate}
                      onChange={(e) =>
                        updateFormValue("eventDate", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="March 15, 2026"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="eventTime"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Event Time *
                    </label>
                    <input
                      type="text"
                      id="eventTime"
                      value={form.eventTime}
                      onChange={(e) =>
                        updateFormValue("eventTime", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="6:00 PM – 9:00 PM"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="eventLocation"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Location *
                  </label>
                  <input
                    type="text"
                    id="eventLocation"
                    value={form.eventLocation}
                    onChange={(e) =>
                      updateFormValue("eventLocation", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="123 Main St, Ocala, FL"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="eventType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Type
                  </label>
                  <select
                    id="eventType"
                    value={form.eventType}
                    onChange={(e) =>
                      updateFormValue("eventType", e.target.value as EventType)
                    }
                    className={getInputClasses(isDark)}
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "InPerson"
                          ? "In-Person"
                          : type === "Virtual"
                          ? "Virtual"
                          : "Hybrid"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="eventDescription"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Description *
                  </label>
                  <textarea
                    id="eventDescription"
                    value={form.eventDescription}
                    onChange={(e) =>
                      updateFormValue("eventDescription", e.target.value)
                    }
                    rows={5}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="What's happening at this event? What should attendees expect?"
                    required
                  />
                  <div className="flex items-center justify-end mt-1">
                    <p
                      className={`text-xs ${
                        form.eventDescription.length === 0
                          ? themeClasses.mutedText
                            : form.eventDescription.length > 600
                            ? "text-red-500"
                            : form.eventDescription.length > 540
                            ? "text-yellow-500"
                            : themeClasses.mutedText
                      }`}
                    >
                      {form.eventDescription.length} / 600 characters
                    </p>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Audience & Strategy Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("audienceStrategy")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Audience & Strategy
                  </h3>
                  {!accordionState.audienceStrategy && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getAudienceStrategySummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("audienceStrategy");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.audienceStrategy ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.audienceStrategy && (
                <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="audience"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Target Audience
                  </label>
                  <input
                    type="text"
                    id="audience"
                    value={form.audience}
                    onChange={(e) => updateFormValue("audience", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Local families, horse owners, small business owners"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mainGoal"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Main Goal
                  </label>
                  <select
                    id="mainGoal"
                    value={form.mainGoal}
                    onChange={(e) =>
                      updateFormValue("mainGoal", e.target.value as EventGoal)
                    }
                    className={getInputClasses(isDark)}
                  >
                    {EVENT_GOALS.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="budgetLevel"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Budget Level
                    </label>
                    <select
                      id="budgetLevel"
                      value={form.budgetLevel}
                      onChange={(e) =>
                        updateFormValue(
                          "budgetLevel",
                          e.target.value as "Free" | "Low" | "Moderate" | "Premium"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      {BUDGET_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
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
                      value={form.urgencyLevel}
                      onChange={(e) =>
                        updateFormValue(
                          "urgencyLevel",
                          e.target.value as "Normal" | "Last-Minute"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      {URGENCY_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level === "Last-Minute" ? "Last-Minute" : "Normal"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Brand & Style Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("brandStyle")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                Brand & Style
                  </h3>
                  {!accordionState.brandStyle && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getBrandStyleSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("brandStyle");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.brandStyle ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.brandStyle && (
                <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="brandVoice"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Brand Voice
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
                  <div className="flex items-center justify-end mt-1">
                    <p
                      className={`text-xs ${
                        form.brandVoice.length === 0
                          ? themeClasses.mutedText
                          : form.brandVoice.length <= 400
                          ? themeClasses.mutedText
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {form.brandVoice.length} / 400 characters
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      htmlFor="language"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Language
                    </label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(e) =>
                        updateFormValue(
                          "language",
                          e.target.value as LanguageOption
                        )
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
              )}
            </div>

            {/* Channels Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("channels")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                Channels
                  </h3>
                  {!accordionState.channels && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getChannelsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("channels");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.channels ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.channels && (
                <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Facebook */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeFacebook", !form.includeFacebook);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeFacebook
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Facebook Posts
                    </span>
                    {form.includeFacebook && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Great for community reach
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeFacebook}
                    onChange={(e) =>
                      updateFormValue("includeFacebook", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include Facebook posts"
                  />
                </label>

                {/* Instagram */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeInstagram", !form.includeInstagram);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeInstagram
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Instagram
                    </span>
                    {form.includeInstagram && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Feed posts & story ideas
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeInstagram}
                    onChange={(e) =>
                      updateFormValue("includeInstagram", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include Instagram content"
                  />
                </label>

                {/* X (Twitter) */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeX", !form.includeX);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeX
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      X (Twitter)
                    </span>
                    {form.includeX && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Concise, punchy posts
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeX}
                    onChange={(e) =>
                      updateFormValue("includeX", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include X (Twitter) posts"
                  />
                </label>

                {/* Google Business */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeGoogleBusiness", !form.includeGoogleBusiness);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeGoogleBusiness
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Google Business
                    </span>
                    {form.includeGoogleBusiness && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Local discovery posts
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeGoogleBusiness}
                    onChange={(e) =>
                      updateFormValue("includeGoogleBusiness", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include Google Business posts"
                  />
                </label>

                {/* Email */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeEmail", !form.includeEmail);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeEmail
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Email
                    </span>
                    {form.includeEmail && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Announcement email
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeEmail}
                    onChange={(e) =>
                      updateFormValue("includeEmail", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include email announcement"
                  />
                </label>

                {/* SMS */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeSms", !form.includeSms);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeSms
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      SMS Messages
                    </span>
                    {form.includeSms && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Short text blasts
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeSms}
                    onChange={(e) =>
                      updateFormValue("includeSms", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include SMS messages"
                  />
                </label>

                {/* Image Caption */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeImageCaption", !form.includeImageCaption);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeImageCaption
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Image Caption
                    </span>
                    {form.includeImageCaption && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Flyer or poster text
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeImageCaption}
                    onChange={(e) =>
                      updateFormValue("includeImageCaption", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include image caption"
                  />
                </label>
              </div>
                </div>
              )}
            </div>

            {/* Campaign Timing Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("campaignTiming")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Campaign Timing
                  </h3>
                  {!accordionState.campaignTiming && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getCampaignTimingSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("campaignTiming");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.campaignTiming ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.campaignTiming && (
                <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="campaignDurationDays"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Campaign Duration (Days)
                  </label>
                  <input
                    type="number"
                    id="campaignDurationDays"
                    min={3}
                    max={30}
                    value={form.campaignDurationDays}
                    onChange={(e) =>
                      updateFormValue(
                        "campaignDurationDays",
                        Math.max(3, Math.min(30, parseInt(e.target.value) || 10))
                      )
                    }
                    className={getInputClasses(isDark)}
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    How many days before the event should the campaign start? (3–30 days)
                  </p>
                  </div>
                </div>
              )}
                </div>

            {/* Advanced Notes Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("advancedNotes")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Advanced Notes
                  </h3>
                  {!accordionState.advancedNotes && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getAdvancedNotesSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("advancedNotes");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.advancedNotes ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.advancedNotes && (
                <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="notesForAI"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Additional Notes
                  </label>
                  <textarea
                    id="notesForAI"
                    value={form.notesForAI}
                    onChange={(e) =>
                      updateFormValue("notesForAI", e.target.value)
                    }
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Any special instructions, tone preferences, or context..."
                  />
                  <div className="flex items-center justify-end mt-1">
                    <p
                      className={`text-xs ${
                        form.notesForAI.length === 0
                          ? themeClasses.mutedText
                          : form.notesForAI.length <= 500
                          ? themeClasses.mutedText
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {form.notesForAI.length} / 500 characters
                    </p>
                  </div>
                </div>
              </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Campaign"
              )}
            </button>
          </div>
        </form>
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-[#29c4a9] border-[#29c4a9] text-white"
              : "bg-[#29c4a9] border-[#29c4a9] text-white"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Campaign generated</p>
              <p className="text-sm opacity-90">
                Your event campaign is ready. Review the cards below and copy anything you want to use.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {activeCampaign.length > 0 && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8" id="campaign-results">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Generated Campaign
            </OBDHeading>
          </div>

          {/* AI Help Desk Awareness Banner */}
          {showHelpDeskBanner && (
            <div
              className={`mb-6 rounded-lg border p-4 flex items-start justify-between gap-4 ${
                isDark
                  ? "bg-blue-900/20 border-blue-700"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                <svg
                  className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                    isDark ? "text-blue-300" : "text-blue-600"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      isDark ? "text-blue-300" : "text-blue-800"
                    }`}
                  >
                    This event can be answered by your AI Help Desk once published.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismissHelpDeskBanner}
                className={`flex-shrink-0 p-1 rounded transition-colors ${
                  isDark
                    ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                }`}
                aria-label="Dismiss"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="animate-spin h-8 w-8 text-[#29c4a9]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className={themeClasses.mutedText}>Generating campaign...</p>
                <p className={`text-xs ${themeClasses.mutedText}`}>
                  This usually takes 10-20 seconds
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Meta Info */}
              <div>
                <h3
                  className={`text-base font-semibold mb-3 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Campaign Overview
                </h3>
                <ResultCard
                  title=""
                  isDark={isDark}
                  copyText={`${primaryTagline?.content || ""}\n\n${primaryCallToAction?.content || ""}${recommendedStartDateNote?.content ? `\n\n${recommendedStartDateNote.content}` : ""}${timezoneNote?.content ? `\n\n${timezoneNote.content}` : ""}`}
                >
                  <div className="space-y-3">
                    {primaryTagline && (
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Primary Tagline
                      </p>
                      <p
                        className={`font-semibold text-lg ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                          {primaryTagline.content}
                      </p>
                    </div>
                    )}
                    {primaryCallToAction && (
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Primary Call to Action
                      </p>
                        <p className="font-medium">{primaryCallToAction.content}</p>
                    </div>
                    )}
                    {recommendedStartDateNote && (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Recommended Start Date
                        </p>
                        <p className="text-sm italic">
                          {recommendedStartDateNote.content}
                        </p>
                      </div>
                    )}
                    {timezoneNote && (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Timezone
                        </p>
                        <p className="text-sm">{timezoneNote.content}</p>
                      </div>
                    )}
                  </div>
                </ResultCard>
              </div>

              {/* Event Titles */}
              {eventTitles.length > 0 && (
                <div>
                  <ResultCard
                    title="Event Titles"
                    isDark={isDark}
                    copyText={eventTitles.map((item) => item.content).join("\n")}
                  >
                    <div className="space-y-2">
                      {eventTitles.map((item, idx) => (
                        <div key={item.id} className="p-2 rounded border border-slate-300 dark:border-slate-600">
                          <p className="font-medium">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Short Descriptions */}
              {shortDescriptions.length > 0 && (
                <div>
                  <ResultCard
                    title="Short Descriptions"
                    isDark={isDark}
                    copyText={shortDescriptions.map((item) => item.content).join("\n\n")}
                  >
                    <div className="space-y-3">
                      {shortDescriptions.map((item) => (
                        <p key={item.id} className="whitespace-pre-wrap">{item.content}</p>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Long Description */}
              {longDescription && (
                <div>
                  <ResultCard
                    title="Long Description"
                    isDark={isDark}
                    copyText={longDescription.content}
                  >
                    <p className="whitespace-pre-wrap">
                      {longDescription.content}
                    </p>
                  </ResultCard>
                </div>
              )}

              {/* Social Posts */}
              {(facebookPosts.length > 0 ||
                instagramCaptions.length > 0 ||
                xPosts.length > 0 ||
                googleBusinessPosts.length > 0) && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <div className="flex items-center justify-between mt-6 mb-4">
                    <h3
                      className={`text-base font-semibold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Social Media Posts
                    </h3>
                    {/* Variant Selector */}
                    {(xPosts.length > 0 || googleBusinessPosts.length > 0 || smsBlasts.length > 0) && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label
                          className={`text-sm font-medium ${
                            isDark ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          Countdown Variant:
                        </label>
                        <div className="relative group">
                          <select
                            value={selectedVariant}
                            onChange={(e) => handleVariantChange(e.target.value as CountdownVariant)}
                            disabled={isVariantLocked}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              isDark
                                ? "bg-slate-800 border-slate-600 text-white"
                                : "bg-white border-slate-300 text-slate-900"
                            } ${
                              isVariantLocked
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:border-[#29c4a9] cursor-pointer"
                            }`}
                            title={
                              isVariantLocked
                                ? "Variant switching is locked after editing to prevent content loss"
                                : undefined
                            }
                          >
                            <option value="7-days">7 days out</option>
                            <option value="3-days">3 days out</option>
                            <option value="day-of">Day-of</option>
                          </select>
                          {isVariantLocked && (
                            <div className="absolute -top-10 left-0 z-20 px-2 py-1 text-xs rounded bg-slate-900 text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                              Variant switching is locked after editing to prevent content loss
                            </div>
                          )}
                        </div>
                        {isVariantLocked && (
                          <button
                            onClick={handleResetAllEdits}
                            className={getSubtleButtonSmallClasses(isDark)}
                            title="Reset all edits to unlock variant switching"
                          >
                            Reset all edits
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {facebookPosts.map((item) => {
                      const itemId = item.id;
                      const isEditing = editingId === itemId;
                      const isEdited = isItemEdited(itemId);
                      const activeContent = isEditing ? editText : getActiveContent(itemId);
                      
                      if (isEditing) {
                        return (
                          <div
                            key={itemId}
                            className={`rounded-2xl border p-4 transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                                : "bg-white border-slate-200 hover:border-[#29c4a9]"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}>
                                  Facebook
                                </span>
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(itemId)}
                                  disabled={!editText.trim()}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                    !editText.trim()
                                      ? isDark
                                        ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                      : isDark
                                      ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                      : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                  }`}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={6}
                              className={getInputClasses(isDark, "resize-none w-full")}
                              placeholder="Enter Facebook post text..."
                            />
                            {!editText.trim() && (
                              <p className={`text-xs mt-2 ${isDark ? "text-red-400" : "text-red-600"}`}>
                                Content cannot be empty
                              </p>
                            )}
                          </div>
                        );
                      }
                      
                      return (
                      <ResultCard
                          key={itemId}
                        title="Facebook"
                        isDark={isDark}
                          copyText={activeContent}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="whitespace-pre-wrap flex-1">{activeContent}</p>
                            <div className="flex items-center gap-2 ml-2">
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                              <button
                                onClick={() => handleEdit(itemId)}
                                className={getSubtleButtonSmallClasses(isDark)}
                              >
                                Edit
                              </button>
                              {isEdited && (
                                <button
                                  onClick={() => handleResetItem(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                  title="Reset to generated version"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                      </ResultCard>
                      );
                    })}

                    {instagramCaptions.map((item) => {
                      const itemId = item.id;
                      const isEditing = editingId === itemId;
                      const isEdited = isItemEdited(itemId);
                      const activeContent = isEditing ? editText : getActiveContent(itemId);
                      
                      if (isEditing) {
                        return (
                          <div
                            key={itemId}
                            className={`rounded-2xl border p-4 transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                                : "bg-white border-slate-200 hover:border-[#29c4a9]"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}>
                                  Instagram Caption
                                </span>
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(itemId)}
                                  disabled={!editText.trim()}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                    !editText.trim()
                                      ? isDark
                                        ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                      : isDark
                                      ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                      : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                  }`}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={6}
                              className={getInputClasses(isDark, "resize-none w-full")}
                              placeholder="Enter Instagram caption text..."
                            />
                            {!editText.trim() && (
                              <p className={`text-xs mt-2 ${isDark ? "text-red-400" : "text-red-600"}`}>
                                Content cannot be empty
                              </p>
                            )}
                          </div>
                        );
                      }
                      
                      return (
                      <ResultCard
                          key={itemId}
                        title="Instagram Caption"
                        isDark={isDark}
                          copyText={activeContent}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="whitespace-pre-wrap flex-1">{activeContent}</p>
                            <div className="flex items-center gap-2 ml-2">
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                              <button
                                onClick={() => handleEdit(itemId)}
                                className={getSubtleButtonSmallClasses(isDark)}
                              >
                                Edit
                              </button>
                              {isEdited && (
                                <button
                                  onClick={() => handleResetItem(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                  title="Reset to generated version"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                      </ResultCard>
                      );
                    })}

                    {xPosts.map((item) => {
                      const itemId = item.id;
                      const isEditing = editingId === itemId;
                      const isEdited = isItemEdited(itemId);
                      const activeContent = isEditing ? editText : getVariantContent(item);
                      const charCount = activeContent.length;
                      const maxChars = 280;
                      const charCountClass =
                        charCount > maxChars
                          ? "text-red-500"
                          : charCount > maxChars * 0.9
                          ? "text-yellow-500"
                          : themeClasses.mutedText;
                      
                      if (isEditing) {
                        return (
                          <div
                            key={itemId}
                            className={`rounded-2xl border p-4 transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                                : "bg-white border-slate-200 hover:border-[#29c4a9]"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}>
                                  X (Twitter)
                                </span>
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(itemId)}
                                  disabled={!editText.trim()}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                    !editText.trim()
                                      ? isDark
                                        ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                      : isDark
                                      ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                      : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                  }`}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={6}
                              className={getInputClasses(isDark, "resize-none w-full")}
                              placeholder="Enter X (Twitter) post text..."
                            />
                            <div className="mt-2 flex items-center justify-between">
                              <p className={`text-xs ${charCountClass}`}>
                                {charCount} / {maxChars} characters
                              </p>
                              {!editText.trim() && (
                                <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                                  Content cannot be empty
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                      <ResultCard
                          key={itemId}
                        title="X (Twitter)"
                        isDark={isDark}
                          copyText={activeContent}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className={`text-sm mb-2 ${charCountClass}`}>
                                {charCount} / {maxChars} characters
                              </p>
                              <p className="whitespace-pre-wrap">{activeContent}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                              <button
                                onClick={() => handleEdit(itemId)}
                                className={getSubtleButtonSmallClasses(isDark)}
                              >
                                Edit
                              </button>
                              {isEdited && (
                                <button
                                  onClick={() => handleResetItem(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                  title="Reset to generated version"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                      </ResultCard>
                      );
                    })}

                    {googleBusinessPosts.map((item) => {
                      const itemId = item.id;
                      const isEditing = editingId === itemId;
                      const isEdited = isItemEdited(itemId);
                      const activeContent = isEditing ? editText : getVariantContent(item);
                      const charCount = activeContent.length;
                      const maxChars = 1500;
                      const charCountClass =
                        charCount > maxChars
                          ? "text-red-500"
                          : charCount > maxChars * 0.9
                          ? "text-yellow-500"
                          : themeClasses.mutedText;
                      
                      if (isEditing) {
                        return (
                          <div
                            key={itemId}
                            className={`rounded-2xl border p-4 transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                                : "bg-white border-slate-200 hover:border-[#29c4a9]"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-slate-700 text-slate-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}>
                                  Google Business Profile
                                </span>
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(itemId)}
                                  disabled={!editText.trim()}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                    !editText.trim()
                                      ? isDark
                                        ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                      : isDark
                                      ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                      : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                  }`}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={6}
                              className={getInputClasses(isDark, "resize-none w-full")}
                              placeholder="Enter Google Business post text..."
                            />
                            <div className="mt-2 flex items-center justify-between">
                              <p className={`text-xs ${charCountClass}`}>
                                {charCount} / {maxChars} characters
                              </p>
                              {!editText.trim() && (
                                <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                                  Content cannot be empty
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                      <ResultCard
                          key={itemId}
                        title="Google Business Profile"
                        isDark={isDark}
                          copyText={activeContent}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className={`text-sm mb-2 ${charCountClass}`}>
                                {charCount} / {maxChars} characters
                              </p>
                              <p className="whitespace-pre-wrap">{activeContent}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                              <button
                                onClick={() => handleEdit(itemId)}
                                className={getSubtleButtonSmallClasses(isDark)}
                              >
                                Edit
                              </button>
                              {isEdited && (
                                <button
                                  onClick={() => handleResetItem(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                  title="Reset to generated version"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                      </ResultCard>
                      );
                    })}
                  </div>

                  {/* Create Event Social Posts CTA */}
                  <div className="mt-6">
                    <OBDPanel isDark={isDark}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <h4 className={`text-base font-semibold mb-1 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}>
                            Ready to promote?
                          </h4>
                          <p className={`text-sm ${
                            isDark ? "text-slate-400" : "text-slate-600"
                          }`}>
                            Create social media posts for this event
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            try {
                              // Extract event details
                              const eventName = form.eventName.trim() || "Upcoming Event";
                              const eventDate = form.eventDate.trim() || "";
                              const location = form.eventLocation.trim() || "";
                              const description = longDescription?.content || 
                                               shortDescriptions[0]?.content || 
                                               form.eventDescription.trim() || 
                                               "";

                              // Generate countdown variants using simple date math
                              const generateCountdownVariants = (eventDateStr: string): string[] => {
                                const variants: string[] = [];
                                try {
                                  const eventDateObj = new Date(eventDateStr);
                                  const now = new Date();
                                  const diffTime = eventDateObj.getTime() - now.getTime();
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  
                                  const eventDayOfWeek = eventDateObj.getDay(); // 0 = Sunday, 6 = Saturday
                                  const isWeekend = eventDayOfWeek === 0 || eventDayOfWeek === 6;
                                  const isWithin5Days = diffDays >= 0 && diffDays <= 5;

                                  // Generate variants based on requirements
                                  if (diffDays === 1) {
                                    variants.push("Happening tomorrow!");
                                  } else if (diffDays >= 2 && diffDays <= 6) {
                                    variants.push(`${diffDays} days to go!`);
                                  } else if (diffDays >= 7 && diffDays <= 9) {
                                    variants.push("Next week!");
                                  } else if (diffDays >= 10) {
                                    variants.push("Save the date!");
                                  }

                                  // Include "This weekend!" if event falls on Sat/Sun or within 5 days
                                  if ((isWeekend || isWithin5Days) && !variants.includes("This weekend!")) {
                                    variants.push("This weekend!");
                                  }

                                  // Ensure we have 2-5 variants
                                  if (variants.length === 0) {
                                    variants.push("Save the date!");
                                    variants.push("This weekend!");
                                  } else if (variants.length === 1) {
                                    // Add one more variant
                                    if (diffDays >= 2 && diffDays <= 6) {
                                      variants.push("This weekend!");
                                    } else {
                                      variants.push(`${diffDays} days to go!`);
                                    }
                                  }
                                } catch {
                                  // Fallback if date parsing fails
                                  variants.push("Save the date!");
                                  variants.push("This weekend!");
                                }
                                
                                return variants.slice(0, 5); // Ensure max 5 variants
                              };

                              const countdownVariants = generateCountdownVariants(eventDate);
                              const firstVariant = countdownVariants[0] || "Save the date!";

                              // Build text: first variant + eventName + date/location + description
                              const text = `${firstVariant}\n\n${eventName}\n${eventDate}${location ? " • " + location : ""}\n\n${description}`;

                              // Build canonical handoff payload
                              const payload = {
                                v: 1,
                                source: "event-campaign-builder",
                                campaignType: "event",
                                createdAt: new Date().toISOString(),
                                eventName,
                                eventDate,
                                location,
                                description,
                                countdownVariants: countdownVariants,
                                text: text,
                              };

                              // Save to sessionStorage using standardized transport
                              writeHandoff("event-campaign-builder", payload);

                              // Open new tab to composer
                              window.open("/apps/social-auto-poster/composer?handoff=1", "_blank");

                              // Show toast
                              showToast("Sent to Social Auto-Poster composer");
                            } catch (error) {
                              console.error("Failed to create social posts:", error);
                              showToast("Failed to create social posts. Please try again.");
                            }
                          }}
                          className={SUBMIT_BUTTON_CLASSES}
                        >
                          Create Event Social Posts
                        </button>
                      </div>
                    </OBDPanel>
                  </div>
                </div>
              )}

              {/* Instagram Story Ideas */}
              {instagramStories.length > 0 && (
                <div>
                  <ResultCard
                    title="Instagram Stories"
                    isDark={isDark}
                    copyText={instagramStories.map((item) => item.content).join("\n\n")}
                  >
                    <div className="space-y-3">
                      {instagramStories.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <p className="whitespace-pre-wrap">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Email Announcement */}
              {emailItems.length > 0 && (
                <div>
                  {(() => {
                    const subjectItem = emailItems.find((i) => i.type === "asset-emailSubject");
                    const previewItem = emailItems.find((i) => i.type === "asset-emailPreviewText");
                    const bodyItem = emailItems.find((i) => i.type === "asset-emailBodyText");
                    const bodyHtmlItem = emailItems.find((i) => i.type === "asset-emailBodyHtml");
                    const copyText = `Subject: ${subjectItem?.content || ""}\n\nPreview: ${previewItem?.content || ""}\n\n${bodyItem?.content || ""}`;
                    return (
                  <ResultCard
                    title="Email Announcement"
                    isDark={isDark}
                    copyText={copyText}
                  >
                    <div className="space-y-4">
                      {/* Subject */}
                      {(() => {
                        const subjectItem = emailItems.find((i) => i.type === "asset-emailSubject");
                        if (!subjectItem) return null;
                        const itemId = subjectItem.id;
                        const isEditing = editingId === itemId;
                        const isEdited = isItemEdited(itemId);
                        const activeContent = isEditing ? editText : getActiveContent(itemId);
                        
                        if (isEditing) {
                          return (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Subject
                        </p>
                              <div className="flex items-start gap-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={2}
                                  className={getInputClasses(isDark, "resize-none flex-1")}
                                  placeholder="Enter email subject..."
                                />
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(itemId)}
                                    disabled={!editText.trim()}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                      !editText.trim()
                                        ? isDark
                                          ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : isDark
                                        ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                        : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                  >
                                    Cancel
                                  </button>
                      </div>
                              </div>
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded mt-2 inline-block ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                            </div>
                          );
                        }
                        
                        return (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Subject
                              </p>
                              <div className="flex items-center gap-2">
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                                <button
                                  onClick={() => handleEdit(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Edit
                                </button>
                                {isEdited && (
                                  <button
                                    onClick={() => handleResetItem(itemId)}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                    title="Reset to generated version"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                            <p>{activeContent}</p>
                          </div>
                        );
                      })()}
                      
                      {/* Preview Text */}
                      {(() => {
                        const previewItem = emailItems.find((i) => i.type === "asset-emailPreviewText");
                        if (!previewItem) return null;
                        const itemId = previewItem.id;
                        const isEditing = editingId === itemId;
                        const isEdited = isItemEdited(itemId);
                        const activeContent = isEditing ? editText : getActiveContent(itemId);
                        
                        if (isEditing) {
                          return (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Preview Text
                        </p>
                              <div className="flex items-start gap-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={2}
                                  className={getInputClasses(isDark, "resize-none flex-1")}
                                  placeholder="Enter email preview text..."
                                />
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(itemId)}
                                    disabled={!editText.trim()}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                      !editText.trim()
                                        ? isDark
                                          ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : isDark
                                        ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                        : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded mt-2 inline-block ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                            </div>
                          );
                        }
                        
                        return (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Preview Text
                              </p>
                              <div className="flex items-center gap-2">
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                                <button
                                  onClick={() => handleEdit(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Edit
                                </button>
                                {isEdited && (
                                  <button
                                    onClick={() => handleResetItem(itemId)}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                    title="Reset to generated version"
                                  >
                                    Reset
                                  </button>
                                )}
                      </div>
                            </div>
                            <p className="text-sm italic">{activeContent}</p>
                          </div>
                        );
                      })()}
                      
                      {/* Body Text */}
                      {(() => {
                        const bodyItem = emailItems.find((i) => i.type === "asset-emailBodyText");
                        if (!bodyItem) return null;
                        const itemId = bodyItem.id;
                        const isEditing = editingId === itemId;
                        const isEdited = isItemEdited(itemId);
                        const activeContent = isEditing ? editText : getActiveContent(itemId);
                        
                        if (isEditing) {
                          return (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Body (Text)
                        </p>
                              <div className="flex items-start gap-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={8}
                                  className={getInputClasses(isDark, "resize-none flex-1")}
                                  placeholder="Enter email body text..."
                                />
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(itemId)}
                                    disabled={!editText.trim()}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                      !editText.trim()
                                        ? isDark
                                          ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : isDark
                                        ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                        : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded mt-2 inline-block ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                            </div>
                          );
                        }
                        
                        return (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <p
                                className={`text-xs font-semibold uppercase tracking-wide ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Body (Text)
                              </p>
                              <div className="flex items-center gap-2">
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                                <button
                                  onClick={() => handleEdit(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Edit
                                </button>
                                {isEdited && (
                                  <button
                                    onClick={() => handleResetItem(itemId)}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                    title="Reset to generated version"
                                  >
                                    Reset
                                  </button>
                                )}
                      </div>
                            </div>
                            <p className="whitespace-pre-wrap">{activeContent}</p>
                          </div>
                        );
                      })()}
                      
                      {/* Body HTML */}
                      {bodyHtmlItem && (
                        <div>
                          <p
                            className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                              isDark ? "text-slate-400" : "text-slate-500"
                            }`}
                          >
                            Body (HTML)
                          </p>
                          <div
                            className="p-3 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            dangerouslySetInnerHTML={{
                              __html: bodyHtmlItem.content,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </ResultCard>
                    );
                  })()}
                </div>
              )}

              {/* SMS Blasts */}
              {smsBlasts.length > 0 && (
                <div>
                  <ResultCard
                    title="SMS Messages"
                    isDark={isDark}
                    copyText={smsBlasts.map((item) => item.content).join("\n\n")}
                  >
                    <div className="space-y-3">
                      {smsBlasts.map((item) => {
                        const itemId = item.id;
                        const isEditing = editingId === itemId;
                        const isEdited = isItemEdited(itemId);
                        const activeContent = isEditing ? editText : getVariantContent(item);
                        const charCount = activeContent.length;
                        const maxChars = 160;
                        const charCountClass =
                          charCount > maxChars
                            ? "text-red-500"
                            : charCount > maxChars * 0.9
                            ? "text-yellow-500"
                            : themeClasses.mutedText;
                        
                        if (isEditing) {
                          return (
                            <div
                              key={itemId}
                              className={`p-3 rounded border ${
                                isDark
                                  ? "border-slate-600 bg-slate-800/50"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  {isEdited && (
                                    <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                      isDark
                                        ? "bg-yellow-900/50 text-yellow-300"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}>
                                      Edited
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(itemId)}
                                    disabled={!editText.trim()}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                      !editText.trim()
                                        ? isDark
                                          ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : isDark
                                        ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                        : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={4}
                                className={getInputClasses(isDark, "resize-none w-full")}
                                placeholder="Enter SMS message text..."
                              />
                              <div className="mt-2 flex items-center justify-between">
                                <p className={`text-sm ${charCountClass}`}>
                                  {charCount} / {maxChars} characters
                                </p>
                                {!editText.trim() && (
                                  <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                                    Content cannot be empty
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={itemId}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className={`text-sm mb-2 ${charCountClass}`}>
                                  {charCount} / {maxChars} characters
                                </p>
                                <p className="whitespace-pre-wrap">{activeContent}</p>
                        </div>
                              <div className="flex items-center gap-2 ml-2">
                                {isEdited && (
                                  <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                    isDark
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    Edited
                                  </span>
                                )}
                                <button
                                  onClick={() => handleEdit(itemId)}
                                  className={getSubtleButtonSmallClasses(isDark)}
                                >
                                  Edit
                                </button>
                                {isEdited && (
                                  <button
                                    onClick={() => handleResetItem(itemId)}
                                    className={getSubtleButtonSmallClasses(isDark)}
                                    title="Reset to generated version"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Image Caption */}
              {imageCaption && (
                <div>
                  {(() => {
                    const itemId = imageCaption.id;
                    const isEditing = editingId === itemId;
                    const isEdited = isItemEdited(itemId);
                    const activeContent = isEditing ? editText : getActiveContent(itemId);
                    
                    if (isEditing) {
                      return (
                        <div
                          className={`rounded-2xl border p-4 transition-colors ${
                            isDark
                              ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                              : "bg-white border-slate-200 hover:border-[#29c4a9]"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                isDark
                                  ? "bg-slate-700 text-slate-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}>
                                Image Caption
                              </span>
                              {isEdited && (
                                <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                  isDark
                                    ? "bg-yellow-900/50 text-yellow-300"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  Edited
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(itemId)}
                                disabled={!editText.trim()}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  !editText.trim()
                                    ? isDark
                                      ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                    : "bg-[#29c4a9] text-white hover:bg-[#24b39a]"
                                }`}
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className={getSubtleButtonSmallClasses(isDark)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={6}
                            className={getInputClasses(isDark, "resize-none w-full")}
                            placeholder="Enter image caption text..."
                          />
                          {!editText.trim() && (
                            <p className={`text-xs mt-2 ${isDark ? "text-red-400" : "text-red-600"}`}>
                              Content cannot be empty
                            </p>
                          )}
                        </div>
                      );
                    }
                    
                    return (
                  <ResultCard
                    title="Image Caption"
                    isDark={isDark}
                        copyText={activeContent}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="whitespace-pre-wrap flex-1">{activeContent}</p>
                          <div className="flex items-center gap-2 ml-2">
                            {isEdited && (
                              <span className={`text-xs uppercase font-medium px-2 py-1 rounded ${
                                isDark
                                  ? "bg-yellow-900/50 text-yellow-300"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}>
                                Edited
                              </span>
                            )}
                            <button
                              onClick={() => handleEdit(itemId)}
                              className={getSubtleButtonSmallClasses(isDark)}
                            >
                              Edit
                            </button>
                            {isEdited && (
                              <button
                                onClick={() => handleResetItem(itemId)}
                                className={getSubtleButtonSmallClasses(isDark)}
                                title="Reset to generated version"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                  </ResultCard>
                    );
                  })()}
                </div>
              )}

              {/* Turn into Landing Page CTA */}
              {activeCampaign.length > 0 && (
                <div className="mt-8">
                  <OBDPanel isDark={isDark}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h4 className={`text-base font-semibold mb-1 ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}>
                          Ready to create a landing page?
                        </h4>
                        <p className={`text-sm ${
                          isDark ? "text-slate-400" : "text-slate-600"
                        }`}>
                          Turn this event into a landing page with AI Content Writer
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          try {
                            // Build event facts
                            const eventFacts = {
                              eventName: form.eventName.trim() || "Upcoming Event",
                              eventDate: form.eventDate.trim() || "",
                              eventTime: form.eventTime.trim() || "",
                              eventLocation: form.eventLocation.trim() || "",
                              eventType: form.eventType,
                              businessName: form.businessName.trim() || "",
                              businessType: form.businessType.trim() || "",
                              city: form.city.trim() || "",
                              state: form.state.trim() || "",
                            };

                            // Build description from long description or short descriptions
                            const description = longDescription?.content || 
                                             shortDescriptions[0]?.content || 
                                             form.eventDescription.trim() || 
                                             "";

                            // Build agenda bullets from schedule ideas
                            const agendaBullets: string[] = [];
                            if (scheduleIdeas.length > 0) {
                              scheduleIdeas.forEach((item) => {
                                const idea = item.metadata as { label: string; channel: string } | undefined;
                                agendaBullets.push(`${idea?.label || ""}: ${item.content}`);
                              });
                            }

                            // Build CTA from meta
                            const cta = primaryCallToAction?.content || 
                                       primaryTagline?.content || 
                                       "Join us!";

                            // Build FAQ seeds (parking, RSVP, timing)
                            const faqSeeds: string[] = [];
                            if (eventFacts.eventLocation) {
                              faqSeeds.push("Where can I park?");
                            }
                            if (form.mainGoal === "RSVPs" || form.mainGoal === "TicketSales") {
                              faqSeeds.push("How do I RSVP or register?");
                            }
                            if (eventFacts.eventDate || eventFacts.eventTime) {
                              faqSeeds.push("What time does the event start?");
                            }
                            if (eventFacts.eventDate) {
                              faqSeeds.push("What is the event date?");
                            }

                            // Build handoff payload
                            const payload = {
                              v: 1,
                              source: "event-campaign-builder-to-content-writer",
                              createdAt: new Date().toISOString(),
                              sourceApp: "event-campaign-builder",
                              intent: "landing-page",
                              eventFacts,
                              description,
                              agendaBullets,
                              cta,
                              faqSeeds,
                            };

                            // Save to sessionStorage using standardized transport
                            writeHandoff("event-campaign-builder-to-content-writer", payload);

                            // Open new tab to Content Writer
                            window.open("/apps/content-writer?handoff=1", "_blank");

                            // Show toast
                            showToast("Sent to AI Content Writer");
                          } catch (error) {
                            console.error("Failed to send to AI Content Writer:", error);
                            showToast("Failed to send to AI Content Writer. Please try again.");
                          }
                        }}
                        className={SUBMIT_BUTTON_CLASSES}
                      >
                        Turn this event into a landing page
                      </button>
                    </div>
                  </OBDPanel>
                </div>
              )}

              {/* Generate Image Captions CTA */}
              {activeCampaign.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <OBDPanel isDark={isDark} className="mt-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h4 className={`text-base font-semibold mb-1 ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}>
                          Ready to create image captions?
                        </h4>
                        <p className={`text-sm ${
                          isDark ? "text-slate-400" : "text-slate-600"
                        }`}>
                          Generate image captions for this event
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          try {
                            // Build event facts
                            const eventFacts = {
                              eventName: form.eventName.trim() || "Upcoming Event",
                              eventDate: form.eventDate.trim() || "",
                              eventTime: form.eventTime.trim() || "",
                              eventLocation: form.eventLocation.trim() || "",
                              eventType: form.eventType,
                              businessName: form.businessName.trim() || "",
                              businessType: form.businessType.trim() || "",
                              city: form.city.trim() || "",
                              state: form.state.trim() || "",
                            };

                            // Build description from long description or short descriptions
                            const description = longDescription?.content || 
                                             shortDescriptions[0]?.content || 
                                             form.eventDescription.trim() || 
                                             "";

                            // Extract tone/urgency from form
                            const tone = form.brandVoice.trim() || form.personalityStyle || undefined;
                            const urgencyLevel = form.urgencyLevel || undefined;

                            // Extract hashtags from hashtag bundles (prefer Generic or first available)
                            const hashtags: string[] = [];
                            if (hashtagBundles.length > 0) {
                              // Prefer Generic bundle, otherwise use first
                              const genericBundle = hashtagBundles.find(
                                (b) => (b.metadata as { platform?: string })?.platform === "Generic"
                              );
                              const bundleToUse = genericBundle || hashtagBundles[0];
                              const bundleMeta = bundleToUse.metadata as { tags?: string[] } | undefined;
                              if (bundleMeta?.tags && Array.isArray(bundleMeta.tags)) {
                                hashtags.push(...bundleMeta.tags);
                              }
                            }

                            // Build handoff payload
                            const payload = {
                              v: 1,
                              source: "event-campaign-builder-to-image-caption-generator",
                              createdAt: new Date().toISOString(),
                              sourceApp: "event-campaign-builder" as const,
                              intent: "image-captions" as const,
                              eventFacts,
                              description,
                              ...(tone && { tone }),
                              ...(urgencyLevel && { urgencyLevel }),
                              ...(hashtags.length > 0 && { hashtags }),
                            };

                            // Save to sessionStorage using standardized transport
                            writeHandoff("event-campaign-builder-to-image-caption-generator", payload);

                            // Open new tab to Image Caption Generator
                            window.open("/apps/image-caption-generator?handoff=1", "_blank");

                            // Show toast
                            showToast("Sent to AI Image Caption Generator");
                          } catch (error) {
                            console.error("Failed to send to AI Image Caption Generator:", error);
                            showToast("Failed to send to AI Image Caption Generator. Please try again.");
                          }
                        }}
                        className={SUBMIT_BUTTON_CLASSES}
                      >
                        Generate image captions for this event
                      </button>
                    </div>
                  </OBDPanel>
                </div>
              )}

              {/* Hashtag Bundles */}
              {hashtagBundles.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Hashtag Bundles
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hashtagBundles.map((item) => {
                      const bundle = item.metadata as { platform: string; tags: string[] } | undefined;
                      const tags = bundle?.tags || item.content.split(" ").filter(Boolean);
                      return (
                      <ResultCard
                        key={item.id}
                        title={`${bundle?.platform || "Generic"} Hashtags`}
                        isDark={isDark}
                        copyText={item.content}
                      >
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className={`px-2 py-1 rounded text-xs ${
                                isDark
                                  ? "bg-slate-700 text-slate-200"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </ResultCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Schedule Ideas */}
              {scheduleIdeas.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Posting Schedule
                  </h3>
                  <ResultCard title="" isDark={isDark}>
                    <div className="space-y-4">
                      {scheduleIdeas.map((item) => {
                        const idea = item.metadata as { dayOffset: number; label: string; channel: string } | undefined;
                        return (
                        <div
                          key={item.id}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {idea?.label || ""}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                isDark
                                  ? "bg-slate-700 text-slate-200"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {idea?.channel || ""}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{item.content}</p>
                        </div>
                        );
                      })}
                    </div>
                  </ResultCard>
                </div>
              )}
            </div>
          )}
        </OBDPanel>
      )}

      {activeCampaign.length === 0 && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">📅</div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Ready to create your event campaign?
            </h3>
            <p className={themeClasses.mutedText}>
              Fill out the form above and click Generate Campaign to create your
              multi-channel promotional campaign.
            </p>
          </div>
        </OBDPanel>
      )}

      {/* Sticky Action Bar */}
      <OBDStickyActionBar
        isDark={isDark}
        left={
          campaignStatus !== "Draft" ? (
            <span
              className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${
                campaignStatus === "Edited"
                  ? isDark
                    ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700/50"
                    : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                  : isDark
                  ? "bg-slate-700 text-slate-200"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {campaignStatus}
            </span>
          ) : undefined
        }
      >
        {/* Primary Button: Generate Campaign */}
              <button
          onClick={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
                disabled={loading}
          className={SUBMIT_BUTTON_CLASSES}
          title={
            loading
              ? "Generating campaign..."
              : !form.businessName.trim() || !form.businessType.trim() || !form.eventName.trim() || !form.eventDescription.trim() || !form.eventDate.trim() || !form.eventTime.trim() || !form.eventLocation.trim()
              ? "Please fill in all required fields"
              : !form.includeFacebook && !form.includeInstagram && !form.includeX && !form.includeGoogleBusiness && !form.includeEmail && !form.includeSms
              ? "Please select at least one channel"
              : "Generate your event campaign"
          }
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Generating...
            </span>
          ) : (
            "Generate Campaign"
          )}
              </button>

        {/* Reset Button */}
              <button
                onClick={handleStartNew}
          disabled={loading}
          className={getSecondaryButtonClasses(isDark)}
          title={loading ? "Please wait for generation to complete" : "Reset form and start a new campaign"}
        >
          Reset
              </button>

        {/* Export / Next Steps Button */}
        <button
          onClick={() => {
            if (activeCampaign.length > 0) {
              // Scroll to results section
              const resultsElement = document.getElementById("campaign-results");
              if (resultsElement) {
                resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }
          }}
          disabled={activeCampaign.length === 0 || loading}
          className={getSecondaryButtonClasses(isDark)}
          title={
            activeCampaign.length === 0
              ? "Generate a campaign to view export options"
              : loading
              ? "Please wait for generation to complete"
              : "View campaign results and export options"
          }
        >
          Export / Next Steps
        </button>
      </OBDStickyActionBar>
    </OBDPageContainer>
  );
}

export default function EventCampaignBuilderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EventCampaignBuilderPageContent />
    </Suspense>
  );
}
