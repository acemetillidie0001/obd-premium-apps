"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

/**
 * Verification checklist:
 * - Tooltip works (mouse + keyboard)
 * - Use OBD Icon fills input but doesn't auto-save
 * - Clear still works
 * - Initials show when no avatar or on image load failure
 * - Bubble uses avatar if present; initials otherwise
 * - Mobile layout ok
 */

// Helper function to get initials from business name
const getInitials = (name: string): string => {
  if (!name || !name.trim()) {
    return "AI";
  }
  
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  
  if (words.length === 0) {
    return "AI";
  }
  
  if (words.length === 1) {
    // Single word: take first 1-2 letters
    const first = words[0];
    return first.substring(0, Math.min(2, first.length)).toUpperCase();
  }
  
  // Multiple words: take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
};

interface WidgetSettingsData {
  enabled: boolean;
  brandColor: string;
  greeting: string;
  position: "bottom-right" | "bottom-left";
  assistantAvatarUrl?: string | null;
  publicKey: string;
}

interface WidgetSettingsProps {
  isDark: boolean;
  businessId: string;
  businessName?: string; // Optional business name for initials fallback
}

export default function WidgetSettings({
  isDark,
  businessId,
  businessName = "",
}: WidgetSettingsProps) {
  const themeClasses = getThemeClasses(isDark);

  const [settings, setSettings] = useState<WidgetSettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [brandColor, setBrandColor] = useState("#29c4a9");
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [assistantAvatarUrl, setAssistantAvatarUrl] = useState<string>("");
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipButtonRef = useRef<HTMLButtonElement>(null);
  
  // OBD Icon URL
  const OBD_ICON_URL = "https://ocalabusinessdirectory.com/wp-content/uploads/2025/10/Copy-of-Black-White-Elegant-Typography-Glitch-Logo-Teal-250-x-80-px.png";
  
  // Get initials for fallback
  const assistantInitials = getInitials(businessName);

  // Load settings
  const loadSettings = async () => {
    if (!businessId.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/ai-help-desk/widget/settings?businessId=${encodeURIComponent(businessId.trim())}`
      );
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load settings");
      }

      const data = json.data;
      setSettings(data);
      setEnabled(data.enabled);
      setBrandColor(data.brandColor || "#29c4a9");
      setGreeting(data.greeting || "Hi! How can I help you today?");
      setPosition(data.position || "bottom-right");
      setAssistantAvatarUrl(data.assistantAvatarUrl || "");
    } catch (err) {
      console.error("Load settings error:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [businessId]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        tooltipButtonRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !tooltipButtonRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTooltip]);

  // Handle "Use OBD Icon" button
  const handleUseOBDIcon = () => {
    setAssistantAvatarUrl(OBD_ICON_URL);
    setAvatarPreviewError(false);
    // Trigger validation by simulating input change
    // The URL validation will happen automatically via the onChange handler
  };

  const handleSave = async () => {
    if (!businessId.trim()) {
      setError("Business ID is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/ai-help-desk/widget/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          enabled,
          brandColor,
          greeting,
          position,
          assistantAvatarUrl: assistantAvatarUrl.trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to save settings");
      }

      setSettings(json.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async () => {
    if (!businessId.trim()) {
      setError("Business ID is required");
      return;
    }

    if (!confirm("Are you sure you want to rotate the widget key? This will invalidate existing widget embeds and require updating the embed code.")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-help-desk/widget/rotate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to rotate key");
      }

      // Reload settings to get new key
      await loadSettings();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Rotate key error:", err);
      setError(err instanceof Error ? err.message : "Failed to rotate key");
    } finally {
      setSaving(false);
    }
  };

  // Generate embed code
  const getEmbedCode = () => {
    if (!settings?.publicKey || !businessId.trim()) {
      return "";
    }

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${baseUrl}/widget/ai-help-desk.js?businessId=${encodeURIComponent(businessId.trim())}&key=${encodeURIComponent(settings.publicKey)}"></script>`;
  };

  const embedCode = getEmbedCode();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <OBDHeading level={2} isDark={isDark}>
          Chat Widget Settings
        </OBDHeading>
        <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
          Configure and embed an AI chat widget on your website
        </p>
      </div>

      {/* Settings Panel */}
      <OBDPanel isDark={isDark}>
        <div className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <label htmlFor="enabled" className={`text-sm font-medium ${themeClasses.labelText}`}>
              Enable Widget
            </label>
          </div>

          {/* Brand Color */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Brand Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className={getInputClasses(isDark, "flex-1")}
                placeholder="#29c4a9"
                maxLength={7}
              />
            </div>
          </div>

          {/* Greeting */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Greeting Message
            </label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className={getInputClasses(isDark, "w-full")}
              placeholder="Hi! How can I help you today?"
              maxLength={200}
            />
          </div>

          {/* Position */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as "bottom-right" | "bottom-left")}
              className={getInputClasses(isDark, "w-full")}
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>

          {/* Assistant Profile Image */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label 
                htmlFor="assistantAvatarUrl"
                className={`block text-sm font-medium ${themeClasses.labelText}`}
              >
                Assistant Profile Image (Square)
              </label>
              {/* Tooltip */}
              <div className="relative">
                <button
                  ref={tooltipButtonRef}
                  type="button"
                  onClick={() => setShowTooltip(!showTooltip)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onFocus={() => setShowTooltip(true)}
                  onBlur={() => setShowTooltip(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowTooltip(!showTooltip);
                    }
                    if (e.key === "Escape") {
                      setShowTooltip(false);
                    }
                  }}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isDark
                      ? "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                      : "border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                  }`}
                  aria-label="Recommended image size info"
                  aria-describedby="avatar-tooltip"
                  aria-expanded={showTooltip}
                >
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                {showTooltip && (
                  <div
                    ref={tooltipRef}
                    id="avatar-tooltip"
                    role="tooltip"
                    className={`absolute left-0 top-6 z-50 w-64 p-3 rounded-lg border shadow-lg ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-slate-200"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <p className="text-xs leading-relaxed">
                      Square works best. 250×250 recommended. Transparent PNG looks great.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
              Optional. Use a square image (recommended 250×250).
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1 w-full">
                <input
                  id="assistantAvatarUrl"
                  type="url"
                  value={assistantAvatarUrl}
                  onChange={(e) => {
                    setAssistantAvatarUrl(e.target.value);
                    setAvatarPreviewError(false);
                  }}
                  className={getInputClasses(isDark, "w-full")}
                  placeholder="https://yourbusiness.com/logo.png"
                  aria-describedby="assistantAvatarUrl-helper assistantAvatarUrl-error"
                  aria-invalid={avatarPreviewError ? "true" : "false"}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {assistantAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssistantAvatarUrl("");
                        setAvatarPreviewError(false);
                      }}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        isDark
                          ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      }`}
                      aria-label="Clear assistant profile image"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleUseOBDIcon}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      isDark
                        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-label="Use OBD icon as assistant profile image"
                  >
                    Use OBD Icon
                  </button>
                </div>
                <p className={`text-xs mt-2 ${themeClasses.mutedText} opacity-75`}>
                  Tip: Transparent PNGs look best in dark mode.
                </p>
              </div>
              
              {/* Preview */}
              {assistantAvatarUrl.trim() ? (
                <div className="flex-shrink-0">
                  {avatarPreviewError ? (
                    <div 
                      className={`w-20 h-20 rounded-lg border-2 flex items-center justify-center ${
                        isDark ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-100"
                      }`}
                    >
                      {/* Fallback to initials when image fails */}
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                          isDark
                            ? "bg-gradient-to-br from-[#29c4a9] to-[#1ea085]"
                            : "bg-gradient-to-br from-[#29c4a9] to-[#1ea085]"
                        }`}
                        aria-label="Assistant avatar initials"
                      >
                        {assistantInitials}
                      </div>
                    </div>
                  ) : (
                    <img
                      src={assistantAvatarUrl}
                      alt="Assistant profile image preview"
                      className="w-20 h-20 rounded-lg object-cover border-2"
                      style={{ borderColor: brandColor }}
                      onError={() => {
                        setAvatarPreviewError(true);
                      }}
                      onLoad={() => {
                        setAvatarPreviewError(false);
                      }}
                    />
                  )}
                </div>
              ) : (
                /* Show initials preview when no URL */
                <div className="flex-shrink-0">
                  <div
                    className={`w-20 h-20 rounded-lg border-2 flex items-center justify-center ${
                      isDark ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-100"
                    }`}
                  >
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                        isDark
                          ? "bg-gradient-to-br from-[#29c4a9] to-[#1ea085]"
                          : "bg-gradient-to-br from-[#29c4a9] to-[#1ea085]"
                      }`}
                      aria-label="Assistant avatar initials"
                    >
                      {assistantInitials}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <p 
              id="assistantAvatarUrl-helper"
              className={`text-xs mt-2 ${themeClasses.mutedText}`}
            >
              Image will be displayed as a circular avatar in the chat widget.
            </p>
            {avatarPreviewError && (
              <p 
                id="assistantAvatarUrl-error"
                className={`text-xs mt-1 ${isDark ? "text-yellow-400" : "text-yellow-600"}`}
              >
                Could not load image. Please check the URL.
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className={getErrorPanelClasses(isDark)}>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className={`p-4 rounded-lg border ${
              isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
            }`}>
              <p className={`text-sm ${isDark ? "text-green-300" : "text-green-800"}`}>
                ✓ Settings saved successfully!
              </p>
            </div>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className={SUBMIT_BUTTON_CLASSES}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </OBDPanel>

      {/* Embed Code Panel */}
      {settings && (
        <OBDPanel isDark={isDark}>
          <div className="space-y-4">
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-2">
                Embed Code
              </OBDHeading>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                Copy and paste this code into your website to add the chat widget
              </p>
            </div>

            {embedCode ? (
              <>
                <div className="relative">
                  <textarea
                    value={embedCode}
                    readOnly
                    className={getInputClasses(isDark, "w-full font-mono text-sm")}
                    rows={3}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode);
                      setSuccess(true);
                      setTimeout(() => setSuccess(false), 2000);
                    }}
                    className={`absolute top-2 right-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Copy
                  </button>
                </div>

                {/* Rotate Key */}
                <div className="pt-4 border-t" style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${themeClasses.labelText}`}>
                        Widget Key
                      </p>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Rotate key if you suspect it's been compromised
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRotateKey}
                      disabled={saving}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        saving
                          ? isDark
                            ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                            ? "border-yellow-700 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40"
                            : "border-yellow-600 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                      }`}
                    >
                      Rotate Key
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={`text-center py-8 ${themeClasses.mutedText}`}>
                <p>Loading embed code...</p>
              </div>
            )}
          </div>
        </OBDPanel>
      )}

      {/* Loading State */}
      {loading && (
        <OBDPanel isDark={isDark}>
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>
            <p>Loading settings...</p>
          </div>
        </OBDPanel>
      )}
    </div>
  );
}

