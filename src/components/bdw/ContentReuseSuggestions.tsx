"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ContentReuseSuggestionsProps {
  isDark: boolean;
  onAddToHelpDesk?: () => void; // Handler for "Add to AI Help Desk Knowledge" button
  showHelpDeskButton?: boolean; // Whether to show the help desk button
  // V4.5: CRM Note Pack handlers
  onCopyCrmNotePack?: () => void; // Handler for "Copy CRM Note Pack" button
  onSendToCrmNotes?: () => void; // Handler for "Send to CRM Notes" button (only if endpoint exists + businessId)
  showSendToCrmButton?: boolean; // Whether to show the "Send to CRM Notes" button
}

interface AppRoute {
  href: string;
  label: string;
  icon: string;
  isButton?: boolean;
  onClick?: () => void;
}

export default function ContentReuseSuggestions({
  isDark,
  onAddToHelpDesk,
  showHelpDeskButton = false,
  onCopyCrmNotePack,
  onSendToCrmNotes,
  showSendToCrmButton = false,
}: ContentReuseSuggestionsProps) {
  const [availableRoutes, setAvailableRoutes] = useState<AppRoute[]>([]);
  const [crmNotePackCopied, setCrmNotePackCopied] = useState(false);

  useEffect(() => {
    // Check which routes exist by attempting to verify they're accessible
    // In a real app, you might want to check against a route registry
    // For now, we'll assume routes exist based on the codebase structure
    const routes: AppRoute[] = [];

    // AI Help Desk - button (only show if handler provided and flag is true)
    if (showHelpDeskButton && onAddToHelpDesk) {
      routes.push({
        href: "/apps/ai-help-desk",
        label: "Add to AI Help Desk Knowledge",
        icon: "💡",
        isButton: true,
        onClick: onAddToHelpDesk,
      });
    }

    // V4.5: Copy CRM Note Pack - button (always available if handler provided)
    if (onCopyCrmNotePack) {
      routes.push({
        href: "#",
        label: crmNotePackCopied ? "Copied!" : "Copy CRM Note Pack",
        icon: "📋",
        isButton: true,
        onClick: () => {
          onCopyCrmNotePack();
          setCrmNotePackCopied(true);
          setTimeout(() => setCrmNotePackCopied(false), 2000);
        },
      });
    }

    // V4.5: Send to CRM Notes - button (only if handler provided and flag is true)
    if (showSendToCrmButton && onSendToCrmNotes) {
      routes.push({
        href: "#",
        label: "Send to CRM Notes",
        icon: "📝",
        isButton: true,
        onClick: onSendToCrmNotes,
      });
    }

    // Local SEO Page Builder
    routes.push({
      href: "/apps/local-seo-page-builder",
      label: "Use in Local SEO Page Builder",
      icon: "📄",
    });

    // Google Business Profile Pro (note: route is google-business-pro, not google-business-profile-pro)
    routes.push({
      href: "/apps/google-business-pro",
      label: "Use in Google Business Profile Pro",
      icon: "📍",
    });

    // OBD CRM - deep link (always available)
    routes.push({
      href: "/apps/obd-crm",
      label: "Open CRM",
      icon: "🔗",
    });

    setAvailableRoutes(routes);
  }, [onAddToHelpDesk, showHelpDeskButton, onCopyCrmNotePack, onSendToCrmNotes, showSendToCrmButton, crmNotePackCopied]);

  if (availableRoutes.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg border p-4 ${
      isDark
        ? "bg-slate-800/50 border-slate-700"
        : "bg-slate-50 border-slate-200"
    }`}>
      <h3 className={`text-sm font-semibold mb-3 ${
        isDark ? "text-white" : "text-slate-900"
      }`}>
        Use this in…
      </h3>
      <div className="flex flex-wrap gap-2">
        {availableRoutes.map((route, idx) => {
          if (route.isButton && route.onClick) {
            return (
              <button
                key={idx}
                onClick={route.onClick}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>{route.icon}</span>
                <span>{route.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={idx}
              href={route.href}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                isDark
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{route.icon}</span>
              <span>{route.label}</span>
            </Link>
          );
        })}
      </div>
      {/* V4.5: Hint after copying note pack */}
      {crmNotePackCopied && (
        <div className={`mt-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          💡 Now paste into a contact note or business notes inside CRM.
        </div>
      )}
    </div>
  );
}

