"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import ResultCard from "@/components/obd/ResultCard";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";
import {
  clearAiLogoToBrandKitHandoff,
  readAiLogoToBrandKitHandoff,
  type AiLogoToBrandKitHandoffPayload,
} from "@/app/apps/ai-logo-generator/logo-handoff";
import {
  BrandKitBuilderRequest,
  BrandKitBuilderResponse,
  BrandPersonality,
  LanguageOption,
  VariationMode,
  HashtagStyle,
} from "./types";

const STORAGE_KEY = "obd.v3.brandKitBuilder.form";
const USE_BRAND_PROFILE_KEY = "obd.v3.useBrandProfile";

const defaultFormValues: BrandKitBuilderRequest = {
  businessName: "",
  businessType: "",
  services: [],
  city: "Ocala",
  state: "Florida",
  brandPersonality: "Professional",
  targetAudience: "",
  differentiators: "",
  inspirationBrands: "",
  avoidStyles: "",
  brandVoice: "",
  toneNotes: "",
  language: "English",
  industryKeywords: "",
  vibeKeywords: "",
  variationMode: "Conservative",
  includeHashtags: false,
  hashtagStyle: "Local",
  includeSocialPostTemplates: false,
  includeFAQStarter: false,
  includeGBPDescription: false,
  includeMetaDescription: false,
};

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

export default function BrandKitBuilderPage() {
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  // Tier 5C+ apply-only handoff banner + draft suggestion (no auto-apply)
  const [aiLogoHandoff, setAiLogoHandoff] = useState<AiLogoToBrandKitHandoffPayload | null>(null);
  const [aiLogoHandoffExpired, setAiLogoHandoffExpired] = useState(false);
  const [suggestedBrandMark, setSuggestedBrandMark] = useState<
    | null
    | {
        name: string;
        imageUrl: string;
        prompt: string;
        businessId: string;
        createdAt: string;
      }
  >(null);

  const [form, setForm] = useState<BrandKitBuilderRequest>(defaultFormValues);
  const [servicesInput, setServicesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandKitBuilderResponse | null>(null);
  const [lastPayload, setLastPayload] =
    useState<BrandKitBuilderRequest | null>(null);
  const [brandProfile, setBrandProfile] = useState<{
    id: string;
    updatedAt: string;
    [key: string]: unknown;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [useBrandProfile, setUseBrandProfile] = useState(true);

  const urlBusinessId = (searchParams?.get("businessId") || "").trim();

  const preferredLogo = useMemo(() => {
    const logos = aiLogoHandoff?.logos || [];
    const firstWithImage = logos.find((l) => typeof l.imageUrl === "string" && l.imageUrl);
    return firstWithImage ?? null;
  }, [aiLogoHandoff]);

  const handoffBusinessMismatch =
    !!aiLogoHandoff?.businessId &&
    !!urlBusinessId &&
    aiLogoHandoff.businessId.trim() !== urlBusinessId;

  // Read handoff from sessionStorage only when explicitly requested via ?handoff=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams?.get("handoff") !== "1") return;

    const { payload, expired } = readAiLogoToBrandKitHandoff();
    if (payload) {
      setAiLogoHandoff(payload);
      setAiLogoHandoffExpired(false);
    } else if (expired) {
      setAiLogoHandoff(null);
      setAiLogoHandoffExpired(true);
    }
  }, [searchParams]);

  const dismissAiLogoHandoff = () => {
    clearAiLogoToBrandKitHandoff();
    setAiLogoHandoff(null);
    setAiLogoHandoffExpired(false);
    if (typeof window !== "undefined") {
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);
    }
  };

  const applyAiLogoHandoff = () => {
    if (!aiLogoHandoff) return;
    if (!urlBusinessId || aiLogoHandoff.businessId.trim() !== urlBusinessId) return;
    if (!preferredLogo?.imageUrl) return;

    setSuggestedBrandMark({
      name: preferredLogo.name || "Suggested brand mark",
      imageUrl: preferredLogo.imageUrl,
      prompt: preferredLogo.prompt || "",
      businessId: aiLogoHandoff.businessId,
      createdAt: aiLogoHandoff.createdAt,
    });

    // One-time apply: clear transport + URL. No auto-save, no mutation beyond local draft state.
    dismissAiLogoHandoff();

    // Scroll to the suggestion panel for visibility.
    setTimeout(() => {
      const el = document.getElementById("ai-logo-suggested-mark");
      el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Load "use brand profile" preference from localStorage
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

  // Save "use brand profile" preference to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(USE_BRAND_PROFILE_KEY, JSON.stringify(useBrandProfile));
    } catch (err) {
      console.error("Failed to save useBrandProfile preference:", err);
    }
  }, [useBrandProfile]);

  // Load brand profile on mount
  useEffect(() => {
    let mounted = true;
    const loadBrandProfile = async () => {
      try {
        const res = await fetch("/api/brand-profile");
        if (res.ok && mounted) {
          const profile = await res.json();
          if (profile && mounted) {
            setBrandProfile(profile);
            if (profile.updatedAt) {
              setLastSavedAt(profile.updatedAt);
            }
            // Auto-load profile into form if form is empty AND useBrandProfile is true
            if (useBrandProfile) {
              setForm((currentForm) => {
                if (!currentForm.businessName && !currentForm.businessType) {
                const newForm = { ...currentForm };
                if (profile.businessName) newForm.businessName = profile.businessName;
                if (profile.businessType) newForm.businessType = profile.businessType;
                if (profile.city) newForm.city = profile.city;
                if (profile.state) newForm.state = profile.state;
                if (profile.brandPersonality) {
                  newForm.brandPersonality = profile.brandPersonality as BrandPersonality;
                }
                if (profile.targetAudience) newForm.targetAudience = profile.targetAudience;
                if (profile.differentiators) newForm.differentiators = profile.differentiators;
                if (profile.inspirationBrands) newForm.inspirationBrands = profile.inspirationBrands;
                if (profile.avoidStyles) newForm.avoidStyles = profile.avoidStyles;
                if (profile.brandVoice) newForm.brandVoice = profile.brandVoice;
                if (profile.toneNotes) newForm.toneNotes = profile.toneNotes;
                if (profile.language) {
                  newForm.language = profile.language as LanguageOption;
                }
                if (profile.industryKeywords) newForm.industryKeywords = profile.industryKeywords;
                if (profile.vibeKeywords) newForm.vibeKeywords = profile.vibeKeywords;
                if (profile.variationMode) {
                  newForm.variationMode = profile.variationMode as VariationMode;
                }
                if (profile.includeHashtags !== undefined) {
                  newForm.includeHashtags = profile.includeHashtags;
                }
                if (profile.hashtagStyle) {
                  newForm.hashtagStyle = profile.hashtagStyle as HashtagStyle;
                }
                if (profile.includeSocialPostTemplates !== undefined) {
                  newForm.includeSocialPostTemplates = profile.includeSocialPostTemplates;
                }
                if (profile.includeFAQStarter !== undefined) {
                  newForm.includeFAQStarter = profile.includeFAQStarter;
                }
                if (profile.includeGBPDescription !== undefined) {
                  newForm.includeGBPDescription = profile.includeGBPDescription;
                }
                if (profile.includeMetaDescription !== undefined) {
                  newForm.includeMetaDescription = profile.includeMetaDescription;
                }
                  return newForm;
                }
                return currentForm;
              });
            }
          } else if (mounted) {
            // No profile exists, try loading from localStorage
            if (typeof window !== "undefined") {
              try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                  const parsed = JSON.parse(stored) as BrandKitBuilderRequest;
                  setForm((currentForm) => {
                    if (!currentForm.businessName && !currentForm.businessType) {
                      return parsed;
                    }
                    return currentForm;
                  });
                  if (parsed.services && parsed.services.length > 0) {
                    setServicesInput(parsed.services.join(", "));
                  }
                }
              } catch (err) {
                console.error("Failed to load form from localStorage:", err);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load brand profile:", err);
      }
    };
    loadBrandProfile();
    return () => {
      mounted = false;
    };
  }, [useBrandProfile]);

  // Save to localStorage whenever form changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch (err) {
      console.error("Failed to save form to localStorage:", err);
    }
  }, [form]);

  function updateFormValue<K extends keyof BrandKitBuilderRequest>(
    key: K,
    value: BrandKitBuilderRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Load profile data into form
  const loadProfileIntoForm = (profile: {
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
    [key: string]: unknown;
  }) => {
    if (profile.businessName) updateFormValue("businessName", profile.businessName);
    if (profile.businessType) updateFormValue("businessType", profile.businessType);
    if (profile.city) updateFormValue("city", profile.city);
    if (profile.state) updateFormValue("state", profile.state);
    if (profile.brandPersonality) {
      updateFormValue("brandPersonality", profile.brandPersonality as BrandPersonality);
    }
    if (profile.targetAudience) updateFormValue("targetAudience", profile.targetAudience);
    if (profile.differentiators) updateFormValue("differentiators", profile.differentiators);
    if (profile.inspirationBrands) updateFormValue("inspirationBrands", profile.inspirationBrands);
    if (profile.avoidStyles) updateFormValue("avoidStyles", profile.avoidStyles);
    if (profile.brandVoice) updateFormValue("brandVoice", profile.brandVoice);
    if (profile.toneNotes) updateFormValue("toneNotes", profile.toneNotes);
    if (profile.language) {
      updateFormValue("language", profile.language as LanguageOption);
    }
    if (profile.industryKeywords) updateFormValue("industryKeywords", profile.industryKeywords);
    if (profile.vibeKeywords) updateFormValue("vibeKeywords", profile.vibeKeywords);
    if (profile.variationMode) {
      updateFormValue("variationMode", profile.variationMode as VariationMode);
    }
    if (profile.includeHashtags !== undefined) {
      updateFormValue("includeHashtags", profile.includeHashtags);
    }
    if (profile.hashtagStyle) {
      updateFormValue("hashtagStyle", profile.hashtagStyle as HashtagStyle);
    }
    if (profile.includeSocialPostTemplates !== undefined) {
      updateFormValue("includeSocialPostTemplates", profile.includeSocialPostTemplates);
    }
    if (profile.includeFAQStarter !== undefined) {
      updateFormValue("includeFAQStarter", profile.includeFAQStarter);
    }
    if (profile.includeGBPDescription !== undefined) {
      updateFormValue("includeGBPDescription", profile.includeGBPDescription);
    }
    if (profile.includeMetaDescription !== undefined) {
      updateFormValue("includeMetaDescription", profile.includeMetaDescription);
    }
  };

  const handleLoadSavedProfile = async () => {
    if (!brandProfile) return;
    
    try {
      const res = await fetch("/api/brand-profile");
      if (res.ok) {
        const profile = await res.json();
        if (profile) {
          loadProfileIntoForm(profile);
          setBrandProfile(profile);
          setError(null);
        }
      }
    } catch (err) {
      console.error("Failed to load brand profile:", err);
      setError("Failed to load saved profile. Please try again.");
    }
  };

  const saveSection = async (sectionKey: string, sectionValue: unknown): Promise<void> => {
    const payload = { sectionKey, sectionValue };
    const payloadSize = new Blob([JSON.stringify(payload)]).size;

    const res = await fetch("/api/brand-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseBodyText = await res.text();
    let errorData: { requestId?: string; message?: string; code?: string; details?: unknown } = {};
    
    try {
      errorData = JSON.parse(responseBodyText);
    } catch {
      // Response is not JSON, keep errorData as empty object
    }

    if (!res.ok) {
      console.error({
        section: sectionKey,
        requestId: errorData.requestId || null,
        status: res.status,
        responseBody: responseBodyText,
        payloadSizeBytes: payloadSize,
        errorCode: errorData.code || null,
        errorMessage: errorData.message || null,
      });
      
      let errorMessage = `Failed to save ${sectionKey}.`;
      if (errorData.code) {
        // Include error code for better debugging
        errorMessage += ` Error: ${errorData.code}`;
      }
      if (errorData.message && errorData.message !== "Save failed") {
        // Include server message if it's more specific than generic "Save failed"
        errorMessage += ` ${errorData.message}`;
      } else {
        errorMessage += ` Please try again.`;
      }
      if (errorData.requestId) {
        errorMessage += ` (Request ID: ${errorData.requestId})`;
      }
      throw new Error(errorMessage);
    }
  };

  const handleSaveToProfile = async () => {
    // Allow saving form data even without result (per button enable logic)
    // Button is enabled when: result exists OR required fields present
    const hasRequired = form.businessName.trim() && form.businessType.trim();
    if (!result && !hasRequired) return;

    setSavingProfile(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // Build sections array
      const sections: Array<{ key: string; value: unknown }> = [];

      // Business Basics
      if (form.city?.trim()) sections.push({ key: "city", value: form.city.trim() });
      if (form.state?.trim()) sections.push({ key: "state", value: form.state.trim() });

      // Brand Direction
      if (form.brandPersonality) sections.push({ key: "brandPersonality", value: form.brandPersonality });
      if (form.targetAudience?.trim()) sections.push({ key: "targetAudience", value: form.targetAudience.trim() });
      if (form.differentiators?.trim()) sections.push({ key: "differentiators", value: form.differentiators.trim() });
      if (form.inspirationBrands?.trim()) sections.push({ key: "inspirationBrands", value: form.inspirationBrands.trim() });
      if (form.avoidStyles?.trim()) sections.push({ key: "avoidStyles", value: form.avoidStyles.trim() });

      // Voice & Language
      if (form.brandVoice?.trim()) sections.push({ key: "brandVoice", value: form.brandVoice.trim() });
      if (form.toneNotes?.trim()) sections.push({ key: "toneNotes", value: form.toneNotes.trim() });
      if (form.language) sections.push({ key: "language", value: form.language });

      // Output Controls
      if (form.industryKeywords?.trim()) sections.push({ key: "industryKeywords", value: form.industryKeywords.trim() });
      if (form.vibeKeywords?.trim()) sections.push({ key: "vibeKeywords", value: form.vibeKeywords.trim() });
      if (form.variationMode) sections.push({ key: "variationMode", value: form.variationMode });
      sections.push({ key: "includeHashtags", value: Boolean(form.includeHashtags) });
      if (form.hashtagStyle) sections.push({ key: "hashtagStyle", value: form.hashtagStyle });

      // Extras toggles
      sections.push({ key: "includeSocialPostTemplates", value: Boolean(form.includeSocialPostTemplates) });
      sections.push({ key: "includeFAQStarter", value: Boolean(form.includeFAQStarter) });
      sections.push({ key: "includeGBPDescription", value: Boolean(form.includeGBPDescription) });
      sections.push({ key: "includeMetaDescription", value: Boolean(form.includeMetaDescription) });

      // Add JSON fields only if they exist (result may be null)
      if (result) {
        if (result.colorPalette?.colors) sections.push({ key: "colorsJson", value: result.colorPalette.colors });
        if (result.typography) sections.push({ key: "typographyJson", value: result.typography });
        if (result.messaging) sections.push({ key: "messagingJson", value: result.messaging });
        sections.push({ key: "kitJson", value: result }); // Full kit snapshot
      }

      // Save each section sequentially, stop on first error
      for (const section of sections) {
        await saveSection(section.key, section.value);
      }

      // Fetch updated profile after all sections are saved
      const profileRes = await fetch("/api/brand-profile");
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile) {
          setBrandProfile(profile);
          setLastSavedAt(profile.updatedAt || new Date().toISOString());
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      }
    } catch (err) {
      console.error("Failed to save brand profile:", err);
      setError(err instanceof Error ? err.message : "Failed to save brand profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleClearForm = () => {
    if (confirm("Are you sure you want to clear the form? This cannot be undone.")) {
      setForm(defaultFormValues);
      setServicesInput("");
      setResult(null);
      setError(null);
      setLastPayload(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const handleStartNew = () => {
    setForm(defaultFormValues);
    setServicesInput("");
    setResult(null);
    setError(null);
    // Do NOT clear lastPayload - "Generate Again" should still work
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Prevent double-submit
    if (loading) return;

    setError(null);
    setResult(null);

    // Validation
    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!form.businessType.trim()) {
      setError("Business type is required.");
      return;
    }

    setLoading(true);

    try {
      // Convert services input to array
      const servicesArray =
        servicesInput.trim() !== ""
          ? servicesInput
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];

      const apiPayload: BrandKitBuilderRequest = {
        ...form,
        services: servicesArray,
      };

      const res = await fetch("/api/brand-kit-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.requestId) {
            errorMessage += ` (Request ID: ${errorData.requestId})`;
          }
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json();

      if (response.ok && response.data) {
        setResult(response.data);
        setTimeout(() => {
          const resultsElement = document.getElementById("brand-kit-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.ok === false && response.error) {
        const errorMessage = response.requestId 
          ? `${response.error} (Request ID: ${response.requestId})`
          : response.error;
        throw new Error(errorMessage);
      } else {
        setResult(response);
      }

      setLastPayload(apiPayload);
    } catch (error) {
      console.error("Brand Kit Builder Submit Error:", error);
      let errorMessage = "Something went wrong while generating your brand kit. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastPayload || loading) return;
    
    // Restore form from last payload
    const restoredForm = { ...lastPayload };
    setForm(restoredForm);
    if (restoredForm.services && restoredForm.services.length > 0) {
      setServicesInput(restoredForm.services.join(", "));
    } else {
      setServicesInput("");
    }
    
    // Submit with last payload directly (don't wait for state update)
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/brand-kit-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lastPayload),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.requestId) {
            errorMessage += ` (Request ID: ${errorData.requestId})`;
          }
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json();
      if (response.ok && response.data) {
        setResult(response.data);
        setTimeout(() => {
          const resultsElement = document.getElementById("brand-kit-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.ok === false && response.error) {
        const errorMessage = response.requestId 
          ? `${response.error} (Request ID: ${response.requestId})`
          : response.error;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Brand Kit Builder Regenerate Error:", error);
      let errorMessage = "Something went wrong while regenerating your brand kit. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTxt = () => {
    if (!result) return;

    let text = `BRAND KIT: ${result.brandSummary.businessName}\n`;
    text += `Generated: ${new Date(result.meta.createdAtISO).toLocaleString()}\n`;
    text += `Model: ${result.meta.model}\n`;
    text += `Request ID: ${result.meta.requestId}\n`;
    text += `Language: ${result.meta.languageUsed}\n\n`;
    text += "=".repeat(50) + "\n\n";

    text += `BRAND SUMMARY\n${"-".repeat(50)}\n`;
    text += `Business: ${result.brandSummary.businessName}\n`;
    if (result.brandSummary.tagline) {
      text += `Tagline: ${result.brandSummary.tagline}\n`;
    }
    text += `Positioning: ${result.brandSummary.positioning}\n\n`;

    text += `COLOR PALETTE\n${"-".repeat(50)}\n`;
    result.colorPalette.colors.forEach((color) => {
      text += `${color.name}: ${color.hex}\n`;
      text += `Usage: ${color.usageGuidance}\n`;
      text += `Accessibility: ${color.accessibilityNote}\n\n`;
    });

    text += `TYPOGRAPHY\n${"-".repeat(50)}\n`;
    text += `Headline Font: ${result.typography.headlineFont}\n`;
    text += `Body Font: ${result.typography.bodyFont}\n`;
    text += `Fallback Stack: ${result.typography.fallbackStack}\n`;
    text += `Usage Notes: ${result.typography.usageNotes}\n\n`;

    text += `BRAND VOICE\n${"-".repeat(50)}\n`;
    text += `${result.brandVoice.description}\n\n`;
    text += "DO:\n";
    result.brandVoice.do.forEach((item) => {
      text += `  • ${item}\n`;
    });
    text += "\nDON'T:\n";
    result.brandVoice.dont.forEach((item) => {
      text += `  • ${item}\n`;
    });
    text += "\n";

    text += `MESSAGING\n${"-".repeat(50)}\n`;
    text += "Taglines:\n";
    result.messaging.taglines.forEach((tagline, i) => {
      text += `  ${i + 1}. ${tagline}\n`;
    });
    text += "\nValue Propositions:\n";
    result.messaging.valueProps.forEach((prop, i) => {
      text += `  ${i + 1}. ${prop}\n`;
    });
    text += `\nElevator Pitch:\n${result.messaging.elevatorPitch}\n\n`;

    text += `READY-TO-USE COPY\n${"-".repeat(50)}\n`;
    text += `Website Hero:\n`;
    text += `Headline: ${result.readyToUseCopy.websiteHero.headline}\n`;
    text += `Subheadline: ${result.readyToUseCopy.websiteHero.subheadline}\n\n`;
    text += `About Us:\n${result.readyToUseCopy.aboutUs}\n\n`;
    text += `Social Bios:\n`;
    text += `Instagram: ${result.readyToUseCopy.socialBios.instagram}\n`;
    text += `Facebook: ${result.readyToUseCopy.socialBios.facebook}\n`;
    text += `X: ${result.readyToUseCopy.socialBios.x}\n\n`;
    text += `Email Signature:\n${result.readyToUseCopy.emailSignature}\n\n`;

    if (result.extras) {
      text += `EXTRAS\n${"-".repeat(50)}\n`;
      if (result.extras.socialPostTemplates) {
        text += "Social Post Templates:\n";
        result.extras.socialPostTemplates.forEach((template, i) => {
          text += `${i + 1}. ${template}\n\n`;
        });
      }
      if (result.extras.faqStarter) {
        text += "FAQ Starter:\n";
        result.extras.faqStarter.forEach((faq, i) => {
          text += `Q${i + 1}: ${faq.question}\n`;
          text += `A${i + 1}: ${faq.answer}\n\n`;
        });
      }
      if (result.extras.gbpDescription) {
        text += `Google Business Profile Description:\n${result.extras.gbpDescription}\n\n`;
      }
      if (result.extras.metaDescription) {
        text += `Meta Description:\n${result.extras.metaDescription}\n\n`;
      }
    }

    // Download
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brand-kit-${result.brandSummary.businessName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brand-kit-${result.brandSummary.businessName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!result) {
      setError("No brand kit data available to export. Please generate a brand kit first.");
      return;
    }

    // Safeguard: ensure result has required fields
    if (!result.brandSummary?.businessName) {
      setError("Invalid brand kit data. Please regenerate your brand kit.");
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/brand-kit-builder/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ brandKit: result }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMessage = errorData.error || `Failed to generate PDF: ${res.status}`;
        if (errorData.requestId) {
          errorMessage += ` (Request ID: ${errorData.requestId})`;
        }
        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      // Safeguard: ensure blob is valid
      if (!blob || blob.size === 0) {
        throw new Error("PDF generation returned empty file. Please try again.");
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename =
        res.headers.get("Content-Disposition")?.split('filename="')[1]?.split('"')[0] ||
        `${result.brandSummary.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-brand-kit.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to export PDF. Please try again."
      );
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Brand Kit Builder"
      tagline="Generate a complete brand kit with colors, typography, voice, messaging, and ready-to-use assets for your Ocala business."
    >
      {/* Tier 5C+ Import Banner (apply-only) */}
      {(aiLogoHandoff || aiLogoHandoffExpired) && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div
            className={`rounded-xl border p-4 ${
              isDark
                ? "bg-slate-800/40 border-slate-700"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
                  Import suggestion from AI Logo Generator
                </p>
                {aiLogoHandoffExpired ? (
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    This handoff expired (10 min TTL). Go back and send again.
                  </p>
                ) : (
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    Apply will add a <span className="font-medium">draft</span> “Suggested brand mark” entry. Nothing is saved automatically.
                  </p>
                )}

                {!aiLogoHandoffExpired && aiLogoHandoff && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {preferredLogo?.imageUrl ? (
                      <img
                        src={preferredLogo.imageUrl}
                        alt="Suggested brand mark preview"
                        className="w-12 h-12 rounded-lg border object-cover"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-lg border flex items-center justify-center text-xs ${
                          isDark
                            ? "border-slate-700 bg-slate-900/40 text-slate-400"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        No image
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                        {preferredLogo?.name || "Suggested brand mark"}
                      </p>
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        Business: {aiLogoHandoff.businessId}
                      </p>
                    </div>
                  </div>
                )}

                {!aiLogoHandoffExpired && aiLogoHandoff && (!urlBusinessId || handoffBusinessMismatch) && (
                  <p className={`text-xs mt-3 ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                    Tenant mismatch guard: URL businessId must match payload businessId to apply.{" "}
                    {urlBusinessId ? `URL=${urlBusinessId}` : "Missing URL businessId."}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!aiLogoHandoffExpired && (
                  <button
                    type="button"
                    onClick={applyAiLogoHandoff}
                    disabled={
                      !aiLogoHandoff ||
                      !urlBusinessId ||
                      handoffBusinessMismatch ||
                      !preferredLogo?.imageUrl
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                        : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                    }`}
                  >
                    Apply
                  </button>
                )}
                <button
                  type="button"
                  onClick={dismissAiLogoHandoff}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </OBDPanel>
      )}

      {/* Draft-only Suggested Brand Mark Slot */}
      {suggestedBrandMark && (
        <OBDPanel isDark={isDark} className="mt-7" id="ai-logo-suggested-mark">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <OBDHeading level={2} isDark={isDark} className="!text-base">
                Suggested brand mark (draft)
              </OBDHeading>
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Draft-only suggestion. Nothing is saved until you explicitly use it elsewhere.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuggestedBrandMark(null)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Clear
            </button>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <img
              src={suggestedBrandMark.imageUrl}
              alt={suggestedBrandMark.name}
              className="w-full sm:w-56 h-auto rounded-xl border object-contain bg-white"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
                {suggestedBrandMark.name}
              </p>
              {suggestedBrandMark.prompt ? (
                <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                  <span className="font-medium">Prompt:</span> {suggestedBrandMark.prompt}
                </p>
              ) : null}
              <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                Source: AI Logo Generator · {new Date(suggestedBrandMark.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <a
                  href={suggestedBrandMark.imageUrl}
                  download={`suggested-brand-mark-${Date.now()}.png`}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    isDark
                      ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Download image
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(suggestedBrandMark.imageUrl);
                    } catch {
                      // ignore
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    isDark
                      ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        </OBDPanel>
      )}

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <OBDHeading level={2} isDark={isDark}>
              Brand Kit Details
            </OBDHeading>
            {/* Brand Profile Status Chip */}
            <div
              className={`text-xs px-3 py-1.5 rounded-full border ${
                saveSuccess
                  ? isDark
                    ? "bg-teal-900/50 text-teal-200 border-teal-700/50"
                    : "bg-teal-50 text-teal-700 border-teal-200"
                  : brandProfile
                  ? isDark
                    ? "bg-slate-800/50 text-slate-300 border-slate-700/50"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                  : isDark
                  ? "bg-slate-800/30 text-slate-400 border-slate-700/30"
                  : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
            >
              {saveSuccess
                ? "Brand Profile: Saved (updated just now)"
                : brandProfile
                ? `Brand Profile: Saved${lastSavedAt ? ` (${new Date(lastSavedAt).toLocaleString()})` : ""}`
                : "Brand Profile: Not saved"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {brandProfile && (
              <button
                type="button"
                onClick={handleLoadSavedProfile}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "bg-teal-900/50 text-teal-200 hover:bg-teal-900/70 border border-teal-700/50"
                    : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                }`}
                title={`Last saved: ${new Date(brandProfile.updatedAt).toLocaleString()}`}
              >
                Load Saved Profile
              </button>
            )}
            <button
              type="button"
              onClick={handleClearForm}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Clear Form
            </button>
          </div>
        </div>

        {/* Use saved brand profile toggle */}
        {brandProfile && (
          <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
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
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Business Basics */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Business Basics
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Name *
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) =>
                      updateFormValue("businessName", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="businessType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Type *
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={form.businessType}
                    onChange={(e) =>
                      updateFormValue("businessType", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="services"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Services (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="services"
                    value={servicesInput}
                    onChange={(e) => setServicesInput(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Pressure washing, driveway cleaning, window cleaning"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="city"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={form.city}
                      onChange={(e) => updateFormValue("city", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Ocala"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="state"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={form.state}
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Brand Direction */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Brand Direction
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="brandPersonality"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Brand Personality
                  </label>
                  <select
                    id="brandPersonality"
                    value={form.brandPersonality}
                    onChange={(e) =>
                      updateFormValue(
                        "brandPersonality",
                        e.target.value as BrandPersonality
                      )
                    }
                    className={getInputClasses(isDark)}
                  >
                    {BRAND_PERSONALITIES.map((personality) => (
                      <option key={personality} value={personality}>
                        {personality}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="targetAudience"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Target Audience (Optional)
                  </label>
                  <textarea
                    id="targetAudience"
                    value={form.targetAudience || ""}
                    onChange={(e) =>
                      updateFormValue("targetAudience", e.target.value)
                    }
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Local families, professionals, small business owners"
                  />
                </div>

                <div>
                  <label
                    htmlFor="differentiators"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    What Makes You Different (Optional)
                  </label>
                  <textarea
                    id="differentiators"
                    value={form.differentiators || ""}
                    onChange={(e) =>
                      updateFormValue("differentiators", e.target.value)
                    }
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="What sets you apart from competitors?"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inspirationBrands"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Inspiration Brands (Optional)
                  </label>
                  <textarea
                    id="inspirationBrands"
                    value={form.inspirationBrands || ""}
                    onChange={(e) =>
                      updateFormValue("inspirationBrands", e.target.value)
                    }
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Brands you admire or want to emulate"
                  />
                </div>

                <div>
                  <label
                    htmlFor="avoidStyles"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Styles to Avoid (Optional)
                  </label>
                  <textarea
                    id="avoidStyles"
                    value={form.avoidStyles || ""}
                    onChange={(e) =>
                      updateFormValue("avoidStyles", e.target.value)
                    }
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="e.g., no neon colors, avoid cursive fonts"
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Voice & Language */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Voice & Language
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="brandVoice"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Brand Voice (Optional - overrides personality if provided)
                  </label>
                  <textarea
                    id="brandVoice"
                    value={form.brandVoice || ""}
                    onChange={(e) =>
                      updateFormValue("brandVoice", e.target.value)
                    }
                    rows={4}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Describe how your brand sounds. For example: 'Warm and conversational, with a touch of humor.'"
                  />
                </div>

                <div>
                  <label
                    htmlFor="toneNotes"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Additional Tone Notes (Optional)
                  </label>
                  <textarea
                    id="toneNotes"
                    value={form.toneNotes || ""}
                    onChange={(e) =>
                      updateFormValue("toneNotes", e.target.value)
                    }
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Any additional guidance on tone and voice"
                  />
                </div>

                <div>
                  <label
                    htmlFor="language"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Language
                  </label>
                  <select
                    id="language"
                    value={form.language}
                    onChange={(e) =>
                      updateFormValue("language", e.target.value as LanguageOption)
                    }
                    className={getInputClasses(isDark)}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Bilingual">Bilingual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Output Controls */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Output Controls
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="industryKeywords"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Industry Keywords (Optional - limit to 1-2 mentions per section)
                  </label>
                  <textarea
                    id="industryKeywords"
                    value={form.industryKeywords || ""}
                    onChange={(e) =>
                      updateFormValue("industryKeywords", e.target.value)
                    }
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="e.g., pressure washing, Ocala, commercial cleaning"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vibeKeywords"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Vibe Keywords (Optional)
                  </label>
                  <textarea
                    id="vibeKeywords"
                    value={form.vibeKeywords || ""}
                    onChange={(e) =>
                      updateFormValue("vibeKeywords", e.target.value)
                    }
                    rows={2}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="e.g., trustworthy, professional, friendly"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="variationMode"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Variation Mode
                    </label>
                    <select
                      id="variationMode"
                      value={form.variationMode}
                      onChange={(e) =>
                        updateFormValue(
                          "variationMode",
                          e.target.value as VariationMode
                        )
                      }
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
                    <label
                      htmlFor="hashtagStyle"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Hashtag Style
                    </label>
                    <select
                      id="hashtagStyle"
                      value={form.hashtagStyle}
                      onChange={(e) =>
                        updateFormValue(
                          "hashtagStyle",
                          e.target.value as HashtagStyle
                        )
                      }
                      className={getInputClasses(isDark)}
                      disabled={!form.includeHashtags}
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
                      checked={form.includeHashtags}
                      onChange={(e) =>
                        updateFormValue("includeHashtags", e.target.checked)
                      }
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Include Hashtags</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Extras */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                Extra Sections
              </OBDHeading>
              <div className="space-y-3">
                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={form.includeSocialPostTemplates}
                    onChange={(e) =>
                      updateFormValue("includeSocialPostTemplates", e.target.checked)
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    Social Post Template Pack (3 short post templates)
                  </span>
                </label>

                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={form.includeFAQStarter}
                    onChange={(e) =>
                      updateFormValue("includeFAQStarter", e.target.checked)
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    FAQ Starter Pack (5 Q&A)
                  </span>
                </label>

                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={form.includeGBPDescription}
                    onChange={(e) =>
                      updateFormValue("includeGBPDescription", e.target.checked)
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    Google Business Profile Description (750 chars max)
                  </span>
                </label>

                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={form.includeMetaDescription}
                    onChange={(e) =>
                      updateFormValue("includeMetaDescription", e.target.checked)
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    Meta Description (140-160 chars)
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating Brand Kit...
                </span>
              ) : (
                "Generate Brand Kit"
              )}
            </button>
          </div>
        </form>
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Results */}
      {result && (() => {
        // Compute save button state (guardrail logic)
        const hasRequired = form.businessName.trim() && form.businessType.trim();
        const canSave = !!result || !!hasRequired;
        
        return (
          <OBDPanel isDark={isDark} className="mt-7 sm:mt-8" id="brand-kit-results">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Your Brand Kit
              </OBDHeading>
              <div className="flex gap-2">
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={handleSaveToProfile}
                    disabled={!canSave || savingProfile}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      saveSuccess
                        ? isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                        : isDark
                        ? "bg-teal-900/30 text-teal-300 hover:bg-teal-900/50 border border-teal-700/30"
                        : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                    }`}
                  >
                    {savingProfile ? "Saving..." : saveSuccess ? "✓ Saved" : "Save to Brand Profile"}
                  </button>
                  {lastSavedAt && !saveSuccess && (
                    <p className={`text-xs ${themeClasses.mutedText}`}>
                      Last saved: {new Date(lastSavedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                onClick={handleExportTxt}
                disabled={!result}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Export .txt
              </button>
              <button
                onClick={handleExportJson}
                disabled={!result}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Export .json
              </button>
              <button
                onClick={handleExportPdf}
                disabled={!result}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Brand Summary */}
            <ResultCard
              title="Brand Summary"
              isDark={isDark}
              copyText={`${result.brandSummary.businessName}${result.brandSummary.tagline ? ` - ${result.brandSummary.tagline}` : ""}\n\n${result.brandSummary.positioning}`}
            >
              <div className="space-y-3">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Business Name
                  </p>
                  <p
                    className={`font-semibold text-lg ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {result.brandSummary.businessName}
                  </p>
                </div>
                {result.brandSummary.tagline && (
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Tagline
                    </p>
                    <p className="font-medium italic">{result.brandSummary.tagline}</p>
                  </div>
                )}
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Positioning
                  </p>
                  <p className="whitespace-pre-wrap">{result.brandSummary.positioning}</p>
                </div>
              </div>
            </ResultCard>

            {/* Color Palette */}
            <ResultCard
              title="Color Palette"
              isDark={isDark}
              copyText={result.colorPalette.colors.map(c => `${c.name}: ${c.hex}`).join("\n") + "\n\nJSON:\n" + JSON.stringify(result.colorPalette.colors.map(c => ({ name: c.name, hex: c.hex })), null, 2)}
            >
              <div className="space-y-4">
                {result.colorPalette.colors.length < 5 && (
                  <div className={`p-3 rounded-lg border ${
                    isDark
                      ? "bg-yellow-900/20 border-yellow-700 text-yellow-300"
                      : "bg-yellow-50 border-yellow-200 text-yellow-800"
                  }`}>
                    <p className="text-sm font-medium">
                      ⚠️ Warning: Expected minimum 5 colors, received {result.colorPalette.colors.length}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.colorPalette.colors.map((color, idx) => (
                    <div key={idx}>
                      <div
                        className="w-full h-24 rounded-lg border-2 border-slate-300 dark:border-slate-600 mb-2"
                        style={{ backgroundColor: color.hex }}
                      ></div>
                      <p className="font-mono text-sm font-medium mb-1">
                        {color.hex}
                      </p>
                      <p className="text-xs font-semibold mb-1">{color.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {color.usageGuidance}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        {color.accessibilityNote}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </ResultCard>

            {/* Typography */}
            <ResultCard
              title="Typography Pairing"
              isDark={isDark}
              copyText={`Headline Font: ${result.typography.headlineFont}\nBody Font: ${result.typography.bodyFont}\nFallback Stack: ${result.typography.fallbackStack}\n\nUsage Notes:\n${result.typography.usageNotes}`}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Headline Font
                    </p>
                    <p className="text-lg font-semibold mb-1">
                      {result.typography.headlineFont}
                    </p>
                    <p
                      className="text-sm"
                      style={{ fontFamily: result.typography.headlineFont }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Body Font
                    </p>
                    <p className="text-lg font-semibold mb-1">
                      {result.typography.bodyFont}
                    </p>
                    <p
                      className="text-sm"
                      style={{ fontFamily: result.typography.bodyFont }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Fallback Stack
                  </p>
                  <p className="text-sm font-mono">{result.typography.fallbackStack}</p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Usage Notes
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {result.typography.usageNotes}
                  </p>
                </div>
              </div>
            </ResultCard>

            {/* Brand Voice */}
            <ResultCard
              title="Brand Voice Guide"
              isDark={isDark}
              copyText={`${result.brandVoice.description}\n\nDO:\n${result.brandVoice.do.map(item => `  • ${item}`).join("\n")}\n\nDON'T:\n${result.brandVoice.dont.map(item => `  • ${item}`).join("\n")}`}
            >
              <div className="space-y-4">
                <div>
                  <p className="whitespace-pre-wrap">{result.brandVoice.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Do
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {result.brandVoice.do.map((item, idx) => (
                        <li key={idx} className="text-green-700 dark:text-green-400">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Don&apos;t
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {result.brandVoice.dont.map((item, idx) => (
                        <li key={idx} className="text-red-700 dark:text-red-400">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </ResultCard>

            {/* Taglines */}
            <ResultCard
              title="Taglines (5 options)"
              isDark={isDark}
              copyText={result.messaging.taglines.map((t, i) => `${i + 1}. ${t}`).join("\n")}
            >
              <div className="space-y-2">
                {result.messaging.taglines.map((tagline, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-slate-300 dark:border-slate-600"
                  >
                    <p className="font-medium">{tagline}</p>
                  </div>
                ))}
              </div>
            </ResultCard>

            {/* Value Props */}
            <ResultCard
              title="Value Propositions (5)"
              isDark={isDark}
              copyText={result.messaging.valueProps.map((p, i) => `${i + 1}. ${p}`).join("\n")}
            >
              <ul className="list-disc list-inside space-y-2">
                {result.messaging.valueProps.map((prop, idx) => (
                  <li key={idx} className="text-sm">
                    {prop}
                  </li>
                ))}
              </ul>
            </ResultCard>

            {/* Elevator Pitch */}
            <ResultCard
              title="Elevator Pitch"
              isDark={isDark}
              copyText={result.messaging.elevatorPitch}
            >
              <p className="whitespace-pre-wrap">{result.messaging.elevatorPitch}</p>
            </ResultCard>

            {/* Website Hero */}
            <ResultCard
              title="Website Hero Copy"
              isDark={isDark}
              copyText={`${result.readyToUseCopy.websiteHero.headline}\n\n${result.readyToUseCopy.websiteHero.subheadline}`}
            >
              <div className="space-y-3">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Headline
                  </p>
                  <p className="text-lg font-semibold">
                    {result.readyToUseCopy.websiteHero.headline}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Subheadline
                  </p>
                  <p>{result.readyToUseCopy.websiteHero.subheadline}</p>
                </div>
              </div>
            </ResultCard>

            {/* About Us */}
            <ResultCard
              title="About Us (150-220 words)"
              isDark={isDark}
              copyText={result.readyToUseCopy.aboutUs}
            >
              <p className="whitespace-pre-wrap">{result.readyToUseCopy.aboutUs}</p>
            </ResultCard>

            {/* Social Bios */}
            <ResultCard
              title="Social Bio Pack"
              isDark={isDark}
              copyText={`Instagram:\n${result.readyToUseCopy.socialBios.instagram}\n\nFacebook:\n${result.readyToUseCopy.socialBios.facebook}\n\nX:\n${result.readyToUseCopy.socialBios.x}`}
            >
              <div className="space-y-4">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Instagram
                  </p>
                  <p className="whitespace-pre-wrap">
                    {result.readyToUseCopy.socialBios.instagram}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Facebook
                  </p>
                  <p className="whitespace-pre-wrap">
                    {result.readyToUseCopy.socialBios.facebook}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    X (Twitter)
                  </p>
                  <p className="whitespace-pre-wrap">
                    {result.readyToUseCopy.socialBios.x}
                  </p>
                </div>
              </div>
            </ResultCard>

            {/* Email Signature */}
            <ResultCard
              title="Email Signature"
              isDark={isDark}
              copyText={result.readyToUseCopy.emailSignature}
            >
              <p className="whitespace-pre-wrap">{result.readyToUseCopy.emailSignature}</p>
            </ResultCard>

            {/* Extras */}
            {result.extras && (
              <>
                {result.extras.socialPostTemplates && (
                  <ResultCard
                    title="Social Post Templates (3)"
                    isDark={isDark}
                    copyText={result.extras.socialPostTemplates.join("\n\n")}
                  >
                    <div className="space-y-3">
                      {result.extras.socialPostTemplates.map((template, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <p className="whitespace-pre-wrap">{template}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                )}

                {result.extras.faqStarter && (
                  <ResultCard
                    title="FAQ Starter Pack (5 Q&A)"
                    isDark={isDark}
                    copyText={result.extras.faqStarter.map((faq, i) => `Q${i + 1}: ${faq.question}\nA${i + 1}: ${faq.answer}`).join("\n\n")}
                  >
                    <div className="space-y-4">
                      {result.extras.faqStarter.map((faq, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <p className="font-semibold mb-2">Q: {faq.question}</p>
                          <p className="text-sm">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                )}

                {result.extras.gbpDescription && (
                  <ResultCard
                    title="Google Business Profile Description"
                    isDark={isDark}
                    copyText={result.extras.gbpDescription}
                  >
                    <p className="whitespace-pre-wrap">
                      {result.extras.gbpDescription}
                    </p>
                    <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                      Length: {result.extras.gbpDescription.length} characters
                    </p>
                  </ResultCard>
                )}

                {result.extras.metaDescription && (
                  <ResultCard
                    title="Meta Description"
                    isDark={isDark}
                    copyText={result.extras.metaDescription}
                  >
                    <p>{result.extras.metaDescription}</p>
                    <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                      Length: {result.extras.metaDescription.length} characters
                    </p>
                  </ResultCard>
                )}
              </>
            )}
          </div>
        </OBDPanel>
        );
      })()}

      {!result && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">🎨</div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Ready to build your brand kit?
            </h3>
            <p className={themeClasses.mutedText}>
              Fill out the form above and click Generate Brand Kit to create your
              comprehensive brand guidelines.
            </p>
          </div>
        </OBDPanel>
      )}

      {/* Sticky Bottom Action Bar */}
      {result && !loading && (
        <div
          className={`sticky bottom-0 left-0 right-0 z-10 mt-12 border-t ${
            isDark
              ? "bg-slate-950 border-slate-800"
              : "bg-white border-slate-200"
          } shadow-lg`}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => handleRegenerate()}
                disabled={loading}
                className={`px-6 py-2.5 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Generate Again
              </button>
              <button
                onClick={handleStartNew}
                className={`px-6 py-2.5 font-medium rounded-xl transition-colors ${
                  isDark
                    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                }`}
              >
                Start New Brand Kit
              </button>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}
