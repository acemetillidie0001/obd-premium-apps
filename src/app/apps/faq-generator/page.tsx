"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDResultsActions from "@/components/obd/OBDResultsActions";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses, getSecondaryButtonClasses, getSubtleButtonMediumClasses } from "@/lib/obd-framework/layout-helpers";
import FAQExportCenterPanel from "@/components/faq/FAQExportCenterPanel";
import EcosystemNextSteps from "@/components/obd/EcosystemNextSteps";
import { type BrandProfile as BrandProfileType } from "@/lib/brand/brand-profile-types";
import { useAutoApplyBrandProfile } from "@/lib/brand/useAutoApplyBrandProfile";
import { hasBrandProfile } from "@/lib/brand/brandProfileStorage";
import { parseHelpDeskHandoffPayload } from "@/lib/apps/faq-generator/handoff-parser";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import {
  getHandoffHash,
  wasHandoffAlreadyImported,
  markHandoffImported,
} from "@/lib/utils/handoff-guard";
import {
  clearHandoffParamsFromUrl,
  replaceUrlWithoutReload,
} from "@/lib/utils/clear-handoff-params";

function FAQGeneratorPageContent() {
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [services, setServices] = useState("");
  const [topic, setTopic] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [personalityStyle, setPersonalityStyle] = useState<"Soft" | "Bold" | "High-Energy" | "Luxury" | "">("");
  const [faqCount, setFaqCount] = useState<number>(5);
  const [answerLength, setAnswerLength] = useState<"Short" | "Medium" | "Long">("Medium");
  const [tone, setTone] = useState("");
  const [hasEmoji, setHasEmoji] = useState<"None" | "Minimal" | "Normal">("Minimal");
  const [faqTheme, setFaqTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [lastPayload, setLastPayload] = useState<{
    businessName?: string | null;
    businessType?: string | null;
    city?: string;
    state?: string;
    topic: string;
    details?: string | null;
    brandVoice?: string | null;
    personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury" | null;
    faqCount: number;
    answerLength: "Short" | "Medium" | "Long";
    tone?: string | null;
    hasEmoji: "None" | "Minimal" | "Normal";
    theme?: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shuffledFAQs, setShuffledFAQs] = useState<Array<{ number: number; question: string; answer: string; characterCount: number }> | null>(null);
  const [editedFAQs, setEditedFAQs] = useState<FAQItem[] | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  // Tenant-safe businessId from existing context (demo cookie or ?businessId=)
  const resolvedBusinessId = useMemo(() => resolveBusinessId(searchParams), [searchParams]);

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
    brandVoice: string;
  };

  const form: FormData = {
    businessName,
    businessType,
    brandVoice,
  };

  const setForm = (updater: Partial<FormData> | ((prev: FormData) => Partial<FormData>)) => {
    if (typeof updater === "function") {
      const updates = updater(form);
      if (updates.businessName !== undefined) setBusinessName(updates.businessName);
      if (updates.businessType !== undefined) setBusinessType(updates.businessType);
      if (updates.brandVoice !== undefined) setBrandVoice(updates.brandVoice);
    } else {
      if (updater.businessName !== undefined) setBusinessName(updater.businessName);
      if (updater.businessType !== undefined) setBusinessType(updater.businessType);
      if (updater.brandVoice !== undefined) setBrandVoice(updater.brandVoice);
    }
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
    storageKey: "faq-generator-brand-hydrate-v1",
    once: "per-page-load",
    fillEmptyOnly: true,
    map: (formKey: string, brand: BrandProfileType): keyof BrandProfileType | undefined => {
      if (formKey === "businessName") return "businessName";
      if (formKey === "businessType") return "businessType";
      if (formKey === "brandVoice") return "brandVoice";
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

  // Imported questions state from AI Help Desk
  const [importedQuestions, setImportedQuestions] = useState<string[]>([]);
  const [importedTopic, setImportedTopic] = useState<string | undefined>(undefined);
  const [importedQuestionsExpanded, setImportedQuestionsExpanded] = useState(true);

  // Handle Help Desk handoff
  useEffect(() => {
    if (typeof window === "undefined" || !searchParams) return;

    try {
      const payload = parseHelpDeskHandoffPayload(searchParams);
      
      if (payload) {
        // Validate sourceApp (already validated by parser, but double-check)
        if (payload.sourceApp !== "ai-help-desk") {
          // Clean URL and exit
          const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
          replaceUrlWithoutReload(cleanUrl);
          return;
        }

        // Validate questions is non-empty array (already validated by parser)
        if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
          const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
          replaceUrlWithoutReload(cleanUrl);
          return;
        }

        const hash = getHandoffHash(payload);
        const alreadyImported = wasHandoffAlreadyImported("faq-generator", hash);
        
        if (!alreadyImported) {
          // Sanitize questions: trim, drop empty, de-dupe (case-insensitive trim), cap to 25
          const sanitized = payload.questions
            .map((q) => q.trim())
            .filter((q) => q.length > 0)
            .filter((q, index, arr) => {
              // Case-insensitive de-dupe
              const lower = q.toLowerCase();
              return arr.findIndex((item) => item.toLowerCase() === lower) === index;
            })
            .slice(0, 25);

          if (sanitized.length > 0) {
            // Store in state
            setImportedQuestions(sanitized);
            setImportedTopic(payload.context?.topic);

            // Set topic field if empty
            setTopic((prev) => {
              if (prev.trim()) return prev;
              return payload.context?.topic || "Customer Questions";
            });

            // Mark as imported and clean URL
            markHandoffImported("faq-generator", hash);
            const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
            replaceUrlWithoutReload(cleanUrl);
          } else {
            // No valid questions after sanitization, just clean URL
            const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
            replaceUrlWithoutReload(cleanUrl);
          }
        } else {
          // Already imported, just clean URL
          const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
          replaceUrlWithoutReload(cleanUrl);
        }
      }
    } catch (error) {
      console.error("Failed to process handoff:", error);
      // Clean URL even on error
      if (typeof window !== "undefined") {
        const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
        replaceUrlWithoutReload(cleanUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Accordion state for form sections
  const [accordionState, setAccordionState] = useState({
    businessBasics: true,
    topicDetails: true,
    tonePersonality: false,
    faqSettings: false,
  });

  type FAQItem = {
    number: number;
    question: string;
    answer: string;
    characterCount: number;
  };

  function parseAiResponse(aiResponse: string): FAQItem[] {
    const faqs: FAQItem[] = [];
    const lines = aiResponse.split(/\r?\n/);
    let current: Partial<FAQItem> | null = null;
    let collectingAnswer = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match "FAQ {n}" header
      const faqMatch = /^FAQ\s+(\d+)/i.exec(trimmed);
      if (faqMatch) {
        if (current && current.number && current.question && current.answer) {
          current.characterCount = current.answer.length;
          faqs.push(current as FAQItem);
        }
        current = { number: parseInt(faqMatch[1], 10) };
        collectingAnswer = false;
        continue;
      }

      if (!current) continue;

      // Match "Q: {question}"
      const qMatch = /^Q:\s*(.+)$/i.exec(trimmed);
      if (qMatch) {
        current.question = qMatch[1].trim();
        collectingAnswer = false;
        continue;
      }

      // Match "A: {answer}" - start of answer
      const aMatch = /^A:\s*(.+)$/i.exec(trimmed);
      if (aMatch) {
        current.answer = aMatch[1].trim();
        collectingAnswer = true;
        continue;
      }

      // If we're collecting an answer and this line doesn't match FAQ or Q:, append to answer
      if (collectingAnswer && trimmed && !/^(FAQ\s+\d+|Q:)/i.test(trimmed)) {
        current.answer = (current.answer || "") + " " + trimmed;
      }
    }

    // Push the last FAQ
    if (current && current.number && current.question && current.answer) {
      current.characterCount = current.answer.length;
      faqs.push(current as FAQItem);
    }

    return faqs;
  }

  const parsedFAQs = useMemo(
    () => (aiResponse ? parseAiResponse(aiResponse) : []),
    [aiResponse]
  );

  // Canonical selector: returns edited FAQs if present, otherwise generated FAQs
  const getActiveFaqs = (): FAQItem[] => {
    return editedFAQs ?? parsedFAQs;
  };

  const activeFaqs = useMemo(() => getActiveFaqs(), [editedFAQs, parsedFAQs]);
  const effectiveFAQs = shuffledFAQs ?? activeFaqs;

  useEffect(() => {
    setShuffledFAQs(null);
  }, [aiResponse]);

  useEffect(() => {
    // Reset edited FAQs when new response arrives
    setEditedFAQs(null);
  }, [aiResponse]);

  // Helper to show toast and auto-clear after 1200ms
  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => {
      setActionToast(null);
    }, 1200);
  };

  // Toggle accordion section
  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Summary functions for accordion sections
  const getBusinessBasicsSummary = (): string => {
    const parts: string[] = [];
    if (businessName) parts.push(businessName);
    if (businessType) parts.push(businessType);
    return parts.length > 0 ? parts.join(" • ") : "Not filled";
  };

  const getTopicDetailsSummary = (): string => {
    const parts: string[] = [];
    if (topic) parts.push(topic);
    if (services) parts.push("Details provided");
    return parts.length > 0 ? parts.join(" • ") : "Not filled";
  };

  const getTonePersonalitySummary = (): string => {
    const parts: string[] = [];
    if (tone) parts.push(tone);
    if (personalityStyle) parts.push(personalityStyle);
    if (brandVoice) parts.push("Brand Voice");
    return parts.length > 0 ? parts.join(" • ") : "Not set";
  };

  const getFaqSettingsSummary = (): string => {
    const parts: string[] = [];
    parts.push(`${faqCount} FAQs`);
    parts.push(answerLength);
    parts.push(hasEmoji);
    if (faqTheme) parts.push(faqTheme);
    return parts.join(" • ");
  };

  function getCharacterMeta(count: number) {
    if (count < 50) return { label: `${count} chars (short)`, tone: "muted" };
    if (count > 300) return { label: `${count} chars (long)`, tone: "warning" };
    return { label: `${count} chars`, tone: "default" };
  }

  type FAQTemplate = {
    businessName?: string;
    businessType?: string;
    services?: string;
    topic?: string;
    brandVoice?: string;
    personalityStyle?: string;
    faqCount?: number;
    answerLength?: "Short" | "Medium" | "Long";
    tone?: string;
    hasEmoji?: "None" | "Minimal" | "Normal";
    theme?: string;
  };

  const TEMPLATE_STORAGE_KEY = "obdFaqTemplate_v1";

  const applyTemplate = (parsed: FAQTemplate) => {
    if (parsed.businessName) setBusinessName(parsed.businessName);
    if (parsed.businessType) setBusinessType(parsed.businessType);
    if (parsed.services) setServices(parsed.services);
    if (parsed.topic) setTopic(parsed.topic);
    if (parsed.brandVoice) setBrandVoice(parsed.brandVoice);
    if (parsed.personalityStyle && ["Soft", "Bold", "High-Energy", "Luxury", ""].includes(parsed.personalityStyle)) {
      setPersonalityStyle(parsed.personalityStyle as "Soft" | "Bold" | "High-Energy" | "Luxury" | "");
    }
    if (typeof parsed.faqCount === "number") setFaqCount(parsed.faqCount);
    if (parsed.answerLength) setAnswerLength(parsed.answerLength);
    if (parsed.tone) setTone(parsed.tone);
    if (parsed.hasEmoji) setHasEmoji(parsed.hasEmoji);
    if (parsed.theme) setFaqTheme(parsed.theme);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as FAQTemplate;
      applyTemplate(parsed);
    } catch {
      // ignore
    }
  }, []);

  const handleSaveTemplate = () => {
    if (typeof window === "undefined") return;
    const template: FAQTemplate = {
      businessName,
      businessType,
      services,
      topic,
      brandVoice,
      personalityStyle,
      faqCount,
      answerLength,
      tone,
      hasEmoji,
      theme: faqTheme,
    };
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    alert("Form template saved!");
  };

  const handleLoadTemplate = () => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) {
      alert("No saved template found.");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as FAQTemplate;
      applyTemplate(parsed);
      alert("Form template loaded!");
    } catch {
      alert("Failed to load template.");
    }
  };

  // Format FAQs to text for copying
  const formatFaqsToText = (faqs: FAQItem[]): string => {
    return faqs.map((faq) => `FAQ ${faq.number}\nQ: ${faq.question}\nA: ${faq.answer}`).join("\n\n");
  };

  // Check if FAQs have been edited
  const isEdited = useMemo(() => {
    if (!editedFAQs || editedFAQs.length === 0) return false;
    if (editedFAQs.length !== parsedFAQs.length) return true;
    return editedFAQs.some((edited, idx) => {
      const original = parsedFAQs[idx];
      return !original || edited.question !== original.question || edited.answer !== original.answer;
    });
  }, [editedFAQs, parsedFAQs]);

  // Handlers for inline editing
  const handleEditStart = (index: number) => {
    // Clear shuffle when starting to edit to ensure indices match
    setShuffledFAQs(null);
    const activeFaqs = getActiveFaqs();
    const faq = activeFaqs[index];
    if (faq) {
      setEditingIndex(index);
      setEditQuestion(faq.question);
      setEditAnswer(faq.answer);
    }
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditQuestion("");
    setEditAnswer("");
  };

  const handleEditSave = () => {
    if (editingIndex === null) return;
    
    const trimmedQuestion = editQuestion.trim();
    const trimmedAnswer = editAnswer.trim();
    
    if (!trimmedQuestion || !trimmedAnswer) {
      showToast("Question and answer cannot be empty");
      return;
    }

    const activeFaqs = getActiveFaqs();
    const updatedFAQs = [...activeFaqs];
    const faqToUpdate = updatedFAQs[editingIndex];
    
    updatedFAQs[editingIndex] = {
      ...faqToUpdate,
      question: trimmedQuestion,
      answer: trimmedAnswer,
      characterCount: trimmedAnswer.length,
    };

    setEditedFAQs(updatedFAQs);
    setEditingIndex(null);
    setEditQuestion("");
    setEditAnswer("");
    setShuffledFAQs(null); // Clear shuffle when editing
    showToast("FAQ saved");
  };

  const handleDeleteFAQ = (index: number) => {
    const activeFaqs = getActiveFaqs();
    if (activeFaqs.length <= 1) {
      showToast("Cannot delete the last FAQ");
      return;
    }

    const updatedFAQs = activeFaqs.filter((_, idx) => idx !== index);
    // Renumber FAQs
    const renumberedFAQs = updatedFAQs.map((faq, idx) => ({
      ...faq,
      number: idx + 1,
    }));

    setEditedFAQs(renumberedFAQs);
    setShuffledFAQs(null); // Clear shuffle when deleting
    if (editingIndex === index) {
      handleEditCancel();
    }
    showToast("FAQ deleted");
  };

  const handleAddNewFAQ = () => {
    const activeFaqs = getActiveFaqs();
    const newFAQ: FAQItem = {
      number: activeFaqs.length + 1,
      question: "",
      answer: "",
      characterCount: 0,
    };

    const updatedFAQs = [...activeFaqs, newFAQ];
    setEditedFAQs(updatedFAQs);
    setShuffledFAQs(null); // Clear shuffle when adding
    // Start editing the new FAQ
    setEditingIndex(activeFaqs.length);
    setEditQuestion("");
    setEditAnswer("");
    showToast("New FAQ added");
  };

  const handleShuffleFAQs = () => {
    if (activeFaqs.length < 5) {
      showToast("Need at least 5 FAQs to shuffle");
      return;
    }

    const copy = [...activeFaqs];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setShuffledFAQs(copy);
  };

  const processRequest = async (payload: typeof lastPayload) => {
    if (!payload) return;

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/faq-generator", {
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
      setAiResponse(responseData.response || "Error generating FAQs");
    } catch (error) {
      console.error("Error:", error);
      const { formatUserErrorMessage } = await import("@/lib/api/errorMessages");
      const errorMessage = formatUserErrorMessage(error);
      setError(errorMessage);
      setAiResponse("");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topic.trim()) {
      setError("Please enter a topic to generate your FAQs.");
      return;
    }

    const payload = {
      businessName: businessName || undefined,
      businessType: businessType || undefined,
      city: "Ocala",
      state: "Florida",
      topic,
      details: services || undefined,
      brandVoice: brandVoice || undefined,
      personalityStyle: personalityStyle || undefined,
      faqCount: Math.min(Math.max(3, faqCount), 12),
      answerLength,
      tone: tone || undefined,
      hasEmoji,
      theme: faqTheme || undefined,
    };

    setLastPayload(payload);
    await processRequest(payload);
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    await processRequest(lastPayload);
  };

  const handleCopy = async () => {
    if (activeFaqs.length === 0) {
      showToast("No FAQs to copy");
      return;
    }

    try {
      const textToCopy = formatFaqsToText(activeFaqs);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Failed to copy");
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI FAQ Generator"
      tagline="Create comprehensive FAQ sections for your business website that answer common customer questions."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isDark ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 border border-slate-200"
        }`}>
          {actionToast}
        </div>
      )}

      {/* Imported Questions Panel */}
      {importedQuestions.length > 0 && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={`p-4 rounded-xl border ${
            isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className={`text-sm font-semibold mb-1 ${isDark ? "text-blue-300" : "text-blue-900"}`}>
                  Imported Questions (Draft)
                </h3>
                <p className={`text-xs ${isDark ? "text-blue-400/80" : "text-blue-700/80"}`}>
                  From AI Help Desk Insights • {importedQuestions.length} question{importedQuestions.length === 1 ? "" : "s"}
                </p>
              </div>
              {importedQuestions.length > 10 && (
                <button
                  type="button"
                  onClick={() => setImportedQuestionsExpanded(!importedQuestionsExpanded)}
                  className={`text-xs font-medium ${isDark ? "text-blue-300 hover:text-blue-200" : "text-blue-700 hover:text-blue-800"}`}
                >
                  {importedQuestionsExpanded ? "Collapse" : "Expand"}
                </button>
              )}
            </div>

            {importedQuestionsExpanded && (
              <ul className={`mb-4 space-y-1.5 max-h-60 overflow-y-auto ${
                isDark ? "text-blue-200" : "text-blue-800"
              }`}>
                {importedQuestions.map((q, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span className="flex-1">{q}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // Append to services field
                  setServices((prev) => {
                    const prefix = prev.trim() ? prev.trim() + "\n\n" : "";
                    const questionsSection = "Customer questions to answer:\n" + importedQuestions.map((q) => `- ${q}`).join("\n");
                    return prefix + questionsSection;
                  });
                  showToast("Questions applied to form");
                }}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  isDark
                    ? "border-blue-600 bg-blue-700/50 text-blue-200 hover:bg-blue-700/70"
                    : "border-blue-500 bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Apply to Inputs
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportedQuestions([]);
                  setImportedTopic(undefined);
                  showToast("Imported questions cleared");
                }}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  isDark
                    ? "border-slate-600 bg-slate-700/50 text-slate-200 hover:bg-slate-700/70"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Clear
              </button>
            </div>
          </div>
        </OBDPanel>
      )}

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 pb-24">
            {/* Business Basics Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("businessBasics")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Business Basics
                  </h3>
                  {!accordionState.businessBasics && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getBusinessBasicsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("businessBasics");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.businessBasics ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.businessBasics && (
                <div className="p-4 space-y-4">
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
                  </div>
                </div>
              )}
            </div>

            {/* Topic Details Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("topicDetails")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Topic & Details
                  </h3>
                  {!accordionState.topicDetails && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getTopicDetailsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("topicDetails");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.topicDetails ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.topicDetails && (
                <div className="p-4 space-y-4">
                  <div>
                    <label htmlFor="topic" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Main Topic / Service Area <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., Services, Policies, Hours, Pricing"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Business Details / Services
                    </label>
                    <textarea
                      id="services"
                      value={services}
                      onChange={(e) => setServices(e.target.value)}
                      rows={4}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Describe your main services, products, policies, hours, etc..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tone & Personality Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("tonePersonality")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Tone & Personality
                  </h3>
                  {!accordionState.tonePersonality && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getTonePersonalitySummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("tonePersonality");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.tonePersonality ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.tonePersonality && (
                <div className="p-4 space-y-4">
                  <div>
                    <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Brand Voice Sample (Optional)
                    </label>
                    <textarea
                      id="brandVoice"
                      value={brandVoice}
                      onChange={(e) => setBrandVoice(e.target.value)}
                      rows={3}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Paste 2–4 sentences that sound like your existing brand voice (website, brochure, etc.)"
                    />
                  </div>
                  <div>
                    <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Personality Style
                    </label>
                    <select
                      id="personalityStyle"
                      value={personalityStyle}
                      onChange={(e) => setPersonalityStyle(e.target.value as "Soft" | "Bold" | "High-Energy" | "Luxury" | "")}
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
                      Tone (Optional)
                    </label>
                    <input
                      type="text"
                      id="tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., friendly, professional, casual"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* FAQ Settings Section */}
            <div className={`rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div
                className={`flex items-center justify-between p-4 border-b cursor-pointer ${isDark ? "border-slate-700" : "border-slate-200"}`}
                onClick={() => toggleAccordion("faqSettings")}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    FAQ Settings
                  </h3>
                  {!accordionState.faqSettings && (
                    <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                      {getFaqSettingsSummary()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion("faqSettings");
                  }}
                  className={getSubtleButtonMediumClasses(isDark)}
                >
                  {accordionState.faqSettings ? "Collapse" : "Expand"}
                </button>
              </div>
              {accordionState.faqSettings && (
                <div className="p-4 space-y-4">
                  <div>
                    <label htmlFor="faqCount" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Number of FAQs
                    </label>
                    <input
                      type="number"
                      id="faqCount"
                      value={faqCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setFaqCount(5);
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) {
                          setFaqCount(Math.min(Math.max(3, num), 12));
                        }
                      }}
                      min={3}
                      max={12}
                      className={getInputClasses(isDark)}
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Generate between 3 and 12 FAQs.</p>
                  </div>
                  <div>
                    <label htmlFor="answerLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Answer Length
                    </label>
                    <select
                      id="answerLength"
                      value={answerLength}
                      onChange={(e) => setAnswerLength(e.target.value as "Short" | "Medium" | "Long")}
                      className={getInputClasses(isDark)}
                    >
                      <option value="Short">Short</option>
                      <option value="Medium">Medium</option>
                      <option value="Long">Long</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="hasEmoji" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Emoji Style
                    </label>
                    <select
                      id="hasEmoji"
                      value={hasEmoji}
                      onChange={(e) => setHasEmoji(e.target.value as "None" | "Minimal" | "Normal")}
                      className={getInputClasses(isDark)}
                    >
                      <option value="None">None</option>
                      <option value="Minimal">Minimal</option>
                      <option value="Normal">Normal</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="faqTheme" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Theme (Optional)
                    </label>
                    <input
                      type="text"
                      id="faqTheme"
                      value={faqTheme}
                      onChange={(e) => setFaqTheme(e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., pricing, services, policies"
                    />
                  </div>
                </div>
              )}
            </div>
              </div>
              
              <OBDStickyActionBar isDark={isDark}>
                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating..." : "Generate FAQs"}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleLoadTemplate}
                    disabled={loading}
                    className={getSecondaryButtonClasses(isDark)}
                  >
                    Load Template
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={loading}
                    className={getSecondaryButtonClasses(isDark)}
                  >
                    Save Template
                  </button>
                </div>
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
          title="AI-Generated FAQs"
          isDark={isDark}
          actions={
            (aiResponse || loading || error) ? (
              <OBDResultsActions
                isDark={isDark}
                onCopy={activeFaqs.length > 0 ? handleCopy : undefined}
                copied={copied}
                disabled={loading || activeFaqs.length === 0}
                extra={
                  <>
                    {aiResponse && (
                      <button
                        onClick={() => {
                          if (activeFaqs.length === 0) {
                            showToast("No FAQs to regenerate");
                            return;
                          }
                          handleRegenerate();
                        }}
                        disabled={loading || activeFaqs.length === 0}
                        className={getSecondaryButtonClasses(isDark)}
                      >
                        {loading ? "Regenerating..." : "Regenerate"}
                      </button>
                    )}
                    <button
                      onClick={handleShuffleFAQs}
                      disabled={activeFaqs.length < 5}
                      className={getSecondaryButtonClasses(isDark)}
                    >
                      Shuffle FAQs
                    </button>
                  </>
                }
              />
            ) : undefined
          }
          loading={loading}
          loadingText="Generating FAQs..."
          emptyTitle="No FAQs yet"
          emptyDescription="Fill out the form above and click &quot;Generate FAQs&quot; to create your FAQ section."
          className="mt-8"
        >
              {effectiveFAQs.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                      FAQ Preview
                    </h3>
                    {isEdited && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                        isDark 
                          ? "bg-amber-600/20 text-amber-400 border border-amber-600/30" 
                          : "bg-amber-100 text-amber-700 border border-amber-200"
                      }`}>
                        Edited
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {effectiveFAQs.map((faq, idx) => {
                      const isEditing = editingIndex === idx;
                      const charMeta = getCharacterMeta(faq.characterCount);
                      let charClass = `text-xs mt-3 pt-2 border-t ${
                        isDark ? "border-slate-700" : "border-slate-200"
                      }`;
                      if (charMeta.tone === "warning") charClass += isDark ? " text-amber-400" : " text-amber-600";
                      if (charMeta.tone === "muted") charClass += ` ${themeClasses.mutedText}`;
                      if (charMeta.tone === "default") charClass += isDark ? " text-slate-400" : " text-slate-500";

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4 ${
                            isDark
                              ? "bg-slate-800/50 border-slate-700"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <h4 className={`font-semibold ${themeClasses.headingText}`}>
                              FAQ {faq.number}
                            </h4>
                            <div className="flex items-center gap-2 flex-wrap">
                              {!isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleEditStart(idx)}
                                    className={getSubtleButtonMediumClasses(isDark)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFAQ(idx)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                      isDark
                                        ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30"
                                        : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                    }`}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={handleEditSave}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                      isDark
                                        ? "bg-green-600 text-white hover:bg-green-700"
                                        : "bg-green-600 text-white hover:bg-green-700"
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleEditCancel}
                                    className={getSubtleButtonMediumClasses(isDark)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="space-y-3">
                              <div>
                                <label className={`block text-xs font-medium mb-1.5 ${themeClasses.labelText}`}>
                                  Question
                                </label>
                                <input
                                  type="text"
                                  value={editQuestion}
                                  onChange={(e) => setEditQuestion(e.target.value)}
                                  className={getInputClasses(isDark)}
                                  placeholder="Enter question"
                                />
                              </div>
                              <div>
                                <label className={`block text-xs font-medium mb-1.5 ${themeClasses.labelText}`}>
                                  Answer
                                </label>
                                <textarea
                                  value={editAnswer}
                                  onChange={(e) => setEditAnswer(e.target.value)}
                                  rows={4}
                                  className={getInputClasses(isDark, "resize-none")}
                                  placeholder="Enter answer"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className={`mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                                <p className="font-medium mb-1">Q: {faq.question}</p>
                                <p className={`mt-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                  A: {faq.answer}
                                </p>
                              </div>
                              <p className={charClass}>
                                {charMeta.label}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleAddNewFAQ}
                      className={getSecondaryButtonClasses(isDark)}
                    >
                      + Add New FAQ
                    </button>
                  </div>
                </div>
              )}

              {/* Export Center */}
              {effectiveFAQs.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                  <FAQExportCenterPanel
                    faqs={effectiveFAQs}
                    isDark={isDark}
                    onValidationError={showToast}
                    getActiveFaqs={getActiveFaqs}
                    resolvedBusinessId={resolvedBusinessId}
                    businessName={businessName}
                    businessType={businessType}
                    topic={topic}
                    services={services}
                  />
                </div>
              )}

              {/* Ecosystem Next Steps */}
              {effectiveFAQs.length > 0 && (
                <div className="mt-6">
                  <EcosystemNextSteps
                    title="Next steps"
                    steps={[
                      {
                        id: "schema",
                        label: "Add FAQ Schema",
                        description: "Make your FAQs eligible for rich results.",
                        href: "/apps/business-schema-generator",
                        cta: "Add Schema",
                      },
                      {
                        id: "helpdesk",
                        label: "Import into Help Desk",
                        description: "Answer customer questions automatically.",
                        href: "/apps/ai-help-desk",
                        cta: "Open Help Desk",
                      },
                    ]}
                    dismissKey="tier5c-faq-generator-next-steps"
                    isDark={isDark}
                  />
                </div>
              )}
        </OBDResultsPanel>
      )}

      {/* Toast notification */}
      {actionToast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm transition-opacity ${
            isDark 
              ? "bg-slate-800/90 border border-slate-700/50" 
              : "bg-white/90 border border-slate-200/50"
          }`}>
            {actionToast}
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}

export default function FAQGeneratorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FAQGeneratorPageContent />
    </Suspense>
  );
}

