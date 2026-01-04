"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getDividerClass } from "@/lib/obd-framework/layout-helpers";
import BrandProfilePanel from "@/components/bdw/BrandProfilePanel";
import { type BrandProfile } from "@/lib/utils/bdw-brand-profile";
import CWFixPacks from "@/components/cw/CWFixPacks";
import CWQualityControlsTab from "@/components/cw/CWQualityControlsTab";
import CWExportCenterPanel from "@/components/cw/CWExportCenterPanel";
import CWCopyBundles from "@/components/cw/CWCopyBundles";
import WorkflowGuidance from "@/components/bdw/WorkflowGuidance";
import AnalyticsDetails from "@/components/bdw/AnalyticsDetails";
import { recordGeneration, recordFixPackApplied } from "@/lib/bdw/local-analytics";

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
  formValues: { services: string; keywords: string };
  baseContent: ContentOutput;
  editedContent: ContentOutput | null;
  isDark: boolean;
  onApplyFix: (partialUpdated: Partial<ContentOutput>) => void;
  onReset: () => void;
  onUndo?: () => void;
}

function BDWToolsTabs({
  content,
  formValues,
  baseContent,
  editedContent,
  isDark,
  onApplyFix,
  onReset,
  onUndo,
}: BDWToolsTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("fix-packs");

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
          <CWExportCenterPanel content={content} isDark={isDark} storageKey="cw-analytics" />
        )}
      </div>
    </div>
  );
}

export default function ContentWriterPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [formValues, setFormValues] = useState<ContentWriterFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contentResponse, setContentResponse] = useState<ContentWriterResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<ContentWriterFormValues | null>(null);
  
  // BDW Tools: Edited content state for Fix Packs
  const [editedContent, setEditedContent] = useState<ContentOutput | null>(null);
  const [editHistory, setEditHistory] = useState<ContentOutput[]>([]);

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

  // Brand Profile: Apply profile to form
  const handleApplyBrandProfile = (profile: BrandProfile, fillEmptyOnly: boolean) => {
    setFormValues((prev) => {
      const updates: Partial<ContentWriterFormValues> = {};

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

  // Fix Packs: Reset edited content to original
  const handleResetEdits = () => {
    setEditedContent(null);
    setEditHistory([]);
  };

  // Fix Packs: Undo last edit
  const handleUndoLastEdit = () => {
    if (editHistory.length === 0) return;
    
    const previousState = editHistory[editHistory.length - 1];
    setEditHistory((prev) => prev.slice(0, -1));
    setEditedContent(previousState === contentResponse?.content ? null : previousState);
  };

  // Determine which content to display (edited if present, otherwise original)
  const displayContent = editedContent ?? contentResponse?.content ?? null;

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Content Writer"
      tagline="Write high-quality content for your business needs, from blog posts and service pages to emails, bios, policies, and job posts—all tailored for your Ocala business."
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
          displayContent ? 3 : // Step 3: Fix & Export (content generated)
          formValues.topic.trim() ? 2 : // Step 2: Generate (topic filled)
          1 // Step 1: Business details (form empty)
        }
        storageKey="cw-workflow-guidance-dismissed"
      />

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
              <div className="space-y-6 pb-24">
                {/* Business Basics Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Business Basics</h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Content Basics Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Content Basics</h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Tone & Personality Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Tone & Personality</h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* SEO & Length Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>SEO & Length</h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Structure & Templates Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Structure & Templates</h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Toggles & Mode Section */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Options</h3>
                  <div className="space-y-4">
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
                </div>

                {error && !loading && (
                  <div className={`rounded-xl border p-3 ${isDark ? "bg-red-900/20 border-red-700 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
              
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
          title="Generated Content"
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
                <div className="space-y-6">
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
                  {contentResponse.mode !== "Ideas" && contentResponse.content.title && (
                    <>
                      <ContentCard title={contentResponse.content.title} isDark={isDark}>
                        <div className="space-y-4">
                          {displayContent.seoTitle && (
                            <div>
                              <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>SEO Title:</p>
                              <p className="text-sm">{displayContent.seoTitle}</p>
                            </div>
                          )}

                          {displayContent.metaDescription && (
                            <div>
                              <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Meta Description:</p>
                              <p className="text-sm">{displayContent.metaDescription}</p>
                            </div>
                          )}

                          {displayContent.slugSuggestion && (
                            <div>
                              <p className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>URL Slug:</p>
                              <p className="text-sm font-mono">{displayContent.slugSuggestion}</p>
                            </div>
                          )}

                          {displayContent.outline.length > 0 && (
                            <div>
                              <h4 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>Outline</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm">
                                {displayContent.outline.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {displayContent.sections.map((section, idx) => (
                            <div key={idx} className="space-y-2">
                              <h4 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                {section.heading}
                              </h4>
                              <div className={`text-sm leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                {section.body.split('\n\n').map((para, pIdx) => (
                                  <p key={pIdx} className={pIdx > 0 ? "mt-3" : ""}>{para.trim()}</p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ContentCard>

                      {/* FAQ Section */}
                      {displayContent.faq.length > 0 && (
                        <ContentCard title="Suggested FAQs" isDark={isDark}>
                          <div className="space-y-4">
                            {displayContent.faq.map((faq, idx) => (
                              <div key={idx} className={idx > 0 ? "pt-4 mt-4 border-t border-slate-300 dark:border-slate-600" : ""}>
                                <p className={`font-medium mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                                  Q: {faq.question}
                                </p>
                                <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                  A: {faq.answer}
                                </p>
                              </div>
                            ))}
                          </div>
                        </ContentCard>
                      )}

                      {/* Social Blurb */}
                      {displayContent.socialBlurb && (
                        <ContentCard title="Social Teaser" isDark={isDark}>
                          <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-700/50 border-slate-600" : "bg-white border-slate-300"}`}>
                            <p className={`whitespace-pre-wrap text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                              {displayContent.socialBlurb}
                            </p>
                          </div>
                        </ContentCard>
                      )}

                      {/* Keywords Used */}
                      {displayContent.keywordsUsed.length > 0 && (
                        <ContentCard title="Keywords Used" isDark={isDark}>
                          <div className="flex flex-wrap gap-2">
                            {displayContent.keywordsUsed.map((keyword, idx) => (
                              <span key={idx} className={`px-2 py-1 rounded text-xs ${isDark ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </ContentCard>
                      )}
                    </>
                  )}

                  {/* BDW Tools Panel */}
                  {contentResponse.mode !== "Ideas" && displayContent && (
                    <>
                      {/* Copy Bundles */}
                      <CWCopyBundles content={displayContent} isDark={isDark} storageKey="cw-analytics" />

                      {/* BDW Tools Tabs */}
                      <BDWToolsTabs
                        content={displayContent}
                        formValues={{ services: formValues.services, keywords: formValues.keywords }}
                        baseContent={contentResponse.content}
                        editedContent={editedContent}
                        isDark={isDark}
                        onApplyFix={handleApplyFix}
                        onReset={handleResetEdits}
                        onUndo={editHistory.length > 0 ? handleUndoLastEdit : undefined}
                      />
                    </>
                  )}
                </div>
              ) : null}
        </OBDResultsPanel>
      )}
    </OBDPageContainer>
  );
}
