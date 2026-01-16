"use client";

import { useEffect, useMemo, useState } from "react";
import { clearHandoff, readHandoff, validateHandoff, type HandoffValidationResult } from "@/lib/handoff/handoff";

export default function HandoffGuardModal({
  handoffKey,
  expectedSourceApp,
  businessId,
  onApply,
  onDismiss,
}: {
  handoffKey: string;
  expectedSourceApp: string;
  businessId: string | null;
  onApply: (payload: unknown) => void;
  onDismiss: () => void;
}) {
  const [payload, setPayload] = useState<unknown>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const validation = useMemo(() => {
    if (!payload) return null;
    return validateHandoff(payload, {
      businessId,
      now: Date.now(),
      expectedSourceApp,
    });
  }, [payload, businessId, expectedSourceApp]);

  useEffect(() => {
    const p = readHandoff(handoffKey);
    if (!p) return;
    setPayload(p);
    setOpen(true);
  }, [handoffKey]);

  useEffect(() => {
    if (!validation) return;
    if (validation.ok) {
      setBlockedReason(null);
      return;
    }

    // Expired is already cleared by readHandoff; close silently.
    if (validation.reason === "expired") {
      setOpen(false);
      setPayload(null);
      return;
    }

    if (validation.reason === "missing_business_context") {
      setBlockedReason("Business context required (missing businessId).");
      return;
    }
    if (validation.reason === "tenant_mismatch") {
      setBlockedReason("This handoff is for a different business.");
      return;
    }
    if (validation.reason === "invalid_source") {
      setBlockedReason("This handoff source is not allowed.");
      return;
    }
    setBlockedReason("Invalid handoff payload.");
  }, [validation]);

  const dismiss = () => {
    clearHandoff(handoffKey);
    setOpen(false);
    setPayload(null);
    onDismiss();
  };

  const apply = () => {
    if (!payload) return dismiss();
    if (!validation || !validation.ok) return dismiss();

    try {
      onApply(payload);
    } finally {
      // Prevent re-apply on refresh.
      clearHandoff(handoffKey);
      setOpen(false);
      setPayload(null);
      onDismiss();
    }
  };

  if (!open || !payload) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />

      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Apply draft input suggestions?
        </div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          We can pre-fill inputs based on your prior step. This will pre-fill draft inputs only. Nothing is generated or
          published automatically.
        </div>

        {blockedReason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
            {blockedReason}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={dismiss}
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={!!blockedReason}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={apply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}


