"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
} from "@/lib/obd-framework/layout-helpers";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import {
  buildAiLogoToSocialHandoffPayload,
  buildAiLogoToBrandKitPayload,
  buildAiLogoToHelpDeskPayload,
  storeAiLogoToBrandKitHandoff,
  storeAiLogoToHelpDeskHandoff,
  writeAiLogoToSocialAutoPosterHandoff,
} from "./logo-handoff";
import type {
  LogoGeneratorRequest,
  LogoGeneratorResponse,
  PersonalityStyle,
  LogoStyle,
} from "./types";
import LogoPreviewModal from "./components/LogoPreviewModal";

type LogoGeneratorClientProps = {
  initialDefaults: LogoGeneratorRequest;
};

export default function LogoGeneratorClient({
  initialDefaults,
}: LogoGeneratorClientProps) {
  const VARIATIONS_MIN = 3;
  const VARIATIONS_MAX = 8;

  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = resolveBusinessId(searchParams);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<LogoGeneratorRequest>(initialDefaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogoGeneratorResponse | null>(null);
  const [lastPayload, setLastPayload] =
    useState<LogoGeneratorRequest | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    businessType?: string;
  }>({});
  const [usageInfo, setUsageInfo] = useState<{
    conceptsUsed: number;
    imagesUsed: number;
    conceptsLimit: number;
    imagesLimit: number;
    resetsAt: string;
  } | null>(null);
  const [showQuotaToast, setShowQuotaToast] = useState(false);
  const [clampToastMessage, setClampToastMessage] = useState<string | null>(null);
  const [countUsed, setCountUsed] = useState<number | null>(null);
  const [handoffToastMessage, setHandoffToastMessage] = useState<string | null>(null);
  const [editToastMessage, setEditToastMessage] = useState<string | null>(null);
  const [exportToastMessage, setExportToastMessage] = useState<string | null>(null);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkExportProgress, setBulkExportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [bulkExportSummary, setBulkExportSummary] = useState<{
    exportedAt: string;
    total: number;
    successCount: number;
    failureCount: number;
    manifestFileName: string;
  } | null>(null);

  // Tier 5B+ (UI-only): active-output scoped, stable-id driven card meta.
  type LogoCardMeta = {
    name: string;
    favorite: boolean;
    edited: {
      name: boolean;
      favorite: boolean;
    };
  };

  /**
   * Output session id makes IDs stable within the active grid, while avoiding collisions
   * across independent generations (concept IDs typically reset).
   */
  const [outputSessionId, setOutputSessionId] = useState<number>(0);
  const [logoMetaById, setLogoMetaById] = useState<Record<string, LogoCardMeta>>({});

  // Rename UX state
  const [renamingLogoId, setRenamingLogoId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextRenameBlurRef = useRef(false);

  // Preview lightbox state
  const [preview, setPreview] = useState<{
    imageUrl: string;
    alt: string;
    title: string;
  } | null>(null);
  const [previewTriggerElement, setPreviewTriggerElement] =
    useState<HTMLElement | null>(null);

  const showClampToast = (message: string) => {
    setClampToastMessage(message);
    setTimeout(() => setClampToastMessage(null), 3500);
  };

  const showHandoffToast = (message: string) => {
    setHandoffToastMessage(message);
    setTimeout(() => setHandoffToastMessage(null), 3500);
  };

  const showEditToast = (message: string) => {
    setEditToastMessage(message);
    setTimeout(() => setEditToastMessage(null), 2500);
  };

  const showExportToast = (message: string) => {
    setExportToastMessage(message);
    setTimeout(() => setExportToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!renamingLogoId) return;
    // Defer focus to ensure the input is in the DOM (React state is async).
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select?.();
    }, 0);
  }, [renamingLogoId]);

  const clampVariations = (value: number): number => {
    return Math.min(VARIATIONS_MAX, Math.max(VARIATIONS_MIN, Math.round(value)));
  };

  // Tier 5A: accordion state for input sections
  const [accordionState, setAccordionState] = useState({
    businessBasics: true,
    brandIdentity: true,
    logoOptions: true,
    outputOptions: false,
  });

  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const expandAll = () => {
    setAccordionState({
      businessBasics: true,
      brandIdentity: true,
      logoOptions: true,
      outputOptions: true,
    });
  };

  const collapseAll = () => {
    setAccordionState({
      businessBasics: true, // keep required section visible
      brandIdentity: false,
      logoOptions: false,
      outputOptions: false,
    });
  };

  const getBusinessBasicsSummary = (): string => {
    const parts: string[] = [];
    if (form.businessName.trim()) parts.push(form.businessName.trim());
    if (form.businessType.trim()) parts.push(form.businessType.trim());
    if (form.city?.trim()) parts.push(form.city.trim());
    return parts.length ? parts.join(" · ") : "Not filled";
  };

  const getBrandIdentitySummary = (): string => {
    const parts: string[] = [];
    if (form.personalityStyle) parts.push(form.personalityStyle);
    if (form.logoStyle) parts.push(form.logoStyle);
    if (form.brandVoice?.trim()) parts.push("Brand voice");
    if (form.colorPreferences?.trim()) parts.push("Colors");
    return parts.length ? parts.join(" · ") : "Default";
  };

  const getLogoOptionsSummary = (): string => {
    const parts: string[] = [];
    parts.push(
      `${clampVariations(form.variationsCount || VARIATIONS_MIN)} variations`
    );
    parts.push(form.includeText ? "Includes name" : "Icon-only");
    return parts.join(" · ");
  };

  const getOutputOptionsSummary = (): string => {
    return form.generateImages ? "Render images" : "Prompts only";
  };

  const statusLabel: "Draft" | "Generated" = result?.concepts?.length
    ? "Generated"
    : "Draft";
  const statusChip = useMemo(() => {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-xs uppercase font-semibold px-2 py-1 rounded-lg border ${
            statusLabel === "Draft"
              ? isDark
                ? "bg-slate-800 text-slate-300 border-slate-700"
                : "bg-slate-50 text-slate-700 border-slate-200"
              : isDark
                ? "bg-blue-900/30 text-blue-200 border-blue-800/50"
                : "bg-blue-50 text-blue-800 border-blue-200"
          }`}
        >
          {statusLabel}
        </span>
        <span className={`text-xs truncate ${themeClasses.mutedText}`}>
          Draft-only exports • No auto-apply • No auto-save
        </span>
      </div>
    );
  }, [isDark, statusLabel, themeClasses.mutedText]);

  function updateFormValue<K extends keyof LogoGeneratorRequest>(
    key: K,
    value: LogoGeneratorRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError(null);
    setResult(null);
    setFieldErrors({});

    // Validation with inline errors
    const errors: { businessName?: string; businessType?: string } = {};
    let hasErrors = false;

    if (!form.businessName.trim()) {
      errors.businessName = "Business name is required";
      hasErrors = true;
    }

    if (!form.businessType.trim()) {
      errors.businessType = "Business type is required";
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      // Clamp variationsCount client-side (3–8)
      const requestedVariationsRaw = form.variationsCount ?? VARIATIONS_MIN;
      const clampedVariations = clampVariations(requestedVariationsRaw);
      if (
        typeof requestedVariationsRaw === "number" &&
        Number.isFinite(requestedVariationsRaw) &&
        requestedVariationsRaw !== clampedVariations
      ) {
        showClampToast(
          `Variations adjusted to ${clampedVariations} (allowed ${VARIATIONS_MIN}–${VARIATIONS_MAX}).`
        );
      }

      const payload: LogoGeneratorRequest = {
        businessName: form.businessName.trim(),
        businessType: form.businessType.trim(),
        services: form.services?.trim() || undefined,
        city: form.city?.trim() || "Ocala",
        state: form.state?.trim() || "Florida",
        brandVoice: form.brandVoice?.trim() || undefined,
        personalityStyle: form.personalityStyle || undefined,
        logoStyle: form.logoStyle || "Modern",
        colorPreferences: form.colorPreferences?.trim() || undefined,
        includeText: form.includeText ?? true,
        variationsCount: clampedVariations,
        generateImages: form.generateImages ?? false,
      };

      setLastPayload(payload);
      setCountUsed(null);

      const res = await fetch("/api/ai-logo-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        // Handle 429 (quota exceeded) with usage info
        if (res.status === 429) {
          // Extract usage info from error response
          if (errorData.usage && errorData.limits) {
            setUsageInfo({
              conceptsUsed: errorData.usage.conceptsUsed || 0,
              imagesUsed: errorData.usage.imagesUsed || 0,
              conceptsLimit: errorData.limits.conceptsPerDay || 20,
              imagesLimit: errorData.limits.imagesPerDay || 5,
              resetsAt: errorData.resetsAt || "",
            });
          }
          // Show toast notification
          setShowQuotaToast(true);
          setTimeout(() => setShowQuotaToast(false), 5000);
          throw new Error(
            errorData.message || errorData.error || "Daily limit reached"
          );
        }

        throw new Error(
          errorData.error || errorData.message || `Server error: ${res.status}`
        );
      }

      const data: LogoGeneratorResponse & {
        countUsed?: number;
        usage?: {
          conceptsUsed: number;
          imagesUsed: number;
          conceptsLimit: number;
          imagesLimit: number;
          resetsAt: string;
        };
      } = await res.json();

      // Tier 5B+ (UI-only): reset active-grid micro state per successful generation.
      const nextSessionId = Date.now();
      setOutputSessionId(nextSessionId);
      setLogoMetaById({});
      setRenamingLogoId(null);
      setRenameDraft("");
      setPreview(null);
      setPreviewTriggerElement(null);
      setEditToastMessage(null);

      setResult(data);

      // Reflect server-side clamped count (additive)
      if (typeof data.countUsed === "number" && Number.isFinite(data.countUsed)) {
        setCountUsed(data.countUsed);
        setLastPayload((prev) =>
          prev ? { ...prev, variationsCount: data.countUsed } : prev
        );
      } else {
        setCountUsed(null);
      }

      // Update usage info from response if available
      if (data.usage) {
        setUsageInfo(data.usage);
      } else {
        setUsageInfo(null);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating logos. Please try again."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    setForm(lastPayload);
    await handleSubmit();
  };

  const handleStartNew = () => {
    setForm(initialDefaults);
    setResult(null);
    setError(null);
    setFieldErrors({});
    setLastPayload(null);
    setCopiedId(null);
    setUsageInfo(null);
    setClampToastMessage(null);
    setCountUsed(null);
    setHandoffToastMessage(null);
    setEditToastMessage(null);
    setExportToastMessage(null);
    setBulkExporting(false);
    setBulkExportProgress(null);
    setBulkExportSummary(null);
    setLogoMetaById({});
    setRenamingLogoId(null);
    setRenameDraft("");
    setPreview(null);
    setPreviewTriggerElement(null);
    setOutputSessionId(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatYyyyMmDd = (date: Date): string => {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const safeFilenameBase = (value: string): string => {
    const base = (value || "").trim();
    const normalized = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return normalized || "logo";
  };

  const inferFileExtensionFromContentType = (contentType: string | null): string => {
    const ct = (contentType || "").toLowerCase();
    if (ct.includes("image/png")) return "png";
    if (ct.includes("image/jpeg")) return "jpg";
    if (ct.includes("image/webp")) return "webp";
    if (ct.includes("image/svg+xml")) return "svg";
    return "png";
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTextFile = (filename: string, content: string) => {
    triggerDownload(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
  };

  const downloadJsonFile = (filename: string, obj: unknown) => {
    triggerDownload(
      new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" }),
      filename
    );
  };

  const getLogoId = (conceptId: string | number) => `${outputSessionId}:${String(conceptId)}`;

  const getDefaultMeta = (conceptId: string | number): LogoCardMeta => ({
    name: `Logo Concept ${conceptId}`,
    favorite: false,
    edited: { name: false, favorite: false },
  });

  const updateLogoMeta = (
    logoId: string,
    defaultMeta: LogoCardMeta,
    updater: (current: LogoCardMeta) => LogoCardMeta
  ) => {
    setLogoMetaById((prev) => {
      const current = prev[logoId] ?? defaultMeta;
      return { ...prev, [logoId]: updater(current) };
    });
  };

  const startRename = (logoId: string, currentName: string) => {
    skipNextRenameBlurRef.current = false;
    setRenamingLogoId(logoId);
    setRenameDraft(currentName);
  };

  const cancelRename = () => {
    setRenamingLogoId(null);
    setRenameDraft("");
  };

  const commitRename = (logoId: string, defaultMeta: LogoCardMeta) => {
    const next = renameDraft.trim();
    const currentName = (logoMetaById[logoId] ?? defaultMeta).name;

    if (!next) {
      // Prevent empty names: keep previous.
      showEditToast("Name can’t be empty.");
      setRenameDraft(currentName);
      // Keep editing open for quick correction.
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select?.();
      }, 0);
      return;
    }

    if (next === currentName) {
      cancelRename();
      return;
    }

    updateLogoMeta(logoId, defaultMeta, (current) => ({
      ...current,
      name: next,
      edited: { ...current.edited, name: true },
    }));
    showEditToast("Renamed.");
    cancelRename();
  };

  const toggleFavorite = (logoId: string, defaultMeta: LogoCardMeta) => {
    updateLogoMeta(logoId, defaultMeta, (current) => {
      const nextFavorite = !current.favorite;
      return {
        ...current,
        favorite: nextFavorite,
        edited: { ...current.edited, favorite: true },
      };
    });
    showEditToast("Updated favorite.");
  };

  const sortedConcepts = useMemo(() => {
    if (!result?.concepts?.length) return [];

    const entries = result.concepts.map((concept, index) => {
      const logoId = getLogoId(concept.id);
      const defaultMeta = getDefaultMeta(concept.id);
      const meta = logoMetaById[logoId] ?? defaultMeta;
      return { concept, index, logoId, defaultMeta, meta };
    });

    // Favorite-first, stable within each group (preserve original order).
    return entries
      .slice()
      .sort((a, b) => {
        if (a.meta.favorite === b.meta.favorite) return a.index - b.index;
        return a.meta.favorite ? -1 : 1;
      });
  }, [result, logoMetaById, outputSessionId]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadExport = () => {
    if (!result || !lastPayload) return;

    const slugify = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    };

    const date = new Date().toISOString().split("T")[0];
    const businessSlug = slugify(lastPayload.businessName || "logo");
    const filename = `${businessSlug}-logo-concepts-${date}.txt`;

    let content = `AI Logo Generator Export\n`;
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += `Business Information:\n`;
    content += `- Business Name: ${lastPayload.businessName}\n`;
    content += `- Business Type: ${lastPayload.businessType}\n`;
    if (lastPayload.services) content += `- Services: ${lastPayload.services}\n`;
    content += `- City: ${lastPayload.city || "Ocala"}\n`;
    content += `- State: ${lastPayload.state || "Florida"}\n`;
    if (lastPayload.brandVoice)
      content += `- Brand Voice: ${lastPayload.brandVoice}\n`;
    if (lastPayload.personalityStyle)
      content += `- Personality Style: ${lastPayload.personalityStyle}\n`;
    content += `- Logo Style: ${lastPayload.logoStyle || "Modern"}\n`;
    if (lastPayload.colorPreferences)
      content += `- Color Preferences: ${lastPayload.colorPreferences}\n`;
    content += `- Include Text: ${lastPayload.includeText ? "Yes" : "No"}\n`;
    content += `- Variations Count: ${lastPayload.variationsCount || 3}\n`;
    content += `- Images Generated: ${
      lastPayload.generateImages ? "Yes" : "No (prompts only)"
    }\n\n`;

    content += `=== LOGO CONCEPTS ===\n\n`;

    result.concepts.forEach((concept, idx) => {
      const image = result.images.find((img) => img.conceptId === concept.id);
      content += `Concept ${idx + 1}:\n`;
      content += `- Style: ${concept.styleNotes}\n`;
      content += `- Colors: ${concept.colorPalette.join(", ")}\n`;
      content += `- Description: ${concept.description}\n`;
      if (image) {
        content += `- Prompt: ${image.prompt}\n`;
        if (image.imageUrl) {
          content += `- Image URL: ${image.imageUrl}\n`;
        } else if (image.imageError) {
          content += `- Image Error: ${image.imageError}\n`;
        }
      }
      content += `\n`;
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBulkExport = async () => {
    if (bulkExporting) return;
    if (!result?.concepts?.length) return;

    // Tier 6 (fallback): selection fallback (Option A). No selection UI => export all active logos.
    setBulkExporting(true);
    setBulkExportProgress(null);
    setBulkExportSummary(null);

    try {
      const dateStr = formatYyyyMmDd(new Date());
      const manifestFileName = `OBD_AI_Logo_Generator_Manifest_${dateStr}.json`;
      const exportedAtIso = new Date().toISOString();

      const failures: Array<{
        id: string;
        name: string;
        tags: string[];
        palette: string[];
        prompt: string;
        imageUrl: string | null;
        reason: string;
      }> = [];

      const items = sortedConcepts.map(({ concept, logoId, meta }) => {
        const image = result.images.find((img) => img.conceptId === concept.id);
        const prompt = (image?.prompt || "").trim();
        const name = (meta?.name || `Logo Concept ${concept.id}`).trim();
        const safeName = safeFilenameBase(name || "logo");
        const shortId = String(concept.id).slice(-6) || "id";
        const base = `${safeName}-${shortId}`;

        return {
          conceptId: String(concept.id),
          logoId,
          name,
          base,
          imageUrl: image?.imageUrl ?? null,
          prompt,
          palette: Array.isArray(concept.colorPalette) ? concept.colorPalette : [],
          tags: (() => {
            const t: string[] = [];
            if (form.logoStyle) t.push(form.logoStyle);
            if (form.personalityStyle) t.push(form.personalityStyle);
            if (form.includeText === false) t.push("icon-only");
            if (form.generateImages === true) t.push("with-images");
            return t;
          })(),
        };
      });

      setBulkExportProgress({ current: 0, total: items.length });

      // Prompt 11 hardening: serialize downloads to avoid browser throttling / download blocking.
      const concurrency = 1;
      const interDownloadDelayMs = 200; // 150–250ms recommended
      let nextIndex = 0;
      let successCount = 0;

      const worker = async () => {
        while (true) {
          const myIndex = nextIndex;
          nextIndex += 1;
          if (myIndex >= items.length) return;

          const item = items[myIndex];

          try {
            // Prompt + palette files (always export)
            downloadTextFile(`${item.base}.prompt.txt`, item.prompt || "");
            await new Promise((r) => setTimeout(r, interDownloadDelayMs));

            downloadJsonFile(`${item.base}.palette.json`, {
              id: item.conceptId,
              name: item.name,
              tags: item.tags,
              palette: item.palette,
              prompt: item.prompt,
              imageUrl: item.imageUrl,
            });
            await new Promise((r) => setTimeout(r, interDownloadDelayMs));

            // Image download (best-effort; may be blocked by CORS or missing)
            if (item.imageUrl) {
              try {
                const res = await fetch(item.imageUrl);
                if (!res.ok) {
                  failures.push({
                    id: item.conceptId,
                    name: item.name,
                    tags: item.tags,
                    palette: item.palette,
                    prompt: item.prompt,
                    imageUrl: item.imageUrl,
                    reason: `image fetch failed (${res.status})`,
                  });
                } else {
                  const blob = await res.blob();
                  const ext = inferFileExtensionFromContentType(res.headers.get("content-type"));
                  triggerDownload(blob, `${item.base}.${ext}`);
                }
              } catch {
                failures.push({
                  id: item.conceptId,
                  name: item.name,
                  tags: item.tags,
                  palette: item.palette,
                  prompt: item.prompt,
                  imageUrl: item.imageUrl,
                  reason: "image fetch failed",
                });
              }
            } else {
              failures.push({
                id: item.conceptId,
                name: item.name,
                tags: item.tags,
                palette: item.palette,
                prompt: item.prompt,
                imageUrl: null,
                reason: "missing imageUrl",
              });
            }

            successCount += 1;
          } catch {
            failures.push({
              id: item.conceptId,
              name: item.name,
              tags: item.tags,
              palette: item.palette,
              prompt: item.prompt,
              imageUrl: item.imageUrl,
              reason: "export failed",
            });
          } finally {
            setBulkExportProgress((prev) => {
              if (!prev) return { current: 1, total: items.length };
              return { current: Math.min(prev.current + 1, prev.total), total: prev.total };
            });
            await new Promise((r) => setTimeout(r, interDownloadDelayMs));
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      // Manifest download (summarizes batch + failures)
      downloadJsonFile(manifestFileName, {
        exportedAt: exportedAtIso,
        count: items.length,
        businessId: businessId || null,
        logos: items.map((i) => ({
          id: i.conceptId,
          name: i.name,
          tags: i.tags,
          palette: i.palette,
          prompt: i.prompt,
          imageUrl: i.imageUrl,
        })),
        failures,
      });

      const failureIds = new Set(failures.map((f) => f.id));
      const failureCount = failureIds.size;
      const successCountForSummary = Math.max(0, items.length - failureCount);
      setBulkExportSummary({
        exportedAt: exportedAtIso,
        total: items.length,
        successCount: successCountForSummary,
        failureCount,
        manifestFileName,
      });

      if (failures.length > 0) {
        showExportToast(`Exported ${successCount}/${items.length} logos (some failed).`);
      } else {
        showExportToast(`Exported ${items.length} logos.`);
      }
    } catch (err) {
      console.error("Bulk export failed:", err);
      showEditToast("Bulk export failed. Please try again.");
    } finally {
      setBulkExporting(false);
      setBulkExportProgress(null);
    }
  };

  const canSendToSocial = !!result?.concepts?.length && !!businessId;

  /**
   * Tier 5C Integration Note (Selection Fallback)
   * ---------------------------------------------
   * The Social Auto-Poster handoff sender needs a list of “selected” logos.
   * Full multi-select + bulk selection UX is implemented in Tier 5B.
   *
   * Until Tier 5B selection exists, we use an integration-safe fallback:
   * - If there is no explicit selection UI/state, we treat ALL logos in the active version set
   *   as selected for the purpose of sending to Social Auto-Poster.
   *
   * This is intentionally NOT Tier 5B bulk selection:
   * - No bulk edit actions
   * - No rename/favorite coupling
   * - No persisted selection state
   *
   * When Tier 5B lands, replace this fallback with canonical selection
   * derived from LogoItem[] + stable IDs (see logo-state.ts helpers).
   */
  const handleSendToSocialAutoPoster = () => {
    if (!result?.concepts?.length) return;
    if (!businessId) return;

    const tags: string[] = [];
    if (form.logoStyle) tags.push(form.logoStyle);
    if (form.personalityStyle) tags.push(form.personalityStyle);
    if (form.includeText === false) tags.push("icon-only");
    if (form.generateImages === true) tags.push("with-images");

    const logos = result.concepts.map((concept) => {
      const image = result.images.find((img) => img.conceptId === concept.id);
      const prompt = (image?.prompt || "").trim();
      const localName = logoMetaById[getLogoId(concept.id)]?.name?.trim();
      return {
        id: String(concept.id),
        name: localName || `Logo Concept ${concept.id}`,
        prompt,
        tags,
        palette: Array.isArray(concept.colorPalette) ? concept.colorPalette : [],
        imageUrl: image?.imageUrl ?? null,
      };
    });

    const payload = buildAiLogoToSocialHandoffPayload({
      businessId,
      logos,
    });
    writeAiLogoToSocialAutoPosterHandoff(payload);

    showHandoffToast(
      `Sent ${logos.length} logo(s) to Social Auto-Poster (draft).`
    );

    // Navigate after a brief tick so the toast can render before route change.
    setTimeout(() => {
      router.push(
        `/apps/social-auto-poster/composer?handoff=1&businessId=${encodeURIComponent(
          businessId
        )}`
      );
    }, 150);
  };

  const handleSendToBrandKitBuilder = () => {
    if (!result?.concepts?.length) return;
    if (!businessId) return;

    const tags: string[] = [];
    if (form.logoStyle) tags.push(form.logoStyle);
    if (form.personalityStyle) tags.push(form.personalityStyle);
    if (form.includeText === false) tags.push("icon-only");
    if (form.generateImages === true) tags.push("with-images");

    const logos = result.concepts.map((concept) => {
      const image = result.images.find((img) => img.conceptId === concept.id);
      const prompt = (image?.prompt || "").trim();
      const localName = logoMetaById[getLogoId(concept.id)]?.name?.trim();
      return {
        id: String(concept.id),
        name: localName || `Logo Concept ${concept.id}`,
        prompt,
        tags,
        palette: Array.isArray(concept.colorPalette) ? concept.colorPalette : [],
        imageUrl: image?.imageUrl ?? null,
      };
    });

    const payload = buildAiLogoToBrandKitPayload({
      businessId,
      logos,
    });
    storeAiLogoToBrandKitHandoff(payload);

    showHandoffToast(`Sent ${logos.length} logo(s) to Brand Kit Builder (draft).`);

    setTimeout(() => {
      router.push(
        `/apps/brand-kit-builder?handoff=1&businessId=${encodeURIComponent(businessId)}`
      );
    }, 150);
  };

  const handleSuggestForHelpDeskIcon = () => {
    if (!result?.concepts?.length) return;
    if (!businessId) return;

    const tags: string[] = [];
    if (form.logoStyle) tags.push(form.logoStyle);
    if (form.personalityStyle) tags.push(form.personalityStyle);
    if (form.includeText === false) tags.push("icon-only");
    if (form.generateImages === true) tags.push("with-images");

    const logos = result.concepts.map((concept) => {
      const image = result.images.find((img) => img.conceptId === concept.id);
      const prompt = (image?.prompt || "").trim();
      const localName = logoMetaById[getLogoId(concept.id)]?.name?.trim();
      return {
        id: String(concept.id),
        name: localName || `Logo Concept ${concept.id}`,
        prompt,
        tags,
        palette: Array.isArray(concept.colorPalette) ? concept.colorPalette : [],
        imageUrl: image?.imageUrl ?? null,
      };
    });

    const payload = buildAiLogoToHelpDeskPayload({
      businessId,
      logos,
    });
    storeAiLogoToHelpDeskHandoff(payload);

    showHandoffToast(`Sent ${logos.length} logo(s) to AI Help Desk (draft).`);

    setTimeout(() => {
      router.push(
        `/apps/ai-help-desk?tab=widget&handoff=1&businessId=${encodeURIComponent(businessId)}`
      );
    }, 150);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Logo Generator"
      tagline="Create professional logo concepts and designs tailored to your Ocala business."
    >
      {/* How this tool works */}
      <div
        className={`rounded-xl border p-4 mb-6 ${
          isDark
            ? "bg-slate-800/50 border-slate-700"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <h3
          className={`text-sm font-semibold mb-2 ${
            isDark ? "text-slate-200" : "text-slate-700"
          }`}
        >
          How this tool works
        </h3>
        <p className={`text-sm ${themeClasses.mutedText}`}>
          Generates professional logo concepts, styles, color palettes, and
          AI-ready prompts you can use in any image generator.
        </p>
        <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
          Turn on &quot;Generate Images (slower)&quot; to also render logo
          images inside this tool.
        </p>
      </div>

      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
            <div className="space-y-6">
              {/* Accordion controls */}
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={expandAll}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    isDark
                      ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    isDark
                      ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-100"
                  }`}
                  title="Collapse inputs (keeps Business Basics open)"
                >
                  Collapse
                </button>
              </div>

              {/* Business Basics */}
              <div
                className={`rounded-xl border ${
                  isDark
                    ? "border-slate-700 bg-slate-800/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <OBDHeading level={2} isDark={isDark} className="!text-sm !mb-0">
                      Business Basics
                    </OBDHeading>
                    {!accordionState.businessBasics && (
                      <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                        {getBusinessBasicsSummary()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccordion("businessBasics")}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {accordionState.businessBasics ? "Collapse" : "Expand"}
                  </button>
                </div>
                {accordionState.businessBasics && (
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <label
                        htmlFor="businessName"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Business Name <span className="text-red-500">*</span>
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
                      {fieldErrors.businessName && (
                        <p
                          className={`mt-1 text-xs ${
                            isDark ? "text-red-400" : "text-red-600"
                          }`}
                        >
                          {fieldErrors.businessName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="businessType"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Business Type <span className="text-red-500">*</span>
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
                      {fieldErrors.businessType && (
                        <p
                          className={`mt-1 text-xs ${
                            isDark ? "text-red-400" : "text-red-600"
                          }`}
                        >
                          {fieldErrors.businessType}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="services"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Services (Optional)
                      </label>
                      <textarea
                        id="services"
                        value={form.services}
                        onChange={(e) =>
                          updateFormValue("services", e.target.value)
                        }
                        rows={3}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="Describe your main services or products..."
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
                          onChange={(e) =>
                            updateFormValue("city", e.target.value)
                          }
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
                          onChange={(e) =>
                            updateFormValue("state", e.target.value)
                          }
                          className={getInputClasses(isDark)}
                          placeholder="Florida"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Identity */}
              <div
                className={`rounded-xl border ${
                  isDark
                    ? "border-slate-700 bg-slate-800/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <OBDHeading level={2} isDark={isDark} className="!text-sm !mb-0">
                      Brand Identity
                    </OBDHeading>
                    {!accordionState.brandIdentity && (
                      <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                        {getBrandIdentitySummary()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccordion("brandIdentity")}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {accordionState.brandIdentity ? "Collapse" : "Expand"}
                  </button>
                </div>
                {accordionState.brandIdentity && (
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <label
                        htmlFor="brandVoice"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Brand Voice (Optional)
                      </label>
                      <textarea
                        id="brandVoice"
                        value={form.brandVoice}
                        onChange={(e) =>
                          updateFormValue("brandVoice", e.target.value)
                        }
                        rows={2}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="Describe your brand voice (e.g., warm, professional, playful)"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="personalityStyle"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Personality Style (Optional)
                      </label>
                      <select
                        id="personalityStyle"
                        value={form.personalityStyle || ""}
                        onChange={(e) =>
                          updateFormValue(
                            "personalityStyle",
                            e.target.value as PersonalityStyle | ""
                          )
                        }
                        className={getInputClasses(isDark)}
                      >
                        <option value="">No specific style</option>
                        <option value="Soft">Soft</option>
                        <option value="Bold">Bold</option>
                        <option value="High-Energy">High-Energy</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="logoStyle"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Logo Style
                      </label>
                      <select
                        id="logoStyle"
                        value={form.logoStyle}
                        onChange={(e) =>
                          updateFormValue("logoStyle", e.target.value as LogoStyle)
                        }
                        className={getInputClasses(isDark)}
                      >
                        <option value="Modern">Modern</option>
                        <option value="Classic">Classic</option>
                        <option value="Minimalist">Minimalist</option>
                        <option value="Vintage">Vintage</option>
                        <option value="Playful">Playful</option>
                        <option value="Professional">Professional</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="colorPreferences"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Color Preferences (Optional)
                      </label>
                      <input
                        type="text"
                        id="colorPreferences"
                        value={form.colorPreferences}
                        onChange={(e) =>
                          updateFormValue("colorPreferences", e.target.value)
                        }
                        className={getInputClasses(isDark)}
                        placeholder="e.g., Blue and green, warm colors, neutral tones"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Logo Options */}
              <div
                className={`rounded-xl border ${
                  isDark
                    ? "border-slate-700 bg-slate-800/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <OBDHeading level={2} isDark={isDark} className="!text-sm !mb-0">
                      Logo Options
                    </OBDHeading>
                    {!accordionState.logoOptions && (
                      <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                        {getLogoOptionsSummary()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccordion("logoOptions")}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {accordionState.logoOptions ? "Collapse" : "Expand"}
                  </button>
                </div>
                {accordionState.logoOptions && (
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <label
                        htmlFor="variationsCount"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Number of Variations (3–8)
                      </label>
                      <input
                        type="number"
                        id="variationsCount"
                        value={form.variationsCount}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value, 10);
                          const requested = Number.isFinite(raw) ? raw : VARIATIONS_MIN;
                          const clamped = clampVariations(requested);
                          updateFormValue("variationsCount", clamped);
                          if (Number.isFinite(raw) && raw !== clamped) {
                            showClampToast(
                              `Variations adjusted to ${clamped} (allowed ${VARIATIONS_MIN}–${VARIATIONS_MAX}).`
                            );
                          }
                        }}
                        min={VARIATIONS_MIN}
                        max={VARIATIONS_MAX}
                        className={getInputClasses(isDark)}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={form.includeText ?? true}
                          onChange={(e) =>
                            updateFormValue("includeText", e.target.checked)
                          }
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm">Include business name in logo</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Output Options */}
              <div
                className={`rounded-xl border ${
                  isDark
                    ? "border-slate-700 bg-slate-800/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <OBDHeading level={2} isDark={isDark} className="!text-sm !mb-0">
                      Output Options
                    </OBDHeading>
                    {!accordionState.outputOptions && (
                      <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                        {getOutputOptionsSummary()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccordion("outputOptions")}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {accordionState.outputOptions ? "Collapse" : "Expand"}
                  </button>
                </div>
                {accordionState.outputOptions && (
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                        <input
                          type="checkbox"
                          checked={form.generateImages ?? false}
                          onChange={(e) =>
                            updateFormValue("generateImages", e.target.checked)
                          }
                          className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                        />
                        <span className="text-sm font-medium">Generate Images (slower)</span>
                      </label>
                      <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                        Off = generate logo concepts + prompts only. On = also render images.
                      </p>
                    </div>
                    {usageInfo && (
                      <div
                        className={`text-xs ${themeClasses.mutedText} pt-2 border-t ${
                          isDark ? "border-slate-700" : "border-slate-200"
                        }`}
                      >
                        Usage today: Concepts {usageInfo.conceptsUsed}/{usageInfo.conceptsLimit},
                        Images {usageInfo.imagesUsed}/{usageInfo.imagesLimit}
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          Resets at midnight UTC.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inline error (keeps sticky bar clean) */}
              {error && (
                <div className={getErrorPanelClasses(isDark)}>
                  <p className="font-medium mb-2">Error:</p>
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>

          <OBDStickyActionBar isDark={isDark} left={statusChip}>
            <button
              type="submit"
              disabled={loading || !form.businessName.trim() || !form.businessType.trim()}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={loading || !lastPayload}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={!lastPayload ? "Generate first" : "Regenerate with same settings"}
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleDownloadExport}
              disabled={loading || !result || !lastPayload}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={!result ? "Generate first" : "Export all concepts"}
            >
              Export
            </button>
            <button
              type="button"
              onClick={handleBulkExport}
              disabled={loading || !result?.concepts?.length || bulkExporting}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={!result?.concepts?.length ? "Generate first" : "Export all logos as ZIP"}
            >
              {bulkExporting && bulkExportProgress
                ? `Exporting ${bulkExportProgress.current}/${bulkExportProgress.total}…`
                : bulkExporting
                  ? "Exporting…"
                  : "Bulk Export"}
            </button>
            <button
              type="button"
              onClick={handleSendToBrandKitBuilder}
              disabled={!canSendToSocial || loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={
                !businessId
                  ? "Business context required (missing businessId)"
                  : "Send logos to Brand Kit Builder (draft suggestion)"
              }
            >
              Send to Brand Kit Builder
            </button>
            <button
              type="button"
              onClick={handleSuggestForHelpDeskIcon}
              disabled={!canSendToSocial || loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={
                !businessId
                  ? "Business context required (missing businessId)"
                  : "Suggest logo(s) for Help Desk assistant icon (draft-only)"
              }
            >
              Suggest for Help Desk Icon
            </button>
            <button
              type="button"
              onClick={handleSendToSocialAutoPoster}
              disabled={!canSendToSocial || loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={
                !businessId
                  ? "Business context required (missing businessId)"
                  : "Send logos to Social Auto-Poster (draft-only)"
              }
            >
              Send to Social Auto-Poster
            </button>
            <button
              type="button"
              onClick={handleStartNew}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title="Reset form and clear results"
            >
              Start New
            </button>
          </OBDStickyActionBar>
        </form>
      </OBDPanel>

      {bulkExportSummary && !bulkExporting && (
        <OBDPanel isDark={isDark} className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
                Export complete
              </p>
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Success:{" "}
                <span
                  className={`font-medium ${
                    isDark ? "text-emerald-300" : "text-emerald-800"
                  }`}
                >
                  {bulkExportSummary.successCount}
                </span>
                {" · "}
                Failed:{" "}
                <span
                  className={`font-medium ${
                    bulkExportSummary.failureCount > 0
                      ? isDark
                        ? "text-amber-300"
                        : "text-amber-800"
                      : themeClasses.mutedText
                  }`}
                >
                  {bulkExportSummary.failureCount}
                </span>
              </p>
              <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                A manifest was downloaded ({bulkExportSummary.manifestFileName}) and contains details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBulkExportSummary(null)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              aria-label="Dismiss export completion summary"
            >
              Dismiss
            </button>
          </div>
        </OBDPanel>
      )}

      <OBDResultsPanel
        title="Generated Logos"
        subtitle="Each card is a variation you can copy and use."
        isDark={isDark}
        className="mt-8"
        loading={loading}
        loadingText={
          lastPayload?.generateImages
            ? "Generating logo concepts and images… this may take a minute."
            : "Generating logo concepts and prompts…"
        }
        emptyTitle="No logos yet"
        emptyDescription="Fill out Business Basics and click Generate to get logo concepts + prompts."
      >
        {error ? (
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
            {usageInfo && (
              <div
                className={`mt-3 pt-3 border-t ${
                  isDark ? "border-slate-700" : "border-slate-300"
                }`}
              >
                <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Daily limit reached — try again tomorrow.
                </p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Concepts: {usageInfo.conceptsUsed}/{usageInfo.conceptsLimit}, Images:{" "}
                  {usageInfo.imagesUsed}/{usageInfo.imagesLimit}
                </p>
              </div>
            )}
          </div>
        ) : result?.concepts?.length ? (
          <>
            {typeof countUsed === "number" && (
              <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
                Used {countUsed} variations.
              </p>
            )}
            {!businessId && (
              <p className={`text-xs mb-3 ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                Business context required to send (missing businessId).
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedConcepts.map(({ concept, logoId, defaultMeta, meta }) => {
                const image = result.images.find((img) => img.conceptId === concept.id);
                const hasImage = !!image?.imageUrl;
                const hasImageError = !!image?.imageError;
                const prompt = image?.prompt || "";
                const isEdited = !!(meta.edited?.name || meta.edited?.favorite);

                return (
                  <div
                    key={logoId}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isDark
                        ? "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {renamingLogoId === logoId ? (
                            <input
                              ref={renameInputRef}
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  // If we are going to close the editor (non-empty name), ignore the unmount blur.
                                  if (renameDraft.trim()) {
                                    skipNextRenameBlurRef.current = true;
                                  }
                                  commitRename(logoId, defaultMeta);
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  // Escape cancels (and the input unmount will trigger blur).
                                  skipNextRenameBlurRef.current = true;
                                  cancelRename();
                                }
                              }}
                              onBlur={() => {
                                if (skipNextRenameBlurRef.current) {
                                  skipNextRenameBlurRef.current = false;
                                  return;
                                }
                                commitRename(logoId, defaultMeta);
                              }}
                              className={`w-full text-sm font-semibold rounded-md px-2 py-1 border ${
                                isDark
                                  ? "bg-slate-900 border-slate-600 text-slate-100"
                                  : "bg-white border-slate-300 text-slate-900"
                              }`}
                              aria-label="Rename logo"
                            />
                          ) : (
                            <h4
                              className={`text-sm font-semibold truncate ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                              title={meta.name}
                            >
                              {meta.name}
                            </h4>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {isEdited && (
                              <span
                                className={`px-2 py-0.5 text-[11px] font-medium rounded-md ${
                                  isDark
                                    ? "bg-amber-600/20 text-amber-400 border border-amber-600/30"
                                    : "bg-amber-100 text-amber-700 border border-amber-200"
                                }`}
                              >
                                Edited
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(logoId, defaultMeta)}
                            className={`p-1.5 rounded-md transition-colors border ${
                              isDark
                                ? "border-slate-700 hover:bg-slate-700 text-slate-200"
                                : "border-slate-200 hover:bg-slate-100 text-slate-700"
                            }`}
                            aria-label={meta.favorite ? "Unfavorite" : "Favorite"}
                            title={meta.favorite ? "Unfavorite" : "Favorite"}
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 20 20"
                              fill={meta.favorite ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth="1.6"
                            >
                              <path d="M10 1.8l2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.7-5.2 2.7 1-5.9L1.5 8l5.9-.9L10 1.8z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (renamingLogoId === logoId) return;
                              startRename(logoId, meta.name);
                            }}
                            className={`p-1.5 rounded-md transition-colors border ${
                              isDark
                                ? "border-slate-700 hover:bg-slate-700 text-slate-200"
                                : "border-slate-200 hover:bg-slate-100 text-slate-700"
                            }`}
                            aria-label="Rename"
                            title="Rename"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5h6m-6 4h6m-6 4h6M7 5h.01M7 9h.01M7 13h.01M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v16a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        {concept.styleNotes}
                      </p>
                    </div>

                    {/* Preview */}
                    {hasImage ? (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            setPreviewTriggerElement(e.currentTarget);
                            setPreview({
                              imageUrl: image!.imageUrl!,
                              alt: `Logo concept ${concept.id}`,
                              title: meta.name,
                            });
                          }}
                          className="w-full text-left"
                          aria-label="Open preview"
                          title="Click to zoom"
                        >
                          <img
                            src={image!.imageUrl!}
                            alt={`Logo concept ${concept.id}`}
                            className="w-full h-auto rounded-lg border border-slate-300 shadow-sm"
                          />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg border p-3 mb-3 ${
                          isDark
                            ? "bg-slate-900/40 border-slate-700"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {lastPayload?.generateImages
                            ? hasImageError
                              ? `Image failed: ${image?.imageError}`
                              : "Image not available."
                            : "Prompts only (enable image generation to render here)."}
                        </p>
                      </div>
                    )}

                    {/* Palette */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium ${themeClasses.labelText}`}>Palette:</span>
                      <div className="flex gap-1">
                        {concept.colorPalette.slice(0, 6).map((color, idx) => (
                          <div
                            key={`${concept.id}-c-${idx}`}
                            className="w-5 h-5 rounded border border-slate-300"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            concept.colorPalette.join(", "),
                            `palette-${concept.id}`
                          )
                        }
                        className={`ml-auto text-xs px-2 py-1 rounded transition-colors ${
                          copiedId === `palette-${concept.id}`
                            ? "bg-[#29c4a9] text-white"
                            : isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {copiedId === `palette-${concept.id}` ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    {/* Description */}
                    <div className={`text-xs ${themeClasses.mutedText}`}>
                      <span className="font-medium">Description:</span>{" "}
                      {concept.description.length > 140
                        ? `${concept.description.slice(0, 140)}…`
                        : concept.description}
                    </div>

                    {/* Prompt */}
                    {prompt ? (
                      <div className="flex items-start gap-2 mt-2">
                        <div className={`text-xs flex-1 ${themeClasses.mutedText}`}>
                          <span className="font-medium">Prompt:</span>{" "}
                          {prompt.length > 160 ? `${prompt.slice(0, 160)}…` : prompt}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(prompt, `prompt-${concept.id}`)}
                          className={`text-xs px-2 py-1 rounded transition-colors flex-shrink-0 ${
                            copiedId === `prompt-${concept.id}`
                              ? "bg-[#29c4a9] text-white"
                              : isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          {copiedId === `prompt-${concept.id}` ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const conceptJson = JSON.stringify(
                            {
                              concept,
                              image: image?.imageUrl
                                ? { url: image.imageUrl, prompt: image.prompt }
                                : null,
                              imageError: image?.imageError,
                            },
                            null,
                            2
                          );
                          handleCopy(conceptJson, `json-${concept.id}`);
                        }}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          copiedId === `json-${concept.id}`
                            ? "bg-[#29c4a9] text-white border-transparent"
                            : isDark
                              ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                              : "border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {copiedId === `json-${concept.id}` ? "Copied!" : "Copy JSON"}
                      </button>

                      {hasImage ? (
                        <a
                          href={image!.imageUrl!}
                          download={`logo-concept-${concept.id}.png`}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            isDark
                              ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                              : "border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          Download image
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </OBDResultsPanel>

      {preview && (
        <LogoPreviewModal
          isOpen={true}
          imageUrl={preview.imageUrl}
          alt={preview.alt}
          title={preview.title}
          isDark={isDark}
          triggerElement={previewTriggerElement}
          onClose={() => {
            setPreview(null);
            setPreviewTriggerElement(null);
          }}
        />
      )}

      {/* Quota Toast */}
      {showQuotaToast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-yellow-900/90 border-yellow-700 text-yellow-100"
              : "bg-yellow-50 border-yellow-200 text-yellow-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Daily limit reached</p>
              <p className="text-sm opacity-90">
                You&apos;ve reached today&apos;s limit for this tool. Please try
                again tomorrow.
              </p>
            </div>
            <button
              onClick={() => setShowQuotaToast(false)}
              className={`ml-2 flex-shrink-0 ${
                isDark
                  ? "text-yellow-200 hover:text-yellow-100"
                  : "text-yellow-600 hover:text-yellow-800"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Clamp Toast */}
      {clampToastMessage && (
        <div
          className={`fixed ${showQuotaToast ? "top-20" : "top-4"} left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-slate-800/95 border-slate-600 text-slate-100"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Adjusted</p>
              <p className="text-sm opacity-90">{clampToastMessage}</p>
            </div>
            <button
              onClick={() => setClampToastMessage(null)}
              className={`ml-2 flex-shrink-0 ${
                isDark ? "text-slate-200 hover:text-white" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Export Toast */}
      {exportToastMessage && (
        <div
          className={`fixed ${
            showQuotaToast || clampToastMessage ? "top-36" : "top-4"
          } left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-emerald-900/90 border-emerald-700 text-emerald-100"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Exported</p>
              <p className="text-sm opacity-90">{exportToastMessage}</p>
            </div>
            <button
              onClick={() => setExportToastMessage(null)}
              className={`ml-2 flex-shrink-0 ${
                isDark
                  ? "text-emerald-200 hover:text-emerald-100"
                  : "text-emerald-700 hover:text-emerald-900"
              }`}
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Edit Toast (UI-only) */}
      {editToastMessage && (
        <div
          className={`fixed ${
            showQuotaToast || clampToastMessage || exportToastMessage ? "top-52" : "top-4"
          } left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-slate-900/95 border-slate-700 text-slate-100"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Updated</p>
              <p className="text-sm opacity-90">{editToastMessage}</p>
            </div>
            <button
              onClick={() => setEditToastMessage(null)}
              className={`ml-2 flex-shrink-0 ${
                isDark ? "text-slate-200 hover:text-white" : "text-slate-600 hover:text-slate-800"
              }`}
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Handoff Toast */}
      {handoffToastMessage && (
        <div
          className={`fixed ${
            showQuotaToast || clampToastMessage || exportToastMessage || editToastMessage ? "top-72" : "top-4"
          } left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-emerald-900/90 border-emerald-700 text-emerald-100"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Sent</p>
              <p className="text-sm opacity-90">{handoffToastMessage}</p>
            </div>
            <button
              onClick={() => setHandoffToastMessage(null)}
              className={`ml-2 flex-shrink-0 ${
                isDark
                  ? "text-emerald-200 hover:text-emerald-100"
                  : "text-emerald-700 hover:text-emerald-900"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}


