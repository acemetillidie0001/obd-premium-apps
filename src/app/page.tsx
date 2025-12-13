"use client";

import { useState } from "react";
import Link from "next/link";

const tools = [
  {
    title: "AI Review Responder",
    description: "Generate polished, professional responses to customer reviews in seconds.",
    href: "/apps/review-responder",
    buttonLabel: "Write a Reply",
  },
  {
    title: "AI Business Description Writer",
    description: "Create compelling business descriptions tailored to your Ocala business.",
    href: "/apps/business-description-writer",
    buttonLabel: "Create Description",
  },
  {
    title: "AI Social Media Post Creator",
    description: "Generate engaging social media posts for your business.",
    href: "/apps/social-media-post-creator",
    buttonLabel: "Create Posts",
  },
  {
    title: "AI FAQ Generator",
    description: "Create comprehensive FAQ sections for your business website.",
    href: "/apps/faq-generator",
    buttonLabel: "Generate FAQs",
  },
  {
    title: "AI Content Writer",
    description: "Write high-quality content for your business needs.",
    href: "/apps/content-writer",
    buttonLabel: "Start Writing",
  },
  {
    title: "AI Image Caption Generator",
    description: "Generate creative captions for your business images.",
    href: "/apps/image-caption-generator",
    buttonLabel: "Write Captions",
  },
  {
    title: "Google Business Profile Pro",
    description: "Audit, optimize, and rebuild your Google Business Profile to win more local customers in Ocala and beyond.",
    href: "/apps/google-business-pro",
    buttonLabel: "Optimize Profile",
  },
  {
    title: "Local Keyword Research Tool",
    description: "Discover exactly what local customers are searching for in Ocala and surrounding areas.",
    href: "/apps/local-keyword-research",
    buttonLabel: "Research Keywords",
  },
];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";

  const pageBg = isDark ? "bg-slate-950" : "bg-slate-50";
  const panelBg = isDark ? "bg-slate-900" : "bg-white";
  const mutedText = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <main className={`w-full min-h-screen transition-colors ${pageBg}`}>
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#29c4a9] mb-1">
          Part of OBD Premium Features
        </p>
        <h1
          className={`text-4xl font-bold mb-2 obd-heading ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          OBD Premium Dashboard
        </h1>
        <p className={`max-w-2xl mb-10 obd-soft-text ${mutedText}`}>
          Access all your Ocala-focused AI tools in one place.
        </p>
        
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm transition ${
              isDark
                ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-800"
                : "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: isDark ? "#29c4a9" : "#29c4a9" }}
            />
            {isDark ? "Dark Mode On — Switch to Light" : "Light Mode On — Switch to Dark"}
          </button>
        </div>

        <section
          className={`mt-8 rounded-3xl p-6 md:p-8 transition-colors ${panelBg}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <div
                key={tool.href}
                className={`flex flex-col items-center justify-between rounded-2xl border px-6 py-9 text-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${
                  isDark
                    ? "bg-slate-900/80 border-slate-800 shadow-lg shadow-slate-950/60 text-slate-50"
                    : "bg-white border-slate-200 shadow-md shadow-slate-200 text-slate-900"
                }`}
              >
                <div>
                  <h2
                    className={`text-xl font-semibold mb-2 ${
                      isDark ? "text-slate-50" : "text-slate-900"
                    }`}
                  >
                    {tool.title}
                  </h2>
                  <p className={`mb-4 ${mutedText}`}>
                    {tool.description}
                  </p>
                </div>
                <Link
                  href={tool.href}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#29c4a9] px-6 py-2 text-sm font-semibold text-white hover:bg-[#22ad93] shadow-md shadow-[#29c4a9]/40 hover:shadow-lg hover:shadow-[#29c4a9]/60 transition"
                >
                  {tool.buttonLabel}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
