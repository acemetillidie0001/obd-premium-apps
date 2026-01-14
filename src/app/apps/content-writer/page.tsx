"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getDividerClass, getSecondaryButtonClasses, getSubtleButtonSmallClasses } from "@/lib/obd-framework/layout-helpers";
import BrandProfilePanel from "@/components/bdw/BrandProfilePanel";
import { type BrandProfile } from "@/lib/utils/bdw-brand-profile";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { applyBrandProfileToForm } from "@/lib/brand/applyBrandProfile";
import { loadBrandProfile, hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import CWFixPacks from "@/components/cw/CWFixPacks";
import CWQualityControlsTab from "@/components/cw/CWQualityControlsTab";
import CWExportCenterPanel from "@/components/cw/CWExportCenterPanel";
import CWCopyBundles from "@/components/cw/CWCopyBundles";
import WorkflowGuidance from "@/components/bdw/WorkflowGuidance";
import AnalyticsDetails from "@/components/bdw/AnalyticsDetails";
import { recordGeneration, recordFixPackApplied } from "@/lib/bdw/local-analytics";
import { isContentReadyForExport } from "@/lib/apps/content-writer/content-ready";
import { parseContentWriterHandoff, type ContentWriterHandoffPayload } from "@/lib/apps/content-writer/handoff-parser";
import FAQImportBanner from "./components/FAQImportBanner";
import OffersImportBanner from "./components/OffersImportBanner";
import EventImportBanner from "./components/EventImportBanner";
import {
  getHandoffHash,
  wasHandoffAlreadyImported,
  markHandoffImported,
} from "@/lib/utils/handoff-guard";
import { readHandoff, clearHandoff } from "@/lib/obd-framework/social-handoff-transport";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";

interface ContentWriterFormValues {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  targetAudience: string;
  topic: string;
  contentGoal: string;
  contentType: "BlogPost" | "ServicePage" | "AboutUs" | "LandingPage" | "Email" | "LegalPolicy" | "JobPost" | "Other";
  customOutline: string;
  tone: string;
  personalityStyle: "" | "Soft" | "Bold" | "High-Energy" | "Luxury";
  brandVoice: string;
  keywords: string;
  language: "English" | "Spanish" | "Bilingual";
  length: "Short" | "Medium" | "Long";
  writingStyleTemplate: "Default" | "Story-Driven" | "SEO-Friendly" | "Short & Punchy" | "Luxury Premium";
  includeFAQ: boolean;
  includeSocialBlurb: boolean;
  includeMetaDescription: boolean;
  mode: "Content" | "Ideas" | "Both";
  templateName: string;
  templateNotes: string;
  previousTemplateStructure: string;
}

const defaultFormValues: ContentWriterFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  targetAudience: "",
  topic: "",
  contentGoal: "",
  contentType: "BlogPost",
  customOutline: "",
  tone: "Informative",
  personalityStyle: "",
  brandVoice: "",
  keywords: "",
  language: "English",
  length: "Medium",
  writingStyleTemplate: "Default",
  includeFAQ: true,
  includeSocialBlurb: true,
  includeMetaDescription: true,
  mode: "Content",
  templateName: "",
  templateNotes: "",
  previousTemplateStructure: "",
};

interface BlogIdea {
  title: string;
  angle: string;
  description: string;
  targetAudience: string;
  recommendedLength: "Short" | "Medium" | "Long";
}

interface ContentSection {
  heading: string;
  body: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface Preview {
  cardTitle: string;
  cardSubtitle: string;
  cardExcerpt: string;
}

interface ContentOutput {
  title: string;
  seoTitle: string;
  metaDescription: string;
  slugSuggestion: string;
  outline: string[];
  sections: ContentSection[];
  faq: FAQItem[];
  socialBlurb: string;
  preview: Preview;
  wordCountApprox: number;
  keywordsUsed: string[];
}

interface ContentWriterResponse {
  mode: "Content" | "Ideas" | "Both";
  blogIdeas: BlogIdea[];
  content: ContentOutput;
}

interface ContentCardProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}

function ContentCard({ title, children, isDark }: ContentCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${
      isDark
        ? "bg-slate-800/50 border-slate-700"
        : "bg-slate-50 border-slate-200"
    }`}>
      <h3 className={`mb-3 text-sm font-semibold ${
        isDark ? "text-white" : "text-slate-900"
      }`}>
        {title}
      </h3>
      <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
        {children}
      </div>
    </div>
  );
}

// BDW Tools Tabs Component
interface BDWToolsTabsProps {
  content: ContentOutput;
  formValues: { services: string; keywords: string; businessName: string; businessType: string; topic: string };
  baseContent: ContentOutput;
  baselineContent: ContentOutput | null;
  editedContent: ContentOutput | null;
  isDark: boolean;
  canUseTools: boolean;
  onApplyFix: (partialUpdated: Partial<ContentOutput>) => void;
  onReset: () => void;
  onUndo?: () => void;
  onExportCenterRef?: (ref: HTMLDivElement | null) => void;
  onActivateExportTab?: (activateFn: () => void) => void;
  onToast: (message: string) => void;
}

function BDWToolsTabs({
  content,
  formValues,
  baseContent,
  baselineContent,
  editedContent,
  isDark,
  canUseTools,
  onApplyFix,
  onReset,
  onUndo,
  onExportCenterRef,
  onActivateExportTab,
  onToast,
}: BDWToolsTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("fix-packs");
  const exportCenterRef = useRef<HTMLDivElement>(null);

  // Expose ref to parent
  useEffect(() => {
    if (onExportCenterRef && exportCenterRef.current) {
      onExportCenterRef(exportCenterRef.current);
    }
  }, [onExportCenterRef, activeTab]);

  // Expose tab activation function to parent
  useEffect(() => {
    if (onActivateExportTab) {
      // Store activation function that parent can call
      const activateExportTab = () => {
        setActiveTab("export-center");
        // Small delay to ensure DOM is updated before scrolling
        setTimeout(() => {
          const element = document.getElementById("cw-export-center");
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      };
      // Call the callback with the activation function
      onActivateExportTab(activateExportTab);
    }
  }, [onActivateExportTab]);

  const tabs = [
    { id: "fix-packs", label: "Fix Packs" },
    { id: "quality-controls", label: "Quality Controls" },
    { id: "export-center", label: "Export Center" },
  ];

  return (
    <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
      {/* Tab Headers */}
      <div className={`flex flex-wrap gap-2 p-4 border-b items-center justify-between ${isDark ? "border-slate-700" : "border-slate-200"}`}>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-[#29c4a9] text-white"
                  : isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <AnalyticsDetails storageKey="cw-analytics" isDark={isDark} />
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "fix-packs" && (
          <CWFixPacks
            formValues={formValues}
            baseContent={baseContent}
            baselineContent={baselineContent}
            editedContent={editedContent}
            isDark={isDark}
            onApply={onApplyFix}
            onReset={onReset}
            onUndo={onUndo}
          />
        )}
        {activeTab === "quality-controls" && (
          <CWQualityControlsTab
            content={content}
            formValues={formValues}
            isDark={isDark}
            onApplyFix={onApplyFix}
          />
        )}
        {activeTab === "export-center" && (
          <div id="cw-export-center" ref={exportCenterRef} className="scroll-mt-24">
            <CWExportCenterPanel 
              content={content} 
              isDark={isDark} 
              storageKey="cw-analytics"
              canUseTools={canUseTools}
              formValues={{
                businessName: formValues.businessName,
                businessType: formValues.businessType,
                topic: formValues.topic,
                services: formValues.services,
              }}
              onToast={onToast}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ContentWriterPageContent() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  const [formValues, setFormValues] = useState<ContentWriterFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contentResponse, setContentResponse] = useState<ContentWriterResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<ContentWriterFormValues | null>(null);
  
  // BDW Tools: Edited content state for Fix Packs
  const [editedContent, setEditedContent] = useState<ContentOutput | null>(null);
  const [editHistory, setEditHistory] = useState<ContentOutput[]>([]);

  // Handoff state (FAQ Generator)
  const [handoffPayload, setHandoffPayload] = useState<ContentWriterHandoffPayload | null>(null);
  const [handoffHash, setHandoffHash] = useState<string | null>(null);
  const [isHandoffAlreadyImported, setIsHandoffAlreadyImported] = useState(false);
  const [showImportBanner, setShowImportBanner] = useState(false);

  // Offers Builder handoff state
  const [offersHandoffPayload, setOffersHandoffPayload] = useState<any | null>(null);
  const [showOffersImportBanner, setShowOffersImportBanner] = useState(false);

  // Event Campaign Builder handoff state
  const [eventHandoffPayload, setEventHandoffPayload] = useState<any | null>(null);
  const [showEventImportBanner, setShowEventImportBanner] = useState(false);

  // Local Hiring Assistant -> Content Writer (Careers page draft)
  type LocalHiringAssistantToContentWriterPayload = {
    sourceApp: "local-hiring-assistant";
    contentType: "careersPage";
    createdAt: number;
    draftId: string;
    businessId: string;
    titleSuggestion?: string;
    text: string;
    meta?: {
      jobTitle?: string;
      location?: string;
    };
  };
  const [lhaCareersHandoffPayload, setLhaCareersHandoffPayload] =
    useState<LocalHiringAssistantToContentWriterPayload | null>(null);
  const [showLhaCareersImportBanner, setShowLhaCareersImportBanner] = useState(false);
  const [lhaCareersBusinessMismatch, setLhaCareersBusinessMismatch] = useState(false);

  // Accordion state for form sections
  const [accordionState, setAccordionState] = useState({
    businessBasics: true,
    contentBasics: true,
    tonePersonality: false,
    seoLength: false,
    structureTemplates: false,
    options: false,
  });

  // Scroll-based sticky action bar state
  const formStickyBarRef = useRef<HTMLDivElement>(null);
  const [showScrollStickyBar, setShowScrollStickyBar] = useState(false);

  // Toast feedback state
  const [actionToast, setActionToast] = useState<string | null>(null);
  
  // Helper to show toast and auto-clear after 1200ms
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Brand Profile auto-import toggle with localStorage persistence
  // Default will be set to ON if brandFound after hook detects it
  const [useBrandProfileToggle, setUseBrandProfileToggle] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("obd.acw.useBrandProfile");
      if (stored !== null) {
        return stored === "true";
      }
      // Default: OFF initially, will be set to ON if brandFound
      return false;
    } catch {
      return false;
    }
  });

  // Fill empty only checkbox with localStorage persistence
  const [fillEmptyOnly, setFillEmptyOnly] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem("obd.acw.fillEmptyOnly");
      if (stored !== null) {
        return stored === "true";
      }
      return true; // Default: ON
    } catch {
      return true;
    }
  });

  // Persist toggle state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("obd.acw.useBrandProfile", String(useBrandProfileToggle));
    } catch {
      // Ignore storage errors
    }
  }, [useBrandProfileToggle]);

  // Persist fillEmptyOnly state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("obd.acw.fillEmptyOnly", String(fillEmptyOnly));
    } catch {
      // Ignore storage errors
    }
  }, [fillEmptyOnly]);

  // Field mapping between ContentWriterFormValues and BrandProfile
  // Note: Some mappings may reference form fields that don't exist yet;
  // the merge engine will safely skip those during application.
  const brandProfileMap: Record<string, keyof BrandProfileType> = {
    businessName: "businessName",
    businessType: "businessType",
    city: "city",
    state: "state",
    brandVoice: "brandVoice",
    targetAudience: "targetAudience",
    keywords: "industryKeywords",
    language: "language",
    // Additional mappings (fields may not exist in form yet)
    uniqueSellingPoints: "differentiators",
    toneNotes: "toneNotes",
    vibeKeywords: "vibeKeywords",
    variationMode: "variationMode",
    hashtagStyle: "hashtagStyle",
    includeHashtags: "includeHashtags",
  };

  // Auto-apply brand profile to form
  const { applied, brandFound } = useAutoApplyBrandProfile({
    enabled: useBrandProfileToggle,
    form: formValues as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        setFormValues((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as ContentWriterFormValues);
      } else {
        setFormValues(formOrUpdater as unknown as ContentWriterFormValues);
      }
    },
    storageKey: "acw-brand-hydrate-v1",
    fillEmptyOnly,
    once: "per-page-load",
    map: brandProfileMap,
  });

  // Update toggle default to ON when brand profile is found (first time only)
  useEffect(() => {
    if (brandFound && !useBrandProfileToggle && typeof window !== "undefined") {
      // Only update if user hasn't explicitly set it
      try {
        const stored = localStorage.getItem("obd.acw.useBrandProfile");
        if (stored === null) {
          // User hasn't set it yet, default to ON if brandFound
          setUseBrandProfileToggle(true);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, [brandFound]);

  // Show one-time toast when brand profile is applied
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (applied && !toastShownRef.current) {
      toastShownRef.current = true;
      showToast("Brand Profile applied to empty fields.");
    }
  }, [applied]);

  // Handle handoff on page load (FAQ Generator from URL params)
  useEffect(() => {
    if (searchParams && typeof window !== "undefined") {
      try {
        const payload = parseContentWriterHandoff(searchParams);
        if (payload && payload.type === "faq-section") {
          // Compute hash for the payload
          const hash = getHandoffHash(payload);
          setHandoffHash(hash);
          
          // Check if this payload was already imported
          const alreadyImported = wasHandoffAlreadyImported("content-writer", hash);
          setIsHandoffAlreadyImported(alreadyImported);
          
          setHandoffPayload(payload);
          setShowImportBanner(true);
        }
      } catch (error) {
        console.error("Failed to parse handoff payload:", error);
      }
    }
  }, [searchParams]);

  // Handle Offers Builder handoff from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Only check for handoff if URL includes ?handoff=1
    if (!searchParams || searchParams.get("handoff") !== "1") {
      return;
    }

    try {
      const handoffResult = readHandoff();
      
      // Handle expired payload
      if (handoffResult.expired) {
        showToast("Handoff expired.");
        return;
      }
      
      // Handle errors
      if (handoffResult.error) {
        console.error("Handoff error:", handoffResult.error);
        return;
      }

      if (handoffResult.envelope) {
        const { source, payload: envelopePayload } = handoffResult.envelope;
        const urlBusinessId = searchParams?.get("businessId") || "";
        
        // Check if this is an offers-builder handoff
        if (source === "offers-builder-to-content-writer" && envelopePayload) {
          // Validate payload structure
          if (
            envelopePayload.sourceApp === "offers-builder" &&
            envelopePayload.intent === "landing-page" &&
            envelopePayload.offerFacts
          ) {
            // Tenant safety: Check businessId if present in payload
            // If payload includes businessId or tenant context, validate it matches current session
            if (envelopePayload.businessId || envelopePayload.tenantId) {
              // TODO: Get current session business context
              // const currentBusinessId = getCurrentBusinessId(); // Would need session context
              // if (envelopePayload.businessId && envelopePayload.businessId !== currentBusinessId) {
              //   clearHandoff();
              //   showToast("Invalid handoff for this business.");
              //   return;
              // }
              // For now, tenant safety is handled at the session/auth level
              // If needed, implement businessId validation here
            }
            
            setOffersHandoffPayload(envelopePayload);
            setShowOffersImportBanner(true);
          }
        }
        
        // Check if this is an event-campaign-builder handoff
        if (source === "event-campaign-builder-to-content-writer" && envelopePayload) {
          // Validate payload structure
          if (
            envelopePayload.sourceApp === "event-campaign-builder" &&
            envelopePayload.intent === "landing-page" &&
            envelopePayload.eventFacts
          ) {
            setEventHandoffPayload(envelopePayload);
            setShowEventImportBanner(true);
          }
        }

        // Check if this is a local-hiring-assistant careers page draft handoff
        if (source === "local-hiring-assistant-to-content-writer" && envelopePayload) {
          const isValid =
            envelopePayload.sourceApp === "local-hiring-assistant" &&
            envelopePayload.contentType === "careersPage" &&
            typeof envelopePayload.text === "string" &&
            envelopePayload.text.trim().length > 0 &&
            typeof envelopePayload.businessId === "string" &&
            envelopePayload.businessId.trim().length > 0;

          if (isValid) {
            const payload = envelopePayload as LocalHiringAssistantToContentWriterPayload;
            // Tenant safety: only allow Apply if the payload businessId matches URL businessId.
            // If URL businessId is missing, treat as mismatch (can't validate).
            const mismatch = !!payload.businessId && payload.businessId !== urlBusinessId;

            setLhaCareersHandoffPayload(payload);
            setLhaCareersBusinessMismatch(mismatch);
            setShowLhaCareersImportBanner(true);
          }
        }
      }
    } catch (error) {
      console.error("Failed to read offers handoff from sessionStorage:", error);
    }
  }, [searchParams]);

  const clearReceiverImportParamsFromUrl = () => {
    if (typeof window === "undefined") return;

    // Start with existing shared cleaner (handoff/handoffId/mode/source)
    let cleanUrl = clearHandoffParamsFromUrl(window.location.href);

    // Receiver-specific: also remove businessId to avoid sticky tenant context in the URL
    try {
      const urlObj = new URL(cleanUrl, window.location.origin);
      urlObj.searchParams.delete("businessId");
      cleanUrl = urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      // Fallback: best-effort removal of businessId
      cleanUrl = cleanUrl
        .replace(/[?&]businessId=[^&]*/g, (match) => (match.startsWith("?") ? "?" : ""))
        .replace(/\?&/g, "?")
        .replace(/[?&]$/, "");
    }

    replaceUrlWithoutReload(cleanUrl);
  };

  const handleDismissLhaCareersImport = () => {
    clearHandoff();
    setLhaCareersHandoffPayload(null);
    setShowLhaCareersImportBanner(false);
    setLhaCareersBusinessMismatch(false);
    clearReceiverImportParamsFromUrl();
  };

  const handleApplyLhaCareersToInputs = () => {
    if (!lhaCareersHandoffPayload) return;

    if (lhaCareersBusinessMismatch) {
      // Safety: never apply if the business context doesn't match.
      return;
    }

    const draftText = lhaCareersHandoffPayload.text || "";
    const titleSuggestion = lhaCareersHandoffPayload.titleSuggestion || "";

    // Apply additively only:
    // - Never overwrite existing user text
    // - Only fill empty input fields
    // - Use the closest "content/body" input available in ACW (customOutline)
    setFormValues((prev) => {
      const next = { ...prev };

      if (!next.topic.trim() && titleSuggestion.trim()) {
        next.topic = titleSuggestion.trim();
      }

      // Closest “content/body” input in this form is Custom Outline (multi-line textarea).
      // Only fill if empty; do not append (apply-only rule).
      if (!next.customOutline.trim() && draftText.trim()) {
        next.customOutline = draftText.trim();
      }

      return next;
    });

    clearHandoff();
    setLhaCareersHandoffPayload(null);
    setShowLhaCareersImportBanner(false);
    setLhaCareersBusinessMismatch(false);
    clearReceiverImportParamsFromUrl();

    showToast("Careers page draft applied to empty inputs.");

    setTimeout(() => {
      const formElement = document.querySelector("form");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Parse markdown into ContentSection array
  // Handles FAQ markdown format: ## Heading, ### Question, Answer
  const parseMarkdownToSections = (markdown: string): ContentSection[] => {
    const lines = markdown.split(/\r?\n/);
    const sections: ContentSection[] = [];
    let currentHeading = "";
    let currentBody: string[] = [];
    let skipFirstHeading = true; // Skip the main "## Frequently Asked Questions" heading

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for heading (## or ###)
      const headingMatch = trimmed.match(/^#{2,3}\s+(.+)$/);
      if (headingMatch) {
        // Skip the main FAQ heading
        if (skipFirstHeading && headingMatch[1].toLowerCase().includes("frequently asked")) {
          skipFirstHeading = false;
          continue;
        }
        
        // Save previous section if exists
        if (currentHeading || currentBody.length > 0) {
          sections.push({
            heading: currentHeading || "",
            body: currentBody.join("\n").trim(),
          });
        }
        // Start new section
        currentHeading = headingMatch[1];
        currentBody = [];
        skipFirstHeading = false;
      } else if (trimmed) {
        // Add to current body
        currentBody.push(trimmed);
      }
    }

    // Push last section
    if (currentHeading || currentBody.length > 0) {
      sections.push({
        heading: currentHeading || "",
        body: currentBody.join("\n").trim(),
      });
    }

    return sections;
  };

  // Handle "Add as New Draft"
  const handleAddAsNewDraft = () => {
    if (!handoffPayload || !handoffHash) return;
    
    // Prevent import if already imported
    if (isHandoffAlreadyImported) {
      return;
    }

    // Parse markdown into sections
    const sections = parseMarkdownToSections(handoffPayload.markdown);

    // Create new ContentOutput
    const newContent: ContentOutput = {
      title: handoffPayload.title,
      seoTitle: "",
      metaDescription: "",
      slugSuggestion: "",
      outline: [],
      sections,
      faq: [],
      socialBlurb: "",
      preview: {
        cardTitle: "",
        cardSubtitle: "",
        cardExcerpt: "",
      },
      wordCountApprox: 0,
      keywordsUsed: [],
    };

    // Set as new content response
    setContentResponse({
      mode: "Content",
      blogIdeas: [],
      content: newContent,
    });
    setEditedContent(null);

    // Mark handoff as imported
    markHandoffImported("content-writer", handoffHash);
    setIsHandoffAlreadyImported(true);

    // Clear handoff
    setHandoffPayload(null);
    setHandoffHash(null);
    setShowImportBanner(false);

    // Clear localStorage if handoffId was used
    if (typeof window !== "undefined" && searchParams) {
      const handoffId = searchParams.get("handoffId");
      if (handoffId) {
        const storageKey = `obd_handoff:${handoffId}`;
        localStorage.removeItem(storageKey);
      }
    }

    // Clear import params from URL (handoff + businessId) without reload
    clearReceiverImportParamsFromUrl();

    // Show success toast
    showToast("FAQ section added as new draft");

    // Scroll to results
    setTimeout(() => {
      const resultsElement = document.getElementById("cw-results");
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Handle "Append to Current Draft"
  const handleAppendToCurrent = () => {
    if (!handoffPayload || !handoffHash) return;
    
    // Prevent import if already imported
    if (isHandoffAlreadyImported) {
      return;
    }

    const activeContent = getActiveContent();
    if (!activeContent) {
      // If no active content, fallback to "Add as New Draft"
      handleAddAsNewDraft();
      return;
    }

    // Append format: "\n\n## FAQs\n\n" + payload.markdown
    // Append to the last section's body, or create a new section if no sections exist
    const faqContent = `\n\n## FAQs\n\n${handoffPayload.markdown}`;
    
    let updatedContent: ContentOutput;
    if (activeContent.sections.length === 0) {
      // No sections exist, create a new section
      updatedContent = {
        ...activeContent,
        sections: [
          {
            heading: "FAQs",
            body: handoffPayload.markdown,
          },
        ],
      };
    } else {
      // Append to the last section's body
      const lastSectionIndex = activeContent.sections.length - 1;
      const lastSection = activeContent.sections[lastSectionIndex];
      updatedContent = {
        ...activeContent,
        sections: [
          ...activeContent.sections.slice(0, lastSectionIndex),
          {
            ...lastSection,
            body: lastSection.body + faqContent,
          },
        ],
      };
    }

    // Update through editedContent (respects canonical selector)
    setEditedContent(updatedContent);

    // Mark handoff as imported
    markHandoffImported("content-writer", handoffHash);
    setIsHandoffAlreadyImported(true);

    // Clear localStorage if handoffId was used
    if (typeof window !== "undefined" && searchParams) {
      const handoffId = searchParams.get("handoffId");
      if (handoffId) {
        const storageKey = `obd_handoff:${handoffId}`;
        localStorage.removeItem(storageKey);
      }
    }

    // Clear handoff
    setHandoffPayload(null);
    setHandoffHash(null);
    setShowImportBanner(false);

    // Clear import params from URL (handoff + businessId) without reload
    clearReceiverImportParamsFromUrl();

    // Show success toast
    showToast("FAQ section appended to current draft");
  };

  const handleDismissFaqImport = () => {
    // Clear localStorage if handoffId was used
    if (typeof window !== "undefined" && searchParams) {
      const handoffId = searchParams.get("handoffId");
      if (handoffId) {
        const storageKey = `obd_handoff:${handoffId}`;
        localStorage.removeItem(storageKey);
      }
    }

    setHandoffPayload(null);
    setHandoffHash(null);
    setIsHandoffAlreadyImported(false);
    setShowImportBanner(false);

    // Clear import params from URL (handoff + businessId) without reload
    clearReceiverImportParamsFromUrl();
  };

  // Handle "Apply to inputs" for Offers Builder handoff
  const handleApplyOffersToInputs = () => {
    if (!offersHandoffPayload) return;

    // Tenant safety: if the payload includes a businessId, require it to match the URL businessId.
    // If URL businessId is missing, treat as mismatch (can't validate).
    const urlBusinessId = searchParams?.get("businessId") || "";
    const offersBusinessId =
      typeof (offersHandoffPayload as any).businessId === "string"
        ? ((offersHandoffPayload as any).businessId as string).trim()
        : "";
    if (offersBusinessId) {
      const mismatch = offersBusinessId !== urlBusinessId;
      if (mismatch) {
        showToast("Offer handoff did not match this business. Not applied.");
        return;
      }
    }

    const { offerFacts, copy, pageDraft } = offersHandoffPayload;

    // Build content goal with offer details
    const offerDetails: string[] = [];
    if (offerFacts.offerValue) offerDetails.push(offerFacts.offerValue);
    if (offerFacts.newCustomersOnly) offerDetails.push("New customers only");
    if (offerFacts.redemptionLimits) offerDetails.push(`Limits: ${offerFacts.redemptionLimits}`);
    if (offerFacts.endDate) {
      try {
        const date = new Date(offerFacts.endDate);
        offerDetails.push(`Expires: ${date.toLocaleDateString()}`);
      } catch {
        offerDetails.push(`Expires: ${offerFacts.endDate}`);
      }
    }

    const contentGoalParts = [
      pageDraft.pageGoal,
      ...offerDetails,
    ];
    const contentGoal = contentGoalParts.join(". ");

    // Build topic from offer title + business context
    const topicParts: string[] = [];
    if (offerFacts.promoTitle) topicParts.push(offerFacts.promoTitle);
    if (offerFacts.businessName) topicParts.push(`for ${offerFacts.businessName}`);
    const topic = topicParts.length > 0 ? topicParts.join(" ") : "Special Offer";

    // Build custom outline from suggested sections
    const customOutline = pageDraft.suggestedSections.join("\n");

    // Apply form values additively (only fill empty fields)
    setFormValues((prev) => ({
      ...prev,
      // Always set contentType for landing page
      contentType: "LandingPage",
      // Only set topic if empty
      topic: prev.topic.trim() || topic,
      // Only set contentGoal if empty
      contentGoal: prev.contentGoal.trim() || contentGoal,
      // Only set businessName if empty
      businessName: prev.businessName.trim() || offerFacts.businessName || prev.businessName,
      // Only set businessType if empty
      businessType: prev.businessType.trim() || offerFacts.businessType || prev.businessType,
      // Append to customOutline if it exists, otherwise set it
      customOutline: prev.customOutline.trim() 
        ? `${prev.customOutline}\n\n${customOutline}` 
        : customOutline,
      // Enable FAQs for offer landing page
      includeFAQ: true,
    }));

    // Add FAQ seed questions to customOutline if available
    if (pageDraft.faqSeedQuestions && pageDraft.faqSeedQuestions.length > 0) {
      const faqHints = `\n\nSuggested FAQ Questions:\n${pageDraft.faqSeedQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`;
      setFormValues((prev) => ({
        ...prev,
        customOutline: (prev.customOutline || "") + faqHints,
      }));
    }

    // Clear handoff from sessionStorage (one-time import)
    clearHandoff();
    setOffersHandoffPayload(null);
    setShowOffersImportBanner(false);

    // Clean receiver URL (handoff/businessId) without reload
    clearReceiverImportParamsFromUrl();

    // Show success toast
    showToast("Offer imported into AI Content Writer");

    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector("form");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Handle "Dismiss" for Offers Builder handoff
  const handleDismissOffersImport = () => {
    // Clear handoff from sessionStorage
    clearHandoff();
    setOffersHandoffPayload(null);
    setShowOffersImportBanner(false);

    // Clean receiver URL (handoff/businessId) without reload
    clearReceiverImportParamsFromUrl();
  };

  // Handle "Apply to Inputs" for Event Campaign Builder handoff
  const handleApplyEventToInputs = () => {
    if (!eventHandoffPayload) return;

    // Tenant safety: if the payload includes a businessId, require it to match the URL businessId.
    // If URL businessId is missing, treat as mismatch (can't validate).
    const urlBusinessId = searchParams?.get("businessId") || "";
    const eventBusinessId =
      typeof (eventHandoffPayload as any).businessId === "string"
        ? ((eventHandoffPayload as any).businessId as string).trim()
        : "";
    if (eventBusinessId) {
      const mismatch = eventBusinessId !== urlBusinessId;
      if (mismatch) {
        showToast("Event handoff did not match this business. Not applied.");
        return;
      }
    }

    const { eventFacts, description, agendaBullets, cta, faqSeeds } = eventHandoffPayload;

    // Build content goal with event details
    const eventDetails: string[] = [];
    if (eventFacts.eventDate) eventDetails.push(`Date: ${eventFacts.eventDate}`);
    if (eventFacts.eventTime) eventDetails.push(`Time: ${eventFacts.eventTime}`);
    if (eventFacts.eventLocation) eventDetails.push(`Location: ${eventFacts.eventLocation}`);
    
    const eventTypeLabels: Record<string, string> = {
      InPerson: "In-Person Event",
      Virtual: "Virtual Event",
      Hybrid: "Hybrid Event",
    };
    if (eventFacts.eventType) {
      eventDetails.push(`Type: ${eventTypeLabels[eventFacts.eventType] || eventFacts.eventType}`);
    }

    const contentGoalParts = [
      `Create a landing page for ${eventFacts.eventName || "this event"}`,
      ...eventDetails,
      cta ? `Primary CTA: ${cta}` : "",
    ].filter(Boolean);
    const contentGoal = contentGoalParts.join(". ");

    // Build topic from event name + business context
    const topicParts: string[] = [];
    if (eventFacts.eventName) topicParts.push(eventFacts.eventName);
    if (eventFacts.businessName) topicParts.push(`at ${eventFacts.businessName}`);
    const topic = topicParts.length > 0 ? topicParts.join(" ") : "Event Landing Page";

    // Build custom outline from description and agenda bullets
    const outlineParts: string[] = [];
    if (description) {
      outlineParts.push("Event Description:");
      outlineParts.push(description);
    }
    if (agendaBullets && agendaBullets.length > 0) {
      outlineParts.push("\nEvent Schedule:");
      agendaBullets.forEach((bullet: string) => {
        outlineParts.push(`- ${bullet}`);
      });
    }
    const customOutline = outlineParts.join("\n");

    // Apply form values additively (only fill empty fields)
    setFormValues((prev) => ({
      ...prev,
      // Always set contentType for landing page
      contentType: "LandingPage",
      // Only set topic if empty
      topic: prev.topic.trim() || topic,
      // Only set contentGoal if empty
      contentGoal: prev.contentGoal.trim() || contentGoal,
      // Only set businessName if empty
      businessName: prev.businessName.trim() || eventFacts.businessName || prev.businessName,
      // Only set businessType if empty
      businessType: prev.businessType.trim() || eventFacts.businessType || prev.businessType,
      // Only set city if empty
      city: prev.city.trim() || eventFacts.city || prev.city,
      // Only set state if empty
      state: prev.state.trim() || eventFacts.state || prev.state,
      // Append to customOutline if it exists, otherwise set it
      customOutline: prev.customOutline.trim() 
        ? `${prev.customOutline}\n\n${customOutline}` 
        : customOutline,
      // Enable FAQs for event landing page
      includeFAQ: true,
    }));

    // Add FAQ seed questions to customOutline if available
    if (faqSeeds && faqSeeds.length > 0) {
      const faqHints = `\n\nSuggested FAQ Questions:\n${faqSeeds.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`;
      setFormValues((prev) => ({
        ...prev,
        customOutline: (prev.customOutline || "") + faqHints,
      }));
    }

    // Clear handoff from sessionStorage (one-time import)
    clearHandoff();
    setEventHandoffPayload(null);
    setShowEventImportBanner(false);

    // Clean receiver URL (handoff/businessId) without reload
    clearReceiverImportParamsFromUrl();

    // Show success toast
    showToast("Event imported into AI Content Writer");

    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector("form");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Handle "Dismiss" for Event Campaign Builder handoff
  const handleDismissEventImport = () => {
    // Clear handoff from sessionStorage
    clearHandoff();
    setEventHandoffPayload(null);
    setShowEventImportBanner(false);

    // Clean receiver URL (handoff/businessId) without reload
    clearReceiverImportParamsFromUrl();
  };

  // Collapsible sections state for Generated Content
  const [collapsedSections, setCollapsedSections] = useState({
    seoPack: false,
    outline: false,
    articleBody: false,
    faq: false,
    socialBlurb: false,
    keywordsUsed: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFormValue = <K extends keyof ContentWriterFormValues>(
    key: K,
    value: ContentWriterFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const processRequest = async (payload: ContentWriterFormValues) => {
    setLoading(true);
    setError("");
    setContentResponse(null);

    try {
      const apiPayload = {
        businessName: payload.businessName.trim() || undefined,
        businessType: payload.businessType.trim() || undefined,
        services: payload.services.trim() || undefined,
        city: payload.city.trim() || "Ocala",
        state: payload.state.trim() || "Florida",
        targetAudience: payload.targetAudience.trim() || undefined,
        topic: payload.topic.trim(),
        contentGoal: payload.contentGoal.trim() || undefined,
        contentType: payload.contentType,
        customOutline: payload.customOutline.trim() || undefined,
        tone: payload.tone.trim() || undefined,
        personalityStyle: payload.personalityStyle || undefined,
        brandVoice: payload.brandVoice.trim() || undefined,
        keywords: payload.keywords.trim() || undefined,
        language: payload.language,
        length: payload.length,
        writingStyleTemplate: payload.writingStyleTemplate,
        includeFAQ: payload.includeFAQ,
        includeSocialBlurb: payload.includeSocialBlurb,
        includeMetaDescription: payload.includeMetaDescription,
        mode: payload.mode,
        templateName: payload.templateName.trim() || undefined,
        templateNotes: payload.templateNotes.trim() || undefined,
        previousTemplateStructure: payload.previousTemplateStructure.trim() || undefined,
      };

      const res = await fetch("/api/content-writer", {
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

      // Handle standardized response format: { ok: true, data: ContentWriterResponse }
      const response: ContentWriterResponse = jsonResponse.data || jsonResponse;
      setContentResponse(response);
      setEditedContent(null); // Reset edited content when generating new content
      setEditHistory([]); // Clear edit history on new generation
      
      // Record generation in local analytics
      recordGeneration("cw-analytics");
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      setContentResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.topic.trim()) {
      setError("Please enter a topic to generate your content.");
      return;
    }

    setLastPayload(formValues);
    await processRequest(formValues);
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    await processRequest(lastPayload);
  };

  // Brand Profile: Apply profile to form (manual apply button)
  const handleApplyBrandProfile = (profile: BrandProfile, _fillEmptyOnlyFromPanel: boolean) => {
    // Use the fillEmptyOnly state from our checkbox, not from the panel
    const profileFromStorage = loadBrandProfile();
    if (!profileFromStorage) {
      showToast("No brand profile found. Please create one first.");
      return;
    }

    const mode = fillEmptyOnly ? "fill-empty-only" : "overwrite";
    const merged = applyBrandProfileToForm({
      form: formValues as unknown as Record<string, unknown>,
      brand: profileFromStorage,
      map: brandProfileMap,
      mode,
    });

    setFormValues(merged as unknown as ContentWriterFormValues);

    showToast(
      mode === "fill-empty-only"
        ? "Brand Profile applied to empty fields."
        : "Brand Profile applied (overwrote existing fields)."
    );
  };

  // Fix Packs: Handle applying fixes
  const handleApplyFix = (updatedFields: Partial<ContentOutput>, fixPackId?: string) => {
    if (!contentResponse?.content) return;
    
    // Push current state to history before applying
    const currentState = editedContent ?? contentResponse.content;
    setEditHistory((prev) => [...prev, currentState]);
    
    // Merge updated fields into a new edited content
    setEditedContent((prev) => ({
      ...(prev ?? contentResponse.content),
      ...updatedFields,
    }));
    
    // Record fix pack application in local analytics
    if (fixPackId) {
      recordFixPackApplied("cw-analytics", fixPackId);
    }
  };

  // Helper function to compare ContentOutput objects deterministically
  const compareContentOutput = (a: ContentOutput | null, b: ContentOutput | null): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    // Use JSON.stringify for deterministic comparison
    return JSON.stringify(a) === JSON.stringify(b);
  };

  // Fix Packs: Reset edited content to original
  const handleResetEdits = () => {
    setEditedContent(null);
    setEditHistory([]);
  };

  // Fix Packs: Undo last edit
  const handleUndoLastEdit = () => {
    if (editHistory.length === 0) return;
    
    // Pop the last state from history
    const nextEdited = editHistory[editHistory.length - 1];
    setEditHistory((prev) => prev.slice(0, -1));
    
    // Baseline content for comparison
    const baselineContent = contentResponse?.content ?? null;
    
    // If the next state matches baseline, set editedContent to null (back to baseline)
    // Otherwise, set it to the next edited state
    if (baselineContent && compareContentOutput(nextEdited, baselineContent)) {
      setEditedContent(null);
    } else {
      setEditedContent(nextEdited);
    }
  };

  // Canonical selector: Get the active content (edited if present, otherwise original)
  const getActiveContent = (): ContentOutput | null => {
    return editedContent ?? contentResponse?.content ?? null;
  };


  // Determine which content to display (edited if present, otherwise original)
  const displayContent = getActiveContent();
  
  // Compute activeContent once for use throughout the component
  const activeContent = getActiveContent();
  
  // Canonical derived boolean for tool availability
  const canUseTools = isContentReadyForExport(activeContent);

  // Determine content state for the chip
  const getContentState = (): "empty" | "generated" | "edited" => {
    if (!contentResponse?.content) return "empty";
    const baseline = contentResponse.content;
    const current = displayContent;
    if (!current) return "empty";
    return compareContentOutput(baseline, current) ? "generated" : "edited";
  };

  const contentState = getContentState();

  // Intersection Observer to detect when form sticky bar is scrolled past
  useEffect(() => {
    if (!formStickyBarRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Show scroll sticky bar when form sticky bar is not visible
          setShowScrollStickyBar(!entry.isIntersecting);
        });
      },
      {
        threshold: 0,
        rootMargin: "-100px 0px 0px 0px", // Trigger slightly before it's fully out of view
      }
    );

    observer.observe(formStickyBarRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Format content as plain text for copy/export
  const formatContentPlainText = (content: ContentOutput): string => {
    const parts: string[] = [];
    parts.push(`Title: ${content.title}`);
    parts.push(`SEO Title: ${content.seoTitle}`);
    parts.push(`Meta Description: ${content.metaDescription}`);
    parts.push(`Slug: ${content.slugSuggestion}`);
    parts.push("");
    parts.push("Outline:");
    content.outline.forEach((item, idx) => {
      parts.push(`${idx + 1}. ${item}`);
    });
    parts.push("");
    parts.push("Content:");
    content.sections.forEach((section) => {
      parts.push(`\n${section.heading}`);
      parts.push(section.body);
    });
    if (content.faq.length > 0) {
      parts.push("");
      parts.push("FAQ:");
      content.faq.forEach((faq) => {
        parts.push(`Q: ${faq.question}`);
        parts.push(`A: ${faq.answer}`);
        parts.push("");
      });
    }
    if (content.socialBlurb) {
      parts.push("");
      parts.push("Social Blurb:");
      parts.push(content.socialBlurb);
    }
    return parts.join("\n");
  };

  // Format content as markdown for export
  const formatContentMarkdown = (content: ContentOutput): string => {
    const parts: string[] = [];
    parts.push(`# ${content.title}\n`);
    parts.push(`**SEO Title:** ${content.seoTitle}\n`);
    parts.push(`**Meta Description:** ${content.metaDescription}\n`);
    parts.push(`**Slug:** ${content.slugSuggestion}\n`);
    parts.push("\n## Outline\n");
    content.outline.forEach((item, idx) => {
      parts.push(`${idx + 1}. ${item}`);
    });
    parts.push("\n## Content\n");
    content.sections.forEach((section) => {
      parts.push(`\n### ${section.heading}\n`);
      parts.push(section.body);
    });
    if (content.faq.length > 0) {
      parts.push("\n## FAQ\n");
      content.faq.forEach((faq) => {
        parts.push(`### Q: ${faq.question}\n`);
        parts.push(`${faq.answer}\n`);
      });
    }
    if (content.socialBlurb) {
      parts.push("\n## Social Blurb\n");
      parts.push(content.socialBlurb);
    }
    return parts.join("\n");
  };

  // Handle Copy Full
  const handleCopyFull = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    try {
      const text = formatContentPlainText(content);
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  // Copy functions for individual sections
  const copySEOPack = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    const text = `Title: ${content.title}\nSEO Title: ${content.seoTitle}\nMeta Description: ${content.metaDescription}\nURL Slug: ${content.slugSuggestion}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  const copyOutline = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    const text = content.outline.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  const copyArticleBody = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    const text = content.sections.map(s => `${s.heading}\n\n${s.body}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  const copyFAQ = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    const text = content.faq.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  const copySocialBlurb = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    if (!content.socialBlurb) return;
    try {
      await navigator.clipboard.writeText(content.socialBlurb);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  const copyKeywords = async () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    const text = content.keywordsUsed.join(", ");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Action failed");
    }
  };

  // Handle Export (download as markdown)
  // Ref to store the activate export tab function from BDWToolsTabs
  const activateExportTabRef = useRef<(() => void) | null>(null);

  // Handler to scroll to Export Center
  const handleScrollToExportCenter = () => {
    if (activateExportTabRef.current) {
      // Activate tab and scroll (function handles both)
      activateExportTabRef.current();
      showToast("Opened Export Center");
    } else {
      // Fallback: try to scroll directly if tab activation not available
      const element = document.getElementById("cw-export-center");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("Opened Export Center");
      } else {
        showToast("Action failed");
      }
    }
  };

  // Handler for markdown download (secondary action)
  const handleDownloadMarkdown = () => {
    const content = getActiveContent();
    if (!content) return;
    if (!isContentReadyForExport(content)) return;
    try {
      const markdown = formatContentMarkdown(content);
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${content.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Download started");
    } catch (error) {
      console.error("Failed to download:", error);
      showToast("Action failed");
    }
  };

  // Helper functions to generate summary lines for collapsed sections
  const getBusinessBasicsSummary = (): string => {
    const parts: string[] = [];
    if (formValues.businessName) parts.push(formValues.businessName);
    if (formValues.businessType) parts.push(formValues.businessType);
    if (formValues.city || formValues.state) {
      parts.push([formValues.city, formValues.state].filter(Boolean).join(", "));
    }
    return parts.length > 0 ? parts.join(" • ") : "Not filled";
  };

  const getContentBasicsSummary = (): string => {
    const parts: string[] = [];
    const contentTypeLabels: Record<string, string> = {
      BlogPost: "Blog Post",
      ServicePage: "Service Page",
      AboutUs: "About Page",
      LandingPage: "Landing Page",
      Email: "Email",
      LegalPolicy: "Legal/Policy",
      JobPost: "Job Post",
      Other: "Other",
    };
    parts.push(contentTypeLabels[formValues.contentType] || formValues.contentType);
    if (formValues.topic) parts.push(`"${formValues.topic.substring(0, 40)}${formValues.topic.length > 40 ? "..." : ""}"`);
    return parts.join(" • ");
  };

  const getTonePersonalitySummary = (): string => {
    const parts: string[] = [];
    if (formValues.tone) parts.push(formValues.tone);
    if (formValues.personalityStyle) parts.push(formValues.personalityStyle);
    if (formValues.brandVoice) parts.push("Brand Voice");
    return parts.length > 0 ? parts.join(" • ") : "Not set";
  };

  const getSeoLengthSummary = (): string => {
    const parts: string[] = [];
    const keywordCount = formValues.keywords ? formValues.keywords.split(/[,\n]/).filter(k => k.trim()).length : 0;
    if (keywordCount > 0) parts.push(`${keywordCount} keyword${keywordCount !== 1 ? "s" : ""}`);
    parts.push(formValues.length);
    parts.push(formValues.language);
    return parts.join(" • ");
  };

  const getStructureTemplatesSummary = (): string => {
    const parts: string[] = [];
    if (formValues.customOutline) parts.push("Custom Outline");
    if (formValues.templateName) parts.push(`Template: ${formValues.templateName}`);
    if (formValues.previousTemplateStructure) parts.push("Previous Structure");
    return parts.length > 0 ? parts.join(" • ") : "Not set";
  };

  const getOptionsSummary = (): string => {
    const parts: string[] = [];
    const toggles: string[] = [];
    if (formValues.includeFAQ) toggles.push("FAQ");
    if (formValues.includeSocialBlurb) toggles.push("Social");
    if (formValues.includeMetaDescription) toggles.push("Meta");
    if (toggles.length > 0) parts.push(toggles.join(", "));
    parts.push(`Mode: ${formValues.mode}`);
    return parts.join(" • ");
  };

  // Toggle accordion section
  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // If displayContent can be null, normalize it once for the render tree
  const safeDisplayContent: ContentOutput = displayContent ?? {
    title: "",
    seoTitle: "",
    metaDescription: "",
    slugSuggestion: "",
    outline: [],
    sections: [],
    faq: [],
    socialBlurb: "",
    preview: { cardTitle: "", cardSubtitle: "", cardExcerpt: "" },
    wordCountApprox: 0,
    keywordsUsed: [],
  };

  const hasDisplayContent =
    !!safeDisplayContent.seoTitle ||
    !!safeDisplayContent.metaDescription ||
    !!safeDisplayContent.slugSuggestion ||
    safeDisplayContent.outline.length > 0 ||
    safeDisplayContent.sections.length > 0 ||
    safeDisplayContent.faq.length > 0 ||
    !!safeDisplayContent.socialBlurb ||
    safeDisplayContent.keywordsUsed.length > 0;

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Content Writer"
      tagline="Write high-quality content for your business needs, from blog posts and service pages to emails, bios, policies, and job posts—all tailored for your Ocala business."
    >
      {/* Brand Profile Auto-Import Panel */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <div className="p-4 space-y-4">
            {/* Toggle: Use Brand Profile */}
            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
              <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={useBrandProfileToggle}
                  onChange={(e) => setUseBrandProfileToggle(e.target.checked)}
                  className="rounded"
                  disabled={!brandFound && !hasBrandProfile()}
                />
                <span className="text-sm font-medium">
                  Use Brand Profile (auto-fill empty fields)
                </span>
              </label>
              <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                {brandFound || hasBrandProfile()
                  ? "When enabled, your saved brand profile will automatically fill empty form fields on page load."
                  : "No brand profile found. Create one to enable auto-fill."}
              </p>
            </div>

            {/* Fill Empty Only Checkbox */}
            <div className="flex items-center gap-2">
              <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={fillEmptyOnly}
                  onChange={(e) => setFillEmptyOnly(e.target.checked)}
                  className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                />
                <span className="text-sm">Fill empty only</span>
              </label>
            </div>
          </div>
        </div>
      </OBDPanel>
      <BrandProfilePanel
        isDark={isDark}
        businessName={formValues.businessName}
        onApplyToForm={handleApplyBrandProfile}
        brandFound={brandFound}
        applied={applied}
        useBrandProfileToggle={useBrandProfileToggle}
        onUseBrandProfileToggleChange={setUseBrandProfileToggle}
        fillEmptyOnly={fillEmptyOnly}
        onFillEmptyOnlyChange={setFillEmptyOnly}
      />

      {/* Workflow Guidance */}
      <WorkflowGuidance
        isDark={isDark}
        currentStep={
          displayContent ? 3 : // Step 3: Fix & Export (content generated)
          formValues.topic.trim() ? 2 : // Step 2: Generate (topic filled)
          1 // Step 1: Business details (form empty)
        }
        storageKey="cw-workflow-guidance-dismissed"
      />

      {/* Import Banner */}
      {showLhaCareersImportBanner && lhaCareersHandoffPayload && (
        <div
          className={`mb-6 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isDark ? "bg-teal-900/20 border-teal-700" : "bg-teal-50 border-teal-200"
          }`}
        >
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                isDark ? "text-teal-300" : "text-teal-800"
              }`}
            >
              <strong>Imported draft from Local Hiring Assistant</strong>
            </p>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-teal-400" : "text-teal-700"
              }`}
            >
              Careers page draft (apply-only)
              {lhaCareersBusinessMismatch && (
                <span className="ml-2">• Draft did not match this business.</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!lhaCareersBusinessMismatch && (
              <button
                onClick={handleApplyLhaCareersToInputs}
                className={SUBMIT_BUTTON_CLASSES}
              >
                Apply to Inputs
              </button>
            )}
            <button
              onClick={handleDismissLhaCareersImport}
              className={getSecondaryButtonClasses(isDark)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showImportBanner && handoffPayload && (
        <FAQImportBanner
          isDark={isDark}
          payload={handoffPayload}
          isAlreadyImported={isHandoffAlreadyImported}
          onAddAsNewDraft={handleAddAsNewDraft}
          onAppendToCurrent={handleAppendToCurrent}
          onDismiss={handleDismissFaqImport}
          hasExistingContent={!!activeContent}
        />
      )}

      {showOffersImportBanner && offersHandoffPayload && (
        <OffersImportBanner
          isDark={isDark}
          payload={offersHandoffPayload}
          onApplyToInputs={handleApplyOffersToInputs}
          onDismiss={handleDismissOffersImport}
        />
      )}

      {showEventImportBanner && eventHandoffPayload && (
        <EventImportBanner
          isDark={isDark}
          payload={eventHandoffPayload}
          onApplyToInputs={handleApplyEventToInputs}
          onDismiss={handleDismissEventImport}
        />
      )}


      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
              <div className="space-y-4 pb-24">
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
                          value={formValues.businessName}
                          onChange={(e) => updateFormValue("businessName", e.target.value)}
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
                          value={formValues.businessType}
                          onChange={(e) => updateFormValue("businessType", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="e.g., Restaurant, Salon, Law Firm"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Services & Key Details
                      </label>
                      <textarea
                        id="services"
                        value={formValues.services}
                        onChange={(e) => updateFormValue("services", e.target.value)}
                        rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                        placeholder="List your main services, specialties, and any important details..."
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
                          value={formValues.city}
                          onChange={(e) => updateFormValue("city", e.target.value)}
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
                          value={formValues.state}
                          onChange={(e) => updateFormValue("state", e.target.value)}
                          className={getInputClasses(isDark)}
                          placeholder="Florida"
                        />
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {/* Content Basics Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("contentBasics")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Content Basics
                      </h3>
                      {!accordionState.contentBasics && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getContentBasicsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("contentBasics");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.contentBasics ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.contentBasics && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label htmlFor="contentType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Content Type
                      </label>
                  <select
                    id="contentType"
                    value={formValues.contentType}
                    onChange={(e) => updateFormValue("contentType", e.target.value as ContentWriterFormValues["contentType"])}
                    className={getInputClasses(isDark)}
                  >
                    <option value="BlogPost">Blog Post</option>
                    <option value="ServicePage">Service Page</option>
                    <option value="AboutUs">About Page</option>
                    <option value="Email">Email</option>
                    <option value="LegalPolicy">Legal/Policy Template</option>
                    <option value="JobPost">Job Post</option>
                    <option value="Other">Other</option>
                  </select>
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Create blogs, service pages, emails, bios, policies, job posts, and more for your Ocala business.
                  </p>
                </div>

                    <div>
                      <label htmlFor="topic" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Topic / Working Title <span className="text-red-500">*</span>
                      </label>
                  <input
                    type="text"
                    id="topic"
                    value={formValues.topic}
                    onChange={(e) => updateFormValue("topic", e.target.value)}
                    className={getInputClasses(isDark)}
                      placeholder="What would you like to write about?"
                      required
                    />
                    {!formValues.topic.trim() && (
                      <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                        Topic is required
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contentGoal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Content Goal (Optional)
                    </label>
                  <textarea
                    id="contentGoal"
                    value={formValues.contentGoal}
                    onChange={(e) => updateFormValue("contentGoal", e.target.value)}
                    rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                    placeholder="Educate customers, rank for a keyword, promote a seasonal offer, etc."
                  />
                  </div>

                  <div>
                    <label htmlFor="targetAudience" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Target Audience (Optional)
                    </label>
                  <input
                    type="text"
                    id="targetAudience"
                    value={formValues.targetAudience}
                    onChange={(e) => updateFormValue("targetAudience", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Local families, small businesses, retirees"
                  />
                  </div>
                    </div>
                  )}
                </div>

                {/* Tone & Personality Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("tonePersonality")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Tone & Personality
                      </h3>
                      {!accordionState.tonePersonality && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getTonePersonalitySummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("tonePersonality");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.tonePersonality ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.tonePersonality && (
                    <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tone" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Tone (Optional)
                        </label>
                    <input
                      type="text"
                      id="tone"
                      value={formValues.tone}
                      onChange={(e) => updateFormValue("tone", e.target.value)}
                      className={getInputClasses(isDark)}
                        placeholder="Friendly, informative, conversational, etc."
                      />
                      </div>

                      <div>
                        <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Personality Style (Optional)
                        </label>
                    <select
                      id="personalityStyle"
                      value={formValues.personalityStyle}
                      onChange={(e) => updateFormValue("personalityStyle", e.target.value as ContentWriterFormValues["personalityStyle"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">None</option>
                      <option value="Soft">Soft</option>
                      <option value="Bold">Bold</option>
                      <option value="High-Energy">High-Energy</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Brand Voice (Optional)
                      </label>
                  <textarea
                    id="brandVoice"
                    value={formValues.brandVoice}
                    onChange={(e) => updateFormValue("brandVoice", e.target.value)}
                    rows={3}
                          className={getInputClasses(isDark, "resize-none")}
                      placeholder="Paste a sample or describe your brand voice. This overrides personality style."
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>This overrides personality style.</p>
                    </div>
                    </div>
                  )}
                </div>

                {/* SEO & Length Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("seoLength")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        SEO & Length
                      </h3>
                      {!accordionState.seoLength && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getSeoLengthSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("seoLength");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.seoLength ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.seoLength && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label htmlFor="keywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Keywords (Optional)
                      </label>
                  <textarea
                    id="keywords"
                    value={formValues.keywords}
                    onChange={(e) => updateFormValue("keywords", e.target.value)}
                    rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                      placeholder="Separate with commas or new lines"
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Separate with commas or new lines.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Language
                        </label>
                    <select
                      id="language"
                      value={formValues.language}
                      onChange={(e) => updateFormValue("language", e.target.value as ContentWriterFormValues["language"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                        <option value="Bilingual">Bilingual</option>
                      </select>
                      </div>

                      <div>
                        <label htmlFor="length" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Length
                        </label>
                    <select
                      id="length"
                      value={formValues.length}
                      onChange={(e) => updateFormValue("length", e.target.value as ContentWriterFormValues["length"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                        <option value="Long">Long</option>
                      </select>
                      </div>

                      <div>
                        <label htmlFor="writingStyleTemplate" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Writing Style Template
                        </label>
                    <select
                      id="writingStyleTemplate"
                      value={formValues.writingStyleTemplate}
                      onChange={(e) => updateFormValue("writingStyleTemplate", e.target.value as ContentWriterFormValues["writingStyleTemplate"])}
                      className={getInputClasses(isDark)}
                    >
                      <option value="Default">Default</option>
                      <option value="Story-Driven">Story-Driven</option>
                      <option value="SEO-Friendly">SEO-Friendly</option>
                      <option value="Short & Punchy">Short & Punchy</option>
                        <option value="Luxury Premium">Luxury Premium</option>
                      </select>
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {/* Structure & Templates Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("structureTemplates")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Structure & Templates
                      </h3>
                      {!accordionState.structureTemplates && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getStructureTemplatesSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("structureTemplates");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.structureTemplates ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.structureTemplates && (
                    <div className="p-4 space-y-4">
                    <div>
                      <label htmlFor="customOutline" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Custom Outline (Optional)
                      </label>
                  <textarea
                    id="customOutline"
                    value={formValues.customOutline}
                    onChange={(e) => updateFormValue("customOutline", e.target.value)}
                    rows={4}
                          className={getInputClasses(isDark, "resize-none")}
                      placeholder="If provided, this will be used as the main structure..."
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>If you provide an outline, the AI will follow it as the main structure.</p>
                    </div>

                    <div>
                      <label htmlFor="templateName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Template Name (Optional)
                      </label>
                  <input
                    type="text"
                    id="templateName"
                    value={formValues.templateName}
                    onChange={(e) => updateFormValue("templateName", e.target.value)}
                    className={getInputClasses(isDark)}
                      placeholder="Name of a saved template"
                    />
                    </div>

                    <div>
                      <label htmlFor="templateNotes" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Template Notes (Optional)
                      </label>
                  <textarea
                    id="templateNotes"
                    value={formValues.templateNotes}
                    onChange={(e) => updateFormValue("templateNotes", e.target.value)}
                    rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                      placeholder="Describe how this template should feel or be used in the future"
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Describe how this template should feel or be used in the future.</p>
                    </div>

                    <div>
                      <label htmlFor="previousTemplateStructure" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Previous Template Structure You Liked (Optional)
                      </label>
                  <textarea
                    id="previousTemplateStructure"
                    value={formValues.previousTemplateStructure}
                    onChange={(e) => updateFormValue("previousTemplateStructure", e.target.value)}
                    rows={2}
                          className={getInputClasses(isDark, "resize-none")}
                      placeholder="Describe a structure you liked from a previous template"
                    />
                    </div>
                    </div>
                  )}
                </div>

                {/* Options Section */}
                <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div
                    className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                    onClick={() => toggleAccordion("options")}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        Options
                      </h3>
                      {!accordionState.options && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getOptionsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion("options");
                      }}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {accordionState.options ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {accordionState.options && (
                    <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={formValues.includeFAQ}
                          onChange={(e) => updateFormValue("includeFAQ", e.target.checked)}
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm">Include FAQ section</span>
                      </label>

                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={formValues.includeSocialBlurb}
                          onChange={(e) => updateFormValue("includeSocialBlurb", e.target.checked)}
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm">Include Social Blurb</span>
                      </label>

                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={formValues.includeMetaDescription}
                          onChange={(e) => updateFormValue("includeMetaDescription", e.target.checked)}
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm">Include Meta Description</span>
                      </label>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Mode
                      </label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                          <input
                            type="radio"
                            name="mode"
                            value="Content"
                            checked={formValues.mode === "Content"}
                            onChange={(e) => updateFormValue("mode", e.target.value as "Content")}
                            className="text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className="text-sm">Write full content</span>
                        </label>
                        <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                          <input
                            type="radio"
                            name="mode"
                            value="Ideas"
                            checked={formValues.mode === "Ideas"}
                            onChange={(e) => updateFormValue("mode", e.target.value as "Ideas")}
                            className="text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className="text-sm">Ideas only (no article)</span>
                        </label>
                        <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                          <input
                            type="radio"
                            name="mode"
                            value="Both"
                            checked={formValues.mode === "Both"}
                            onChange={(e) => updateFormValue("mode", e.target.value as "Both")}
                            className="text-[#29c4a9] focus:ring-[#29c4a9]"
                          />
                          <span className="text-sm">Ideas + full content</span>
                        </label>
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {error && !loading && (
                  <div className={`rounded-xl border p-3 ${isDark ? "bg-red-900/20 border-red-700 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
              
              <div ref={formStickyBarRef}>
                <OBDStickyActionBar isDark={isDark}>
                  <button
                    type="submit"
                    disabled={loading || !formValues.topic.trim()}
                    className={SUBMIT_BUTTON_CLASSES}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      "Start Writing"
                    )}
                  </button>
                </OBDStickyActionBar>
              </div>
            </form>
      </OBDPanel>

      {/* Results section */}
      {error && !contentResponse ? (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      ) : (
        <OBDResultsPanel
          title={
            <div className="flex items-center gap-2">
              <span>Generated Content</span>
              {contentState !== "empty" && (
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                  contentState === "edited"
                    ? isDark
                      ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700/50"
                      : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                    : isDark
                    ? "bg-slate-700 text-slate-200"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {contentState === "edited" ? "Edited" : "Generated"}
                </span>
              )}
            </div>
          }
          isDark={isDark}
          actions={
            contentResponse ? (
              <button
                onClick={() => handleRegenerate()}
                disabled={loading}
                className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {loading ? "Regenerating..." : "Regenerate"}
              </button>
            ) : undefined
          }
          loading={loading}
          loadingText="Generating content..."
          emptyTitle="No content yet"
          emptyDescription="Fill out the form above and click &quot;Start Writing&quot; to generate your content."
          className="mt-8"
        >
          {contentResponse ? (
                <div className="space-y-4">
                  {/* Summary Preview Card */}
                  {contentResponse.content.preview && (
                    <ContentCard title={contentResponse.content.preview.cardTitle} isDark={isDark}>
                      <div className="space-y-3">
                        <p className={`font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {contentResponse.content.preview.cardSubtitle}
                        </p>
                        <p className="whitespace-pre-wrap">{contentResponse.content.preview.cardExcerpt}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className={`px-2 py-1 rounded text-xs ${isDark ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                            {formValues.contentType}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${isDark ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                            {formValues.length}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${isDark ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                            ≈ {contentResponse.content.wordCountApprox.toLocaleString()} words
                          </span>
                        </div>
                      </div>
                    </ContentCard>
                  )}

                  {/* Blog Ideas (for Ideas or Both modes) */}
                  {contentResponse.blogIdeas.length > 0 && (
                    <ContentCard title="Blog / Content Ideas" isDark={isDark}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contentResponse.blogIdeas.map((idea, idx) => (
                          <div key={idx} className={`rounded-lg border p-3 ${
                            isDark ? "bg-slate-700/50 border-slate-600" : "bg-white border-slate-300"
                          }`}>
                            <h4 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                              {idea.title}
                            </h4>
                            <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>{idea.angle}</p>
                            <p className={`text-sm mb-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>{idea.description}</p>
                            <div className={`text-xs pt-2 border-t ${isDark ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                              Audience: {idea.targetAudience} · Recommended length: {idea.recommendedLength}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ContentCard>
                  )}

                  {/* Main Content */}
                  {contentResponse.mode !== "Ideas" && contentResponse.content.title && hasDisplayContent && (
                    <>
                      {/* Copy Bundles Toolbar */}
                      {activeContent && (
                        <div className={`rounded-xl border p-3 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <CWCopyBundles content={activeContent} isDark={isDark} storageKey="cw-analytics" />
                        </div>
                      )}

                      {/* SEO Pack Section */}
                      {(safeDisplayContent.title || safeDisplayContent.seoTitle || safeDisplayContent.metaDescription || safeDisplayContent.slugSuggestion) && (
                        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              SEO Pack
                            </h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={copySEOPack}
                                disabled={!canUseTools}
                                className={`p-1.5 rounded transition-colors ${!canUseTools ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                                title={!canUseTools ? "Generate content to enable this." : "Copy SEO Pack"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleSection("seoPack")}
                                className={`p-1.5 rounded transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${collapsedSections.seoPack ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!collapsedSections.seoPack && (
                            <div className="p-4 space-y-3">
                              {safeDisplayContent.title && (
                                <div>
                                  <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Title:</p>
                                  <p className={`text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>{safeDisplayContent.title}</p>
                                </div>
                              )}
                              {safeDisplayContent.seoTitle && (
                                <div>
                                  <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>SEO Title:</p>
                                  <p className={`text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>{safeDisplayContent.seoTitle}</p>
                                </div>
                              )}
                              {safeDisplayContent.metaDescription && (
                                <div>
                                  <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Meta Description:</p>
                                  <p className={`text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>{safeDisplayContent.metaDescription}</p>
                                </div>
                              )}
                              {safeDisplayContent.slugSuggestion && (
                                <div>
                                  <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>URL Slug:</p>
                                  <p className={`text-sm font-mono ${isDark ? "text-slate-100" : "text-slate-800"}`}>{safeDisplayContent.slugSuggestion}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Outline Section */}
                      {safeDisplayContent.outline.length > 0 && (
                        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              Outline
                            </h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={copyOutline}
                                disabled={!canUseTools}
                                className={`p-1.5 rounded transition-colors ${!canUseTools ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                                title={!canUseTools ? "Generate content to enable this." : "Copy Outline"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleSection("outline")}
                                className={`p-1.5 rounded transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${collapsedSections.outline ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!collapsedSections.outline && (
                            <div className="p-4">
                              <ul className="space-y-2 text-sm">
                                {safeDisplayContent.outline.map((item, idx) => (
                                  <li key={idx} className={`flex items-start gap-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                    <span className={`font-medium mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{idx + 1}.</span>
                                    <span className="flex-1 leading-relaxed">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Article Body Section */}
                      {safeDisplayContent.sections.length > 0 && (
                        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              Article Body
                            </h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={copyArticleBody}
                                disabled={!canUseTools}
                                className={`p-1.5 rounded transition-colors ${!canUseTools ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                                title={!canUseTools ? "Generate content to enable this." : "Copy Article Body"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleSection("articleBody")}
                                className={`p-1.5 rounded transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${collapsedSections.articleBody ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!collapsedSections.articleBody && (
                            <div className="p-4 space-y-6">
                              {safeDisplayContent.sections.map((section, idx) => (
                                <div key={idx} className="space-y-3">
                                  <h4 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                    {section.heading}
                                  </h4>
                                  <div className={`text-sm leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                    {section.body.split('\n\n').map((para, pIdx) => (
                                      <p key={pIdx} className={pIdx > 0 ? "mt-4" : ""}>{para.trim()}</p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* FAQ Section */}
                      {safeDisplayContent.faq.length > 0 && (
                        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              FAQ
                            </h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={copyFAQ}
                                disabled={!canUseTools}
                                className={`p-1.5 rounded transition-colors ${!canUseTools ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                                title={!canUseTools ? "Generate content to enable this." : "Copy FAQ"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleSection("faq")}
                                className={`p-1.5 rounded transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${collapsedSections.faq ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!collapsedSections.faq && (
                            <div className="p-4 space-y-4">
                              {safeDisplayContent.faq.map((faq, idx) => (
                                <div key={idx} className={idx > 0 ? "pt-4 border-t border-slate-300 dark:border-slate-600" : ""}>
                                  <p className={`font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                                    Q: {faq.question}
                                  </p>
                                  <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                    A: {faq.answer}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Social Blurb Section */}
                      {safeDisplayContent.socialBlurb && (
                        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              Social Blurb
                            </h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={copySocialBlurb}
                                disabled={!canUseTools}
                                className={`p-1.5 rounded transition-colors ${!canUseTools ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                                title={!canUseTools ? "Generate content to enable this." : "Copy Social Blurb"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleSection("socialBlurb")}
                                className={`p-1.5 rounded transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${collapsedSections.socialBlurb ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!collapsedSections.socialBlurb && (
                            <div className="p-4">
                              <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                {safeDisplayContent.socialBlurb}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Keywords Used Section */}
                      {safeDisplayContent.keywordsUsed.length > 0 && (
                        <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              Keywords Used
                            </h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={copyKeywords}
                                disabled={!canUseTools}
                                className={`p-1.5 rounded transition-colors ${!canUseTools ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                                title={!canUseTools ? "Generate content to enable this." : "Copy Keywords"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleSection("keywordsUsed")}
                                className={`p-1.5 rounded transition-colors ${isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${collapsedSections.keywordsUsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {!collapsedSections.keywordsUsed && (
                            <div className="p-4">
                              <div className="flex flex-wrap gap-2">
                                {safeDisplayContent.keywordsUsed.map((keyword, idx) => (
                                  <span key={idx} className={`px-2 py-1 rounded text-xs ${isDark ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* BDW Tools Panel */}
                  {contentResponse.mode !== "Ideas" && hasDisplayContent && activeContent && (
                    <>

                      {/* BDW Tools Tabs */}
                      <BDWToolsTabs
                        content={activeContent}
                        formValues={{ 
                          services: formValues.services, 
                          keywords: formValues.keywords,
                          businessName: formValues.businessName,
                          businessType: formValues.businessType,
                          topic: formValues.topic,
                        }}
                        baseContent={activeContent}
                        baselineContent={contentResponse.content}
                        editedContent={editedContent}
                        isDark={isDark}
                        canUseTools={canUseTools}
                        onApplyFix={handleApplyFix}
                        onReset={handleResetEdits}
                        onUndo={editHistory.length > 0 ? handleUndoLastEdit : undefined}
                        onToast={showToast}
                      />
                    </>
                  )}
                </div>
              ) : null}
        </OBDResultsPanel>
      )}

      {/* Toast Feedback - Above sticky bar */}
      {actionToast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm transition-opacity ${
            isDark 
              ? "bg-slate-800/90 border border-slate-700/50" 
              : "bg-white/90 border border-slate-200/50"
          }`}>
            {actionToast}
          </div>
        </div>
      )}

      {/* Scroll-based Sticky Action Bar */}
      {showScrollStickyBar && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 ${isDark ? "bg-slate-950/95 backdrop-blur-sm border-t border-slate-800/60" : "bg-white/95 backdrop-blur-sm border-t border-slate-200/60"} pb-[env(safe-area-inset-bottom)]`}>
          <div className="w-full max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Left: Content State Chip */}
              <div className="flex items-center gap-3 min-w-0">
                {contentState !== "empty" && (
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                    contentState === "edited"
                      ? isDark
                        ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700/50"
                        : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                      : isDark
                      ? "bg-slate-700 text-slate-200"
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {contentState === "edited" ? "Edited" : "Generated"}
                  </span>
                )}
              </div>

              {/* Right: Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Primary Button */}
                {contentResponse ? (
                  <button
                    onClick={() => handleRegenerate()}
                    disabled={loading}
                    className="px-6 py-2.5 bg-[#29c4a9] text-white font-medium rounded-full hover:bg-[#22ad93] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Regenerating...
                      </span>
                    ) : (
                      "Regenerate"
                    )}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const form = document.querySelector('form');
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                    disabled={loading || !formValues.topic.trim()}
                    className="px-6 py-2.5 bg-[#29c4a9] text-white font-medium rounded-full hover:bg-[#22ad93] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      "Start Writing"
                    )}
                  </button>
                )}

                {/* Secondary Buttons - Always show, disabled when no content */}
                <button
                  onClick={handleCopyFull}
                  disabled={!canUseTools}
                  className={getSecondaryButtonClasses(isDark)}
                  title={!canUseTools ? "Generate content to enable this." : "Copy Full"}
                >
                  Copy Full
                </button>
                <button
                  onClick={handleScrollToExportCenter}
                  disabled={!canUseTools}
                  className={getSecondaryButtonClasses(isDark)}
                  title={!canUseTools ? "Generate content to enable this." : "Go to Export Center"}
                >
                  Export
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  disabled={!canUseTools}
                  className={getSubtleButtonSmallClasses(isDark)}
                  title={!canUseTools ? "Generate content to enable this." : "Download as Markdown"}
                >
                  Download MD
                </button>

                {/* Tertiary Button - Reset */}
                {editedContent && (
                  <button
                    onClick={handleResetEdits}
                    className={getSubtleButtonSmallClasses(isDark)}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}

export default function ContentWriterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContentWriterPageContent />
    </Suspense>
  );
}
