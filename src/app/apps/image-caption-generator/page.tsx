"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getDividerClass, getSecondaryButtonClasses, getSubtleButtonSmallClasses } from "@/lib/obd-framework/layout-helpers";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import { getActiveCaptions } from "@/lib/apps/image-caption-generator/getActiveCaptions";
import { mapCaptionsToItems } from "@/lib/apps/image-caption-generator/caption-mapper";
import { formatCaptionsPlain, pickSelectedCaptions } from "@/lib/apps/image-caption-generator/caption-export-formatters";
import { buildSocialAutoPosterHandoff, encodeHandoffPayload } from "@/lib/apps/image-caption-generator/handoff-builder";
import CaptionCard from "@/components/image-caption-generator/CaptionCard";
import CaptionExportCenterPanel from "@/components/image-caption-generator/CaptionExportCenterPanel";
import CaptionNextStepsPanel from "@/components/image-caption-generator/CaptionNextStepsPanel";
import type {
  ImageCaptionRequest,
  ImageCaptionResponse,
  Caption,
  CaptionItem,
  PlatformOption,
  GoalOption,
  CallToActionPreference,
  PersonalityStyle,
  CaptionLength,
  HashtagStyle,
  VariationMode,
  LanguageOption,
} from "./types";

const DEFAULT_FORM: ImageCaptionRequest = {
  businessName: "",
  businessType: "",
  services: [],
  city: "Ocala",
  state: "Florida",
  imageContext: "",
  imageDetails: "",
  platform: "Instagram",
  goal: "Awareness",
  callToActionPreference: "Soft",
  brandVoice: "",
  personalityStyle: "",
  captionLength: "Medium",
  includeHashtags: true,
  hashtagStyle: "Local",
  variationsCount: 3,
  variationMode: "Safe",
  language: "English",
};

export default function ImageCaptionGeneratorPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<ImageCaptionRequest>(DEFAULT_FORM);
  const [servicesInput, setServicesInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageCaptionResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Canonical state model: generatedCaptions and editedCaptions (using CaptionItem)
  const [generatedCaptions, setGeneratedCaptions] = useState<CaptionItem[]>([]);
  const [editedCaptions, setEditedCaptions] = useState<CaptionItem[] | null>(null);
  const [selectedCaptionIds, setSelectedCaptionIds] = useState<Set<string>>(new Set());

  // Editing state: which caption is being edited and its current edit text
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  // Export Center state
  const [showExportCenter, setShowExportCenter] = useState(false);

  // Accordion state for form sections
  const [accordionState, setAccordionState] = useState({
    businessBasics: true,
    imageContext: true, // Required field - must be visible by default
    platformGoal: false,
    brandVoice: false,
    hashtagsVariations: false,
    advancedOptions: false,
  });

  // Canonical selector: returns edited captions if present, otherwise generated captions
  const getActiveCaptionsList = (): CaptionItem[] => {
    return getActiveCaptions(generatedCaptions, editedCaptions);
  };

  // Memoized active captions for use throughout component
  const activeCaptions = useMemo(() => getActiveCaptionsList(), [generatedCaptions, editedCaptions]);

  // Helper function to get platform character limits and metadata
  const getCharacterMeta = (count: number, platform: string): { label: string; tone: "default" | "warning" | "error" | "muted" } => {
    const normalized = platform.trim().toLowerCase();
    const isX = normalized === "x" || normalized === "twitter";
    const isInstagramStory = normalized.includes("story");
    const isGoogleBusiness = normalized.includes("google");

    if (isX) {
      if (count > 280) return { label: `${count} chars (exceeds X limit)`, tone: "error" };
      if (count > 260) return { label: `${count} chars (near X limit)`, tone: "warning" };
      return { label: `${count} chars`, tone: "default" };
    }

    if (isInstagramStory) {
      if (count > 100) return { label: `${count} chars (long for Story)`, tone: "warning" };
      return { label: `${count} chars`, tone: "default" };
    }

    if (isGoogleBusiness) {
      if (count > 1500) return { label: `${count} chars (exceeds GBP limit)`, tone: "error" };
      if (count > 1400) return { label: `${count} chars (near GBP limit)`, tone: "warning" };
      return { label: `${count} chars`, tone: "default" };
    }

    // Generic guidance for Facebook, Instagram, Generic
    if (count < 60) return { label: `${count} chars (short)`, tone: "muted" };
    if (count > 2200) return { label: `${count} chars (very long)`, tone: "warning" };
    return { label: `${count} chars`, tone: "default" };
  };

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Toggle accordion section
  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Summary functions for accordion sections
  const getBusinessBasicsSummary = (): string => {
    const parts: string[] = [];
    parts.push(form.businessName || "Business");
    if (form.city && form.state) {
      parts.push(`${form.city}, ${form.state}`);
    } else if (form.city) {
      parts.push(form.city);
    } else if (form.state) {
      parts.push(form.state);
    }
    return parts.join(" · ");
  };

  const getImageContextSummary = (): string => {
    if (!form.imageContext.trim()) return "Not set";
    const trimmed = form.imageContext.trim();
    if (trimmed.length <= 40) {
      return trimmed;
    }
    return `${trimmed.substring(0, 40)}...`;
  };

  const getPlatformGoalSummary = (): string => {
    const parts: string[] = [];
    if (form.platform) parts.push(form.platform);
    parts.push(form.goal || "Goal");
    parts.push(form.captionLength || "Length");
    return parts.join(" · ");
  };

  const getBrandVoiceSummary = (): string => {
    const parts: string[] = [];
    if (form.personalityStyle) {
      parts.push(form.personalityStyle);
    }
    if (form.brandVoice.trim()) {
      const voicePreview = form.brandVoice.trim().split(/[.!?]/)[0].substring(0, 30);
      if (voicePreview.length < form.brandVoice.trim().length) {
        parts.push(`${voicePreview}...`);
      } else {
        parts.push(voicePreview);
      }
    }
    if (brandFound && applied) {
      parts.push("Using Brand Kit");
    }
    return parts.length > 0 ? parts.join(" · ") : "Not set";
  };

  const getHashtagsVariationsSummary = (): string => {
    const parts: string[] = [];
    parts.push(`Hashtags: ${form.includeHashtags ? "On" : "Off"}`);
    parts.push(`Variations: ${form.variationsCount}`);
    return parts.join(" · ");
  };

  const getAdvancedOptionsSummary = (): string => {
    const parts: string[] = [];
    if (form.language) {
      parts.push(`Language: ${form.language}`);
    }
    // Note: No emoji field exists in current form, but structure is ready if added
    return parts.length > 0 ? parts.join(" · ") : "Default settings";
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
        setForm((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as ImageCaptionRequest);
      } else {
        setForm(formOrUpdater as unknown as ImageCaptionRequest);
      }
    },
    storageKey: "image-caption-generator-brand-hydrate-v1",
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

  // Handle personalityStyle mapping from brandPersonality (special case)
  useEffect(() => {
    if (form.personalityStyle) return; // Don't overwrite if already set
    
    import("@/lib/brand/brandProfileStorage").then(({ loadBrandProfile }) => {
      const profile = loadBrandProfile();
      if (profile?.brandPersonality) {
        const personalityMap: Record<string, PersonalityStyle> = {
          "Soft": "Soft",
          "Bold": "Bold",
          "High-Energy": "High-Energy",
          "Luxury": "Luxury",
        };
        const mapped = personalityMap[profile.brandPersonality || ""];
        if (mapped) {
          setForm((prev) => ({ ...prev, personalityStyle: mapped }));
        }
      }
    });
  }, [form.personalityStyle]);

  const handleChange = <K extends keyof ImageCaptionRequest>(
    key: K,
    value: ImageCaptionRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key: "includeHashtags") => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Selection handlers
  const handleToggleSelected = (id: string) => {
    setSelectedCaptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedCaptionIds(new Set());
  };

  // Copy handler (updated to work with ID)
  const handleCopy = async (id: string) => {
    try {
      // Use active captions to ensure we copy the current state (edited if present)
      const active = getActiveCaptionsList();
      const caption = active.find((c) => c.id === id);
      if (!caption) {
        console.error("Caption not found for copy");
        return;
      }
      const hashtagsText = caption.hashtags && caption.hashtags.length > 0
        ? caption.hashtags.join(" ")
        : "";
      const textToCopy = hashtagsText
        ? `${caption.caption}\n\n${hashtagsText}`
        : caption.caption;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Bulk copy handlers
  const handleCopyAll = async () => {
    try {
      const active = getActiveCaptionsList();
      if (active.length === 0) {
        showToast("No captions to copy");
        return;
      }
      const textToCopy = formatCaptionsPlain(active);
      await navigator.clipboard.writeText(textToCopy);
      showToast("Copied all captions");
    } catch (error) {
      console.error("Failed to copy all:", error);
      showToast("Failed to copy captions");
    }
  };

  const handleCopySelected = async () => {
    try {
      if (selectedCaptionIds.size === 0) {
        showToast("No captions selected");
        return;
      }
      const active = getActiveCaptionsList();
      const selectedCaptions = pickSelectedCaptions(active, selectedCaptionIds);
      if (selectedCaptions.length === 0) {
        showToast("Selected captions not found");
        return;
      }
      const textToCopy = formatCaptionsPlain(selectedCaptions);
      await navigator.clipboard.writeText(textToCopy);
      showToast(`Copied ${selectedCaptions.length} caption${selectedCaptions.length === 1 ? "" : "s"}`);
    } catch (error) {
      console.error("Failed to copy selected:", error);
      showToast("Failed to copy selected captions");
    }
  };

  // Handoff handler: Send to Social Auto-Poster
  const handleSendToSocialAutoPoster = () => {
    try {
      const active = getActiveCaptionsList();
      if (active.length === 0) {
        showToast("No captions to send");
        return;
      }

      // Determine which captions to send (selected or all)
      const captionsToSend = selectedCaptionIds.size > 0
        ? pickSelectedCaptions(active, selectedCaptionIds)
        : active;

      if (captionsToSend.length === 0) {
        showToast("No captions selected to send");
        return;
      }

      // Build handoff payload
      const payload = buildSocialAutoPosterHandoff(captionsToSend);
      
      // Encode payload
      const encoded = encodeHandoffPayload(payload);
      const urlParam = `?handoff=${encoded}`;

      // Try URL handoff if encoded length is reasonable (~1500 chars for base64url)
      if (encoded.length <= 1500) {
        // Navigate to Social Auto-Poster composer with query param
        const targetUrl = `/apps/social-auto-poster/composer${urlParam}`;
        window.location.href = targetUrl;
      } else {
        // Fallback to localStorage
        const handoffId = `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const storageKey = `obd_handoff:${handoffId}`;
        
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload));
          // Navigate with handoffId
          const targetUrl = `/apps/social-auto-poster/composer?handoffId=${handoffId}`;
          window.location.href = targetUrl;
        } catch (error) {
          console.error("Failed to store handoff payload:", error);
          showToast("Failed to send to Social Auto-Poster. Please try again.");
        }
      }

      // Show toast before navigation
      showToast(`Prepared ${captionsToSend.length} caption${captionsToSend.length === 1 ? "" : "s"} for Social Auto-Poster`);
    } catch (error) {
      console.error("Failed to send to Social Auto-Poster:", error);
      showToast("Failed to send to Social Auto-Poster. Please try again.");
    }
  };

  // Editing handlers
  const handleEdit = (id: string) => {
    const caption = activeCaptions.find((c) => c.id === id);
    if (caption) {
      setEditingId(caption.id);
      setEditText(caption.caption);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = (captionId: string) => {
    const trimmedText = editText.trim();
    
    // Validation: prevent empty caption save
    if (!trimmedText) {
      showToast("Caption cannot be empty");
      return;
    }

    // Get current active captions (this will be generatedCaptions if editedCaptions is null)
    const currentActive = getActiveCaptionsList();
    
    // Find the caption being edited
    const captionToUpdate = currentActive.find((c) => c.id === captionId);
    if (!captionToUpdate) {
      showToast("Caption not found");
      return;
    }

    // Create updated caption with new text
    const updatedCaption: CaptionItem = {
      ...captionToUpdate,
      caption: trimmedText,
    };

    // Create new edited captions array
    // If editedCaptions is null, start with a copy of generatedCaptions
    // Otherwise, use the existing editedCaptions
    const baseCaptions = editedCaptions ?? generatedCaptions;
    const newEditedCaptions = baseCaptions.map((c) => 
      c.id === captionId ? updatedCaption : c
    );

    // Set edited captions (this will trigger the "Edited" badge)
    setEditedCaptions(newEditedCaptions);
    
    // Clear editing state
    setEditingId(null);
    setEditText("");
    
    showToast("Caption saved");
  };

  // Shared function to generate captions
  const generateCaptions = async (clearForm: boolean = false) => {
    if (!form.imageContext.trim()) {
      setError("Please describe your image so we can create the perfect caption.");
      return;
    }

    setError(null);
    if (clearForm) {
      setResult(null);
    }
    setIsLoading(true);

    try {
      const payload: ImageCaptionRequest = {
        ...form,
        services: servicesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        variationsCount: Math.min(5, Math.max(1, form.variationsCount || 3)),
      };

      const res = await fetch("/api/image-caption-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: ImageCaptionResponse }
      const response: ImageCaptionResponse = jsonResponse.data || jsonResponse;
      setResult(response);
      // Update canonical state: map API Captions to CaptionItems and set generated captions
      const captionItems = mapCaptionsToItems(response.captions, form.goal);
      setGeneratedCaptions(captionItems);
      setEditedCaptions(null);
      // Clear selection on regenerate
      setSelectedCaptionIds(new Set());
      // Reset editing state when new captions are generated
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateCaptions(true);
  };

  const handleRegenerate = async () => {
    await generateCaptions(false);
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setServicesInput("");
    setError(null);
    setResult(null);
    setGeneratedCaptions([]);
    setEditedCaptions(null);
    setSelectedCaptionIds(new Set());
    setEditingId(null);
    setEditText("");
    setCopiedId(null);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Image Caption Generator"
      tagline="Generate creative captions for your business images that engage your audience and boost social media performance."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      {/* Form card */}
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
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.businessBasics ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.businessBasics && (
                    <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Business Name
                        </label>
                        <input
                          type="text"
                          id="businessName"
                          value={form.businessName}
                          onChange={(e) => handleChange("businessName", e.target.value)}
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
                          value={form.businessType}
                          onChange={(e) => handleChange("businessType", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Restaurant, Salon, Law Firm"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Services (comma-separated)
                      </label>
                      <input
                        type="text"
                        id="services"
                        value={servicesInput}
                        onChange={(e) => setServicesInput(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Service 1, Service 2, Service 3"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          City
                        </label>
                        <input
                          type="text"
                          id="city"
                          value={form.city}
                          onChange={(e) => handleChange("city", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="Ocala"
                        />
                      </div>
                      <div>
                        <label htmlFor="state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          State
                        </label>
                        <input
                          type="text"
                          id="state"
                          value={form.state}
                          onChange={(e) => handleChange("state", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="Florida"
                        />
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {/* Image Context Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("imageContext")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Image Context
                      </h3>
                      {!accordionState.imageContext && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getImageContextSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("imageContext");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.imageContext ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.imageContext && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label htmlFor="imageContext" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Image Context / Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="imageContext"
                        value={form.imageContext}
                        onChange={(e) => handleChange("imageContext", e.target.value)}
                        rows={4}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="What does the photo show? (e.g., spa interior, plated dish, team photo, etc.)"
                        required
                      />
                      {!form.imageContext.trim() && error && (
                        <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                          {error}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="imageDetails" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Extra Image Details (Optional)
                      </label>
                      <textarea
                        id="imageDetails"
                        value={form.imageDetails}
                        onChange={(e) => handleChange("imageDetails", e.target.value)}
                        rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="Any additional context, mood, or details about the image..."
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* Platform & Goal Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("platformGoal")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Platform & Goal
                      </h3>
                      {!accordionState.platformGoal && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getPlatformGoalSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("platformGoal");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.platformGoal ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.platformGoal && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Platform
                      </label>
                      <select
                        id="platform"
                        value={form.platform}
                        onChange={(e) => handleChange("platform", e.target.value as PlatformOption)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Instagram">Instagram</option>
                        <option value="Facebook">Facebook</option>
                        <option value="InstagramStory">Instagram Story</option>
                        <option value="GoogleBusinessProfile">Google Business Profile</option>
                        <option value="X">X (Twitter)</option>
                        <option value="Generic">Generic</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="goal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Goal
                      </label>
                      <select
                        id="goal"
                        value={form.goal}
                        onChange={(e) => handleChange("goal", e.target.value as GoalOption)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Awareness">Awareness</option>
                        <option value="Promotion">Promotion/Offer</option>
                        <option value="Event">Event</option>
                        <option value="Testimonial">Testimonial</option>
                        <option value="BehindTheScenes">Behind the Scenes</option>
                        <option value="Educational">Educational</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="callToActionPreference" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        CTA Preference
                      </label>
                      <select
                        id="callToActionPreference"
                        value={form.callToActionPreference}
                        onChange={(e) => handleChange("callToActionPreference", e.target.value as CallToActionPreference)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Soft">Soft</option>
                        <option value="Direct">Direct</option>
                        <option value="None">None</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="captionLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Caption Length
                      </label>
                      <select
                        id="captionLength"
                        value={form.captionLength}
                        onChange={(e) => handleChange("captionLength", e.target.value as CaptionLength)}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Short">Short</option>
                        <option value="Medium">Medium</option>
                        <option value="Long">Long</option>
                      </select>
                    </div>
                    </div>
                  )}
                </div>

                {/* Brand Voice Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("brandVoice")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Brand Voice
                      </h3>
                      {!accordionState.brandVoice && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getBrandVoiceSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("brandVoice");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.brandVoice ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.brandVoice && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Brand Voice (Optional)
                      </label>
                      <textarea
                        id="brandVoice"
                        value={form.brandVoice}
                        onChange={(e) => handleChange("brandVoice", e.target.value)}
                        rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="Describe your brand voice (e.g., friendly, professional, witty, etc.)"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Personality
                        </label>
                        <select
                          id="personalityStyle"
                          value={form.personalityStyle}
                          onChange={(e) => handleChange("personalityStyle", e.target.value as PersonalityStyle)}
                          className={getInputClasses(isDark)}
                        >
                          <option value="">Default</option>
                          <option value="Soft">Soft</option>
                          <option value="Bold">Bold</option>
                          <option value="High-Energy">High-Energy</option>
                          <option value="Luxury">Luxury</option>
                        </select>
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {/* Hashtags & Variations Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("hashtagsVariations")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Hashtags & Variations
                      </h3>
                      {!accordionState.hashtagsVariations && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getHashtagsVariationsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("hashtagsVariations");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.hashtagsVariations ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.hashtagsVariations && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={form.includeHashtags}
                          onChange={() => handleToggle("includeHashtags")}
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm">Include Hashtags</span>
                      </label>
                    </div>

                    <div>
                      <label htmlFor="hashtagStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Hashtag Style
                      </label>
                      <select
                        id="hashtagStyle"
                        value={form.hashtagStyle}
                        onChange={(e) => handleChange("hashtagStyle", e.target.value as HashtagStyle)}
                        disabled={!form.includeHashtags}
                        className={getInputClasses(isDark, "disabled:opacity-50 disabled:cursor-not-allowed")}
                      >
                        <option value="Local">Local</option>
                        <option value="Branded">Branded</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="variationsCount" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Variations Count
                        </label>
                        <input
                          type="number"
                          id="variationsCount"
                          min={1}
                          max={5}
                          value={form.variationsCount}
                          onChange={(e) => handleChange("variationsCount", Math.min(5, Math.max(1, parseInt(e.target.value) || 3)))}
                          className={getInputClasses(isDark)}
                        />
                      </div>

                      <div>
                        <label htmlFor="variationMode" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Variation Mode
                        </label>
                        <select
                          id="variationMode"
                          value={form.variationMode}
                          onChange={(e) => handleChange("variationMode", e.target.value as VariationMode)}
                          className={getInputClasses(isDark)}
                        >
                          <option value="Safe">Safe</option>
                          <option value="Creative">Creative</option>
                          <option value="Storytelling">Storytelling</option>
                          <option value="Punchy">Punchy</option>
                        </select>
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {/* Advanced Options Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("advancedOptions")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Advanced Options
                      </h3>
                      {!accordionState.advancedOptions && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getAdvancedOptionsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("advancedOptions");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.advancedOptions ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.advancedOptions && (
                    <div className="p-4 space-y-4">
                      <div>
                        <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Language
                        </label>
                        <select
                          id="language"
                          value={form.language}
                          onChange={(e) => handleChange("language", e.target.value as LanguageOption)}
                          className={getInputClasses(isDark)}
                        >
                          <option value="English">English only</option>
                          <option value="Spanish">Spanish only</option>
                          <option value="Bilingual">Bilingual</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {error && !isLoading && (
                  <div className={`rounded-xl border p-3 ${isDark ? "bg-red-900/20 border-red-700 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
              
              <OBDStickyActionBar isDark={isDark} left={
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  editedCaptions !== null
                    ? isDark
                      ? "bg-blue-900/30 text-blue-300 border border-blue-700"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                    : isDark
                    ? "bg-slate-700/50 text-slate-300 border border-slate-600"
                    : "bg-slate-100 text-slate-600 border border-slate-300"
                }`}>
                  {editedCaptions !== null ? "Edited" : "Generated"}
                </span>
              }>
                <button
                  type="submit"
                  disabled={isLoading || !form.imageContext.trim()}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Writing captions...
                    </span>
                  ) : (
                    "Generate Captions"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isLoading || !form.imageContext.trim() || activeCaptions.length === 0}
                  className={getSecondaryButtonClasses(isDark)}
                  title={activeCaptions.length === 0 ? "Generate captions first" : "Regenerate with same settings"}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleCopySelected}
                  disabled={selectedCaptionIds.size === 0}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    selectedCaptionIds.size === 0
                      ? isDark
                        ? "opacity-50 cursor-not-allowed"
                        : "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  title={selectedCaptionIds.size === 0 ? "Select captions to copy" : `Copy ${selectedCaptionIds.size} selected caption${selectedCaptionIds.size === 1 ? "" : "s"}`}
                >
                  Copy Selected
                  {selectedCaptionIds.size > 0 && ` (${selectedCaptionIds.size})`}
                </button>
                <button
                  type="button"
                  onClick={handleCopyAll}
                  disabled={activeCaptions.length === 0}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    activeCaptions.length === 0
                      ? isDark
                        ? "opacity-50 cursor-not-allowed"
                        : "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  title={activeCaptions.length === 0 ? "No captions to copy" : "Copy all captions"}
                >
                  Copy All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeCaptions.length === 0) {
                      showToast("No captions to export");
                      return;
                    }
                    setShowExportCenter(!showExportCenter);
                  }}
                  disabled={activeCaptions.length === 0}
                  className={`${getSubtleButtonSmallClasses(isDark)} ${
                    activeCaptions.length === 0
                      ? isDark
                        ? "opacity-50 cursor-not-allowed"
                        : "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  title={activeCaptions.length === 0 ? "No captions to export" : "Open Export Center"}
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className={getSubtleButtonSmallClasses(isDark)}
                  title="Reset form and clear results"
                >
                  Reset
                </button>
              </OBDStickyActionBar>
            </form>
      </OBDPanel>

      {/* Results section */}
      {error && !result ? (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      ) : (
        <OBDResultsPanel
          title="AI-Generated Captions"
          subtitle="Each card is a variation you can copy and use."
          isDark={isDark}
          loading={isLoading}
          loadingText="Generating captions..."
          emptyTitle="No captions yet"
          emptyDescription="Fill out the form above and click &quot;Write Captions&quot; to generate your image captions."
          className="mt-8"
          actions={
            selectedCaptionIds.size > 0 ? (
              <button
                onClick={handleClearSelection}
                className={getSubtleButtonSmallClasses(isDark)}
              >
                Clear selection ({selectedCaptionIds.size})
              </button>
            ) : undefined
          }
        >
          {activeCaptions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCaptions.map((caption) => {
                // If this caption is being edited, show editing UI inline (keep existing editing functionality)
                if (editingId === caption.id) {
                  return (
                    <div
                      key={caption.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isDark
                          ? "bg-slate-800/50 border-slate-700 hover:border-[#29c4a9]"
                          : "bg-white border-slate-200 hover:border-[#29c4a9]"
                      }`}
                    >
                      {/* Top row with meta */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs uppercase font-medium ${themeClasses.mutedText}`}>
                            {caption.platform}
                          </span>
                          {caption.lengthMode && (
                            <span className={`text-xs uppercase font-medium ${themeClasses.mutedText}`}>
                              {caption.lengthMode}
                            </span>
                          )}
                          {caption.variationMode && (
                            <span className={`text-xs uppercase font-medium ${themeClasses.mutedText}`}>
                              {caption.variationMode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(caption.id)}
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

                      {/* Label */}
                      {caption.label && (
                        <h3 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                          {caption.label}
                        </h3>
                      )}

                      {/* Preview hint */}
                      {caption.previewHint && (
                        <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
                          {caption.previewHint}
                        </p>
                      )}

                      {/* Editing textarea */}
                      <div className="mb-3">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={6}
                          className={getInputClasses(isDark, "resize-none w-full")}
                          placeholder="Enter caption text..."
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <p className={`text-xs ${
                            getCharacterMeta(editText.length, caption.platform).tone === "error"
                              ? isDark ? "text-red-400" : "text-red-600"
                              : getCharacterMeta(editText.length, caption.platform).tone === "warning"
                              ? isDark ? "text-yellow-400" : "text-yellow-600"
                              : themeClasses.mutedText
                          }`}>
                            {getCharacterMeta(editText.length, caption.platform).label}
                          </p>
                          {!editText.trim() && (
                            <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                              Caption cannot be empty
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Hashtags */}
                      {caption.hashtags && caption.hashtags.length > 0 && (
                        <div className={`pt-3 mt-3 border-t ${
                          isDark ? "border-slate-700" : "border-slate-200"
                        }`}>
                          <p className={`text-xs ${themeClasses.mutedText}`}>
                            {caption.hashtags.join(" ")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }

                // Otherwise, use CaptionCard component
                return (
                  <CaptionCard
                    key={caption.id}
                    caption={caption}
                    isSelected={selectedCaptionIds.has(caption.id)}
                    onToggleSelected={handleToggleSelected}
                    onCopy={handleCopy}
                    onEdit={handleEdit}
                    isDark={isDark}
                    copiedId={copiedId}
                  />
                );
              })}
            </div>
          ) : null}
        </OBDResultsPanel>
      )}

      {/* Next Steps Panel */}
      {activeCaptions.length > 0 && (
        <div className="mt-8">
          <CaptionNextStepsPanel
            activeCaptions={activeCaptions}
            selectedCaptionIds={selectedCaptionIds}
            isDark={isDark}
            onSendToSocialAutoPoster={handleSendToSocialAutoPoster}
          />
        </div>
      )}

      {/* Export Center Panel */}
      {showExportCenter && (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Export Center
            </OBDHeading>
            <button
              onClick={() => setShowExportCenter(false)}
              className={getSubtleButtonSmallClasses(isDark)}
            >
              Close
            </button>
          </div>
          <CaptionExportCenterPanel
            captions={activeCaptions}
            isDark={isDark}
            onToast={showToast}
          />
        </OBDPanel>
      )}
    </OBDPageContainer>
  );
}
