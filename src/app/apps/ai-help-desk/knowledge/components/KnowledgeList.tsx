"use client";

import { useState, useEffect } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import KnowledgeCoverageBadge from "./KnowledgeCoverageBadge";

export type KnowledgeEntryType = "FAQ" | "SERVICE" | "POLICY" | "NOTE";

export interface KnowledgeEntry {
  id: string;
  businessId: string;
  type: KnowledgeEntryType;
  title: string;
  content: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeListProps {
  isDark: boolean;
  businessId: string;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  reloadTrigger?: number; // When this changes, trigger a reload
}

export default function KnowledgeList({
  isDark,
  businessId,
  onEdit,
  onDelete,
  onToggleActive,
  reloadTrigger,
}: KnowledgeListProps) {
  const themeClasses = getThemeClasses(isDark);

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<KnowledgeEntryType | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  // Load entries
  const loadEntries = async () => {
    if (!businessId.trim()) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        businessId: businessId.trim(),
        includeInactive: includeInactive.toString(),
      });

      if (selectedType !== "ALL") {
        params.append("type", selectedType);
      }

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const res = await fetch(`/api/ai-help-desk/knowledge/list?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load entries");
      }

      setEntries(json.data.entries || []);
    } catch (err) {
      console.error("Load entries error:", err);
      setError(err instanceof Error ? err.message : "Failed to load entries");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Load entries when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEntries();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [businessId, selectedType, searchQuery, includeInactive]);

  // Reload when reloadTrigger changes
  useEffect(() => {
    if (reloadTrigger !== undefined && businessId.trim()) {
      loadEntries();
    }
  }, [reloadTrigger]);

  // Initial load
  useEffect(() => {
    if (businessId.trim()) {
      loadEntries();
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    try {
      const res = await fetch("/api/ai-help-desk/knowledge/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          businessId: businessId.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to delete entry");
      }

      // Reload entries
      loadEntries();
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  const handleToggleActive = async (id: string, currentIsActive: boolean) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    try {
      const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          businessId: businessId.trim(),
          type: entry.type,
          title: entry.title,
          content: entry.content,
          tags: entry.tags,
          isActive: !currentIsActive,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update entry");
      }

      // Reload entries
      loadEntries();
    } catch (err) {
      console.error("Toggle active error:", err);
      alert(err instanceof Error ? err.message : "Failed to update entry");
    }
  };

  const getTypeLabel = (type: KnowledgeEntryType) => {
    switch (type) {
      case "FAQ":
        return "FAQ";
      case "SERVICE":
        return "Service";
      case "POLICY":
        return "Policy";
      case "NOTE":
        return "Note";
    }
  };

  const getTypeColor = (type: KnowledgeEntryType) => {
    switch (type) {
      case "FAQ":
        return isDark ? "bg-blue-900/30 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800";
      case "SERVICE":
        return isDark ? "bg-green-900/30 border-green-700 text-green-300" : "bg-green-50 border-green-200 text-green-800";
      case "POLICY":
        return isDark ? "bg-purple-900/30 border-purple-700 text-purple-300" : "bg-purple-50 border-purple-200 text-purple-800";
      case "NOTE":
        return isDark ? "bg-yellow-900/30 border-yellow-700 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-800";
    }
  };

  return (
    <OBDPanel isDark={isDark}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <OBDHeading level={2} isDark={isDark}>
            Knowledge Base
          </OBDHeading>
          <div className="flex items-center gap-3">
            <KnowledgeCoverageBadge isDark={isDark} entries={entries} />
            <div className="text-sm text-slate-500">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Type Filter */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Filter by Type
            </label>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "FAQ", "SERVICE", "POLICY", "NOTE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    selectedType === type
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/20 text-[#29c4a9]"
                        : "border-[#29c4a9] bg-[#29c4a9]/10 text-[#29c4a9]"
                      : isDark
                        ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {type === "ALL" ? "All" : getTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={getInputClasses(isDark, "w-full")}
              placeholder="Search entries by title or content..."
            />
          </div>

          {/* Include Inactive Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeInactive"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <label htmlFor="includeInactive" className={`text-sm ${themeClasses.labelText}`}>
              Include inactive entries
            </label>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className={getErrorPanelClasses(isDark)}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>
            <p>Loading entries...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && entries.length === 0 && businessId.trim() && (
          <div className={`text-center py-12 ${themeClasses.mutedText}`}>
            <p className="text-base mb-2">No entries found</p>
            <p className="text-sm">
              {searchQuery || selectedType !== "ALL"
                ? "Try adjusting your filters"
                : "Add your first FAQ, service, policy, or note to get started"}
            </p>
          </div>
        )}

        {/* Entries List */}
        {!loading && entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`p-4 rounded-xl border ${
                  !entry.isActive
                    ? isDark
                      ? "bg-slate-800/50 border-slate-700 opacity-60"
                      : "bg-slate-50 border-slate-200 opacity-60"
                    : isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded border ${getTypeColor(entry.type)}`}
                      >
                        {getTypeLabel(entry.type)}
                      </span>
                      {!entry.isActive && (
                        <span className="text-xs text-slate-500">(Inactive)</span>
                      )}
                    </div>
                    <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>
                      {entry.title}
                    </h3>
                    <p className={`text-sm line-clamp-2 ${themeClasses.mutedText}`}>
                      {entry.content}
                    </p>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 text-xs rounded ${
                              isDark
                                ? "bg-slate-700 text-slate-300"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleActive(entry.id, entry.isActive)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        entry.isActive
                          ? isDark
                            ? "border-yellow-700 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40"
                            : "border-yellow-600 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                          : isDark
                            ? "border-green-700 bg-green-900/30 text-green-300 hover:bg-green-900/40"
                            : "border-green-600 bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                    >
                      {entry.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        isDark
                          ? "border-red-700 bg-red-900/30 text-red-300 hover:bg-red-900/40"
                          : "border-red-600 bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OBDPanel>
  );
}

