"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type {
  CrmContact,
  CrmContactActivity,
  CrmTag,
  CrmContactStatus,
} from "@/lib/apps/obd-crm/types";

export default function ContactDetailPage() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<CrmContact | null>(null);
  const [notes, setNotes] = useState<CrmContactActivity[]>([]);
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

  useEffect(() => {
    if (contactId) {
      loadContact();
      loadNotes();
      loadTags();
    }
  }, [contactId]);

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
      setEditForm({
        name: json.data.name,
        email: json.data.email || "",
        phone: json.data.phone || "",
        company: json.data.company || "",
        address: json.data.address || "",
        status: json.data.status,
        tags: json.data.tags,
      });
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
          content: noteContent.trim(),
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
                  onClick={handleSave}
                  disabled={isSaving}
                  className={SUBMIT_BUTTON_CLASSES + " w-auto"}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      name: contact.name,
                      email: contact.email || "",
                      phone: contact.phone || "",
                      company: contact.company || "",
                      address: contact.address || "",
                      status: contact.status,
                      tags: contact.tags,
                    });
                  }}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
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

