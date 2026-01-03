"use client";

import { useState, useEffect } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import { getInputClasses } from "@/lib/obd-framework/theme";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import {
  saveBrandProfile,
  loadBrandProfile,
  clearBrandProfile,
  BRAND_PROFILE_PRESETS,
  type BrandProfile,
} from "@/lib/utils/bdw-brand-profile";

interface BrandProfilePanelProps {
  isDark: boolean;
  businessName: string;
  onApplyToForm: (profile: BrandProfile, fillEmptyOnly: boolean) => void;
}

export default function BrandProfilePanel({
  isDark,
  businessName,
  onApplyToForm,
}: BrandProfilePanelProps) {
  const themeClasses = getThemeClasses(isDark);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [fillEmptyOnly, setFillEmptyOnly] = useState(true);
  const [profile, setProfile] = useState<BrandProfile>({
    brandVoice: "",
    targetAudience: "",
    uniqueSellingPoints: "",
    services: "",
    city: "",
    state: "",
  });

  // Load profile from localStorage when business name changes
  useEffect(() => {
    if (businessName.trim()) {
      const loaded = loadBrandProfile(businessName.trim());
      if (loaded) {
        // Synchronizing with localStorage (external system) is a valid use case for useEffect
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProfile(loaded);
      }
    }
  }, [businessName]);

  const updateProfileField = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handlePresetSelect = (presetName: string) => {
    const preset = BRAND_PROFILE_PRESETS[presetName];
    if (preset) {
      setProfile(preset);
    }
  };

  const handleSave = () => {
    if (!businessName.trim()) {
      alert("Please enter a business name first.");
      return;
    }
    const success = saveBrandProfile(businessName.trim(), profile);
    if (success) {
      alert("Brand profile saved!");
    } else {
      alert("Failed to save brand profile. Please check if localStorage is available.");
    }
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the brand profile?")) {
      setProfile({
        brandVoice: "",
        targetAudience: "",
        uniqueSellingPoints: "",
        services: "",
        city: "",
        state: "",
      });
      if (businessName.trim()) {
        clearBrandProfile(businessName.trim());
      }
    }
  };

  const handleApply = () => {
    onApplyToForm(profile, fillEmptyOnly);
  };

  return (
    <OBDPanel isDark={isDark} className="mt-7">
      <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b cursor-pointer ${
            isDark ? "border-slate-700" : "border-slate-200"
          }`}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            Brand Profile
          </h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="p-4 space-y-4">
            {/* Presets */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Presets
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handlePresetSelect(e.target.value);
                    e.target.value = ""; // Reset select
                  }
                }}
                className={getInputClasses(isDark)}
              >
                <option value="">Select a preset...</option>
                {Object.keys(BRAND_PROFILE_PRESETS).map((presetName) => (
                  <option key={presetName} value={presetName}>
                    {presetName}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Voice */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Brand Voice
              </label>
              <textarea
                value={profile.brandVoice}
                onChange={(e) => updateProfileField("brandVoice", e.target.value)}
                rows={3}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Paste 2–4 sentences that sound like your existing brand voice"
              />
            </div>

            {/* Target Audience */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Target Audience
              </label>
              <textarea
                value={profile.targetAudience}
                onChange={(e) => updateProfileField("targetAudience", e.target.value)}
                rows={2}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="e.g., Local families, small businesses, retirees"
              />
            </div>

            {/* Unique Selling Points */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Unique Selling Points
              </label>
              <textarea
                value={profile.uniqueSellingPoints}
                onChange={(e) => updateProfileField("uniqueSellingPoints", e.target.value)}
                rows={3}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="List what makes your business stand out..."
              />
            </div>

            {/* Primary Services */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Primary Services
              </label>
              <textarea
                value={profile.services}
                onChange={(e) => updateProfileField("services", e.target.value)}
                rows={3}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Describe your main services, products, policies, hours, etc..."
              />
            </div>

            {/* City/State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  City (Optional)
                </label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(e) => updateProfileField("city", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Ocala"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  State (Optional)
                </label>
                <input
                  type="text"
                  value={profile.state}
                  onChange={(e) => updateProfileField("state", e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="Florida"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 text-sm font-medium rounded-xl transition-colors bg-[#29c4a9] text-white hover:bg-[#24b09a]"
              >
                Apply to Form
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fillEmptyOnly}
                  onChange={(e) => setFillEmptyOnly(e.target.checked)}
                  className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                />
                <span className={`text-sm ${themeClasses.labelText}`}>Fill empty only</span>
              </label>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleSave}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Save Profile
              </button>
              <button
                type="button"
                onClick={handleClear}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Clear Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </OBDPanel>
  );
}

