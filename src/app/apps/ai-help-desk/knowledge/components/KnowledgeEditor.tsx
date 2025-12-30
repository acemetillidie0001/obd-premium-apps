"use client";

import { useState, useEffect } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type { KnowledgeEntry, KnowledgeEntryType } from "./KnowledgeList";

interface KnowledgeEditorProps {
  isDark: boolean;
  businessId: string;
  entry: KnowledgeEntry | null;
  initialTitle?: string; // For prefilling title when creating from a question
  onClose: () => void;
  onSave: () => void;
}

export default function KnowledgeEditor({
  isDark,
  businessId,
  entry,
  initialTitle,
  onClose,
  onSave,
}: KnowledgeEditorProps) {
  const themeClasses = getThemeClasses(isDark);

  const [type, setType] = useState<KnowledgeEntryType>("FAQ");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when entry changes
  useEffect(() => {
    if (entry) {
      setType(entry.type);
      setTitle(entry.title);
      setContent(entry.content);
      setTags(entry.tags || []);
      setIsActive(entry.isActive);
    } else {
      // Reset to defaults for new entry
      setType("FAQ");
      setTitle(initialTitle || "");
      setContent("");
      setTags([]);
      setIsActive(true);
    }
    setError(null);
  }, [entry, initialTitle]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessId.trim()) {
      setError("Business ID is required");
      return;
    }

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry?.id,
          businessId: businessId.trim(),
          type,
          title: title.trim(),
          content: content.trim(),
          tags,
          isActive,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to save entry");
      }

      // Success - notify parent to reload
      onSave();
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isDark ? "bg-black/70" : "bg-black/50"
      }`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl"
      >
        <OBDPanel
          isDark={isDark}
          className="w-full max-h-[90vh] overflow-y-auto"
        >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <OBDHeading level={2} isDark={isDark}>
              {entry ? "Edit Entry" : "Add New Entry"}
            </OBDHeading>
            <button
              type="button"
              onClick={onClose}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClose();
                }
              }}
              className={`text-2xl leading-none ${themeClasses.mutedText} hover:opacity-70`}
              aria-label="Close editor"
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as KnowledgeEntryType)}
                className={getInputClasses(isDark, "w-full")}
                required
              >
                <option value="FAQ">FAQ</option>
                <option value="SERVICE">Service</option>
                <option value="POLICY">Policy</option>
                <option value="NOTE">Note</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={getInputClasses(isDark, "w-full")}
                placeholder="Enter entry title..."
                required
                maxLength={500}
              />
            </div>

            {/* Content */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={getInputClasses(isDark, "w-full min-h-[200px]")}
                placeholder="Enter entry content..."
                required
              />
            </div>

            {/* Tags */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className={getInputClasses(isDark, "flex-1")}
                  placeholder="Add a tag and press Enter..."
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded ${
                        isDark
                          ? "bg-slate-700 text-slate-300"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:opacity-70"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="isActive" className={`text-sm ${themeClasses.labelText}`}>
                Active (visible in help desk)
              </label>
            </div>

            {/* Error Display */}
            {error && (
              <div className={getErrorPanelClasses(isDark)}>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 px-6 py-3 font-medium rounded-xl border transition-colors ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 ${SUBMIT_BUTTON_CLASSES}`}
              >
                {loading ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </form>
        </div>
      </OBDPanel>
      </div>
    </div>
  );
}

