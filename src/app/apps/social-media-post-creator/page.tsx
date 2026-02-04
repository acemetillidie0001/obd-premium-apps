"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getSubtleButtonMediumClasses } from "@/lib/obd-framework/layout-helpers";
import BrandProfilePanel from "@/components/bdw/BrandProfilePanel";
import { type BrandProfile } from "@/lib/utils/bdw-brand-profile";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import SMPCFixPacks from "@/components/smpc/SMPCFixPacks";
import SMPCQualityControlsTab from "@/components/smpc/SMPCQualityControlsTab";
import SMPCExportCenterPanel from "@/components/smpc/SMPCExportCenterPanel";
import SMPCCopyBundles from "@/components/smpc/SMPCCopyBundles";
import WorkflowGuidance from "@/components/bdw/WorkflowGuidance";
import AnalyticsDetails from "@/components/bdw/AnalyticsDetails";
import { recordGeneration, recordFixPackApplied } from "@/lib/bdw/local-analytics";
import { getActivePosts } from "@/lib/apps/social-media-post-creator/getActivePosts";
import type { SMPCPostItem, SMPCPostSnapshot } from "@/lib/apps/social-media-post-creator/types";
import { buildSmpcHandoffPayload, SMPC_HANDOFF_KEY } from "@/lib/apps/social-media-post-creator/handoff";
import { normalizePlatform } from "@/lib/apps/social-media-post-creator/platforms";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  facebook: { label: "Facebook", icon: "📘" },
  instagram: { label: "Instagram", icon: "📸" },
  "instagram (carousel)": { label: "Instagram (Carousel)", icon: "📸" },
  "google business profile": { label: "Google Business Profile", icon: "📍" },
  x: { label: "X", icon: "✖️" },
};

function getCharacterMeta(count: number, platform: string) {
  const normalized = platform.trim().toLowerCase();
  const isX = normalized === "x";

  if (isX) {
    if (count > 280) return { label: `${count} chars (over X limit)`, tone: "error" };
    if (count > 260) return { label: `${count} chars (near X limit)`, tone: "warning" };
    return { label: `${count} chars`, tone: "default" };
  }

  // generic guidance for other platforms
  if (count < 60) return { label: `${count} chars (short)`, tone: "muted" };
  if (count > 300) return { label: `${count} chars (long)`, tone: "warning" };
  return { label: `${count} chars`, tone: "default" };
}

function formatRelativeTime(ts: number, now: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const diffMs = Math.max(0, now - ts);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

type SocialTemplate = {
  businessName?: string;
  businessType?: string;
  city?: string;
  state?: string;
  topic?: string;
  details?: string;
  brandVoice?: string;
  personalityStyle?: string;
  postLength?: "Short" | "Medium" | "Long";
  campaignType?:
    | "Everyday Post"
    | "Event"
    | "Limited-Time Offer"
    | "New Service Announcement";
  outputMode?: "Standard" | "InstagramCarousel" | "ContentCalendar";
  numberOfPosts?: number;
  hashtagStyle?: "None" | "Minimal" | "Normal";
  emojiStyle?: "None" | "Minimal" | "Normal";
  tone?: string;
  platform?: "all" | "facebook" | "instagram" | "googleBusinessProfile" | "x";
  carouselSlides?: number;
};

const TEMPLATE_STORAGE_KEY = "obdSocialPostTemplate_v1";

function parseAiResponse(aiResponse: string): SMPCPostItem[] {
  // Split by lines
  const lines = aiResponse.split(/\r?\n/);
  const posts: SMPCPostItem[] = [];

  type ParsedDraft = {
    postNumber: number;
    platform: string;
    hook: string;
    bodyLines: string[];
    cta: string;
    raw: string; // full text for this block
    characterCount: number;
  };

  let current: ParsedDraft | null = null;

  function finalizeDraft(draft: ParsedDraft): SMPCPostItem {
    const text = [
      draft.hook,
      ...draft.bodyLines,
      draft.cta,
    ]
      .join(" ")
      .trim();

    draft.characterCount = text.length;

    const normalized = normalizePlatform(draft.platform);
    const idPlatform =
      normalized.key === "other"
        ? (normalized.label || draft.platform).trim().toLowerCase().replace(/\s+/g, "_")
        : normalized.key;
    const id = `smpc:${draft.postNumber}:${idPlatform}`;
    const now = Date.now();

    const generated: SMPCPostSnapshot = {
      hook: draft.hook,
      bodyLines: draft.bodyLines,
      cta: draft.cta,
      raw: draft.raw,
      characterCount: draft.characterCount,
    };

    return {
      id,
      platformKey: normalized.key,
      platformLabel: normalized.label || draft.platform,
      platform: normalized.label || draft.platform,
      postNumber: draft.postNumber,
      hook: draft.hook,
      bodyLines: draft.bodyLines,
      cta: draft.cta,
      raw: draft.raw,
      characterCount: draft.characterCount,
      generated,
      createdAt: now,
      updatedAt: now,
    };
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Detect header lines: "Post 1 — Facebook"
    const headerMatch = /^Post\s+(\d+)\s+—\s+(.+)$/.exec(trimmed);
    if (headerMatch) {
      // flush existing
      if (current) {
        posts.push(finalizeDraft(current));
      }

      const postNumber = Number(headerMatch[1]);
      const platform = headerMatch[2].trim();

      current = {
        postNumber,
        platform,
        hook: "",
        bodyLines: [],
        cta: "",
        raw: trimmed,
        characterCount: 0,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    // Hook line: "Hook: ..."
    if (trimmed.startsWith("Hook:")) {
      const hook = trimmed.replace(/^Hook:\s*/i, "").trim();
      current.hook = hook;
      current.raw += "\n" + trimmed;
      continue;
    }

    // CTA line: "CTA: ..."
    if (trimmed.startsWith("CTA:")) {
      const cta = trimmed.replace(/^CTA:\s*/i, "").trim();
      current.cta = cta;
      current.raw += "\n" + trimmed;
      continue;
    }

    // Body label line: "Body:" (ignore this line, it's just a label)
    if (trimmed.match(/^Body:\s*$/i)) {
      current.raw += "\n" + trimmed;
      continue;
    }

    // Body line (including "- ..." bullet lines)
    current.bodyLines.push(trimmed);
    current.raw += "\n" + trimmed;
  }

  if (current) {
    posts.push(finalizeDraft(current));
  }

  return posts;
}

function AccordionSection({
  isOpen,
  onToggle,
  title,
  summary,
  isDark,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  summary: React.ReactNode;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border ${
        isDark ? "border-slate-700 bg-slate-800/20" : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-4 py-3 md:px-6 md:py-4 flex items-start justify-between gap-3 ${
          isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
        } rounded-2xl transition-colors`}
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              {title}
            </span>
          </div>
          <div className="mt-1">{summary}</div>
        </div>
        <span
          className={`mt-0.5 text-xs font-semibold ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
          aria-hidden="true"
        >
          {isOpen ? "▲" : "▼"}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4 md:px-6 md:pb-6">{children}</div>}
    </div>
  );
}

export default function SocialMediaPostCreatorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const businessId = useMemo(() => resolveBusinessId(searchParams), [searchParams]);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [platform, setPlatform] = useState<"all" | "facebook" | "instagram" | "googleBusinessProfile" | "x">("facebook");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"casual" | "professional" | "engaging">("engaging");
  const [details, setDetails] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [personalityStyle, setPersonalityStyle] = useState<"Soft" | "Bold" | "High-Energy" | "Luxury" | "">("");
  const [postLength, setPostLength] = useState<"Short" | "Medium" | "Long">("Medium");
  const [campaignType, setCampaignType] = useState<"Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement">("Everyday Post");
  const [outputMode, setOutputMode] = useState<"Standard" | "InstagramCarousel" | "ContentCalendar">("Standard");
  const [carouselSlides, setCarouselSlides] = useState<number>(5);
  const [numberOfPosts, setNumberOfPosts] = useState<number>(3);
  const [hashtagStyle, setHashtagStyle] = useState<"None" | "Minimal" | "Normal">("Normal");
  const [emojiStyle, setEmojiStyle] = useState<"None" | "Minimal" | "Normal">("Normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [lastPayload, setLastPayload] = useState<{
    businessName?: string;
    businessType?: string;
    city?: string;
    state?: string;
    platform?: string;
    topic: string;
    tone?: string;
    details?: string;
    brandVoice?: string | null;
    personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury" | "" | null;
    postLength?: "Short" | "Medium" | "Long";
    campaignType?: "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement";
    outputMode?: "Standard" | "InstagramCarousel" | "ContentCalendar";
    carouselSlides?: number;
    numberOfPosts?: number;
    hashtagStyle?: "None" | "Minimal" | "Normal";
    platforms?: {
      facebook?: boolean;
      instagram?: boolean;
      googleBusinessProfile?: boolean;
      x?: boolean;
    };
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const [regeneratePreservedNotice, setRegeneratePreservedNotice] = useState<
    | null
    | {
        id: number;
        message: string;
      }
  >(null);

  const [openPostMetaId, setOpenPostMetaId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const editOriginByPostIdRef = useRef<Record<string, "manual" | "fix-pack">>({});

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  
  // Brand Profile auto-import toggle
  const [useBrandProfileToggle, setUseBrandProfileToggle] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return hasBrandProfile();
    } catch {
      return false;
    }
  });

  // Brand Profile auto-apply toggle
  const [useBrandProfile, setUseBrandProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return hasBrandProfile();
    } catch {
      return false;
    }
  });
  
  // Form object wrapper for brand-related fields
  type FormData = {
    businessName: string;
    businessType: string;
    city: string;
    state: string;
    brandVoice: string;
    personalityStyle: "Soft" | "Bold" | "High-Energy" | "Luxury" | "";
    hashtagStyle: "None" | "Minimal" | "Normal";
    emojiStyle: "None" | "Minimal" | "Normal";
  };

  const form: FormData = {
    businessName,
    businessType,
    city,
    state,
    brandVoice,
    personalityStyle,
    hashtagStyle,
    emojiStyle,
  };

  const setForm = (updater: Partial<FormData> | ((prev: FormData) => Partial<FormData>)) => {
    if (typeof updater === "function") {
      const updates = updater(form);
      if (updates.businessName !== undefined) setBusinessName(updates.businessName);
      if (updates.businessType !== undefined) setBusinessType(updates.businessType);
      if (updates.city !== undefined) setCity(updates.city);
      if (updates.state !== undefined) setState(updates.state);
      if (updates.brandVoice !== undefined) setBrandVoice(updates.brandVoice);
      if (updates.personalityStyle !== undefined) setPersonalityStyle(updates.personalityStyle);
      if (updates.hashtagStyle !== undefined) setHashtagStyle(updates.hashtagStyle);
      if (updates.emojiStyle !== undefined) setEmojiStyle(updates.emojiStyle);
    } else {
      if (updater.businessName !== undefined) setBusinessName(updater.businessName);
      if (updater.businessType !== undefined) setBusinessType(updater.businessType);
      if (updater.city !== undefined) setCity(updater.city);
      if (updater.state !== undefined) setState(updater.state);
      if (updater.brandVoice !== undefined) setBrandVoice(updater.brandVoice);
      if (updater.personalityStyle !== undefined) setPersonalityStyle(updater.personalityStyle);
      if (updater.hashtagStyle !== undefined) setHashtagStyle(updater.hashtagStyle);
      if (updater.emojiStyle !== undefined) setEmojiStyle(updater.emojiStyle);
    }
  };
  
  // BDW Tools: Edited posts state for Fix Packs
  const [editedPosts, setEditedPosts] = useState<SMPCPostItem[] | null>(null);
  const [editHistory, setEditHistory] = useState<Array<{ kind: "generated" | "edited"; posts: SMPCPostItem[] }>>([]);
  const [inlineEdit, setInlineEdit] = useState<
    | null
    | {
        postId: string;
        hook: string;
        body: string; // newline-separated body lines (slides/bullets supported)
        cta: string;
      }
  >(null);

  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffSelectedIds, setHandoffSelectedIds] = useState<Set<string>>(() => new Set());

  const parsedPosts = useMemo(
    () => (aiResponse ? parseAiResponse(aiResponse) : []),
    [aiResponse]
  );

  const [shuffledPosts, setShuffledPosts] = useState<SMPCPostItem[] | null>(null);

  const { activePosts, status: postsStatus } = useMemo(
    () => getActivePosts({ parsedPosts, editedPosts }),
    [parsedPosts, editedPosts]
  );

  const parsedById = useMemo(() => {
    return new Map(parsedPosts.map((p) => [p.id, p] as const));
  }, [parsedPosts]);

  const viewPosts = useMemo(() => {
    if (outputMode === "ContentCalendar" && shuffledPosts?.length) return shuffledPosts;
    return activePosts;
  }, [outputMode, shuffledPosts, activePosts]);

  useEffect(() => {
    // Shuffle is a view-only override; clear it when source content changes.
    setShuffledPosts(null);
  }, [aiResponse, editedPosts]);

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Auto-apply brand profile to form
  const { applied, brandFound } = useAutoApplyBrandProfile({
    enabled: useBrandProfile,
    form: form as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        const updated = formOrUpdater(form as unknown as Record<string, unknown>);
        setForm(updated as Partial<FormData>);
      } else {
        setForm(formOrUpdater as Partial<FormData>);
      }
    },
    storageKey: "social-post-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "brandVoice") return "brandVoice";
      if (formKey === "hashtagStyle") return "hashtagStyle";
      if (formKey === "personalityStyle") {
        // Map brandPersonality to personalityStyle if it exists in brand
        if (brand.brandPersonality) {
          return "brandPersonality";
        }
      }
      return undefined;
    },
  });

  // Handle personalityStyle mapping from brandPersonality (convert brandPersonality value to personalityStyle)
  useEffect(() => {
    if (personalityStyle) return; // Don't overwrite if already set
    
    import("@/lib/brand/brandProfileStorage").then(({ loadBrandProfile }) => {
      const profile = loadBrandProfile();
      if (profile?.brandPersonality) {
        const personalityMap: Record<string, "Soft" | "Bold" | "High-Energy" | "Luxury"> = {
          "Soft": "Soft",
          "Bold": "Bold",
          "High-Energy": "High-Energy",
          "Luxury": "Luxury",
        };
        const mapped = personalityMap[profile.brandPersonality];
        if (mapped) {
          setPersonalityStyle(mapped);
        }
      }
    });
  }, [personalityStyle, useBrandProfile]);

  // Update toggle default when brand profile is found
  useEffect(() => {
    if (brandFound && !useBrandProfileToggle && typeof window !== "undefined") {
      setUseBrandProfileToggle(true);
    }
  }, [brandFound]);

  // Show one-time toast when brand profile is applied
  const didToastRef = useRef(false);
  useEffect(() => {
    if (applied && !didToastRef.current) {
      didToastRef.current = true;
      showToast("Brand Profile applied to empty fields.");
    }
  }, [applied]);

  // Handle personalityStyle mapping from brandPersonality (special case)
  useEffect(() => {
    if (personalityStyle) return; // Don't overwrite if already set
    
    import("@/lib/brand/brandProfileStorage").then(({ loadBrandProfile }) => {
      const profile = loadBrandProfile();
      if (profile?.brandPersonality) {
        const personalityMap: Record<string, "Soft" | "Bold" | "High-Energy" | "Luxury"> = {
          "Soft": "Soft",
          "Bold": "Bold",
          "High-Energy": "High-Energy",
          "Luxury": "Luxury",
        };
        const mapped = personalityMap[profile.brandPersonality];
        if (mapped) {
          setPersonalityStyle(mapped);
        }
      }
    });
  }, [personalityStyle]);

  const applyTemplate = (parsed: SocialTemplate) => {
    if (parsed.businessName) setBusinessName(parsed.businessName);
    if (parsed.businessType) setBusinessType(parsed.businessType);
    if (parsed.topic) setTopic(parsed.topic);
    if (parsed.details) setDetails(parsed.details);
    if (parsed.brandVoice) setBrandVoice(parsed.brandVoice);
    if (parsed.personalityStyle) {
      const personality = parsed.personalityStyle as "Soft" | "Bold" | "High-Energy" | "Luxury" | "";
      if (personality) {
        setPersonalityStyle(personality);
      }
    }
    if (parsed.postLength) setPostLength(parsed.postLength);
    if (parsed.campaignType) setCampaignType(parsed.campaignType);
    if (parsed.outputMode) setOutputMode(parsed.outputMode);
    if (typeof parsed.numberOfPosts === "number") setNumberOfPosts(parsed.numberOfPosts);
    if (parsed.hashtagStyle) setHashtagStyle(parsed.hashtagStyle);
    if (parsed.emojiStyle) setEmojiStyle(parsed.emojiStyle);
    if (parsed.tone && ["casual", "professional", "engaging"].includes(parsed.tone)) {
      setTone(parsed.tone as "casual" | "professional" | "engaging");
    }
    if (parsed.platform) setPlatform(parsed.platform);
    if (typeof parsed.carouselSlides === "number") setCarouselSlides(parsed.carouselSlides);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as SocialTemplate;
      applyTemplate(parsed);
    } catch {
      // ignore
    }
  }, []);

  const handleSaveTemplate = () => {
    if (typeof window === "undefined") return;
    const template: SocialTemplate = {
      businessName,
      businessType,
      city: city || "Ocala",
      state: state || "Florida",
      topic,
      details,
      brandVoice,
      personalityStyle,
      postLength,
      campaignType,
      outputMode,
      numberOfPosts,
      hashtagStyle,
      emojiStyle,
      tone,
      platform,
      carouselSlides,
    };
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    alert("Template saved!");
  };

  const handleLoadTemplate = () => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) {
      alert("No template found.");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SocialTemplate;
      applyTemplate(parsed);
      alert("Template loaded!");
    } catch {
      alert("Error loading template.");
    }
  };

  const resetInputsToDefaults = () => {
    setBusinessName("");
    setBusinessType("");
    setCity("");
    setState("");
    setPlatform("facebook");
    setTopic("");
    setTone("engaging");
    setDetails("");
    setBrandVoice("");
    setPersonalityStyle("");
    setPostLength("Medium");
    setCampaignType("Everyday Post");
    setOutputMode("Standard");
    setCarouselSlides(5);
    setNumberOfPosts(3);
    setHashtagStyle("Normal");
    setEmojiStyle("Normal");

    // Reset Brand Profile toggles back to their "detected" defaults
    const defaultHasBrand = (() => {
      try {
        return hasBrandProfile();
      } catch {
        return false;
      }
    })();
    setUseBrandProfileToggle(defaultHasBrand);
    setUseBrandProfile(defaultHasBrand);

    // Keep results/regenerate/export behavior as-is; this is input-only reset.
    // (aiResponse/lastPayload/editedPosts remain unchanged)

    // Reset accordion layout to defaults
    setAccordionState({
      businessBasics: true,
      platformAndCampaign: true,
      brandAndVoice: true,
      outputSettings: false,
    });
  };

  const handleShufflePosts = () => {
    if (!activePosts.length) return;
    if (lastPayload?.outputMode !== "ContentCalendar") return;

    const copy = [...activePosts];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setShuffledPosts(copy);
  };

  const processRequest = async (
    payload: typeof lastPayload,
    opts?: { preserveEdits?: boolean }
  ) => {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/social-media-post-creator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: { response: string } }
      const responseData = jsonResponse.data || jsonResponse;
      setAiResponse(responseData.response || "Error generating post");

      if (!opts?.preserveEdits) {
        setEditedPosts(null); // Reset edited posts when generating new content
        setEditHistory([]); // Clear edit history on new generation
      }
      
      // Record generation in local analytics
      recordGeneration("smpc-analytics");
      return true;
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      setAiResponse("");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topic.trim()) {
      setError("Please enter a topic or message to generate your social media posts.");
      return;
    }

    const isAll = platform === "all";

    const platforms = {
      facebook: isAll || platform === "facebook",
      instagram: isAll || platform === "instagram",
      googleBusinessProfile: isAll || platform === "googleBusinessProfile",
      x: isAll || platform === "x",
    };

    const safeCarouselSlides =
      outputMode === "InstagramCarousel"
        ? Math.min(10, Math.max(3, Number(carouselSlides || 5)))
        : undefined;

    const payload = {
      businessName: businessName || undefined,
      businessType: businessType || undefined,
      city: city || "Ocala",
      state: state || "Florida",
      platform,
      topic,
      tone,
      details: details || undefined,
      brandVoice: brandVoice || undefined,
      personalityStyle: personalityStyle || undefined,
      postLength,
      campaignType,
      outputMode,
      carouselSlides: safeCarouselSlides,
      numberOfPosts: Math.min(Math.max(1, numberOfPosts), 10),
      hashtagStyle,
      emojiStyle,
      platforms,
    };

    setLastPayload(payload);
    setRegeneratePreservedNotice(null);
    await processRequest(payload);
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    // Tier 5B safety: Regenerate must NEVER overwrite edited content.
    const hadEdits =
      !!editedPosts?.length || activePosts.some((p) => !!p.edited);

    const ok = await processRequest(lastPayload, { preserveEdits: true });

    if (ok && hadEdits) {
      setRegeneratePreservedNotice({
        id: Date.now(),
        message:
          "Edited posts were preserved. New suggestions were added for unedited posts.",
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadRawTxt = () => {
    if (!aiResponse) return;

    const blob = new Blob([aiResponse], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "social-posts-raw.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Brand Profile: Apply profile to form (UI-only for tone hints)
  const handleApplyBrandProfile = (profile: BrandProfile, fillEmptyOnly: boolean) => {
    if (profile.brandVoice) {
      if (!fillEmptyOnly || !brandVoice.trim()) {
        setBrandVoice(profile.brandVoice);
      }
    }
    // Note: Brand profile influences tone hints but doesn't directly set tone field
    // The tone field remains user-controlled
  };

  // Get tone hint from brand profile (UI-only display)
  const getToneHint = (): string | null => {
    if (!brandVoice.trim()) return null;
    // Simple heuristic: analyze brand voice text for tone hints
    const lower = brandVoice.toLowerCase();
    if (lower.includes("casual") || lower.includes("friendly") || lower.includes("relaxed")) {
      return "Consider 'casual' tone";
    }
    if (lower.includes("professional") || lower.includes("formal") || lower.includes("business")) {
      return "Consider 'professional' tone";
    }
    if (lower.includes("engaging") || lower.includes("energetic") || lower.includes("vibrant")) {
      return "Consider 'engaging' tone";
    }
    return null;
  };

  const normalizeBodyLines = (body: string): string[] => {
    return body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  };

  const buildSnapshot = (args: {
    postNumber: number;
    platform: string;
    hook: string;
    bodyLines: string[];
    cta: string;
  }): SMPCPostSnapshot => {
    const rawLines = [
      `Post ${args.postNumber} — ${args.platform}`,
      `Hook: ${args.hook}`,
      "Body:",
      ...args.bodyLines,
      `CTA: ${args.cta}`,
    ];

    const characterCount = [args.hook, ...args.bodyLines, args.cta]
      .join(" ")
      .trim().length;

    return {
      hook: args.hook,
      bodyLines: args.bodyLines,
      cta: args.cta,
      raw: rawLines.join("\n").trim(),
      characterCount,
    };
  };

  const pushPostsHistory = () => {
    const historyKind: "generated" | "edited" = postsStatus === "edited" ? "edited" : "generated";
    setEditHistory((prev) => [...prev, { kind: historyKind, posts: activePosts }]);
  };

  const stripEditsOrNull = (posts: SMPCPostItem[]): SMPCPostItem[] | null => {
    return posts.some((p) => !!p.edited) ? posts : null;
  };

  const startInlineEdit = (post: SMPCPostItem) => {
    setInlineEdit({
      postId: post.id,
      hook: post.hook,
      body: post.bodyLines.join("\n"),
      cta: post.cta,
    });
  };

  const cancelInlineEdit = () => setInlineEdit(null);

  const saveInlineEdit = () => {
    if (!inlineEdit) return;

    const base =
      parsedById.get(inlineEdit.postId) ??
      activePosts.find((p) => p.id === inlineEdit.postId) ??
      null;

    if (!base) {
      setInlineEdit(null);
      return;
    }

    const bodyLines = normalizeBodyLines(inlineEdit.body);
    const snapshot = buildSnapshot({
      postNumber: base.postNumber,
      platform: base.platform,
      hook: inlineEdit.hook.trim(),
      bodyLines,
      cta: inlineEdit.cta.trim(),
    });

    const now = Date.now();
    const nextItem: SMPCPostItem = {
      ...base,
      hook: snapshot.hook,
      bodyLines: snapshot.bodyLines,
      cta: snapshot.cta,
      raw: snapshot.raw,
      characterCount: snapshot.characterCount,
      generated: base.generated,
      edited: snapshot,
      updatedAt: now,
    };

    editOriginByPostIdRef.current[nextItem.id] = "manual";
    pushPostsHistory();

    const source = editedPosts?.length ? editedPosts : parsedPosts;
    const next = source.map((p) => (p.id === nextItem.id ? nextItem : p));
    setEditedPosts(stripEditsOrNull(next) ?? [nextItem]);
    setInlineEdit(null);
  };

  const resetPostToGenerated = (postId: string) => {
    if (!editedPosts?.length) return;

    const base = parsedById.get(postId);
    if (!base) return;

    pushPostsHistory();

    const now = Date.now();
    const next = editedPosts.map((p) => {
      if (p.id !== postId) return p;
      return {
        ...base,
        hook: base.generated.hook,
        bodyLines: base.generated.bodyLines,
        cta: base.generated.cta,
        raw: base.generated.raw,
        characterCount: base.generated.characterCount,
        generated: base.generated,
        edited: undefined,
        updatedAt: now,
      };
    });

    delete editOriginByPostIdRef.current[postId];
    setEditedPosts(stripEditsOrNull(next));
    if (inlineEdit?.postId === postId) setInlineEdit(null);
  };

  const resetAllEdits = () => {
    if (!editedPosts?.length) return;
    pushPostsHistory();
    setEditedPosts(null);
    setInlineEdit(null);
    editOriginByPostIdRef.current = {};
  };

  const openHandoffModal = () => {
    if (!displayPosts.length) {
      showToast("Generate posts to send.");
      return;
    }
    if (!businessId) {
      showToast("Business context required to send.");
      return;
    }
    setHandoffSelectedIds(new Set(displayPosts.map((p) => p.id)));
    setHandoffModalOpen(true);
  };

  const closeHandoffModal = () => {
    setHandoffModalOpen(false);
  };

  const confirmSendToSocialAutoPoster = () => {
    if (!businessId) return;

    const selected = displayPosts.filter((p) => handoffSelectedIds.has(p.id));
    if (!selected.length) return;

    try {
      const payload = buildSmpcHandoffPayload({ businessId, posts: selected });
      sessionStorage.setItem(SMPC_HANDOFF_KEY, JSON.stringify(payload));
      // Hint param only; receiver validates TTL + tenant before showing Apply/Dismiss.
      router.push(`/apps/social-auto-poster?handoff=smpc&businessId=${encodeURIComponent(businessId)}`);
    } catch (error) {
      console.warn("Failed to send handoff:", error);
      showToast("Could not send. Please try again.");
      return;
    } finally {
      setHandoffModalOpen(false);
    }
  };

  // Fix Packs: Handle applying fixes
  const handleApplyFix = (updatedPosts: SMPCPostItem[], fixPackId?: string) => {
    if (!parsedPosts.length) return;
    
    const now = Date.now();
    if (fixPackId) {
      for (const p of updatedPosts) {
        editOriginByPostIdRef.current[p.id] = "fix-pack";
      }
    }

    const toEdited = (posts: SMPCPostItem[]): SMPCPostItem[] => {
      return posts.map((p) => {
        const base = parsedById.get(p.id) ?? p;

        const editedSnapshot = buildSnapshot({
          postNumber: base.postNumber,
          platform: base.platform,
          hook: p.hook,
          bodyLines: p.bodyLines,
          cta: p.cta,
        });

        const generatedSnapshot: SMPCPostSnapshot =
          base.generated ?? {
            hook: base.hook,
            bodyLines: base.bodyLines,
            cta: base.cta,
            raw: base.raw,
            characterCount: base.characterCount,
          };

        return {
          ...base,
          ...p,
          hook: editedSnapshot.hook,
          bodyLines: editedSnapshot.bodyLines,
          cta: editedSnapshot.cta,
          raw: editedSnapshot.raw,
          characterCount: editedSnapshot.characterCount,
          generated: generatedSnapshot,
          edited: editedSnapshot,
          updatedAt: now,
        };
      });
    };

    // Push current state to history before applying
    pushPostsHistory();
    
    // Set edited posts
    setEditedPosts(toEdited(updatedPosts));
    
    // Record fix pack application in local analytics
    if (fixPackId) {
      recordFixPackApplied("smpc-analytics", fixPackId);
    }
  };

  // Fix Packs: Reset edited posts to original
  const handleResetEdits = () => {
    resetAllEdits();
    setOpenPostMetaId(null);
  };

  // Fix Packs: Undo last edit
  const handleUndoLastEdit = () => {
    if (editHistory.length === 0) return;
    
    const previous = editHistory[editHistory.length - 1];
    setEditHistory((prev) => prev.slice(0, -1));
    setEditedPosts(previous.kind === "generated" ? null : previous.posts);
    setInlineEdit(null);
    editOriginByPostIdRef.current = {};
    setOpenPostMetaId(null);
  };

  // Determine which posts to display (edited vs parsed) + optional shuffle view
  const displayPosts = viewPosts;

  useEffect(() => {
    // Auto-clear the "edited posts preserved" notice when outputs are cleared/reset.
    if (!aiResponse || displayPosts.length === 0) {
      setRegeneratePreservedNotice(null);
      setOpenPostMetaId(null);
    }
  }, [aiResponse, displayPosts.length]);

  // Tier 5A: Accordion state (input sections)
  const [accordionState, setAccordionState] = useState({
    businessBasics: true,
    platformAndCampaign: true,
    brandAndVoice: true,
    outputSettings: false,
  });

  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const collapseAllAccordions = () => {
    setAccordionState({
      businessBasics: true, // keep primary visible
      platformAndCampaign: false,
      brandAndVoice: false,
      outputSettings: false,
    });
  };

  const expandAllAccordions = () => {
    setAccordionState({
      businessBasics: true,
      platformAndCampaign: true,
      brandAndVoice: true,
      outputSettings: true,
    });
  };

  const businessBasicsSummary = useMemo(() => {
    const bn = businessName.trim();
    const locCity = city.trim();
    const locState = state.trim();

    if (!bn && !locCity && !locState) return "Not set";

    const location = [locCity, locState].filter(Boolean).join(", ");
    return `${bn || "—"} • ${location || "—"}`;
  }, [businessName, city, state]);

  const platformAndCampaignSummary = useMemo(() => {
    const hasTopic = !!topic.trim();
    if (!hasTopic) return "Not set";

    const platformLabel =
      platform === "all"
        ? "FB + IG + GBP + X"
        : platform === "facebook"
          ? "FB"
          : platform === "instagram"
            ? "IG"
            : platform === "googleBusinessProfile"
              ? "GBP"
              : "X";

    const campaignLabel = campaignType ? campaignType : "";
    return campaignLabel ? `${platformLabel} • ${campaignLabel}` : platformLabel;
  }, [platform, topic, campaignType]);

  const brandAndVoiceSummary = useMemo(() => {
    const hasVoice = !!brandVoice.trim();
    const hasStyle = !!personalityStyle;
    if (!hasVoice && !hasStyle) return "Not set";

    const toneLabel =
      tone === "casual" ? "Casual" : tone === "professional" ? "Professional" : "Engaging";

    if (hasVoice) return `${toneLabel} • Brand voice sample`;
    return `${toneLabel} • Style: ${personalityStyle || "—"}`;
  }, [brandVoice, personalityStyle, tone]);

  const outputSettingsSummary = useMemo(() => {
    const outputModeLabel =
      outputMode === "Standard"
        ? "Standard"
        : outputMode === "InstagramCarousel"
          ? "Instagram Carousel"
          : "Content Calendar";

    const platformCount =
      outputMode === "InstagramCarousel" ? 1 : platform === "all" ? 4 : 1;

    const total = Math.max(1, Number(numberOfPosts || 1)) * platformCount;
    return `${outputModeLabel} • ${total} posts`;
  }, [outputMode, numberOfPosts, platform]);

  const canGenerate = topic.trim().length > 0;
  const canSaveTemplate = canGenerate;
  const isAtDefaultInputs = useMemo(() => {
    // Mirror the initial useState defaults in this page.
    if (businessName !== "") return false;
    if (businessType !== "") return false;
    if (city !== "") return false;
    if (state !== "") return false;
    if (platform !== "facebook") return false;
    if (topic !== "") return false;
    if (tone !== "engaging") return false;
    if (details !== "") return false;
    if (brandVoice !== "") return false;
    if (personalityStyle !== "") return false;
    if (postLength !== "Medium") return false;
    if (campaignType !== "Everyday Post") return false;
    if (outputMode !== "Standard") return false;
    if (carouselSlides !== 5) return false;
    if (numberOfPosts !== 3) return false;
    if (hashtagStyle !== "Normal") return false;
    if (emojiStyle !== "Normal") return false;
    return true;
  }, [
    businessName,
    businessType,
    city,
    state,
    platform,
    topic,
    tone,
    details,
    brandVoice,
    personalityStyle,
    postLength,
    campaignType,
    outputMode,
    carouselSlides,
    numberOfPosts,
    hashtagStyle,
    emojiStyle,
  ]);


  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Social Media Post Creator"
      tagline="Generate engaging social media posts for your Ocala business across multiple platforms with just a few details."
    >

      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      {/* Tier 5C: Handoff modal (draft-only) */}
      {handoffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className={`rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-y-auto ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Send to Social Auto-Poster
                  </h3>
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    Draft-only handoff. You’ll review and apply in Social Auto-Poster—no scheduling or posting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeHandoffModal}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  Close
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className={`text-xs ${themeClasses.mutedText}`}>
                  Selected {handoffSelectedIds.size} of {displayPosts.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHandoffSelectedIds(new Set(displayPosts.map((p) => p.id)))}
                    className={getSubtleButtonMediumClasses(isDark)}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoffSelectedIds(new Set())}
                    className={getSubtleButtonMediumClasses(isDark)}
                  >
                    Select none
                  </button>
                </div>
              </div>

              {!businessId && (
                <div className={`rounded-lg border p-3 mb-3 text-sm ${
                  isDark ? "bg-amber-900/10 border-amber-800 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  Business context is required to send (tenant safety).
                </div>
              )}

              <div className="space-y-2 mb-5">
                {displayPosts.map((post) => {
                  const checked = handoffSelectedIds.has(post.id);
                  const previewText = [post.hook, ...post.bodyLines, post.cta].filter(Boolean).join(" ").trim();
                  return (
                    <label
                      key={post.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                        isDark ? "bg-slate-900/30 border-slate-700 hover:bg-slate-900/40" : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(handoffSelectedIds);
                          if (e.target.checked) next.add(post.id);
                          else next.delete(post.id);
                          setHandoffSelectedIds(next);
                        }}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                          Post {post.postNumber} — {post.platform}
                        </div>
                        <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          {previewText.length > 140 ? previewText.slice(0, 140) + "…" : previewText || "—"}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeHandoffModal}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSendToSocialAutoPoster}
                  disabled={!businessId || handoffSelectedIds.size === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                      : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                  }`}
                >
                  Send selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trust microcopy */}
      <div
        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          isDark
            ? "bg-slate-800/40 border-slate-700 text-slate-200"
            : "bg-white border-slate-200 text-slate-700"
        }`}
      >
        <span className="font-medium">Draft-only.</span>{" "}
        Nothing is posted or scheduled automatically.
      </div>

      {/* Workflow Guidance */}
      <WorkflowGuidance
        isDark={isDark}
        currentStep={
          displayPosts.length > 0 ? 3 : // Step 3: Fix & Export (posts generated)
          topic.trim() ? 2 : // Step 2: Generate (topic filled)
          1 // Step 1: Business details (form empty)
        }
        storageKey="smpc-workflow-guidance-dismissed"
      />

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
              <div className={`space-y-4 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
                <p className={`text-xs ${themeClasses.mutedText}`}>
                  Tip: Use Expand/Collapse in the action bar to keep sections tidy.
                </p>

                <AccordionSection
                  isOpen={accordionState.businessBasics}
                  onToggle={() => toggleAccordion("businessBasics")}
                  title="Business Basics"
                  isDark={isDark}
                  summary={
                    <div className={`text-xs ${themeClasses.mutedText} truncate`}>
                      {businessBasicsSummary}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Business Name
                      </label>
                      <input
                        type="text"
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="e.g., Ocala Coffee Shop"
                      />
                    </div>

                    <div>
                      <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Business Type
                      </label>
                      <input
                        type="text"
                        id="businessType"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="e.g., Restaurant, Retail, Service"
                      />
                    </div>

                    <div>
                      <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        City
                      </label>
                      <input
                        type="text"
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="e.g., Ocala"
                      />
                    </div>

                    <div>
                      <label htmlFor="state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        State
                      </label>
                      <input
                        type="text"
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="e.g., Florida"
                      />
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection
                  isOpen={accordionState.platformAndCampaign}
                  onToggle={() => toggleAccordion("platformAndCampaign")}
                  title="Platform & Campaign"
                  isDark={isDark}
                  summary={
                    <div className={`text-xs ${themeClasses.mutedText} truncate`}>
                      {platformAndCampaignSummary}
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Platform
                      </label>
                      <select
                        id="platform"
                        value={platform}
                        onChange={(e) =>
                          setPlatform(
                            e.target.value as
                              | "all"
                              | "facebook"
                              | "instagram"
                              | "googleBusinessProfile"
                              | "x"
                          )
                        }
                        className={getInputClasses(isDark)}
                      >
                        <option value="all">All Social Profiles</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="googleBusinessProfile">Google Business Profile</option>
                        <option value="x">X</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="topic" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Post Topic / Message
                      </label>
                      <textarea
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        rows={4}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="What would you like to post about? (e.g., new product, event, promotion, etc.)"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="details" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Additional Details (Optional)
                      </label>
                      <textarea
                        id="details"
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        rows={3}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="Any extra context about your business, offer, or message..."
                      />
                    </div>

                    <div>
                      <label htmlFor="campaignType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Campaign Type
                      </label>
                      <select
                        id="campaignType"
                        value={campaignType}
                        onChange={(e) =>
                          setCampaignType(
                            e.target.value as
                              | "Everyday Post"
                              | "Event"
                              | "Limited-Time Offer"
                              | "New Service Announcement"
                          )
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
                </AccordionSection>

                <AccordionSection
                  isOpen={accordionState.brandAndVoice}
                  onToggle={() => toggleAccordion("brandAndVoice")}
                  title="Brand & Voice"
                  isDark={isDark}
                  summary={
                    <div className={`text-xs ${themeClasses.mutedText} truncate`}>
                      {brandAndVoiceSummary}
                    </div>
                  }
                >
                  {/* Brand Profile Panel */}
                  <div className="mb-4">
                    <BrandProfilePanel
                      isDark={isDark}
                      businessName={businessName}
                      onApplyToForm={handleApplyBrandProfile}
                    />
                  </div>

                  <div className="space-y-4">
                    {/* Brand Profile Auto-Import Toggle */}
                    <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                      <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
                        <input
                          type="checkbox"
                          checked={useBrandProfileToggle}
                          onChange={(e) => setUseBrandProfileToggle(e.target.checked)}
                          className="rounded"
                          disabled={!brandFound}
                        />
                        <span className="text-sm font-medium">
                          Use Brand Profile (auto-fill empty fields)
                        </span>
                      </label>
                      <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                        {brandFound
                          ? "When enabled, your saved brand profile will automatically fill empty form fields on page load."
                          : "No brand profile found. Create one to enable auto-fill."}
                      </p>
                    </div>

                    {/* Use Brand Profile Toggle */}
                    <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                      <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
                        <input
                          type="checkbox"
                          checked={useBrandProfile}
                          onChange={(e) => setUseBrandProfile(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">
                          Use Brand Profile (auto-fill empty fields)
                        </span>
                      </label>
                      {/* Status Indicator */}
                      <div className="mt-1 ml-6">
                        {brandFound ? (
                          <>
                            <span className={`text-xs ${themeClasses.mutedText}`}>
                              Saved Brand Profile detected.
                            </span>
                            {applied && (
                              <div className={`text-xs ${themeClasses.mutedText} mt-0.5`}>
                                Applied to empty fields.
                              </div>
                            )}
                          </>
                        ) : (
                          <Link
                            href="/apps/brand-profile"
                            className={`text-xs ${themeClasses.mutedText} hover:underline`}
                          >
                            Create a Brand Profile →
                          </Link>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Brand Voice Sample (Optional)
                      </label>
                      <textarea
                        id="brandVoice"
                        value={brandVoice}
                        onChange={(e) => {
                          setBrandVoice(e.target.value);
                        }}
                        rows={3}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="Paste a short example of your brand's writing style. The AI will try to match it."
                      />
                    </div>

                    <div>
                      <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Personality Style
                      </label>
                      <select
                        id="personalityStyle"
                        value={personalityStyle}
                        onChange={(e) => {
                          setPersonalityStyle(e.target.value as "Soft" | "Bold" | "High-Energy" | "Luxury" | "");
                        }}
                        className={getInputClasses(isDark)}
                      >
                        <option value="">None selected</option>
                        <option value="Soft">Soft</option>
                        <option value="Bold">Bold</option>
                        <option value="High-Energy">High-Energy</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Used only if no brand voice sample is provided.</p>
                    </div>

                    <div>
                      <label htmlFor="tone" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Tone
                      </label>
                      <select
                        id="tone"
                        value={tone}
                        onChange={(e) => setTone(e.target.value as "casual" | "professional" | "engaging")}
                        className={getInputClasses(isDark)}
                      >
                        <option value="casual">Casual</option>
                        <option value="professional">Professional</option>
                        <option value="engaging">Engaging</option>
                      </select>
                      {getToneHint() && (
                        <p className={`mt-1 text-xs ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                          💡 {getToneHint()}
                        </p>
                      )}
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection
                  isOpen={accordionState.outputSettings}
                  onToggle={() => toggleAccordion("outputSettings")}
                  title="Output Settings"
                  isDark={isDark}
                  summary={
                    <div className={`text-xs ${themeClasses.mutedText} truncate`}>
                      {outputSettingsSummary}
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="postLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Post Length
                      </label>
                      <select
                        id="postLength"
                        value={postLength}
                        onChange={(e) => setPostLength(e.target.value as "Short" | "Medium" | "Long")}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Short">Short</option>
                        <option value="Medium">Medium</option>
                        <option value="Long">Long</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="outputMode" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Output Mode
                      </label>
                      <select
                        id="outputMode"
                        value={outputMode}
                        onChange={(e) => setOutputMode(e.target.value as "Standard" | "InstagramCarousel" | "ContentCalendar")}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Standard">Standard Posts</option>
                        <option value="InstagramCarousel">Instagram Carousel Pack</option>
                        <option value="ContentCalendar">Content Calendar</option>
                      </select>
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Choose how you want your posts structured.</p>
                      {outputMode === "InstagramCarousel" && (
                        <p className={`mt-1 text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          Instagram Carousel mode focuses on Instagram posts. Other platforms may be ignored.
                        </p>
                      )}
                    </div>

                    {outputMode === "InstagramCarousel" && (
                      <div>
                        <label htmlFor="carouselSlides" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Slides per Carousel (Instagram)
                        </label>
                        <input
                          type="number"
                          id="carouselSlides"
                          value={carouselSlides}
                          onChange={(e) => setCarouselSlides(Math.min(Math.max(3, parseInt(e.target.value) || 5), 10))}
                          min={3}
                          max={10}
                          className={getInputClasses(isDark)}
                        />
                        <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Generate 3–10 slide captions per Instagram carousel.</p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="numberOfPosts" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Number of Posts
                      </label>
                      <input
                        type="number"
                        id="numberOfPosts"
                        value={numberOfPosts}
                        onChange={(e) => setNumberOfPosts(Math.min(Math.max(1, parseInt(e.target.value) || 1), 10))}
                        min={1}
                        max={10}
                        className={getInputClasses(isDark)}
                      />
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Generate between 1 and 10 posts at a time.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="hashtagStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Hashtag Style
                        </label>
                        <select
                          id="hashtagStyle"
                          value={hashtagStyle}
                          onChange={(e) => setHashtagStyle(e.target.value as "None" | "Minimal" | "Normal")}
                          className={getInputClasses(isDark)}
                        >
                          <option value="None">None</option>
                          <option value="Minimal">Minimal</option>
                          <option value="Normal">Normal</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="emojiStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Emoji Style
                        </label>
                        <select
                          id="emojiStyle"
                          value={emojiStyle}
                          onChange={(e) => setEmojiStyle(e.target.value as "None" | "Minimal" | "Normal")}
                          className={getInputClasses(isDark)}
                        >
                          <option value="None">None</option>
                          <option value="Minimal">Minimal</option>
                          <option value="Normal">Normal</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </AccordionSection>
              </div>
              
              <OBDStickyActionBar
                isDark={isDark}
                left={
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                        postsStatus === "edited"
                          ? isDark
                            ? "bg-emerald-900/20 border-emerald-700 text-emerald-300"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : postsStatus === "generated"
                            ? isDark
                              ? "bg-slate-800/40 border-slate-700 text-slate-200"
                              : "bg-white border-slate-200 text-slate-700"
                            : isDark
                              ? "bg-slate-900/30 border-slate-800 text-slate-300"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                      title={
                        postsStatus === "edited"
                          ? "Showing edited posts (edited > generated)."
                          : postsStatus === "generated"
                            ? "Showing generated posts."
                            : "No posts generated yet."
                      }
                    >
                      {postsStatus === "edited"
                        ? "Edited"
                        : postsStatus === "generated"
                          ? "Generated"
                          : "Draft"}
                    </span>

                    <button
                      type="button"
                      onClick={resetInputsToDefaults}
                      disabled={isAtDefaultInputs}
                      title={
                        isAtDefaultInputs
                          ? "Already at defaults."
                          : "Reset inputs back to defaults. (Generated results are not changed.)"
                      }
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      Reset Inputs
                    </button>

                    <button
                      type="button"
                      onClick={resetAllEdits}
                      disabled={!editedPosts?.length}
                      title={
                        editedPosts?.length
                          ? "Reset all edits back to the latest generated version."
                          : "No edits to reset."
                      }
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      Reset all edits
                    </button>

                    <button
                      type="button"
                      onClick={handleLoadTemplate}
                      title="Load your saved template (local only)."
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      Load Template
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!canSaveTemplate}
                      title={
                        canSaveTemplate
                          ? "Save current inputs as a template (local only)."
                          : "Enter a topic to enable saving a template."
                      }
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      Save Template
                    </button>

                    <button
                      type="button"
                      onClick={expandAllAccordions}
                      title="Expand all input sections."
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      Expand
                    </button>

                    <button
                      type="button"
                      onClick={collapseAllAccordions}
                      title="Collapse input sections."
                      className={getSubtleButtonMediumClasses(isDark)}
                    >
                      Collapse
                    </button>
                  </div>
                }
              >
                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating..." : "Create Posts"}
                </button>
              </OBDStickyActionBar>
            </form>
      </OBDPanel>

      {/* Response card */}
      {error ? (
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      ) : (
        <OBDResultsPanel
          title="AI-Generated Posts"
          isDark={isDark}
          actions={
            (aiResponse || loading || error) ? (
              <>
                {aiResponse && (
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
                )}
                {aiResponse && (
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                      isDark
                        ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title="Copies the raw model output text (for reference only)."
                  >
                    {copied ? "Copied!" : "Copy Raw Output"}
                  </button>
                )}
                {aiResponse && (
                  <button
                    onClick={handleDownloadRawTxt}
                    disabled={!aiResponse}
                    className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title="Downloads the raw model output text (for reference only)."
                  >
                    Download Raw .txt
                  </button>
                )}
                {displayPosts.length > 0 && lastPayload?.outputMode === "ContentCalendar" && (
                  <button
                    onClick={handleShufflePosts}
                    disabled={!displayPosts.length || lastPayload?.outputMode !== "ContentCalendar"}
                    className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Shuffle Posts
                  </button>
                )}
              </>
            ) : undefined
          }
          loading={loading}
          loadingText="Generating posts..."
          emptyTitle="No posts yet"
          emptyDescription="Fill out the form above and click &quot;Create Posts&quot; to generate your social media posts."
          className="mt-8"
        >
              {regeneratePreservedNotice && (
                <div
                  key={regeneratePreservedNotice.id}
                  className={`rounded-lg border p-3 mb-4 flex items-start justify-between gap-3 ${
                    isDark
                      ? "bg-slate-800/30 border-slate-700"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {regeneratePreservedNotice.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRegeneratePreservedNotice(null)}
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                    aria-label="Dismiss notice"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* BDW Tools: Edited posts banner */}
              {editedPosts && (
                <div className={`rounded-lg border p-3 mb-4 flex items-center justify-between ${
                  isDark
                    ? "bg-slate-800/30 border-slate-700"
                    : "bg-slate-50 border-slate-200"
                }`}>
                  <p className={`text-sm ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}>
                    ✓ Showing edited version. Original posts preserved.
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

              {displayPosts.length > 0 && (
                <div className="mb-6">
                  {lastPayload?.outputMode === "ContentCalendar" && (
                    <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
                      Content Calendar mode: use &quot;Shuffle Posts&quot; to quickly change the day order.
                    </p>
                  )}
                  <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                    Preview by Platform
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayPosts.map((post, idx) => {
                      const normalizedPlatform = post.platform.trim().toLowerCase();
                      const meta = PLATFORM_META[normalizedPlatform] ?? {
                        label: post.platformLabel || post.platform,
                        icon: "💬",
                      };
                      const isEditing = inlineEdit?.postId === post.id;
                      const isAnotherEditing = !!inlineEdit && inlineEdit.postId !== post.id;
                      const isEdited = !!post.edited;
                      const isCarousel = normalizedPlatform === "instagram (carousel)" ||
                        (post.bodyLines.length > 0 && /^Slide\s+1\s*[—–-]/i.test(post.bodyLines[0])) ||
                        (post.bodyLines.length > 0 && /^Slide\s+1:/i.test(post.bodyLines[0]));
                      const charMeta = getCharacterMeta(post.characterCount, post.platform);
                      
                      let charClass = `text-xs mt-3 pt-2 border-t ${
                        isDark ? "border-slate-700" : "border-slate-200"
                      }`;
                      if (charMeta.tone === "warning") charClass += isDark ? " text-amber-400" : " text-amber-600";
                      if (charMeta.tone === "error") charClass += isDark ? " text-red-400" : " text-red-600";
                      if (charMeta.tone === "muted") charClass += ` ${themeClasses.mutedText}`;
                      if (charMeta.tone === "default") charClass += isDark ? " text-slate-400" : " text-slate-500";

                      const metaOpen = openPostMetaId === post.id;
                      const statusLabel = isEdited ? "Edited" : "Generated";
                      const origin = editOriginByPostIdRef.current[post.id];
                      const sourceLabel = isEdited
                        ? origin === "fix-pack"
                          ? "Fix Pack applied"
                          : "Edited by you"
                        : "AI generated";
                      const updatedRelative = formatRelativeTime(post.updatedAt || post.createdAt, nowTs);
                      const updatedTitle = Number.isFinite(post.updatedAt)
                        ? new Date(post.updatedAt).toLocaleString()
                        : "";

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4 ${
                            isDark
                              ? "bg-slate-800/50 border-slate-700"
                              : "bg-slate-50 border-slate-200"
                          } relative group`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="text-lg">{meta.icon}</span>
                              <h4 className={`font-semibold ${themeClasses.headingText}`}>
                                Post {post.postNumber} — {meta.label}
                              </h4>
                              {isEdited && (
                                <span
                                  className={`ml-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                                    isDark
                                      ? "bg-emerald-900/20 border-emerald-700 text-emerald-300"
                                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  }`}
                                  title="This post has manual edits (edited > generated)."
                                >
                                  Edited
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => startInlineEdit(post)}
                                  disabled={isAnotherEditing}
                                  title={
                                    isAnotherEditing
                                      ? "Finish or cancel your current edit first."
                                      : "Edit this post (Save/Cancel)."
                                  }
                                  className={getSubtleButtonMediumClasses(isDark)}
                                >
                                  Edit
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={saveInlineEdit}
                                    className={getSubtleButtonMediumClasses(isDark)}
                                    title="Save edits for this post."
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelInlineEdit}
                                    className={getSubtleButtonMediumClasses(isDark)}
                                    title="Cancel without saving."
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => resetPostToGenerated(post.id)}
                                disabled={!isEdited}
                                title={
                                  isEdited
                                    ? "Reset this post back to the generated version."
                                    : "This post has no edits."
                                }
                                className={getSubtleButtonMediumClasses(isDark)}
                              >
                                Reset
                              </button>

                              <button
                                type="button"
                                onClick={() => setOpenPostMetaId((prev) => (prev === post.id ? null : post.id))}
                                onBlur={() => setOpenPostMetaId((prev) => (prev === post.id ? null : prev))}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") setOpenPostMetaId(null);
                                }}
                                className={`px-2 py-1 text-xs font-semibold rounded-md border transition-colors ${
                                  isDark
                                    ? "bg-slate-900/20 border-slate-700 text-slate-200 hover:bg-slate-800/40"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                                aria-label="Post details"
                                aria-expanded={metaOpen}
                                title="Details"
                              >
                                ⓘ
                              </button>
                            </div>
                          </div>

                          <div
                            className={`absolute right-4 top-14 z-10 w-[260px] rounded-lg border px-3 py-2 text-xs shadow-lg pointer-events-none transition-opacity ${
                              isDark
                                ? "bg-slate-900 border-slate-700 text-slate-200 shadow-black/30"
                                : "bg-white border-slate-200 text-slate-800 shadow-slate-900/10"
                            } ${
                              metaOpen
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            aria-hidden={!metaOpen}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={isDark ? "text-slate-300" : "text-slate-500"}>Platform</span>
                                <span className="font-semibold truncate">{meta.label}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className={isDark ? "text-slate-300" : "text-slate-500"}>Status</span>
                                <span className="font-semibold">{statusLabel}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className={isDark ? "text-slate-300" : "text-slate-500"}>Source</span>
                                <span className="font-semibold">{sourceLabel}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className={isDark ? "text-slate-300" : "text-slate-500"}>Updated</span>
                                <span className="font-semibold" title={updatedTitle}>
                                  {updatedRelative}
                                </span>
                              </div>
                            </div>
                          </div>

                          {isEditing && inlineEdit ? (
                            <div className="space-y-3">
                              <div>
                                <label className={`block text-xs font-semibold mb-1 ${themeClasses.labelText}`}>
                                  Hook
                                </label>
                                <textarea
                                  value={inlineEdit.hook}
                                  onChange={(e) =>
                                    setInlineEdit((prev) =>
                                      prev ? { ...prev, hook: e.target.value } : prev
                                    )
                                  }
                                  rows={2}
                                  className={getInputClasses(isDark, "resize-none")}
                                />
                              </div>
                              <div>
                                <label className={`block text-xs font-semibold mb-1 ${themeClasses.labelText}`}>
                                  Body (one line per bullet/slide)
                                </label>
                                <textarea
                                  value={inlineEdit.body}
                                  onChange={(e) =>
                                    setInlineEdit((prev) =>
                                      prev ? { ...prev, body: e.target.value } : prev
                                    )
                                  }
                                  rows={6}
                                  className={getInputClasses(isDark, "resize-none")}
                                  placeholder={
                                    isCarousel
                                      ? "Slide 1 — ...\nSlide 2 — ...\nSlide 3 — ..."
                                      : "- Line 1\n- Line 2\n- Line 3"
                                  }
                                />
                              </div>
                              <div>
                                <label className={`block text-xs font-semibold mb-1 ${themeClasses.labelText}`}>
                                  CTA
                                </label>
                                <textarea
                                  value={inlineEdit.cta}
                                  onChange={(e) =>
                                    setInlineEdit((prev) =>
                                      prev ? { ...prev, cta: e.target.value } : prev
                                    )
                                  }
                                  rows={2}
                                  className={getInputClasses(isDark, "resize-none")}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              {post.hook && (
                                <p className={`font-medium mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                                  {post.hook}
                                </p>
                              )}
                              {post.bodyLines.length > 0 && (
                                <>
                                  {isCarousel ? (
                                    <div className="mt-3 mb-2">
                                      <h5 className={`text-xs font-semibold mb-3 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                        Instagram Carousel Slides
                                      </h5>
                                      {/* Slide number indicators */}
                                      <div className={`flex items-center gap-1.5 mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                        {post.bodyLines.map((_, slideIdx) => {
                                          const match = /^Slide\s+(\d+)/i.exec(post.bodyLines[slideIdx]);
                                          const slideNum = match ? match[1] : `${slideIdx + 1}`;
                                          return (
                                            <span key={slideIdx} className="text-xs">
                                              {slideNum}
                                              {slideIdx < post.bodyLines.length - 1 && " •"}
                                            </span>
                                          );
                                        })}
                                      </div>
                                      {/* Slide cards */}
                                      <div className={`space-y-3 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                        {post.bodyLines.map((line, lineIdx) => {
                                          const match = /^Slide\s+(\d+)\s*[—–-]\s*(.*)$/i.exec(line.trim()) ||
                                                        /^Slide\s+(\d+):\s*(.*)$/i.exec(line.trim());
                                          const slideNumber = match ? match[1] : `${lineIdx + 1}`;
                                          let slideText = match ? match[2].trim() : line.trim();
                                          
                                          // Clean any leftover prefixes
                                          slideText = slideText.replace(/^[-—–:]\s*/, '').trim();

                                          return (
                                            <div key={lineIdx} className={`border rounded-lg p-3 shadow-sm ${
                                              isDark
                                                ? "bg-slate-700/40 border-slate-600 shadow-slate-900/20"
                                                : "bg-slate-100/60 border-slate-300 shadow-slate-200/50"
                                            }`}>
                                              <div className={`text-xs font-semibold mb-1.5 ${
                                                isDark ? "text-slate-300" : "text-gray-600"
                                              }`}>
                                                Slide {slideNumber}
                                              </div>
                                              <div className={`text-sm leading-snug ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                                                {slideText}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {/* Divider before CTA */}
                                      <div className={`border-t my-4 ${isDark ? "border-slate-700" : "border-slate-200"}`} />
                                    </div>
                                  ) : (
                                    <div className={`mb-2 space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                      {post.bodyLines.map((line, lineIdx) => (
                                        <p key={lineIdx} className={line.startsWith("- ") ? "" : "pl-4"}>
                                          {line.startsWith("- ") ? line : `• ${line}`}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                              {post.cta && (
                                <p className={`mt-2 italic text-sm ${themeClasses.mutedText}`}>
                                  CTA: {post.cta}
                                </p>
                              )}
                            </>
                          )}
                          <p className={charClass}>
                            {charMeta.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BDW Tools Panel */}
              {displayPosts.length > 0 && (
                <>
                  {/* Copy Bundles */}
                  <SMPCCopyBundles posts={displayPosts} isDark={isDark} storageKey="smpc-analytics" />

                  {/* Tier 5C: Draft-only handoff to Social Auto-Poster */}
                  <div
                    className={`rounded-xl border p-4 mt-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          Send to Social Auto-Poster
                        </h4>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          Draft-only. Applies as reviewable drafts in Social Auto-Poster—no scheduling or posting.
                        </p>
                        {!businessId && (
                          <p className={`text-xs mt-1 ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                            Business context required to send.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={openHandoffModal}
                        disabled={!displayPosts.length || !businessId}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-[#29c4a9] hover:text-white"
                            : "bg-white text-slate-700 hover:bg-[#29c4a9] hover:text-white border border-slate-200"
                        }`}
                        title={!businessId ? "Business context required." : "Choose posts to send (draft-only)."}
                      >
                        Send
                      </button>
                    </div>
                  </div>

                  {/* BDW Tools Tabs */}
                  <BDWToolsTabs
                    posts={displayPosts}
                    basePosts={parsedPosts}
                    editedPosts={editedPosts}
                    isDark={isDark}
                    onApplyFix={handleApplyFix}
                    onReset={handleResetEdits}
                    onUndo={editHistory.length > 0 ? handleUndoLastEdit : undefined}
                  />
                </>
              )}

          <div className={`min-h-[200px] p-4 border ${themeClasses.inputBorder} rounded-xl ${
            isDark ? "bg-slate-800" : "bg-gray-50"
          }`}>
            <div className={`text-xs font-semibold mb-2 ${themeClasses.mutedText}`}>
              Raw output (for reference)
            </div>
            <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
              Exports and bundles use the structured posts above (edited &gt; generated), not this raw text.
            </p>
            {aiResponse ? (
              <p className={`whitespace-pre-wrap ${isDark ? "text-slate-100" : "text-gray-800"}`}>
                {aiResponse}
              </p>
            ) : null}
          </div>
        </OBDResultsPanel>
      )}
    </OBDPageContainer>
  );
}

// BDW Tools Tabs Component
interface BDWToolsTabsProps {
  posts: SMPCPostItem[];
  basePosts: SMPCPostItem[];
  editedPosts: SMPCPostItem[] | null;
  isDark: boolean;
  onApplyFix: (updatedPosts: SMPCPostItem[]) => void;
  onReset: () => void;
  onUndo?: () => void;
}

function BDWToolsTabs({
  posts,
  basePosts,
  editedPosts,
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
        <AnalyticsDetails storageKey="smpc-analytics" isDark={isDark} />
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "fix-packs" && (
          <SMPCFixPacks
            posts={posts}
            basePosts={basePosts}
            editedPosts={editedPosts}
            isDark={isDark}
            onApply={onApplyFix}
            onReset={onReset}
            onUndo={onUndo}
          />
        )}
        {activeTab === "quality-controls" && (
          <SMPCQualityControlsTab
            posts={posts}
            isDark={isDark}
            onApplyFix={onApplyFix}
          />
        )}
        {activeTab === "export-center" && (
          <SMPCExportCenterPanel posts={posts} isDark={isDark} storageKey="smpc-analytics" />
        )}
      </div>
    </div>
  );
}

