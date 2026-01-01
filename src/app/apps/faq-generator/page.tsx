"use client";

import { useState, useMemo, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyActionBar from "@/components/obd/OBDStickyActionBar";
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDResultsActions from "@/components/obd/OBDResultsActions";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

export default function FAQGeneratorPage() {
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

  const effectiveFAQs = shuffledFAQs ?? parsedFAQs;

  useEffect(() => {
    setShuffledFAQs(null);
  }, [aiResponse]);

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

  const handleShuffleFAQs = () => {
    if (parsedFAQs.length < 5) return;

    const copy = [...parsedFAQs];
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
    try {
      await navigator.clipboard.writeText(aiResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI FAQ Generator"
      tagline="Create comprehensive FAQ sections for your business website that answer common customer questions."
    >
      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-end gap-2 mb-4">
                <button
                  type="button"
                  onClick={handleLoadTemplate}
                  className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Load Template
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                    isDark
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Save Template
                </button>
              </div>
              <div className="space-y-4 pb-24">
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
                  <label htmlFor="topic" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Main Topic / Service Area
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
              
              <OBDStickyActionBar isDark={isDark}>
                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating..." : "Generate FAQs"}
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
          title="AI-Generated FAQs"
          isDark={isDark}
          actions={
            (aiResponse || loading || error) ? (
              <OBDResultsActions
                isDark={isDark}
                onCopy={aiResponse ? handleCopy : undefined}
                copied={copied}
                disabled={loading}
                extra={
                  <>
                    {aiResponse && (
                      <button
                        onClick={handleRegenerate}
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
                    {parsedFAQs.length >= 5 && (
                      <button
                        onClick={handleShuffleFAQs}
                        disabled={parsedFAQs.length < 5}
                        className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Shuffle FAQs
                      </button>
                    )}
                  </>
                }
              />
            ) : undefined
          }
          loading={loading}
          emptyState={
            <p className={`italic obd-soft-text ${isDark ? "text-slate-500" : "text-gray-400"}`}>
              Your AI-generated FAQs will appear here...
            </p>
          }
          className="mt-8"
        >
              {effectiveFAQs.length > 0 && (
                <div className="mb-6">
                  <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                    FAQ Preview
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {effectiveFAQs.map((faq, idx) => {
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
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className={`font-semibold ${themeClasses.headingText}`}>
                              FAQ {faq.number}
                            </h4>
                          </div>
                          <div className={`mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                            <p className="font-medium mb-1">Q: {faq.question}</p>
                            <p className={`mt-2 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                              A: {faq.answer}
                            </p>
                          </div>
                          <p className={charClass}>
                            {charMeta.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          <div className={`min-h-[200px] p-4 border ${themeClasses.inputBorder} rounded-xl ${
            isDark ? "bg-slate-800" : "bg-gray-50"
          }`}>
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

