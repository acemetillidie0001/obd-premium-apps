"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const INPUT_CLASSES =
  "w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-2xl focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-slate-400 outline-none";

const CHIP_CLASSES =
  "inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-slate-400 outline-none";

type HelpCenterQueryResponse = {
  answer: string;
  sources?: unknown[];
  meta?: { workspace?: string };
};

type ViewState = "idle" | "loading" | "success" | "error";

function normalizeParagraphs(text: string): string[] {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];
  return trimmed.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function isVeryShortEchoQuery(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 12) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= 2;
}

export default function HelpCenterClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tipsRef = useRef<HTMLDivElement | null>(null);
  const answerCardRef = useRef<HTMLDivElement | null>(null);
  const queryRunIdRef = useRef(0);
  const currentRunIdRef = useRef<number | null>(null);
  const lastAutoScrollRunIdRef = useRef<number | null>(null);
  const lastSubmittedQueryRef = useRef<string>("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ViewState>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);

  const guidedPrompts = useMemo(
    () => [
      "How does Local SEO Page Builder work?",
      "Does OBD auto-publish anything?",
      "What’s the difference between GBP Pro and Local SEO Pages?",
      "Why are exports draft-only?",
      "How do Teams & Users permissions work?",
    ],
    [],
  );

  const quickLinks = useMemo(
    () => [
      {
        label: "Getting Started with OBD Premium",
        query: "How do I get started with OBD Premium tools?",
      },
      {
        label: "Trust & Safety Principles",
        query: "What are OBD’s trust and safety principles for these tools and the Help Center?",
      },
      {
        label: "Draft-Only Philosophy",
        query: "Explain OBD’s draft-only philosophy and what it prevents.",
      },
      {
        label: "Exporting Content Safely",
        query: "How should I export content safely from OBD tools?",
      },
      {
        label: "Managing Teams & Access",
        query: "How do Teams & Users permissions work, and how do I manage access?",
      },
    ],
    [],
  );

  const runQuery = async (nextQueryRaw: string) => {
    const trimmed = nextQueryRaw.trim();
    if (!trimmed) return;

    setHasSearched(true);
    lastSubmittedQueryRef.current = trimmed;

    queryRunIdRef.current += 1;
    currentRunIdRef.current = queryRunIdRef.current;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    setErrorMessage(null);
    setAnswer(null);

    try {
      const res = await fetch("/api/help-center/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal,
      });

      let data: HelpCenterQueryResponse | null = null;
      try {
        data = (await res.json()) as HelpCenterQueryResponse;
      } catch {
        // Content-type guard (HTML/non-JSON or invalid JSON)
        throw new Error("Help Center is temporarily unavailable. Please try again.");
      }

      if (!res.ok) {
        const msg =
          typeof data?.answer === "string" && data.answer.trim().length > 0
            ? data.answer.trim()
            : "We couldn’t retrieve an answer right now. Please try again.";
        setErrorMessage(msg);
        setState("error");
        return;
      }

      const nextAnswer =
        typeof data?.answer === "string" && data.answer.trim().length > 0
          ? data.answer.trim()
          : "No answer was returned. Please try a different question.";

      setAnswer(nextAnswer);
      setState("success");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMessage("Help Center is temporarily unavailable. Please try again.");
      setState("error");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.focus();
    const trimmed = query.trim();
    if (!trimmed) return;
    await runQuery(trimmed);
  };

  const onQuickAction = async (nextQuery: string) => {
    setQuery(nextQuery);
    inputRef.current?.focus();
    await runQuery(nextQuery);
  };

  const clearSearch = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    lastAutoScrollRunIdRef.current = null;
    currentRunIdRef.current = null;
    lastSubmittedQueryRef.current = "";
    setQuery("");
    setAnswer(null);
    setErrorMessage(null);
    setFollowUp("");
    setHasSearched(false);
    setState("idle");
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!(state === "success" && answer)) return;
    const el = answerCardRef.current;
    if (!el) return;

    const runId = currentRunIdRef.current;
    if (runId != null && lastAutoScrollRunIdRef.current === runId) return;

    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const isFullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight;

      if (!isFullyVisible) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (runId != null) lastAutoScrollRunIdRef.current = runId;
    });
  }, [state, answer]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";
      if (isEditable) return;

      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isTipsOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (tipsRef.current?.contains(target)) return;
      setIsTipsOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsTipsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isTipsOpen]);

  const paragraphs = useMemo(() => (answer ? normalizeParagraphs(answer) : []), [answer]);
  const isLoading = state === "loading";
  const isEmpty = state === "idle" && !answer && !errorMessage;
  const shouldRenderStatusSection =
    state === "loading" || (state === "error" && errorMessage);
  const echoQuery = lastSubmittedQueryRef.current;
  const shouldShowQuestionEcho = echoQuery.length > 0 && !isVeryShortEchoQuery(echoQuery);
  const chipClassName = hasSearched
    ? `${CHIP_CLASSES} opacity-70 hover:opacity-100 transition-opacity`
    : CHIP_CLASSES;

  const renderAnswerBlock = (p: string, idx: number) => {
    const lines = p
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const unorderedMatch = lines.map((l) => l.match(/^[-*•]\s+(.*)$/)).filter(Boolean);
    if (lines.length >= 2 && unorderedMatch.length === lines.length) {
      const items = unorderedMatch.map((m) => (m as RegExpMatchArray)[1]);
      return (
        <ul key={`ul-${idx}`} className="list-disc pl-4 space-y-1.5">
          {items.map((item, itemIdx) => (
            <li key={`ul-${idx}-${itemIdx}`} className="whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ul>
      );
    }

    const orderedMatch = lines.map((l) => l.match(/^\d+\.\s+(.*)$/)).filter(Boolean);
    if (lines.length >= 2 && orderedMatch.length === lines.length) {
      const items = orderedMatch.map((m) => (m as RegExpMatchArray)[1]);
      return (
        <ol key={`ol-${idx}`} className="list-decimal pl-4 space-y-1.5">
          {items.map((item, itemIdx) => (
            <li key={`ol-${idx}-${itemIdx}`} className="whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p key={`p-${idx}`} className="whitespace-pre-wrap">
        {p}
      </p>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <header className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
            OBD Premium Help Center
          </h1>
          <p className="text-base md:text-lg text-slate-700">
            Search across OBD tools to find answers, explanations, and guidance.
          </p>
          <p className="text-sm text-slate-600">
            Answers are based on OBD documentation and saved knowledge only.
            Nothing is automated or changed.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
            onSubmit={onSubmit}
          >
            <label className="sr-only" htmlFor="help-center-query">
              Ask a question
            </label>
            <input
              ref={inputRef}
              id="help-center-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                setIsTipsOpen(false);
                e.currentTarget.blur();
              }}
              onFocus={(e) => {
                if (answer) e.currentTarget.select();
              }}
              onClick={(e) => {
                if (answer) e.currentTarget.select();
              }}
              placeholder="Ask a question…"
              className={INPUT_CLASSES}
              autoComplete="off"
              inputMode="text"
              aria-describedby="help-center-helper"
            />
            <button
              type="submit"
              disabled={isLoading || query.trim().length === 0}
              className="rounded-2xl border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-slate-400 outline-none"
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
          </form>

          <div ref={tipsRef} className="relative mt-3 inline-flex items-center gap-2">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isTipsOpen}
              aria-controls="help-center-search-tips"
              onClick={() => setIsTipsOpen((v) => !v)}
              onFocus={() => setIsTipsOpen(true)}
              onMouseEnter={() => setIsTipsOpen(true)}
              onMouseLeave={() => setIsTipsOpen(false)}
              className="inline-flex items-center gap-1 text-xs md:text-sm text-slate-600 hover:text-slate-800 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none rounded"
            >
              <span>Search tips</span>
              <span aria-hidden="true" className="text-slate-500">
                ℹ︎
              </span>
            </button>

            <div
              id="help-center-search-tips"
              role="dialog"
              aria-label="Search tips"
              aria-hidden={!isTipsOpen}
              className={[
                "absolute left-0 top-full z-10 mt-2 w-72 max-w-[80vw] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm",
                "text-xs text-slate-700",
                "transition-opacity duration-150",
                isTipsOpen ? "opacity-100" : "pointer-events-none opacity-0",
              ].join(" ")}
            >
              <ul className="list-disc space-y-1 pl-5">
                <li>Ask full questions or simple phrases</li>
                <li>You can ask what an app does or doesn’t do</li>
                <li>Answers are based on OBD documentation only</li>
                <li>Nothing is changed or published</li>
              </ul>
            </div>
          </div>

          <p id="help-center-helper" className="mt-3 text-xs md:text-sm text-slate-600">
            This is a read-only discovery layer. No account actions, no
            publishing, no changes.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Looking for tools?{" "}
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-800 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none rounded"
            >
              Return to your dashboard.
            </Link>
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            <Link
              href="/apps/ecosystem"
              className="text-slate-600 hover:text-slate-800 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none rounded"
            >
              How OBD tools work together
            </Link>
          </p>

          {!hasSearched && isEmpty ? (
            <div className="mt-3 space-y-1">
              <p className="text-xs md:text-sm text-slate-600">Not sure where to start?</p>
              <p className="text-xs md:text-sm text-slate-600">
                You can ask how any OBD tool works, what it does (or doesn’t do), or how drafts and
                exports are handled.
              </p>
              <p className="text-xs md:text-sm text-slate-600">
                This Help Center is read-only — nothing is published, changed, or applied.
              </p>
              <p className="text-xs text-slate-500">
                Try a simple question like: “How do I get started with OBD Premium?”
              </p>
            </div>
          ) : null}

          {answer ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  inputRef.current?.focus();
                  inputRef.current?.select();
                }}
                aria-label="Focus the search input to ask another question"
                className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none rounded"
              >
                Ask another question
              </button>
            </div>
          ) : null}

          {state === "success" && answer ? (
            <div
              ref={answerCardRef}
              id="answer"
              className="mt-6 rounded-3xl border border-slate-300 bg-white p-5 md:p-7 shadow-md obdHelpCenterAnswerCard"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-900">Answer</h2>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none rounded"
                >
                  Clear search
                </button>
              </div>

              {shouldShowQuestionEcho ? (
                <p className="mt-2 text-xs text-slate-500">
                  Answer to: “{echoQuery}”
                </p>
              ) : null}

              <div className="mt-3 space-y-4 text-sm text-slate-700 leading-[1.7]">
                {paragraphs.length > 0 ? (
                  paragraphs.map((p, idx) => renderAnswerBlock(p, idx))
                ) : (
                  <p className="whitespace-pre-wrap">{answer}</p>
                )}
              </div>

              <footer className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-[11px] text-slate-500">
                  This answer is based on OBD documentation and saved knowledge only.
                </p>
              </footer>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">Ask a follow-up</h3>
                <form
                  className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = followUp.trim();
                    if (!trimmed) return;
                    setQuery(trimmed);
                    setFollowUp("");
                    void runQuery(trimmed);
                  }}
                >
                  <label className="sr-only" htmlFor="help-center-follow-up">
                    Ask a follow-up
                  </label>
                  <input
                    id="help-center-follow-up"
                    type="text"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Escape") return;
                      e.currentTarget.blur();
                    }}
                    placeholder="Ask a follow-up…"
                    className={INPUT_CLASSES}
                    autoComplete="off"
                    inputMode="text"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || followUp.trim().length === 0}
                    className="rounded-2xl border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-slate-400 outline-none"
                  >
                    Ask
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-900">
              Guided entry prompts
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {guidedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={chipClassName}
                  onClick={() => void onQuickAction(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section
          className={[
            "mt-6 rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm",
            hasSearched ? "opacity-85 transition-opacity duration-150" : "",
          ].join(" ")}
        >
          <h2 className="text-sm font-semibold text-slate-900">
            Trust &amp; Safety Principles
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>No automation</li>
            <li>No publishing</li>
            <li>No account changes</li>
            <li>No browsing the web</li>
            <li>Based only on saved OBD documentation</li>
          </ul>
        </section>

        {shouldRenderStatusSection ? (
          <section className="mt-8">
            {isEmpty ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
                <p className="text-sm text-slate-700">
                  Ask a question to search OBD documentation and saved knowledge.
                  If you’re not sure where to start, try one of the guided prompts
                  above.
                </p>
              </div>
            ) : null}

            {state === "loading" ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
                <p className="text-sm text-slate-700">Searching OBD documentation…</p>
              </div>
            ) : null}

            {state === "error" && errorMessage ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Unable to answer</h2>
                <p className="mt-2 text-sm text-slate-700">{errorMessage}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Quick Links</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {quickLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => void onQuickAction(link.query)}
                className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none"
              >
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-14 border-t border-slate-200 pt-8">
          <p className="text-xs md:text-sm text-slate-600">
            Need human help?{" "}
            <a
              className="underline text-slate-700 hover:text-slate-900"
              href="https://ocalabusinessdirectory.com/contact/"
            >
              Visit Support.
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

