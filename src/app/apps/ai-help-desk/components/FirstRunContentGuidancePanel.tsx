"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import {
  getSecondaryButtonClasses,
  getSubtleButtonSmallClasses,
} from "@/lib/obd-framework/layout-helpers";

interface FirstRunContentGuidancePanelProps {
  isDark: boolean;
  businessId: string;
  workspaceSlug: string;
  anythingLLMWorkspaceUrl?: string | null;
  docsCount?: number;
  systemPromptIsEmpty?: boolean;
}

function buildDismissKey(businessId: string, workspaceSlug: string): string | null {
  const b = businessId.trim();
  const w = workspaceSlug.trim();
  if (!b || !w) return null;
  // Scoped per business + workspace to avoid cross-workspace bleed.
  return `obd:ai-help-desk:first-run-guidance:dismissed:${b}:${w}`;
}

export default function FirstRunContentGuidancePanel({
  isDark,
  businessId,
  workspaceSlug,
  anythingLLMWorkspaceUrl,
  docsCount,
  systemPromptIsEmpty,
}: FirstRunContentGuidancePanelProps) {
  const themeClasses = getThemeClasses(isDark);

  const dismissKey = useMemo(
    () => buildDismissKey(businessId, workspaceSlug),
    [businessId, workspaceSlug]
  );

  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!dismissKey) {
      setDismissed(null);
      return;
    }
    try {
      setDismissed(localStorage.getItem(dismissKey) === "true");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const isEmptyKnowledge = useMemo(() => {
    const emptyByDocs = typeof docsCount === "number" && docsCount === 0;
    const emptyByPrompt = systemPromptIsEmpty === true;

    return emptyByDocs || emptyByPrompt;
  }, [docsCount, systemPromptIsEmpty]);

  // Only render when:
  // - we can scope dismissal to a workspace
  // - we have checked localStorage (avoid hydration flicker)
  // - workspace is connected-but-empty
  if (!dismissKey || dismissed === null || !isEmptyKnowledge || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    if (!dismissKey) return;
    try {
      localStorage.setItem(dismissKey, "true");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <OBDPanel isDark={isDark} className="mt-6">
      <div
        className={`p-4 rounded-xl border ${
          isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <OBDHeading level={2} isDark={isDark} className="mb-2">
              Your Help Desk is connected — but it doesn’t have any knowledge yet.
            </OBDHeading>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              Upload documents or import your website so your Help Desk can answer questions in your voice. You can also generate starter FAQs to seed coverage.
            </p>
            <p className={`mt-2 text-[11px] ${themeClasses.mutedText}`}>
              <Link
                href="/apps/ecosystem"
                className={[
                  "underline underline-offset-2",
                  "hover:opacity-90",
                  "focus-visible:underline focus-visible:underline-offset-2 focus-visible:outline-none",
                  isDark ? "text-slate-200" : "text-slate-700",
                ].join(" ")}
              >
                How OBD tools work together
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className={getSubtleButtonSmallClasses(isDark)}
            aria-label="Dismiss guidance"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {anythingLLMWorkspaceUrl ? (
            <a
              href={anythingLLMWorkspaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${getSecondaryButtonClasses(isDark)} w-full sm:w-auto text-center`}
            >
              Upload documents
            </a>
          ) : (
            <Link
              href="/apps/ai-help-desk?tab=knowledge#obd-helpdesk-docs"
              className={`${getSecondaryButtonClasses(isDark)} w-full sm:w-auto text-center`}
            >
              Upload documents
            </Link>
          )}
          <Link
            href="/apps/ai-help-desk?tab=knowledge#obd-helpdesk-website-import"
            className={`${getSecondaryButtonClasses(isDark)} w-full sm:w-auto text-center`}
          >
            Import from website
          </Link>
          <Link
            href="/apps/faq-generator"
            className={`${getSecondaryButtonClasses(isDark)} w-full sm:w-auto text-center`}
          >
            Generate starter FAQs
          </Link>
        </div>
      </div>
    </OBDPanel>
  );
}

