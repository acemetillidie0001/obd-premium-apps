"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDStickyToolbar from "@/components/obd/OBDStickyToolbar";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type {
  CrmContact,
  CrmContactActivity,
  CrmTag,
  CrmContactStatus,
} from "@/lib/apps/obd-crm/types";
import type { BookingRequest } from "@/lib/apps/obd-scheduler/types";
import {
  buildContactTimeline,
  detectReviewSignalsFromNotes,
  type CrmNonNoteActivity,
} from "@/lib/apps/obd-crm/timeline";

export default function ContactDetailPage() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<CrmContact | null>(null);
  const [notes, setNotes] = useState<CrmContactActivity[]>([]);
  const [activities, setActivities] = useState<CrmNonNoteActivity[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CrmContact>>({});

  // Note input
  const [noteContent, setNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Connected signals (read-only, tenant-safe)
  const [schedulerSignals, setSchedulerSignals] = useState<{
    checked: boolean;
    hasAnyMatch: boolean;
    hasBookedBefore: boolean;
    hasUpcomingBooking: boolean;
    upcomingBookingAt: string | null;
    matchedCount: number;
    error?: string | null;
  }>({
    checked: false,
    hasAnyMatch: false,
    hasBookedBefore: false,
    hasUpcomingBooking: false,
    upcomingBookingAt: null,
    matchedCount: 0,
    error: null,
  });
  const [schedulerRequests, setSchedulerRequests] = useState<BookingRequest[]>([]);

  const resetEditFormToContact = (c: CrmContact) => {
    setEditForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      company: c.company || "",
      address: c.address || "",
      status: c.status,
      tags: c.tags,
    });
  };

  const handleCancelEdit = () => {
    if (!contact) return;
    setIsEditing(false);
    resetEditFormToContact(contact);
  };

  const normalizeText = (v: unknown) => String(v ?? "").trim();
  const contactTagKey = contact ? contact.tags.map((t) => t.id).sort().join(",") : "";
  const editTagKey = (editForm.tags || []).map((t: any) => t.id).sort().join(",");
  const isDirty =
    !!contact &&
    isEditing &&
    (normalizeText(editForm.name) !== normalizeText(contact.name) ||
      normalizeText(editForm.email) !== normalizeText(contact.email) ||
      normalizeText(editForm.phone) !== normalizeText(contact.phone) ||
      normalizeText(editForm.company) !== normalizeText(contact.company) ||
      normalizeText(editForm.address) !== normalizeText(contact.address) ||
      (editForm.status || "Lead") !== contact.status ||
      editTagKey !== contactTagKey);

  const isValid = normalizeText(editForm.name).length >= 2;
  const saveDisabledReason = !isDirty
    ? "No changes to save"
    : !isValid
    ? "Name must be at least 2 characters"
    : isSaving
    ? "Saving…"
    : null;

  useEffect(() => {
    if (contactId) {
      loadContact();
      loadNotes();
      loadActivities();
      loadTags();
    }
  }, [contactId]);

  // Scheduler awareness (read-only): uses existing tenant-scoped Scheduler API.
  // No fuzzy matching: only exact email match within returned results.
  useEffect(() => {
    const run = async () => {
      if (!contact?.email || !contact.email.trim()) {
        setSchedulerSignals({
          checked: true,
          hasAnyMatch: false,
          hasBookedBefore: false,
          hasUpcomingBooking: false,
          upcomingBookingAt: null,
          matchedCount: 0,
          error: null,
        });
        setSchedulerRequests([]);
        return;
      }

      const email = contact.email.trim().toLowerCase();

      try {
        const res = await fetch(
          `/api/obd-scheduler/requests?search=${encodeURIComponent(email)}&limit=100`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        const requests: BookingRequest[] = (json?.data?.requests || json?.requests || []) as any;

        const exact = Array.isArray(requests)
          ? requests.filter((r) => (r.customerEmail || "").trim().toLowerCase() === email)
          : [];

        setSchedulerRequests(exact);

        const now = Date.now();
        const hasBookedBefore = exact.some((r) => r.status === "COMPLETED");
        const upcomingCandidates = exact
          .filter((r) => r.status === "APPROVED" || r.status === "PROPOSED_TIME")
          .map((r) => r.proposedStart || r.preferredStart)
          .filter((d): d is string => !!d)
          .map((d) => new Date(d).getTime())
          .filter((t) => Number.isFinite(t) && t > now)
          .sort((a, b) => a - b);

        const hasUpcomingBooking = upcomingCandidates.length > 0;
        const upcomingBookingAt = hasUpcomingBooking ? new Date(upcomingCandidates[0]).toISOString() : null;

        setSchedulerSignals({
          checked: true,
          hasAnyMatch: exact.length > 0,
          hasBookedBefore,
          hasUpcomingBooking,
          upcomingBookingAt,
          matchedCount: exact.length,
          error: null,
        });
      } catch (e) {
        setSchedulerSignals({
          checked: true,
          hasAnyMatch: false,
          hasBookedBefore: false,
          hasUpcomingBooking: false,
          upcomingBookingAt: null,
          matchedCount: 0,
          error: e instanceof Error ? e.message : "Failed to check Scheduler signals",
        });
        setSchedulerRequests([]);
      }
    };

    run();
  }, [contact?.email]);

  const loadContact = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/obd-crm/contacts/${contactId}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Contact not found");
      }

      setContact(json.data);
      resetEditFormToContact(json.data);
    } catch (err) {
      console.error("Error loading contact:", err);
      setError(err instanceof Error ? err.message : "Failed to load contact");
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const res = await fetch(`/api/obd-crm/contacts/${contactId}/notes`);
      const json = await res.json();

      if (res.ok && json.ok) {
        setNotes(json.data.notes || []);
      }
    } catch (err) {
      console.error("Error loading notes:", err);
    }
  };

  const loadActivities = async () => {
    try {
      const res = await fetch(`/api/obd-crm/contacts/${contactId}/activities`);
      const json = await res.json();

      if (res.ok && json.ok) {
        setActivities(json.data.activities || []);
      }
    } catch (err) {
      console.error("Error loading activities:", err);
    }
  };

  const loadTags = async () => {
    try {
      const res = await fetch("/api/obd-crm/tags");
      const json = await res.json();

      if (res.ok && json.ok) {
        setTags(json.data.tags || []);
      }
    } catch (err) {
      console.error("Error loading tags:", err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/obd-crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          company: editForm.company || null,
          address: editForm.address || null,
          status: editForm.status,
          tagIds: (editForm.tags || []).map((t) => t.id),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update contact");
      }

      setContact(json.data);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update contact");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this contact? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/obd-crm/contacts/${contactId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to delete contact");
      }

      router.push("/apps/obd-crm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setIsAddingNote(true);
    setError(null);

    try {
      const res = await fetch(`/api/obd-crm/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: noteContent.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to add note");
      }

      setNoteContent("");
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatShortDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return "—";
    }
  };

  const { hasReviewRequestSent, hasReviewReceived } = detectReviewSignalsFromNotes(notes);

  const timelineEntries = useMemo(() => {
    if (!contact) return [];
    return buildContactTimeline({
      contact,
      notes,
      activities,
      schedulerRequests,
    });
  }, [contact, notes, activities, schedulerRequests]);

  const handleCopy = async (text: string, field: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter + Cmd (Mac) or Enter + Ctrl (Windows/Linux)
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (noteContent.trim() && !isAddingNote) {
        handleAddNote(e as any);
      }
    }
  };

  if (isLoading) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
        title="OBD CRM"
        tagline="Contact Details"
        theme={theme}
        onThemeChange={setTheme}
      >
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={`text-center py-12 ${themeClasses.mutedText}`}>
            Loading contact...
          </div>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  if (error && !contact) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
        title="OBD CRM"
        tagline="Contact Details"
        theme={theme}
        onThemeChange={setTheme}
      >
        <OBDPanel isDark={isDark} className="mt-8">
          <div className={getErrorPanelClasses(isDark)}>{error}</div>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="OBD CRM"
      tagline="Contact Details"
      theme={theme}
      onThemeChange={setTheme}
    >
      {/* Error Display */}
      {error && (
        <div className={getErrorPanelClasses(isDark) + " mt-8"}>{error}</div>
      )}

      {/* Sticky Edit Actions (Tier 5A parity) */}
      {isEditing && (
        <OBDStickyToolbar isDark={isDark} className="mt-6">
          <OBDPanel
            isDark={isDark}
            variant="toolbar"
            className="border-0 shadow-none rounded-none overflow-hidden py-2 md:py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className={`text-sm font-medium ${themeClasses.headingText}`}>
                {isDirty ? "You have unsaved changes" : "Editing — no changes yet"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  title={isSaving ? "Wait for save to finish" : "Discard changes and revert to last saved"}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    isSaving
                      ? "opacity-50 cursor-not-allowed"
                      : isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!!saveDisabledReason}
                  title={saveDisabledReason || "Save changes"}
                  className={`${SUBMIT_BUTTON_CLASSES} w-auto ${
                    saveDisabledReason ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </OBDPanel>
        </OBDStickyToolbar>
      )}

      {/* Contact Info */}
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <OBDHeading level={2} isDark={isDark}>
            Contact Information
          </OBDHeading>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  disabled={true}
                  title="Use the sticky bar to Save or Cancel changes"
                  className={`px-4 py-2 rounded-full font-medium transition-colors opacity-70 cursor-not-allowed ${
                    isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Editing
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={SUBMIT_BUTTON_CLASSES + " w-auto"}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    isDark
                      ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  }`}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={getInputClasses(isDark)}
                required
              />
            ) : (
              <div className={themeClasses.headingText}>{contact.name}</div>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Status
            </label>
            {isEditing ? (
              <select
                value={editForm.status || "Lead"}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as CrmContactStatus })
                }
                className={getInputClasses(isDark)}
              >
                <option value="Lead">Lead</option>
                <option value="Active">Active</option>
                <option value="Past">Past</option>
                <option value="DoNotContact">Do Not Contact</option>
              </select>
            ) : (
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-sm font-medium ${
                  contact.status === "Active"
                    ? isDark
                      ? "bg-green-900/30 text-green-400"
                      : "bg-green-100 text-green-700"
                    : contact.status === "Lead"
                    ? isDark
                      ? "bg-blue-900/30 text-blue-400"
                      : "bg-blue-100 text-blue-700"
                    : contact.status === "Past"
                    ? isDark
                      ? "bg-gray-800 text-gray-400"
                      : "bg-gray-100 text-gray-600"
                    : isDark
                    ? "bg-red-900/30 text-red-400"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {contact.status}
              </span>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Email
            </label>
            {isEditing ? (
              <input
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className={getInputClasses(isDark)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className={themeClasses.mutedText}>{contact.email || "—"}</div>
                {contact.email && (
                  <button
                    type="button"
                    onClick={() => handleCopy(contact.email!, "email")}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      copiedField === "email"
                        ? isDark
                          ? "bg-green-900/30 text-green-400"
                          : "bg-green-100 text-green-700"
                        : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {copiedField === "email" ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Phone
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className={getInputClasses(isDark)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className={themeClasses.mutedText}>{contact.phone || "—"}</div>
                {contact.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy(contact.phone!, "phone")}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      copiedField === "phone"
                        ? isDark
                          ? "bg-green-900/30 text-green-400"
                          : "bg-green-100 text-green-700"
                        : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {copiedField === "phone" ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Company
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.company || ""}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                className={getInputClasses(isDark)}
              />
            ) : (
              <div className={themeClasses.mutedText}>{contact.company || "—"}</div>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Address
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.address || ""}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className={getInputClasses(isDark)}
              />
            ) : (
              <div className={themeClasses.mutedText}>{contact.address || "—"}</div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Tags
            </label>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = (editForm.tags || []).some((t) => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        const currentTags = editForm.tags || [];
                        if (isSelected) {
                          setEditForm({
                            ...editForm,
                            tags: currentTags.filter((t) => t.id !== tag.id),
                          });
                        } else {
                          setEditForm({
                            ...editForm,
                            tags: [...currentTags, tag],
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? isDark
                            ? "bg-[#29c4a9] text-white"
                            : "bg-[#29c4a9] text-white"
                          : isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contact.tags.length > 0 ? (
                  contact.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center rounded-full px-2 py-1 text-sm ${
                        isDark
                          ? "bg-slate-700 text-slate-300"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <span className={themeClasses.mutedText}>No tags</span>
                )}
              </div>
            )}
          </div>
        </div>
      </OBDPanel>

      {/* Signals / Connected Activity (read-only) */}
      <OBDPanel isDark={isDark} className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <OBDHeading level={2} isDark={isDark} className="!mb-0">
            Signals
          </OBDHeading>
          <div className="flex items-center gap-2">
            <Link
              href="/apps/obd-scheduler"
              className={`text-sm font-medium transition-colors ${
                isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
              }`}
              title="Open Scheduler (read-only)"
            >
              View in Scheduler
            </Link>
            <span className={`${themeClasses.mutedText}`}>·</span>
            <Link
              href="/apps/reputation-dashboard"
              className={`text-sm font-medium transition-colors ${
                isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
              }`}
              title="Open Reputation Dashboard (read-only)"
            >
              Open Reputation Dashboard
            </Link>
            <span className={`${themeClasses.mutedText}`}>·</span>
            <Link
              href="/apps/ai-help-desk"
              className={`text-sm font-medium transition-colors ${
                isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
              }`}
              title="Open AI Help Desk (read-only)"
            >
              View Help Desk Insights
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {/* Scheduler awareness */}
          {schedulerSignals.checked && schedulerSignals.hasAnyMatch && (
            <div>
              <div className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                Scheduler & Bookings
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {schedulerSignals.hasBookedBefore && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                      isDark
                        ? "bg-green-900/30 text-green-400 border-green-700/30"
                        : "bg-green-100 text-green-700 border-green-200"
                    }`}
                  >
                    Has booked before
                  </span>
                )}
                {schedulerSignals.hasUpcomingBooking && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                      isDark
                        ? "bg-blue-900/30 text-blue-400 border-blue-700/30"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }`}
                    title={schedulerSignals.upcomingBookingAt ? `Next: ${formatShortDateTime(schedulerSignals.upcomingBookingAt)}` : undefined}
                  >
                    Upcoming booking
                  </span>
                )}
                <span className={`text-xs ${themeClasses.mutedText}`}>
                  Matched {schedulerSignals.matchedCount} request(s) by exact email
                </span>
              </div>
            </div>
          )}

          {/* Review request awareness (derived from CRM notes only) */}
          {(hasReviewRequestSent || hasReviewReceived) && (
            <div>
              <div className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                Reviews
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {hasReviewRequestSent && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                      isDark
                        ? "bg-slate-800/50 text-slate-300 border-slate-700/30"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    Review request sent
                  </span>
                )}
                {hasReviewReceived && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                      isDark
                        ? "bg-green-900/30 text-green-400 border-green-700/30"
                        : "bg-green-100 text-green-700 border-green-200"
                    }`}
                  >
                    Review received
                  </span>
                )}
              </div>
            </div>
          )}

          {/* AI Help Desk awareness (static, no data transfer) */}
          <div>
            <div className={`text-sm font-semibold mb-1 ${themeClasses.headingText}`}>
              AI Help Desk
            </div>
            <div className={`text-sm ${themeClasses.mutedText}`}>
              Customer questions can inform CRM notes.
            </div>
          </div>

          {/* If nothing to show besides static help desk line, keep it quiet */}
          {schedulerSignals.checked && !schedulerSignals.hasAnyMatch && !hasReviewRequestSent && !hasReviewReceived && (
            <div className={`text-xs ${themeClasses.mutedText}`}>
              No connected signals detected yet.
            </div>
          )}
        </div>
      </OBDPanel>

      {/* Timeline (read-only) */}
      <OBDPanel isDark={isDark} className="mt-6">
        <OBDHeading level={2} isDark={isDark} className="mb-4">
          Timeline
        </OBDHeading>

        {timelineEntries.length === 0 ? (
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>No activity yet.</div>
        ) : (
          <div className="space-y-3">
            {timelineEntries.map((e) => (
              <div
                key={e.id}
                className={`pb-3 border-b last:border-b-0 last:pb-0 ${
                  isDark ? "border-slate-700" : "border-slate-200"
                }`}
              >
                <div className={`text-sm font-medium ${themeClasses.headingText}`}>{e.label}</div>
                <div className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                  {formatDate(e.at)} · {e.source}
                </div>
              </div>
            ))}
          </div>
        )}
      </OBDPanel>

      {/* Notes Section */}
      <OBDPanel isDark={isDark} className="mt-6">
        <OBDHeading level={2} isDark={isDark} className="mb-4">
          Notes & Activity
        </OBDHeading>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="mb-6">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Add a note... (Press Cmd/Ctrl+Enter to submit)"
            rows={3}
            className={getInputClasses(isDark, "resize-none")}
            disabled={isAddingNote}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isAddingNote || !noteContent.trim()}
              className={SUBMIT_BUTTON_CLASSES + " w-auto"}
            >
              {isAddingNote ? "Adding..." : "Add Note"}
            </button>
            <span className={`text-xs ${themeClasses.mutedText}`}>
              Cmd/Ctrl + Enter to submit
            </span>
          </div>
        </form>

        {/* Notes List */}
        {notes.length === 0 ? (
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>
            <p>No activity yet — add a note to track this relationship.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`border rounded-xl p-4 ${
                  isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className={`whitespace-pre-wrap ${themeClasses.mutedText}`}>
                  {note.content}
                </div>
                <div className={`mt-2 text-xs ${themeClasses.mutedText}`}>
                  {formatDate(note.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </OBDPanel>
    </OBDPageContainer>
  );
}

