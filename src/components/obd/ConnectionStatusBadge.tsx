"use client";

import type { ConnectionUIState } from "@/lib/apps/social-auto-poster/connection/connectionState";

interface ConnectionStatusBadgeProps {
  state: ConnectionUIState;
  label: string;
  isDark: boolean;
}

/**
 * Connection Status Badge Component
 * 
 * Displays a small status badge/pill near page titles following OBD Tier 5A UI patterns.
 * Uses centralized connection state mapping for consistent styling.
 */
export default function ConnectionStatusBadge({
  state,
  label,
  isDark,
}: ConnectionStatusBadgeProps) {
  // Color mapping based on state (Tier 5A - OBD-safe colors, no neon/red for errors)
  const colorClasses: Record<ConnectionUIState, { bg: string; text: string; border: string }> = {
    connected: {
      bg: isDark ? "bg-green-500/20" : "bg-green-50",
      text: isDark ? "text-green-400" : "text-green-700",
      border: isDark ? "border-green-500" : "border-green-300",
    },
    limited: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-50",
      text: isDark ? "text-amber-400" : "text-amber-700",
      border: isDark ? "border-amber-500" : "border-amber-300",
    },
    pending: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-50",
      text: isDark ? "text-amber-400" : "text-amber-700",
      border: isDark ? "border-amber-500" : "border-amber-300",
    },
    disabled: {
      bg: isDark ? "bg-slate-500/20" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500" : "border-slate-300",
    },
    error: {
      // Neutral gray for errors (NOT red) - Tier 5A requirement
      bg: isDark ? "bg-slate-500/20" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500" : "border-slate-300",
    },
  };

  const colors = colorClasses[state];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
      title={label}
    >
      {label}
    </span>
  );
}

