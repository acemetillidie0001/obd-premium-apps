"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import { mapMetaError, mapCallbackError } from "@/lib/apps/social-auto-poster/metaErrorMapper";
import type {
  SocialAutoposterSettings,
  PostingMode,
  SocialPlatform,
  ContentPillar,
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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  
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
    imageSettings: {
      enableImages: false,
      imageCategoryMode: "auto",
      allowTextOverlay: false,
    },
  });
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<SocialPlatform>>(new Set());

  // Premium status
  const [isPremiumUser, setIsPremiumUser] = useState<boolean | null>(null);

  // Meta connection state
  const [connectionStatus, setConnectionStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    errorCode?: string;
    errorMessage?: string;
    facebook: { 
      connected: boolean; 
      basicConnectGranted?: boolean;
      pagesAccessGranted?: boolean;
      pageName?: string; 
      pageId?: string;
    };
    instagram: {
      connected: boolean;
      available?: boolean;
      username?: string;
      igBusinessId?: string;
      reasonIfUnavailable?: string;
    };
    publishing?: {
      enabled?: boolean;
      reasonIfDisabled?: string;
    };
  } | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [requestingPagesAccess, setRequestingPagesAccess] = useState(false);
  const [testPostLoading, setTestPostLoading] = useState(false);
  const [testPostResults, setTestPostResults] = useState<{
    facebook?: { ok: boolean; postId?: string; permalink?: string; error?: string };
    instagram?: { ok: boolean; postId?: string; permalink?: string; error?: string };
    google?: { ok: boolean; postId?: string; permalink?: string; error?: string };
  } | null>(null);

  // Google Business Profile connection state
  const [googleStatus, setGoogleStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    connected?: boolean;
    location?: { id: string; name: string };
    errorCode?: string;
    errorMessage?: string;
  } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleTestPostLoading, setGoogleTestPostLoading] = useState(false);
  const [googleLocations, setGoogleLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [googleLocationsLoading, setGoogleLocationsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    
    // Check for callback success/error
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const pagesAccess = params.get("pages_access");
    const googleConnected = params.get("google_connected");
    const error = params.get("error");
    
    if (connected === "1") {
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      
      // Auto-refresh connection status if user is premium
      if (isPremiumUser === true) {
        // Small delay to ensure redirect is complete
        setTimeout(() => {
          loadConnectionStatus();
        }, 500);
      }
    } else if (pagesAccess === "1") {
      // Show success message for pages access
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      
      // Auto-refresh connection status if user is premium
      if (isPremiumUser === true) {
        setTimeout(() => {
          loadConnectionStatus();
        }, 500);
      }
    } else if (googleConnected === "1") {
      // Show success message for Google
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      
      // Auto-refresh Google status if user is premium
      if (isPremiumUser === true) {
        setTimeout(() => {
          loadGoogleStatus();
        }, 500);
      }
    } else if (error) {
      // Map callback error to user-friendly message
      const friendlyError = mapCallbackError(error);
      setError(friendlyError);
      
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Load connection status when premium status is confirmed
  useEffect(() => {
    if (isPremiumUser === true) {
      loadConnectionStatus();
      loadGoogleStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremiumUser]); // loadConnectionStatus is stable and doesn't need to be in deps

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-auto-poster/settings");
      if (!res.ok) {
        if (res.status === 404) {
          // No settings yet, use defaults
          setIsPremiumUser(true); // 404 means user is premium but no settings exist
          return;
        }
        if (res.status === 403) {
          setIsPremiumUser(false);
          setError("Premium access required. Please upgrade to use Social Auto-Poster.");
          return;
        }
        throw new Error("Failed to load settings");
      }
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
      setIsPremiumUser(true); // Success means user is premium
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
      // Don't set premium status on error - let it remain null
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
        if (res.status === 403) {
          throw new Error("Premium access required. Please upgrade to save settings.");
        }
        throw new Error(errorData.error || "Failed to save settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
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

  const loadConnectionStatus = async () => {
    // Only load if user is premium
    if (isPremiumUser !== true) {
      return;
    }

    setConnectionLoading(true);
    try {
      const res = await fetch("/api/social-connections/meta/status");
      const data = await res.json();
      
      // Handle structured error responses (all errors now return 200 with ok: false)
      if (data.ok === false) {
        const errorCode = data.errorCode || "UNKNOWN_ERROR";
        
        // Set connectionStatus to null so UI shows appropriate error message
        setConnectionStatus(null);
        
        // Log specific error for debugging (but don't show to user - UI handles it)
        if (errorCode === "META_NOT_CONFIGURED") {
          console.log("[Meta Status] Meta not configured");
        } else if (errorCode === "DB_ERROR") {
          console.error("[Meta Status] Database error:", data.errorMessage);
        } else if (errorCode === "UNAUTHORIZED") {
          console.log("[Meta Status] Unauthorized");
        } else {
          console.error("[Meta Status] Error:", errorCode, data.errorMessage);
        }
        return;
      }
      
      // Success - set connection status
      if (res.ok || data.ok === true) {
        setConnectionStatus(data);
      }
    } catch (err) {
      // Network error or JSON parse error
      console.error("[Meta Status] Request failed:", err);
      setConnectionStatus(null);
    } finally {
      setConnectionLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/social-connections/meta/connect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate connection");
      }
      const data = await res.json();
      if (data.authUrl) {
        // Redirect to Meta OAuth
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Facebook and Instagram?")) {
      return;
    }
    setConnectionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-connections/meta/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      await loadConnectionStatus();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setConnectionLoading(false);
    }
  };

  const handleRequestPagesAccess = async () => {
    setRequestingPagesAccess(true);
    setError(null);
    try {
      const res = await fetch("/api/social-connections/meta/request-pages-access", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to request pages access");
      }
      const data = await res.json();
      if (data.authUrl) {
        // Redirect to Meta OAuth for pages access
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request pages access");
      setRequestingPagesAccess(false);
    }
  };

  const loadGoogleStatus = async () => {
    // Only load if user is premium
    if (isPremiumUser !== true) {
      return;
    }

    setGoogleLoading(true);
    try {
      const res = await fetch("/api/social-connections/google/status");
      const data = await res.json();
      
      if (data.ok === false) {
        const errorCode = data.errorCode || "UNKNOWN_ERROR";
        setGoogleStatus({
          ok: false,
          configured: data.configured || false,
          connected: false,
          errorCode,
          errorMessage: data.errorMessage || data.error,
        });
      } else {
        setGoogleStatus(data);
      }
    } catch (err) {
      console.error("Failed to load Google status:", err);
      setGoogleStatus(null);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/social-connections/google/connect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate connection");
      }
      const data = await res.json();
      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Business Profile?")) {
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-connections/google/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      await loadGoogleStatus();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleTestPost = async () => {
    setGoogleTestPostLoading(true);
    setError(null);
    setTestPostResults((prev) => ({ ...prev, google: undefined }));
    try {
      const res = await fetch("/api/social-connections/google/test-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send test post");
      }
      const data = await res.json();
      
      // Map errors to user-friendly messages
      const result = data.result || {};
      if (!result.ok && result.error) {
        const mapped = mapMetaError(null, result.error);
        result.error = mapped.message;
      }
      
      setTestPostResults((prev) => ({
        ...prev,
        google: {
          ok: result.ok || false,
          postId: result.postId,
          permalink: result.permalink,
          error: result.error,
        },
      }));
      
      if (result.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test post");
    } finally {
      setGoogleTestPostLoading(false);
    }
  };

  const handleSelectLocation = async (locationId: string) => {
    setGoogleLocationsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-connections/google/select-location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to select location");
      }
      await loadGoogleStatus();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select location");
    } finally {
      setGoogleLocationsLoading(false);
    }
  };

  // Load locations when status is loaded
  useEffect(() => {
    if (googleStatus?.ok && googleStatus.locations) {
      setGoogleLocations(googleStatus.locations);
    }
  }, [googleStatus]);

  const handleTestPost = async () => {
    setTestPostLoading(true);
    setError(null);
    setTestPostResults(null);
    try {
      const res = await fetch("/api/social-connections/meta/test-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send test post");
      }
      const data = await res.json();
      
      // Map errors to user-friendly messages
      const results = data.results || {};
      if (results.facebook && !results.facebook.ok && results.facebook.error) {
        const mapped = mapMetaError(null, results.facebook.error);
        results.facebook.error = mapped.message;
      }
      if (results.instagram && !results.instagram.ok && results.instagram.error) {
        const mapped = mapMetaError(null, results.instagram.error);
        results.instagram.error = mapped.message;
      }
      
      setTestPostResults(results);
      
      // Show success banner only if at least one platform succeeded
      const hasSuccess = Object.values(results).some((r: any) => r?.ok === true);
      if (hasSuccess) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test post");
    } finally {
      setTestPostLoading(false);
    }
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
              {/* Connect Accounts */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Connect Accounts
                </OBDHeading>
                <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                  Connect your Facebook and Instagram accounts to enable automatic posting.
                </p>

                {/* Non-premium users: Show upgrade prompt */}
                {isPremiumUser === false ? (
                  <div className={`p-6 rounded-xl border ${
                    isDark 
                      ? "border-slate-700 bg-slate-800/50" 
                      : "border-slate-200 bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`text-4xl ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        🔒
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium mb-2 ${themeClasses.headingText}`}>
                          Upgrade to Premium
                        </div>
                        <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                          Upgrade to Premium to connect Facebook and Instagram accounts.
                        </p>
                        <a
                          href="https://ocalabusinessdirectory.com/premium"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block px-4 py-2 rounded-lg font-medium transition-colors ${
                            isDark
                              ? "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                              : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                          }`}
                        >
                          Upgrade to Premium
                        </a>
                      </div>
                    </div>
                  </div>
                ) : connectionLoading ? (
                  <p className={themeClasses.mutedText}>Loading connection status...</p>
                ) : connectionStatus && connectionStatus.ok !== false ? (
                  <div className="space-y-4">
                    {/* Configuration check */}
                    {connectionStatus.configured === false && (
                      <div className={`p-3 rounded-lg border ${
                        isDark
                          ? "bg-yellow-900/20 border-yellow-700 text-yellow-400"
                          : "bg-yellow-50 border-yellow-200 text-yellow-700"
                      }`}>
                        <p className="text-sm">
                          Meta connection not configured. Please contact support.
                        </p>
                      </div>
                    )}

                    {/* Facebook Status */}
                    <div className={`p-4 rounded-xl border ${
                      isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📘</span>
                          <div>
                            <div className={`font-medium ${themeClasses.headingText}`}>
                              Facebook
                            </div>
                            {connectionStatus.facebook.connected ? (
                              <div className="space-y-1">
                                <div className={`text-sm ${themeClasses.mutedText}`}>
                                  {connectionStatus.facebook.basicConnectGranted ? (
                                    <span>Basic connection ✅</span>
                                  ) : (
                                    <span>Connected ✅</span>
                                  )}
                                  {connectionStatus.facebook.pageName && ` (${connectionStatus.facebook.pageName})`}
                                </div>
                                {connectionStatus.facebook.pagesAccessGranted ? (
                                  <div className={`text-xs ${isDark ? "text-green-400" : "text-green-700"}`}>
                                    Pages access enabled ✅
                                  </div>
                                ) : connectionStatus.facebook.basicConnectGranted ? (
                                  <div className={`text-xs ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                                    Pages access not enabled
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                                Not connected
                              </div>
                            )}
                            {connectionStatus.facebook.pageId && (
                              <div className={`text-xs font-mono mt-1 ${themeClasses.mutedText}`}>
                                Page ID: {connectionStatus.facebook.pageId}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Instagram Status */}
                    <div className={`p-4 rounded-xl border ${
                      isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📸</span>
                          <div>
                            <div className={`font-medium ${themeClasses.headingText}`}>
                              Instagram
                            </div>
                            {connectionStatus.instagram.connected ? (
                              <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                                Connected ✅ {connectionStatus.instagram.username && `(@${connectionStatus.instagram.username})`}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className={`text-sm ${themeClasses.mutedText}`}>
                                  Not available
                                </div>
                                {connectionStatus.instagram.reasonIfUnavailable && (
                                  <div className={`text-xs ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                                    ℹ️ {connectionStatus.instagram.reasonIfUnavailable}
                                  </div>
                                )}
                              </div>
                            )}
                            {connectionStatus.instagram.igBusinessId && (
                              <div className={`text-xs font-mono mt-1 ${themeClasses.mutedText}`}>
                                IG Business ID: {connectionStatus.instagram.igBusinessId}
                              </div>
                            )}
                            {!connectionStatus.instagram.connected && connectionStatus.instagram.reasonIfUnavailable && (
                              <div className={`text-xs mt-1 ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                                ℹ️ {connectionStatus.instagram.reasonIfUnavailable}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Google Business Profile Status */}
                    {googleLoading ? (
                      <p className={themeClasses.mutedText}>Loading Google Business Profile status...</p>
                    ) : googleStatus && googleStatus.ok !== false ? (
                      <div className={`p-4 rounded-xl border ${
                        isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">📍</span>
                            <div className="flex-1">
                              <div className={`font-medium ${themeClasses.headingText}`}>
                                Google Business Profile
                              </div>
                              {googleStatus.connected ? (
                                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                                  Connected ✅ {googleStatus.location && `(${googleStatus.location.name})`}
                                </div>
                              ) : (
                                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                                  Not connected
                                </div>
                              )}
                              {googleStatus.location?.id && (
                                <div className={`text-xs font-mono mt-1 ${themeClasses.mutedText}`}>
                                  Location ID: {googleStatus.location.id}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Location Selection Dropdown */}
                        {googleStatus.connected && googleStatus.locations && googleStatus.locations.length > 1 && (
                          <div className="mt-3">
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Select Location:
                            </label>
                            <select
                              value={googleStatus.location?.id || ""}
                              onChange={(e) => handleSelectLocation(e.target.value)}
                              disabled={googleLocationsLoading}
                              className={getInputClasses(isDark)}
                            >
                              {googleStatus.locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : googleStatus && googleStatus.ok === false ? (
                      <div className={`p-4 rounded-xl border ${
                        isDark 
                          ? "border-red-700/50 bg-red-900/20 text-red-400" 
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}>
                        <p className="text-sm">
                          {googleStatus.errorCode === "GOOGLE_NOT_CONFIGURED" 
                            ? "Google Business Profile connection not configured. Please contact support."
                            : googleStatus.errorCode === "DB_ERROR"
                            ? "Database update required. Run Prisma migration."
                            : googleStatus.errorCode === "UNAUTHORIZED"
                            ? "Please sign in again."
                            : googleStatus.errorMessage || "Unable to load connection status. Please refresh or try again."}
                        </p>
                      </div>
                    ) : null}

                    {/* Publishing Status Info */}
                    {connectionStatus.publishing && !connectionStatus.publishing.enabled && (
                      <div className={`p-4 rounded-xl border ${
                        isDark 
                          ? "border-yellow-700/50 bg-yellow-900/20 text-yellow-400" 
                          : "border-yellow-200 bg-yellow-50 text-yellow-800"
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg">ℹ️</span>
                          <div className="text-sm">
                            <div className="font-medium mb-1">Publishing Not Available</div>
                            <div>{connectionStatus.publishing.reasonIfDisabled}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connecting || !connectionStatus.configured || connectionStatus.facebook.connected}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          connecting || !connectionStatus.configured || connectionStatus.facebook.connected
                            ? isDark
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                        }`}
                      >
                        {connecting ? "Connecting..." : "Connect Facebook"}
                      </button>

                      {/* Enable Pages Access Button */}
                      {connectionStatus.facebook.connected && 
                       connectionStatus.facebook.basicConnectGranted && 
                       !connectionStatus.facebook.pagesAccessGranted && (
                        <button
                          type="button"
                          onClick={handleRequestPagesAccess}
                          disabled={requestingPagesAccess || !connectionStatus.configured}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            requestingPagesAccess || !connectionStatus.configured
                              ? isDark
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {requestingPagesAccess ? "Requesting..." : "Enable Pages Access"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={connectionLoading || !connectionStatus.facebook.connected}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          connectionLoading || !connectionStatus.facebook.connected
                            ? isDark
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : isDark
                            ? "bg-red-900/20 text-red-400 border border-red-700 hover:bg-red-900/30"
                            : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        }`}
                      >
                        Disconnect
                      </button>

                      <button
                        type="button"
                        onClick={handleTestPost}
                        disabled={testPostLoading || !connectionStatus?.facebook?.pagesAccessGranted}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          testPostLoading || !connectionStatus?.facebook?.pagesAccessGranted
                            ? isDark
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        title={!connectionStatus?.facebook?.pagesAccessGranted ? "Enable Pages Access first" : ""}
                      >
                        {testPostLoading ? "Sending..." : "Send Test Post"}
                      </button>

                      <button
                        type="button"
                        onClick={loadConnectionStatus}
                        disabled={connectionLoading}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          connectionLoading
                            ? isDark
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : isDark
                            ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {connectionLoading ? "Refreshing..." : "Refresh Status"}
                      </button>

                      {/* Admin Debug Link */}
                      {isAdmin && (
                        <a
                          href="/api/social-connections/meta/status"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                            isDark
                              ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700"
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-700 border border-slate-200"
                          }`}
                          title="Open Meta Status JSON (Admin Only)"
                        >
                          Open Meta Status JSON
                        </a>
                      )}
                    </div>

                    {/* Google Business Profile Action Buttons */}
                    {isPremiumUser === true && (
                      <div className="flex gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={handleGoogleConnect}
                          disabled={googleConnecting || googleStatus?.configured === false || googleStatus?.connected === true}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            googleConnecting || googleStatus?.configured === false || googleStatus?.connected === true
                              ? isDark
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                          }`}
                        >
                          {googleConnecting ? "Connecting..." : "Connect Google Business Profile"}
                        </button>

                        <button
                          type="button"
                          onClick={handleGoogleDisconnect}
                          disabled={googleLoading || googleStatus?.connected !== true}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            googleLoading || googleStatus?.connected !== true
                              ? isDark
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : isDark
                              ? "bg-red-900/20 text-red-400 border border-red-700 hover:bg-red-900/30"
                              : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                          }`}
                        >
                          Disconnect
                        </button>

                        <button
                          type="button"
                          onClick={handleGoogleTestPost}
                          disabled={googleTestPostLoading || googleStatus?.connected !== true || !googleStatus?.location}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            googleTestPostLoading || googleStatus?.connected !== true || !googleStatus?.location
                              ? isDark
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                          title={!googleStatus?.location ? "Select a location first" : ""}
                        >
                          {googleTestPostLoading ? "Sending..." : "Send GBP Test Post"}
                        </button>

                        <button
                          type="button"
                          onClick={loadGoogleStatus}
                          disabled={googleLoading}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            googleLoading
                              ? isDark
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : isDark
                              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {googleLoading ? "Refreshing..." : "Refresh Status"}
                        </button>
                      </div>
                    )}

                    {/* Google Test Post Results */}
                    {testPostResults?.google && (
                      <div className={`mt-4 p-4 rounded-xl border ${
                        isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                      }`}>
                        <div className={`font-medium mb-3 ${themeClasses.headingText}`}>
                          Google Business Profile Test Post
                        </div>
                        <div className={`p-3 rounded-lg ${
                          isDark ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200"
                        }`}>
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{testPostResults.google.ok ? "✅" : "❌"}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium ${themeClasses.headingText}`}>Google Business Profile</span>
                              </div>
                              {testPostResults.google.ok ? (
                                <div className="space-y-1">
                                  {testPostResults.google.permalink ? (
                                    <a
                                      href={testPostResults.google.permalink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`text-sm text-blue-600 hover:underline inline-flex items-center gap-1 ${isDark ? "text-blue-400" : ""}`}
                                    >
                                      View Post →
                                    </a>
                                  ) : (
                                    <span className={`text-sm ${themeClasses.mutedText}`}>Posted successfully</span>
                                  )}
                                  {testPostResults.google.postId && (
                                    <p className={`text-xs font-mono ${themeClasses.mutedText}`}>
                                      Post ID: {testPostResults.google.postId}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
                                  {testPostResults.google.error || "Failed to post"}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Test Post Results */}
                    {testPostResults && (
                      <div className={`mt-4 p-4 rounded-xl border ${
                        isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                      }`}>
                        <div className={`font-medium mb-3 ${themeClasses.headingText}`}>
                          Test Post Results
                        </div>
                        
                        {/* Overall status banner */}
                        {(() => {
                          const fbOk = testPostResults.facebook?.ok === true;
                          const igOk = testPostResults.instagram?.ok === true;
                          const fbAttempted = !!testPostResults.facebook;
                          const igAttempted = !!testPostResults.instagram;
                          const allSucceeded = (fbAttempted ? fbOk : true) && (igAttempted ? igOk : true);
                          const partialSuccess = (fbOk || igOk) && !allSucceeded;
                          
                          if (partialSuccess) {
                            return (
                              <div className={`mb-3 p-2 rounded-lg ${
                                isDark ? "bg-yellow-900/20 border border-yellow-700 text-yellow-400" : "bg-yellow-50 border border-yellow-200 text-yellow-700"
                              }`}>
                                <p className="text-sm">⚠️ Partial success: Some posts succeeded, others failed.</p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        <div className="space-y-3">
                          {testPostResults.facebook && (
                            <div className={`p-3 rounded-lg ${
                              isDark ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200"
                            }`}>
                              <div className="flex items-start gap-3">
                                <span className="text-xl">{testPostResults.facebook.ok ? "✅" : "❌"}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-medium ${themeClasses.headingText}`}>Facebook</span>
                                  </div>
                                  {testPostResults.facebook.ok ? (
                                    <div className="space-y-1">
                                      {testPostResults.facebook.permalink ? (
                                        <a
                                          href={testPostResults.facebook.permalink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`text-sm text-blue-600 hover:underline inline-flex items-center gap-1 ${isDark ? "text-blue-400" : ""}`}
                                        >
                                          View Post →
                                        </a>
                                      ) : (
                                        <span className={`text-sm ${themeClasses.mutedText}`}>Posted successfully</span>
                                      )}
                                      {testPostResults.facebook.postId && (
                                        <p className={`text-xs font-mono ${themeClasses.mutedText}`}>
                                          Post ID: {testPostResults.facebook.postId}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
                                      {testPostResults.facebook.error || "Failed to post"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {testPostResults.instagram && (
                            <div className={`p-3 rounded-lg ${
                              isDark ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200"
                            }`}>
                              <div className="flex items-start gap-3">
                                <span className="text-xl">{testPostResults.instagram.ok ? "✅" : "❌"}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-medium ${themeClasses.headingText}`}>Instagram</span>
                                  </div>
                                  {testPostResults.instagram.ok ? (
                                    <div className="space-y-1">
                                      {testPostResults.instagram.permalink ? (
                                        <a
                                          href={testPostResults.instagram.permalink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`text-sm text-blue-600 hover:underline inline-flex items-center gap-1 ${isDark ? "text-blue-400" : ""}`}
                                        >
                                          View Post →
                                        </a>
                                      ) : (
                                        <span className={`text-sm ${themeClasses.mutedText}`}>Posted successfully</span>
                                      )}
                                      {testPostResults.instagram.postId && (
                                        <p className={`text-xs font-mono ${themeClasses.mutedText}`}>
                                          Post ID: {testPostResults.instagram.postId}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
                                      {testPostResults.instagram.error || "Failed to post"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : isPremiumUser === true && connectionStatus ? (
                  // Premium user but status has error - show specific error message
                  <div className={`p-4 rounded-xl border ${
                    isDark 
                      ? "border-red-700/50 bg-red-900/20 text-red-400" 
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}>
                    <p className="text-sm">
                      {connectionStatus.errorCode === "META_NOT_CONFIGURED" 
                        ? "Meta connection not configured. Please contact support."
                        : connectionStatus.errorCode === "DB_ERROR"
                        ? "Database update required. Run Prisma migration."
                        : connectionStatus.errorCode === "UNAUTHORIZED"
                        ? "Please sign in again."
                        : connectionStatus.errorMessage || "Unable to load connection status. Please refresh or try again."}
                    </p>
                  </div>
                ) : isPremiumUser === true ? (
                  // Premium user but no status data yet - show generic error
                  <div className={`p-4 rounded-xl border ${
                    isDark 
                      ? "border-red-700/50 bg-red-900/20 text-red-400" 
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}>
                    <p className="text-sm">
                      Unable to load connection status. Please refresh or try again.
                    </p>
                  </div>
                ) : isPremiumUser === false ? (
                  // Non-premium user - upgrade prompt (should not reach here due to earlier check, but defensive)
                  null
                ) : (
                  // Premium status not yet determined - show loading state
                  <p className={themeClasses.mutedText}>Loading...</p>
                )}
              </OBDPanel>

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
                    This will be used to generate posts that match your brand&apos;s personality.
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

              {/* Image Settings */}
              <OBDPanel isDark={isDark}>
                <OBDHeading level={2} isDark={isDark} className="mb-4">
                  Image Generation (Optional)
                </OBDHeading>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.imageSettings?.enableImages || false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            imageSettings: {
                              ...settings.imageSettings!,
                              enableImages: e.target.checked,
                            },
                          })
                        }
                        className="rounded"
                      />
                      <span className={`font-medium ${themeClasses.headingText}`}>
                        Include images (optional)
                      </span>
                    </label>
                    <p className={`text-xs mt-1 ml-7 ${themeClasses.mutedText}`}>
                      If image generation fails, posts will still publish normally.
                    </p>
                  </div>

                  {settings.imageSettings?.enableImages && (
                    <>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Image Category Mode
                        </label>
                        <select
                          value={settings.imageSettings?.imageCategoryMode || "auto"}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              imageSettings: {
                                ...settings.imageSettings!,
                                imageCategoryMode: e.target.value as
                                  | "auto"
                                  | "educational"
                                  | "promotion"
                                  | "social_proof"
                                  | "local_abstract"
                                  | "evergreen",
                              },
                            })
                          }
                          className={getInputClasses(isDark)}
                        >
                          <option value="auto">Auto (inferred from post content)</option>
                          <option value="educational">Educational</option>
                          <option value="promotion">Promotion</option>
                          <option value="social_proof">Social Proof</option>
                          <option value="local_abstract">Local Abstract</option>
                          <option value="evergreen">Evergreen</option>
                        </select>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          Auto mode maps post content to appropriate image category
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.imageSettings?.allowTextOverlay || false}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                imageSettings: {
                                  ...settings.imageSettings!,
                                  allowTextOverlay: e.target.checked,
                                },
                              })
                            }
                            className="rounded"
                          />
                          <span className={`font-medium ${themeClasses.headingText}`}>
                            Allow Text Overlay
                          </span>
                        </label>
                        <p className={`text-xs mt-1 ml-7 ${themeClasses.mutedText}`}>
                          Allow minimal text overlays on generated images (category rules still apply)
                        </p>
                      </div>
                    </>
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

