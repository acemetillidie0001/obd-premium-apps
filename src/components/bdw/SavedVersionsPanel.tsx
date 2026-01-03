"use client";

import { useState, useEffect } from "react";
import {
  getSavedVersions,
  deleteVersion,
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

interface SavedVersionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onLoadInputs: (inputs: SavedVersion["inputs"]) => void;
  businessId?: string | null; // Optional: if provided, use DB-first; otherwise localStorage only
}

// Extended version type that includes source
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
  const [versions, setVersions] = useState<VersionWithSource[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingDb, setUsingDb] = useState(false); // Track if we're using DB

  // Load versions when panel opens
  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, businessId]);

  const loadVersions = async () => {
    setLoading(true);
    
    // If businessId exists, try DB first
    if (businessId && businessId.trim()) {
      try {
        const dbVersions = await fetchDbVersions(businessId.trim());
        
        // Convert DB versions to SavedVersion format
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
      } catch (error: any) {
        // If DB fails for any reason (DB_UNAVAILABLE, 401/403, validation, etc.), fallback to localStorage silently
        console.log("[BDW Saved Versions] DB unavailable, falling back to localStorage", error.code || "unknown error");
        // Fall through to localStorage (silent fallback - don't break the page)
      }
    }
    
    // Fallback to localStorage (or use it if no businessId)
    const localVersions = getSavedVersions();
    setVersions(localVersions.map((v) => ({ ...v, source: "local" as const })));
    setUsingDb(false);
    setLoading(false);
  };

  const handleDelete = async (id: string, source?: "db" | "local") => {
    if (!confirm("Delete this saved version?")) {
      return;
    }

    // If DB-backed and businessId exists, delete from DB
    if (source === "db" && businessId && businessId.trim()) {
      try {
        await deleteDbVersion(businessId.trim(), id);
        await loadVersions(); // Reload list
        return;
      } catch (error: any) {
        // If DB delete fails, fallback to localStorage delete
        if (error.code === "DB_UNAVAILABLE") {
          console.log("[BDW Saved Versions] DB unavailable, deleting from localStorage instead");
          // Fall through to localStorage delete
        } else {
          console.error("[BDW Saved Versions] Error deleting from DB:", error);
          alert("Failed to delete version. Please try again.");
          return;
        }
      }
    }

    // Delete from localStorage
    deleteVersion(id);
    setVersions(getSavedVersions().map((v) => ({ ...v, source: "local" as const })));
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

  const handleLoadInputs = (inputs: SavedVersion["inputs"]) => {
    onLoadInputs(inputs);
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
      setVersions(getSavedVersions());
      setShowImport(false);
      setImportText("");
      alert(`Successfully imported ${result.count} version(s)`);
    } else {
      setImportError(result.error || "Import failed");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl ${
          isDark ? "bg-slate-900" : "bg-white"
        } shadow-2xl z-50 overflow-y-auto`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              Saved Versions
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={versions.length === 0}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  versions.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
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

          {/* Import Section */}
          {showImport && (
            <div className={`mb-6 p-4 rounded-lg border ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-slate-50 border-slate-200"
            }`}>
              <h3 className={`text-sm font-semibold mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}>
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
                <p className={`mt-2 text-xs ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}>
                  {importError}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    !importText.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  } ${
                    isDark
                      ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                      : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                  }`}
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

          {/* Loading State */}
          {loading && (
            <div className={`text-center py-12 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              <p>Loading versions...</p>
            </div>
          )}

          {/* Versions List */}
          {!loading && versions.length === 0 ? (
            <div className={`text-center py-12 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              <p>No saved versions yet.</p>
              <p className="text-sm mt-2">Generate descriptions and click "Save Version" to get started.</p>
            </div>
          ) : !loading ? (
            <div className="space-y-4">
              {versions.map((version) => {
                const date = new Date(version.createdAt);
                const dateStr = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={version.id}
                    className={`rounded-lg border p-4 ${
                      isDark
                        ? "bg-slate-800 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className={`font-semibold ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}>
                          {version.businessName || "Untitled"}
                          {version.city && version.state && (
                            <span className={`font-normal ml-2 ${
                              isDark ? "text-slate-400" : "text-slate-500"
                            }`}>
                              — {version.city}, {version.state}
                            </span>
                          )}
                        </h3>
                        <p className={`text-xs mt-1 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}>
                          {dateStr}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {version.source === "db" && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            isDark
                              ? "bg-blue-900/30 text-blue-300"
                              : "bg-blue-50 text-blue-700"
                          }`}>
                            Cloud
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(version.id, version.source)}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            isDark
                              ? "text-red-400 hover:bg-red-900/20"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        onClick={() => handleCopy(version.outputs.obdListingDescription, version.id, "obd")}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {copiedId === `${version.id}-obd` ? "Copied!" : "Copy OBD"}
                      </button>
                      <button
                        onClick={() => handleCopy(version.outputs.googleBusinessDescription, version.id, "gbp")}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {copiedId === `${version.id}-gbp` ? "Copied!" : "Copy GBP"}
                      </button>
                      <button
                        onClick={() => handleCopy(version.outputs.websiteAboutUs, version.id, "website")}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {copiedId === `${version.id}-website` ? "Copied!" : "Copy Website"}
                      </button>
                      {version.outputs.metaDescription && (
                        <button
                          onClick={() => handleCopy(version.outputs.metaDescription!, version.id, "meta")}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {copiedId === `${version.id}-meta` ? "Copied!" : "Copy Meta"}
                        </button>
                      )}
                      <button
                        onClick={() => handleLoadInputs(version.inputs)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          isDark
                            ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                            : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                        }`}
                      >
                        Load Inputs
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

