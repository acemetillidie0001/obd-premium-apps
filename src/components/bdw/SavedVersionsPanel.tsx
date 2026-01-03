"use client";

import { useState, useEffect } from "react";
import {
  getSavedVersions,
  deleteVersion,
  saveVersion,
  exportVersions,
  importVersions,
  type SavedVersion,
} from "@/lib/utils/bdw-saved-versions";
import {
  fetchDbVersions,
  createDbVersion,
  deleteDbVersion,
  type DbVersionResponse,
} from "@/lib/utils/bdw-saved-versions-db";
import {
  saveVersionMetadata,
  loadVersionMetadata,
  deleteVersionMetadata,
  type VersionMetadata,
} from "@/lib/utils/bdw-version-metadata";
import { getDestinationSummary, duplicateVersion } from "@/lib/utils/bdw-version-helpers";
import { getInputClasses } from "@/lib/obd-framework/theme";
import { getThemeClasses } from "@/lib/obd-framework/theme";

interface SavedVersionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onLoadInputs: (inputs: SavedVersion["inputs"], versionInfo?: { id: string; label: string }) => void;
  businessId?: string | null;
}

interface VersionWithSource extends SavedVersion {
  source?: "db" | "local";
}

export default function SavedVersionsPanel({
  isOpen,
  onClose,
  isDark,
  onLoadInputs,
  businessId,
}: SavedVersionsPanelProps) {
  const themeClasses = getThemeClasses(isDark);
  const [versions, setVersions] = useState<VersionWithSource[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingDb, setUsingDb] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<[string | null, string | null]>([null, null]);
  const [editingMetadata, setEditingMetadata] = useState<Record<string, VersionMetadata>>({});
  const [toast, setToast] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, businessId]);

  useEffect(() => {
    // Load metadata for all versions when versions change
    const metadata: Record<string, VersionMetadata> = {};
    versions.forEach((v) => {
      const meta = loadVersionMetadata(v.id);
      if (meta) {
        metadata[v.id] = meta;
      }
    });
    setEditingMetadata(metadata);
  }, [versions]);

  const loadVersions = async () => {
    setLoading(true);

    if (businessId && businessId.trim()) {
      try {
        const dbVersions = await fetchDbVersions(businessId.trim());
        const convertedVersions: VersionWithSource[] = dbVersions.map((v) => ({
          id: v.id,
          createdAt: v.createdAt,
          businessName: v.businessName,
          city: v.city,
          state: v.state,
          inputs: v.inputs,
          outputs: v.outputs,
          source: "db" as const,
        }));
        setVersions(convertedVersions);
        setUsingDb(true);
        setLoading(false);
        return;
      } catch (error: unknown) {
        const err = error as { code?: string };
        console.log("[BDW Saved Versions] DB unavailable, falling back to localStorage", err.code || "unknown error");
      }
    }

    const localVersions = getSavedVersions();
    setVersions(localVersions.map((v) => ({ ...v, source: "local" as const })));
    setUsingDb(false);
    setLoading(false);
  };

  const handleDelete = async (id: string, source?: "db" | "local") => {
    if (!confirm("Delete this saved version?")) {
      return;
    }

    // Check if deleted version is one of the compared versions
    const isComparedVersion = compareMode && (
      selectedForCompare[0] === id || selectedForCompare[1] === id
    );

    if (source === "db" && businessId && businessId.trim()) {
      try {
        await deleteDbVersion(businessId.trim(), id);
        await loadVersions();
        deleteVersionMetadata(id);
        
        // Exit compare mode if deleted version was being compared
        if (isComparedVersion) {
          setCompareMode(false);
          setSelectedForCompare([null, null]);
          setToast({ message: "Comparison cleared (version removed)." });
        }
        return;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === "DB_UNAVAILABLE") {
          console.log("[BDW Saved Versions] DB unavailable, deleting from localStorage instead");
        } else {
          console.error("[BDW Saved Versions] Error deleting from DB:", error);
          alert("Failed to delete version. Please try again.");
          return;
        }
      }
    }

    deleteVersion(id);
    deleteVersionMetadata(id);
    await loadVersions();
    
    // Exit compare mode if deleted version was being compared
    if (isComparedVersion) {
      setCompareMode(false);
      setSelectedForCompare([null, null]);
      setToast({ message: "Comparison cleared (version removed)." });
    }
  };

  const handleDuplicate = async (version: VersionWithSource) => {
    const duplicated = duplicateVersion(version);

    if (usingDb && businessId && businessId.trim()) {
      try {
        await createDbVersion(businessId.trim(), duplicated);
        await loadVersions();
        // DB-backed duplication succeeded
        setToast({ message: "Duplicated and saved." });
        return;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === "DB_UNAVAILABLE") {
          console.log("[BDW Saved Versions] DB unavailable, saving to localStorage instead");
          // Fall through to localStorage (local-only)
        } else {
          console.error("[BDW Saved Versions] Error duplicating to DB:", error);
          alert("Failed to duplicate version. Please try again.");
          return;
        }
      }
    }

    // Local-only duplication (no DB or DB unavailable)
    // This saves to localStorage, but user may want to save to DB later
    saveVersion(duplicated);
    await loadVersions();
    setToast({ message: "Duplicated (unsaved) — click Save Version to store it." });
  };

  const handleCopy = async (text: string, id: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${id}-${type}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleLoadInputs = (inputs: SavedVersion["inputs"], version: VersionWithSource, metadata: VersionMetadata) => {
    const displayName = metadata.rename || version.businessName || "Untitled";
    const date = new Date(version.createdAt);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const label = metadata.rename || `${version.businessName || "Untitled"} (${dateStr})`;
    onLoadInputs(inputs, { id: version.id, label });
    onClose();
  };

  const handleExport = () => {
    const json = exportVersions();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bdw-saved-versions-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setImportError(null);
    const result = importVersions(importText);
    if (result.success) {
      loadVersions();
      setShowImport(false);
      setImportText("");
      alert(`Successfully imported ${result.count} version(s)`);
    } else {
      setImportError(result.error || "Import failed");
    }
  };

  const handleMetadataChange = (versionId: string, field: keyof VersionMetadata, value: string) => {
    setEditingMetadata((prev) => {
      const updated = { ...prev };
      if (!updated[versionId]) {
        updated[versionId] = {};
      }
      updated[versionId] = { ...updated[versionId], [field]: value };
      saveVersionMetadata(versionId, updated[versionId]);
      return updated;
    });
  };

  const handleClearMetadata = (versionId: string) => {
    deleteVersionMetadata(versionId);
    setEditingMetadata((prev) => {
      const updated = { ...prev };
      delete updated[versionId];
      return updated;
    });
    setToast({ message: "Local metadata cleared." });
  };

  const toggleCompareSelection = (versionId: string) => {
    if (selectedForCompare[0] === versionId) {
      // Deselect first
      setSelectedForCompare([selectedForCompare[1], null]);
    } else if (selectedForCompare[1] === versionId) {
      // Deselect second
      setSelectedForCompare([selectedForCompare[0], null]);
    } else if (!selectedForCompare[0]) {
      // Select first
      setSelectedForCompare([versionId, null]);
    } else if (!selectedForCompare[1]) {
      // Select second
      setSelectedForCompare([selectedForCompare[0], versionId]);
    } else {
      // Both slots filled - auto-deselect oldest (first) and select new one
      setSelectedForCompare([selectedForCompare[1], versionId]);
      setToast({ message: "Select only 2 to compare" });
    }
  };

  const getVersionById = (id: string | null): VersionWithSource | null => {
    if (!id) return null;
    return versions.find((v) => v.id === id) || null;
  };

  const compareVersions = selectedForCompare[0] && selectedForCompare[1]
    ? [getVersionById(selectedForCompare[0]), getVersionById(selectedForCompare[1])]
    : [null, null];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-4xl ${
          isDark ? "bg-slate-900" : "bg-white"
        } shadow-2xl z-50 overflow-y-auto`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              Saved Versions Workspace
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCompareMode(!compareMode)}
                disabled={!compareMode && (selectedForCompare[0] === null || selectedForCompare[1] === null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  compareMode
                    ? "bg-[#29c4a9] text-white"
                    : isDark
                    ? selectedForCompare[0] && selectedForCompare[1]
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                    : selectedForCompare[0] && selectedForCompare[1]
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                }`}
              >
                {compareMode ? "Exit Compare" : "Compare"}
              </button>
              <button
                onClick={handleExport}
                disabled={versions.length === 0}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  versions.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                } ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Export JSON
              </button>
              <button
                onClick={() => setShowImport(!showImport)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Import JSON
              </button>
              <button
                onClick={onClose}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Close
              </button>
            </div>
          </div>

          {showImport && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
              }`}
            >
              <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                Import Versions
              </h3>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste JSON here..."
                rows={6}
                className={`w-full p-3 rounded-lg border text-sm font-mono ${
                  isDark
                    ? "bg-slate-900 border-slate-600 text-slate-100"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              />
              {importError && (
                <p className={`mt-2 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>{importError}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    !importText.trim() ? "opacity-50 cursor-not-allowed" : ""
                  } bg-[#29c4a9] text-white hover:bg-[#25b09a]`}
                >
                  Import
                </button>
                <button
                  onClick={() => {
                    setShowImport(false);
                    setImportText("");
                    setImportError(null);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className={`text-center py-12 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <p>Loading versions...</p>
            </div>
          )}

          {!loading && versions.length === 0 ? (
            <div className={`text-center py-12 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <p>No saved versions yet.</p>
              <p className="text-sm mt-2">Generate descriptions and click "Save Version" to get started.</p>
            </div>
          ) : !loading && compareMode && compareVersions[0] && compareVersions[1] ? (
            <CompareView
              version1={compareVersions[0]}
              version2={compareVersions[1]}
              isDark={isDark}
              onCopy={handleCopy}
              onSwap={() => {
                setSelectedForCompare([selectedForCompare[1], selectedForCompare[0]]);
              }}
              metadata1={editingMetadata[compareVersions[0].id] || {}}
              metadata2={editingMetadata[compareVersions[1].id] || {}}
            />
          ) : !loading ? (
            <div className="space-y-4">
              {compareMode && (
                <div
                  className={`p-3 rounded-lg border ${
                    isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <p className={`text-sm ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                    Select two versions to compare them side-by-side.
                  </p>
                </div>
              )}
              {versions.map((version) => {
                const date = new Date(version.createdAt);
                const dateStr = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const metadata = editingMetadata[version.id] || {};
                const displayName = metadata.rename || version.businessName || "Untitled";
                const destinationSummary = getDestinationSummary(version);
                const isSelected = compareMode
                  ? selectedForCompare[0] === version.id || selectedForCompare[1] === version.id
                  : false;

                return (
                  <div
                    key={version.id}
                    className={`rounded-lg border p-4 ${
                      isSelected
                        ? isDark
                          ? "bg-blue-900/20 border-blue-700"
                          : "bg-blue-50 border-blue-300"
                        : isDark
                        ? "bg-slate-800 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {displayName}
                          </h3>
                          {version.source === "db" && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              Cloud
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {destinationSummary}
                          </span>
                        </div>
                        <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{dateStr}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-xs font-medium ${themeClasses.labelText}`}>Rename</label>
                          {(metadata.rename || metadata.tags) && (
                            <button
                              onClick={() => handleClearMetadata(version.id)}
                              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                isDark
                                  ? "text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                              }`}
                              title="Clear title/tags"
                            >
                              Clear metadata
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={metadata.rename || ""}
                          onChange={(e) => handleMetadataChange(version.id, "rename", e.target.value)}
                          placeholder={version.businessName || "Untitled"}
                          className={getInputClasses(isDark, "text-sm")}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${themeClasses.labelText}`}>Tags</label>
                        <input
                          type="text"
                          value={metadata.tags || ""}
                          onChange={(e) => handleMetadataChange(version.id, "tags", e.target.value)}
                          placeholder="Comma-separated tags"
                          className={getInputClasses(isDark, "text-sm")}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {compareMode ? (
                        <button
                          onClick={() => toggleCompareSelection(version.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            isSelected
                              ? "bg-[#29c4a9] text-white"
                              : isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select for Compare"}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleLoadInputs(version.inputs, version, metadata)}
                            className="px-3 py-1.5 text-xs font-medium rounded transition-colors bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDuplicate(version)}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              isDark
                                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleDelete(version.id, version.source)}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              isDark
                                ? "text-red-400 hover:bg-red-900/20"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
          isDark={isDark}
        />
      )}
    </>
  );
}

// Toast Component
interface ToastProps {
  message: string;
  onClose: () => void;
  isDark: boolean;
}

function Toast({ message, onClose, isDark }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-[60] animate-in slide-in-from-bottom-5">
      <div className={`rounded-lg border shadow-lg p-4 max-w-sm ${
        isDark
          ? "bg-slate-800 border-slate-700 text-white"
          : "bg-white border-slate-200 text-slate-900"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm flex-1">{message}</p>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              isDark
                ? "hover:bg-slate-700 text-slate-300"
                : "hover:bg-slate-100 text-slate-600"
            }`}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

interface CompareViewProps {
  version1: VersionWithSource;
  version2: VersionWithSource;
  isDark: boolean;
  onCopy: (text: string, id: string, type: string) => void;
  onSwap: () => void;
  metadata1: VersionMetadata;
  metadata2: VersionMetadata;
}

function CompareView({ version1, version2, isDark, onCopy, onSwap, metadata1, metadata2 }: CompareViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string, type: string) => {
    await onCopy(text, id, type);
    setCopiedId(`${id}-${type}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const title1 = metadata1.rename || version1.businessName || "Untitled";
  const title2 = metadata2.rename || version2.businessName || "Untitled";

  const outputs = [
    { key: "obd" as const, label: "OBD Listing", v1: version1.outputs.obdListingDescription, v2: version2.outputs.obdListingDescription },
    { key: "gbp" as const, label: "Google Business Profile", v1: version1.outputs.googleBusinessDescription, v2: version2.outputs.googleBusinessDescription },
    { key: "website" as const, label: "Website/About", v1: version1.outputs.websiteAboutUs, v2: version2.outputs.websiteAboutUs },
    { key: "meta" as const, label: "Meta Description", v1: version1.outputs.metaDescription || "", v2: version2.outputs.metaDescription || "" },
  ];

  return (
    <div className="space-y-6">
      {/* Compare Header */}
      <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            Comparing: {title1} vs {title2}
          </h3>
          <button
            onClick={onSwap}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Swap sides
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className={`font-semibold mb-1 text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
              {title1}
            </h4>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {new Date(version1.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <h4 className={`font-semibold mb-1 text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
              {title2}
            </h4>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {new Date(version2.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {outputs.map((output) => (
        <div key={output.key} className={`rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
          <div className={`p-3 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
            <h4 className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>{output.label}</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {output.v1.length.toLocaleString()} chars
                </span>
                <button
                  onClick={() => handleCopy(output.v1, version1.id, output.key)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    copiedId === `${version1.id}-${output.key}`
                      ? "bg-[#29c4a9] text-white"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {copiedId === `${version1.id}-${output.key}` ? "Copied!" : "Copy"}
                </button>
              </div>
              <div
                className={`rounded border p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto ${
                  isDark
                    ? "bg-slate-900 border-slate-600 text-slate-100"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                {output.v1 || <span className={isDark ? "text-slate-500" : "text-slate-400"}>No content</span>}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {output.v2.length.toLocaleString()} chars
                </span>
                <button
                  onClick={() => handleCopy(output.v2, version2.id, output.key)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    copiedId === `${version2.id}-${output.key}`
                      ? "bg-[#29c4a9] text-white"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {copiedId === `${version2.id}-${output.key}` ? "Copied!" : "Copy"}
                </button>
              </div>
              <div
                className={`rounded border p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto ${
                  isDark
                    ? "bg-slate-900 border-slate-600 text-slate-100"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                {output.v2 || <span className={isDark ? "text-slate-500" : "text-slate-400"}>No content</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
