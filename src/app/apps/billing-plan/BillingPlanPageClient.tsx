"use client";

import { useEffect, useMemo, useState } from "react";

import type { TeamRole } from "@prisma/client";

import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses } from "@/lib/obd-framework/theme";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string; code?: string; details?: unknown };

function isOk<T>(x: unknown): x is ApiOk<T> {
  return !!x && typeof x === "object" && (x as any).ok === true && "data" in (x as any);
}

function isErr(x: unknown): x is ApiErr {
  return !!x && typeof x === "object" && (x as any).ok === false && typeof (x as any).error === "string";
}

type Member = {
  userId: string;
  role: "OWNER" | "ADMIN" | "STAFF" | string;
  status: "ACTIVE" | "SUSPENDED" | string;
};

type SessionUser = { id?: string | null; email?: string | null };

function formatRole(role: TeamRole | null): string {
  if (!role) return "—";
  if (role === "OWNER") return "Owner";
  if (role === "ADMIN") return "Admin";
  return "Staff";
}

type PlanLabel = "Free" | "Premium" | "Premium Plus";

type ToolRow = {
  name: string;
  plan: PlanLabel;
};

type ToolCategory = {
  category: string;
  tools: ToolRow[];
};

type PlanCardProps = {
  title: string;
  priceLine: string;
  description: string;
  bullets: string[];
  note?: string;
  ctaLabel: string;
  ctaDisabled: boolean;
  showUpgradeMicrocopy?: boolean;
  upgradeMicrocopy: string;
  isDark: boolean;
};

function PlanCard({
  title,
  priceLine,
  description,
  bullets,
  note,
  ctaLabel,
  ctaDisabled,
  showUpgradeMicrocopy,
  upgradeMicrocopy,
  isDark,
}: PlanCardProps) {
  const border = isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white";
  const heading = isDark ? "text-slate-100" : "text-slate-900";
  const muted = isDark ? "text-slate-300" : "text-slate-600";
  const button =
    ctaDisabled
      ? isDark
        ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
        : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
      : "bg-[#29c4a9] text-white hover:bg-[#22ad93]";

  return (
    <div className={`rounded-2xl border p-6 ${border}`}>
      <div className="space-y-2">
        <div className={`text-lg font-semibold ${heading}`}>{title}</div>
        <div className={`text-3xl font-bold tracking-tight ${heading}`}>{priceLine}</div>
        <p className={`text-sm leading-relaxed ${muted}`}>{description}</p>
      </div>

      <ul className={`mt-5 space-y-2 text-sm ${muted}`}>
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-slate-400" aria-hidden="true">
              •
            </span>
            <span className="min-w-0">{b}</span>
          </li>
        ))}
      </ul>

      {note ? <p className={`mt-4 text-xs leading-relaxed ${muted} opacity-80`}>{note}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          disabled={ctaDisabled}
          aria-disabled={ctaDisabled ? "true" : "false"}
          className={`w-full rounded-full px-5 py-2.5 text-sm font-semibold transition ${button}`}
        >
          {ctaLabel}
        </button>
        {showUpgradeMicrocopy ? <p className={`mt-2 text-xs ${muted} opacity-80`}>{upgradeMicrocopy}</p> : null}
      </div>
    </div>
  );
}

export default function BillingPlanPageClient({ billingEnabled }: { billingEnabled: boolean }) {
  const { theme, isDark, setTheme, toggleTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<TeamRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      setRoleLoading(true);
      try {
        const [sessionRes, membersRes] = await Promise.all([
          fetch("/api/debug/session", { cache: "no-store" }),
          fetch("/api/teams-users/members", { cache: "no-store" }),
        ]);

        const sessionJson = (await sessionRes.json().catch(() => null)) as any;
        const membersJson = (await membersRes.json().catch(() => null)) as unknown;

        const sessionUser = (sessionJson?.user ?? null) as SessionUser | null;
        const userId = sessionUser?.id ?? null;
        const email = sessionUser?.email ?? null;

        if (!cancelled) setSessionEmail(typeof email === "string" ? email : null);

        if (!sessionRes.ok || !userId) {
          if (!cancelled) setMyRole(null);
          return;
        }

        if (!membersRes.ok) {
          const msg = isErr(membersJson) ? membersJson.error : "Unable to load membership.";
          throw new Error(msg);
        }
        if (!isOk<Member[]>(membersJson)) {
          throw new Error("Unexpected members response.");
        }

        const me = membersJson.data.find((m) => m.userId === userId) ?? null;
        const roleRaw = me?.role ?? null;
        const role: TeamRole | null =
          roleRaw === "OWNER" || roleRaw === "ADMIN" || roleRaw === "STAFF" ? (roleRaw as TeamRole) : null;

        if (!cancelled) setMyRole(role);
      } catch {
        // Conservative fallback: if we can't verify role, treat as non-manager.
        if (!cancelled) setMyRole(null);
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const canManageBilling = myRole === "OWNER" || myRole === "ADMIN";

  const upgradeMicrocopy = !billingEnabled
    ? "Billing is being finalized and will be available soon."
    : !canManageBilling
      ? "Only Owners and Admins can manage billing for this business."
      : "";

  const toolCategories: ToolCategory[] = useMemo(
    () => [
      {
        category: "Content & Writing Tools",
        tools: [
          { name: "AI Review Responder", plan: "Free" },
          { name: "AI Business Description Writer", plan: "Free" },
          { name: "AI Social Media Post Creator (drafts)", plan: "Free" },
          { name: "AI Content Writer", plan: "Free" },
          { name: "AI FAQ Generator", plan: "Free" },
          { name: "AI Image Caption Generator (drafts)", plan: "Free" },
        ],
      },
      {
        category: "Reputation & Reviews",
        tools: [
          { name: "Reputation Dashboard (insights)", plan: "Free" },
          { name: "Review Request Automation", plan: "Premium" },
        ],
      },
      {
        category: "Google Business & Local Search",
        tools: [
          { name: "Google Business Profile Pro (planning/audit)", plan: "Free" },
          { name: "Google Business execution tools", plan: "Premium" },
          { name: "Local Keyword Research Tool", plan: "Free" },
        ],
      },
      {
        category: "SEO Tools",
        tools: [
          { name: "Local SEO Page Builder (draft-only)", plan: "Free" },
          { name: "Business Schema Generator (draft-only)", plan: "Free" },
          { name: "SEO Audit & Roadmap", plan: "Free" },
        ],
      },
      {
        category: "Productivity & Automation",
        tools: [
          { name: "OBD Social Auto-Poster", plan: "Premium" },
          { name: "OBD Scheduler & Booking", plan: "Premium" },
          { name: "OBD CRM", plan: "Premium" },
          { name: "Advanced workflow coordination", plan: "Premium Plus" },
        ],
      },
      {
        category: "Design & Branding",
        tools: [
          { name: "AI Logo Generator", plan: "Free" },
          { name: "Brand Kit Builder", plan: "Free" },
        ],
      },
      {
        category: "Support & Learning",
        tools: [
          { name: "AI Help Desk (internal use)", plan: "Free" },
          { name: "AI Help Desk (customer-facing widget)", plan: "Premium" },
          { name: "Advanced help desk workflows", plan: "Premium Plus" },
          { name: "Help Center & Learning Resources", plan: "Free" },
        ],
      },
    ],
    []
  );

  const plans = useMemo(
    (): Array<{
      key: "claimed" | "premium" | "premium-plus";
      title: string;
      priceLine: string;
      description: string;
      bullets: string[];
      note?: string;
      ctaLabel: string;
      ctaDisabled: boolean;
      showUpgradeMicrocopy: boolean;
    }> => {
      const disableBillingActions = !billingEnabled || !canManageBilling;
      const showBillingMicrocopy = disableBillingActions && upgradeMicrocopy.trim().length > 0;

      return [
        {
          key: "claimed",
          title: "Claimed Business",
          priceLine: "Free",
          description: "Planning and insight tools to help you organize, prepare, and understand your business.",
          bullets: [
            "Plan, organize, and prepare your business",
            "Create drafts for content and marketing",
            "Understand local visibility and search presence",
            "Review reputation insights and trends",
            "Build brand assets and business identity",
            "Learn through guides and help resources",
          ],
          ctaLabel: "Current Plan",
          ctaDisabled: true,
          showUpgradeMicrocopy: false,
        },
        {
          key: "premium",
          title: "OBD Premium",
          priceLine: "$39/month or $399/year",
          description: "Execution tools that connect your plans to real customer-facing workflows.",
          bullets: [
            "Turn plans and drafts into action",
            "Automate posts and review requests",
            "Accept bookings and manage scheduling",
            "Track customers and relationships",
            "Support customers with AI help tools",
            "Run execution tools from one dashboard",
          ],
          ctaLabel: "Upgrade to Premium",
          ctaDisabled: disableBillingActions,
          showUpgradeMicrocopy: showBillingMicrocopy,
        },
        {
          key: "premium-plus",
          title: "Premium Plus",
          priceLine: "$79/month or $799/year",
          description: "Advanced coordination and workflow support for higher-volume operations.",
          bullets: [
            "Coordinate multiple active workflows",
            "Manage advanced automation scenarios",
            "Support higher customer volume",
            "Organize team-based operations",
            "Access deeper reporting and insights",
            "Prepare for advanced features as they roll out",
          ],
          note: "Premium Plus includes advanced workflow and coordination features designed for higher-volume operations. New capabilities are added carefully and never activated without your consent.",
          ctaLabel: "Upgrade to Premium Plus",
          ctaDisabled: disableBillingActions,
          showUpgradeMicrocopy: showBillingMicrocopy,
        },
      ];
    },
    [billingEnabled, canManageBilling, upgradeMicrocopy]
  );

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={toggleTheme}
      title="Billing & Plan"
      tagline="View plans and manage billing inside your dashboard."
      theme={theme}
      onThemeChange={setTheme}
    >
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <OBDHeading level={2} isDark={isDark}>
              Billing &amp; Plan
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
              View your current plan and understand available options. Billing actions will be enabled once setup is complete.
            </p>
            <p className={`mt-2 text-xs ${themeClasses.mutedText}`}>
              Signed in as: <span className={themeClasses.headingText}>{sessionEmail ?? "…"}</span> · Role:{" "}
              <span className={themeClasses.headingText}>{roleLoading ? "…" : formatRole(myRole)}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {plans.map((p) => (
            <PlanCard
              key={p.key}
              title={p.title}
              priceLine={p.priceLine}
              description={p.description}
              bullets={p.bullets}
              note={p.note}
              ctaLabel={p.ctaLabel}
              ctaDisabled={p.ctaDisabled}
              showUpgradeMicrocopy={p.showUpgradeMicrocopy}
              upgradeMicrocopy={upgradeMicrocopy}
              isDark={isDark}
            />
          ))}
        </div>
      </OBDPanel>

      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <OBDHeading level={2} isDark={isDark} className="text-xl">
              Full tool list by plan
            </OBDHeading>
            <p className={`mt-1 text-sm ${themeClasses.mutedText}`}>
              Expand a category to see which plan each tool belongs to.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {toolCategories.map((cat) => {
            const panelBorder = isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white";
            const heading = isDark ? "text-slate-100" : "text-slate-900";
            const muted = isDark ? "text-slate-300" : "text-slate-600";
            const rowBorder = isDark ? "border-slate-800" : "border-slate-200";

            const planChip = (plan: PlanLabel) => {
              const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold";
              if (plan === "Free") {
                return `${base} ${
                  isDark ? "border-slate-700 bg-slate-900/40 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"
                }`;
              }
              if (plan === "Premium") {
                return `${base} ${
                  isDark ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-emerald-600/20 bg-emerald-50 text-emerald-800"
                }`;
              }
              return `${base} ${
                isDark ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200" : "border-cyan-600/20 bg-cyan-50 text-cyan-900"
              }`;
            };

            return (
              <details key={cat.category} className={`rounded-2xl border ${panelBorder}`}>
                <summary className="list-none cursor-pointer select-none px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className={`text-sm font-semibold ${heading}`}>{cat.category}</div>
                    <div className={`text-xs ${muted}`} aria-hidden="true">
                      <span className="inline-flex items-center gap-2">
                        <span>Expand</span>
                        <span className="text-slate-400">▾</span>
                      </span>
                    </div>
                  </div>
                </summary>

                <div className={`border-t ${rowBorder}`}>
                  <div className="px-5 py-4">
                    <div className="space-y-2">
                      {cat.tools.map((t) => (
                        <div
                          key={`${cat.category}:${t.name}`}
                          className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-xl border px-3 py-2 ${rowBorder}`}
                        >
                          <div className={`text-sm ${heading}`}>{t.name}</div>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <span className={`text-xs ${muted}`}>Plan</span>
                            <span className={planChip(t.plan)}>{t.plan}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </OBDPanel>

      <p className={`mt-8 text-xs ${themeClasses.mutedText} opacity-80`}>
        Nothing will be activated or changed unless you choose to upgrade.
      </p>
    </OBDPageContainer>
  );
}

