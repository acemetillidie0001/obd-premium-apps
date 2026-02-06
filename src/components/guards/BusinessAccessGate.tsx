import Link from "next/link";
import type { ReactNode } from "react";
import { PREMIUM_BASE_PATH } from "@/lib/routing/appBasePaths";

export type BusinessAccessGateMode = "noBusiness" | "noMembership";

export type BusinessAccessGateAction = {
  href: string;
  label: string;
};

type Props = {
  mode: BusinessAccessGateMode;
  title?: string;
  message?: string;
  primaryAction?: BusinessAccessGateAction;
  /**
   * Optional CTA slot (e.g., secondary link/button).
   * Keep this read-only; no auto-creation should happen from this gate.
   */
  ctaSlot?: ReactNode;
};

const DEFAULT_COPY: Record<BusinessAccessGateMode, { title: string; message: string }> = {
  noBusiness: {
    title: "No business found for this account",
    message: "Create a business first, then you can manage access and use Premium Apps.",
  },
  noMembership: {
    title: "No active membership found",
    message: "Ask an owner to invite you, or sign in with the owner account.",
  },
};

export default function BusinessAccessGate({ mode, title, message, primaryAction, ctaSlot }: Props) {
  const copy = DEFAULT_COPY[mode];

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">{title ?? copy.title}</div>
        <div className="mt-2 text-sm text-slate-600">{message ?? copy.message}</div>

        <div className="mt-5 flex flex-wrap gap-2">
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {primaryAction.label}
            </Link>
          ) : null}

          {ctaSlot ?? null}

          <Link
            href={PREMIUM_BASE_PATH}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-5 text-xs text-slate-500">
          This is a tenant safety guardrail. No auto-creation happens.
        </div>
      </div>
    </div>
  );
}

