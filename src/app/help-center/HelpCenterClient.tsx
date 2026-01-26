"use client";

import { useMemo, useRef, useState } from "react";

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

export default function HelpCenterClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ViewState>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");

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
    const trimmed = query.trim();
    if (!trimmed) return;
    await runQuery(trimmed);
  };

  const onQuickAction = async (nextQuery: string) => {
    setQuery(nextQuery);
    inputRef.current?.focus();
    await runQuery(nextQuery);
  };

  const paragraphs = useMemo(() => (answer ? normalizeParagraphs(answer) : []), [answer]);
  const isLoading = state === "loading";
  const isEmpty = state === "idle" && !answer && !errorMessage;

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

          <p id="help-center-helper" className="mt-3 text-xs md:text-sm text-slate-600">
            This is a read-only discovery layer. No account actions, no
            publishing, no changes.
          </p>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-900">
              Guided entry prompts
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {guidedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={CHIP_CLASSES}
                  onClick={() => void onQuickAction(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
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

        {/* Results / State */}
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

          {state === "success" && answer ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Answer</h2>

              <div className="mt-3 space-y-3 text-sm text-slate-700">
                {paragraphs.length > 0 ? (
                  paragraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{answer}</p>
                )}
              </div>

              <p className="mt-5 text-xs text-slate-600">
                Answers are based on OBD documentation and saved knowledge only.
              </p>

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
        </section>

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
            Still need help? Email{" "}
            <a
              className="underline text-slate-700 hover:text-slate-900"
              href="mailto:support@ocalabusinessdirectory.com"
            >
              support@ocalabusinessdirectory.com
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

