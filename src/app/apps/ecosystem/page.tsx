"use client";

import { useMemo, type ComponentType } from "react";
import {
  Bot,
  CalendarClock,
  Contact,
  Megaphone,
  Palette,
  Send,
  Sparkles,
  HelpCircle,
} from "lucide-react";

import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import styles from "./ecosystem.module.css";

type AppCardId =
  | "brand-kit"
  | "content-writer"
  | "scheduler"
  | "social"
  | "crm"
  | "review-requests"
  | "help-desk"
  | "faq-generator";

type AppCard = {
  id: AppCardId;
  name: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  lgPlacementClassName: string;
};

function getEcosystemTooltip(appId: AppCardId): string | null {
  switch (appId) {
    case "brand-kit":
      return "Apply Brand Kit settings";
    case "crm":
      return "Manual link to contacts";
    case "faq-generator":
      return "Draft FAQ handoff";
    default:
      return null;
  }
}

function EcosystemAppCard({
  isDark,
  app,
}: {
  isDark: boolean;
  app: AppCard;
}) {
  const theme = getThemeClasses(isDark);
  const tooltip = getEcosystemTooltip(app.id);
  const cardBg = isDark ? "bg-slate-950/30" : "bg-slate-50";
  const cardBorder = isDark ? "border-slate-700/60" : "border-slate-200";
  const cardHover = isDark ? "hover:bg-slate-950/45" : "hover:bg-white";

  return (
    <div
      className={[
        "group relative z-10 h-full rounded-2xl border p-4 transition-colors",
        cardBg,
        cardBorder,
        cardHover,
        app.lgPlacementClassName,
        styles.appCard,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border",
            isDark ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-white",
          ].join(" ")}
          aria-hidden="true"
        >
          <app.Icon className="h-5 w-5 text-[#29c4a9]" />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${theme.headingText}`}>{app.name}</div>
          <p className={`mt-1 text-xs leading-relaxed ${theme.mutedText}`}>{app.description}</p>
        </div>
      </div>

      {tooltip ? (
        <div
          className={[
            "pointer-events-none absolute left-4 top-0 -translate-y-2",
            "hidden lg:block",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            "rounded-md border px-2 py-1 text-[11px] shadow-sm",
            isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-200 bg-white text-slate-700",
          ].join(" ")}
          role="tooltip"
        >
          {tooltip}
        </div>
      ) : null}
    </div>
  );
}

function EcosystemConnectors({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? "rgba(148,163,184,0.55)" : "rgba(100,116,139,0.55)"; // slate-400/500-ish
  const dashed = isDark ? "rgba(148,163,184,0.45)" : "rgba(100,116,139,0.45)";

  return (
    <svg
      className={`absolute inset-0 z-0 hidden lg:block ${styles.connectors}`}
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
        </marker>
      </defs>

      {/* Brand Kit → Content Writer */}
      <path
        d="M375 255 L375 155"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrow)"
      />

      {/* Brand Kit → Scheduler */}
      <path
        d="M425 250 L585 160"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrow)"
      >
        <title>Apply Brand Kit settings</title>
      </path>

      {/* Brand Kit → Social Auto-Poster */}
      <path
        d="M435 235 L825 150"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrow)"
      />

      {/* Brand Kit → AI Help Desk */}
      <path
        d="M450 300 L560 300"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrow)"
      />

      {/* Help Desk ↔ Scheduler */}
      <path
        d="M625 255 L625 155"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerStart="url(#arrow)"
        markerEnd="url(#arrow)"
      />

      {/* Help Desk ↔ FAQ Generator (polyline to avoid crossing the center) */}
      <path
        d="M590 270 L470 210 L210 130"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerStart="url(#arrow)"
        markerEnd="url(#arrow)"
      >
        <title>Draft FAQ handoff</title>
      </path>

      {/* CRM ↔ Scheduler (routed around right side to avoid implying Help Desk link) */}
      <path
        d="M650 155 L770 155 L770 500 L650 445"
        stroke={dashed}
        strokeWidth="2"
        fill="none"
        strokeDasharray="6 6"
        markerStart="url(#arrow)"
        markerEnd="url(#arrow)"
      >
        <title>Manual link to contacts</title>
      </path>

      {/* CRM ↔ Review Requests */}
      <path
        d="M690 500 L810 500"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        markerStart="url(#arrow)"
        markerEnd="url(#arrow)"
      />
    </svg>
  );
}

export default function EcosystemOverviewPage() {
  const { theme, isDark, setTheme, toggleTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);

  const apps = useMemo<AppCard[]>(
    () => [
      {
        id: "faq-generator",
        name: "AI FAQ Generator",
        description: "Turn approved content into customer-ready FAQs that can be reviewed and exported.",
        Icon: HelpCircle,
        lgPlacementClassName: "lg:col-start-1 lg:row-start-1",
      },
      {
        id: "content-writer",
        name: "AI Content Writer",
        description: "Draft-first copy generation that stays aligned with your brand voice and goals.",
        Icon: Sparkles,
        lgPlacementClassName: "lg:col-start-2 lg:row-start-1",
      },
      {
        id: "scheduler",
        name: "Scheduler & Booking",
        description: "Bookings and appointment context, designed to stay tenant-safe and explicit.",
        Icon: CalendarClock,
        lgPlacementClassName: "lg:col-start-3 lg:row-start-1",
      },
      {
        id: "social",
        name: "Social Auto-Poster",
        description: "Queue + approval-driven publishing—no silent background posting.",
        Icon: Megaphone,
        lgPlacementClassName: "lg:col-start-4 lg:row-start-1",
      },
      {
        id: "brand-kit",
        name: "Brand Kit",
        description: "A single source of truth for colors, voice, and reusable brand assets.",
        Icon: Palette,
        lgPlacementClassName: "lg:col-start-2 lg:row-start-2",
      },
      {
        id: "help-desk",
        name: "AI Help Desk",
        description: "Knowledge + answers with explicit imports and review-first handling.",
        Icon: Bot,
        lgPlacementClassName: "lg:col-start-3 lg:row-start-2",
      },
      {
        id: "crm",
        name: "CRM",
        description: "Contacts and history that can inform scheduling and review outreach—explicitly.",
        Icon: Contact,
        lgPlacementClassName: "lg:col-start-3 lg:row-start-3",
      },
      {
        id: "review-requests",
        name: "Review Request Automation",
        description: "Request flows that stay business-controlled and never cross tenants.",
        Icon: Send,
        lgPlacementClassName: "lg:col-start-4 lg:row-start-3",
      },
    ],
    []
  );

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={toggleTheme}
      theme={theme}
      onThemeChange={setTheme}
      title="OBD Ecosystem Overview"
      tagline="How OBD Premium tools are designed to work together — always with explicit control."
    >
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="space-y-3">
          <p className={`text-sm leading-relaxed ${themeClasses.mutedText}`}>
            OBD Premium is a suite of focused tools designed to work together without automation surprises.
            Each connection is explicit, draft-first, and business-controlled.
          </p>
          <div
            className={[
              "rounded-xl border p-3 text-xs",
              isDark
                ? "border-slate-700 bg-slate-900/40 text-slate-200"
                : "border-slate-200 bg-slate-50 text-slate-700",
            ].join(" ")}
          >
            <span className="font-medium">Key idea:</span> when one tool “connects” to another, it means
            a deliberate export/import, an explicit approval step, or a controlled mapping—never hidden
            automation.
          </div>
        </div>
      </OBDPanel>

      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <OBDHeading level={2} isDark={isDark}>
              Ecosystem map
            </OBDHeading>
            <p className={`mt-2 text-xs leading-relaxed ${themeClasses.mutedText}`}>
              A conceptual view of how the apps relate. Lines illustrate intent and information flow—not
              automatic execution.
            </p>
          </div>
        </div>

        <div className="mt-5 relative lg:min-h-[520px]">
          <EcosystemConnectors isDark={isDark} />

          <div
            className={[
              "relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-3 gap-3 lg:gap-5 lg:min-h-[520px]",
              styles.ecosystemGrid,
            ].join(" ")}
          >
            {apps.map((app) => (
              <EcosystemAppCard key={app.id} isDark={isDark} app={app} />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Legend">
          {["Apply-only", "Draft-first", "Manual linking"].map((label) => (
            <span
              key={label}
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]",
                isDark ? "border-slate-700 bg-slate-900/40 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700",
              ].join(" ")}
            >
              {label}
            </span>
          ))}
        </div>

        <p className={`mt-4 text-xs ${themeClasses.mutedText}`}>
          On mobile, the map collapses to cards-first for readability; the relationships are fully
          described below.
        </p>
      </OBDPanel>

      <OBDPanel isDark={isDark} className="mt-7">
        <OBDHeading level={2} isDark={isDark}>
          How the relationships work (conceptually)
        </OBDHeading>

        <div className="mt-4 space-y-4">
          <div>
            <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Brand Kit as the source of truth
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${themeClasses.mutedText}`}>
              Brand Kit establishes your reusable foundation (voice, tone cues, colors, and core assets).
              Other apps can reference that foundation through explicit import/apply steps—so brand
              changes never “silently” rewrite live content.
            </p>
          </div>

          <div>
            <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Content Writer supports downstream drafts
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${themeClasses.mutedText}`}>
              The Content Writer produces drafts you can reuse for FAQs, social posts, and help desk
              knowledge—but reuse is always controlled (copy/export/import), never automatic publishing.
            </p>
          </div>

          <div>
            <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Scheduler, CRM, and review requests stay explicit
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${themeClasses.mutedText}`}>
              Scheduler and CRM can share context conceptually (contacts, appointment history, outcomes),
              and Review Requests can be informed by CRM—but all flows are designed to be tenant-safe and
              business-controlled, with no cross-business visibility.
            </p>
          </div>

          <div>
            <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Help Desk + FAQ Generator are a deliberate knowledge loop
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${themeClasses.mutedText}`}>
              Help Desk content can be curated into FAQs (and FAQs can be imported back as knowledge),
              but only through explicit approval. This avoids “AI changed my site” surprises.
            </p>
          </div>
        </div>
      </OBDPanel>

      <OBDPanel isDark={isDark} className="mt-7">
        <OBDHeading level={2} isDark={isDark}>
          What OBD does not do
        </OBDHeading>

        <ul className={`mt-4 list-disc list-inside space-y-2 text-sm ${themeClasses.mutedText}`}>
          <li>No automatic publishing</li>
          <li>No background automation</li>
          <li>No cross-business data sharing</li>
          <li>No AI actions without approval</li>
        </ul>
      </OBDPanel>
    </OBDPageContainer>
  );
}

