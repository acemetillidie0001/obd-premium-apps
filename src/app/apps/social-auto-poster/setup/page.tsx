"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type {
  SocialAutoposterSettings,
  PostingMode,
  SocialPlatform,
  SchedulingRules,
  PlatformsEnabled,
  PlatformOverridesMap,
  ContentPillar,
  ContentPillarSettings,
  HashtagBankSettings,
} from "@/lib/apps/social-auto-poster/types";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const PLATFORMS: Array<{ value: SocialPlatform; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "googleBusiness", label: "Google Business" },
];

const CONTENT_PILLARS: Array<{ value: ContentPillar; label: string; description: string }> = [
  { value: "education", label: "Education", description: "Informative, how-to, tips and guides" },
  { value: "promotion", label: "Promotion", description: "Offers, discounts, special deals" },
  { value: "social_proof", label: "Social Proof", description: "Reviews, testimonials, customer stories" },
  { value: "community", label: "Community", description: "Local events, neighborhood focus, community involvement" },
  { value: "seasonal", label: "Seasonal", description: "Holiday content, seasonal themes, time-sensitive" },
];

const POSTING_MODES: Array<{ value: PostingMode; label: string; description: string }> = [
  { value: "review", label: "Review Mode", description: "All posts require manual approval before posting" },
  { value: "auto", label: "Auto Mode", description: "Posts are automatically published on schedule" },
  { value: "campaign", label: "Campaign Mode", description: "Posts are grouped into campaigns with specific goals" },
];

export default function SocialAutoPosterSetupPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [settings, setSettings] = useState<Partial<SocialAutoposterSettings>>({
    brandVoice: "",
    postingMode: "review",
    schedulingRules: {
      frequency: "daily",
      allowedDays: [],
      timeWindow: {
        start: "09:00",
        end: "17:00",
      },
      timezone: "America/New_York",
    },
    enabledPlatforms: [],
    platformsEnabled: {},
    platformOverrides: {},
    contentPillarSettings: {
      contentPillarMode: "single",
      defaultPillar: "education",
    },
    hashtagBankSettings: {
      includeLocalHashtags: false,
      hashtagBankMode: "auto",
    },
  });
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<SocialPlatform>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-auto-poster/settings");
      if (!res.ok) {
        if (res.status === 404) {
          // No settings yet, use defaults
          return;
        }
        throw new Error("Failed to load settings");
      }
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!settings.postingMode || !settings.schedulingRules) {
        throw new Error("Missing required fields");
      }

      const res = await fetch("/api/social-auto-poster/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandVoice: settings.brandVoice || undefined,
          postingMode: settings.postingMode,
          schedulingRules: settings.schedulingRules,
          enabledPlatforms: settings.enabledPlatforms || [],
          platformsEnabled: settings.platformsEnabled,
          platformOverrides: settings.platformOverrides,
          contentPillarSettings: settings.contentPillarSettings,
          hashtagBankSettings: settings.hashtagBankSettings,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    const currentDays = settings.schedulingRules?.allowedDays || [];
    setSettings({
      ...settings,
      schedulingRules: {
        ...settings.schedulingRules!,
        allowedDays: currentDays.includes(day)
          ? currentDays.filter((d) => d !== day)
          : [...currentDays, day],
      },
    });
  };

  const togglePlatform = (platform: SocialPlatform) => {
    const currentPlatforms = settings.enabledPlatforms || [];
    setSettings({
      ...settings,
      enabledPlatforms: currentPlatforms.includes(platform)
        ? currentPlatforms.filter((p) => p !== platform)
        : [...currentPlatforms, platform],
    });
  };

  const togglePlatformEnabled = (platform: SocialPlatform) => {
    const current = settings.platformsEnabled || {};
    setSettings({
      ...settings,
      platformsEnabled: {
        ...current,
        [platform]: !current[platform],
      },
    });
  };

  const updatePlatformOverride = (
    platform: SocialPlatform,
    field: "emojiModeOverride" | "hashtagLimitOverride" | "ctaStyleOverride",
    value: string | number | undefined
  ) => {
    const current = settings.platformOverrides || {};
    const platformOverrides = current[platform] || {};
    setSettings({
      ...settings,
      platformOverrides: {
        ...current,
        [platform]: {
          ...platformOverrides,
          [field]: value === "" ? undefined : value,
        },
      },
    });
  };

  const togglePlatformExpanded = (platform: SocialPlatform) => {
    const newExpanded = new Set(expandedPlatforms);
    if (newExpanded.has(platform)) {
      newExpanded.delete(platform);
    } else {
      newExpanded.add(platform);
    }
    setExpandedPlatforms(newExpanded);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Social Auto-Poster"
      tagline="Configure your posting preferences and schedule"
    >
      <SocialAutoPosterNav isDark={isDark} />

      <div className="mt-7">
        {loading ? (
          <OBDPanel isDark={isDark}>
            <p className={themeClasses.mutedText}>Loading settings...</p>
          </OBDPanel>
        ) : (
          <form onSubmit={handleSave}>
            <div className="space-y-6">
              {/* Brand Voice */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Brand Voice
                </OBDHeading>
                <div>
                  <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Brand Voice Guidelines
                  </label>
                  <textarea
                    id="brandVoice"
                    value={settings.brandVoice || ""}
                    onChange={(e) => setSettings({ ...settings, brandVoice: e.target.value })}
                    className={getInputClasses(isDark)}
                    rows={4}
                    placeholder="Describe your brand's voice, tone, and style preferences..."
                  />
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    This will be used to generate posts that match your brand's personality.
                  </p>
                </div>
              </OBDPanel>

              {/* Posting Mode */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Posting Mode
                </OBDHeading>
                <div className="space-y-3">
                  {POSTING_MODES.map((mode) => (
                    <label
                      key={mode.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        settings.postingMode === mode.value
                          ? isDark
                            ? "border-[#29c4a9] bg-[#29c4a9]/10"
                            : "border-[#29c4a9] bg-[#29c4a9]/5"
                          : isDark
                          ? "border-slate-700 hover:border-slate-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="postingMode"
                        value={mode.value}
                        checked={settings.postingMode === mode.value}
                        onChange={(e) => setSettings({ ...settings, postingMode: e.target.value as PostingMode })}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className={`font-medium ${themeClasses.headingText}`}>{mode.label}</div>
                        <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>{mode.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </OBDPanel>

              {/* Enabled Platforms */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Enabled Platforms
                </OBDHeading>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {PLATFORMS.map((platform) => {
                    const isEnabled = settings.enabledPlatforms?.includes(platform.value) || false;
                    return (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() => togglePlatform(platform.value)}
                        className={`p-3 rounded-xl border transition-colors ${
                          isEnabled
                            ? isDark
                              ? "border-[#29c4a9] bg-[#29c4a9]/10"
                              : "border-[#29c4a9] bg-[#29c4a9]/5"
                            : isDark
                            ? "border-slate-700 hover:border-slate-600"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className={`font-medium ${isEnabled ? themeClasses.headingText : themeClasses.mutedText}`}>
                          {platform.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </OBDPanel>

              {/* Per-Platform Settings */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Per-Platform Settings
                </OBDHeading>
                <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                  Configure individual platform enable/disable and posting overrides.
                </p>
                <div className="space-y-4">
                  {PLATFORMS.map((platform) => {
                    const isEnabled = (settings.platformsEnabled?.[platform.value] !== false); // Default to enabled
                    const isExpanded = expandedPlatforms.has(platform.value);
                    const overrides = settings.platformOverrides?.[platform.value] || {};

                    return (
                      <div
                        key={platform.value}
                        className={`rounded-xl border p-4 ${
                          isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => togglePlatformEnabled(platform.value)}
                                className="rounded"
                              />
                              <span className={`font-medium ${themeClasses.headingText}`}>{platform.label}</span>
                            </label>
                            {!isEnabled && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                isDark ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"
                              }`}>
                                Disabled
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePlatformExpanded(platform.value)}
                            className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText} transition-colors`}
                          >
                            {isExpanded ? "Hide Overrides" : "Show Overrides"}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="mt-4 space-y-3 pt-3 border-t border-slate-600">
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                                Emoji Mode Override
                              </label>
                              <select
                                value={overrides.emojiModeOverride || ""}
                                onChange={(e) =>
                                  updatePlatformOverride(
                                    platform.value,
                                    "emojiModeOverride",
                                    e.target.value || undefined
                                  )
                                }
                                className={getInputClasses(isDark)}
                              >
                                <option value="">Default</option>
                                <option value="allow">Allow</option>
                                <option value="limit">Limit</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                                Hashtag Limit Override
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={overrides.hashtagLimitOverride || ""}
                                onChange={(e) =>
                                  updatePlatformOverride(
                                    platform.value,
                                    "hashtagLimitOverride",
                                    e.target.value ? parseInt(e.target.value, 10) : undefined
                                  )
                                }
                                className={getInputClasses(isDark)}
                                placeholder="Default"
                              />
                            </div>
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                                CTA Style Override
                              </label>
                              <select
                                value={overrides.ctaStyleOverride || ""}
                                onChange={(e) =>
                                  updatePlatformOverride(
                                    platform.value,
                                    "ctaStyleOverride",
                                    e.target.value || undefined
                                  )
                                }
                                className={getInputClasses(isDark)}
                              >
                                <option value="">Default</option>
                                <option value="none">None</option>
                                <option value="soft">Soft</option>
                                <option value="direct">Direct</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </OBDPanel>

              {/* Content Pillars */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Content Pillars
                </OBDHeading>
                <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                  Choose how content themes are selected for your posts.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Pillar Mode
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="pillarMode"
                          value="single"
                          checked={settings.contentPillarSettings?.contentPillarMode === "single"}
                          onChange={() =>
                            setSettings({
                              ...settings,
                              contentPillarSettings: {
                                contentPillarMode: "single",
                                defaultPillar: settings.contentPillarSettings?.defaultPillar || "education",
                              },
                            })
                          }
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className={`font-medium ${themeClasses.headingText}`}>Single Pillar</div>
                          <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                            Always use the same pillar for all posts
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="pillarMode"
                          value="rotate"
                          checked={settings.contentPillarSettings?.contentPillarMode === "rotate"}
                          onChange={() =>
                            setSettings({
                              ...settings,
                              contentPillarSettings: {
                                contentPillarMode: "rotate",
                                rotatePillars: settings.contentPillarSettings?.rotatePillars || [
                                  "education",
                                  "promotion",
                                  "social_proof",
                                  "community",
                                  "seasonal",
                                ],
                              },
                            })
                          }
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className={`font-medium ${themeClasses.headingText}`}>Auto Rotate</div>
                          <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                            Automatically rotate between selected pillars, avoiding recent repeats
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {settings.contentPillarSettings?.contentPillarMode === "single" && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Default Pillar
                      </label>
                      <select
                        value={settings.contentPillarSettings?.defaultPillar || "education"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            contentPillarSettings: {
                              ...settings.contentPillarSettings!,
                              defaultPillar: e.target.value as ContentPillar,
                            },
                          })
                        }
                        className={getInputClasses(isDark)}
                      >
                        {CONTENT_PILLARS.map((pillar) => (
                          <option key={pillar.value} value={pillar.value}>
                            {pillar.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {settings.contentPillarSettings?.contentPillarMode === "rotate" && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Pillars to Rotate
                      </label>
                      <div className="space-y-2">
                        {CONTENT_PILLARS.map((pillar) => {
                          const isSelected =
                            settings.contentPillarSettings?.rotatePillars?.includes(pillar.value) || false;
                          return (
                            <label
                              key={pillar.value}
                              className="flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const current = settings.contentPillarSettings?.rotatePillars || [];
                                  const updated = e.target.checked
                                    ? [...current, pillar.value]
                                    : current.filter((p) => p !== pillar.value);
                                  setSettings({
                                    ...settings,
                                    contentPillarSettings: {
                                      ...settings.contentPillarSettings!,
                                      rotatePillars: updated.length > 0 ? updated : [pillar.value], // At least one
                                    },
                                  });
                                }}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className={`font-medium ${themeClasses.headingText}`}>{pillar.label}</div>
                                <div className={`text-xs ${themeClasses.mutedText}`}>{pillar.description}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </OBDPanel>

              {/* Hashtag Bank */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Local Hashtag Bank
                </OBDHeading>
                <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                  Automatically include Ocala-focused hashtags in your posts.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.hashtagBankSettings?.includeLocalHashtags || false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            hashtagBankSettings: {
                              ...settings.hashtagBankSettings!,
                              includeLocalHashtags: e.target.checked,
                            },
                          })
                        }
                        className="rounded"
                      />
                      <span className={`font-medium ${themeClasses.headingText}`}>
                        Include Local Hashtags
                      </span>
                    </label>
                    <p className={`text-xs mt-1 ml-7 ${themeClasses.mutedText}`}>
                      Automatically add Ocala-focused hashtags to your posts
                    </p>
                  </div>

                  {settings.hashtagBankSettings?.includeLocalHashtags && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Hashtag Mode
                      </label>
                      <select
                        value={settings.hashtagBankSettings?.hashtagBankMode || "auto"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            hashtagBankSettings: {
                              ...settings.hashtagBankSettings!,
                              hashtagBankMode: e.target.value as "auto" | "manual",
                            },
                          })
                        }
                        className={getInputClasses(isDark)}
                      >
                        <option value="auto">Auto (rotates to avoid duplicates)</option>
                        <option value="manual">Manual (you choose per post)</option>
                      </select>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Auto mode rotates hashtag sets to avoid using the same set within 7 days
                      </p>
                    </div>
                  )}
                </div>
              </OBDPanel>

              {/* Scheduling Rules */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Scheduling Rules
                </OBDHeading>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="frequency" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Posting Frequency
                    </label>
                    <input
                      type="text"
                      id="frequency"
                      value={settings.schedulingRules?.frequency || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          schedulingRules: {
                            ...settings.schedulingRules!,
                            frequency: e.target.value,
                          },
                        })
                      }
                      className={getInputClasses(isDark)}
                      placeholder="e.g., daily, weekly, 3x per week"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Allowed Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = settings.schedulingRules?.allowedDays?.includes(day.value) || false;
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              isSelected
                                ? "bg-[#29c4a9] text-white"
                                : isDark
                                ? "bg-slate-800 text-slate-300 border border-slate-700"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="timeStart" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Time Window Start
                      </label>
                      <input
                        type="time"
                        id="timeStart"
                        value={settings.schedulingRules?.timeWindow?.start || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            schedulingRules: {
                              ...settings.schedulingRules!,
                              timeWindow: {
                                ...settings.schedulingRules!.timeWindow,
                                start: e.target.value,
                              },
                            },
                          })
                        }
                        className={getInputClasses(isDark)}
                      />
                    </div>
                    <div>
                      <label htmlFor="timeEnd" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Time Window End
                      </label>
                      <input
                        type="time"
                        id="timeEnd"
                        value={settings.schedulingRules?.timeWindow?.end || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            schedulingRules: {
                              ...settings.schedulingRules!,
                              timeWindow: {
                                ...settings.schedulingRules!.timeWindow,
                                end: e.target.value,
                              },
                            },
                          })
                        }
                        className={getInputClasses(isDark)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="timezone" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Timezone
                    </label>
                    <input
                      type="text"
                      id="timezone"
                      value={settings.schedulingRules?.timezone || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          schedulingRules: {
                            ...settings.schedulingRules!,
                            timezone: e.target.value,
                          },
                        })
                      }
                      className={getInputClasses(isDark)}
                      placeholder="America/New_York"
                    />
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      IANA timezone identifier (e.g., America/New_York, America/Los_Angeles)
                    </p>
                  </div>
                </div>
              </OBDPanel>

              {/* Error/Success Messages */}
              {error && (
                <div className={getErrorPanelClasses(isDark)}>
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div
                  className={`rounded-xl border p-3 ${
                    isDark
                      ? "bg-green-900/20 border-green-700 text-green-400"
                      : "bg-green-50 border-green-200 text-green-600"
                  }`}
                >
                  <p>Settings saved successfully!</p>
                </div>
              )}

              {/* Submit Button */}
              <OBDPanel isDark={isDark}>
                <button type="submit" className={SUBMIT_BUTTON_CLASSES} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </OBDPanel>
            </div>
          </form>
        )}
      </div>
    </OBDPageContainer>
  );
}

