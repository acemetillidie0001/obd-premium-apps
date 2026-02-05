"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import EcosystemNextSteps from "@/components/obd/EcosystemNextSteps";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getSecondaryButtonClasses,
  getSubtleButtonMediumClasses,
} from "@/lib/obd-framework/layout-helpers";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import {
  clearRdToReviewResponderDraftHandoff,
  readRdToReviewResponderDraftHandoff,
  type RdReviewResponderDraftReviewV1,
  type RdToReviewResponderDraftHandoffV1,
} from "@/lib/apps/reputation-dashboard/handoff";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import {
  clearReviewResponderRdDrafts,
  readReviewResponderRdDrafts,
  storeReviewResponderRdDrafts,
} from "@/lib/apps/review-responder/handoff";

export interface ReviewResponderFormValues {
  businessName: string;
  businessType: string;
  services: string;
  city: string;
  state: string;
  platform: "Google" | "OBD" | "Facebook" | "Other";
  reviewRating: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  customerName: string;
  responseGoal: string;
  brandVoice: string;
  personalityStyle: "None" | "Soft" | "Bold" | "High-Energy" | "Luxury";
  responseLength: "Short" | "Medium" | "Long";
  language: "English" | "Spanish" | "Bilingual";
  includeQnaBox: boolean;
  includeMetaDescription: boolean;
  includeStoryVersion: boolean;
}

export interface QnaBoxItem {
  question: string;
  answer: string;
}

export interface ReviewResponderResponse {
  standardReply: string;
  shortReply: string;
  socialSnippet: string;
  whyChooseSection: string;
  qnaBox?: QnaBoxItem[];
  metaDescription?: string;
  storytellingVersion?: string;
}

type ReviewResponseStatus = "draft" | "generated" | "edited";

type ReviewResponsePlatformKey = "google" | "facebook" | "obd" | "other";

type ReviewResponseKind =
  | "standardReply"
  | "shortReply"
  | "socialSnippet"
  | "whyChooseSection"
  | "qnaBox"
  | "metaDescription"
  | "storytellingVersion";

type ReviewResponseItem = {
  id: string;
  kind: ReviewResponseKind;
  platform: ReviewResponsePlatformKey;
  tone?: string;
  length?: string;
  generatedText: string;
  editedText?: string;
  status: ReviewResponseStatus;
  updatedAt?: string;
  explanation?: string[];
  explanationStatus?: "none" | "generated";
};

type ReviewResponseSnapshotInputSummary = {
  platform?: ReviewResponderFormValues["platform"];
  reviewRating?: ReviewResponderFormValues["reviewRating"];
  responseLength?: ReviewResponderFormValues["responseLength"];
  language?: ReviewResponderFormValues["language"];
  personalityStyle?: ReviewResponderFormValues["personalityStyle"];
  includeQnaBox?: boolean;
  includeMetaDescription?: boolean;
  includeStoryVersion?: boolean;
  reviewTextHash?: string;
  reviewTextLength?: number;
  hasServices?: boolean;
  hasResponseGoal?: boolean;
  hasBrandVoice?: boolean;
};

type ReviewResponseSnapshotResponseItem = {
  platform: ReviewResponsePlatformKey;
  kind: ReviewResponseKind;
  activeText: string;
  status: ReviewResponseStatus;
  tone?: string;
  length?: string;
};

type ReviewResponseSnapshotListItem = {
  id: string;
  createdAt: string;
  inputSummary: ReviewResponseSnapshotInputSummary;
  counts: { responsesCount: number; editedCount: number; platformCount: number };
};

type ReviewResponseSnapshotDetail = {
  id: string;
  createdAt: string;
  inputSummary: ReviewResponseSnapshotInputSummary;
  responses: ReviewResponseSnapshotResponseItem[];
};

const RESPONSE_KIND_ORDER: ReviewResponseKind[] = [
  "standardReply",
  "shortReply",
  "socialSnippet",
  "whyChooseSection",
  "qnaBox",
  "metaDescription",
  "storytellingVersion",
];

const RESPONSE_KIND_LABEL: Record<ReviewResponseKind, string> = {
  standardReply: "Standard Reply",
  shortReply: "Short Reply",
  socialSnippet: "Social Snippet",
  whyChooseSection: "Why Choose / Brand Expansion",
  qnaBox: "Q&A Box",
  metaDescription: "Meta Description",
  storytellingVersion: "Storytelling Version",
};

function normalizeText(input: string): string {
  return (input || "").replace(/\s+/g, " ").trim();
}

function stableHash(input: string): string {
  // Deterministic, non-cryptographic hash (djb2-ish).
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Ensure positive 32-bit and encode compactly.
  return (hash >>> 0).toString(36);
}

function mapPlatformKey(platform: ReviewResponderFormValues["platform"]): ReviewResponsePlatformKey {
  if (platform === "Google") return "google";
  if (platform === "Facebook") return "facebook";
  if (platform === "OBD") return "obd";
  return "other";
}

function getBaseResponseId(values: ReviewResponderFormValues): string {
  const identity = [
    mapPlatformKey(values.platform),
    String(values.reviewRating),
    normalizeText(values.reviewText).slice(0, 800),
  ].join("|");
  return `${mapPlatformKey(values.platform)}:${stableHash(identity)}`;
}

function getActiveResponseText(item: ReviewResponseItem): string {
  const edited = (item.editedText || "").trim();
  return edited ? edited : item.generatedText;
}

function getActiveResponses(items: ReviewResponseItem[]): ReviewResponseItem[] {
  const order = new Map(RESPONSE_KIND_ORDER.map((k, idx) => [k, idx]));
  return [...items].sort((a, b) => {
    const ak = order.get(a.kind) ?? 999;
    const bk = order.get(b.kind) ?? 999;
    if (ak !== bk) return ak - bk;
    return a.id.localeCompare(b.id);
  });
}

function formatQnaToText(items: QnaBoxItem[]): string {
  const lines: string[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    const q = normalizeText(item?.question || "");
    const a = normalizeText(item?.answer || "");
    if (!q && !a) continue;
    lines.push(`Q: ${q || "-"}`);
    lines.push(`A: ${a || "-"}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildResponseItemsFromApi(
  data: ReviewResponderResponse,
  values: ReviewResponderFormValues
): ReviewResponseItem[] {
  const baseId = getBaseResponseId(values);
  const platform = mapPlatformKey(values.platform);
  const updatedAt = new Date().toISOString();
  const tone =
    values.personalityStyle && values.personalityStyle !== "None"
      ? values.personalityStyle
      : undefined;

  const out: ReviewResponseItem[] = [];

  const push = (kind: ReviewResponseKind, generatedText: string | undefined) => {
    const text = (generatedText || "").toString();
    if (!text.trim()) return;
    out.push({
      id: `${baseId}:${kind}`,
      kind,
      platform,
      tone,
      length: values.responseLength,
      generatedText: text,
      status: "generated",
      updatedAt,
      explanationStatus: "none",
    });
  };

  push("standardReply", data.standardReply);
  push("shortReply", data.shortReply);
  push("socialSnippet", data.socialSnippet);
  push("whyChooseSection", data.whyChooseSection);
  if (data.qnaBox && data.qnaBox.length > 0) push("qnaBox", formatQnaToText(data.qnaBox));
  if (data.metaDescription) push("metaDescription", data.metaDescription);
  if (data.storytellingVersion) push("storytellingVersion", data.storytellingVersion);

  return out;
}

const DEFAULT_FORM: ReviewResponderFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  platform: "Google",
  reviewRating: 5,
  reviewText: "",
  customerName: "",
  responseGoal: "",
  brandVoice: "",
  personalityStyle: "None",
  responseLength: "Medium",
  language: "English",
  includeQnaBox: true,
  includeMetaDescription: true,
  includeStoryVersion: true,
};

export default function ReviewResponderPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();
  const businessId = useMemo(() => resolveBusinessId(searchParams), [searchParams]);

  const [formValues, setFormValues] = useState<ReviewResponderFormValues>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [responseItems, setResponseItems] = useState<ReviewResponseItem[]>([]);
  const [outputBaseId, setOutputBaseId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Tier 6-1: Response History (snapshot-only, immutable, tenant-scoped)
  const [historyItems, setHistoryItems] = useState<ReviewResponseSnapshotListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReviewResponseSnapshotDetail | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Tier 6-2: Explain Mode (one-shot per item, not reactive to edits)
  const [explainOpenById, setExplainOpenById] = useState<Record<string, boolean>>({});
  const [explainLoadingId, setExplainLoadingId] = useState<string | null>(null);

  // Tier 5C receiver: Reputation Dashboard -> Review Responder (draft-only)
  const [rdIncoming, setRdIncoming] = useState<RdToReviewResponderDraftHandoffV1 | null>(null);
  const [rdDrafts, setRdDrafts] = useState<RdToReviewResponderDraftHandoffV1 | null>(null);
  const [rdImportError, setRdImportError] = useState<string | null>(null);

  // Helper to show toast and auto-clear
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Brand Profile auto-apply toggle
  const [useBrandProfile, setUseBrandProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return hasBrandProfile();
    } catch {
      return false;
    }
  });

  // Auto-apply brand profile to form
  const { applied, brandFound } = useAutoApplyBrandProfile({
    enabled: useBrandProfile,
    form: formValues as unknown as Record<string, unknown>,
    setForm: (formOrUpdater) => {
      if (typeof formOrUpdater === "function") {
        setFormValues((prev) => formOrUpdater(prev as unknown as Record<string, unknown>) as unknown as ReviewResponderFormValues);
      } else {
        setFormValues(formOrUpdater as unknown as ReviewResponderFormValues);
      }
    },
    storageKey: "review-responder-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "city") return "city";
      if (formKey === "state") return "state";
      if (formKey === "brandVoice") return "brandVoice";
      if (formKey === "language") return "language";
      return undefined;
    },
  });

  // Show one-time toast when brand profile is applied
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (applied && !toastShownRef.current) {
      toastShownRef.current = true;
      showToast("Brand Profile applied to empty fields.");
    }
  }, [applied]);

  // Handle personalityStyle mapping from brandPersonality (special case)
  // This runs after brand profile auto-apply to map brandPersonality to personalityStyle
  useEffect(() => {
    if (formValues.personalityStyle !== "None") return; // Don't overwrite if already set
    
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
          setFormValues((prev) => ({ ...prev, personalityStyle: mapped }));
        }
      }
    });
  }, [formValues.personalityStyle]);

  // Load previously imported RD drafts for this session (refresh-safe)
  useEffect(() => {
    const { payload, expired } = readReviewResponderRdDrafts();
    if (expired) {
      clearReviewResponderRdDrafts();
      setRdDrafts(null);
      return;
    }
    if (payload) {
      setRdDrafts(payload);
    }
  }, []);

  // Only check for RD handoff when explicitly routed with receiver flag.
  useEffect(() => {
    const handoffFlag = searchParams?.get("handoff");
    const sourceFlag = searchParams?.get("source");
    const isRdRoute = handoffFlag === "rd" || (handoffFlag === "1" && sourceFlag === "rd");
    if (!isRdRoute) return;

    setRdImportError(null);
    const { payload, expired } = readRdToReviewResponderDraftHandoff();
    if (expired) {
      clearRdToReviewResponderDraftHandoff();
      setRdIncoming(null);
      showToast("Draft handoff expired.");
      return;
    }

    if (!payload) return;

    // Tenant safety: require a resolvable businessId and match it to the payload.
    if (!businessId) {
      clearRdToReviewResponderDraftHandoff();
      setRdIncoming(null);
      setRdImportError("Business context is required to import drafts. Open this tool from a business-scoped link.");
      return;
    }
    if (payload.from?.businessId !== businessId) {
      clearRdToReviewResponderDraftHandoff();
      setRdIncoming(null);
      setRdImportError("Draft handoff blocked: this draft was created for a different business.");
      return;
    }

    setRdIncoming(payload);
  }, [searchParams, businessId]);

  const dismissRdIncoming = () => {
    clearRdToReviewResponderDraftHandoff();
    setRdIncoming(null);
  };

  const importRdIncoming = () => {
    if (!rdIncoming) return;
    if (!businessId) return;
    if (rdIncoming.from?.businessId !== businessId) return;

    // Store inbox drafts so a refresh doesn't lose them.
    storeReviewResponderRdDrafts(rdIncoming);
    setRdDrafts(rdIncoming);
    clearRdToReviewResponderDraftHandoff();
    setRdIncoming(null);
    showToast("Drafts imported.");
  };

  const clearRdDrafts = () => {
    clearReviewResponderRdDrafts();
    setRdDrafts(null);
    showToast("Drafts cleared.");
  };

  const mapPlatform = (p: string): ReviewResponderFormValues["platform"] => {
    if (p === "Google") return "Google";
    if (p === "Facebook") return "Facebook";
    if (p === "OBD") return "OBD";
    return "Other";
  };

  const loadDraftIntoForm = (draft: RdReviewResponderDraftReviewV1) => {
    setError(null);
    setFormValues((prev) => ({
      ...prev,
      platform: mapPlatform(draft.platformLabel || draft.platform),
      reviewRating: Math.min(5, Math.max(1, Math.round(Number(draft.rating) || 5))) as 1 | 2 | 3 | 4 | 5,
      reviewText: draft.reviewText || "",
      customerName: "",
    }));
    showToast("Draft loaded into the form.");
  };

  const updateFormValue = <K extends keyof ReviewResponderFormValues>(
    key: K,
    value: ReviewResponderFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // Tier 5A: accordion sections (default: first open, others collapsed)
  const [accordionState, setAccordionState] = useState({
    businessContext: true,
    reviewDetails: false,
    responseStrategy: false,
    voiceTone: false,
    optionalEnhancements: false,
  });

  const toggleAccordion = (key: keyof typeof accordionState) =>
    setAccordionState((prev) => ({ ...prev, [key]: !prev[key] }));

  const getBusinessContextSummary = (): string => {
    const parts: string[] = [];
    const name = formValues.businessName.trim();
    const type = formValues.businessType.trim();
    if (name) parts.push(name);
    if (type) parts.push(type);
    const loc = [formValues.city.trim(), formValues.state.trim()].filter(Boolean).join(", ");
    if (loc) parts.push(loc);
    return parts.length ? parts.join(" • ") : "Not filled";
  };

  const getReviewDetailsSummary = (): string => {
    const parts: string[] = [];
    parts.push(formValues.platform);
    parts.push(`${formValues.reviewRating}★`);
    if (formValues.reviewText.trim()) parts.push("Review pasted");
    if (formValues.customerName.trim()) parts.push("Name");
    return parts.join(" • ");
  };

  const getResponseStrategySummary = (): string => {
    const parts: string[] = [];
    if (formValues.responseGoal.trim()) parts.push("Goal set");
    parts.push(formValues.responseLength);
    return parts.join(" • ");
  };

  const getVoiceToneSummary = (): string => {
    const parts: string[] = [];
    if (formValues.brandVoice.trim()) parts.push("Brand voice");
    if (formValues.personalityStyle !== "None") parts.push(formValues.personalityStyle);
    parts.push(formValues.language);
    return parts.length ? parts.join(" • ") : "Not set";
  };

  const getOptionalEnhancementsSummary = (): string => {
    const parts: string[] = [];
    if (formValues.includeQnaBox) parts.push("Q&A");
    if (formValues.includeMetaDescription) parts.push("Meta description");
    if (formValues.includeStoryVersion) parts.push("Story version");
    return parts.length ? parts.join(" • ") : "None";
  };

  const activeResponses = useMemo(() => getActiveResponses(responseItems), [responseItems]);

  const outputStatus: "Draft" | "Generated" | "Edited" = useMemo(() => {
    if (activeResponses.some((i) => i.status === "edited" && (i.editedText || "").trim())) return "Edited";
    if (activeResponses.length > 0) return "Generated";
    return "Draft";
  }, [activeResponses]);

  const outputStatusTitle =
    outputStatus === "Edited"
      ? "Showing edited drafts (edited > generated)."
      : outputStatus === "Generated"
        ? "Showing generated drafts."
        : "No drafts generated yet.";

  const isAtDefaultForm = useMemo(() => {
    try {
      return JSON.stringify(formValues) === JSON.stringify(DEFAULT_FORM);
    } catch {
      return false;
    }
  }, [formValues]);

  const hasEditedOutputs = useMemo(
    () => activeResponses.some((i) => Boolean((i.editedText || "").trim())),
    [activeResponses]
  );

  const isAtDefaultInputs = isAtDefaultForm;

  const resetInputsToDefaults = () => {
    setFormValues(DEFAULT_FORM);
    setError(null);
    showToast("Inputs reset.");
  };

  const resetAllEdits = () => {
    setResponseItems((prev) =>
      prev.map((item) => {
        if (!(item.editedText || "").trim()) return item;
        return {
          ...item,
          editedText: undefined,
          status: "generated",
          updatedAt: new Date().toISOString(),
          // Active text changes; clear one-shot explanation to avoid stale rationale.
          explanation: undefined,
          explanationStatus: "none",
        };
      })
    );
    setEditingId(null);
    setEditingValue("");
    showToast("Edits reset.");
  };

  const clearOutputs = () => {
    setResponseItems([]);
    setOutputBaseId(null);
    setEditingId(null);
    setEditingValue("");
    setExplainOpenById({});
    showToast("Outputs cleared.");
  };

  const exportRef = useRef<HTMLDivElement | null>(null);
  const exportFocusRef = useRef<HTMLDivElement | null>(null);
  const handleScrollToExport = () => {
    exportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus for keyboard/screen reader users after scroll.
    setTimeout(() => {
      exportFocusRef.current?.focus();
    }, 150);
  };

  const canExport = useMemo(() => {
    return activeResponses.some((item) => Boolean(getActiveResponseText(item).trim()));
  }, [activeResponses]);

  const getPlatformLabel = (platform: ReviewResponsePlatformKey): string => {
    if (platform === "google") return "Google";
    if (platform === "facebook") return "Facebook";
    if (platform === "obd") return "OBD";
    return "Other";
  };

  const getExportText = (): string => {
    if (!canExport) return "";
    const lines: string[] = [];
    for (const item of activeResponses) {
      const platformLabel = getPlatformLabel(item.platform);
      lines.push(`[${platformLabel}]`);
      lines.push(`${RESPONSE_KIND_LABEL[item.kind]}:`);
      lines.push(getActiveResponseText(item).trim());
      lines.push("");
    }
    return lines.join("\n");
  };

  const handleCopyAll = async () => {
    if (!canExport) return;
    try {
      await navigator.clipboard.writeText(getExportText());
      showToast("Copied.");
    } catch (err) {
      console.error("Failed to copy:", err);
      showToast("Copy failed.");
    }
  };

  const handleDownloadTxt = () => {
    if (!canExport) return;
    try {
      const blob = new Blob([getExportText()], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "review-responder-draft.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Downloaded.");
    } catch (err) {
      console.error("Failed to download:", err);
      showToast("Download failed.");
    }
  };

  const buildSnapshotInputSummary = (values: ReviewResponderFormValues): ReviewResponseSnapshotInputSummary => {
    const reviewTextNormalized = normalizeText(values.reviewText).slice(0, 800);
    const reviewTextHash = reviewTextNormalized ? stableHash(reviewTextNormalized) : undefined;

    return {
      platform: values.platform,
      reviewRating: values.reviewRating,
      responseLength: values.responseLength,
      language: values.language,
      personalityStyle: values.personalityStyle,
      includeQnaBox: values.includeQnaBox,
      includeMetaDescription: values.includeMetaDescription,
      includeStoryVersion: values.includeStoryVersion,
      reviewTextHash,
      reviewTextLength: (values.reviewText || "").length,
      hasServices: Boolean(values.services?.trim()),
      hasResponseGoal: Boolean(values.responseGoal?.trim()),
      hasBrandVoice: Boolean(values.brandVoice?.trim()),
    };
  };

  const loadHistory = async () => {
    if (!businessId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/review-responder/snapshots", { method: "GET" });
      const jsonResponse = await res.json();

      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      const snapshots = (jsonResponse.data?.snapshots || []) as ReviewResponseSnapshotListItem[];
      setHistoryItems(Array.isArray(snapshots) ? snapshots : []);
    } catch (err) {
      console.error("History load failed:", err);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      setHistoryError(formatUserErrorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSnapshot = async (id: string) => {
    if (!businessId) return;
    const trimmedId = (id || "").trim();
    if (!trimmedId) return;

    setSelectedSnapshotId(trimmedId);
    setSelectedSnapshot(null);
    setSnapshotLoading(true);
    setHistoryError(null);

    try {
      const res = await fetch(`/api/review-responder/snapshots/${encodeURIComponent(trimmedId)}`, { method: "GET" });
      const jsonResponse = await res.json();

      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      const detail = jsonResponse.data as ReviewResponseSnapshotDetail;
      setSelectedSnapshot(detail);
    } catch (err) {
      console.error("Snapshot load failed:", err);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      setHistoryError(formatUserErrorMessage(err));
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!businessId) return;
    if (!canExport) return;
    if (savingSnapshot) return;

    const responses: ReviewResponseSnapshotResponseItem[] = activeResponses
      .map((item) => ({
        platform: item.platform,
        kind: item.kind,
        activeText: getActiveResponseText(item).trim(),
        status: item.status,
        tone: item.tone,
        length: item.length,
      }))
      .filter((r) => Boolean(r.activeText));

    if (responses.length === 0) return;

    setSavingSnapshot(true);
    setHistoryError(null);

    try {
      const payload = {
        inputSummary: buildSnapshotInputSummary(formValues),
        responses,
      };

      const res = await fetch("/api/review-responder/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const jsonResponse = await res.json();

      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      const created = jsonResponse.data as { id: string };
      showToast("Snapshot saved.");
      await loadHistory();
      if (created?.id) {
        // Auto-open the snapshot you just saved (read-only view)
        void loadSnapshot(created.id);
      }
    } catch (err) {
      console.error("Snapshot save failed:", err);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      setHistoryError(formatUserErrorMessage(err));
      showToast("Save failed.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const processRequest = async (values: ReviewResponderFormValues) => {
    const nextBaseId = getBaseResponseId(values);

    if (outputBaseId && outputBaseId !== nextBaseId) {
      const hasEdits = responseItems.some((i) => Boolean((i.editedText || "").trim()));
      if (hasEdits) {
        setError("You have edited drafts from a different review. To avoid losing work, use “Clear outputs” first, then generate again.");
        return;
      }
      // Safe to replace outputs when there are no edits.
      setResponseItems([]);
      setOutputBaseId(nextBaseId);
    } else if (!outputBaseId) {
      setOutputBaseId(nextBaseId);
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/review-responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const jsonResponse = await res.json();
      
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      // Handle standardized response format: { ok: true, data: ReviewResponderResponse }
      const data = (jsonResponse.data || jsonResponse) as ReviewResponderResponse;
      const generatedItems = buildResponseItemsFromApi(data, values);

      setResponseItems((prev) => {
        // If baseId changed and we already cleared earlier, prev should be empty.
        const byId = new Map(prev.map((i) => [i.id, i]));
        const nextIds = new Set(generatedItems.map((i) => i.id));
        const merged: ReviewResponseItem[] = [];

        for (const next of generatedItems) {
          const existing = byId.get(next.id);
          if (existing && (existing.editedText || "").trim()) {
            merged.push(existing);
            continue;
          }
          merged.push({
            ...next,
            editedText: undefined,
            status: "generated",
            updatedAt: new Date().toISOString(),
            // Explanations are one-shot and not reactive to edits.
            // When regeneration replaces the underlying generated text, clear explanation to avoid stale rationale.
            explanation: undefined,
            explanationStatus: "none",
          });
        }

        // Preserve edited items that are not in the new generation payload.
        for (const existing of prev) {
          if (!nextIds.has(existing.id) && (existing.editedText || "").trim()) {
            merged.push(existing);
          }
        }

        return getActiveResponses(merged);
      });
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.businessName.trim() || !formValues.businessType.trim() || !formValues.reviewText.trim()) {
      setError("Please fill in the business name, business type, and review text to continue.");
      return;
    }

    if (formValues.reviewRating < 1 || formValues.reviewRating > 5) {
      setError("Please select a review rating between 1 and 5 stars.");
      return;
    }

    await processRequest(formValues);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEditingValue = (itemId: string) => {
    const trimmed = editingValue.trim();
    setResponseItems((prev) =>
      prev.map((x) => {
        if (x.id !== itemId) return x;
        if (!trimmed) {
          return {
            ...x,
            editedText: undefined,
            status: "generated",
            updatedAt: new Date().toISOString(),
            // Active text changes; clear one-shot explanation to avoid stale rationale.
            explanation: undefined,
            explanationStatus: "none",
          };
        }
        return {
          ...x,
          editedText: trimmed,
          status: "edited",
          updatedAt: new Date().toISOString(),
        };
      })
    );
    cancelEditing();
    showToast(trimmed ? "Saved." : "Reset to generated.");
  };

  const toggleExplain = (id: string) => {
    setExplainOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const generateExplanationForItem = async (item: ReviewResponseItem) => {
    if (explainLoadingId) return;
    const activeText = getActiveResponseText(item).trim();
    if (!activeText) return;

    setExplainLoadingId(item.id);
    setError(null);

    try {
      const res = await fetch("/api/review-responder/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: item.platform,
          kind: item.kind,
          activeText,
          status: item.status,
          tone: item.tone,
          length: item.length,
        }),
      });

      const jsonResponse = await res.json();
      if (!res.ok || !jsonResponse.ok) {
        const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
        const errorMessage = formatUserErrorMessage(null, jsonResponse, res.status);
        throw new Error(errorMessage);
      }

      const bullets = (jsonResponse.data?.bullets || []) as string[];
      const normalized = (Array.isArray(bullets) ? bullets : []).map((b) => String(b || "").trim()).filter(Boolean).slice(0, 5);

      setResponseItems((prev) =>
        prev.map((x) =>
          x.id !== item.id
            ? x
            : {
                ...x,
                explanation: normalized,
                explanationStatus: normalized.length ? "generated" : "none",
              }
        )
      );

      setExplainOpenById((prev) => ({ ...prev, [item.id]: true }));
      showToast("Explanation saved.");
    } catch (err) {
      console.error("Explanation generation failed:", err);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      setError(formatUserErrorMessage(err));
      showToast("Explain failed.");
    } finally {
      setExplainLoadingId(null);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Review Responder"
      tagline="Generate polished, professional responses to customer reviews in seconds — tailored to your Ocala business."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      {/* Trust microcopy (persistent) */}
      <div
        className={`mt-7 rounded-xl border p-4 ${
          isDark ? "bg-slate-900/30 border-slate-800" : "bg-slate-50 border-slate-200"
        }`}
        role="note"
        aria-label="Draft-only notice"
      >
        <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          <span className="font-medium">Draft-only. Nothing is posted, sent, or published automatically.</span>
        </p>
        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
          This tool helps you write replies — you choose where to paste/post them.
        </p>
      </div>

      {/* Tier 5C: Reputation Dashboard draft handoff (explicit import, tenant-safe) */}
      {rdImportError ? (
        <div
          className={`mt-7 rounded-xl border p-4 ${
            isDark ? "bg-red-900/20 border-red-700 text-red-200" : "bg-red-50 border-red-200 text-red-800"
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="text-sm font-medium mb-1">Draft import blocked</div>
          <div className="text-sm">{rdImportError}</div>
        </div>
      ) : null}

      {rdIncoming ? (
        <div
          className={`mt-7 rounded-xl border p-4 ${
            isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium mb-1 ${isDark ? "text-blue-200" : "text-blue-900"}`}>
                Draft reviews received from Reputation Dashboard
              </div>
              <div className={`text-xs ${isDark ? "text-blue-300" : "text-blue-800"}`}>
                Snapshot {rdIncoming.context.snapshotId} • {rdIncoming.selectedReviews.length} review{rdIncoming.selectedReviews.length === 1 ? "" : "s"} • Draft-only
              </div>
              <div className={`text-[11px] mt-2 ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                Nothing is generated or sent automatically. You’ll choose what to load into the form.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={importRdIncoming}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#29c4a9] text-white hover:bg-[#22ad93] transition-colors"
              >
                Review & Import
              </button>
              <button
                type="button"
                onClick={dismissRdIncoming}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark ? "text-slate-300 hover:bg-slate-800/60" : "text-slate-700 hover:bg-white/60"
                }`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rdDrafts && rdDrafts.selectedReviews.length > 0 ? (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>
                Drafts from Reputation Dashboard
              </div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Snapshot {rdDrafts.context.snapshotId} • {rdDrafts.selectedReviews.length} draft{rdDrafts.selectedReviews.length === 1 ? "" : "s"}
              </div>
            </div>
            <button
              type="button"
              onClick={clearRdDrafts}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"
              }`}
            >
              Clear drafts
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {rdDrafts.selectedReviews.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-lg border ${
                  isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-xs ${themeClasses.labelText}`}>
                      {r.reviewDate} • {r.platformLabel} • {r.rating}★
                    </div>
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      {r.reviewText.length > 220 ? `${r.reviewText.slice(0, 220)}…` : r.reviewText}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadDraftIntoForm(r)}
                    className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg bg-[#29c4a9] text-white hover:bg-[#22ad93] transition-colors"
                  >
                    Load into form
                  </button>
                </div>
              </div>
            ))}
          </div>
        </OBDPanel>
      ) : null}

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className={`space-y-4 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
            {/* Business Context */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("businessContext")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Business Context
                  </h3>
                  {!accordionState.businessContext && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getBusinessContextSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("businessContext");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                  title={accordionState.businessContext ? "Collapse section" : "Expand section"}
                >
                  {accordionState.businessContext ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.businessContext && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Business Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="businessName"
                        value={formValues.businessName}
                        onChange={(e) => updateFormValue("businessName", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Example: Ocala Massage & Wellness"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Business Type <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="businessType"
                        value={formValues.businessType}
                        onChange={(e) => updateFormValue("businessType", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Restaurant, salon, contractor, etc."
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Services / Details (Optional)
                    </label>
                    <textarea
                      id="services"
                      value={formValues.services}
                      onChange={(e) => updateFormValue("services", e.target.value)}
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Mention key services so the AI can personalize your response."
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Mention key services so the AI can personalize your response.
                    </p>
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
              )}
            </div>

            {/* Review Details */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("reviewDetails")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Review Details
                  </h3>
                  {!accordionState.reviewDetails && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getReviewDetailsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("reviewDetails");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                  title={accordionState.reviewDetails ? "Collapse section" : "Expand section"}
                >
                  {accordionState.reviewDetails ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.reviewDetails && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Platform
                      </label>
                      <select
                        id="platform"
                        value={formValues.platform}
                        onChange={(e) => updateFormValue("platform", e.target.value as ReviewResponderFormValues["platform"])}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Google">Google</option>
                        <option value="OBD">OBD</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Other">Other</option>
                      </select>
                      <details
                        className={`mt-2 rounded-lg border p-3 ${
                          isDark ? "bg-slate-900/20 border-slate-800" : "bg-white border-slate-200"
                        }`}
                      >
                        <summary className={`cursor-pointer text-xs font-semibold ${themeClasses.labelText}`}>
                          Tips for this platform
                        </summary>
                        <div className={`mt-2 text-xs ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          <div className={`text-[11px] ${themeClasses.mutedText}`}>
                            Guidance only — you decide what to post.
                          </div>

                          {formValues.platform === "Google" ? (
                            <ul className="mt-2 list-disc pl-5 space-y-1">
                              <li>Short, appreciative, and factual.</li>
                              <li>Acknowledge specifics from the review when possible.</li>
                              <li>If something went wrong, invite offline resolution (briefly, calmly).</li>
                            </ul>
                          ) : null}

                          {formValues.platform === "Facebook" ? (
                            <ul className="mt-2 list-disc pl-5 space-y-1">
                              <li>Warm and conversational.</li>
                              <li>Community-friendly language (neighbors, locals, thanks for support).</li>
                              <li>Keep it skimmable; one clear next step if needed.</li>
                            </ul>
                          ) : null}

                          {formValues.platform === "OBD" ? (
                            <ul className="mt-2 list-disc pl-5 space-y-1">
                              <li>Friendly and clear, like an owner/manager reply.</li>
                              <li>Focus on the customer’s experience and what happens next.</li>
                              <li>Keep it concise; avoid sounding templated.</li>
                            </ul>
                          ) : null}

                          {formValues.platform === "Other" ? (
                            <div className="mt-2 space-y-2">
                              <ul className="list-disc pl-5 space-y-1">
                                <li>Keep it calm, specific, and easy to read.</li>
                                <li>Use one clear next step if follow-up is needed.</li>
                              </ul>
                              <div>
                                <div className={`text-xs font-semibold ${themeClasses.labelText}`}>If replying on Yelp</div>
                                <ul className="mt-1 list-disc pl-5 space-y-1">
                                  <li>Professional and calm; avoid defensiveness.</li>
                                  <li>Keep it concise and focused on the customer’s points.</li>
                                  <li>Offer an offline path to resolve issues when appropriate.</li>
                                </ul>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </div>

                    <div>
                      <label htmlFor="reviewRating" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Review Rating
                      </label>
                      <select
                        id="reviewRating"
                        value={formValues.reviewRating}
                        onChange={(e) => updateFormValue("reviewRating", parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                        className={getInputClasses(isDark)}
                      >
                        <option value={1}>1 (Very negative)</option>
                        <option value={2}>2 (Negative)</option>
                        <option value={3}>3 (Neutral)</option>
                        <option value={4}>4 (Positive)</option>
                        <option value={5}>5 (Very positive)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reviewText" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Customer Review Text <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="reviewText"
                      value={formValues.reviewText}
                      onChange={(e) => updateFormValue("reviewText", e.target.value)}
                      rows={6}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Paste the full customer review here…"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="customerName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Customer Name (Optional)
                    </label>
                    <input
                      type="text"
                      id="customerName"
                      value={formValues.customerName}
                      onChange={(e) => updateFormValue("customerName", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="If provided, the AI may address the reviewer by name"
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      If provided, the AI may address the reviewer by name.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Response Strategy */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("responseStrategy")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Response Strategy
                  </h3>
                  {!accordionState.responseStrategy && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getResponseStrategySummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("responseStrategy");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                  title={accordionState.responseStrategy ? "Collapse section" : "Expand section"}
                >
                  {accordionState.responseStrategy ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.responseStrategy && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="responseLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Response Length
                      </label>
                      <select
                        id="responseLength"
                        value={formValues.responseLength}
                        onChange={(e) => updateFormValue("responseLength", e.target.value as ReviewResponderFormValues["responseLength"])}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Short">Short</option>
                        <option value="Medium">Medium</option>
                        <option value="Long">Long</option>
                      </select>
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                        Choose a length that fits the platform and the situation.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="responseGoal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Response Goal (Optional)
                      </label>
                      <input
                        type="text"
                        id="responseGoal"
                        value={formValues.responseGoal}
                        onChange={(e) => updateFormValue("responseGoal", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Example: Recover trust, apologize, invite them back"
                      />
                      <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                        Helps the reply focus on your intent (thank, recover, invite, clarify).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Voice & Tone */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("voiceTone")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Voice &amp; Tone
                  </h3>
                  {!accordionState.voiceTone && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getVoiceToneSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("voiceTone");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                  title={accordionState.voiceTone ? "Collapse section" : "Expand section"}
                >
                  {accordionState.voiceTone ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.voiceTone && (
                <div className="p-4 space-y-4">
                  <div>
                    <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Brand Voice (Optional)
                    </label>
                    <textarea
                      id="brandVoice"
                      value={formValues.brandVoice}
                      onChange={(e) => {
                        updateFormValue("brandVoice", e.target.value);
                      }}
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Example: Warm and family-friendly, professional and clinical, fun and high-energy"
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Paste 2–4 sentences that sound like your brand (website, brochure, etc.).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Personality Style
                      </label>
                      <select
                        id="personalityStyle"
                        value={formValues.personalityStyle}
                        onChange={(e) => {
                          updateFormValue("personalityStyle", e.target.value as ReviewResponderFormValues["personalityStyle"]);
                        }}
                        className={getInputClasses(isDark)}
                      >
                        <option value="None">None</option>
                        <option value="Soft">Soft</option>
                        <option value="Bold">Bold</option>
                        <option value="High-Energy">High-Energy</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Language
                      </label>
                      <select
                        id="language"
                        value={formValues.language}
                        onChange={(e) => updateFormValue("language", e.target.value as ReviewResponderFormValues["language"])}
                        className={getInputClasses(isDark)}
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="Bilingual">Bilingual</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Enhancements */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("optionalEnhancements")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Optional Enhancements
                  </h3>
                  {!accordionState.optionalEnhancements && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getOptionalEnhancementsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("optionalEnhancements");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                  title={accordionState.optionalEnhancements ? "Collapse section" : "Expand section"}
                >
                  {accordionState.optionalEnhancements ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.optionalEnhancements && (
                <div className="p-4 space-y-2">
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeQnaBox}
                      onChange={(e) => updateFormValue("includeQnaBox", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include Q&amp;A box suggestions</span>
                  </label>

                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeMetaDescription}
                      onChange={(e) => updateFormValue("includeMetaDescription", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include a meta description for SEO</span>
                  </label>

                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={formValues.includeStoryVersion}
                      onChange={(e) => updateFormValue("includeStoryVersion", e.target.checked)}
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                    />
                    <span className="text-sm">Include a storytelling version (longer narrative reply)</span>
                  </label>
                </div>
              )}
            </div>

          </div>
          
          <OBDStickyActionBar
            isDark={isDark}
            left={
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                    outputStatus !== "Draft"
                      ? isDark
                        ? "bg-slate-800/40 border-slate-700 text-slate-200"
                        : "bg-white border-slate-200 text-slate-700"
                      : isDark
                        ? "bg-slate-900/30 border-slate-800 text-slate-300"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                  title={outputStatusTitle}
                >
                  {outputStatus}
                </span>

                <button
                  type="button"
                  onClick={resetInputsToDefaults}
                  disabled={isAtDefaultInputs}
                  title={
                    isAtDefaultInputs
                      ? "Already at defaults."
                      : "Reset inputs back to defaults. (Generated drafts are not changed.)"
                  }
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  Reset inputs
                </button>

                <button
                  type="button"
                  onClick={resetAllEdits}
                  disabled={!hasEditedOutputs}
                  title={
                    hasEditedOutputs
                      ? "Reset all edits back to the latest generated version."
                      : "No edits to reset."
                  }
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  Reset edits
                </button>

                <button
                  type="button"
                  onClick={clearOutputs}
                  disabled={activeResponses.length === 0}
                  title={
                    activeResponses.length > 0
                      ? "Clear all generated/edited drafts."
                      : "No outputs to clear."
                  }
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  Clear outputs
                </button>
              </div>
            }
          >
            <button
              type="submit"
              disabled={isLoading || !formValues.businessName.trim() || !formValues.businessType.trim() || !formValues.reviewText.trim()}
              className={SUBMIT_BUTTON_CLASSES}
              title={
                !formValues.businessName.trim() || !formValues.businessType.trim() || !formValues.reviewText.trim()
                  ? "Fill in business name, business type, and review text to generate."
                  : activeResponses.length > 0
                    ? "Regenerate updates unedited drafts only. Your edits are preserved."
                    : "Generate a draft response from the current inputs."
              }
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                activeResponses.length > 0 ? "Regenerate" : "Generate"
              )}
            </button>

            <button
              type="button"
              onClick={handleScrollToExport}
              disabled={activeResponses.length === 0 || isLoading}
              className={getSecondaryButtonClasses(isDark)}
              title={
                isLoading
                  ? "Please wait for generation to finish."
                  : activeResponses.length > 0
                    ? "Jump to Export / Next Steps."
                    : "Generate a draft to enable export and next steps."
              }
            >
              Export / Next Steps
            </button>
          </OBDStickyActionBar>
        </form>
      </OBDPanel>

      {/* Results section */}
      <OBDResultsPanel
        title="Generated Responses"
        isDark={isDark}
        loading={isLoading}
        loadingText="Generating review responses..."
        emptyTitle="No responses yet"
        emptyDescription="Fill out the form above and click &quot;Generate&quot; to create your review responses."
        className="mt-8"
      >
        {error && !isLoading ? (
          <div className={getErrorPanelClasses(isDark)} role="alert" aria-live="polite">
            <p className="font-medium mb-2">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : activeResponses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeResponses.map((item) => {
              const isEditing = editingId === item.id;
              const isEdited = Boolean((item.editedText || "").trim());
              const activeText = getActiveResponseText(item);
              const isExplainOpen = Boolean(explainOpenById[item.id]);
              const hasExplanation =
                item.explanationStatus === "generated" &&
                Array.isArray(item.explanation) &&
                item.explanation.length > 0;
              const platformLabel =
                item.platform === "google"
                  ? "Google"
                  : item.platform === "facebook"
                    ? "Facebook"
                    : item.platform === "obd"
                      ? "OBD"
                      : "Other";

              return (
                <div
                  key={item.id}
                  onKeyDown={(e) => {
                    // Tier 6-4: Ctrl/Cmd+Shift+C copies active response when focus is inside this card.
                    // Scoped to this card only (events bubble from child elements).
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
                      e.preventDefault();
                      const text = (isEditing ? editingValue : getActiveResponseText(item)).trim();
                      if (!text) return;
                      handleCopy(text);
                      showToast("Copied.");
                    }
                  }}
                  className={`rounded-xl border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {RESPONSE_KIND_LABEL[item.kind]}
                        </h3>
                        {isEdited && (
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                              isDark
                                ? "bg-emerald-900/20 border-emerald-700 text-emerald-300"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}
                            title="Edited draft (edited > generated)."
                          >
                            Edited
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            isDark
                              ? "bg-slate-900/30 border-slate-800 text-slate-300"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                          title="Source platform for this reply."
                        >
                          {platformLabel}
                        </span>
                      </div>
                      {item.length || item.tone ? (
                        <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          {item.length ? `Length: ${item.length}` : null}
                          {item.length && item.tone ? " • " : null}
                          {item.tone ? `Tone: ${item.tone}` : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingValue(activeText);
                            }}
                            className={getSubtleButtonMediumClasses(isDark)}
                            title="Edit this draft reply."
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const text = getActiveResponseText(item);
                              handleCopy(text);
                              showToast("Copied.");
                            }}
                            className={getSubtleButtonMediumClasses(isDark)}
                            title="Copy the active text (edited > generated)."
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResponseItems((prev) =>
                                prev.map((x) =>
                                  x.id !== item.id
                                    ? x
                                    : {
                                        ...x,
                                        editedText: undefined,
                                        status: "generated",
                                        updatedAt: new Date().toISOString(),
                                        // Active text changes; clear one-shot explanation to avoid stale rationale.
                                        explanation: undefined,
                                        explanationStatus: "none",
                                      }
                                )
                              );
                              showToast("Reset to generated.");
                            }}
                            disabled={!isEdited}
                            className={getSubtleButtonMediumClasses(isDark)}
                            title={isEdited ? "Reset this reply back to the generated version." : "No edits to reset."}
                          >
                            Reset to generated
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              saveEditingValue(item.id);
                            }}
                            className={getSubtleButtonMediumClasses(isDark)}
                            title="Save your edit (local only)."
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              cancelEditing();
                            }}
                            className={getSubtleButtonMediumClasses(isDark)}
                            title="Cancel editing without saving."
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={`mt-3 text-sm ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                    {isEditing ? (
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          // Tier 6-4: Keyboard shortcuts scoped to the editor only.
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEditing();
                            showToast("Canceled.");
                            return;
                          }
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            saveEditingValue(item.id);
                          }
                        }}
                        rows={10}
                        className={getInputClasses(isDark, "resize-none")}
                        aria-label={`Edit ${RESPONSE_KIND_LABEL[item.kind]}`}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{activeText}</p>
                    )}
                  </div>

                  {isEditing ? (
                    <div className={`mt-2 text-[11px] ${themeClasses.mutedText}`}>
                      Save: Ctrl/⌘+Enter • Cancel: Esc
                    </div>
                  ) : null}

                  {/* Tier 6-2: Explain Mode (one-shot, optional) */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleExplain(item.id)}
                      className={getSubtleButtonMediumClasses(isDark)}
                      title="Toggle explanation panel (does not affect export)."
                    >
                      {isExplainOpen ? "Hide why this works" : "Show why this works"}
                    </button>
                  </div>

                  {isExplainOpen ? (
                    <div
                      className={`mt-3 rounded-lg border p-3 ${
                        isDark ? "bg-slate-900/20 border-slate-800" : "bg-white border-slate-200"
                      }`}
                      role="note"
                      aria-label="Why this reply works"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className={`text-xs font-semibold ${themeClasses.labelText}`}>Why this reply works</div>
                          <div className={`text-[11px] mt-1 ${themeClasses.mutedText}`}>
                            Generated once from the current text. Edits won’t update it unless you regenerate.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => generateExplanationForItem(item)}
                          disabled={
                            isEditing ||
                            Boolean(explainLoadingId) ||
                            !getActiveResponseText(item).trim()
                          }
                          className={getSubtleButtonMediumClasses(isDark)}
                          title={
                            isEditing
                              ? "Save or cancel your edit first."
                              : explainLoadingId
                                ? "Generating explanation..."
                                : hasExplanation
                                  ? "Regenerate explanation from the current active text."
                                  : "Generate explanation from the current active text."
                          }
                        >
                          {explainLoadingId === item.id
                            ? "Generating..."
                            : hasExplanation
                              ? "Regenerate explanation"
                              : "Generate explanation"}
                        </button>
                      </div>

                      {hasExplanation ? (
                        <ul className={`mt-3 list-disc pl-5 text-xs ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          {item.explanation!.map((b, idx) => (
                            <li key={`${item.id}:explain:${idx}`}>{b}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className={`mt-3 text-xs ${themeClasses.mutedText}`}>
                          No explanation generated yet.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </OBDResultsPanel>

      {/* Export Center (single authority) */}
      <div ref={exportRef} id="export-center" className="mt-8">
        <OBDPanel isDark={isDark}>
          <div
            ref={exportFocusRef}
            tabIndex={-1}
            className="outline-none focus:ring-2 focus:ring-[#29c4a9]/40 rounded-lg"
            aria-label="Export Center"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>Export Center</div>
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Exports reflect your edits. Nothing is posted automatically.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSaveSnapshot}
                disabled={!businessId || !canExport || savingSnapshot || isLoading}
                className={getSecondaryButtonClasses(isDark)}
                title={
                  !businessId
                    ? "Business context is required to save history."
                    : !canExport
                      ? "Generate at least one draft to enable history."
                      : savingSnapshot
                        ? "Saving snapshot..."
                        : "Save a read-only snapshot of the current drafts (nothing is posted automatically)."
                }
              >
                {savingSnapshot ? "Saving..." : "Save snapshot"}
              </button>
              <button
                type="button"
                onClick={handleCopyAll}
                disabled={!canExport}
                className={getSecondaryButtonClasses(isDark)}
                title={canExport ? "Copy all active responses as plain text." : "Generate a draft to enable export."}
              >
                Copy all
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={!canExport}
                className={getSecondaryButtonClasses(isDark)}
                title={canExport ? "Download a .txt file of the active responses." : "Generate a draft to enable export."}
              >
                Download .txt
              </button>
            </div>
          </div>

          {canExport ? (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {activeResponses.map((item) => {
                const platformLabel = getPlatformLabel(item.platform);
                const activeText = getActiveResponseText(item).trim();
                return (
                  <div
                    key={`export:${item.id}`}
                    className={`rounded-lg border p-3 ${
                      isDark ? "bg-slate-800/30 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                              isDark
                                ? "bg-slate-900/30 border-slate-800 text-slate-300"
                                : "bg-white border-slate-200 text-slate-600"
                            }`}
                            title="Platform label"
                          >
                            {platformLabel}
                          </span>
                          <span className={`text-xs font-semibold ${themeClasses.labelText}`}>
                            {RESPONSE_KIND_LABEL[item.kind]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            handleCopy(activeText);
                            showToast("Copied.");
                          }}
                          className={getSubtleButtonMediumClasses(isDark)}
                          title="Copy exactly what you see (edited > generated)."
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <pre
                      className={`mt-3 whitespace-pre-wrap break-words text-sm ${
                        isDark ? "text-slate-100" : "text-slate-700"
                      }`}
                      aria-label={`Export block: ${platformLabel} ${RESPONSE_KIND_LABEL[item.kind]}`}
                    >
                      {activeText}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                isDark ? "bg-slate-900/20 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
              }`}
              role="note"
            >
              <div className="text-sm font-medium">Nothing to export yet</div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Generate at least one draft to enable Copy/Download.
              </div>
            </div>
          )}

          {/* Tier 6-1: Response History (snapshot-only, read-only) */}
          <div className="mt-8">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${themeClasses.headingText}`}>History</div>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  History is read-only. Snapshots don’t post or send anything.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={!businessId || historyLoading}
                  className={getSubtleButtonMediumClasses(isDark)}
                  title={!businessId ? "Business context is required to view history." : "Refresh snapshot list."}
                >
                  {historyLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {!businessId ? (
              <div
                className={`mt-4 rounded-lg border p-3 ${
                  isDark ? "bg-slate-900/20 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                }`}
                role="note"
              >
                <div className="text-sm font-medium">Business context required</div>
                <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Open this tool from a business-scoped link to enable history snapshots.
                </div>
              </div>
            ) : historyError ? (
              <div className={getErrorPanelClasses(isDark)} role="alert" aria-live="polite">
                <p className="font-medium mb-2">History unavailable</p>
                <p className="text-sm">{historyError}</p>
              </div>
            ) : historyItems.length === 0 ? (
              <div
                className={`mt-4 rounded-lg border p-3 ${
                  isDark ? "bg-slate-900/20 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                }`}
                role="note"
              >
                <div className="text-sm font-medium">No snapshots yet</div>
                <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Use “Save snapshot” to store a read-only record of your current drafts.
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {historyItems.map((s) => {
                    const isSelected = selectedSnapshotId === s.id;
                    const createdLabel = (() => {
                      try {
                        return new Date(s.createdAt).toLocaleString();
                      } catch {
                        return s.createdAt;
                      }
                    })();

                    const rating = typeof s.inputSummary?.reviewRating === "number" ? `${s.inputSummary.reviewRating}★` : "";
                    const platform = s.inputSummary?.platform ? String(s.inputSummary.platform) : "";
                    const summaryParts = [platform, rating].filter(Boolean).join(" • ");

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => loadSnapshot(s.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? isDark
                              ? "bg-slate-800/70 border-[#29c4a9]/60"
                              : "bg-slate-50 border-[#29c4a9]/60"
                            : isDark
                              ? "bg-slate-900/20 border-slate-800 hover:bg-slate-800/40"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                        aria-current={isSelected ? "true" : undefined}
                        title="View snapshot (read-only)."
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`text-sm font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                              {createdLabel}
                            </div>
                            <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                              {s.counts.responsesCount} draft{s.counts.responsesCount === 1 ? "" : "s"}
                              {s.counts.editedCount ? ` • ${s.counts.editedCount} edited` : ""}
                              {s.counts.platformCount ? ` • ${s.counts.platformCount} platform${s.counts.platformCount === 1 ? "" : "s"}` : ""}
                              {summaryParts ? ` • ${summaryParts}` : ""}
                            </div>
                          </div>
                          <div className={`text-[11px] ${themeClasses.mutedText}`}>Read-only</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  {snapshotLoading ? (
                    <div
                      className={`rounded-lg border p-3 ${
                        isDark ? "bg-slate-900/20 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      Loading snapshot…
                    </div>
                  ) : selectedSnapshot ? (
                    <div
                      className={`rounded-lg border p-3 ${
                        isDark ? "bg-slate-900/20 border-slate-800" : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold ${themeClasses.headingText}`}>Snapshot</div>
                          <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                            Read-only view • Nothing is posted automatically.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSnapshotId(null);
                            setSelectedSnapshot(null);
                          }}
                          className={getSubtleButtonMediumClasses(isDark)}
                          title="Close snapshot view."
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {(Array.isArray(selectedSnapshot.responses) ? selectedSnapshot.responses : []).map((r) => {
                          const platformLabel = getPlatformLabel(r.platform);
                          const label = RESPONSE_KIND_LABEL[r.kind];
                          return (
                            <div
                              key={`${selectedSnapshot.id}:${r.platform}:${r.kind}`}
                              className={`rounded-lg border p-3 ${
                                isDark ? "bg-slate-800/30 border-slate-700" : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                                        isDark
                                          ? "bg-slate-900/30 border-slate-800 text-slate-300"
                                          : "bg-white border-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {platformLabel}
                                    </span>
                                    <span className={`text-xs font-semibold ${themeClasses.labelText}`}>{label}</span>
                                    {r.status === "edited" ? (
                                      <span
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                                          isDark
                                            ? "bg-emerald-900/20 border-emerald-700 text-emerald-300"
                                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        }`}
                                        title="Edited at time of snapshot."
                                      >
                                        Edited
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCopy((r.activeText || "").trim());
                                    showToast("Copied.");
                                  }}
                                  className={getSubtleButtonMediumClasses(isDark)}
                                  title="Copy from snapshot (manual paste/post)."
                                >
                                  Copy from snapshot
                                </button>
                              </div>
                              <pre
                                className={`mt-3 whitespace-pre-wrap break-words text-sm ${
                                  isDark ? "text-slate-100" : "text-slate-700"
                                }`}
                              >
                                {(r.activeText || "").trim()}
                              </pre>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-lg border p-3 ${
                        isDark ? "bg-slate-900/20 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                      }`}
                      role="note"
                    >
                      <div className="text-sm font-medium">Select a snapshot</div>
                      <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Click a snapshot on the left to view it read-only.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

            <div className="mt-6">
              <EcosystemNextSteps
                title="Next steps"
                description="Links only — no data is transferred automatically."
                steps={[
                  {
                    id: "reputation-dashboard",
                    label: "Reputation Dashboard",
                    description: "Seeing repeated themes? The Reputation Dashboard helps spot patterns over time.",
                    href: "/apps/reputation-dashboard",
                    cta: "Open Dashboard",
                  },
                  {
                    id: "crm",
                    label: "OBD CRM",
                    description: "If you want to log this interaction, store it in OBD CRM.",
                    href: "/apps/obd-crm",
                    cta: "Open CRM",
                  },
                ]}
                dismissKey="tier5c-review-responder-next-steps"
                isDark={isDark}
              />
            </div>
          </div>
        </OBDPanel>
      </div>
    </OBDPageContainer>
  );
}
