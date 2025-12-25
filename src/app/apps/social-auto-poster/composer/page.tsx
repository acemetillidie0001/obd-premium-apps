"use client";

import { useState, useEffect, useRef } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
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

export default function SocialAutoPosterComposerPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

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
    contentPillarSettings?: { contentPillarMode?: string; defaultPillar?: string };
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

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
            contentPillarSettings: data.settings.contentPillarSettings,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

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
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Social Auto-Poster"
      tagline="Generate platform-optimized social media posts"
    >
      <SocialAutoPosterNav isDark={isDark} />

      <div className="mt-7 space-y-6">
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

