"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import { isValidReturnUrl } from "@/lib/utils/crm-integration-helpers";
import { CrmIntegrationIndicator } from "@/components/crm/CrmIntegrationIndicator";
import { getMetaPublishingBannerMessage, isMetaPublishingEnabled } from "@/lib/apps/social-auto-poster/metaConnectionStatus";
import { getConnectionUIModel } from "@/lib/apps/social-auto-poster/connection/connectionState";
import { parseSocialAutoPosterHandoff, normalizePlatform, type SocialAutoPosterHandoffPayload } from "@/lib/apps/social-auto-poster/handoff-parser";
import { parseSocialHandoff } from "@/lib/apps/social-auto-poster/handoff/parseSocialHandoff";
import { clearHandoff, readHandoff } from "@/lib/obd-framework/social-handoff-transport";
import { getSourceDisplayName, type SocialComposerHandoffPayload } from "@/lib/apps/social-auto-poster/handoff/socialHandoffTypes";
import PopularCustomerQuestionsPanel from "./components/PopularCustomerQuestionsPanel";
import { flags } from "@/lib/flags";
import ConnectionStatusBadge from "@/components/obd/ConnectionStatusBadge";
import SessionCallout from "../ui/SessionCallout";
import { DISMISS_KEYS } from "@/lib/apps/social-auto-poster/ui/dismissKeys";
import {
  getHandoffHash,
  wasHandoffAlreadyImported,
  markHandoffImported,
} from "@/lib/utils/handoff-guard";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";
// Note: computeContentFingerprint is server-only, so we use a simple client-side duplicate check
import OBDToast from "@/components/obd/OBDToast";
import type {
  GeneratePostsRequest,
  GeneratePostsResponse,
  SocialPostPreview,
  SocialPostDraft,
  SocialPlatform,
  ContentPillar,
} from "@/lib/apps/social-auto-poster/types";

const PLATFORMS: Array<{ value: SocialPlatform; label: string; maxChars: number }> = [
  { value: "facebook", label: "Facebook", maxChars: 5000 },
  { value: "instagram", label: "Instagram", maxChars: 2200 },
  { value: "x", label: "X (Twitter)", maxChars: 280 },
  { value: "googleBusiness", label: "Google Business", maxChars: 1500 },
];

function SocialAutoPosterComposerPageContent() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  // CRM integration state
  const [crmContextLoaded, setCrmContextLoaded] = useState(false);
  const [crmReturnUrl, setCrmReturnUrl] = useState<string | null>(null);
  const crmPrefillApplied = useRef(false);

  // Helper: Generate starter text based on intent
  const generateStarterText = (intent: string, contactName: string, lastNote?: string, lastActivity?: string): string => {
    const context = lastNote || lastActivity || "";
    const contextSnippet = context.length > 100 ? context.substring(0, 100) + "..." : context;

    switch (intent) {
      case "Follow-up":
        return context
          ? `Quick follow-up with ${contactName} — here's what we discussed: ${contextSnippet}`
          : `Quick follow-up with ${contactName} — here's what we discussed...`;
      case "Thank-you":
        return `Huge thanks to ${contactName} for supporting us!`;
      case "Testimonial ask":
        return `We love serving our customers — would you leave us a quick review, ${contactName}?`;
      case "Promo mention":
        return `Special offer this week — message us to claim it, ${contactName}!`;
      default:
        return `Post about ${contactName}`;
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<SocialPostPreview[]>([]);
  const [variants, setVariants] = useState<Record<SocialPlatform, SocialPostDraft[]>>({} as Record<SocialPlatform, SocialPostDraft[]>);
  const [selectedVariants, setSelectedVariants] = useState<Record<SocialPlatform, number>>({} as Record<SocialPlatform, number>);
  const defaultsInitialized = useRef(false);

  const [formData, setFormData] = useState<GeneratePostsRequest>({
    businessName: "",
    businessType: "",
    topic: "",
    details: "",
    brandVoice: "",
    platforms: [],
    postLength: "Medium",
    campaignType: "Everyday Post",
    pillarOverride: undefined,
    regenerateHashtags: false,
  });
  const [settings, setSettings] = useState<{
    enabledPlatforms?: SocialPlatform[];
    brandVoice?: string;
    useBrandKit?: boolean;
    postingMode?: "review" | "auto" | "campaign";
    contentPillarSettings?: { contentPillarMode?: string; defaultPillar?: string };
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    errorCode?: string;
    errorMessage?: string;
    facebook?: {
      connected?: boolean;
      pagesAccessGranted?: boolean;
    };
    publishing?: {
      enabled?: boolean;
      reasonIfDisabled?: string;
    };
  } | null>(null);

  // Handoff state
  const [handoffPayload, setHandoffPayload] = useState<SocialAutoPosterHandoffPayload | null>(null);
  const [handoffHash, setHandoffHash] = useState<string | null>(null);
  const [handoffId, setHandoffId] = useState<string | null>(null); // Track handoffId for localStorage cleanup
  const [handoffImporting, setHandoffImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [handoffImportCompleted, setHandoffImportCompleted] = useState(false);
  const handoffProcessed = useRef(false);
  const setupLoaded = useRef(false);
  
  // Local Hiring Assistant handoff (draft-only, apply-on-click; additive-only)
  type LocalHiringAssistantDraftHandoff = {
    type: "social_auto_poster_import";
    sourceApp: "offers-builder";
    campaignType: "offer";
    headline?: string;
    description?: string;
    draftId?: string;
    businessId?: string;
  };

  const [lhaDraftHandoff, setLhaDraftHandoff] = useState<LocalHiringAssistantDraftHandoff | null>(null);

  const isLocalHiringAssistantHandoff = (payload: unknown): payload is LocalHiringAssistantDraftHandoff => {
    if (!payload || typeof payload !== "object") return false;
    const p = payload as Record<string, unknown>;
    if (p.type !== "social_auto_poster_import") return false;
    if (p.sourceApp !== "offers-builder") return false;
    if (p.campaignType !== "offer") return false;
    // Marker fields added by Local Hiring Assistant
    if (typeof p.draftId !== "string" || (p.draftId as string).trim().length === 0) return false;
    // businessId may be missing; keep banner safe (Apply disabled) when context is incomplete.
    if (p.businessId !== undefined && typeof p.businessId !== "string") return false;
    return true;
  };

  // Event countdown variant state
  const [selectedCountdownIndex, setSelectedCountdownIndex] = useState(0);

  // Canonical handoff state
  const [canonicalHandoff, setCanonicalHandoff] = useState<SocialComposerHandoffPayload | null>(null);
  const canonicalHandoffProcessed = useRef(false);
  const originalImportedText = useRef<string | null>(null); // Store original imported text for variant switching
  const [handoffExpired, setHandoffExpired] = useState(false);

  // Handoff imports must run before setup gating (review-first ingestion)
  // Step A: Parse handoff payload (URL + localStorage fallback) - runs first
  // Checks URL param first, then localStorage if missing or too long
  useEffect(() => {
    if (typeof window === "undefined" || handoffProcessed.current) {
      return;
    }

    if (searchParams) {
      try {
        // Special-case: Local Hiring Assistant draft handoff
        // Must NOT auto-apply; show an Apply/Dismiss banner instead.
        const handoffResult = readHandoff();
        if (handoffResult.envelope?.source === "local-hiring-assistant") {
          const payload = handoffResult.envelope.payload;
          if (isLocalHiringAssistantHandoff(payload)) {
            setLhaDraftHandoff(payload);
            handoffProcessed.current = true;
            // Allow setup to load (no import run yet)
            setHandoffImportCompleted(true);
            return;
          }
        }

        // Track handoffId if present (for localStorage fallback cleanup)
        const handoffIdParam = searchParams.get("handoffId");
        if (handoffIdParam) {
          setHandoffId(handoffIdParam);
        }

        const payload = parseSocialAutoPosterHandoff(searchParams);
        if (payload) {
          const hash = getHandoffHash(payload);
          setHandoffPayload(payload);
          setHandoffHash(hash);
          handoffProcessed.current = true;
          // Don't mark as completed yet - wait for import to finish
        } else {
          // No handoff found - mark as completed to trigger setup loading
          handoffProcessed.current = true;
          setHandoffImportCompleted(true);
        }
      } catch (error) {
        console.error("Failed to parse handoff payload:", error);
        // On error, mark as completed to allow setup to proceed
        handoffProcessed.current = true;
        setHandoffImportCompleted(true);
      }
    } else {
      // No searchParams - no handoff, trigger setup immediately
      handoffProcessed.current = true;
      setHandoffImportCompleted(true);
    }
  }, [searchParams]);

  // Step F: Load settings AFTER handoff import completes (or immediately if no handoff)
  useEffect(() => {
    // Wait for handoff import to complete, or load immediately if no handoff
    if (handoffImportCompleted && !setupLoaded.current) {
      setupLoaded.current = true;
      loadSettings();
    }
  }, [handoffImportCompleted]);

  // Canonical handoff handler - runs after settings are loaded
  useEffect(() => {
    // If Local Hiring Assistant handoff is present, do not run canonical parser (it would clear unknown payloads).
    if (lhaDraftHandoff) {
      return;
    }

    if (typeof window === "undefined" || canonicalHandoffProcessed.current || !settings) {
      return;
    }

    // Only process once
    canonicalHandoffProcessed.current = true;

    // Parse canonical handoff
    const result = parseSocialHandoff(searchParams);
    
    if (result.error) {
      // Handle expired handoffs with user-friendly banner
      if (result.error === "expired") {
        setHandoffExpired(true);
        return;
      }
      // Silently handle other errors - don't block user
      console.warn("Handoff parse error:", result.error);
      return;
    }

      if (result.payload) {
      // Store payload for banner display
      setCanonicalHandoff(result.payload);
      
      // Initialize countdown variant index if variants exist
      if (result.payload.countdownVariants && result.payload.countdownVariants.length > 0) {
        setSelectedCountdownIndex(0);
      }

      // For events, set posting mode UI to Campaign (do NOT save)
      if (result.payload.campaignType === "event") {
        setSettings((prev) => ({
          ...prev,
          postingMode: "campaign",
        }));
      }

      // Prefill composer ONLY if editor is empty
      const currentTopic = formData.topic?.trim() || "";
      const currentDetails = formData.details?.trim() || "";
      
      if (!currentTopic && !currentDetails) {
        // Build text from payload
        let textToInsert = "";
        
        if (result.payload.text) {
          // Use direct text if provided
          textToInsert = result.payload.text;
        } else {
          // Build from structured fields
          const parts: string[] = [];
          
          if (result.payload.headline) {
            parts.push(result.payload.headline);
          }
          
          if (result.payload.description) {
            parts.push(result.payload.description);
          }
          
          if (result.payload.campaignType === "offer" && result.payload.expirationDate) {
            parts.push(`Offer expires: ${result.payload.expirationDate}`);
          }
          
          if (result.payload.campaignType === "event") {
            // For events, use first countdown variant if available
            const firstVariant = result.payload.countdownVariants?.[0];
            if (firstVariant) {
              parts.push(firstVariant);
            }
            
            const eventParts: string[] = [];
            if (result.payload.eventName) eventParts.push(result.payload.eventName);
            if (result.payload.eventDate) eventParts.push(`Date: ${result.payload.eventDate}`);
            if (result.payload.location) eventParts.push(`Location: ${result.payload.location}`);
            if (eventParts.length > 0) {
              parts.push(eventParts.join("\n"));
            }
          }
          
          textToInsert = parts.join("\n\n");
        }

        if (textToInsert.trim()) {
          // Store original imported text for variant switching
          originalImportedText.current = textToInsert.trim();
          
          // For ACW content, place in details field (it's longer content)
          if (result.payload.source === "ai-content-writer") {
            setFormData((prev) => ({
              ...prev,
              details: textToInsert.trim(),
            }));
          } else {
            // For other sources, split into topic and details if it's long
            const lines = textToInsert.split("\n");
            if (lines.length > 3) {
              setFormData((prev) => ({
                ...prev,
                topic: lines[0] || "",
                details: lines.slice(1).join("\n").trim(),
              }));
            } else {
              setFormData((prev) => ({
                ...prev,
                topic: textToInsert.trim(),
              }));
            }
          }
        }
      }

      // Clear URL param if present
      if (typeof window !== "undefined" && searchParams?.get("handoff")) {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }
    }
  }, [settings, searchParams, formData.topic, formData.details]);

  // Helper to show toast
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper to rebuild event text with a different countdown variant
  const rebuildEventTextWithVariant = (variant: string): string => {
    if (!canonicalHandoff || canonicalHandoff.campaignType !== "event") {
      return "";
    }
    
    // Format: ${variant}\n\n${eventName}\n${eventDate}${location ? " • " + location : ""}\n\n${description}
    const eventName = canonicalHandoff.eventName || "";
    const eventDate = canonicalHandoff.eventDate || "";
    const location = canonicalHandoff.location || "";
    const description = canonicalHandoff.description || "";
    
    const dateLocationLine = eventDate + (location ? " • " + location : "");
    
    // Build exactly as specified: variant\n\neventName\ndateLocation\n\ndescription
    return `${variant}\n\n${eventName}\n${dateLocationLine}\n\n${description}`.trim();
  };

  // Check if editor has been edited since import
  const hasEditorBeenEdited = (): boolean => {
    if (!originalImportedText.current) {
      return false; // No import to compare against
    }
    const currentTopic = formData.topic?.trim() || "";
    const currentDetails = formData.details?.trim() || "";
    const currentText = currentTopic + (currentDetails ? "\n\n" + currentDetails : "");
    const originalText = originalImportedText.current || "";
    return currentText.trim() !== originalText.trim();
  };

  // Handle variant selection - only update if editor still matches original
  const handleVariantChange = (variantIndex: number) => {
    if (!canonicalHandoff?.countdownVariants || variantIndex < 0 || variantIndex >= canonicalHandoff.countdownVariants.length) {
      return;
    }

    // Check if current editor content matches original imported text
    const currentTopic = formData.topic?.trim() || "";
    const currentDetails = formData.details?.trim() || "";
    const currentText = currentTopic + (currentDetails ? "\n\n" + currentDetails : "");
    const originalText = originalImportedText.current || "";

    // Only update if content matches (user hasn't edited)
    if (currentText.trim() === originalText.trim()) {
      const newVariant = canonicalHandoff.countdownVariants[variantIndex];
      const newText = rebuildEventTextWithVariant(newVariant);
      
      if (newText.trim()) {
        // Store new text as the "original" for future checks
        originalImportedText.current = newText.trim();
        
        // Split into topic and details
        const lines = newText.split("\n");
        if (lines.length > 3) {
          setFormData((prev) => ({
            ...prev,
            topic: lines[0] || "",
            details: lines.slice(1).join("\n").trim(),
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            topic: newText.trim(),
            details: "",
          }));
        }
      }
    }
    // If content doesn't match, silently do nothing (user has edited)
  };

  // Import captions from handoff
  // Handoff imports must run before setup gating (review-first ingestion)
  const handleImportCaptions = async () => {
    if (!handoffPayload || !handoffHash) {
      setHandoffImportCompleted(true);
      return;
    }
    
    // Prevent import if already imported
    if (wasHandoffAlreadyImported("social-auto-poster", handoffHash)) {
      showToast("These captions have already been imported");
      setHandoffImportCompleted(true);
      return;
    }

    setHandoffImporting(true);

    try {
      // Get existing queue items to check for duplicates
      // Non-blocking: continue even if API fails (setup may not be complete)
      let existingItems: Array<{ platform: SocialPlatform; content: string }> = [];
      try {
        const existingRes = await fetch("/api/social-auto-poster/queue");
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          if (existingData.items && Array.isArray(existingData.items)) {
            existingItems = existingData.items.map((item: { platform: SocialPlatform; content: string }) => ({
              platform: item.platform,
              content: item.content,
            }));
          }
        }
      } catch (error) {
        // Non-blocking: continue import even if duplicate check fails
        console.warn("Failed to fetch existing queue items for duplicate check (non-blocking):", error);
      }

      // Normalize and check for duplicates (simple client-side check)
      // Normalize existing items: platform + lowercase trimmed content
      const normalizedExisting = new Set<string>();
      for (const item of existingItems) {
        const normalized = `${item.platform}:${item.content.trim().toLowerCase()}`;
        normalizedExisting.add(normalized);
      }

      let importedCount = 0;
      let skippedCount = 0;

      // Import each caption (only for image-caption-generator)
      if (!handoffPayload.captions || handoffPayload.captions.length === 0) {
        setHandoffImportCompleted(true);
        return;
      }

      for (const caption of handoffPayload.captions) {
        const platform = normalizePlatform(caption.platform);
        if (!platform) {
          skippedCount++;
          continue;
        }

        // Normalize caption text (trim, lowercase for comparison)
        const normalizedCaption = caption.caption.trim();
        if (!normalizedCaption) {
          skippedCount++;
          continue;
        }

        // Check for duplicate using simple normalized string
        const normalized = `${platform}:${normalizedCaption.toLowerCase()}`;
        if (normalizedExisting.has(normalized)) {
          skippedCount++;
          continue;
        }

        // Build content with hashtags if present
        let content = normalizedCaption;
        if (caption.hashtags && caption.hashtags.length > 0) {
          const hashtagsText = caption.hashtags
            .map(tag => tag.startsWith("#") ? tag : `#${tag}`)
            .join(" ");
          content = `${normalizedCaption}\n\n${hashtagsText}`;
        }

        // Create queue item
        try {
          const res = await fetch("/api/social-auto-poster/queue/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform,
              content,
              metadata: {
                hashtags: caption.hashtags || [],
                goal: caption.goal || null,
                source: "ai-image-caption-generator",
              },
              reason: caption.goal ? `Imported from Image Caption Generator (${caption.goal})` : "Imported from Image Caption Generator",
            }),
          });

          if (res.ok) {
            importedCount++;
            // Add to existing set to prevent duplicates within this import batch
            normalizedExisting.add(normalized);
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.error("Failed to import caption:", error);
          skippedCount++;
        }
      }

      // Mark handoff as imported (step D)
      markHandoffImported("social-auto-poster", handoffHash);

      // Show import toast (step C)
      if (skippedCount > 0) {
        showToast(`Imported ${importedCount} caption${importedCount !== 1 ? "s" : ""} (Skipped ${skippedCount} duplicate${skippedCount !== 1 ? "s" : ""})`);
      } else {
        showToast(`Imported ${importedCount} caption${importedCount !== 1 ? "s" : ""}`);
      }

      // Mark handoff as consumed and clean URL + localStorage (step E)
      // Clear handoff state
      setHandoffPayload(null);
      setHandoffHash(null);

      // Clear localStorage if handoffId was used (localStorage fallback cleanup)
      // Note: parseHandoffFromUrl already clears localStorage when reading,
      // but we clear again here as a safety measure and to ensure cleanup
      if (typeof window !== "undefined" && handoffId) {
        const storageKey = `obd_handoff:${handoffId}`;
        localStorage.removeItem(storageKey);
      }
      
      // Clear handoffId state
      setHandoffId(null);

      // Clear handoff params from URL
      if (typeof window !== "undefined") {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }

      // Mark import as completed - this triggers setup loading (step F)
      setHandoffImportCompleted(true);
    } catch (error) {
      console.error("Failed to import captions:", error);
      showToast("Failed to import captions. Please try again.");
      // Still mark as completed to allow setup to proceed
      setHandoffImportCompleted(true);
    } finally {
      setHandoffImporting(false);
    }
  };

  // Handle event-campaign-builder handoff (event import)
  const handleImportEvent = () => {
    if (!handoffPayload || handoffPayload.sourceApp !== "event-campaign-builder") {
      setHandoffImportCompleted(true);
      return;
    }

    setHandoffImporting(true);

    try {
      // Guardrail: Only import if composer is empty
      const currentTopic = formData.topic?.trim() || "";
      const currentDetails = formData.details?.trim() || "";
      
      if (currentTopic || currentDetails) {
        // Composer has content - don't override, just mark as completed
        setHandoffImporting(false);
        setHandoffImportCompleted(true);
        setHandoffPayload(null);
        setHandoffHash(null);
        return;
      }

      // Use first suggested countdown copy as default
      const countdownCopy = handoffPayload.suggestedCountdownCopy?.[0] || "Coming soon!";
      const eventInfo = [
        handoffPayload.eventName || "Event",
        handoffPayload.eventDate ? `Date: ${handoffPayload.eventDate}` : "",
        handoffPayload.location ? `Location: ${handoffPayload.location}` : "",
      ].filter(Boolean).join("\n");

      // Build topic with countdown copy
      const topic = `${countdownCopy}\n\n${eventInfo}`;
      const details = handoffPayload.description || "";

      // Set form data (draft copy)
      setFormData((prev) => ({
        ...prev,
        topic: topic.trim(),
        details: details.trim(),
        campaignType: "Event",
      }));

      // Auto-select Campaign mode (do NOT save automatically)
      setSettings((prev) => ({
        ...prev,
        postingMode: "campaign",
      }));

      // Mark handoff as imported
      if (handoffHash) {
        markHandoffImported("social-auto-poster", handoffHash);
      }

      // Clear handoff state (but keep payload for countdown dropdown)
      // We'll clear it when user dismisses the banner
      setHandoffHash(null);

      // Clear localStorage if handoffId was used
      if (typeof window !== "undefined" && handoffId) {
        const storageKey = `obd_handoff:${handoffId}`;
        localStorage.removeItem(storageKey);
      }
      setHandoffId(null);

      // Clear handoff params from URL
      if (typeof window !== "undefined") {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }

      setHandoffImportCompleted(true);
    } catch (error) {
      console.error("Failed to import event:", error);
      showToast("Failed to import event. Please try again.");
      setHandoffImportCompleted(true);
    } finally {
      setHandoffImporting(false);
    }
  };

  // Handle offers-builder handoff (campaign import)
  const handleImportOffer = () => {
    if (!handoffPayload || handoffPayload.sourceApp !== "offers-builder") {
      setHandoffImportCompleted(true);
      return;
    }

    setHandoffImporting(true);

    try {
      // Guardrail: Only import if composer is empty
      const currentTopic = formData.topic?.trim() || "";
      const currentDetails = formData.details?.trim() || "";
      
      if (currentTopic || currentDetails) {
        // Composer has content - don't override, just mark as completed
        setHandoffImporting(false);
        setHandoffImportCompleted(true);
        setHandoffPayload(null);
        setHandoffHash(null);
        return;
      }

      // Proceed with import
      // Generate draft copy from offer data
      const topic = handoffPayload.headline || "Special Offer";
      const details = handoffPayload.description || "";
      const expirationNote = handoffPayload.expirationDate 
        ? `\n\nOffer expires: ${handoffPayload.expirationDate}`
        : "";
      const fullDetails = details + expirationNote;

      // Set form data (draft copy)
      setFormData((prev) => ({
        ...prev,
        topic: topic.trim(),
        details: fullDetails.trim(),
        campaignType: "Limited-Time Offer",
      }));

      // Auto-select Campaign mode (do NOT save automatically)
      setSettings((prev) => ({
        ...prev,
        postingMode: "campaign",
      }));

      // Mark handoff as imported
      if (handoffHash) {
        markHandoffImported("social-auto-poster", handoffHash);
      }

      // Clear handoff state
      setHandoffPayload(null);
      setHandoffHash(null);

      // Clear localStorage if handoffId was used
      if (typeof window !== "undefined" && handoffId) {
        const storageKey = `obd_handoff:${handoffId}`;
        localStorage.removeItem(storageKey);
      }
      setHandoffId(null);

      // Clear handoff params from URL
      if (typeof window !== "undefined") {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }

      setHandoffImportCompleted(true);
    } catch (error) {
      console.error("Failed to import offer:", error);
      showToast("Failed to import campaign. Please try again.");
      setHandoffImportCompleted(true);
    } finally {
      setHandoffImporting(false);
    }
  };

  // Auto-import on mount if handoff exists (step B: Run duplicate-safe additive import)
  // This runs immediately when handoff is detected, before setup loading
  const handoffImportedRef = useRef(false);
  useEffect(() => {
    if (handoffPayload && handoffHash && !handoffImporting && !handoffImportedRef.current) {
      handoffImportedRef.current = true;
      
      // Route to appropriate handler based on source
      if (handoffPayload.sourceApp === "offers-builder") {
        handleImportOffer();
      } else if (handoffPayload.sourceApp === "event-campaign-builder") {
        handleImportEvent();
      } else {
        handleImportCaptions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffPayload, handoffHash]);

  // Handle CRM integration prefill
  useEffect(() => {
    if (searchParams && typeof window !== "undefined" && !crmPrefillApplied.current) {
      const context = searchParams.get("context");
      const fromCRM = searchParams.get("from") === "crm";
      const contactId = searchParams.get("contactId");
      const returnUrl = searchParams.get("returnUrl");

      // Store CRM return URL if valid
      if (fromCRM && returnUrl && isValidReturnUrl(returnUrl)) {
        setCrmReturnUrl(returnUrl);
      } else {
        setCrmReturnUrl(null);
      }

      if (context === "crm" && contactId) {
        // Try to read prefill data from sessionStorage
        try {
          const prefillStr = sessionStorage.getItem("obd_social_prefill");
          if (prefillStr) {
            const prefill = JSON.parse(prefillStr);
            if (prefill.source === "crm" && prefill.contactId === contactId) {
              // Fetch contact summary if needed
              const fetchContactSummary = async () => {
                try {
                  let lastNote: string | undefined;
                  let lastActivity: string | undefined;

                  // Only fetch if we need context
                  if (prefill.useLastNote || prefill.useLastActivity) {
                    const res = await fetch(`/api/obd-crm/contacts/${contactId}/summary`);
                    if (res.ok) {
                      const data = await res.json();
                      if (data.ok && data.data) {
                        const summary = data.data;
                        lastNote = prefill.useLastNote ? summary.lastNote || undefined : undefined;
                        lastActivity = prefill.useLastActivity ? summary.lastActivity || undefined : undefined;
                      }
                    }
                  }
                  
                  // Generate starter text
                  const starterText = generateStarterText(
                    prefill.intent,
                    prefill.contactName,
                    lastNote,
                    lastActivity
                  );

                  // Prefill form
                  setFormData((prev) => {
                    const updates: Partial<GeneratePostsRequest> = {
                      topic: starterText,
                    };

                    // Set platform preset if specified
                    if (prefill.platformPreset && prefill.platformPreset !== "All") {
                      const platformMap: Record<string, SocialPlatform> = {
                        Facebook: "facebook",
                        Instagram: "instagram",
                        "Google Business": "googleBusiness",
                      };
                      const platform = platformMap[prefill.platformPreset];
                      if (platform) {
                        updates.platforms = [platform];
                      }
                    }

                    return { ...prev, ...updates };
                  });

                  setCrmContextLoaded(true);
                  crmPrefillApplied.current = true;

                  // Clear sessionStorage after use
                  sessionStorage.removeItem("obd_social_prefill");
                } catch (error) {
                  console.warn("Failed to fetch contact summary:", error);
                  // Fallback: use just the name
                  const starterText = generateStarterText(prefill.intent, prefill.contactName);
                  setFormData((prev) => ({ ...prev, topic: starterText }));
                  setCrmContextLoaded(true);
                  crmPrefillApplied.current = true;
                  sessionStorage.removeItem("obd_social_prefill");
                }
              };

              fetchContactSummary();
            }
          }
        } catch (error) {
          console.warn("Failed to read prefill data from sessionStorage:", error);
        }
      }
    }
  }, [searchParams]);

  // Apply defaults from settings once when they load
  useEffect(() => {
    if (settings && !defaultsInitialized.current) {
      setFormData((prev) => {
        const updates: Partial<GeneratePostsRequest> = {};
        
        // Pre-select enabled platforms from settings
        if (settings.enabledPlatforms && settings.enabledPlatforms.length > 0) {
          updates.platforms = settings.enabledPlatforms;
        }
        
        // Prefill brand voice from settings
        if (settings.brandVoice) {
          updates.brandVoice = settings.brandVoice;
        }
        
        return { ...prev, ...updates };
      });
      defaultsInitialized.current = true;
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/social-auto-poster/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings({
            enabledPlatforms: data.settings.enabledPlatforms,
            brandVoice: data.settings.brandVoice,
            useBrandKit: data.settings.useBrandKit ?? true,
            postingMode: data.settings.postingMode,
            contentPillarSettings: data.settings.contentPillarSettings,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      const res = await fetch("/api/social-connections/meta/status");
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus(data);
      }
    } catch (err) {
      console.error("Failed to load connection status:", err);
    }
  };

  // Load connection status on mount
  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreviews([]);

    try {
      if (formData.platforms.length === 0) {
        throw new Error("Please select at least one platform");
      }

      const res = await fetch("/api/social-auto-poster/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate posts");
      }

      const data: GeneratePostsResponse = await res.json();
      setPreviews(data.previews);
      if (data.variants) {
        setVariants(data.variants);
      } else {
        setVariants({} as Record<SocialPlatform, SocialPostDraft[]>);
      }
      setSelectedVariants({} as Record<SocialPlatform, number>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate posts");
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setFormData({
      ...formData,
      platforms: formData.platforms.includes(platform)
        ? formData.platforms.filter((p) => p !== platform)
        : [...formData.platforms, platform],
    });
  };

  const handleGenerateVariants = async (platform: SocialPlatform) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-auto-poster/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          platforms: [platform],
          generateVariants: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate variants");
      }

      const data: GeneratePostsResponse = await res.json();
      if (data.variants && data.variants[platform]) {
        setVariants((prev) => ({
          ...prev,
          [platform]: data.variants![platform],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate variants");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = async (preview: SocialPostPreview) => {
    try {
      // Check if a variant is selected for this platform
      const selectedVariantIndex = selectedVariants[preview.platform];
      const contentToUse = selectedVariantIndex !== undefined && variants[preview.platform]?.[selectedVariantIndex]
        ? variants[preview.platform][selectedVariantIndex].content
        : preview.content;
      const reasonToUse = selectedVariantIndex !== undefined && variants[preview.platform]?.[selectedVariantIndex]
        ? variants[preview.platform][selectedVariantIndex].reason
        : preview.reason;
      const themeToUse = selectedVariantIndex !== undefined && variants[preview.platform]?.[selectedVariantIndex]
        ? variants[preview.platform][selectedVariantIndex].theme
        : preview.theme;

      const res = await fetch("/api/social-auto-poster/queue/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: preview.platform,
          content: contentToUse,
          metadata: preview.metadata,
          image: preview.image, // Include image field from preview
          reason: reasonToUse,
          theme: themeToUse,
          isSimilar: preview.isSimilar,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add to queue");
      }

      // Show success feedback
      alert("Post added to queue!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add to queue");
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="OBD Social Auto-Poster"
      tagline="Generate platform-optimized social media posts"
    >
      {/* CRM Return Link */}
      <CrmIntegrationIndicator
        isDark={isDark}
        showContextPill={crmContextLoaded}
        showBackLink={!!crmReturnUrl}
        returnUrl={crmReturnUrl}
        onDismissContext={() => setCrmContextLoaded(false)}
      />

      <SocialAutoPosterNav isDark={isDark} />

      {/* Connection Status Badge */}
      {(() => {
        try {
          const publishingEnabled = isMetaPublishingEnabled();
          const uiModel = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
          return (
            <div className="mt-2 mb-4">
              <ConnectionStatusBadge
                state={uiModel.state}
                label={uiModel.badgeLabel}
                isDark={isDark}
              />
              {uiModel.message && (
                <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
                  {uiModel.message}
                </p>
              )}
            </div>
          );
        } catch {
          return (
            <div className="mt-2 mb-4">
              <ConnectionStatusBadge
                state="error"
                label="Error"
                isDark={isDark}
              />
              <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
                We couldn&apos;t verify connection status right now. Try again.
              </p>
            </div>
          );
        }
      })()}

      {/* First-run Callout: Workflow */}
      <SessionCallout
        dismissKey={DISMISS_KEYS.composerWorkflow}
        title="How It Works"
        message="Create posts here, then approve/schedule them in the Queue."
        isDark={isDark}
      />

      {/* Expired Handoff Banner */}
      {handoffExpired && (
        <SessionCallout
          dismissKey={DISMISS_KEYS.importBanner}
          title="Import expired"
          message="Please resend from the source app."
          isDark={isDark}
          onDismiss={() => {
            // Clear handoff when banner is dismissed
            clearHandoff();
            setHandoffExpired(false);
          }}
        />
      )}

      {/* Canonical Import Banner */}
      {canonicalHandoff && (
        <SessionCallout
          dismissKey={DISMISS_KEYS.importBanner}
          title={
            canonicalHandoff.source === "event-campaign-builder"
              ? "Event content imported from Event Campaign Builder"
              : canonicalHandoff.source === "ai-content-writer"
              ? "Imported content from AI Content Writer"
              : canonicalHandoff.campaignType === "event"
              ? `Event content imported from ${getSourceDisplayName(canonicalHandoff.source)}`
              : canonicalHandoff.campaignType === "offer"
              ? `Imported campaign draft from ${getSourceDisplayName(canonicalHandoff.source)}`
              : `Imported content from ${getSourceDisplayName(canonicalHandoff.source)}`
          }
          message="Review and edit the draft copy below. You can modify or discard it."
          isDark={isDark}
          onDismiss={() => {
            // Clear handoff when banner is dismissed
            clearHandoff();
          }}
          customContent={
            canonicalHandoff.source === "event-campaign-builder" &&
            canonicalHandoff.countdownVariants &&
            canonicalHandoff.countdownVariants.length > 1 ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <label className={`text-xs font-medium ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}>
                    Variant:
                  </label>
                  <select
                    value={selectedCountdownIndex}
                    onChange={(e) => {
                      const newIndex = parseInt(e.target.value, 10);
                      setSelectedCountdownIndex(newIndex);
                      handleVariantChange(newIndex);
                    }}
                    disabled={hasEditorBeenEdited()}
                    title={hasEditorBeenEdited() ? "Variant selection is disabled after edits to protect your changes." : undefined}
                    className={`text-xs px-2 py-1 rounded border ${
                      hasEditorBeenEdited()
                        ? isDark
                          ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                          : "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
                        : isDark
                        ? "bg-slate-800 border-slate-700 text-slate-200"
                        : "bg-white border-slate-300 text-slate-900"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50`}
                  >
                    {canonicalHandoff.countdownVariants.map((variant, idx) => (
                      <option key={idx} value={idx}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </div>
                {hasEditorBeenEdited() && (
                  <p className={`text-xs mt-1 ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}>
                    Variant selection is disabled after edits to protect your changes.
                  </p>
                )}
              </div>
            ) : undefined
          }
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50">
          <OBDToast message={toastMessage} type="success" isDark={isDark} />
        </div>
      )}

      {/* Composer Clarity Banner */}
      {settings && (
        <OBDPanel isDark={isDark} className="mt-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              {settings.postingMode && (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}>
                    Mode:
                  </span>
                  <span className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}>
                    {settings.postingMode === "review" ? "Review" : 
                     settings.postingMode === "auto" ? "Auto" : 
                     settings.postingMode === "campaign" ? "Campaign" : 
                     settings.postingMode}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>
                  Brand:
                </span>
                <span className={`text-sm ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}>
                  {settings.useBrandKit ?? true
                    ? "Using Brand Kit defaults"
                    : "Using local overrides"}
                </span>
              </div>
            </div>
            <Link
              href="/apps/social-auto-poster/setup"
              className={`text-sm font-medium transition-colors ${
                isDark
                  ? "text-[#29c4a9] hover:text-[#25b09a]"
                  : "text-[#1EB9A7] hover:text-[#1a9d8f]"
              }`}
            >
              Edit in Setup →
            </Link>
          </div>
        </OBDPanel>
      )}

      {/* Campaign Import Banner (Offers Builder) */}
      {handoffPayload?.sourceApp === "offers-builder" && !handoffImportCompleted && (
        <OBDPanel isDark={isDark} className="mt-4 mb-4 border-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-500">📢</span>
                <span className={`text-sm font-semibold ${
                  isDark ? "text-amber-400" : "text-amber-700"
                }`}>
                  Campaign draft imported from Offers & Promotions
                </span>
              </div>
              <p className={`text-sm ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}>
                Review and edit the draft copy below. Posting Mode has been set to Campaign.
              </p>
            </div>
            <button
              onClick={() => {
                setHandoffPayload(null);
                setHandoffHash(null);
                setHandoffImportCompleted(true);
                if (typeof window !== "undefined" && handoffId) {
                  const storageKey = `obd_handoff:${handoffId}`;
                  localStorage.removeItem(storageKey);
                }
                setHandoffId(null);
                if (typeof window !== "undefined") {
                  const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
                  replaceUrlWithoutReload(cleanUrl);
                }
              }}
              className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              Dismiss
            </button>
          </div>
        </OBDPanel>
      )}

      {/* Draft Import Banner (Local Hiring Assistant) */}
      {lhaDraftHandoff && (
        <OBDPanel isDark={isDark} className="mt-4 mb-4 border-2 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {(() => {
                const urlBusinessId = (searchParams?.get("businessId") ?? "").trim();
                const payloadBusinessId = (lhaDraftHandoff.businessId ?? "").trim();
                const businessIdMissing = !urlBusinessId || !payloadBusinessId;
                const businessIdMismatch =
                  !!payloadBusinessId &&
                  !!urlBusinessId &&
                  payloadBusinessId !== urlBusinessId;

                return (
                  <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-500">📝</span>
                <span className={`text-sm font-semibold ${
                  isDark ? "text-emerald-300" : "text-emerald-800"
                }`}>
                  Imported draft from Local Hiring Assistant
                </span>
              </div>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Apply is additive-only: it will append the imported draft (and fill empty fields). It will not delete your current text.
              </p>
              {businessIdMismatch ? (
                <p className={`text-sm mt-2 ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                  Draft did not match this business.
                </p>
              ) : businessIdMissing ? (
                <p className={`text-sm mt-2 ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                  Business context required to apply this draft.
                </p>
              ) : null}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {!businessIdMismatch && (
                  <button
                    disabled={businessIdMissing}
                    onClick={() => {
                      if (businessIdMissing) return;

                      // Additive-only: never overwrite existing text; may append imported content.
                      setFormData((prev) => {
                        const next = { ...prev };
                        const currentTopic = (prev.topic || "").trim();
                        const currentDetails = (prev.details || "").trim();
                        const incomingTopic = (lhaDraftHandoff.headline || "").trim();
                        const incomingDetails = (lhaDraftHandoff.description || "").trim();

                        // Topic: fill if empty (never overwrite)
                        if (!currentTopic && incomingTopic) next.topic = incomingTopic;

                        // Details: append if present; otherwise fill
                        if (incomingDetails) {
                          if (!currentDetails) {
                            next.details = incomingDetails;
                          } else if (!currentDetails.includes(incomingDetails)) {
                            next.details = `${currentDetails}\n\n${incomingDetails}`.trim();
                          }
                        }

                        // If user already has a topic but no details, still preserve the imported headline by
                        // placing it at the top of details (unless already included).
                        if (currentTopic && !currentDetails && incomingTopic) {
                          const existing = (next.details || "").trim();
                          if (!existing.includes(incomingTopic)) {
                            next.details = existing
                              ? `${incomingTopic}\n\n${existing}`.trim()
                              : incomingTopic;
                          }
                        }
                        return next;
                      });

                      // Clear handoff storage + banner
                      clearHandoff();
                      setLhaDraftHandoff(null);

                      // Clean URL (?handoff=1 and businessId)
                      if (typeof window !== "undefined") {
                        let cleanUrl = clearHandoffParamsFromUrl(window.location.href);
                        try {
                          const urlObj = new URL(cleanUrl, window.location.origin);
                          urlObj.searchParams.delete("businessId");
                          cleanUrl = urlObj.pathname + urlObj.search + urlObj.hash;
                        } catch {
                          cleanUrl = cleanUrl
                            .replace(/[?&]businessId=[^&]*/g, (match) => (match.startsWith("?") ? "?" : ""))
                            .replace(/\?&/g, "?")
                            .replace(/[?&]$/, "");
                        }
                        replaceUrlWithoutReload(cleanUrl);
                      }

                      showToast("Draft added to composer (additive-only).");
                    }}
                    className={`${SUBMIT_BUTTON_CLASSES}${businessIdMissing ? " opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Add to Composer
                  </button>
                )}
                <button
                  onClick={() => {
                    clearHandoff();
                    setLhaDraftHandoff(null);
                    if (typeof window !== "undefined") {
                      let cleanUrl = clearHandoffParamsFromUrl(window.location.href);
                      try {
                        const urlObj = new URL(cleanUrl, window.location.origin);
                        urlObj.searchParams.delete("businessId");
                        cleanUrl = urlObj.pathname + urlObj.search + urlObj.hash;
                      } catch {
                        cleanUrl = cleanUrl
                          .replace(/[?&]businessId=[^&]*/g, (match) => (match.startsWith("?") ? "?" : ""))
                          .replace(/\?&/g, "?")
                          .replace(/[?&]$/, "");
                      }
                      replaceUrlWithoutReload(cleanUrl);
                    }
                    showToast("Draft dismissed.");
                  }}
                  className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                    isDark
                      ? "text-slate-300 hover:text-white hover:bg-slate-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  Dismiss
                </button>
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        </OBDPanel>
      )}

      {/* Event Import Banner (Event Campaign Builder) */}
      {handoffPayload?.sourceApp === "event-campaign-builder" && handoffPayload.suggestedCountdownCopy && (
        <OBDPanel isDark={isDark} className="mt-4 mb-4 border-2 border-blue-500/30 bg-blue-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-blue-500">📅</span>
                <span className={`text-sm font-semibold ${
                  isDark ? "text-blue-400" : "text-blue-700"
                }`}>
                  Event content imported from Event Campaign Builder
                </span>
              </div>
              
              {/* Countdown Variant Dropdown */}
              {handoffPayload.suggestedCountdownCopy.length > 1 && (
                <div className="mb-3">
                  <label htmlFor="countdown-variant" className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}>
                    Countdown Copy Variant:
                  </label>
                  <select
                    id="countdown-variant"
                    value={selectedCountdownIndex}
                    onChange={(e) => {
                      const newIndex = parseInt(e.target.value, 10);
                      setSelectedCountdownIndex(newIndex);
                      
                      // Update topic with selected countdown copy
                      const countdownCopy = handoffPayload.suggestedCountdownCopy?.[newIndex] || "Coming soon!";
                      const eventInfo = [
                        handoffPayload.eventName || "Event",
                        handoffPayload.eventDate ? `Date: ${handoffPayload.eventDate}` : "",
                        handoffPayload.location ? `Location: ${handoffPayload.location}` : "",
                      ].filter(Boolean).join("\n");
                      
                      const newTopic = `${countdownCopy}\n\n${eventInfo}`;
                      setFormData((prev) => ({
                        ...prev,
                        topic: newTopic.trim(),
                      }));
                    }}
                    className={`text-sm px-3 py-1.5 rounded border ${
                      isDark
                        ? "bg-slate-800 border-slate-600 text-slate-200"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                  >
                    {handoffPayload.suggestedCountdownCopy.map((copy, idx) => (
                      <option key={idx} value={idx}>
                        {copy}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <p className={`text-sm ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}>
                Review and edit the draft copy below. Posting Mode has been set to Campaign.
              </p>
            </div>
            <button
              onClick={() => {
                setHandoffPayload(null);
                setHandoffHash(null);
                setHandoffImportCompleted(true);
                if (typeof window !== "undefined" && handoffId) {
                  const storageKey = `obd_handoff:${handoffId}`;
                  localStorage.removeItem(storageKey);
                }
                setHandoffId(null);
                if (typeof window !== "undefined") {
                  const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
                  replaceUrlWithoutReload(cleanUrl);
                }
              }}
              className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              Dismiss
            </button>
          </div>
        </OBDPanel>
      )}

      <div className="mt-7 space-y-6">
        {/* Popular Customer Questions Panel (Feature Flag) */}
        {flags.socialAutoPosterCustomerQuestions && (
          <PopularCustomerQuestionsPanel
            isDark={isDark}
            onUseAsPostIdea={(question) => {
              // Insert question into topic field (editable)
              setFormData((prev) => ({
                ...prev,
                topic: question,
              }));
              // Scroll to topic field
              const topicField = document.getElementById("topic");
              if (topicField) {
                topicField.focus();
                topicField.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
        )}

        {/* Generate Form */}
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark} className="mb-4">
            Generate Posts
          </OBDHeading>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Business Name
                </label>
                <input
                  type="text"
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className={getInputClasses(isDark)}
                  placeholder="Your business name"
                />
              </div>
              <div>
                <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Business Type
                </label>
                <input
                  type="text"
                  id="businessType"
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className={getInputClasses(isDark)}
                  placeholder="e.g., Restaurant, Retail, Service"
                />
              </div>
            </div>

            <div>
              <label htmlFor="topic" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Topic
              </label>
              <input
                type="text"
                id="topic"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className={getInputClasses(isDark)}
                placeholder="What should this post be about?"
                required
              />
            </div>

            <div>
              <label htmlFor="details" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Additional Details
              </label>
              <textarea
                id="details"
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                className={getInputClasses(isDark)}
                rows={3}
                placeholder="Any specific details, promotions, or information to include..."
              />
            </div>

            <div>
              <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Brand Voice (optional)
              </label>
              <textarea
                id="brandVoice"
                value={formData.brandVoice}
                onChange={(e) => setFormData({ ...formData, brandVoice: e.target.value })}
                className={getInputClasses(isDark)}
                rows={2}
                placeholder="Override default brand voice for this post..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="postLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Post Length
                </label>
                <select
                  id="postLength"
                  value={formData.postLength}
                  onChange={(e) => setFormData({ ...formData, postLength: e.target.value as "Short" | "Medium" | "Long" })}
                  className={getInputClasses(isDark)}
                >
                  <option value="Short">Short</option>
                  <option value="Medium">Medium</option>
                  <option value="Long">Long</option>
                </select>
              </div>
              <div>
                <label htmlFor="campaignType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Campaign Type
                </label>
                <select
                  id="campaignType"
                  value={formData.campaignType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      campaignType: e.target.value as
                        | "Everyday Post"
                        | "Event"
                        | "Limited-Time Offer"
                        | "New Service Announcement",
                    })
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="Everyday Post">Everyday Post</option>
                  <option value="Event">Event</option>
                  <option value="Limited-Time Offer">Limited-Time Offer</option>
                  <option value="New Service Announcement">New Service Announcement</option>
                </select>
              </div>
            </div>

            {/* Content Pillar Override */}
            {settings?.contentPillarSettings && (
              <div>
                <label htmlFor="pillarOverride" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Content Pillar (Override)
                </label>
                <select
                  id="pillarOverride"
                  value={formData.pillarOverride || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pillarOverride: e.target.value ? (e.target.value as ContentPillar) : undefined,
                    })
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="">Use default ({settings.contentPillarSettings?.defaultPillar || "education"})</option>
                  <option value="education">Education</option>
                  <option value="promotion">Promotion</option>
                  <option value="social_proof">Social Proof</option>
                  <option value="community">Community</option>
                  <option value="seasonal">Seasonal</option>
                </select>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Override the default pillar for this post generation
                </p>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Select Platforms
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PLATFORMS.map((platform) => {
                  const isSelected = formData.platforms.includes(platform.value);
                  return (
                    <button
                      key={platform.value}
                      type="button"
                      onClick={() => togglePlatform(platform.value)}
                      className={`p-3 rounded-xl border transition-colors ${
                        isSelected
                          ? isDark
                            ? "border-[#29c4a9] bg-[#29c4a9]/10"
                            : "border-[#29c4a9] bg-[#29c4a9]/5"
                          : isDark
                          ? "border-slate-700 hover:border-slate-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className={`font-medium ${isSelected ? themeClasses.headingText : themeClasses.mutedText}`}>
                        {platform.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className={getErrorPanelClasses(isDark)}>
                <p>{error}</p>
              </div>
            )}

            <button type="submit" className={SUBMIT_BUTTON_CLASSES} disabled={loading}>
              {loading ? "Generating..." : "Generate Posts"}
            </button>
          </form>
        </OBDPanel>

        {/* Previews */}
        {previews.length > 0 && (
          <div className="space-y-4">
            <OBDHeading level={2} isDark={isDark}>
              Platform Previews
            </OBDHeading>
            {previews.map((preview, idx) => {
              const platformInfo = PLATFORMS.find((p) => p.value === preview.platform);
              const charCountClass =
                preview.characterCount > preview.maxCharacters
                  ? "text-red-500"
                  : preview.characterCount > preview.maxCharacters * 0.9
                  ? "text-yellow-500"
                  : themeClasses.mutedText;
              const platformVariants = variants[preview.platform] || [];
              const selectedVariantIndex = selectedVariants[preview.platform];
              return (
                <OBDPanel key={idx} isDark={isDark}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className={`font-semibold ${themeClasses.headingText}`}>{platformInfo?.label}</h3>
                      <p className={`text-sm ${charCountClass}`}>
                        {preview.characterCount} / {preview.maxCharacters} characters
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Image Status Badge */}
                      {preview.image && (
                        <span
                          className={`px-2 py-1 text-xs rounded-full border ${
                            preview.image.status === "generated"
                              ? isDark
                                ? "bg-green-500/20 text-green-400 border-green-500"
                                : "bg-green-50 text-green-700 border-green-300"
                              : preview.image.status === "fallback"
                              ? isDark
                                ? "bg-amber-500/20 text-amber-400 border-amber-500"
                                : "bg-amber-50 text-amber-700 border-amber-300"
                              : isDark
                              ? "bg-slate-500/20 text-slate-400 border-slate-500"
                              : "bg-slate-50 text-slate-600 border-slate-300"
                          }`}
                          title={
                            preview.image.status === "fallback" && preview.image.fallbackReason
                              ? preview.image.fallbackReason
                              : preview.image.status === "generated"
                              ? "Image generated successfully"
                              : "Image generation skipped"
                          }
                        >
                          {preview.image.status === "generated"
                            ? "🖼️ Generated"
                            : preview.image.status === "fallback"
                            ? "⚠️ Fallback"
                            : "⏭️ Skipped"}
                        </span>
                      )}
                      {preview.isSimilar && (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          Similar to recent post
                        </span>
                      )}
                      {!preview.isValid && (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Too Long</span>
                      )}
                    </div>
                  </div>
                  {/* Image Preview */}
                  {preview.image?.status === "generated" && preview.image.url && (
                    <div className="mb-3">
                      <img
                        src={preview.image.url}
                        alt={preview.image.altText || "Generated image"}
                        className="max-w-xs max-h-32 rounded-lg border"
                      />
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-xl mb-3 ${
                      isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <p className={`whitespace-pre-wrap ${themeClasses.inputText}`}>{preview.preview}</p>
                  </div>
                  {preview.reason && (
                    <div className={`mb-3 text-sm ${themeClasses.mutedText}`}>
                      <details className="cursor-pointer">
                        <summary className="hover:underline">Why this post:</summary>
                        <p className="mt-1 pl-4">{preview.reason}</p>
                      </details>
                    </div>
                  )}
                  {preview.theme && (
                    <div className={`mb-3 text-sm ${themeClasses.mutedText}`}>
                      <span className="font-medium">Theme: </span>
                      <span className="capitalize">{preview.theme.replace("_", " ")}</span>
                    </div>
                  )}
                  {preview.metadata?.hashtags && Array.isArray(preview.metadata.hashtags) && preview.metadata.hashtags.length > 0 && (
                    <div className={`mb-3 p-3 rounded-xl border ${
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${themeClasses.headingText}`}>Hashtags:</span>
                        <button
                          type="button"
                          onClick={async () => {
                            setLoading(true);
                            try {
                              const res = await fetch("/api/social-auto-poster/generate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  ...formData,
                                  platforms: [preview.platform],
                                  regenerateHashtags: true,
                                }),
                              });
                              if (res.ok) {
                                const data: GeneratePostsResponse = await res.json();
                                const updatedPreview = data.previews.find((p) => p.platform === preview.platform);
                                if (updatedPreview) {
                                  setPreviews((prev) =>
                                    prev.map((p) => (p.platform === preview.platform ? updatedPreview : p))
                                  );
                                }
                              }
                            } catch (err) {
                              console.error("Failed to regenerate hashtags:", err);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className={`text-xs px-2 py-1 rounded-full transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          } disabled:opacity-50`}
                        >
                          Regenerate
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(preview.metadata.hashtags as string[]).map((hashtag, tagIdx) => (
                          <span
                            key={tagIdx}
                            className={`px-2 py-1 rounded-full text-xs ${
                              isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {hashtag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => handleAddToQueue(preview)}
                      className="flex-1 px-4 py-2 bg-[#29c4a9] text-white rounded-full hover:bg-[#22ad93] transition-colors text-sm"
                    >
                      Add to Queue
                    </button>
                    <button
                      onClick={() => handleGenerateVariants(preview.platform)}
                      disabled={loading}
                      className="px-4 py-2 bg-slate-600 text-white rounded-full hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
                    >
                      Generate 2 More
                    </button>
                  </div>
                  {platformVariants.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-600">
                      <h4 className={`text-sm font-medium mb-2 ${themeClasses.headingText}`}>Variants:</h4>
                      <div className="space-y-2">
                        {platformVariants.map((variant, variantIdx) => {
                          const isSelected = selectedVariantIndex === variantIdx;
                          return (
                            <div
                              key={variantIdx}
                              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                                isSelected
                                  ? isDark
                                    ? "border-[#29c4a9] bg-[#29c4a9]/10"
                                    : "border-[#29c4a9] bg-[#29c4a9]/5"
                                  : isDark
                                  ? "border-slate-700 hover:border-slate-600"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                              onClick={() =>
                                setSelectedVariants((prev) => ({
                                  ...prev,
                                  [preview.platform]: variantIdx,
                                }))
                              }
                            >
                              <div className="flex items-start justify-between">
                                <p className={`text-sm flex-1 ${themeClasses.inputText}`}>{variant.content}</p>
                                {isSelected && (
                                  <span className="ml-2 text-[#29c4a9] text-xs font-medium">Selected</span>
                                )}
                              </div>
                              {variant.isSimilar && (
                                <span className="mt-2 inline-block px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                                  Similar to recent
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </OBDPanel>
              );
            })}
          </div>
        )}
      </div>
    </OBDPageContainer>
  );
}

export default function SocialAutoPosterComposerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SocialAutoPosterComposerPageContent />
    </Suspense>
  );
}

