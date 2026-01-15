"use client";

import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDAccordionSection from "@/components/obd/OBDAccordionSection";
import ResultCard from "@/components/obd/ResultCard";
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
} from "@/lib/obd-framework/layout-helpers";
import {
  SchemaGeneratorRequest,
  SchemaGeneratorResponse,
} from "./types";
import {
  type SchemaDraft,
  applyAdditiveNodes,
  applyEditedSchema,
  applyGeneratedSchema,
  createSchemaDraft,
  getActiveSchemaJson,
  getDraftStatus,
  normalizeJsonString,
  resetToGenerated,
  safeJsonParse,
} from "./schemaDraft";
import ExportCenter from "./ExportCenter.tsx";
import { getExportIssues } from "./exportCenter";
import { parseSchemaGeneratorHandoff, type SchemaGeneratorHandoffPayload, parseContentWriterSchemaHandoff, type ContentWriterSchemaHandoff } from "@/lib/apps/business-schema-generator/handoff-parser";
import FAQImportBanner from "./components/FAQImportBanner";
import ContentWriterSchemaImportReadyBanner from "./components/ContentWriterSchemaImportReadyBanner";
import ContentWriterSchemaImportModal from "./components/ContentWriterSchemaImportModal";
import EcosystemNextSteps from "@/components/obd/EcosystemNextSteps";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import {
  clearHandoff,
  isTenantMatch,
  mergeNodesAdditive,
  readHandoffFromSession,
} from "./handoffReceiver";
import type { SchemaHandoffPayload } from "./handoffTypes";
import {
  getHandoffHash,
  wasHandoffAlreadyImported,
  markHandoffImported,
} from "@/lib/utils/handoff-guard";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";

const USE_BRAND_PROFILE_KEY = "obd.v3.useBrandProfile";

const BUSINESS_TYPES = [
  "LocalBusiness",
  "Restaurant",
  "Store",
  "ProfessionalService",
  "LegalService",
  "MedicalBusiness",
  "AutoRepair",
  "HomeAndGardenBusiness",
  "BeautySalon",
  "Gym",
  "RealEstateAgent",
  "AccountingService",
  "Dentist",
  "VeterinaryCare",
  "Plumber",
  "Electrician",
  "GeneralContractor",
  "AutoDealer",
  "LodgingBusiness",
  "FoodEstablishment",
];

const defaultFormValues: SchemaGeneratorRequest = {
  businessName: "",
  businessType: "LocalBusiness",
  services: [],
  city: "Ocala",
  state: "Florida",
  streetAddress: "",
  postalCode: "",
  phone: "",
  websiteUrl: "",
  googleMapsUrl: "",
  socialLinks: {
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    linkedinUrl: "",
  },
  hours: {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  },
  includeFaqSchema: false,
  includeWebPageSchema: false,
  faqs: [],
  faqTemplateMode: "none",
  pageUrl: "",
  pageTitle: "",
  pageDescription: "",
  pageType: "Homepage",
};

function BusinessSchemaGeneratorPageContent() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<SchemaGeneratorRequest>(defaultFormValues);
  const [servicesInput, setServicesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SchemaGeneratorResponse | null>(null);
  // Tier 5B: canonical, deterministic schema draft state (Generated vs Edited).
  const [draft, setDraft] = useState<SchemaDraft>(() => createSchemaDraft());
  const [useBrandProfile, setUseBrandProfile] = useState(true);
  const [brandProfileLoaded, setBrandProfileLoaded] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [faqWarning, setFaqWarning] = useState<string | null>(null);
  
  // Handoff state
  const searchParams = useSearchParams();
  const [handoffPayload, setHandoffPayload] = useState<SchemaGeneratorHandoffPayload | null>(null);
  const [handoffHash, setHandoffHash] = useState<string | null>(null);
  const [isHandoffAlreadyImported, setIsHandoffAlreadyImported] = useState(false);
  const [showImportBanner, setShowImportBanner] = useState(false);
  const [importedFaqJsonLd, setImportedFaqJsonLd] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Tier 5C: Safe, additive schema handoff receiver (sessionStorage + TTL, explicit apply/dismiss)
  const [schemaHandoffPayload, setSchemaHandoffPayload] = useState<SchemaHandoffPayload | null>(null);
  const [schemaHandoffDismissed, setSchemaHandoffDismissed] = useState(false);
  const [importedSchemaNodes, setImportedSchemaNodes] = useState<Record<string, unknown>[]>([]);
  
  // Content Writer Schema handoff state
  const [contentWriterSchemaPayload, setContentWriterSchemaPayload] = useState<ContentWriterSchemaHandoff | null>(null);
  const [contentWriterSchemaHash, setContentWriterSchemaHash] = useState<string | null>(null);
  const [showContentWriterSchemaBanner, setShowContentWriterSchemaBanner] = useState(false);
  const [showContentWriterSchemaModal, setShowContentWriterSchemaModal] = useState(false);

  // Tier 5B: inline JSON-LD editor state
  const [isEditingJsonLd, setIsEditingJsonLd] = useState(false);
  const [jsonLdEditorText, setJsonLdEditorText] = useState("");
  const [jsonLdEditorError, setJsonLdEditorError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);

  // Tier 5B: minimal session persistence (ephemeral; survives refresh in the same tab)
  const currentTenantId = useMemo(() => resolveBusinessId(searchParams), [searchParams]);
  const schemaDraftStorageKey = useMemo(() => {
    // Tenant safety: key session drafts by the resolved business id (demo-safe),
    // falling back to the per-load draft id only when no tenant context exists.
    const suffix = currentTenantId || draft.id || "unknown";
    return `obd:schemaDraft:${suffix}`;
  }, [currentTenantId, draft.id]);

  function isValidSchemaDraft(value: unknown): value is SchemaDraft {
    if (!value || typeof value !== "object") return false;
    const v = value as SchemaDraft;
    return (
      typeof v.id === "string" &&
      (typeof v.generatedJsonld === "string" || v.generatedJsonld === null) &&
      (typeof v.editedJsonld === "string" || v.editedJsonld === null) &&
      (typeof v.lastGeneratedAt === "string" || v.lastGeneratedAt === null) &&
      (typeof v.lastEditedAt === "string" || v.lastEditedAt === null)
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(schemaDraftStorageKey);
      if (!raw) return;
      const parsed = safeJsonParse(raw);
      if (parsed && isValidSchemaDraft(parsed)) {
        setDraft(parsed);
        // Always return to a safe view-only state on refresh/restore
        setIsEditingJsonLd(false);
        setJsonLdEditorError(null);
        setJsonLdEditorText(getActiveSchemaJson(parsed));
      }
    } catch {
      // ignore
    }
  }, [schemaDraftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(schemaDraftStorageKey, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [schemaDraftStorageKey, draft]);

  // Tier 5A: accordion-based inputs (UI scaffold only)
  const [accordionState, setAccordionState] = useState({
    businessBasics: true,
    addressServiceArea: false,
    contactHours: false,
    reviews: false,
    advancedSchemaTypes: true,
  });

  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
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

  // Handle handoff on page load
  useEffect(() => {
    if (searchParams && typeof window !== "undefined") {
      try {
        // Try FAQ Generator handoff first
        const payload = parseSchemaGeneratorHandoff(searchParams);
        if (payload && payload.type === "faqpage-jsonld") {
          // Compute hash for the payload
          const hash = getHandoffHash(payload);
          setHandoffHash(hash);
          
          // Check if this payload was already imported
          const alreadyImported = wasHandoffAlreadyImported("business-schema-generator", hash);
          setIsHandoffAlreadyImported(alreadyImported);
          
          setHandoffPayload(payload);
          setShowImportBanner(true);
          return;
        }

        // Try Content Writer Schema handoff
        const cwPayload = parseContentWriterSchemaHandoff(searchParams);
        if (cwPayload) {
          // Compute hash for the payload
          const hash = getHandoffHash(cwPayload);
          setContentWriterSchemaHash(hash);
          
          // Check if this payload was already imported
          const alreadyImported = wasHandoffAlreadyImported("business-schema-generator", hash);
          
          // Check if banner was dismissed in this session
          const dismissedKey = "obd_schema_dismissed_handoff:ai-content-writer";
          const wasDismissed = typeof window !== "undefined" && sessionStorage.getItem(dismissedKey) === "true";
          
          if (!alreadyImported && !wasDismissed) {
            setContentWriterSchemaPayload(cwPayload);
            setShowContentWriterSchemaBanner(true);
          }
        }
      } catch (error) {
        console.error("Failed to parse handoff payload:", error);
      }
    }
  }, [searchParams]);

  // Tier 5C: read schema handoff from sessionStorage on mount (no auto-apply)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const payload = readHandoffFromSession();
      if (payload) {
        setSchemaHandoffPayload(payload);
        setSchemaHandoffDismissed(false);
      }
    } catch (error) {
      console.error("Failed to read schema handoff from sessionStorage:", error);
    }
  }, []);

  // Tier 5C tenant safety: if a handoff exists for a different business, clear it immediately
  // to prevent cross-tenant leakage via UI summary.
  useEffect(() => {
    if (!schemaHandoffPayload) return;
    if (!currentTenantId) return;
    if (isTenantMatch(schemaHandoffPayload.tenantId, currentTenantId)) return;

    clearHandoff();
    setSchemaHandoffPayload(null);
    setSchemaHandoffDismissed(false);
  }, [schemaHandoffPayload, currentTenantId]);

  // Load brand profile on mount
  useEffect(() => {
    if (brandProfileLoaded || !useBrandProfile) {
      setBrandProfileLoaded(true);
      return;
    }

    let mounted = true;
    const loadBrandProfile = async () => {
      try {
        const res = await fetch("/api/brand-profile");
        if (res.ok && mounted) {
          const profile = await res.json();
          if (profile && mounted) {
            const newAutoFilled = new Set<string>();
            setForm((currentForm) => {
              const newForm = { ...currentForm };
              // Only prefill if field is empty
              if (!newForm.businessName && profile.businessName) {
                newForm.businessName = profile.businessName;
                newAutoFilled.add("businessName");
              }
              if (!newForm.businessType && profile.businessType) {
                newForm.businessType = profile.businessType;
                newAutoFilled.add("businessType");
              }
              if (!newForm.city && profile.city) {
                newForm.city = profile.city;
                newAutoFilled.add("city");
              }
              if (!newForm.state && profile.state) {
                newForm.state = profile.state;
                newAutoFilled.add("state");
              }
              // Services - convert to comma-separated string if array
              if ((newForm.services?.length ?? 0) === 0 && profile.services) {
                const servicesArray = Array.isArray(profile.services)
                  ? profile.services
                  : typeof profile.services === "string"
                  ? profile.services.split(",").map((s: string) => s.trim()).filter(Boolean)
                  : [];
                if (servicesArray.length > 0) {
                  newForm.services = servicesArray;
                  setServicesInput(servicesArray.join(", "));
                  newAutoFilled.add("services");
                }
              }
              return newForm;
            });
            if (newAutoFilled.size > 0) {
              setAutoFilledFields(newAutoFilled);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load brand profile:", err);
      } finally {
        if (mounted) {
          setBrandProfileLoaded(true);
        }
      }
    };
    loadBrandProfile();
    return () => {
      mounted = false;
    };
  }, [useBrandProfile, brandProfileLoaded]);

  // Clear hint chips when user edits auto-filled fields
  const handleFieldChange = <K extends keyof SchemaGeneratorRequest>(
    key: K,
    value: SchemaGeneratorRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (autoFilledFields.has(key)) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleServicesChange = (value: string) => {
    setServicesInput(value);
    const servicesArray = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setForm((prev) => ({ ...prev, services: servicesArray }));
    if (autoFilledFields.has("services")) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete("services");
        return next;
      });
    }
  };

  const handleGenerate5FAQs = () => {
    const services = servicesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const location = form.city && form.state
      ? `${form.city}, ${form.state}`
      : form.city || form.state || "";

    const generatedFAQs: { question: string; answer: string }[] = [
      {
        question: `What services does ${form.businessName || "your business"} offer?`,
        answer: services.length > 0
          ? `${form.businessName || "We"} offer ${services.join(", ")}. Contact us for more details about our services and to schedule an appointment.`
          : `Contact ${form.businessName || "us"} to learn more about our services and how we can help you.`,
      },
      {
        question: location
          ? `What areas do you serve?`
          : `Where are you located?`,
        answer: location
          ? `We serve ${location} and surrounding areas. Contact us to confirm if we service your specific location.`
          : `Contact us for information about our service area and location details.`,
      },
      {
        question: `What are your business hours?`,
        answer: `Please contact us for our current business hours and availability. We're happy to work with your schedule.`,
      },
      {
        question: `How do I request a quote or schedule an appointment?`,
        answer: `You can reach out to us through our website, phone, or by visiting our location. Contact us today to discuss your needs and schedule a consultation.`,
      },
      {
        question: `Are you licensed and insured?`,
        answer: `Contact us directly for information about our licensing, insurance, and certifications. We're happy to provide details about our qualifications.`,
      },
    ];

    setForm((prev) => ({
      ...prev,
      faqs: generatedFAQs,
      faqTemplateMode: "basic",
    }));
    setFaqWarning(null);
  };

  const handleAddFAQ = () => {
    setForm((prev) => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: "", answer: "" }],
    }));
  };

  const handleRemoveFAQ = (index: number) => {
    setForm((prev) => ({
      ...prev,
      faqs: prev.faqs?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleFAQChange = (index: number, field: "question" | "answer", value: string) => {
    setForm((prev) => {
      const updatedFAQs = [...(prev.faqs || [])];
      updatedFAQs[index] = { ...updatedFAQs[index], [field]: value };
      return { ...prev, faqs: updatedFAQs };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setFaqWarning(null);

    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!form.businessType.trim()) {
      setError("Business type is required.");
      return;
    }

    if (form.includeWebPageSchema && !form.pageUrl?.trim()) {
      setError("Page URL is required when including WebPage schema.");
      return;
    }

    if (form.includeFaqSchema && (!form.faqs || form.faqs.length === 0)) {
      setFaqWarning("No FAQs added yet. FAQ schema will be omitted.");
      // Allow submit but FAQ schema will be omitted
    }

    setLoading(true);

    try {
      const payload: SchemaGeneratorRequest = {
        ...form,
        services: servicesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        // Only include FAQs if FAQ schema is enabled and FAQs exist
        faqs: form.includeFaqSchema && form.faqs && form.faqs.length > 0
          ? form.faqs.filter((faq) => faq.question.trim() && faq.answer.trim())
          : undefined,
      };

      const res = await fetch("/api/schema-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.requestId) {
            console.error("Request ID:", errorData.requestId);
          }
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json() as SchemaGeneratorResponse;

      if (response.ok && response.data) {
        setResult(response);
        // Tier 5B: update generated schema only; preserve any user edits (Edited > Generated).
        // NOTE: The generator's canonical combined bundle is `response.data.combinedJsonLd`.
        setDraft((prev) => {
          let nextGenerated = buildCombinedJsonLdWithImportedFaq(
            response.data!.combinedJsonLd,
            importedFaqJsonLd
          );
          if (!nextGenerated) return prev;

          // Tier 5C: preserve applied additive handoff nodes across regenerate.
          // Additive only: never overwrite existing nodes; never reorder existing @graph entries.
          if (importedSchemaNodes.length > 0) {
            try {
              nextGenerated = mergeNodesAdditive(nextGenerated, importedSchemaNodes);
            } catch {
              // fail-safe: if merge fails, keep base generator output
            }
          }
          return applyGeneratedSchema(prev, normalizeJsonString(nextGenerated));
        });
        setTimeout(() => {
          const resultsElement = document.getElementById("schema-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.ok === false && response.error) {
        if (response.requestId) {
          console.error("Request ID:", response.requestId);
        }
        throw new Error(response.error);
      } else {
        setResult(response);
      }
    } catch (error) {
      console.error("Schema Generator Submit Error:", error);
      let errorMessage = "Something went wrong while generating your schema. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Tier 5A: sticky action bar delegates to existing submit logic (non-breaking)
  const handleGenerateOrRegenerate = () => {
    formRef.current?.requestSubmit();
  };

  const buildCombinedJsonLdWithImportedFaq = (
    baseCombinedJsonLd: string | null,
    nextImportedFaqJsonLd: string | null
  ): string | null => {
    if (!baseCombinedJsonLd) {
      if (!nextImportedFaqJsonLd) return null;
      const importedFaq = safeJsonParse(nextImportedFaqJsonLd);
      if (!importedFaq) return null;
      return JSON.stringify(
        { "@context": "https://schema.org", "@graph": [importedFaq] },
        null,
        2
      );
    }

    if (!nextImportedFaqJsonLd) return baseCombinedJsonLd;

    const combined = safeJsonParse<Record<string, unknown>>(baseCombinedJsonLd);
    const importedFaq = safeJsonParse(nextImportedFaqJsonLd);
    if (!combined || !importedFaq) return baseCombinedJsonLd;

    const graph = combined["@graph"];
    if (Array.isArray(graph)) {
      graph.push(importedFaq);
      return JSON.stringify(combined, null, 2);
    }

    const existing = { ...combined };
    delete (existing as Record<string, unknown>)["@context"];

    const nextCombined: Record<string, unknown> = { ...combined };
    nextCombined["@graph"] = [existing, importedFaq];
    if ("@type" in nextCombined) {
      delete nextCombined["@type"];
    }
    return JSON.stringify(nextCombined, null, 2);
  };

  const handleExportJson = () => {
    // Tier 5C: Export is centralized in the Export Center UI (no auto-publish/inject).
    const el = document.getElementById("export-center");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Handle FAQ import insert
  const handleInsertFaqSchema = () => {
    if (!handoffPayload || !handoffHash) return;
    
    // Prevent insert if already imported
    if (isHandoffAlreadyImported) {
      return;
    }

    // Store the imported FAQ JSON-LD
    setImportedFaqJsonLd(handoffPayload.jsonLd);

    // Keep the canonical generated bundle in sync (so reset-to-generated includes the imported FAQ)
    setDraft((prev) => {
      const nextGenerated = buildCombinedJsonLdWithImportedFaq(
        result?.data?.combinedJsonLd ?? null,
        handoffPayload.jsonLd
      );
      if (!nextGenerated) return prev;
      return applyGeneratedSchema(prev, normalizeJsonString(nextGenerated));
    });

    // Mark handoff as imported
    markHandoffImported("business-schema-generator", handoffHash);
    setIsHandoffAlreadyImported(true);

    // Clear handoff
    setHandoffPayload(null);
    setHandoffHash(null);
    setShowImportBanner(false);

    // Clear handoff params from URL
    if (typeof window !== "undefined") {
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);
    }

    // Show success toast
    setToast("FAQPage schema imported successfully");
    setTimeout(() => setToast(null), 3000);

    // Scroll to results if they exist, otherwise scroll to form
    setTimeout(() => {
      const resultsElement = document.getElementById("schema-results");
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const formElement = document.querySelector("form");
        if (formElement) {
          formElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }, 100);
  };

  const handleDismissFaqImport = () => {
    setHandoffPayload(null);
    setHandoffHash(null);
    setIsHandoffAlreadyImported(false);
    setShowImportBanner(false);

    // Clear handoff params from URL
    if (typeof window !== "undefined") {
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);
    }
  };

  // Tier 5C: schema handoff apply/dismiss handlers
  const schemaSourceLabel = useMemo(() => {
    const source = schemaHandoffPayload?.source;
    if (!source) return null;
    if (source === "ai-faq-generator") return "AI FAQ Generator";
    if (source === "offers-promotions") return "Offers & Promotions";
    if (source === "event-campaign-builder") return "Event Campaign Builder";
    if (source === "local-seo-page-builder") return "Local SEO Page Builder";
    return source;
  }, [schemaHandoffPayload?.source]);

  const schemaHandoffSummary = useMemo(() => {
    if (!schemaHandoffPayload) return null;

    const nodeCount = schemaHandoffPayload.nodes.length;
    const typeSet = new Set<string>();
    for (const node of schemaHandoffPayload.nodes) {
      const t = (node as Record<string, unknown>)["@type"];
      if (typeof t === "string" && t.trim()) typeSet.add(t);
      if (Array.isArray(t)) {
        for (const item of t) {
          if (typeof item === "string" && item.trim()) typeSet.add(item);
        }
      }
    }

    const types = Array.from(typeSet);
    return { nodeCount, types };
  }, [schemaHandoffPayload]);

  const handleApplySchemaHandoff = () => {
    if (!schemaHandoffPayload) return;

    if (!currentTenantId) {
      setToast("Business context missing — cannot import schema handoff.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!isTenantMatch(schemaHandoffPayload.tenantId, currentTenantId)) {
      // Tenant mismatch safety: do not apply, show error, and clear payload one-time.
      clearHandoff();
      setSchemaHandoffPayload(null);
      setSchemaHandoffDismissed(false);

      setToast("Schema handoff is for a different business.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setDraft((prev) => applyAdditiveNodes(prev, schemaHandoffPayload.nodes));
    setImportedSchemaNodes((prev) => [...prev, ...schemaHandoffPayload.nodes]);

    // Clear stored handoff + clean URL
    clearHandoff();
    setSchemaHandoffPayload(null);
    setSchemaHandoffDismissed(false);

    // Show success toast
    const count = schemaHandoffSummary?.nodeCount ?? schemaHandoffPayload.nodes.length;
    setToast(`Imported ${count} schema node${count === 1 ? "" : "s"} successfully`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDismissSchemaHandoff = () => {
    // Clear stored handoff + clean URL
    clearHandoff();
    setSchemaHandoffPayload(null);
    setSchemaHandoffDismissed(true);
  };

  // Content Writer Schema handoff handlers
  const handleDismissContentWriterSchema = () => {
    setContentWriterSchemaPayload(null);
    setContentWriterSchemaHash(null);
    setShowContentWriterSchemaBanner(false);

    // Set session dismissal key
    if (typeof window !== "undefined") {
      sessionStorage.setItem("obd_schema_dismissed_handoff:ai-content-writer", "true");
      
      // Clear handoff params from URL
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);
    }
  };

  const handleReviewContentWriterSchema = () => {
    setShowContentWriterSchemaModal(true);
  };

  const handleConfirmContentWriterSchemaImport = (importMode: "faqs" | "page-meta") => {
    if (!contentWriterSchemaPayload || !contentWriterSchemaHash) return;

    // Compute FAQ merge statistics before setForm (for toast message)
    let addedCount = 0;
    let skippedCount = 0;
    let importedPageMeta = false;

    if (importMode === "faqs" && contentWriterSchemaPayload.mode === "faq" && contentWriterSchemaPayload.faqs) {
      const existingFaqs = form.faqs || [];
      const incomingFaqs = contentWriterSchemaPayload.faqs;
      const existingQuestions = new Set(
        existingFaqs.map((f) => f.question.trim().toLowerCase())
      );

      incomingFaqs.forEach((faq) => {
        const questionKey = faq.question.trim().toLowerCase();
        if (existingQuestions.has(questionKey)) {
          skippedCount++;
        } else {
          addedCount++;
        }
      });
    }

    if (importMode === "page-meta" && contentWriterSchemaPayload.mode === "page-meta") {
      importedPageMeta = true;
    }

    setForm((prev) => {
      const newForm = { ...prev };

      // FAQ import
      if (importMode === "faqs" && contentWriterSchemaPayload.mode === "faq") {
        if (contentWriterSchemaPayload.faqs) {
          // Enable FAQ schema
          newForm.includeFaqSchema = true;

          // Merge FAQs additively, skip duplicates by question (case-insensitive trim)
          const existingFaqs = prev.faqs || [];
          const incomingFaqs = contentWriterSchemaPayload.faqs;
          const existingQuestions = new Set(
            existingFaqs.map((f) => f.question.trim().toLowerCase())
          );

          const newFaqs = incomingFaqs.filter((faq) => {
            const questionKey = faq.question.trim().toLowerCase();
            return !existingQuestions.has(questionKey);
          });

          newForm.faqs = [...existingFaqs, ...newFaqs];
        }
      }

      // Page meta import
      if (importMode === "page-meta" && contentWriterSchemaPayload.mode === "page-meta") {
        if (contentWriterSchemaPayload.pageMeta) {
          // Enable WebPage schema
          newForm.includeWebPageSchema = true;

          const pageMeta = contentWriterSchemaPayload.pageMeta;
          
          // Set pageType only if empty
          if (!prev.pageType || prev.pageType.trim() === "") {
            newForm.pageType = (pageMeta.pageType || "WebPage") as SchemaGeneratorRequest["pageType"];
          }

          // Set pageTitle if present
          if (pageMeta.pageTitle) {
            newForm.pageTitle = pageMeta.pageTitle;
          }

          // Set pageDescription if present
          if (pageMeta.pageDescription) {
            newForm.pageDescription = pageMeta.pageDescription;
          }

          // Set pageUrl if present (slug only)
          if (pageMeta.pageUrl) {
            newForm.pageUrl = pageMeta.pageUrl;
          }
        }
      }

      // Optional business prefill (only if target fields are empty)
      if (contentWriterSchemaPayload.businessContext) {
        const bc = contentWriterSchemaPayload.businessContext;

        if (!prev.businessName.trim() && bc.businessName) {
          newForm.businessName = bc.businessName;
        }

        if (!prev.businessType.trim() && bc.businessType) {
          newForm.businessType = bc.businessType;
        }

        if ((prev.services?.length ?? 0) === 0 && bc.services) {
          // Split by comma/newline into array
          const servicesArray = bc.services
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (servicesArray.length > 0) {
            newForm.services = servicesArray;
            setServicesInput(servicesArray.join(", "));
          }
        }
      }

      return newForm;
    });

    // Mark handoff as imported
    markHandoffImported("business-schema-generator", contentWriterSchemaHash);

    // Clear handoff state
    setContentWriterSchemaPayload(null);
    setContentWriterSchemaHash(null);
    setShowContentWriterSchemaBanner(false);
    setShowContentWriterSchemaModal(false);

    // Clear handoff params from URL
    if (typeof window !== "undefined") {
      const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
      replaceUrlWithoutReload(cleanUrl);

      // Clear localStorage handoff if using handoffId (parseHandoffFromUrl should already clear, but ensure)
      const handoffId = searchParams?.get("handoffId");
      if (handoffId) {
        try {
          localStorage.removeItem(`obd_handoff:${handoffId}`);
      } catch {
          // Ignore errors
        }
      }
    }

    // Build toast message with import feedback
    const toastParts: string[] = [];
    if (addedCount > 0 || skippedCount > 0) {
      if (skippedCount > 0) {
        toastParts.push(`Added ${addedCount} FAQ${addedCount !== 1 ? "s" : ""}, Skipped ${skippedCount} duplicate${skippedCount !== 1 ? "s" : ""}`);
      } else {
        toastParts.push(`Added ${addedCount} FAQ${addedCount !== 1 ? "s" : ""}`);
      }
    }
    if (importedPageMeta) {
      toastParts.push("Imported page meta");
    }
    const toastMessage = toastParts.length > 0 ? toastParts.join(". ") : "Imported from AI Content Writer";

    // Show success toast
    setToast(toastMessage);
    setTimeout(() => setToast(null), 3000);

    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector("form");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const activeJson = useMemo(() => getActiveSchemaJson(draft), [draft]);
  const issues = useMemo(() => getExportIssues(activeJson), [activeJson]);

  const draftStatus = useMemo(() => getDraftStatus(draft), [draft]);
  const isEdited = draftStatus === "edited";
  const canExport = !issues.some((i) => i.level === "blocker");

  const handleStartEditingJsonLd = () => {
    const seed = activeJson || draft.generatedJsonld || "";
    setJsonLdEditorText(seed);
    setJsonLdEditorError(null);
    setIsEditingJsonLd(true);
  };

  const handleCancelEditingJsonLd = () => {
    // Revert the buffer back to the current active schema and exit edit mode
    setJsonLdEditorText(getActiveSchemaJson(draft));
    setIsEditingJsonLd(false);
    setJsonLdEditorError(null);
  };

  const handleSaveEditingJsonLd = () => {
    setJsonLdEditorError(null);
    const parsed = safeJsonParse(jsonLdEditorText);
    if (parsed === null) {
      setJsonLdEditorError("Invalid JSON. Please fix the syntax before saving.");
      return;
    }
    // Must be an object or array (not string/number/boolean/null)
    if (typeof parsed !== "object" || parsed === null) {
      setJsonLdEditorError("JSON must be an object or array (not a string/number).");
      return;
    }
    const pretty = normalizeJsonString(jsonLdEditorText);
    setDraft((prev) => applyEditedSchema(prev, pretty));
    setIsEditingJsonLd(false);
  };

  const handleResetToGenerated = () => {
    if (!isEdited) return;
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm("Discard your saved JSON-LD edits and revert to the generated schema?");
    if (!ok) return;
    setDraft((prev) => resetToGenerated(prev));
    setIsEditingJsonLd(false);
    setJsonLdEditorError(null);
  };

  const handleResetAllEdits = () => {
    if (!isEdited) return;
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm("Reset ALL saved edits in this tool? This will not change the generator output.");
    if (!ok) return;
    setDraft((prev) => resetToGenerated(prev));
    setIsEditingJsonLd(false);
    setJsonLdEditorError(null);
  };

  const status = useMemo(() => {
    if (draftStatus === "edited") return { label: "Edited", tone: "info" as const };
    if (draftStatus === "generated") return { label: "Generated", tone: "success" as const };
    return { label: "Draft", tone: "neutral" as const };
  }, [draftStatus]);

  const statusChip = (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        status.tone === "success"
          ? isDark
            ? "bg-green-500/20 text-green-400 border-green-500"
            : "bg-green-50 text-green-700 border-green-300"
          : status.tone === "info"
          ? isDark
            ? "bg-teal-500/20 text-teal-300 border-teal-500"
            : "bg-teal-50 text-teal-700 border-teal-300"
          : isDark
          ? "bg-slate-500/20 text-slate-300 border-slate-500"
          : "bg-slate-50 text-slate-700 border-slate-300"
      }`}
      title={status.label}
    >
      {status.label}
    </span>
  );

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Business Schema Generator"
      tagline="Generate copy-paste JSON-LD for your website and listings."
    >
      {/* Tier 5C: Schema Handoff Confirmation Panel */}
      {schemaHandoffPayload && schemaHandoffSummary && (
        <div
          className={`mb-6 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isDark
              ? "bg-teal-900/20 border-teal-700"
              : "bg-teal-50 border-teal-200"
          }`}
        >
          <div className="flex-1">
            <div
              className={`text-sm font-medium ${
                isDark ? "text-teal-200" : "text-teal-900"
              }`}
            >
              Schema data available from: {schemaSourceLabel ?? schemaHandoffPayload.source}
            </div>
            <div className={`text-xs mt-1 space-y-1 ${isDark ? "text-teal-300" : "text-teal-700"}`}>
              <div>
                <span className="font-medium">Nodes:</span> {schemaHandoffSummary.nodeCount}
              </div>
              <div>
                <span className="font-medium">Types:</span>{" "}
                {schemaHandoffSummary.types.length > 0
                  ? schemaHandoffSummary.types.join(", ")
                  : "Unknown"}
              </div>
            </div>
            {!currentTenantId && (
              <div className={`text-xs mt-2 ${isDark ? "text-yellow-300" : "text-yellow-800"}`}>
                Business context required (missing businessId).
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleApplySchemaHandoff}
              disabled={!currentTenantId}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                !currentTenantId
                  ? isDark
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-[#29c4a9] text-white hover:bg-[#22ad93]"
              }`}
            >
              Apply
            </button>
            <button
              onClick={handleDismissSchemaHandoff}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tier 5C: Dismissed state (no mutation) */}
      {!schemaHandoffPayload && schemaHandoffDismissed && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            Schema handoff dismissed.
          </div>
        </div>
      )}

      {/* FAQ Generator Import Banner */}
      {showImportBanner && handoffPayload && (
        <FAQImportBanner
          isDark={isDark}
          isAlreadyImported={isHandoffAlreadyImported}
          onInsert={handleInsertFaqSchema}
          onDismiss={handleDismissFaqImport}
        />
      )}

      {/* Content Writer Schema Import Ready Banner */}
      {showContentWriterSchemaBanner && contentWriterSchemaPayload && (
        <ContentWriterSchemaImportReadyBanner
          isDark={isDark}
          payload={contentWriterSchemaPayload}
          onReview={handleReviewContentWriterSchema}
          onDismiss={handleDismissContentWriterSchema}
        />
      )}

      {/* Content Writer Schema Import Modal */}
      {showContentWriterSchemaModal && contentWriterSchemaPayload && (
        <ContentWriterSchemaImportModal
          isDark={isDark}
          payload={contentWriterSchemaPayload}
          isAlreadyImported={contentWriterSchemaHash ? wasHandoffAlreadyImported("business-schema-generator", contentWriterSchemaHash) : false}
          onClose={() => setShowContentWriterSchemaModal(false)}
          onConfirm={handleConfirmContentWriterSchemaImport}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
        >
          <div
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm transition-opacity ${
              isDark
                ? "bg-slate-800/90 border border-slate-700/50"
                : "bg-white/90 border border-slate-200/50"
            }`}
          >
            {toast}
          </div>
        </div>
      )}

      <div className={`mt-7 space-y-8 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
        {/* Trust microcopy (Tier 5A) */}
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}
        >
          <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
            Draft-only schema generator
          </p>
          <div className={`text-sm mt-1 ${themeClasses.mutedText} space-y-1`}>
            <p>This tool generates structured data drafts (JSON-LD).</p>
            <p>Nothing is published, injected, or installed automatically.</p>
            <p>You control where (and if) it gets added.</p>
          </div>
        </div>

        {/* Form */}
        <OBDPanel isDark={isDark}>
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="space-y-4">
              <OBDAccordionSection
                isDark={isDark}
                title="Business Basics"
                summary={`${form.businessName || "Business Name"} • ${form.businessType || "Primary Type"}`}
                isOpen={accordionState.businessBasics}
                onToggle={() => toggleAccordion("businessBasics")}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="businessName"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Business Name <span className="text-red-500">*</span>
                      {autoFilledFields.has("businessName") && (
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            isDark
                              ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                              : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}
                        >
                          From Brand Profile
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      value={form.businessName}
                      onChange={(e) =>
                        handleFieldChange("businessName", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="Example: Ocala Massage & Wellness"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="businessType"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Business Type <span className="text-red-500">*</span>
                      {autoFilledFields.has("businessType") && (
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            isDark
                              ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                              : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}
                        >
                          From Brand Profile
                        </span>
                      )}
                    </label>
                    <select
                      id="businessType"
                      value={form.businessType}
                      onChange={(e) =>
                        handleFieldChange("businessType", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      required
                    >
                      {BUSINESS_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Existing field (do not delete): Services */}
                  <div>
                    <label
                      htmlFor="services"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Services (comma-separated)
                      {autoFilledFields.has("services") && (
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            isDark
                              ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                              : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}
                        >
                          From Brand Profile
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      id="services"
                      value={servicesInput}
                      onChange={(e) => handleServicesChange(e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Massage therapy, deep tissue, Swedish massage"
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Separate multiple services with commas
                    </p>
                  </div>

                  {/* Description is not currently captured in this generator */}
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Description isn’t collected in this version of the generator.
                  </p>

                  <div>
                    <label
                      htmlFor="websiteUrl"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Website URL
                    </label>
                    <input
                      type="url"
                      id="websiteUrl"
                      value={form.websiteUrl}
                      onChange={(e) =>
                        handleFieldChange("websiteUrl", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </OBDAccordionSection>

              <OBDAccordionSection
                isDark={isDark}
                title="Address & Service Area"
                summary={`${[form.city, form.state].filter(Boolean).join(", ") || "City, State"} • 0 service areas`}
                isOpen={accordionState.addressServiceArea}
                onToggle={() => toggleAccordion("addressServiceArea")}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="streetAddress"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="streetAddress"
                      value={form.streetAddress}
                      onChange={(e) =>
                        handleFieldChange("streetAddress", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="city"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        City
                        {autoFilledFields.has("city") && (
                          <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              isDark
                                ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                                : "bg-teal-50 text-teal-700 border border-teal-200"
                            }`}
                          >
                            From Brand Profile
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        id="city"
                        value={form.city}
                        onChange={(e) => handleFieldChange("city", e.target.value)}
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
                        {autoFilledFields.has("state") && (
                          <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              isDark
                                ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                                : "bg-teal-50 text-teal-700 border border-teal-200"
                            }`}
                          >
                            From Brand Profile
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        id="state"
                        value={form.state}
                        onChange={(e) => handleFieldChange("state", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="Florida"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="postalCode"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Postal Code
                      </label>
                      <input
                        type="text"
                        id="postalCode"
                        value={form.postalCode}
                        onChange={(e) =>
                          handleFieldChange("postalCode", e.target.value)
                        }
                        className={getInputClasses(isDark)}
                        placeholder="34475"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="googleMapsUrl"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Google Maps URL (Optional)
                    </label>
                    <input
                      type="url"
                      id="googleMapsUrl"
                      value={form.googleMapsUrl}
                      onChange={(e) =>
                        handleFieldChange("googleMapsUrl", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="https://maps.google.com/..."
                    />
                  </div>

                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Service areas aren’t collected in this version of the generator.
                  </p>
                </div>
              </OBDAccordionSection>

              <OBDAccordionSection
                isDark={isDark}
                title="Contact & Hours"
                summary={`${form.phone?.trim() ? form.phone : "Phone"} • ${
                  Object.values(form.hours || {}).some((v) => (v || "").trim().length > 0)
                    ? "Hours set"
                    : "Hours empty"
                }`}
                isOpen={accordionState.contactHours}
                onToggle={() => toggleAccordion("contactHours")}
              >
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="phone"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="(352) 555-1234"
                    />
                  </div>

                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Email isn’t collected in this version of the generator.
                  </p>

                  {/* Social links (existing inputs) */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="facebookUrl"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Facebook URL
                      </label>
                      <input
                        type="url"
                        id="facebookUrl"
                        value={form.socialLinks?.facebookUrl || ""}
                        onChange={(e) =>
                          handleFieldChange("socialLinks", {
                            ...form.socialLinks,
                            facebookUrl: e.target.value,
                          })
                        }
                        className={getInputClasses(isDark)}
                        placeholder="https://facebook.com/yourpage"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="instagramUrl"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Instagram URL
                      </label>
                      <input
                        type="url"
                        id="instagramUrl"
                        value={form.socialLinks?.instagramUrl || ""}
                        onChange={(e) =>
                          handleFieldChange("socialLinks", {
                            ...form.socialLinks,
                            instagramUrl: e.target.value,
                          })
                        }
                        className={getInputClasses(isDark)}
                        placeholder="https://instagram.com/yourpage"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="xUrl"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        X (Twitter) URL
                      </label>
                      <input
                        type="url"
                        id="xUrl"
                        value={form.socialLinks?.xUrl || ""}
                        onChange={(e) =>
                          handleFieldChange("socialLinks", {
                            ...form.socialLinks,
                            xUrl: e.target.value,
                          })
                        }
                        className={getInputClasses(isDark)}
                        placeholder="https://x.com/yourpage"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="linkedinUrl"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        LinkedIn URL
                      </label>
                      <input
                        type="url"
                        id="linkedinUrl"
                        value={form.socialLinks?.linkedinUrl || ""}
                        onChange={(e) =>
                          handleFieldChange("socialLinks", {
                            ...form.socialLinks,
                            linkedinUrl: e.target.value,
                          })
                        }
                        className={getInputClasses(isDark)}
                        placeholder="https://linkedin.com/company/yourpage"
                      />
                    </div>
                  </div>

                  {/* Hours (existing inputs) */}
                  <div>
                    <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
                      Format: 9:00 AM - 5:00 PM (leave blank if closed)
                    </p>
                    <div className="space-y-3">
                      {(
                        [
                          "monday",
                          "tuesday",
                          "wednesday",
                          "thursday",
                          "friday",
                          "saturday",
                          "sunday",
                        ] as const
                      ).map((day) => (
                        <div key={day}>
                          <label
                            htmlFor={`hours-${day}`}
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </label>
                          <input
                            type="text"
                            id={`hours-${day}`}
                            value={form.hours?.[day] || ""}
                            onChange={(e) =>
                              handleFieldChange("hours", {
                                ...form.hours,
                                [day]: e.target.value,
                              })
                            }
                            className={getInputClasses(isDark)}
                            placeholder="9:00 AM - 5:00 PM"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </OBDAccordionSection>

              <OBDAccordionSection
                isDark={isDark}
                title="Reviews & Ratings (Optional)"
                summary="Rating • # Reviews"
                isOpen={accordionState.reviews}
                onToggle={() => toggleAccordion("reviews")}
              >
                <p className={`text-xs ${themeClasses.mutedText}`}>
                  Rating and review count aren’t collected in this version of the generator.
                </p>
              </OBDAccordionSection>

              <OBDAccordionSection
                isDark={isDark}
                title="Advanced Schema Types"
                summary={`Enabled: ${
                  Number(Boolean(form.includeFaqSchema)) +
                  Number(Boolean(form.includeWebPageSchema))
                }`}
                isOpen={accordionState.advancedSchemaTypes}
                onToggle={() => toggleAccordion("advancedSchemaTypes")}
              >
                <div className="space-y-6">
                  <div>
                    <label
                      className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}
                    >
                      <input
                        type="checkbox"
                        checked={useBrandProfile}
                        onChange={(e) => setUseBrandProfile(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Use saved Brand Profile</span>
                    </label>
                    <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
                      When enabled, your saved brand profile will auto-fill business name, type,
                      services, and location if fields are empty.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label
                      className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}
                    >
                      <input
                        type="checkbox"
                        checked={form.includeFaqSchema || false}
                        onChange={(e) =>
                          handleFieldChange("includeFaqSchema", e.target.checked)
                        }
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Include FAQ Schema</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}
                    >
                      <input
                        type="checkbox"
                        checked={form.includeWebPageSchema || false}
                        onChange={(e) =>
                          handleFieldChange("includeWebPageSchema", e.target.checked)
                        }
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Include WebPage Schema</span>
                    </label>
                  </div>

                  {/* FAQ Section (existing inputs) */}
                  {form.includeFaqSchema && (
                    <div>
                      <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                        FAQ Schema
                      </OBDHeading>
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={handleGenerate5FAQs}
                          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                            isDark
                              ? "bg-teal-900/50 text-teal-200 hover:bg-teal-900/70 border border-teal-700/50"
                              : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                          }`}
                        >
                          Generate 5 FAQs
                        </button>
                        <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                          Generate template-based FAQs based on your business information.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {(form.faqs || []).map((faq, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                                FAQ {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFAQ(index)}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  isDark
                                    ? "bg-red-900/50 text-red-200 hover:bg-red-900/70"
                                    : "bg-red-50 text-red-700 hover:bg-red-100"
                                }`}
                              >
                                Remove
                              </button>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label
                                  htmlFor={`faq-question-${index}`}
                                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                                >
                                  Question
                                </label>
                                <input
                                  type="text"
                                  id={`faq-question-${index}`}
                                  value={faq.question}
                                  onChange={(e) =>
                                    handleFAQChange(index, "question", e.target.value)
                                  }
                                  className={getInputClasses(isDark)}
                                  placeholder="What services do you offer?"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor={`faq-answer-${index}`}
                                  className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                                >
                                  Answer
                                </label>
                                <textarea
                                  id={`faq-answer-${index}`}
                                  value={faq.answer}
                                  onChange={(e) =>
                                    handleFAQChange(index, "answer", e.target.value)
                                  }
                                  rows={3}
                                  className={getInputClasses(isDark, "resize-none")}
                                  placeholder="We offer a variety of services..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={handleAddFAQ}
                          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          Add FAQ
                        </button>
                      </div>
                    </div>
                  )}

                  {/* WebPage Section (existing inputs) */}
                  {form.includeWebPageSchema && (
                    <div>
                      <OBDHeading level={2} isDark={isDark} className="mb-4 text-base">
                        WebPage Schema
                      </OBDHeading>
                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor="pageUrl"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Page URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="url"
                            id="pageUrl"
                            value={form.pageUrl || ""}
                            onChange={(e) => handleFieldChange("pageUrl", e.target.value)}
                            className={getInputClasses(isDark)}
                            placeholder="https://example.com/page"
                            required={form.includeWebPageSchema}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="pageType"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Page Type
                          </label>
                          <select
                            id="pageType"
                            value={form.pageType || "Homepage"}
                            onChange={(e) =>
                              handleFieldChange(
                                "pageType",
                                e.target.value as SchemaGeneratorRequest["pageType"]
                              )
                            }
                            className={getInputClasses(isDark)}
                          >
                            <option value="Homepage">Homepage</option>
                            <option value="ServicePage">Service Page</option>
                            <option value="LocationPage">Location Page</option>
                            <option value="About">About</option>
                            <option value="Contact">Contact</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="pageTitle"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Page Title
                          </label>
                          <input
                            type="text"
                            id="pageTitle"
                            value={form.pageTitle || ""}
                            onChange={(e) =>
                              handleFieldChange("pageTitle", e.target.value)
                            }
                            className={getInputClasses(isDark)}
                            placeholder={`${form.businessName || "Business"} - ${
                              form.pageType || "Homepage"
                            }`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="pageDescription"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Page Description
                          </label>
                          <textarea
                            id="pageDescription"
                            value={form.pageDescription || ""}
                            onChange={(e) =>
                              handleFieldChange("pageDescription", e.target.value)
                            }
                            rows={3}
                            className={getInputClasses(isDark, "resize-none")}
                            placeholder="Brief description of this page..."
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </OBDAccordionSection>

              {/* Error */}
              {error && (
                <div className={getErrorPanelClasses(isDark)}>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* FAQ Warning */}
              {faqWarning && (
                <div
                  className={`p-3 rounded-lg border ${
                    isDark
                      ? "bg-yellow-900/20 border-yellow-700/50 text-yellow-200"
                      : "bg-yellow-50 border-yellow-200 text-yellow-800"
                  }`}
                >
                  <p className="text-sm">{faqWarning}</p>
                </div>
              )}

              {/* Hidden submit button to preserve enter-to-submit behavior */}
              <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">
                Submit
              </button>
            </div>
          </form>

        </OBDPanel>

      {/* Results */}
      {(result?.data || activeJson) && (
        <div id="schema-results" className="mt-8">
          <OBDHeading level={2} isDark={isDark} className="mb-6">
            Schema Draft
          </OBDHeading>

          <div className="space-y-6">
            {/* LocalBusiness JSON-LD */}
            {result?.data?.localBusinessJsonLd && (
              <ResultCard
                title="LocalBusiness JSON-LD"
                isDark={isDark}
              >
                <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                  isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}>
                  <code>{result.data.localBusinessJsonLd}</code>
                </pre>
              </ResultCard>
            )}

            {/* FAQPage JSON-LD (from form) */}
            {result?.data?.faqJsonLd && (
              <ResultCard
                title="FAQPage JSON-LD"
                isDark={isDark}
              >
                <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                  isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}>
                  <code>{result.data.faqJsonLd}</code>
                </pre>
              </ResultCard>
            )}

            {/* Imported FAQPage JSON-LD */}
            {importedFaqJsonLd && (
              <ResultCard
                title={`FAQPage JSON-LD ${handoffPayload?.title ? `(${handoffPayload.title})` : "(Imported)"}`}
                isDark={isDark}
              >
                <div className={`mb-2 text-xs px-2 py-1 rounded ${
                  isDark
                    ? "bg-teal-900/30 text-teal-200 border border-teal-700/50"
                    : "bg-teal-50 text-teal-700 border border-teal-200"
                }`}>
                  Imported from AI FAQ Generator
                </div>
                <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                  isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}>
                  <code>{importedFaqJsonLd}</code>
                </pre>
              </ResultCard>
            )}

            {/* WebPage JSON-LD */}
            {result?.data?.webPageJsonLd && (
              <ResultCard
                title="WebPage JSON-LD"
                isDark={isDark}
              >
                <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                  isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}>
                  <code>{result.data.webPageJsonLd}</code>
                </pre>
              </ResultCard>
            )}

            {/* Combined JSON-LD Bundle */}
            <ResultCard
              title="Full Schema Bundle (Recommended)"
              isDark={isDark}
            >
              <p className={`text-sm mb-3 ${themeClasses.mutedText}`}>
                Paste this into your website or SEO plugin. This includes everything above.
              </p>

              <div className="flex items-center justify-between mb-2">
                <div className={`text-xs ${themeClasses.mutedText}`}>
                  {draft.lastGeneratedAt && (
                    <span>Generated: {new Date(draft.lastGeneratedAt).toLocaleString()}</span>
                  )}
                  {draft.lastEditedAt && (
                    <span className="ml-3">Edited: {new Date(draft.lastEditedAt).toLocaleString()}</span>
                  )}
                </div>
                {isEdited && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      isDark
                        ? "bg-teal-900/30 text-teal-200 border-teal-700/50"
                        : "bg-teal-50 text-teal-700 border-teal-200"
                    }`}
                  >
                    Edited
                  </span>
                )}
              </div>

              {isEditingJsonLd ? (
                <div className="space-y-2">
                  <textarea
                    value={jsonLdEditorText}
                    onChange={(e) => setJsonLdEditorText(e.target.value)}
                    rows={16}
                    className={getInputClasses(isDark, "font-mono text-xs")}
                    placeholder={`{\n  "@context": "https://schema.org",\n  "@graph": []\n}`}
                  />
                  {jsonLdEditorError && (
                    <div
                      className={`text-xs p-2 rounded border ${
                        isDark
                          ? "bg-red-900/20 border-red-700/50 text-red-200"
                          : "bg-red-50 border-red-200 text-red-800"
                      }`}
                    >
                      {jsonLdEditorError}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEditingJsonLd}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        isDark
                          ? "bg-teal-600 text-white hover:bg-teal-500"
                          : "bg-teal-600 text-white hover:bg-teal-500"
                      }`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditingJsonLd}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!isEdited}
                      onClick={handleResetToGenerated}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        !isEdited
                          ? isDark
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Reset to generated
                    </button>
                    <button
                      type="button"
                      disabled={!isEdited}
                      onClick={handleResetAllEdits}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        !isEdited
                          ? isDark
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Reset all edits
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                    isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                  }`}>
                    <code>{activeJson || ""}</code>
                  </pre>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleStartEditingJsonLd}
                      disabled={!activeJson}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        !activeJson
                          ? isDark
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Edit JSON-LD
                    </button>
                    <button
                      type="button"
                      disabled={!isEdited}
                      onClick={handleResetToGenerated}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        !isEdited
                          ? isDark
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Reset to generated
                    </button>
                    <button
                      type="button"
                      disabled={!isEdited}
                      onClick={handleResetAllEdits}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        !isEdited
                          ? isDark
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Reset all edits
                    </button>
                    <button
                      type="button"
                      disabled={!canExport}
                      onClick={handleExportJson}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        !canExport
                          ? isDark
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Open Export Center
                    </button>
                  </div>
                </>
              )}
            </ResultCard>
          </div>

          {/* Ecosystem Next Steps */}
          <div className="mt-6">
            <EcosystemNextSteps
              title="Next steps"
              description="Keep building trust signals and customer automation."
              steps={[
                {
                  id: "helpdesk",
                  label: "Use with AI Help Desk",
                  description: "Power customer answers with your website content.",
                  href: "/apps/ai-help-desk",
                  cta: "Open Help Desk",
                },
              ]}
              dismissKey="tier5c-schema-generator-next-steps"
              isDark={isDark}
            />
          </div>
        </div>
      )}
      </div>

      {/* Export Center (authoritative UI surface; always present so readiness is visible even before generation) */}
      <div id="export-center">
        <ExportCenter activeJson={activeJson} issues={issues} />
      </div>

      {/* Sticky Action Bar (Tier 5A) */}
      <OBDStickyActionBar
        isDark={isDark}
        left={
          <div className="flex items-center gap-2 min-w-0">
            {statusChip}
          </div>
        }
      >
        <button
          type="button"
          disabled={loading}
          onClick={handleGenerateOrRegenerate}
          className={SUBMIT_BUTTON_CLASSES}
        >
          {loading ? "Generating..." : result?.data ? "Regenerate" : "Generate"}
        </button>
        <button
          type="button"
          disabled={!isEdited}
          onClick={handleResetAllEdits}
          className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
            !isEdited
              ? isDark
                ? "border-slate-700 text-slate-500 cursor-not-allowed"
                : "border-slate-200 text-slate-400 cursor-not-allowed"
              : isDark
              ? "border-slate-600 text-slate-200 hover:bg-slate-800"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
          title={isEdited ? "Reset all saved edits" : "No edits to reset"}
        >
          Reset
        </button>
        <button
          type="button"
          disabled={!canExport}
          onClick={handleExportJson}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
            !canExport
              ? isDark
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              : isDark
              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`}
          title={canExport ? "Open Export Center" : "Fix export blockers to enable export"}
        >
          Export
        </button>
      </OBDStickyActionBar>
    </OBDPageContainer>
  );
}

export default function BusinessSchemaGeneratorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BusinessSchemaGeneratorPageContent />
    </Suspense>
  );
}

