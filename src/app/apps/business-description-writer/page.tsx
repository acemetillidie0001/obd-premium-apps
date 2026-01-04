"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDStatusBlock from "@/components/obd/OBDStatusBlock";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getSecondaryButtonClasses, getSubtleButtonSmallClasses, getSubtleButtonMediumClasses, getTabButtonClasses } from "@/lib/obd-framework/layout-helpers";
import { flags } from "@/lib/flags";
import SerpPreview from "@/components/seo/SerpPreview";
import SavedVersionsPanel from "@/components/bdw/SavedVersionsPanel";
import ContentReuseSuggestions from "@/components/bdw/ContentReuseSuggestions";
import DescriptionHealthCheck from "@/components/bdw/DescriptionHealthCheck";
import FixPacks from "@/components/bdw/FixPacks";
import BrandProfilePanel from "@/components/bdw/BrandProfilePanel";
import CopyBundles from "@/components/bdw/CopyBundles";
import QualityControlsTab from "@/components/bdw/QualityControlsTab";
import ExportCenterPanel from "@/components/bdw/ExportCenterPanel";
import WorkflowGuidance from "@/components/bdw/WorkflowGuidance";
import AnalyticsDetails from "@/components/bdw/AnalyticsDetails";
import { type BrandProfile } from "@/lib/utils/bdw-brand-profile";
import { saveVersion, type SavedVersion } from "@/lib/utils/bdw-saved-versions";
import { attemptPushToHelpDeskKnowledge } from "@/lib/utils/bdw-help-desk-integration";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import { createDbVersion } from "@/lib/utils/bdw-saved-versions-db";
import { buildCrmNotePack } from "@/lib/utils/bdw-crm-note-pack";
import { isBdwV4Enabled } from "@/lib/utils/feature-rollout";
// Import formatters and quality controls from BDW reuse kit
import {
  formatFullPackPlainText,
  formatFullPackMarkdown,
  formatWebsiteHtmlSnippet,
  formatGBPPackPlainText,
  formatWebsitePackPlainText,
  formatGBPBlock,
  formatWebsiteAboutBlock,
  formatSocialBioBlock,
  formatFAQBlock,
  formatMetaBlock,
  type BusinessDescriptionResponseExport,
} from "@/lib/bdw";
import { loadVersionMetadata } from "@/lib/utils/bdw-version-metadata";
import { recordGeneration, recordFixPackApplied } from "@/lib/bdw/local-analytics";

type PersonalityStyle = "Soft" | "Bold" | "High-Energy" | "Luxury";
type WritingStyleTemplate =
  | "Default"
  | "Story-Driven"
  | "SEO-Friendly"
  | "Short & Punchy"
  | "Luxury Premium";
type DescriptionLength = "Short" | "Medium" | "Long";

interface BusinessDescriptionFormValues {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  targetAudience: string;
  uniqueSellingPoints: string;
  keywords: string;
  brandVoice: string;
  personalityStyle?: PersonalityStyle | "";
  writingStyleTemplate: WritingStyleTemplate;
  includeFAQSuggestions: boolean;
  includeMetaDescription: boolean;
  descriptionLength: DescriptionLength;
  language: string;
}

const defaultFormValues: BusinessDescriptionFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  targetAudience: "",
  uniqueSellingPoints: "",
  keywords: "",
  brandVoice: "",
  personalityStyle: "",
  writingStyleTemplate: "Default",
  includeFAQSuggestions: true,
  includeMetaDescription: true,
  descriptionLength: "Medium",
  language: "English",
};

interface SocialBioPack {
  facebookBio: string;
  instagramBio: string;
  xBio: string;
  linkedinTagline: string;
}

interface FAQSuggestion {
  question: string;
  answer: string;
}

interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  socialBioPack: SocialBioPack;
  taglineOptions: string[];
  elevatorPitch: string;
  faqSuggestions: FAQSuggestion[];
  metaDescription: string | null;
}

interface ResultCardProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}

function ResultCard({ title, children, isDark }: ResultCardProps) {
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

// V4 Use Case Tabs Component
interface UseCaseTab {
  id: string;
  label: string;
  content: string;
  description: string;
}

interface UseCaseTabsProps {
  result: BusinessDescriptionResponse;
  isDark: boolean;
  isEdited?: boolean; // V5-4: Show edited badge when true
}

function UseCaseTabs({ result, isDark, isEdited = false }: UseCaseTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("obd");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const tabs: UseCaseTab[] = [
    {
      id: "obd",
      label: "OBD Directory Listing",
      content: result.obdListingDescription,
      description: "Short description for your OBD listing",
    },
    {
      id: "gbp",
      label: "Google Business Profile",
      content: result.googleBusinessDescription,
      description: "Medium-length description for Google Business Profile",
    },
    {
      id: "website",
      label: "Website / About Page",
      content: result.websiteAboutUs,
      description: "Long-form description for your website About page",
    },
    {
      id: "citations",
      label: "Citations / Short Bio",
      content: result.elevatorPitch,
      description: "Short bio for citations and directories",
    },
  ];

  const handleCopy = async (tabId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedTab(tabId);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const charCount = activeTabData.content.length;

  return (
    <div className={`rounded-xl border ${
      isDark
        ? "bg-slate-800/50 border-slate-700"
        : "bg-slate-50 border-slate-200"
    }`}>
      {/* Tab Headers */}
      <div className={`flex flex-wrap gap-2 p-4 border-b ${
        isDark ? "border-slate-700" : "border-slate-200"
      }`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${getTabButtonClasses(activeTab === tab.id, isDark)} flex items-center gap-2`}
          >
            {tab.label}
            {isEdited && (
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                activeTab === tab.id
                  ? "bg-white/20 text-white"
                  : isDark
                  ? "bg-slate-600 text-slate-200"
                  : "bg-slate-200 text-slate-700"
              }`}>
                Edited
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <OBDHeading level={2} isDark={isDark} className="text-sm font-semibold mb-1">
              {activeTabData.label}
            </OBDHeading>
            <p className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              {activeTabData.description}
            </p>
          </div>
          <button
            onClick={() => handleCopy(activeTab, activeTabData.content)}
            className={getSubtleButtonMediumClasses(isDark)}
          >
            {copiedTab === activeTab ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className={`rounded-lg border p-4 ${
          isDark
            ? "bg-slate-900/50 border-slate-600"
            : "bg-white border-slate-300"
        }`}>
          <p className={`whitespace-pre-wrap text-sm mb-3 ${
            isDark ? "text-slate-100" : "text-slate-700"
          }`}>
            {activeTabData.content}
          </p>
          <div className={`text-xs pt-2 border-t ${
            isDark
              ? "border-slate-600 text-slate-400"
              : "border-slate-300 text-slate-500"
          }`}>
            {charCount.toLocaleString()} characters
          </div>
        </div>
      </div>
    </div>
  );
}

// Content Packs Tabs Component (Level 2)
interface ContentPacksTabsProps {
  result: BusinessDescriptionResponse;
  isDark: boolean;
  isV4Enabled: boolean;
  formValues: BusinessDescriptionFormValues;
  onApplyFix?: (partialUpdated: Partial<BusinessDescriptionResponse>) => void;
}

function ContentPacksTabs({ result, isDark, isV4Enabled, formValues, onApplyFix }: ContentPacksTabsProps) {
  const [activePackTab, setActivePackTab] = useState<string>("social-bio");
  const [copiedItems, setCopiedItems] = useState<Record<string, string>>({});
  
  // Collapsed state for each pack (defaults: social-bio/taglines/faqs collapsed, elevator-pitch/meta expanded)
  const [collapsedPacks, setCollapsedPacks] = useState<Record<string, boolean>>({
    "social-bio": true, // collapsed by default
    "taglines": true, // collapsed by default
    "faqs": true, // collapsed by default
    "elevator-pitch": false, // expanded by default
    "meta": false, // expanded by default
  });

  const handleCopy = async (itemId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedItems((prev) => ({ ...prev, [itemId]: itemId }));
      setTimeout(() => {
        setCopiedItems((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const toggleCollapse = (packId: string) => {
    setCollapsedPacks((prev) => ({
      ...prev,
      [packId]: !prev[packId],
    }));
  };

  const packTabs = [
    { id: "social-bio", label: "Social Bio Pack" },
    { id: "taglines", label: "Tagline Options" },
    { id: "elevator-pitch", label: "Elevator Pitch" },
    { id: "faqs", label: "FAQ Suggestions" },
    { id: "meta", label: "SEO Meta Description" },
    { id: "export-center", label: "Export Center" },
    { id: "quality-controls", label: "Quality Controls" },
  ];

  const isCollapsed = collapsedPacks[activePackTab] ?? false;

  const getPackPreview = (packId: string): string | null => {
    switch (packId) {
      case "social-bio":
        return "4 items";
      case "taglines":
        return result.taglineOptions?.length ? `${result.taglineOptions.length} items` : null;
      case "faqs":
        return result.faqSuggestions?.length ? `${result.faqSuggestions.length} FAQs` : null;
      case "elevator-pitch":
        return result.elevatorPitch ? "Available" : null;
      case "meta":
        return result.metaDescription ? "Available" : null;
      default:
        return null;
    }
  };

  const renderPackContent = () => {
    const preview = getPackPreview(activePackTab);

    switch (activePackTab) {
      case "social-bio":
        if (isCollapsed) {
          return (
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {preview || "No content yet"}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-start justify-between mb-2">
                <p className={`font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>Facebook:</p>
                <button
                  onClick={() => handleCopy("social-facebook", result.socialBioPack.facebookBio)}
                  className={getSubtleButtonSmallClasses(isDark)}
                >
                  {copiedItems["social-facebook"] ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                {result.socialBioPack.facebookBio}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-start justify-between mb-2">
                <p className={`font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>Instagram:</p>
                <button
                  onClick={() => handleCopy("social-instagram", result.socialBioPack.instagramBio)}
                  className={getSubtleButtonSmallClasses(isDark)}
                >
                  {copiedItems["social-instagram"] ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                {result.socialBioPack.instagramBio}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-start justify-between mb-2">
                <p className={`font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>X (Twitter):</p>
                <button
                  onClick={() => handleCopy("social-x", result.socialBioPack.xBio)}
                  className={getSubtleButtonSmallClasses(isDark)}
                >
                  {copiedItems["social-x"] ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                {result.socialBioPack.xBio}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-start justify-between mb-2">
                <p className={`font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>LinkedIn Tagline:</p>
                <button
                  onClick={() => handleCopy("social-linkedin", result.socialBioPack.linkedinTagline)}
                  className={getSubtleButtonSmallClasses(isDark)}
                >
                  {copiedItems["social-linkedin"] ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                {result.socialBioPack.linkedinTagline}
              </p>
            </div>
          </div>
        );

      case "taglines":
        if (!result.taglineOptions || result.taglineOptions.length === 0) {
          return (
            <OBDStatusBlock
              variant="empty"
              title="No tagline options available"
              isDark={isDark}
            />
          );
        }
        if (isCollapsed) {
          return (
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {preview || "No content yet"}
            </div>
          );
        }
        return (
          <div className="space-y-3">
            {result.taglineOptions.map((tagline, idx) => (
              <div key={idx} className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
                <div className="flex items-start justify-between">
                  <p className={`flex-1 text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>{tagline}</p>
                  <button
                    onClick={() => handleCopy(`tagline-${idx}`, tagline)}
                    className={`ml-3 px-2 py-1 text-xs font-medium rounded transition-colors ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {copiedItems[`tagline-${idx}`] ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );

      case "elevator-pitch":
        if (!result.elevatorPitch) {
          return (
            <OBDStatusBlock
              variant="empty"
              title="No elevator pitch available"
              isDark={isDark}
            />
          );
        }
        if (isCollapsed) {
          return (
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {preview || "No content yet"}
            </div>
          );
        }
        return (
          <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
            <div className="flex items-start justify-end mb-3">
              <button
                onClick={() => handleCopy("elevator-pitch", result.elevatorPitch)}
                className={getSubtleButtonMediumClasses(isDark)}
              >
                {copiedItems["elevator-pitch"] ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {result.elevatorPitch}
            </p>
          </div>
        );

      case "faqs":
        if (!result.faqSuggestions || result.faqSuggestions.length === 0) {
          return (
            <OBDStatusBlock
              variant="empty"
              title="No FAQ suggestions available"
              isDark={isDark}
            />
          );
        }
        if (isCollapsed) {
          return (
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {preview || "No content yet"}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {result.faqSuggestions.map((faq, idx) => {
              const faqText = `Q: ${faq.question}\n\nA: ${faq.answer}`;
              return (
                <div key={idx} className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
                  <div className="flex items-start justify-end mb-3">
                    <button
                      onClick={() => handleCopy(`faq-${idx}`, faqText)}
                      className={getSubtleButtonSmallClasses(isDark)}
                    >
                      {copiedItems[`faq-${idx}`] ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className={`font-medium mb-2 text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Q: {faq.question}
                  </p>
                  <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                    A: {faq.answer}
                  </p>
                </div>
              );
            })}
          </div>
        );

      case "meta":
        if (!result.metaDescription) {
          return (
            <OBDStatusBlock
              variant="empty"
              title="No meta description available"
              isDark={isDark}
            />
          );
        }
        if (isCollapsed) {
          return (
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {preview || "No content yet"}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {isV4Enabled && (
              <div className="mb-4">
                <SerpPreview
                  title={
                    formValues.businessName.trim()
                      ? `${formValues.businessName.trim()}${formValues.city.trim() ? ` - ${formValues.city.trim()}, ${formValues.state.trim() || "Florida"}` : ""}`
                      : "Business Listing"
                  }
                  url=""
                  description={result.metaDescription}
                  isDark={isDark}
                />
              </div>
            )}
            <div className={`rounded-lg border p-4 ${isDark ? "bg-slate-900/50 border-slate-600" : "bg-white border-slate-300"}`}>
              <div className="flex items-start justify-end mb-3">
                <button
                  onClick={() => handleCopy("meta-description", result.metaDescription || "")}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {copiedItems["meta-description"] ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                {result.metaDescription}
              </p>
            </div>
          </div>
        );

      case "quality-controls":
        // Quality Controls tab - no collapse functionality
        return (
          <QualityControlsTab
            result={result}
            formValues={{ services: formValues.services, keywords: formValues.keywords }}
            isDark={isDark}
            onApplyFix={onApplyFix}
          />
        );

      case "export-center":
        // Export Center tab - no collapse functionality
        return <ExportCenterPanel result={result} isDark={isDark} storageKey="bdw-analytics" />;

      default:
        return null;
    }
  };

  return (
    <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
      {/* Tab Headers */}
      <div className={`flex flex-wrap gap-2 p-4 border-b items-center justify-between ${isDark ? "border-slate-700" : "border-slate-200"}`}>
        <div className="flex flex-wrap gap-2">
        {packTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePackTab(tab.id)}
            role="tab"
            aria-selected={activePackTab === tab.id}
            className={getTabButtonClasses(activePackTab === tab.id, isDark)}
          >
            {tab.label}
          </button>
        ))}
        </div>
        <AnalyticsDetails storageKey="bdw-analytics" isDark={isDark} />
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Pack Header with Toggle (hidden for Export Center and Quality Controls) */}
        {activePackTab !== "export-center" && activePackTab !== "quality-controls" && (
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark} className="text-sm font-semibold">
              {packTabs.find((tab) => tab.id === activePackTab)?.label}
            </OBDHeading>
            <button
              onClick={() => toggleCollapse(activePackTab)}
              aria-expanded={!isCollapsed}
              className={getSubtleButtonMediumClasses(isDark)}
            >
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        )}
        {renderPackContent()}
      </div>
    </div>
  );
}

// Loaded Version Banner Component
interface LoadedVersionBannerProps {
  versionInfo: { id: string; label: string };
  isDark: boolean;
  onClear: () => void;
  onReset?: () => void;
}

function LoadedVersionBanner({ versionInfo, isDark, onClear, onReset }: LoadedVersionBannerProps) {
  const metadata = loadVersionMetadata(versionInfo.id);
  const tags = metadata?.tags?.trim() || null;

  return (
    <div className={`rounded-lg border p-3 mb-4 ${
      isDark
        ? "bg-blue-900/20 border-blue-700"
        : "bg-blue-50 border-blue-200"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${
              isDark ? "text-blue-200" : "text-blue-800"
            }`}>
              Loaded Saved Version: {versionInfo.label}
            </span>
            {tags && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                isDark
                  ? "bg-blue-900/30 text-blue-300"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {tags}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
                        className={getSubtleButtonMediumClasses(isDark)}
            >
              Reset to loaded
            </button>
          )}
          <button
            onClick={onClear}
                        className={getSubtleButtonMediumClasses(isDark)}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// Regenerate Dropdown Component
interface RegenerateDropdownProps {
  onRegenerate: (mode: "everything" | "destinations" | "packs") => void | Promise<void>;
  loading: boolean;
  isDark: boolean;
}

function RegenerateDropdown({ onRegenerate, loading, isDark }: RegenerateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (mode: "everything" | "destinations" | "packs") => {
    onRegenerate(mode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`${getSecondaryButtonClasses(isDark)} flex items-center gap-2`}
      >
        {loading ? "Regenerating..." : "Regenerate"}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-56 rounded-lg border shadow-lg z-10 ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="py-1">
            <button
              onClick={() => handleSelect("everything")}
              disabled={loading}
              className={`w-full text-left px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "text-slate-200 hover:bg-slate-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Regenerate Everything
            </button>
            <button
              onClick={() => handleSelect("destinations")}
              disabled={loading}
              className={`w-full text-left px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "text-slate-200 hover:bg-slate-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Regenerate Destination Output only
            </button>
            <button
              onClick={() => handleSelect("packs")}
              disabled={loading}
              className={`w-full text-left px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "text-slate-200 hover:bg-slate-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Regenerate Content Packs only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessDescriptionWriterPage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  // V4 Feature Flag: Staged rollout with allowlist and query param override
  const userEmail = session?.user?.email ?? null;
  const isV4Enabled = isBdwV4Enabled({
    masterEnabled: flags.bdwV4,
    userEmail,
    searchParams,
  });

  // V4: Resolve businessId with fallback chain (URL params → future: session → future: context)
  const resolvedBusinessId = resolveBusinessId(searchParams);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [formValues, setFormValues] = useState<BusinessDescriptionFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BusinessDescriptionResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<BusinessDescriptionFormValues | null>(null);
  const [savedVersionsOpen, setSavedVersionsOpen] = useState(false);
  
  // Loaded saved version tracking
  const [loadedSavedVersion, setLoadedSavedVersion] = useState<{ id: string; label: string } | null>(null);
  const [loadedFormSnapshot, setLoadedFormSnapshot] = useState<BusinessDescriptionFormValues | null>(null);
  
  // V5-2: Edited result state (for fix packs)
  const [editedResult, setEditedResult] = useState<BusinessDescriptionResponse | null>(null);

  // V5-2: Determine which result to display (edited if present, otherwise original)
  const displayResult = editedResult ?? result;
  
  // V5-4: Edit history stack for undo
  const [editHistory, setEditHistory] = useState<BusinessDescriptionResponse[]>([]);
  
  // V4: Help Desk integration state
  const [helpDeskPushing, setHelpDeskPushing] = useState(false);
  const [helpDeskError, setHelpDeskError] = useState<string | null>(null);
  const [helpDeskSuccess, setHelpDeskSuccess] = useState(false);

  const updateFormValue = <K extends keyof BusinessDescriptionFormValues>(
    key: K,
    value: BusinessDescriptionFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  type RegenerateMode = "everything" | "destinations" | "packs";

  const processRequest = async (payload: BusinessDescriptionFormValues, mode: RegenerateMode = "everything") => {
    setLoading(true);
    setError("");
    
    // Only clear result for "everything" mode; for selective modes, we'll merge
    if (mode === "everything") {
      setResult(null);
    }

    try {
      const apiPayload = {
        businessName: payload.businessName.trim(),
        businessType: payload.businessType.trim(),
        services: payload.services.trim(),
        city: payload.city.trim() || "Ocala",
        state: payload.state.trim() || "Florida",
        targetAudience: payload.targetAudience.trim() || undefined,
        uniqueSellingPoints: payload.uniqueSellingPoints.trim() || undefined,
        keywords: payload.keywords.trim() || undefined,
        brandVoice: payload.brandVoice.trim() || undefined,
        personalityStyle: payload.personalityStyle || undefined,
        writingStyleTemplate: payload.writingStyleTemplate || "Default",
        includeFAQSuggestions: payload.includeFAQSuggestions ?? true,
        includeMetaDescription: payload.includeMetaDescription ?? true,
        descriptionLength: payload.descriptionLength || "Medium",
        language: payload.language || "English",
      };

      const res = await fetch("/api/business-description-writer", {
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

      // Handle standardized response format: { ok: true, data: BusinessDescriptionResponse }
      const newResponse: BusinessDescriptionResponse = jsonResponse.data || jsonResponse;
      
      // Selective replacement: merge new response with existing result based on mode
      if (mode === "everything" || !result) {
        setResult(newResponse);
      } else if (mode === "destinations") {
        // Replace only destination fields, preserve packs
        setResult({
          ...result,
          obdListingDescription: newResponse.obdListingDescription,
          googleBusinessDescription: newResponse.googleBusinessDescription,
          websiteAboutUs: newResponse.websiteAboutUs,
          elevatorPitch: newResponse.elevatorPitch, // Citations/Short Bio uses elevatorPitch
        });
      } else if (mode === "packs") {
        // Replace only pack fields, preserve destinations
        setResult({
          ...result,
          socialBioPack: newResponse.socialBioPack,
          taglineOptions: newResponse.taglineOptions,
          faqSuggestions: newResponse.faqSuggestions,
          metaDescription: newResponse.metaDescription,
          elevatorPitch: newResponse.elevatorPitch, // Elevator Pitch is part of Content Packs
        });
      }
      
      setEditedResult(null); // Reset edited result when generating new content
      setEditHistory([]); // V5-4: Clear edit history on new generation
      
      // Record generation in local analytics
      recordGeneration("bdw-analytics");
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      if (mode === "everything") {
        setResult(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.businessName.trim()) {
      setError("Please enter a business name to continue.");
      return;
    }

    setLastPayload(formValues);
    await processRequest(formValues);
  };

  const handleRegenerate = async (mode: RegenerateMode = "everything") => {
    if (!lastPayload) return;
    await processRequest(lastPayload, mode);
  };

  // V4: Save current version (DB-first with localStorage fallback)
  const handleSaveVersion = async () => {
    // Use editedResult if available, otherwise use original result
    const resultToSave = editedResult || result;
    
    if (!resultToSave || !formValues.businessName.trim()) {
      alert("Please generate descriptions first and ensure business name is filled.");
      return;
    }

    const versionData = {
      businessName: formValues.businessName.trim(),
      city: formValues.city.trim() || "Ocala",
      state: formValues.state.trim() || "Florida",
      inputs: {
        businessName: formValues.businessName || "",
        businessType: formValues.businessType || "",
        services: formValues.services || "",
        city: formValues.city || "",
        state: formValues.state || "",
        targetAudience: formValues.targetAudience || "",
        uniqueSellingPoints: formValues.uniqueSellingPoints || "",
        keywords: formValues.keywords || "",
        brandVoice: formValues.brandVoice || "",
        personalityStyle: formValues.personalityStyle || "",
        writingStyleTemplate: formValues.writingStyleTemplate || "Default",
        includeFAQSuggestions: formValues.includeFAQSuggestions ?? true,
        includeMetaDescription: formValues.includeMetaDescription ?? true,
        descriptionLength: formValues.descriptionLength || "Medium",
        language: formValues.language || "English",
      },
      outputs: {
        obdListingDescription: resultToSave.obdListingDescription,
        googleBusinessDescription: resultToSave.googleBusinessDescription,
        websiteAboutUs: resultToSave.websiteAboutUs,
        metaDescription: resultToSave.metaDescription,
      },
    };

    // If businessId exists, try DB first
    if (resolvedBusinessId) {
      try {
        await createDbVersion(resolvedBusinessId, versionData);
        alert("Version saved to cloud!");
        return;
      } catch (error: any) {
        // If DB fails with DB_UNAVAILABLE, fallback to localStorage
        if (error.code === "DB_UNAVAILABLE") {
          console.log("[BDW] DB unavailable, saving to localStorage");
          // Fall through to localStorage
        } else {
          // Other errors (401, 403, etc.) - still fallback to localStorage
          console.error("[BDW] Error saving to DB:", error);
          // Fall through to localStorage
        }
      }
    }

    // Fallback to localStorage (or use it if no businessId)
    try {
      saveVersion(versionData);
      // Show simple "Saved locally" message (non-scary fallback)
      alert("Saved locally");
    } catch (error) {
      console.error("Error saving version to localStorage:", error);
      alert("Failed to save version. Please try again.");
    }
  };

  // V4: Load inputs from saved version
  const handleLoadInputs = (
    inputs: SavedVersion["inputs"],
    versionInfo?: { id: string; label: string }
  ) => {
    const newFormValues: BusinessDescriptionFormValues = {
      businessName: inputs.businessName || "",
      businessType: inputs.businessType || "",
      services: inputs.services || "",
      city: inputs.city || "Ocala",
      state: inputs.state || "Florida",
      targetAudience: inputs.targetAudience || "",
      uniqueSellingPoints: inputs.uniqueSellingPoints || "",
      keywords: inputs.keywords || "",
      brandVoice: inputs.brandVoice || "",
      personalityStyle: (inputs.personalityStyle as PersonalityStyle | "") || "",
      writingStyleTemplate: (inputs.writingStyleTemplate as WritingStyleTemplate) || "Default",
      includeFAQSuggestions: inputs.includeFAQSuggestions ?? true,
      includeMetaDescription: inputs.includeMetaDescription ?? true,
      descriptionLength: (inputs.descriptionLength as DescriptionLength) || "Medium",
      language: inputs.language || "English",
    };
    
    setFormValues(newFormValues);
    
    // Track loaded version and snapshot
    if (versionInfo) {
      setLoadedSavedVersion(versionInfo);
      setLoadedFormSnapshot(newFormValues);
    }
  };
  
  // Clear loaded version state
  const handleClearLoadedVersion = () => {
    setLoadedSavedVersion(null);
    setLoadedFormSnapshot(null);
  };
  
  // Reset form to loaded snapshot
  const handleResetToLoaded = () => {
    if (loadedFormSnapshot) {
      setFormValues(loadedFormSnapshot);
    }
  };

  // Brand Profile: Apply profile to form
  const handleApplyBrandProfile = (profile: BrandProfile, fillEmptyOnly: boolean) => {
    setFormValues((prev) => {
      const updates: Partial<BusinessDescriptionFormValues> = {};

      if (profile.brandVoice) {
        if (!fillEmptyOnly || !prev.brandVoice.trim()) {
          updates.brandVoice = profile.brandVoice;
        }
      }

      if (profile.targetAudience) {
        if (!fillEmptyOnly || !prev.targetAudience.trim()) {
          updates.targetAudience = profile.targetAudience;
        }
      }

      if (profile.uniqueSellingPoints) {
        if (!fillEmptyOnly || !prev.uniqueSellingPoints.trim()) {
          updates.uniqueSellingPoints = profile.uniqueSellingPoints;
        }
      }

      if (profile.services) {
        if (!fillEmptyOnly || !prev.services.trim()) {
          updates.services = profile.services;
        }
      }

      if (profile.city) {
        if (!fillEmptyOnly || !prev.city.trim()) {
          updates.city = profile.city;
        }
      }

      if (profile.state) {
        if (!fillEmptyOnly || !prev.state.trim()) {
          updates.state = profile.state;
        }
      }

      return { ...prev, ...updates };
    });
  };

  // V4: Push to AI Help Desk Knowledge
  const handlePushToHelpDesk = async () => {
    if (!result || !resolvedBusinessId) {
      setHelpDeskError("Business ID is required. Please access this page from your OBD dashboard or with a businessId parameter.");
      return;
    }

    setHelpDeskPushing(true);
    setHelpDeskError(null);
    setHelpDeskSuccess(false);

    try {
      // Build content: prefer long description + meta description
      const contentParts: string[] = [];
      
      // Add website About Us (long description)
      if (result.websiteAboutUs) {
        contentParts.push("## Business Description\n\n" + result.websiteAboutUs);
      }
      
      // Add meta description if available
      if (result.metaDescription) {
        contentParts.push("\n## SEO Meta Description\n\n" + result.metaDescription);
      }

      const content = contentParts.join("\n\n") || result.obdListingDescription || "Business description content";

      const title = `Business Description — ${formValues.businessName.trim() || "Business"}`;

      const pushResult = await attemptPushToHelpDeskKnowledge({
        businessId: resolvedBusinessId,
        title,
        content,
        tags: ["business-overview", "bdw"],
      });

      if (pushResult.success) {
        setHelpDeskSuccess(true);
        setHelpDeskError(null);
        // Clear success message after 3 seconds
        setTimeout(() => setHelpDeskSuccess(false), 3000);
      } else {
        setHelpDeskError(pushResult.error || "Failed to add to knowledge base");
        setHelpDeskSuccess(false);
      }
    } catch (error) {
      console.error("Error pushing to help desk:", error);
      setHelpDeskError(error instanceof Error ? error.message : "Unknown error occurred");
      setHelpDeskSuccess(false);
    } finally {
      setHelpDeskPushing(false);
    }
  };

  // Check if help desk button should be shown
  // Only show when businessId is resolved (from URL, session, or context)
  const canShowHelpDeskButton = isV4Enabled && resolvedBusinessId !== null;

  // V4.5: Copy CRM Note Pack handler (always available if V4 enabled and result exists)
  const handleCopyCrmNotePack = async () => {
    if (!result || !formValues.businessName.trim()) {
      return;
    }

    try {
      const notePack = buildCrmNotePack({
        businessName: formValues.businessName.trim(),
        city: formValues.city.trim() || undefined,
        state: formValues.state.trim() || undefined,
        result,
      });

      await navigator.clipboard.writeText(notePack);
    } catch (error) {
      console.error("Failed to copy CRM note pack:", error);
      alert("Failed to copy note pack. Please try again.");
    }
  };

  // V4.5: Send to CRM Notes handler
  // NOTE: For V4.5, this is hidden because CRM notes endpoint requires a contactId,
  // and BDW only has businessId. In a future version, we could:
  // - Find/create a contact from businessId
  // - Or add a business-level notes endpoint
  // For now, we only support copy-only.
  const handleSendToCrmNotes = async () => {
    // This would call a CRM integration helper if we had contactId
    // For V4.5, this is intentionally not implemented
    console.log("[BDW] Send to CRM Notes not available - requires contactId");
  };

  // V4.5: Show "Send to CRM Notes" button only if:
  // - V4 is enabled
  // - businessId is resolved
  // - A safe endpoint exists (for V4.5, this is false - endpoint requires contactId)
  const canShowSendToCrmButton = false; // V4.5: Disabled - endpoint requires contactId

  // V5-2: Handle applying fix packs
  const handleApplyFix = (updatedFields: Partial<BusinessDescriptionResponse>, fixPackId?: string) => {
    if (!result) return;
    
    // V5-4: Push current state to history before applying
    const currentState = editedResult ?? result;
    setEditHistory((prev) => [...prev, currentState]);
    
    // Merge updated fields into a new edited result (null-safe: if result missing, do nothing)
    setEditedResult((prev) => ({
      ...(prev ?? result),
      ...updatedFields,
    }));
    
    // Record fix pack application in local analytics
    if (fixPackId) {
      recordFixPackApplied("bdw-analytics", fixPackId);
    }
  };

  // V5-2: Reset edited result to original
  const handleResetEdits = () => {
    setEditedResult(null);
    setEditHistory([]); // V5-4: Clear history on reset
  };

  // V5-4: Undo last edit
  const handleUndoLastEdit = () => {
    if (editHistory.length === 0) return;
    
    const previousState = editHistory[editHistory.length - 1];
    setEditHistory((prev) => prev.slice(0, -1));
    setEditedResult(previousState === result ? null : previousState);
  };


  // V5-2: Push improved content to Help Desk
  const [helpDeskPushingImproved, setHelpDeskPushingImproved] = useState(false);
  const [helpDeskImprovedError, setHelpDeskImprovedError] = useState<string | null>(null);
  const [helpDeskImprovedSuccess, setHelpDeskImprovedSuccess] = useState(false);

  const handlePushImprovedToHelpDesk = async () => {
    if (!displayResult || !resolvedBusinessId) {
      setHelpDeskImprovedError("Business ID is required. Please access this page from your OBD dashboard or with a businessId parameter.");
      return;
    }

    setHelpDeskPushingImproved(true);
    setHelpDeskImprovedError(null);
    setHelpDeskImprovedSuccess(false);

    try {
      // Build content from displayResult (edited version if available)
      const contentParts: string[] = [];
      
      // Add website About Us (long description)
      if (displayResult.websiteAboutUs) {
        contentParts.push("## Business Description\n\n" + displayResult.websiteAboutUs);
      }
      
      // Add meta description if available
      if (displayResult.metaDescription) {
        contentParts.push("\n## SEO Meta Description\n\n" + displayResult.metaDescription);
      }

      const content = contentParts.join("\n\n") || displayResult.obdListingDescription || "Business description content";

      const title = `Business Description — ${formValues.businessName.trim() || "Business"}`;

      const pushResult = await attemptPushToHelpDeskKnowledge({
        businessId: resolvedBusinessId,
        title,
        content,
        tags: ["business-overview", "bdw"],
      });

      if (pushResult.success) {
        setHelpDeskImprovedSuccess(true);
        setHelpDeskImprovedError(null);
        // Clear success message after 3 seconds
        setTimeout(() => setHelpDeskImprovedSuccess(false), 3000);
      } else {
        setHelpDeskImprovedError(pushResult.error || "Failed to add to knowledge base");
        setHelpDeskImprovedSuccess(false);
      }
    } catch (error) {
      console.error("Error pushing improved content to help desk:", error);
      setHelpDeskImprovedError(error instanceof Error ? error.message : "Unknown error occurred");
      setHelpDeskImprovedSuccess(false);
    } finally {
      setHelpDeskPushingImproved(false);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Business Description Writer"
      tagline="Create compelling business descriptions tailored to your Ocala business that capture your unique value proposition."
    >
      {/* Brand Profile Panel */}
      <BrandProfilePanel
        isDark={isDark}
        businessName={formValues.businessName}
        onApplyToForm={handleApplyBrandProfile}
      />

      {/* Workflow Guidance */}
      <WorkflowGuidance
        isDark={isDark}
        currentStep={
          displayResult ? 3 : // Step 3: Fix & Export (content generated)
          formValues.businessName.trim() ? 2 : // Step 2: Generate (form filled)
          1 // Step 1: Business details (form empty)
        }
        storageKey="bdw-workflow-guidance-dismissed"
      />

      {/* Loaded Version Banner */}
      {loadedSavedVersion && (
        <LoadedVersionBanner
          versionInfo={loadedSavedVersion}
          isDark={isDark}
          onClear={handleClearLoadedVersion}
          onReset={loadedFormSnapshot ? handleResetToLoaded : undefined}
        />
      )}

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        {/* V4 INSERTION POINT: Add V4 form enhancements here when flags.bdwV4 is true */}
        {/* When V4 is enabled, new UI components can be added above or within the form */}
        <form onSubmit={handleSubmit}>
              <div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
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
                    placeholder="e.g., Ocala Coffee Shop"
                    required
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
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Services
                  </label>
                  <textarea
                    id="services"
                    value={formValues.services}
                    onChange={(e) => updateFormValue("services", e.target.value)}
                    rows={4}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Describe your main services, products, policies, hours, etc..."
                    required
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

                <div>
                  <label htmlFor="uniqueSellingPoints" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Unique Selling Points (Optional)
                  </label>
                  <textarea
                    id="uniqueSellingPoints"
                    value={formValues.uniqueSellingPoints}
                    onChange={(e) => updateFormValue("uniqueSellingPoints", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="List what makes your business stand out..."
                  />
                </div>

                <div>
                  <label htmlFor="keywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Keywords (Optional)
                  </label>
                  <input
                    type="text"
                    id="keywords"
                    value={formValues.keywords}
                    onChange={(e) => updateFormValue("keywords", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Comma-separated: e.g., Ocala pressure washing, driveway cleaning"
                  />
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
                    placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                  />
                </div>

                <div>
                  <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Personality Style (Optional)
                  </label>
                  <select
                    id="personalityStyle"
                    value={formValues.personalityStyle || ""}
                    onChange={(e) => updateFormValue("personalityStyle", e.target.value as PersonalityStyle | "")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="">No specific style</option>
                    <option value="Soft">Soft</option>
                    <option value="Bold">Bold</option>
                    <option value="High-Energy">High-Energy</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="writingStyleTemplate" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Writing Style Template
                  </label>
                  <select
                    id="writingStyleTemplate"
                    value={formValues.writingStyleTemplate}
                    onChange={(e) => updateFormValue("writingStyleTemplate", e.target.value as WritingStyleTemplate)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Default">Default</option>
                    <option value="Story-Driven">Story-Driven</option>
                    <option value="SEO-Friendly">SEO-Friendly</option>
                    <option value="Short & Punchy">Short & Punchy</option>
                    <option value="Luxury Premium">Luxury Premium</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="descriptionLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Description Length
                  </label>
                  <select
                    id="descriptionLength"
                    value={formValues.descriptionLength}
                    onChange={(e) => updateFormValue("descriptionLength", e.target.value as DescriptionLength)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Short">Short</option>
                    <option value="Medium">Medium</option>
                    <option value="Long">Long</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Language
                  </label>
                  <select
                    id="language"
                    value={formValues.language}
                    onChange={(e) => updateFormValue("language", e.target.value)}
                    className={getInputClasses(isDark)}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Bilingual (English + Spanish)">Bilingual (English + Spanish)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeFAQSuggestions}
                      onChange={(e) => updateFormValue("includeFAQSuggestions", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include FAQ suggestions</span>
                  </label>

                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeMetaDescription}
                      onChange={(e) => updateFormValue("includeMetaDescription", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include SEO meta description</span>
                  </label>
                </div>
              </div>
              
              <OBDStickyActionBar isDark={isDark}>
                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating..." : "Create Description"}
                </button>
              </OBDStickyActionBar>
            </form>
      </OBDPanel>

      {/* V4 Staged Rollout Notice - shown when master flag is true but user is not enabled */}
      {flags.bdwV4 && !isV4Enabled && (
        <OBDPanel isDark={isDark} className="mt-4">
          <div className={`rounded-lg border p-3 ${
            isDark
              ? "bg-slate-800/30 border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              V4 is in staged rollout. Add <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs">?bdwV4=1</code> to preview.
            </p>
          </div>
        </OBDPanel>
      )}

      {/* Results section */}
      {error ? (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      ) : (
        <OBDResultsPanel
          title="Generated Content"
          isDark={isDark}
          actions={
            result ? (
              <div className="flex gap-2">
                {isV4Enabled && (
                  <>
                    <button
                      onClick={handleSaveVersion}
                      disabled={loading}
                      className={getSecondaryButtonClasses(isDark)}
                    >
                      Save Version
                    </button>
                    <button
                      onClick={() => setSavedVersionsOpen(true)}
                      className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                        isDark
                          ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      View Saved
                    </button>
                  </>
                )}
                <RegenerateDropdown
                  onRegenerate={handleRegenerate}
                  loading={loading}
                  isDark={isDark}
                />
              </div>
            ) : undefined
          }
          loading={loading}
          loadingText="Generating description..."
          emptyTitle="No descriptions yet"
          emptyDescription="Fill out the form above and click &quot;Create Description&quot; to generate your business descriptions."
          className="mt-8"
        >
          {displayResult ? (
                <div className="grid grid-cols-1 gap-6">
                  {/* V5-2: Reset edits button - shown when editedResult exists */}
                  {editedResult && isV4Enabled && (
                    <div className={`rounded-lg border p-3 flex items-center justify-between ${
                      isDark
                        ? "bg-slate-800/30 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className={`text-sm ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}>
                        ✓ Showing edited version. Original content preserved.
                      </p>
                      <button
                        onClick={handleResetEdits}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        Reset to Original
                      </button>
                    </div>
                  )}

                  {/* V4 Use Case Tabs - Only shown when flags.bdwV4 is true */}
                  {isV4Enabled ? (
                    <UseCaseTabs result={displayResult} isDark={isDark} isEdited={!!editedResult} />
                  ) : (
                    <>
                      {/* Legacy result cards - shown when V4 is disabled */}
                      <ResultCard title="OBD Listing Description" isDark={isDark}>
                        <p className="whitespace-pre-wrap">{displayResult.obdListingDescription}</p>
                      </ResultCard>

                      <ResultCard title="Website 'About Us' Section" isDark={isDark}>
                        <p className="whitespace-pre-wrap">{displayResult.websiteAboutUs}</p>
                      </ResultCard>

                      <ResultCard title="Google Business Profile Description" isDark={isDark}>
                        <p className="whitespace-pre-wrap">{displayResult.googleBusinessDescription}</p>
                      </ResultCard>
                    </>
                  )}

                  {/* Copy Bundles - above Content Packs */}
                  <CopyBundles result={displayResult} isDark={isDark} />

                  {/* Content Packs Tabs - Level 2 (shown in both V4 and legacy modes) */}
                  <ContentPacksTabs
                    result={displayResult}
                    isDark={isDark}
                    isV4Enabled={isV4Enabled}
                    formValues={formValues}
                    onApplyFix={handleApplyFix}
                  />

                  {/* V4: Description Health Check - Only shown when flags.bdwV4 is true */}
                  {isV4Enabled && displayResult && (
                    <DescriptionHealthCheck
                      formValues={formValues}
                      result={displayResult}
                      isDark={isDark}
                      isV4Enabled={isV4Enabled}
                    />
                  )}

                  {/* 
                    V5-2: Premium Fix Packs - QA Checklist
                    ============================================
                    1. Generate -> preview -> apply -> reset -> save -> push improved
                    2. Preview does not change output until Apply clicked
                    3. Apply updates tabs + meta preview + health check should re-run against displayResult
                    4. Reset returns to original result
                    5. Save Version after edits saves the edited content to DB/local
                    6. Push Improved sends edited content to Help Desk
                    7. V4 disabled: no Fix Packs UI visible
                  */}
                  {isV4Enabled && result && (
                    <FixPacks
                      formValues={formValues}
                      baseResult={result}
                      editedResult={editedResult}
                      isDark={isDark}
                      isV4Enabled={isV4Enabled}
                      onApply={handleApplyFix}
                      onReset={handleResetEdits}
                      onSaveImproved={handleSaveVersion}
                      onPushImprovedToHelpDesk={canShowHelpDeskButton ? handlePushImprovedToHelpDesk : undefined}
                      businessId={resolvedBusinessId}
                      onUndo={editHistory.length > 0 ? handleUndoLastEdit : undefined}
                    />
                  )}

                  {/* V5-2: Help Desk Improved Status Messages */}
                  {helpDeskPushingImproved && (
                    <div className={`rounded-lg border p-3 ${
                      isDark
                        ? "bg-blue-900/20 border-blue-700 text-blue-300"
                        : "bg-blue-50 border-blue-200 text-blue-700"
                    }`}>
                      <p className="text-sm">Pushing improved content to AI Help Desk Knowledge...</p>
                    </div>
                  )}
                  
                  {helpDeskImprovedSuccess && (
                    <div className={`rounded-lg border p-3 ${
                      isDark
                        ? "bg-green-900/20 border-green-700 text-green-300"
                        : "bg-green-50 border-green-200 text-green-700"
                    }`}>
                      <p className="text-sm font-medium">✓ Improved content added to Knowledge</p>
                    </div>
                  )}
                  
                  {helpDeskImprovedError && (
                    <div className={`rounded-lg border p-3 ${
                      isDark
                        ? "bg-red-900/20 border-red-700 text-red-300"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      <p className="text-sm font-medium">Error:</p>
                      <p className="text-sm">{helpDeskImprovedError}</p>
                    </div>
                  )}

                  {/* V4: Content Reuse Suggestions - Only shown when flags.bdwV4 is true */}
                  {isV4Enabled && (
                    <>
                      <ContentReuseSuggestions
                        isDark={isDark}
                        onAddToHelpDesk={canShowHelpDeskButton ? handlePushToHelpDesk : undefined}
                        showHelpDeskButton={canShowHelpDeskButton}
                        onCopyCrmNotePack={handleCopyCrmNotePack}
                        onSendToCrmNotes={canShowSendToCrmButton ? handleSendToCrmNotes : undefined}
                        showSendToCrmButton={canShowSendToCrmButton}
                      />
                      
                      {/* Helpful tip when businessId is not available */}
                      {!canShowHelpDeskButton && result && (
                        <div className={`rounded-lg border p-3 ${
                          isDark
                            ? "bg-slate-800/30 border-slate-700"
                            : "bg-slate-50 border-slate-200"
                        }`}>
                          <p className={`text-xs ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}>
                            💡 Tip: Open this app from your OBD dashboard to enable one-click Help Desk sync.
                          </p>
                        </div>
                      )}
                      
                      {/* Help Desk Status Messages */}
                      {helpDeskPushing && (
                        <div className={`rounded-lg border p-3 ${
                          isDark
                            ? "bg-blue-900/20 border-blue-700 text-blue-300"
                            : "bg-blue-50 border-blue-200 text-blue-700"
                        }`}>
                          <p className="text-sm">Adding to AI Help Desk Knowledge...</p>
                        </div>
                      )}
                      
                      {helpDeskSuccess && (
                        <div className={`rounded-lg border p-3 ${
                          isDark
                            ? "bg-green-900/20 border-green-700 text-green-300"
                            : "bg-green-50 border-green-200 text-green-700"
                        }`}>
                          <p className="text-sm font-medium">✓ Added to Knowledge</p>
                        </div>
                      )}
                      
                      {helpDeskError && (
                        <div className={`rounded-lg border p-3 ${
                          isDark
                            ? "bg-red-900/20 border-red-700 text-red-300"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}>
                          <p className="text-sm font-medium">Error:</p>
                          <p className="text-sm">{helpDeskError}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
          ) : null}
        </OBDResultsPanel>
      )}

      {/* V4: Saved Versions Panel */}
      {isV4Enabled && (
        <SavedVersionsPanel
          isOpen={savedVersionsOpen}
          onClose={() => setSavedVersionsOpen(false)}
          isDark={isDark}
          onLoadInputs={handleLoadInputs}
          businessId={resolvedBusinessId}
        />
      )}
    </OBDPageContainer>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BusinessDescriptionWriterPage />
    </Suspense>
  );
}
