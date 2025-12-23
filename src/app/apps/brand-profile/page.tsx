"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import ResultCard from "@/components/obd/ResultCard";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import {
  BrandPersonality,
  LanguageOption,
  VariationMode,
  HashtagStyle,
} from "@/app/apps/brand-kit-builder/types";

const USE_BRAND_PROFILE_KEY = "obd.v3.useBrandProfile";

const BRAND_PERSONALITIES: BrandPersonality[] = [
  "Friendly",
  "Professional",
  "Bold",
  "High-Energy",
  "Luxury",
  "Trustworthy",
  "Playful",
];

const VARIATION_MODES: VariationMode[] = ["Conservative", "Moderate", "Bold"];
const HASHTAG_STYLES: HashtagStyle[] = ["Local", "Branded", "Minimal"];

interface BrandProfileData {
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  city?: string | null;
  state?: string | null;
  brandPersonality?: string | null;
  targetAudience?: string | null;
  differentiators?: string | null;
  inspirationBrands?: string | null;
  avoidStyles?: string | null;
  brandVoice?: string | null;
  toneNotes?: string | null;
  language?: string | null;
  industryKeywords?: string | null;
  vibeKeywords?: string | null;
  variationMode?: string | null;
  includeHashtags?: boolean;
  hashtagStyle?: string | null;
  includeSocialPostTemplates?: boolean;
  includeFAQStarter?: boolean;
  includeGBPDescription?: boolean;
  includeMetaDescription?: boolean;
  colorsJson?: Record<string, unknown> | null;
  typographyJson?: Record<string, unknown> | null;
  messagingJson?: Record<string, unknown> | null;
  kitJson?: Record<string, unknown> | null;
}

export default function BrandProfilePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [profile, setProfile] = useState<BrandProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [useBrandProfile, setUseBrandProfile] = useState(true);

  // Load brand profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/brand-profile");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setProfile(data);
          }
        }
      } catch (err) {
        console.error("Failed to load brand profile:", err);
        setError("Failed to load brand profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  // Load "use brand profile" preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(USE_BRAND_PROFILE_KEY);
      if (stored !== null) {
        setUseBrandProfile(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load useBrandProfile preference:", err);
    }
  }, []);

  // Save "use brand profile" preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(USE_BRAND_PROFILE_KEY, JSON.stringify(useBrandProfile));
    } catch (err) {
      console.error("Failed to save useBrandProfile preference:", err);
    }
  }, [useBrandProfile]);

  const handleUpdateField = <K extends keyof BrandProfileData>(
    key: K,
    value: BrandProfileData[K]
  ) => {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // Prepare save data - only include fields that have values
      const saveData: Record<string, unknown> = {};

      if (profile.businessName?.trim()) saveData.businessName = profile.businessName.trim();
      if (profile.businessType?.trim()) saveData.businessType = profile.businessType.trim();
      if (profile.city?.trim()) saveData.city = profile.city.trim();
      if (profile.state?.trim()) saveData.state = profile.state.trim();
      if (profile.brandPersonality) saveData.brandPersonality = profile.brandPersonality;
      if (profile.targetAudience?.trim()) saveData.targetAudience = profile.targetAudience.trim();
      if (profile.differentiators?.trim()) saveData.differentiators = profile.differentiators.trim();
      if (profile.inspirationBrands?.trim()) saveData.inspirationBrands = profile.inspirationBrands.trim();
      if (profile.avoidStyles?.trim()) saveData.avoidStyles = profile.avoidStyles.trim();
      if (profile.brandVoice?.trim()) saveData.brandVoice = profile.brandVoice.trim();
      if (profile.toneNotes?.trim()) saveData.toneNotes = profile.toneNotes.trim();
      if (profile.language) saveData.language = profile.language;
      if (profile.industryKeywords?.trim()) saveData.industryKeywords = profile.industryKeywords.trim();
      if (profile.vibeKeywords?.trim()) saveData.vibeKeywords = profile.vibeKeywords.trim();
      if (profile.variationMode) saveData.variationMode = profile.variationMode;
      if (profile.hashtagStyle) saveData.hashtagStyle = profile.hashtagStyle;
      
      saveData.includeHashtags = Boolean(profile.includeHashtags);
      saveData.includeSocialPostTemplates = Boolean(profile.includeSocialPostTemplates);
      saveData.includeFAQStarter = Boolean(profile.includeFAQStarter);
      saveData.includeGBPDescription = Boolean(profile.includeGBPDescription);
      saveData.includeMetaDescription = Boolean(profile.includeMetaDescription);

      if (profile.colorsJson) saveData.colorsJson = profile.colorsJson;
      if (profile.typographyJson) saveData.typographyJson = profile.typographyJson;
      if (profile.messagingJson) saveData.messagingJson = profile.messagingJson;
      if (profile.kitJson) saveData.kitJson = profile.kitJson;

      const res = await fetch("/api/brand-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saveData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save brand profile");
      }

      const response = await res.json();
      if (response.profile) {
        setProfile(response.profile);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save brand profile:", err);
      setError(err instanceof Error ? err.message : "Failed to save brand profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        title="Brand Profile"
        tagline="View and manage your saved brand identity used across all OBD AI tools."
      >
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">⏳</div>
            <p className={themeClasses.mutedText}>Loading your brand profile...</p>
          </div>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  if (!profile) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        title="Brand Profile"
        tagline="View and manage your saved brand identity used across all OBD AI tools."
      >
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">🎨</div>
            <h3 className={`text-lg font-semibold mb-2 ${themeClasses.headingText}`}>
              No Brand Profile Saved Yet
            </h3>
            <p className={`mb-6 ${themeClasses.mutedText}`}>
              Create your brand profile using the Brand Kit Builder.
            </p>
            <Link
              href="/apps/brand-kit-builder"
              className={`inline-flex items-center gap-2 rounded-full bg-[#29c4a9] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#22ad93] shadow-md shadow-[#29c4a9]/40 hover:shadow-lg hover:shadow-[#29c4a9]/60 transition`}
            >
              Build Brand Kit
            </Link>
          </div>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Brand Profile"
      tagline="View and manage your saved brand identity used across all OBD AI tools."
    >
      {/* Header Actions */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <OBDHeading level={2} isDark={isDark}>
              Your Brand Profile
            </OBDHeading>
            {profile.updatedAt ? (
              <span className={`text-xs ${themeClasses.mutedText}`}>
                Last saved: {new Date(profile.updatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                saveSuccess
                  ? isDark
                    ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                    : "bg-teal-50 text-teal-700 border border-teal-200"
                  : isDark
                  ? "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
                  : "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
              }`}
            >
              {saving ? "Saving..." : saveSuccess ? "✓ Saved" : "Save Changes"}
            </button>
            <Link
              href="/apps/brand-kit-builder"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Edit in Builder
            </Link>
          </div>
        </div>

        {/* Use saved brand profile toggle */}
        <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
          <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
            <input
              type="checkbox"
              checked={useBrandProfile}
              onChange={(e) => setUseBrandProfile(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Use saved brand profile (auto-fill fields in other apps)
            </span>
          </label>
          <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
            When enabled, your saved brand profile will auto-fill brand voice and personality fields in Review Responder and Social Post Creator.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${getErrorPanelClasses(isDark)}`}>
            <p className="font-medium mb-2">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Profile Form */}
        <div className="space-y-6">
          {/* Business Basics */}
          <div>
            <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
              Business Basics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Business Name
                </label>
                <input
                  type="text"
                  value={profile.businessName || ""}
                  onChange={(e) => handleUpdateField("businessName", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Business Type
                </label>
                <input
                  type="text"
                  value={profile.businessType || ""}
                  onChange={(e) => handleUpdateField("businessType", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  City
                </label>
                <input
                  type="text"
                  value={profile.city || ""}
                  onChange={(e) => handleUpdateField("city", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  State
                </label>
                <input
                  type="text"
                  value={profile.state || ""}
                  onChange={(e) => handleUpdateField("state", e.target.value)}
                  className={getInputClasses(isDark)}
                />
              </div>
            </div>
          </div>

          {/* Brand Direction */}
          <div>
            <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
              Brand Direction
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Brand Personality
                </label>
                <select
                  value={profile.brandPersonality || ""}
                  onChange={(e) => handleUpdateField("brandPersonality", e.target.value)}
                  className={getInputClasses(isDark)}
                >
                  <option value="">None</option>
                  {BRAND_PERSONALITIES.map((personality) => (
                    <option key={personality} value={personality}>
                      {personality}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Target Audience
                </label>
                <textarea
                  value={profile.targetAudience || ""}
                  onChange={(e) => handleUpdateField("targetAudience", e.target.value)}
                  rows={2}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  What Makes You Different
                </label>
                <textarea
                  value={profile.differentiators || ""}
                  onChange={(e) => handleUpdateField("differentiators", e.target.value)}
                  rows={3}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Inspiration Brands
                </label>
                <textarea
                  value={profile.inspirationBrands || ""}
                  onChange={(e) => handleUpdateField("inspirationBrands", e.target.value)}
                  rows={2}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Styles to Avoid
                </label>
                <textarea
                  value={profile.avoidStyles || ""}
                  onChange={(e) => handleUpdateField("avoidStyles", e.target.value)}
                  rows={2}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
            </div>
          </div>

          {/* Voice & Language */}
          <div>
            <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
              Voice & Language
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Brand Voice
                </label>
                <textarea
                  value={profile.brandVoice || ""}
                  onChange={(e) => handleUpdateField("brandVoice", e.target.value)}
                  rows={4}
                  className={getInputClasses(isDark, "resize-none")}
                  placeholder="Describe how your brand sounds..."
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Tone Notes
                </label>
                <textarea
                  value={profile.toneNotes || ""}
                  onChange={(e) => handleUpdateField("toneNotes", e.target.value)}
                  rows={2}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Language
                </label>
                <select
                  value={profile.language || "English"}
                  onChange={(e) => handleUpdateField("language", e.target.value)}
                  className={getInputClasses(isDark)}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Bilingual">Bilingual</option>
                </select>
              </div>
            </div>
          </div>

          {/* Output Controls */}
          <div>
            <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
              Output Controls
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Industry Keywords
                </label>
                <textarea
                  value={profile.industryKeywords || ""}
                  onChange={(e) => handleUpdateField("industryKeywords", e.target.value)}
                  rows={2}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Vibe Keywords
                </label>
                <textarea
                  value={profile.vibeKeywords || ""}
                  onChange={(e) => handleUpdateField("vibeKeywords", e.target.value)}
                  rows={2}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Variation Mode
                  </label>
                  <select
                    value={profile.variationMode || "Conservative"}
                    onChange={(e) => handleUpdateField("variationMode", e.target.value)}
                    className={getInputClasses(isDark)}
                  >
                    {VARIATION_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Hashtag Style
                  </label>
                  <select
                    value={profile.hashtagStyle || "Local"}
                    onChange={(e) => handleUpdateField("hashtagStyle", e.target.value)}
                    disabled={!profile.includeHashtags}
                    className={getInputClasses(isDark)}
                  >
                    {HASHTAG_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={profile.includeHashtags || false}
                    onChange={(e) => handleUpdateField("includeHashtags", e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Include Hashtags</span>
                </label>
              </div>
            </div>
          </div>

          {/* Extras */}
          <div>
            <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
              Extra Sections
            </h3>
            <div className="space-y-3">
              <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                <input
                  type="checkbox"
                  checked={profile.includeSocialPostTemplates || false}
                  onChange={(e) => handleUpdateField("includeSocialPostTemplates", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Social Post Template Pack</span>
              </label>
              <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                <input
                  type="checkbox"
                  checked={profile.includeFAQStarter || false}
                  onChange={(e) => handleUpdateField("includeFAQStarter", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">FAQ Starter Pack</span>
              </label>
              <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                <input
                  type="checkbox"
                  checked={profile.includeGBPDescription || false}
                  onChange={(e) => handleUpdateField("includeGBPDescription", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Google Business Profile Description</span>
              </label>
              <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                <input
                  type="checkbox"
                  checked={profile.includeMetaDescription || false}
                  onChange={(e) => handleUpdateField("includeMetaDescription", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Meta Description</span>
              </label>
            </div>
          </div>

          {/* Saved Brand Kit Data (Read-only display) */}
          {profile.kitJson && typeof profile.kitJson === "object" && (
            <div>
              <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
                Saved Brand Kit
              </h3>
              <ResultCard
                title="Brand Kit Summary"
                isDark={isDark}
                copyText={JSON.stringify(profile.kitJson as Record<string, unknown>, null, 2)}
              >
                <div className="space-y-3">
                  <p className={themeClasses.mutedText}>
                    Your full brand kit data is saved and used for auto-filling other tools.
                  </p>
                  <Link
                    href="/apps/brand-kit-builder"
                    className={`inline-flex items-center text-sm font-medium ${
                      isDark ? "text-[#29c4a9] hover:text-[#22ad93]" : "text-[#29c4a9] hover:text-[#22ad93]"
                    }`}
                  >
                    View / Edit Full Brand Kit →
                  </Link>
                </div>
              </ResultCard>
            </div>
          )}
        </div>
      </OBDPanel>
    </OBDPageContainer>
  );
}

