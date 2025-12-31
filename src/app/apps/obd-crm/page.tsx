"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Force dynamic rendering - CRM page is user-specific and requires search params
export const dynamic = 'force-dynamic';
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import { parseCSV } from "@/lib/utils/csvParser";
import type {
  CrmContact,
  CrmTag,
  CrmContactStatus,
  ContactListResponse,
} from "@/lib/apps/obd-crm/types";

// Skeleton component for loading states
function Skeleton({ className, isDark }: { className?: string; isDark: boolean }) {
  return (
    <div
      className={`${className || ""} ${
        isDark ? "bg-slate-700/50" : "bg-slate-200/50"
      } animate-pulse rounded`}
    />
  );
}

function OBDCRMPageContent() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [contactsErrorDetails, setContactsErrorDetails] = useState<{ code?: string; guidance?: string[] } | null>(null);
  const [tagsErrorDetails, setTagsErrorDetails] = useState<{ code?: string; guidance?: string[] } | null>(null);
  
  // DB Doctor report state
  const [doctorReport, setDoctorReport] = useState<{
    verdict: "PASS" | "FAIL";
    checks: Array<{ id: string; name: string; status: "PASS" | "FAIL"; message: string; details?: any }>;
  } | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  // Contact detail drawer state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const drawerContentRef = React.useRef<HTMLDivElement>(null);
  const [contactDetail, setContactDetail] = useState<(CrmContact & { activities?: Array<{
    id: string;
    contactId: string;
    businessId: string;
    type: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }> }) | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CrmContact>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Loading states for notes and activities
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<Array<{
    id: string;
    contactId: string;
    businessId: string;
    type: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Activities state
  const [activities, setActivities] = useState<Array<{
    id: string;
    contactId: string;
    businessId: string;
    type: string;
    summary: string | null;
    occurredAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [newActivityType, setNewActivityType] = useState<"CALL" | "EMAIL" | "TEXT" | "MEETING" | "TASK" | "OTHER">("CALL");
  const [newActivitySummary, setNewActivitySummary] = useState("");
  const [newActivityOccurredAt, setNewActivityOccurredAt] = useState("");
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  // Follow-up state
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpToastMessage, setFollowUpToastMessage] = useState<string | null>(null);
  const followUpToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Integration modals state
  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [showHelpDeskModal, setShowHelpDeskModal] = useState(false);
  const [helpDeskPrompt, setHelpDeskPrompt] = useState("");
  const [useLastNote, setUseLastNote] = useState(true);
  const [useActivityTimeline, setUseActivityTimeline] = useState(false);
  const [showSocialPostModal, setShowSocialPostModal] = useState(false);
  const [socialPostIntent, setSocialPostIntent] = useState<"Follow-up" | "Thank-you" | "Testimonial ask" | "Promo mention">("Follow-up");
  const [socialPostUseLastNote, setSocialPostUseLastNote] = useState(true);
  const [socialPostUseLastActivity, setSocialPostUseLastActivity] = useState(false);
  const [socialPostPlatform, setSocialPostPlatform] = useState<"All" | "Facebook" | "Instagram" | "Google Business">("All");
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [offerGoal, setOfferGoal] = useState<"Reactivation" | "New customer" | "Upsell" | "Referral">("Reactivation");
  const [offerType, setOfferType] = useState<"Discount" | "Free add-on" | "Limited-time deal" | "Bundle">("Discount");
  const [offerHint, setOfferHint] = useState("");
  const [offerUseLastNote, setOfferUseLastNote] = useState(true);

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<{
    name: string;
    email: string;
    phone: string;
    status: string;
    tags: string;
  }>({
    name: "",
    email: "",
    phone: "",
    status: "",
    tags: "",
  });
  const [importPreview, setImportPreview] = useState<Array<{
    name: string;
    email?: string;
    phone?: string;
    status?: string;
    tags?: string[];
  }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    skippedCount: number;
    errors?: Array<{ row: number; error: string }>;
  } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CrmContactStatus | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState<"all" | "dueToday" | "overdue" | "upcoming">("all");
  
  // Table density preference
  const [tableDensity, setTableDensity] = useState<"comfortable" | "compact">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("obd_crm_density");
      if (saved === "comfortable" || saved === "compact") {
        return saved;
      }
    }
    return "comfortable";
  });
  
  // Save density preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("obd_crm_density", tableDensity);
    }
  }, [tableDensity]);

  // Follow-up view mode (Table or Queue)
  const [followUpView, setFollowUpView] = useState<"table" | "queue">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("obd_crm_followup_view");
      return (saved === "queue" ? "queue" : "table") as "table" | "queue";
    }
    return "table";
  });

  // Save view preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("obd_crm_followup_view", followUpView);
    }
  }, [followUpView]);
  
  // Copy confirmation state (contactId -> "email" | "phone" | null)
  const [copiedItem, setCopiedItem] = useState<{ contactId: string; type: "email" | "phone" } | null>(null);

  // Create contact modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    status: "Lead" as CrmContactStatus,
  });

  // Debounced search (250ms delay)
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  // Safe fetch helper to prevent JSON parsing crashes
  const safeFetch = useCallback(async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    let json: any = null;

    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        // JSON parsing failed, json remains null
      }
    }

    if (!res.ok) {
      const msg = json?.error || json?.message || `Request failed (${res.status})`;
      return { ok: false as const, url, status: res.status, msg, body: text };
    }

    if (!json) {
      return {
        ok: false as const,
        url,
        status: res.status,
        msg: "Expected JSON but received non-JSON response",
        body: text,
      };
    }

    if (json.ok === false) {
      return {
        ok: false as const,
        url,
        status: res.status,
        msg: json.error || "API error",
        body: text,
      };
    }

    return { ok: true as const, url, status: res.status, data: json.data ?? json };
  }, []);

  // Load contacts and tags
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setContactsError(null);
    setTagsError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (tagFilter) params.set("tagId", tagFilter);

      const contactsUrl = `/api/obd-crm/contacts?${params.toString()}`;
      const tagsUrl = "/api/obd-crm/tags";

      // Load both endpoints in parallel with Promise.allSettled
      const [contactsResult, tagsResult] = await Promise.allSettled([
        safeFetch(contactsUrl),
        safeFetch(tagsUrl),
      ]);

      // Handle contacts result
      if (contactsResult.status === "fulfilled" && contactsResult.value.ok) {
        const contactsData = contactsResult.value.data;
        if (contactsData && Array.isArray(contactsData.contacts)) {
          setContacts(contactsData.contacts);
          setContactsError(null);
          setContactsErrorDetails(null);
        } else {
          const errorMsg = `Invalid response format from ${contactsUrl}`;
          setContactsError(errorMsg);
          setContactsErrorDetails(null);
          if (process.env.NODE_ENV !== "production") {
            console.error(`[CRM] ${errorMsg}:`, contactsData);
          }
        }
      } else {
        const error =
          contactsResult.status === "fulfilled"
            ? contactsResult.value
            : { url: contactsUrl, status: 0, msg: contactsResult.reason?.message || "Network error", body: "", json: null };
        
        // Try to extract structured error details from response body
        let errorDetails: { code?: string; guidance?: string[] } | null = null;
        if (error.body) {
          try {
            const errorJson = JSON.parse(error.body);
            if (errorJson.code && errorJson.details?.guidance) {
              errorDetails = {
                code: errorJson.code,
                guidance: errorJson.details.guidance,
              };
            }
          } catch {
            // Not JSON or doesn't have expected structure, ignore
          }
        }
        
        const errorMsg = `Failed to load contacts: ${error.msg} (${error.url} - ${error.status})`;
        setContactsError(errorMsg);
        setContactsErrorDetails(errorDetails);
        if (process.env.NODE_ENV !== "production") {
          console.error(`[CRM] ${errorMsg}`, {
            url: error.url,
            status: error.status,
            body: error.body?.substring(0, 500) || "",
            details: errorDetails,
          });
        }
      }

      // Handle tags result
      if (tagsResult.status === "fulfilled" && tagsResult.value.ok) {
        const tagsData = tagsResult.value.data;
        if (tagsData && Array.isArray(tagsData.tags)) {
          setTags(tagsData.tags);
          setTagsError(null);
          setTagsErrorDetails(null);
        } else {
          // Tags format error is non-critical, just log
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[CRM] Invalid tags format from ${tagsUrl}:`, tagsData);
          }
        }
      } else {
        const error =
          tagsResult.status === "fulfilled"
            ? tagsResult.value
            : { url: tagsUrl, status: 0, msg: tagsResult.reason?.message || "Network error", body: "", json: null };
        
        // Try to extract structured error details from response body
        let errorDetails: { code?: string; guidance?: string[] } | null = null;
        if (error.body) {
          try {
            const errorJson = JSON.parse(error.body);
            if (errorJson.code && errorJson.details?.guidance) {
              errorDetails = {
                code: errorJson.code,
                guidance: errorJson.details.guidance,
              };
            }
          } catch {
            // Not JSON or doesn't have expected structure, ignore
          }
        }
        
        const errorMsg = `Failed to load tags: ${error.msg} (${error.url} - ${error.status})`;
        setTagsError(errorMsg);
        setTagsErrorDetails(errorDetails);
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[CRM] ${errorMsg}`, {
            url: error.url,
            status: error.status,
            body: error.body?.substring(0, 500) || "",
            details: errorDetails,
          });
        }
      }
    } catch (err) {
      // This catch should rarely trigger since safeFetch handles errors
      // Only catches errors from Promise.allSettled itself or state updates
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorMsg = `Failed to load data: ${errorMessage}`;
      setError(errorMsg);
      if (process.env.NODE_ENV !== "production") {
        console.error(`[CRM] Unexpected error in loadData:`, {
          error: errorMessage,
          contactsUrl: `/api/obd-crm/contacts?${new URLSearchParams().toString()}`,
          tagsUrl: "/api/obd-crm/tags",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, tagFilter, debouncedSearch, safeFetch]);

  // Load DB Doctor report on mount
  useEffect(() => {
    const loadDoctorReport = async () => {
      try {
        const response = await fetch("/api/debug/obd-crm-db-doctor", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          // Support both new and legacy formats
          if (data.data?.verdict) {
            // New format
            setDoctorReport({
              verdict: data.data.verdict,
              checks: data.data.checks || [],
            });
          } else if (data.data?.migrationStatusHint) {
            // Legacy format - convert to new format
            const allPass = data.ok === true;
            setDoctorReport({
              verdict: allPass ? "PASS" : "FAIL",
              checks: [],
            });
          }
        }
      } catch (error) {
        // Silently fail - doctor report is optional
        if (process.env.NODE_ENV !== "production") {
          console.warn("[CRM] Failed to load DB Doctor report:", error);
        }
      }
    };
    loadDoctorReport();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle contactId query param to open contact detail drawer
  useEffect(() => {
    if (searchParams) {
      const contactId = searchParams.get("contactId");
      if (contactId && contactId !== selectedContactId) {
        setSelectedContactId(contactId);
      }
    }
  }, [searchParams, selectedContactId]);

  // Load contact detail when selected
  useEffect(() => {
    if (selectedContactId) {
      const loadContactDetail = async () => {
        setIsLoadingDetail(true);
        setDetailError(null);
        try {
          const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}`, { cache: "no-store" });
          const data = await response.json();
          if (data.ok && data.data) {
            setContactDetail(data.data);
            setEditForm({
              name: data.data.name,
              email: data.data.email || "",
              phone: data.data.phone || "",
              company: data.data.company || "",
              address: data.data.address || "",
              status: data.data.status,
            });
            // Set follow-up fields
            if (data.data.nextFollowUpAt) {
              // Convert ISO string to datetime-local format
              const date = new Date(data.data.nextFollowUpAt);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              const hours = String(date.getHours()).padStart(2, "0");
              const minutes = String(date.getMinutes()).padStart(2, "0");
              setFollowUpAt(`${year}-${month}-${day}T${hours}:${minutes}`);
            } else {
              setFollowUpAt("");
            }
            setFollowUpNote(data.data.nextFollowUpNote || "");
            // Load notes and activities separately
            loadNotes(selectedContactId);
            loadActivities(selectedContactId);
          } else {
            setDetailError(data.error || "Failed to load contact");
          }
        } catch (error) {
          setDetailError(error instanceof Error ? error.message : "Failed to load contact");
        } finally {
          setIsLoadingDetail(false);
        }
      };
      loadContactDetail();
    }
  }, [selectedContactId]);

  // Restore scroll position when drawer opens
  useEffect(() => {
    if (selectedContactId && drawerContentRef.current && !isLoadingDetail) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        const savedPosition = localStorage.getItem("obd_crm_drawer_scrollPosition");
        if (savedPosition) {
          drawerContentRef.current?.scrollTo({
            top: parseInt(savedPosition, 10),
            behavior: "auto", // Instant restore, not smooth
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedContactId, isLoadingDetail]);

  // ESC key handler to close drawer
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedContactId) {
        // Save scroll position before closing
        if (drawerContentRef.current) {
          const scrollPosition = drawerContentRef.current.scrollTop;
          localStorage.setItem("obd_crm_drawer_scrollPosition", scrollPosition.toString());
        }
        setSelectedContactId(null);
        setContactDetail(null);
        setIsEditing(false);
        setDetailError(null);
        setNotes([]);
        setNewNoteText("");
        setNotesError(null);
        setActivities([]);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedContactId]);

  // Load notes for a contact
  const loadNotes = async (contactId: string) => {
    setIsLoadingNotes(true);
    setNotesError(null);
    try {
      const response = await fetch(`/api/obd-crm/contacts/${contactId}/notes`, { cache: "no-store" });
      const data = await response.json();
      if (data.ok && data.data) {
        setNotes(data.data.notes || []);
        setNotesError(null);
      } else {
        setNotesError(data.error || "Failed to load notes");
        setNotes([]);
      }
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to load notes");
      setNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Load activities for a contact
  const loadActivities = async (contactId: string) => {
    setIsLoadingActivities(true);
    try {
      const response = await fetch(`/api/obd-crm/contacts/${contactId}/activities`, { cache: "no-store" });
      const data = await response.json();
      if (data.ok && data.data) {
        setActivities(data.data.activities || []);
        setActivitiesError(null);
      } else {
        setActivitiesError(data.error || "Failed to load activities");
        setActivities([]);
      }
    } catch (error) {
      setActivitiesError(error instanceof Error ? error.message : "Failed to load activities");
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Handle adding a note
  const handleAddNote = async () => {
    if (!selectedContactId || !newNoteText.trim()) return;

    setIsAddingNote(true);
    setNotesError(null);
    try {
      const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newNoteText.trim() }),
      });
      const data = await response.json();
      if (data.ok && data.data) {
        // Optimistically add the note to the list (newest first)
        setNotes((prev) => [data.data, ...prev]);
        setNewNoteText("");
        // Also update contactDetail activities if present
        if (contactDetail) {
          setContactDetail({
            ...contactDetail,
            activities: [data.data, ...(contactDetail.activities || [])],
          });
        }
        
        // Update lastTouchAt in the contacts list for this contact
        // Notes use createdAt as lastTouchAt
        if (data.data.createdAt && selectedContactId) {
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === selectedContactId
                ? { ...contact, lastTouchAt: data.data.createdAt }
                : contact
            )
          );
        }
      } else {
        setNotesError(data.error || "Failed to add note");
      }
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  // Handle adding an activity
  const handleAddActivity = async () => {
    if (!selectedContactId || !newActivitySummary.trim()) return;

    setIsAddingActivity(true);
    setActivitiesError(null);
    try {
      const payload: any = {
        type: newActivityType,
        summary: newActivitySummary.trim(),
      };
      
      // Include occurredAt if provided (convert datetime-local to ISO string)
      if (newActivityOccurredAt) {
        // datetime-local format: "YYYY-MM-DDTHH:mm"
        // Convert to ISO string for API
        const date = new Date(newActivityOccurredAt);
        if (!isNaN(date.getTime())) {
          payload.occurredAt = date.toISOString();
        }
      }

      const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.ok && data.data) {
        // Optimistically add the activity to the list (newest first)
        setActivities((prev) => [data.data, ...prev]);
        setNewActivitySummary("");
        setNewActivityOccurredAt("");
        
        // Update lastTouchAt in the contacts list for this contact
        // Use occurredAt if available, otherwise use createdAt
        const newLastTouchAt = data.data.occurredAt || data.data.createdAt;
        if (newLastTouchAt && selectedContactId) {
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === selectedContactId
                ? { ...contact, lastTouchAt: newLastTouchAt }
                : contact
            )
          );
        }
      } else {
        setActivitiesError(data.error || "Failed to add activity");
      }
    } catch (error) {
      setActivitiesError(error instanceof Error ? error.message : "Failed to add activity");
    } finally {
      setIsAddingActivity(false);
    }
  };

  // Date utility helpers for follow-up
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const toDatetimeLocalValue = (date: Date | null | undefined): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fromDatetimeLocalValue = (value: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  // Get preferred time of day for quick set
  const getPreferredTimeOfDay = (): string => {
    // If current input has a value, use its time
    if (followUpAt) {
      const date = fromDatetimeLocalValue(followUpAt);
      if (date) {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      }
    }
    // Else if contact has nextFollowUpAt, use its time
    if (contactDetail?.nextFollowUpAt) {
      const date = new Date(contactDetail.nextFollowUpAt);
      if (!isNaN(date.getTime())) {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      }
    }
    // Default to 9:00 AM
    return "09:00";
  };

  // Set date with specific time (returns datetime-local string)
  const setDateWithTime = (targetDate: Date, hhmm: string): string => {
    const [hours, minutes] = hhmm.split(":").map(Number);
    const date = new Date(targetDate);
    date.setHours(hours || 9, minutes || 0, 0, 0);
    return toDatetimeLocalValue(date);
  };

  // Add months with clamping (handles month overflow)
  const addMonthsClamped = (date: Date, months: number): Date => {
    const result = new Date(date);
    const originalDay = result.getDate();
    result.setMonth(result.getMonth() + months);
    
    // If the day overflowed (e.g., Jan 31 → Feb doesn't exist), clamp to last day of month
    if (result.getDate() !== originalDay) {
      result.setDate(0); // Go to last day of previous month (which is the target month)
    }
    
    return result;
  };

  // Format date for toast messages (short friendly format: "Jan 7, 9:00 AM")
  const formatFollowUpDateForToast = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  // Show follow-up toast message
  const showFollowUpToast = (message: string, durationMs = 2000) => {
    // Clear any existing timer
    if (followUpToastTimerRef.current) {
      clearTimeout(followUpToastTimerRef.current);
      followUpToastTimerRef.current = null;
    }
    
    // Set message
    setFollowUpToastMessage(message);
    
    // Set timeout to clear message
    followUpToastTimerRef.current = setTimeout(() => {
      setFollowUpToastMessage(null);
      followUpToastTimerRef.current = null;
    }, durationMs);
  };

  // Get follow-up status classification
  const getFollowUpStatus = (dateStr: string | null | undefined): "OVERDUE" | "TODAY" | "UPCOMING" | "NONE" => {
    if (!dateStr) return "NONE";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      if (date.getTime() < now.getTime()) return "OVERDUE";
      if (date.getTime() >= todayStart.getTime() && date.getTime() < todayEnd.getTime()) return "TODAY";
      return "UPCOMING";
    } catch {
      return "NONE";
    }
  };

  // Classify follow-up with more granular categories for counting
  const classifyFollowUp = (nextFollowUpAt: string | null | undefined, now: Date = new Date()): "NONE" | "OVERDUE" | "TODAY" | "UPCOMING_7D" | "LATER" => {
    if (!nextFollowUpAt) return "NONE";
    try {
      const date = new Date(nextFollowUpAt);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      if (date.getTime() < now.getTime()) return "OVERDUE";
      if (date.getTime() >= todayStart.getTime() && date.getTime() < todayEnd.getTime()) return "TODAY";
      if (date.getTime() >= now.getTime() && date.getTime() <= sevenDaysFromNow.getTime()) return "UPCOMING_7D";
      return "LATER";
    } catch {
      return "NONE";
    }
  };

  // Handle saving follow-up
  const handleSaveFollowUp = async () => {
    if (!selectedContactId) return;

    setIsSavingFollowUp(true);
    setFollowUpError(null);
    try {
      const payload: any = {
        nextFollowUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        nextFollowUpNote: followUpNote.trim() || null,
      };

      const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.ok && data.data) {
        // Update contact detail
        setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
        // Update contacts list state
        if (selectedContactId) {
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === selectedContactId
                ? {
                    ...contact,
                    nextFollowUpAt: data.data.nextFollowUpAt || null,
                    nextFollowUpNote: data.data.nextFollowUpNote || null,
                  }
                : contact
            )
          );
        }
        // Show success message
        if (data.data.nextFollowUpAt) {
          const formattedDate = formatFollowUpDateForToast(data.data.nextFollowUpAt);
          showFollowUpToast(`Follow-up saved for ${formattedDate}`);
        } else {
          showFollowUpToast("Follow-up saved");
        }
      } else {
        setFollowUpError(data.error || "Failed to save follow-up");
      }
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : "Failed to save follow-up");
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Handle snoozing follow-up
  const handleSnoozeFollowUp = async (days: number) => {
    if (!selectedContactId || !contactDetail?.nextFollowUpAt) return;

    setIsSavingFollowUp(true);
    setFollowUpError(null);
    try {
      const currentDate = new Date(contactDetail.nextFollowUpAt);
      const newDate = addDays(currentDate, days);
      const newDateISO = newDate.toISOString();

      const payload: any = {
        nextFollowUpAt: newDateISO,
        nextFollowUpNote: contactDetail.nextFollowUpNote || null,
      };

      const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.ok && data.data) {
        // Update contact detail
        setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
        // Update contacts list state
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === selectedContactId
              ? {
                  ...contact,
                  nextFollowUpAt: data.data.nextFollowUpAt || null,
                  nextFollowUpNote: data.data.nextFollowUpNote || null,
                }
              : contact
          )
        );
        // Update form input
        if (data.data.nextFollowUpAt) {
          const date = new Date(data.data.nextFollowUpAt);
          setFollowUpAt(toDatetimeLocalValue(date));
          // Show success message
          const formattedDate = formatFollowUpDateForToast(data.data.nextFollowUpAt);
          showFollowUpToast(`Follow-up moved to ${formattedDate}`);
        }
      } else {
        setFollowUpError(data.error || "Failed to snooze follow-up");
      }
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : "Failed to snooze follow-up");
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Handle clearing follow-up
  const handleClearFollowUp = async () => {
    if (!selectedContactId) return;

    setIsSavingFollowUp(true);
    setFollowUpError(null);
    try {
      const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextFollowUpAt: null,
          nextFollowUpNote: null,
        }),
      });
      const data = await response.json();
      if (data.ok && data.data) {
        setFollowUpAt("");
        setFollowUpNote("");
        // Update contact detail
        setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
        // Update contacts list state
        if (selectedContactId) {
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === selectedContactId
                ? {
                    ...contact,
                    nextFollowUpAt: null,
                    nextFollowUpNote: null,
                  }
                : contact
            )
          );
        }
        // Show success message
        showFollowUpToast("Follow-up cleared");
      } else {
        setFollowUpError(data.error || "Failed to clear follow-up");
      }
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : "Failed to clear follow-up");
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (followUpToastTimerRef.current) {
        clearTimeout(followUpToastTimerRef.current);
        followUpToastTimerRef.current = null;
      }
    };
  }, []);

  // Close drawer handler
  const closeDetailDrawer = () => {
    // Clear toast timer when drawer closes
    if (followUpToastTimerRef.current) {
      clearTimeout(followUpToastTimerRef.current);
      followUpToastTimerRef.current = null;
    }
    setFollowUpToastMessage(null);
    
    // Save scroll position before closing
    if (drawerContentRef.current) {
      const scrollPosition = drawerContentRef.current.scrollTop;
      localStorage.setItem("obd_crm_drawer_scrollPosition", scrollPosition.toString());
    }
    setSelectedContactId(null);
    setContactDetail(null);
    setIsEditing(false);
    setDetailError(null);
    setNotes([]);
    setNewNoteText("");
    setNotesError(null);
    setActivities([]);
    setNewActivityType("CALL");
    setNewActivitySummary("");
    setNewActivityOccurredAt("");
    setActivitiesError(null);
    setFollowUpAt("");
    setFollowUpNote("");
    setFollowUpError(null);
  };

  // Handle contact row click
  const handleContactClick = (contactId: string) => {
    setSelectedContactId(contactId);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!selectedContactId || !contactDetail) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/obd-crm/contacts/${selectedContactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (data.ok && data.data) {
        setContactDetail(data.data);
        setIsEditing(false);
        // Refresh the list to show updated data
        loadData();
      } else {
        setDetailError(data.error || "Failed to update contact");
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Failed to update contact");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      if (!newContact.name.trim()) {
        setCreateError("Name is required");
        setIsCreating(false);
        return;
      }

      const res = await fetch("/api/obd-crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name.trim(),
          email: newContact.email.trim() || undefined,
          phone: newContact.phone.trim() || undefined,
          company: newContact.company.trim() || undefined,
          address: newContact.address.trim() || undefined,
          status: newContact.status,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to create contact");
      }

      // Reset form and reload
      setNewContact({
        name: "",
        email: "",
        phone: "",
        company: "",
        address: "",
        status: "Lead",
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setIsCreating(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setError(null); // Clear general error

    try {
      const res = await fetch("/api/obd-crm/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: debouncedSearch.trim() || undefined,
          status: statusFilter || undefined,
          tagId: tagFilter || undefined,
        }),
      });

      if (!res.ok) {
        // Try to parse error response
        try {
          const errorJson = await res.json();
          throw new Error(errorJson.error || "Export failed");
        } catch {
          throw new Error(`Export failed (${res.status})`);
        }
      }

      // Get filename from Content-Disposition header, or use default
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `obd-crm-contacts-${new Date().toISOString().split("T")[0]}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download CSV file using Blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      const errorMessage = err instanceof Error ? err.message : "Export failed";
      setExportError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  // CSV Import handlers
  const handleFileUpload = async (file: File) => {
    setCsvFile(file);
    const text = await file.text();
    const parsed = parseCSV(text);
    
    if (parsed.error) {
      setCsvData(null);
      alert(`CSV parsing error: ${parsed.error}`);
      return;
    }
    
    setCsvData({ headers: parsed.headers, rows: parsed.rows });
    
    // Auto-detect column mapping (simple heuristic)
    const autoMapping: typeof columnMapping = {
      name: "",
      email: "",
      phone: "",
      status: "",
      tags: "",
    };
    
    parsed.headers.forEach((header, idx) => {
      const lower = header.toLowerCase().trim();
      if (lower.includes("name") && !autoMapping.name) autoMapping.name = header;
      else if (lower.includes("email") && !autoMapping.email) autoMapping.email = header;
      else if ((lower.includes("phone") || lower.includes("tel")) && !autoMapping.phone) autoMapping.phone = header;
      else if (lower.includes("status") && !autoMapping.status) autoMapping.status = header;
      else if (lower.includes("tag") && !autoMapping.tags) autoMapping.tags = header;
    });
    
    setColumnMapping(autoMapping);
    setImportStep(2);
  };

  const handlePreview = () => {
    if (!csvData || !columnMapping.name) {
      alert("Please map at least the 'Name' column");
      return;
    }

    const preview: typeof importPreview = [];
    const nameIdx = csvData.headers.indexOf(columnMapping.name);
    const emailIdx = columnMapping.email ? csvData.headers.indexOf(columnMapping.email) : -1;
    const phoneIdx = columnMapping.phone ? csvData.headers.indexOf(columnMapping.phone) : -1;
    const statusIdx = columnMapping.status ? csvData.headers.indexOf(columnMapping.status) : -1;
    const tagsIdx = columnMapping.tags ? csvData.headers.indexOf(columnMapping.tags) : -1;

    for (let i = 0; i < Math.min(10, csvData.rows.length); i++) {
      const row = csvData.rows[i];
      const name = nameIdx >= 0 && row[nameIdx] ? row[nameIdx].trim() : "";
      if (!name) continue; // Skip rows without name

      const previewRow: typeof importPreview[0] = { name };
      if (emailIdx >= 0 && row[emailIdx]) previewRow.email = row[emailIdx].trim();
      if (phoneIdx >= 0 && row[phoneIdx]) previewRow.phone = row[phoneIdx].trim();
      if (statusIdx >= 0 && row[statusIdx]) {
        const statusVal = row[statusIdx].trim();
        if (["Lead", "Active", "Past", "DoNotContact"].includes(statusVal)) {
          previewRow.status = statusVal as CrmContactStatus;
        }
      }
      if (tagsIdx >= 0 && row[tagsIdx]) {
        previewRow.tags = row[tagsIdx].split(",").map((t) => t.trim()).filter(Boolean);
      }
      preview.push(previewRow);
    }

    setImportPreview(preview);
    setImportStep(3);
  };

  const handleImport = async () => {
    if (!csvData || !columnMapping.name) return;

    setIsImporting(true);
    try {
      const nameIdx = csvData.headers.indexOf(columnMapping.name);
      const emailIdx = columnMapping.email ? csvData.headers.indexOf(columnMapping.email) : -1;
      const phoneIdx = columnMapping.phone ? csvData.headers.indexOf(columnMapping.phone) : -1;
      const statusIdx = columnMapping.status ? csvData.headers.indexOf(columnMapping.status) : -1;
      const tagsIdx = columnMapping.tags ? csvData.headers.indexOf(columnMapping.tags) : -1;

      const rowsToImport: Array<{
        name: string;
        email?: string;
        phone?: string;
        status?: CrmContactStatus;
        tags?: string[];
      }> = [];

      for (const row of csvData.rows) {
        const name = nameIdx >= 0 && row[nameIdx] ? row[nameIdx].trim() : "";
        if (!name) continue; // Skip rows without name

        const importRow: typeof rowsToImport[0] = { name };
        if (emailIdx >= 0 && row[emailIdx]) importRow.email = row[emailIdx].trim();
        if (phoneIdx >= 0 && row[phoneIdx]) importRow.phone = row[phoneIdx].trim();
        if (statusIdx >= 0 && row[statusIdx]) {
          const statusVal = row[statusIdx].trim();
          if (["Lead", "Active", "Past", "DoNotContact"].includes(statusVal)) {
            importRow.status = statusVal as CrmContactStatus;
          }
        }
        if (tagsIdx >= 0 && row[tagsIdx]) {
          // Tags should be tag IDs, but we'll accept tag names and try to match them
          // For now, we'll require tag IDs (future enhancement: lookup by name)
          const tagNames = row[tagsIdx].split(",").map((t) => t.trim()).filter(Boolean);
          // Match tag names to tag IDs
          const tagIds = tagNames
            .map((name) => tags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id)
            .filter((id): id is string => !!id);
          if (tagIds.length > 0) importRow.tags = tagIds;
        }
        rowsToImport.push(importRow);
      }

      const response = await fetch("/api/obd-crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToImport }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Import failed");
      }

      setImportResult(data.data);
      setImportStep(4);
      // Reload contacts
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="OBD CRM"
      tagline="Keep track of customers, notes, and relationships in one place."
      theme={theme}
      onThemeChange={setTheme}
    >
      {/* Controls */}
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={getInputClasses(isDark)}
            />
          </div>

          {/* Status Filter */}
          <div className="min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CrmContactStatus | "")}
              className={getInputClasses(isDark)}
            >
              <option value="">All Statuses</option>
              <option value="Lead">Lead</option>
              <option value="Active">Active</option>
              <option value="Past">Past</option>
              <option value="DoNotContact">Do Not Contact</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div className="min-w-[150px]">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className={getInputClasses(isDark)}
            >
              <option value="">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          {/* Follow-Up Filter */}
          <div className="min-w-[150px]">
            <select
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value as typeof followUpFilter)}
              className={getInputClasses(isDark)}
            >
              <option value="all">All Follow-Ups</option>
              <option value="dueToday">Due Today</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming (7 days)</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${themeClasses.mutedText}`}>View:</span>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(148, 163, 184, 0.5)" }}>
              <button
                type="button"
                onClick={() => setFollowUpView("table")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  followUpView === "table"
                    ? isDark
                      ? "bg-blue-700 text-white"
                      : "bg-blue-100 text-blue-700"
                    : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setFollowUpView("queue")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  followUpView === "queue"
                    ? isDark
                      ? "bg-blue-700 text-white"
                      : "bg-blue-100 text-blue-700"
                    : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Queue
              </button>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${themeClasses.mutedText}`}>View:</span>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(148, 163, 184, 0.5)" }}>
              <button
                type="button"
                onClick={() => setFollowUpView("table")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  followUpView === "table"
                    ? isDark
                      ? "bg-blue-700 text-white"
                      : "bg-blue-100 text-blue-700"
                    : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setFollowUpView("queue")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  followUpView === "queue"
                    ? isDark
                      ? "bg-blue-700 text-white"
                      : "bg-blue-100 text-blue-700"
                    : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Queue
              </button>
            </div>
          </div>

          {/* Density Toggle (only in table view) */}
          {followUpView === "table" && (
            <div className="flex items-center gap-2">
              <span className={`text-sm ${themeClasses.mutedText}`}>Density:</span>
              <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(148, 163, 184, 0.5)" }}>
                <button
                  type="button"
                  onClick={() => setTableDensity("comfortable")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    tableDensity === "comfortable"
                      ? isDark
                        ? "bg-blue-700 text-white"
                        : "bg-blue-100 text-blue-700"
                      : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  onClick={() => setTableDensity("compact")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    tableDensity === "compact"
                      ? isDark
                        ? "bg-blue-700 text-white"
                        : "bg-blue-100 text-blue-700"
                      : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className={SUBMIT_BUTTON_CLASSES + " w-auto"}
            >
              Add Contact
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                isExporting
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              } ${
                isDark
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {isExporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImportModal(true);
                setImportStep(1);
                setCsvFile(null);
                setCsvData(null);
                setColumnMapping({ name: "", email: "", phone: "", status: "", tags: "" });
                setImportPreview([]);
                setImportResult(null);
              }}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                isDark
                  ? "bg-green-700 text-white hover:bg-green-600"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              Import CSV
            </button>
          </div>
        </div>
      </OBDPanel>

      {/* Error Display */}
      {/* Show DB Doctor report if verdict is FAIL */}
      {doctorReport && doctorReport.verdict === "FAIL" && (
        <div className="space-y-2 mt-4">
          <div className={getErrorPanelClasses(isDark)}>
            <div className="mb-3">
              <strong className="text-base">Database Setup Issue</strong>
              <p className="mt-1 text-sm opacity-90">
                Database configuration check failed. Please review the issues below.
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {/* Show top 1-3 failing checks */}
              {doctorReport.checks
                .filter((check) => check.status === "FAIL")
                .slice(0, 3)
                .map((check) => (
                  <div key={check.id} className="text-sm">
                    <strong className="font-medium">{check.name}:</strong>{" "}
                    <span className="opacity-90">{check.message}</span>
                  </div>
                ))}
              
              {/* Expandable full report section */}
              <div className="mt-3 pt-3 border-t border-current/20">
                <button
                  type="button"
                  onClick={() => setShowFullReport(!showFullReport)}
                  className={`text-sm font-medium mb-2 hover:opacity-80 transition-opacity ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {showFullReport ? "▼" : "▶"} View full report
                </button>
                {showFullReport && (
                  <div className="mt-2 space-y-2">
                    {doctorReport.checks.map((check) => (
                      <div
                        key={check.id}
                        className={`text-sm p-2 rounded ${
                          check.status === "PASS"
                            ? isDark
                              ? "bg-green-900/20"
                              : "bg-green-50"
                            : isDark
                            ? "bg-red-900/20"
                            : "bg-red-50"
                        }`}
                      >
                        <div className="font-medium">
                          {check.status === "PASS" ? "✓" : "✗"} {check.name}
                        </div>
                        <div className="opacity-90 mt-1">{check.message}</div>
                        {check.details && (
                          <div className="mt-1 text-xs opacity-75">
                            {JSON.stringify(check.details, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Fallback: Show old error display if doctor report not available and errors exist */}
      {(!doctorReport || doctorReport.verdict === "PASS") && (error || exportError || contactsError || tagsError) && (
        <div className="space-y-2 mt-4">
          {/* Consolidated diagnostic panel when both contacts and tags fail */}
          {contactsError && tagsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <div className="mb-3">
                <strong className="text-base">Database Setup Issue</strong>
                <p className="mt-1 text-sm opacity-90">
                  Both contacts and tags failed to load. This usually indicates a database configuration problem.
                </p>
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-sm font-medium">Likely causes:</div>
                <ul className="list-disc list-inside space-y-1 text-sm opacity-90 ml-2">
                  <li>Database migrations not applied - Run: <code className="bg-black/20 px-1 rounded">npx prisma migrate deploy</code></li>
                  <li>Prisma client not generated - Run: <code className="bg-black/20 px-1 rounded">npx prisma generate</code></li>
                  <li>Database server offline or unreachable - Check DATABASE_URL in .env.local</li>
                  <li>Database connection timeout - Verify network connectivity</li>
                </ul>
                {(contactsErrorDetails?.guidance || tagsErrorDetails?.guidance) && (
                  <div className="mt-3 pt-3 border-t border-current/20">
                    <div className="text-sm font-medium mb-2">Recommended steps:</div>
                    <ul className="list-disc list-inside space-y-1 text-sm opacity-90 ml-2">
                      {(contactsErrorDetails?.guidance || tagsErrorDetails?.guidance || []).map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Individual error panels when only one fails (partial rendering) */}
          {contactsError && !tagsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <strong>Contacts:</strong> {contactsError}
              {contactsErrorDetails?.guidance && (
                <div className="mt-2 text-sm opacity-90">
                  <div className="font-medium mb-1">Try:</div>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {contactsErrorDetails.guidance.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {tagsError && !contactsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <strong>Tags:</strong> {tagsError}
              {tagsErrorDetails?.guidance && (
                <div className="mt-2 text-sm opacity-90">
                  <div className="font-medium mb-1">Try:</div>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {tagsErrorDetails.guidance.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className={getErrorPanelClasses(isDark)}>
              {error}
            </div>
          )}
          {exportError && (
            <div className={getErrorPanelClasses(isDark)}>
              {exportError}
            </div>
          )}
        </div>
      )}

      {/* Contacts List */}
      <OBDPanel isDark={isDark} className="mt-4">
        {/* Follow-ups Counter Strip */}
        {(() => {
          if (isLoading) {
            return (
              <div className={`pb-4 border-b ${themeClasses.panelBorder} mb-4`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-sm font-semibold ${themeClasses.headingText}`}>Follow-ups:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-6 w-20 rounded-full" isDark={isDark} />
                    <Skeleton className="h-6 w-16 rounded-full" isDark={isDark} />
                    <Skeleton className="h-6 w-24 rounded-full" isDark={isDark} />
                  </div>
                </div>
              </div>
            );
          }

          // Compute counts from search-filtered contacts (before follow-up filter)
          const searchFiltered = contacts.filter((contact) => {
            if (search.trim()) {
              const searchLower = search.toLowerCase();
              return (
                contact.name.toLowerCase().includes(searchLower) ||
                (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
                (contact.phone && contact.phone.includes(search))
              );
            }
            return true;
          });

          const now = new Date();
          let overdueCount = 0;
          let todayCount = 0;
          let upcoming7dCount = 0;

          searchFiltered.forEach((contact) => {
            const classification = classifyFollowUp(contact.nextFollowUpAt || null, now);
            if (classification === "OVERDUE") overdueCount++;
            else if (classification === "TODAY") todayCount++;
            else if (classification === "UPCOMING_7D") upcoming7dCount++;
          });

          return (
            <div className={`pb-4 border-b ${themeClasses.panelBorder} mb-4`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-sm font-semibold ${themeClasses.headingText}`}>Follow-ups:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFollowUpFilter("overdue")}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                      followUpFilter === "overdue"
                        ? isDark
                          ? "bg-red-900/30 text-red-400 border-red-700/50"
                          : "bg-red-100 text-red-700 border-red-300"
                        : isDark
                        ? "bg-slate-800/50 text-slate-300 border-slate-700/30 hover:bg-slate-700/50"
                        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    Overdue <span className="ml-1.5 font-semibold">{overdueCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpFilter("dueToday")}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                      followUpFilter === "dueToday"
                        ? isDark
                          ? "bg-yellow-900/30 text-yellow-400 border-yellow-700/50"
                          : "bg-yellow-100 text-yellow-700 border-yellow-300"
                        : isDark
                        ? "bg-slate-800/50 text-slate-300 border-slate-700/30 hover:bg-slate-700/50"
                        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    Today <span className="ml-1.5 font-semibold">{todayCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpFilter("upcoming")}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                      followUpFilter === "upcoming"
                        ? isDark
                          ? "bg-blue-900/30 text-blue-400 border-blue-700/50"
                          : "bg-blue-100 text-blue-700 border-blue-300"
                        : isDark
                        ? "bg-slate-800/50 text-slate-300 border-slate-700/30 hover:bg-slate-700/50"
                        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    Upcoming <span className="ml-1.5 font-semibold">{upcoming7dCount}</span>
                  </button>
                  {followUpFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setFollowUpFilter("all")}
                      className={`text-xs ${themeClasses.mutedText} hover:underline`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${themeClasses.panelBorder}`}>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Name
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Phone
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Email
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Status
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Tags
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Last Note
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Next Follow-Up
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${themeClasses.labelText}`}>
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, idx) => (
                  <tr key={idx} className={`border-b ${themeClasses.panelBorder}`}>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-32 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-5 w-16 rounded-full" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-40 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-28 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-12 rounded-full" isDark={isDark} />
                        <Skeleton className="h-5 w-16 rounded-full" isDark={isDark} />
                      </div>
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-48 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-16 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-20 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <Skeleton className="h-4 w-24 rounded" isDark={isDark} />
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <div className="flex gap-1">
                        <Skeleton className="h-6 w-6 rounded" isDark={isDark} />
                        <Skeleton className="h-6 w-6 rounded" isDark={isDark} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`h-4 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"} animate-pulse`} style={{ width: "80px" }} />
                    </td>
                    <td className="py-3 px-4">
                      <div className={`h-4 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"} animate-pulse`} style={{ width: "80px" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : contacts.length === 0 ? (
          <div className={`text-center py-12 px-4 ${themeClasses.mutedText}`}>
            <div className={`inline-block p-6 rounded-lg ${isDark ? "bg-slate-800/50" : "bg-slate-50"} max-w-md`}>
              <h3 className={`text-xl font-semibold mb-2 ${themeClasses.headingText}`}>
                No contacts yet
              </h3>
              <p className={`text-sm mb-6 ${themeClasses.mutedText}`}>
                Add your first customer to start tracking follow-ups.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className={SUBMIT_BUTTON_CLASSES + " w-auto"}
                >
                  Add Contact
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(true);
                    setImportStep(1);
                    setCsvFile(null);
                    setCsvData(null);
                    setColumnMapping({ name: "", email: "", phone: "", status: "", tags: "" });
                    setImportPreview([]);
                    setImportResult(null);
                  }}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    isDark
                      ? "bg-green-700 text-white hover:bg-green-600"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  Import CSV
                </button>
              </div>
            </div>
          </div>
        ) : followUpView === "queue" ? (
          // Queue View
          ((): React.ReactNode => {
            // Apply search filter (same logic as table)
            const searchFiltered = contacts.filter((contact) => {
              if (search.trim()) {
                const searchLower = search.toLowerCase();
                return (
                  contact.name.toLowerCase().includes(searchLower) ||
                  (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
                  (contact.phone && contact.phone.includes(search))
                );
              }
              return true;
            });

            // Group contacts by follow-up status
            const now = new Date();
            const overdue: CrmContact[] = [];
            const today: CrmContact[] = [];
            const upcoming: CrmContact[] = [];

            searchFiltered.forEach((contact) => {
              const classification = classifyFollowUp(contact.nextFollowUpAt || null, now);
              if (classification === "OVERDUE") {
                overdue.push(contact);
              } else if (classification === "TODAY") {
                today.push(contact);
              } else if (classification === "UPCOMING_7D") {
                upcoming.push(contact);
              }
            });

            // Sort within each group
            const sortContacts = (contacts: CrmContact[]) => {
              return [...contacts].sort((a, b) => {
                if (!a.nextFollowUpAt && !b.nextFollowUpAt) return 0;
                if (!a.nextFollowUpAt) return 1;
                if (!b.nextFollowUpAt) return -1;
                return new Date(a.nextFollowUpAt).getTime() - new Date(b.nextFollowUpAt).getTime();
              });
            };

            const sortedOverdue = sortContacts(overdue);
            const sortedToday = sortContacts(today);
            const sortedUpcoming = sortContacts(upcoming);

            // Status pill styling helper
            const getStatusStyles = (status: string) => {
              const baseStyles = "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium";
              
              switch (status) {
                case "Active":
                  return `${baseStyles} ${
                    isDark
                      ? "bg-green-900/30 text-green-400 border border-green-700/30"
                      : "bg-green-100 text-green-700 border border-green-200"
                  }`;
                case "Lead":
                  return `${baseStyles} ${
                    isDark
                      ? "bg-blue-900/30 text-blue-400 border border-blue-700/30"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`;
                case "Past":
                  return `${baseStyles} ${
                    isDark
                      ? "bg-gray-800/50 text-gray-400 border border-gray-700/30"
                      : "bg-gray-100 text-gray-600 border border-gray-300"
                  }`;
                case "DoNotContact":
                  return `${baseStyles} ${
                    isDark
                      ? "bg-red-900/30 text-red-400 border border-red-700/30"
                      : "bg-red-100 text-red-700 border border-red-200"
                  }`;
                default:
                  return `${baseStyles} ${
                    isDark
                      ? "bg-slate-800/50 text-slate-400 border border-slate-700/30"
                      : "bg-slate-100 text-slate-600 border border-slate-300"
                  }`;
              }
            };

            // Format follow-up time for queue
            const formatFollowUpTime = (dateStr: string | null | undefined): string => {
              if (!dateStr) return "—";
              try {
                const date = new Date(dateStr);
                return date.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
              } catch {
                return "—";
              }
            };

            // Format follow-up date helper with urgency info
            const formatFollowUpDate = (dateStr: string | null | undefined): { text: string; isOverdue: boolean; isToday: boolean } => {
              if (!dateStr) return { text: "—", isOverdue: false, isToday: false };
              try {
                const date = new Date(dateStr);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const followUpDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const diffDays = Math.floor((followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) return { text: "Today", isOverdue: false, isToday: true };
                if (diffDays === 1) return { text: "Tomorrow", isOverdue: false, isToday: false };
                if (diffDays === -1) return { text: "Yesterday", isOverdue: true, isToday: false };
                if (diffDays < 0) return { text: `${Math.abs(diffDays)} days ago`, isOverdue: true, isToday: false };
                if (diffDays <= 7) return { text: `In ${diffDays} days`, isOverdue: false, isToday: false };
                return { text: date.toLocaleDateString(), isOverdue: false, isToday: false };
              } catch {
                return { text: "—", isOverdue: false, isToday: false };
              }
            };

            return (
              <div className="space-y-6">
                {/* Overdue Section */}
                {overdue.length > 0 && (
                  <div>
                    <div className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                      Overdue ({overdue.length})
                    </div>
                    <div className="space-y-2">
                      {overdue.map((contact) => {
                        const followUpInfo = formatFollowUpDate(contact.nextFollowUpAt);
                        return (
                          <div
                            key={contact.id}
                            onClick={() => handleContactClick(contact.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={`font-medium ${themeClasses.headingText}`}>{contact.name}</span>
                                  <span className={getStatusStyles(contact.status)}>{contact.status}</span>
                                  {contact.tags && contact.tags.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                      {contact.tags.slice(0, 2).map((tag) => (
                                        <span
                                          key={tag.id}
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                                            isDark
                                              ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          }`}
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                      {contact.tags.length > 2 && (
                                        <span
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                                            isDark
                                              ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          }`}
                                          title={contact.tags.slice(2).map((t) => t.name).join(", ")}
                                        >
                                          +{contact.tags.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={isDark ? "text-red-400 font-medium" : "text-red-600 font-medium"}>
                                    {followUpInfo.text}
                                  </span>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    isDark
                                      ? "bg-red-900/30 text-red-400 border border-red-700/30"
                                      : "bg-red-100 text-red-700 border border-red-200"
                                  }`}>
                                    Overdue
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {contact.email && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          await navigator.clipboard.writeText(contact.email || "");
                                          setCopiedItem({ contactId: contact.id, type: "email" });
                                          setTimeout(() => setCopiedItem(null), 1500);
                                        }
                                      } catch (error) {
                                        console.error("Failed to copy email:", error);
                                      }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                      isDark
                                        ? "hover:bg-slate-700 text-slate-300"
                                        : "hover:bg-slate-200 text-slate-600"
                                    }`}
                                    title="Copy email"
                                  >
                                    {copiedItem?.contactId === contact.id && copiedItem?.type === "email" ? (
                                      <span className={`text-xs ${
                                        isDark ? "text-green-400" : "text-green-600"
                                      }`}>
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs">📧</span>
                                    )}
                                  </button>
                                )}
                                {contact.phone && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          await navigator.clipboard.writeText(contact.phone || "");
                                          setCopiedItem({ contactId: contact.id, type: "phone" });
                                          setTimeout(() => setCopiedItem(null), 1500);
                                        }
                                      } catch (error) {
                                        console.error("Failed to copy phone:", error);
                                      }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                      isDark
                                        ? "hover:bg-slate-700 text-slate-300"
                                        : "hover:bg-slate-200 text-slate-600"
                                    }`}
                                    title="Copy phone"
                                  >
                                    {copiedItem?.contactId === contact.id && copiedItem?.type === "phone" ? (
                                      <span className={`text-xs ${
                                        isDark ? "text-green-400" : "text-green-600"
                                      }`}>
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs">📞</span>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleContactClick(contact.id)}
                                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                    isDark
                                      ? "hover:bg-slate-700 text-slate-300"
                                      : "hover:bg-slate-200 text-slate-600"
                                  }`}
                                  title="Open detail"
                                >
                                  <span className="text-xs">→</span>
                                </button>
                                {contact.nextFollowUpAt && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!contact.nextFollowUpAt) return;
                                        try {
                                          const currentDate = new Date(contact.nextFollowUpAt);
                                          const newDate = addDays(currentDate, 1);
                                          const payload = {
                                            nextFollowUpAt: newDate.toISOString(),
                                            nextFollowUpNote: contact.nextFollowUpNote || null,
                                          };
                                          const response = await fetch(`/api/obd-crm/contacts/${contact.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await response.json();
                                          if (data.ok && data.data) {
                                            setContacts((prev) =>
                                              prev.map((c) =>
                                                c.id === contact.id
                                                  ? { ...c, nextFollowUpAt: data.data.nextFollowUpAt || null, nextFollowUpNote: data.data.nextFollowUpNote || null }
                                                  : c
                                              )
                                            );
                                            if (contactDetail?.id === contact.id) {
                                              setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
                                            }
                                          }
                                        } catch (error) {
                                          console.error("Failed to snooze follow-up:", error);
                                        }
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-medium transition-colors ${
                                        isDark
                                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                      title="Snooze 1 day"
                                    >
                                      +1d
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!contact.nextFollowUpAt) return;
                                        try {
                                          const currentDate = new Date(contact.nextFollowUpAt);
                                          const newDate = addDays(currentDate, 7);
                                          const payload = {
                                            nextFollowUpAt: newDate.toISOString(),
                                            nextFollowUpNote: contact.nextFollowUpNote || null,
                                          };
                                          const response = await fetch(`/api/obd-crm/contacts/${contact.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await response.json();
                                          if (data.ok && data.data) {
                                            setContacts((prev) =>
                                              prev.map((c) =>
                                                c.id === contact.id
                                                  ? { ...c, nextFollowUpAt: data.data.nextFollowUpAt || null, nextFollowUpNote: data.data.nextFollowUpNote || null }
                                                  : c
                                              )
                                            );
                                            if (contactDetail?.id === contact.id) {
                                              setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
                                            }
                                          }
                                        } catch (error) {
                                          console.error("Failed to snooze follow-up:", error);
                                        }
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-medium transition-colors ${
                                        isDark
                                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                      title="Snooze 1 week"
                                    >
                                      +1w
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Today Section */}
                {today.length > 0 && (
                  <div>
                    <div className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                      Today ({today.length})
                    </div>
                    <div className="space-y-2">
                      {today.map((contact) => {
                        return (
                          <div
                            key={contact.id}
                            onClick={() => handleContactClick(contact.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={`font-medium ${themeClasses.headingText}`}>{contact.name}</span>
                                  <span className={getStatusStyles(contact.status)}>{contact.status}</span>
                                  {contact.tags && contact.tags.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                      {contact.tags.slice(0, 2).map((tag) => (
                                        <span
                                          key={tag.id}
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                                            isDark
                                              ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          }`}
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                      {contact.tags.length > 2 && (
                                        <span
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                                            isDark
                                              ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          }`}
                                          title={contact.tags.slice(2).map((t) => t.name).join(", ")}
                                        >
                                          +{contact.tags.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={isDark ? "text-yellow-400 font-medium" : "text-yellow-600 font-medium"}>
                                    {formatFollowUpTime(contact.nextFollowUpAt)}
                                  </span>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    isDark
                                      ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30"
                                      : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                  }`}>
                                    Today
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {contact.email && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          await navigator.clipboard.writeText(contact.email || "");
                                          setCopiedItem({ contactId: contact.id, type: "email" });
                                          setTimeout(() => setCopiedItem(null), 1500);
                                        }
                                      } catch (error) {
                                        console.error("Failed to copy email:", error);
                                      }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                      isDark
                                        ? "hover:bg-slate-700 text-slate-300"
                                        : "hover:bg-slate-200 text-slate-600"
                                    }`}
                                    title="Copy email"
                                  >
                                    {copiedItem?.contactId === contact.id && copiedItem?.type === "email" ? (
                                      <span className={`text-xs ${
                                        isDark ? "text-green-400" : "text-green-600"
                                      }`}>
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs">📧</span>
                                    )}
                                  </button>
                                )}
                                {contact.phone && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          await navigator.clipboard.writeText(contact.phone || "");
                                          setCopiedItem({ contactId: contact.id, type: "phone" });
                                          setTimeout(() => setCopiedItem(null), 1500);
                                        }
                                      } catch (error) {
                                        console.error("Failed to copy phone:", error);
                                      }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                      isDark
                                        ? "hover:bg-slate-700 text-slate-300"
                                        : "hover:bg-slate-200 text-slate-600"
                                    }`}
                                    title="Copy phone"
                                  >
                                    {copiedItem?.contactId === contact.id && copiedItem?.type === "phone" ? (
                                      <span className={`text-xs ${
                                        isDark ? "text-green-400" : "text-green-600"
                                      }`}>
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs">📞</span>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleContactClick(contact.id)}
                                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                    isDark
                                      ? "hover:bg-slate-700 text-slate-300"
                                      : "hover:bg-slate-200 text-slate-600"
                                  }`}
                                  title="Open detail"
                                >
                                  <span className="text-xs">→</span>
                                </button>
                                {contact.nextFollowUpAt && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!contact.nextFollowUpAt) return;
                                        try {
                                          const currentDate = new Date(contact.nextFollowUpAt);
                                          const newDate = addDays(currentDate, 1);
                                          const payload = {
                                            nextFollowUpAt: newDate.toISOString(),
                                            nextFollowUpNote: contact.nextFollowUpNote || null,
                                          };
                                          const response = await fetch(`/api/obd-crm/contacts/${contact.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await response.json();
                                          if (data.ok && data.data) {
                                            setContacts((prev) =>
                                              prev.map((c) =>
                                                c.id === contact.id
                                                  ? { ...c, nextFollowUpAt: data.data.nextFollowUpAt || null, nextFollowUpNote: data.data.nextFollowUpNote || null }
                                                  : c
                                              )
                                            );
                                            if (contactDetail?.id === contact.id) {
                                              setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
                                            }
                                          }
                                        } catch (error) {
                                          console.error("Failed to snooze follow-up:", error);
                                        }
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-medium transition-colors ${
                                        isDark
                                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                      title="Snooze 1 day"
                                    >
                                      +1d
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!contact.nextFollowUpAt) return;
                                        try {
                                          const currentDate = new Date(contact.nextFollowUpAt);
                                          const newDate = addDays(currentDate, 7);
                                          const payload = {
                                            nextFollowUpAt: newDate.toISOString(),
                                            nextFollowUpNote: contact.nextFollowUpNote || null,
                                          };
                                          const response = await fetch(`/api/obd-crm/contacts/${contact.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await response.json();
                                          if (data.ok && data.data) {
                                            setContacts((prev) =>
                                              prev.map((c) =>
                                                c.id === contact.id
                                                  ? { ...c, nextFollowUpAt: data.data.nextFollowUpAt || null, nextFollowUpNote: data.data.nextFollowUpNote || null }
                                                  : c
                                              )
                                            );
                                            if (contactDetail?.id === contact.id) {
                                              setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
                                            }
                                          }
                                        } catch (error) {
                                          console.error("Failed to snooze follow-up:", error);
                                        }
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-medium transition-colors ${
                                        isDark
                                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                      title="Snooze 1 week"
                                    >
                                      +1w
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upcoming Section */}
                {upcoming.length > 0 && (
                  <div>
                    <div className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                      Upcoming ({upcoming.length})
                    </div>
                    <div className="space-y-2">
                      {upcoming.map((contact) => {
                        return (
                          <div
                            key={contact.id}
                            onClick={() => handleContactClick(contact.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isDark
                                ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={`font-medium ${themeClasses.headingText}`}>{contact.name}</span>
                                  <span className={getStatusStyles(contact.status)}>{contact.status}</span>
                                  {contact.tags && contact.tags.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                      {contact.tags.slice(0, 2).map((tag) => (
                                        <span
                                          key={tag.id}
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                                            isDark
                                              ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          }`}
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                      {contact.tags.length > 2 && (
                                        <span
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                                            isDark
                                              ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          }`}
                                          title={contact.tags.slice(2).map((t) => t.name).join(", ")}
                                        >
                                          +{contact.tags.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={themeClasses.mutedText}>
                                    {formatFollowUpTime(contact.nextFollowUpAt)}
                                  </span>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    isDark
                                      ? "bg-blue-900/30 text-blue-400 border border-blue-700/30"
                                      : "bg-blue-100 text-blue-700 border border-blue-200"
                                  }`}>
                                    Upcoming
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {contact.email && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          await navigator.clipboard.writeText(contact.email || "");
                                          setCopiedItem({ contactId: contact.id, type: "email" });
                                          setTimeout(() => setCopiedItem(null), 1500);
                                        }
                                      } catch (error) {
                                        console.error("Failed to copy email:", error);
                                      }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                      isDark
                                        ? "hover:bg-slate-700 text-slate-300"
                                        : "hover:bg-slate-200 text-slate-600"
                                    }`}
                                    title="Copy email"
                                  >
                                    {copiedItem?.contactId === contact.id && copiedItem?.type === "email" ? (
                                      <span className={`text-xs ${
                                        isDark ? "text-green-400" : "text-green-600"
                                      }`}>
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs">📧</span>
                                    )}
                                  </button>
                                )}
                                {contact.phone && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          await navigator.clipboard.writeText(contact.phone || "");
                                          setCopiedItem({ contactId: contact.id, type: "phone" });
                                          setTimeout(() => setCopiedItem(null), 1500);
                                        }
                                      } catch (error) {
                                        console.error("Failed to copy phone:", error);
                                      }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                      isDark
                                        ? "hover:bg-slate-700 text-slate-300"
                                        : "hover:bg-slate-200 text-slate-600"
                                    }`}
                                    title="Copy phone"
                                  >
                                    {copiedItem?.contactId === contact.id && copiedItem?.type === "phone" ? (
                                      <span className={`text-xs ${
                                        isDark ? "text-green-400" : "text-green-600"
                                      }`}>
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs">📞</span>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleContactClick(contact.id)}
                                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                    isDark
                                      ? "hover:bg-slate-700 text-slate-300"
                                      : "hover:bg-slate-200 text-slate-600"
                                  }`}
                                  title="Open detail"
                                >
                                  <span className="text-xs">→</span>
                                </button>
                                {contact.nextFollowUpAt && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!contact.nextFollowUpAt) return;
                                        try {
                                          const currentDate = new Date(contact.nextFollowUpAt);
                                          const newDate = addDays(currentDate, 1);
                                          const payload = {
                                            nextFollowUpAt: newDate.toISOString(),
                                            nextFollowUpNote: contact.nextFollowUpNote || null,
                                          };
                                          const response = await fetch(`/api/obd-crm/contacts/${contact.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await response.json();
                                          if (data.ok && data.data) {
                                            setContacts((prev) =>
                                              prev.map((c) =>
                                                c.id === contact.id
                                                  ? { ...c, nextFollowUpAt: data.data.nextFollowUpAt || null, nextFollowUpNote: data.data.nextFollowUpNote || null }
                                                  : c
                                              )
                                            );
                                            if (contactDetail?.id === contact.id) {
                                              setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
                                            }
                                          }
                                        } catch (error) {
                                          console.error("Failed to snooze follow-up:", error);
                                        }
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-medium transition-colors ${
                                        isDark
                                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                      title="Snooze 1 day"
                                    >
                                      +1d
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!contact.nextFollowUpAt) return;
                                        try {
                                          const currentDate = new Date(contact.nextFollowUpAt);
                                          const newDate = addDays(currentDate, 7);
                                          const payload = {
                                            nextFollowUpAt: newDate.toISOString(),
                                            nextFollowUpNote: contact.nextFollowUpNote || null,
                                          };
                                          const response = await fetch(`/api/obd-crm/contacts/${contact.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await response.json();
                                          if (data.ok && data.data) {
                                            setContacts((prev) =>
                                              prev.map((c) =>
                                                c.id === contact.id
                                                  ? { ...c, nextFollowUpAt: data.data.nextFollowUpAt || null, nextFollowUpNote: data.data.nextFollowUpNote || null }
                                                  : c
                                              )
                                            );
                                            if (contactDetail?.id === contact.id) {
                                              setContactDetail((prev) => prev ? { ...prev, ...data.data } : null);
                                            }
                                          }
                                        } catch (error) {
                                          console.error("Failed to snooze follow-up:", error);
                                        }
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-medium transition-colors ${
                                        isDark
                                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                      title="Snooze 1 week"
                                    >
                                      +1w
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && (
                  <div className={`text-center py-12 px-4 ${themeClasses.mutedText}`}>
                    <div className={`inline-block p-6 rounded-lg ${isDark ? "bg-slate-800/50" : "bg-slate-50"} max-w-md`}>
                      <h3 className={`text-xl font-semibold mb-2 ${themeClasses.headingText}`}>
                        No follow-ups
                      </h3>
                      <p className={`text-sm ${themeClasses.mutedText}`}>
                        No contacts have follow-ups scheduled in the next 7 days.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="overflow-x-auto overflow-y-auto relative" style={{ maxHeight: "calc(100vh - 400px)" }}>
            <table className="w-full">
              <thead className={`sticky top-0 z-10 ${isDark ? "bg-slate-900" : "bg-white"}`}>
                <tr className={`border-b ${themeClasses.panelBorder}`}>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Name
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Phone
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Email
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Status
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Tags
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Last Note
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Last Touch
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Next Follow-Up
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Updated
                  </th>
                  <th className={`text-left font-semibold ${themeClasses.labelText} ${
                    tableDensity === "compact" ? "py-2 px-3 text-xs" : "py-3 px-4 text-sm"
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Format follow-up date helper with urgency info
                  const formatFollowUpDate = (dateStr: string | null | undefined): { text: string; isOverdue: boolean; isToday: boolean } => {
                    if (!dateStr) return { text: "—", isOverdue: false, isToday: false };
                    try {
                      const date = new Date(dateStr);
                      const now = new Date();
                      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      const followUpDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                      const diffDays = Math.floor((followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      
                      if (diffDays === 0) return { text: "Today", isOverdue: false, isToday: true };
                      if (diffDays === 1) return { text: "Tomorrow", isOverdue: false, isToday: false };
                      if (diffDays === -1) return { text: "Yesterday", isOverdue: true, isToday: false };
                      if (diffDays < 0) return { text: `${Math.abs(diffDays)} days ago`, isOverdue: true, isToday: false };
                      if (diffDays <= 7) return { text: `In ${diffDays} days`, isOverdue: false, isToday: false };
                      return { text: date.toLocaleDateString(), isOverdue: false, isToday: false };
                    } catch {
                      return { text: "—", isOverdue: false, isToday: false };
                    }
                  };
                  
                  // Get follow-up status badge helper
                  const getFollowUpBadge = (dateStr: string | null | undefined) => {
                    const status = getFollowUpStatus(dateStr);
                    if (status === "NONE" || status === "UPCOMING") return null;
                    
                    const baseStyles = `inline-flex items-center rounded-full font-medium ml-2 ${
                      tableDensity === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
                    }`;
                    
                    if (status === "OVERDUE") {
                      return (
                        <span className={`${baseStyles} ${
                          isDark
                            ? "bg-red-900/30 text-red-400 border border-red-700/30"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }`}>
                          Overdue
                        </span>
                      );
                    }
                    
                    if (status === "TODAY") {
                      return (
                        <span className={`${baseStyles} ${
                          isDark
                            ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30"
                            : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                        }`}>
                          Today
                        </span>
                      );
                    }
                    
                    return null;
                  };
                  
                  // Format relative time helper (for Last Touch)
                  const formatRelativeTime = (dateStr: string | null | undefined) => {
                    if (!dateStr) return "No touch yet";
                    try {
                      const date = new Date(dateStr);
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffSeconds = Math.floor(diffMs / 1000);
                      const diffMinutes = Math.floor(diffSeconds / 60);
                      const diffHours = Math.floor(diffMinutes / 60);
                      const diffDays = Math.floor(diffHours / 24);
                      
                      if (diffSeconds < 60) return "Just now";
                      if (diffMinutes < 60) return `${diffMinutes}m ago`;
                      if (diffHours < 24) return `${diffHours}h ago`;
                      if (diffDays === 1) return "1d ago";
                      if (diffDays < 7) return `${diffDays}d ago`;
                      if (diffDays < 30) {
                        const weeks = Math.floor(diffDays / 7);
                        return `${weeks}w ago`;
                      }
                      if (diffDays < 365) {
                        const months = Math.floor(diffDays / 30);
                        return `${months}mo ago`;
                      }
                      const years = Math.floor(diffDays / 365);
                      return `${years}y ago`;
                    } catch {
                      return "—";
                    }
                  };
                  
                  // Filter contacts by search, status, tag, and follow-up
                  const filteredContacts = contacts.filter((contact) => {
                    // Search filter
                    if (search.trim()) {
                      const searchLower = search.toLowerCase();
                      const matchesSearch = 
                        contact.name.toLowerCase().includes(searchLower) ||
                        (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
                        (contact.phone && contact.phone.includes(search));
                      if (!matchesSearch) return false;
                    }
                    
                    // Status filter
                    if (statusFilter && contact.status !== statusFilter) return false;
                    
                    // Tag filter
                    if (tagFilter && !contact.tags.some(tag => tag.id === tagFilter)) return false;
                    
                    // Follow-up filter
                    if (followUpFilter !== "all") {
                      if (!contact.nextFollowUpAt) return false;
                      
                      const followUpDate = new Date(contact.nextFollowUpAt);
                      const now = new Date();
                      
                      if (followUpFilter === "dueToday") {
                        // Same local date
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const followUpDay = new Date(followUpDate.getFullYear(), followUpDate.getMonth(), followUpDate.getDate());
                        return followUpDay.getTime() === today.getTime();
                      }
                      
                      if (followUpFilter === "overdue") {
                        // Follow-up date is in the past
                        return followUpDate.getTime() < now.getTime();
                      }
                      
                      if (followUpFilter === "upcoming") {
                        // Follow-up date is in the future and within 7 days
                        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        return followUpDate.getTime() >= now.getTime() && followUpDate.getTime() <= sevenDaysFromNow.getTime();
                      }
                    }
                    
                    return true;
                  });

                  // No results state
                  if (filteredContacts.length === 0) {
                    return (
                      <tr>
                        <td colSpan={10} className={tableDensity === "compact" ? "py-8 px-3" : "py-12 px-4"}>
                          <div className={`text-center ${themeClasses.mutedText}`}>
                            <p className={`${tableDensity === "compact" ? "text-base" : "text-lg"} mb-2 ${themeClasses.headingText}`}>
                              No contacts match your filters.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setSearch("");
                                setStatusFilter("");
                                setTagFilter("");
                                setFollowUpFilter("all");
                              }}
                              className={`mt-3 px-4 py-2 rounded-full ${tableDensity === "compact" ? "text-xs" : "text-sm"} font-medium transition-colors ${
                                isDark
                                  ? "bg-blue-700 text-white hover:bg-blue-600"
                                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              }`}
                            >
                              Clear filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => handleContactClick(contact.id)}
                    className={`border-b ${themeClasses.panelBorder} cursor-pointer hover:${
                      isDark ? "bg-slate-800/50" : "bg-slate-50"
                    } transition-colors`}
                  >
                    <td className={`${themeClasses.headingText} ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {contact.name}
                    </td>
                    <td className={`${themeClasses.mutedText} ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {contact.phone || "—"}
                    </td>
                    <td className={`${themeClasses.mutedText} ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {contact.email || "—"}
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      {(() => {
                        // Status pill styling helper
                        const getStatusStyles = (status: string) => {
                          const baseStyles = `inline-flex items-center rounded-full font-medium ${
                            tableDensity === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
                          }`;
                          
                          switch (status) {
                            case "Active":
                              return `${baseStyles} ${
                                isDark
                                  ? "bg-green-900/30 text-green-400 border border-green-700/30"
                                  : "bg-green-100 text-green-700 border border-green-200"
                              }`;
                            case "Lead":
                              return `${baseStyles} ${
                                isDark
                                  ? "bg-blue-900/30 text-blue-400 border border-blue-700/30"
                                  : "bg-blue-100 text-blue-700 border border-blue-200"
                              }`;
                            case "Past":
                              return `${baseStyles} ${
                                isDark
                                  ? "bg-gray-800/50 text-gray-400 border border-gray-700/30"
                                  : "bg-gray-100 text-gray-600 border border-gray-300"
                              }`;
                            case "DoNotContact":
                              return `${baseStyles} ${
                                isDark
                                  ? "bg-red-900/30 text-red-400 border border-red-700/30"
                                  : "bg-red-100 text-red-700 border border-red-200"
                              }`;
                            default:
                              // Neutral for unknown statuses
                              return `${baseStyles} ${
                                isDark
                                  ? "bg-slate-800/50 text-slate-400 border border-slate-700/30"
                                  : "bg-slate-100 text-slate-600 border border-slate-300"
                              }`;
                          }
                        };
                        
                        return (
                          <span className={getStatusStyles(contact.status)}>
                            {contact.status}
                          </span>
                        );
                      })()}
                    </td>
                    <td className={`${themeClasses.mutedText} ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {contact.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center min-w-0">
                          {contact.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className={`inline-flex items-center rounded truncate max-w-[120px] ${
                                tableDensity === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
                              } ${
                                isDark
                                  ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                  : "bg-slate-100 text-slate-700 border border-slate-300"
                              }`}
                              title={tag.name}
                            >
                              <span className="truncate">{tag.name}</span>
                            </span>
                          ))}
                          {contact.tags.length > 3 && (
                            <span
                              className={`inline-flex items-center rounded ${
                                tableDensity === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
                              } ${
                                isDark
                                  ? "bg-slate-700/80 text-slate-300 border border-slate-600/50"
                                  : "bg-slate-100 text-slate-700 border border-slate-300"
                              } ${themeClasses.mutedText}`}
                              title={contact.tags.slice(3).map(t => t.name).join(", ")}
                            >
                              +{contact.tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${themeClasses.mutedText} max-w-xs ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      <div className="truncate">
                        {contact.lastNote || "—"}
                      </div>
                    </td>
                    <td className={`${themeClasses.mutedText} ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {formatRelativeTime(contact.lastTouchAt)}
                    </td>
                    <td className={`${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {(() => {
                        const followUpInfo = formatFollowUpDate(contact.nextFollowUpAt);
                        const badge = getFollowUpBadge(contact.nextFollowUpAt);
                        return (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={
                              followUpInfo.isOverdue
                                ? isDark ? "text-red-400 font-medium" : "text-red-600 font-medium"
                                : followUpInfo.isToday
                                ? isDark ? "text-yellow-400 font-medium" : "text-yellow-600 font-medium"
                                : themeClasses.mutedText
                            }>
                              {followUpInfo.text}
                            </span>
                            {badge}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={`${themeClasses.mutedText} ${
                      tableDensity === "compact" ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-sm"
                    }`}>
                      {formatDate(contact.updatedAt)}
                    </td>
                    <td className={tableDensity === "compact" ? "py-1.5 px-3" : "py-3 px-4"}>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {contact.email && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                  await navigator.clipboard.writeText(contact.email || "");
                                  setCopiedItem({ contactId: contact.id, type: "email" });
                                  setTimeout(() => setCopiedItem(null), 1500);
                                }
                              } catch (error) {
                                console.error("Failed to copy email:", error);
                              }
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                              isDark
                                ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                            }`}
                            title="Copy email"
                            aria-label="Copy email"
                          >
                            {copiedItem?.contactId === contact.id && copiedItem?.type === "email" ? (
                              <span className={`text-xs font-medium ${
                                isDark ? "text-green-400" : "text-green-600"
                              }`}>
                                ✓
                              </span>
                            ) : (
                              <span className="text-xs">📧</span>
                            )}
                          </button>
                        )}
                        {contact.phone && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                  await navigator.clipboard.writeText(contact.phone || "");
                                  setCopiedItem({ contactId: contact.id, type: "phone" });
                                  setTimeout(() => setCopiedItem(null), 1500);
                                }
                              } catch (error) {
                                console.error("Failed to copy phone:", error);
                              }
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                              isDark
                                ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                            }`}
                            title="Copy phone"
                            aria-label="Copy phone"
                          >
                            {copiedItem?.contactId === contact.id && copiedItem?.type === "phone" ? (
                              <span className={`text-xs font-medium ${
                                isDark ? "text-green-400" : "text-green-600"
                              }`}>
                                ✓
                              </span>
                            ) : (
                              <span className="text-xs">📞</span>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContactClick(contact.id);
                          }}
                          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                            isDark
                              ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                              : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                          }`}
                          title="Open contact detail"
                          aria-label="Open contact detail"
                        >
                          <span className="text-xs">→</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </OBDPanel>

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <OBDPanel isDark={isDark} className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Add Contact
              </OBDHeading>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              >
                ×
              </button>
            </div>

            {createError && (
              <div className={getErrorPanelClasses(isDark) + " mb-4"}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateContact}>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, name: e.target.value })
                    }
                    className={getInputClasses(isDark)}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) =>
                      setNewContact({ ...newContact, email: e.target.value })
                    }
                    className={getInputClasses(isDark)}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) =>
                      setNewContact({ ...newContact, phone: e.target.value })
                    }
                    className={getInputClasses(isDark)}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Company
                  </label>
                  <input
                    type="text"
                    value={newContact.company}
                    onChange={(e) =>
                      setNewContact({ ...newContact, company: e.target.value })
                    }
                    className={getInputClasses(isDark)}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={newContact.address}
                    onChange={(e) =>
                      setNewContact({ ...newContact, address: e.target.value })
                    }
                    className={getInputClasses(isDark)}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Status
                  </label>
                  <select
                    value={newContact.status}
                    onChange={(e) =>
                      setNewContact({
                        ...newContact,
                        status: e.target.value as CrmContactStatus,
                      })
                    }
                    className={getInputClasses(isDark)}
                  >
                    <option value="Lead">Lead</option>
                    <option value="Active">Active</option>
                    <option value="Past">Past</option>
                    <option value="DoNotContact">Do Not Contact</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={isCreating}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {isCreating ? "Creating..." : "Create Contact"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`px-6 py-3 rounded-full font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </OBDPanel>
        </div>
      )}

      {/* Contact Detail Drawer */}
      {selectedContactId && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop with smooth animation - click to close on desktop only */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out md:cursor-pointer"
            onClick={(e) => {
              // Only close on desktop (md and up) when clicking backdrop
              if (window.innerWidth >= 768) {
                closeDetailDrawer();
              }
            }}
          />
          
          {/* Drawer with smooth slide-in animation */}
          <div
            className={`fixed right-0 top-0 h-full w-full md:w-[600px] ${
              isDark ? "bg-slate-900" : "bg-white"
            } shadow-xl flex flex-col z-50 transition-transform duration-300 ease-out`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with subtle teal gradient accent */}
            <div className={`relative flex items-center justify-between p-6 border-b ${themeClasses.panelBorder}`}>
              {/* Subtle gradient accent strip */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 opacity-30"
                style={{
                  background: isDark
                    ? "linear-gradient(90deg, rgba(20, 184, 166, 0.4) 0%, rgba(13, 148, 136, 0.3) 50%, rgba(20, 184, 166, 0.4) 100%)"
                    : "linear-gradient(90deg, rgba(20, 184, 166, 0.2) 0%, rgba(13, 148, 136, 0.15) 50%, rgba(20, 184, 166, 0.2) 100%)"
                }}
              />
              <OBDHeading level={2} isDark={isDark} className="relative z-10">
                {isLoadingDetail ? "Loading..." : contactDetail?.name || "Contact Details"}
              </OBDHeading>
              <button
                type="button"
                onClick={closeDetailDrawer}
                className={`relative z-10 w-8 h-8 flex items-center justify-center rounded transition-colors ${
                  isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="Close drawer"
                title="Close drawer"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            {/* Content with scroll position tracking */}
            <div 
              ref={drawerContentRef}
              className="flex-1 overflow-y-auto p-6"
            >
              {isLoadingDetail ? (
                <div className="space-y-4">
                  <div className={`h-8 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"} animate-pulse`} />
                  <div className={`h-4 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"} animate-pulse`} />
                  <div className={`h-4 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"} animate-pulse`} />
                </div>
              ) : detailError ? (
                <div className={getErrorPanelClasses(isDark)}>
                  {detailError}
                </div>
              ) : contactDetail ? (
                <div className="space-y-6">
                  {/* Status Badge */}
                  <div className="flex items-center gap-3">
                    {(() => {
                      // Status pill styling helper (same as table)
                      const getStatusStyles = (status: string) => {
                        const baseStyles = "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium";
                        
                        switch (status) {
                          case "Active":
                            return `${baseStyles} ${
                              isDark
                                ? "bg-green-900/30 text-green-400 border border-green-700/30"
                                : "bg-green-100 text-green-700 border border-green-200"
                            }`;
                          case "Lead":
                            return `${baseStyles} ${
                              isDark
                                ? "bg-blue-900/30 text-blue-400 border border-blue-700/30"
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }`;
                          case "Past":
                            return `${baseStyles} ${
                              isDark
                                ? "bg-gray-800/50 text-gray-400 border border-gray-700/30"
                                : "bg-gray-100 text-gray-600 border border-gray-300"
                            }`;
                          case "DoNotContact":
                            return `${baseStyles} ${
                              isDark
                                ? "bg-red-900/30 text-red-400 border border-red-700/30"
                                : "bg-red-100 text-red-700 border border-red-200"
                            }`;
                          default:
                            // Neutral for unknown statuses
                            return `${baseStyles} ${
                              isDark
                                ? "bg-slate-800/50 text-slate-400 border border-slate-700/30"
                                : "bg-slate-100 text-slate-600 border border-slate-300"
                            }`;
                        }
                      };
                      
                      return (
                        <span className={getStatusStyles(contactDetail.status)}>
                          {contactDetail.status}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setIsEditing(!isEditing)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          isDark
                            ? "bg-slate-700 text-white hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {isEditing ? "Cancel Edit" : "Edit Contact"}
                      </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => setShowReviewRequestModal(true)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            isDark
                              ? "bg-blue-700 text-white hover:bg-blue-600"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          }`}
                        >
                          Send Review Request
                        </button>
                        <p className={`text-xs ${themeClasses.mutedText} text-center`}>
                          Request a review via email or SMS
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            // Generate default prompt
                            const lastNote = contactDetail?.activities?.[0]?.content;
                            const defaultPrompt = lastNote
                              ? `Write a friendly follow-up message to ${contactDetail.name} about: ${lastNote.substring(0, 100)}${lastNote.length > 100 ? "..." : ""}`
                              : `Write a friendly follow-up message to ${contactDetail.name}.`;
                            setHelpDeskPrompt(defaultPrompt);
                            setShowHelpDeskModal(true);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            isDark
                              ? "bg-purple-700 text-white hover:bg-purple-600"
                              : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                          }`}
                        >
                          Ask AI Help Desk
                        </button>
                        <p className={`text-xs ${themeClasses.mutedText} text-center`}>
                          Get AI-powered message suggestions
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            // Set defaults based on contact
                            setSocialPostUseLastNote(!!contactDetail?.activities?.[0]?.content);
                            setSocialPostUseLastActivity(false);
                            setShowSocialPostModal(true);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            isDark
                              ? "bg-teal-700 text-white hover:bg-teal-600"
                              : "bg-teal-100 text-teal-700 hover:bg-teal-200"
                          }`}
                        >
                          Draft Social Post
                        </button>
                        <p className={`text-xs ${themeClasses.mutedText} text-center`}>
                          Create a social media post
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            // Set defaults based on contact
                            setOfferUseLastNote(!!contactDetail?.activities?.[0]?.content);
                            setOfferHint("");
                            setShowOffersModal(true);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            isDark
                              ? "bg-orange-700 text-white hover:bg-orange-600"
                              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                          }`}
                        >
                          Create Offer
                        </button>
                        <p className={`text-xs ${themeClasses.mutedText} text-center`}>
                          Generate a promotional offer
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Fields */}
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Email
                        </label>
                        <input
                          type="email"
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Company
                        </label>
                        <input
                          type="text"
                          value={editForm.company || ""}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className={getInputClasses(isDark)}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Status
                        </label>
                        <select
                          value={editForm.status || "Lead"}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as CrmContactStatus })}
                          className={getInputClasses(isDark)}
                        >
                          <option value="Lead">Lead</option>
                          <option value="Active">Active</option>
                          <option value="Past">Past</option>
                          <option value="DoNotContact">Do Not Contact</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className={SUBMIT_BUTTON_CLASSES + " flex-1"}
                        >
                          {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Contact Info */}
                      <div className="space-y-3">
                        {contactDetail.email && (
                          <>
                            <div className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Email</div>
                            <div className={`flex items-center gap-2 ${themeClasses.headingText}`}>
                              <a
                                href={`mailto:${contactDetail.email}`}
                                className="hover:underline"
                              >
                                {contactDetail.email}
                              </a>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(contactDetail.email || "")}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                  isDark
                                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                }`}
                                title="Copy email"
                                aria-label="Copy email"
                              >
                                <span className="text-xs">📋</span>
                              </button>
                            </div>
                          </>
                        )}
                        {contactDetail.phone && (
                          <>
                            <div className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Phone</div>
                            <div className={`flex items-center gap-2 ${themeClasses.headingText}`}>
                              <a
                                href={`tel:${contactDetail.phone}`}
                                className="hover:underline"
                              >
                                {contactDetail.phone}
                              </a>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(contactDetail.phone || "")}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                  isDark
                                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                }`}
                                title="Copy phone"
                                aria-label="Copy phone"
                              >
                                <span className="text-xs">📋</span>
                              </button>
                            </div>
                          </>
                        )}
                        {contactDetail.company && (
                          <>
                            <div className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Company</div>
                            <div className={themeClasses.headingText}>{contactDetail.company}</div>
                          </>
                        )}
                        {contactDetail.address && (
                          <>
                            <div className={`text-xs font-medium mb-1 ${themeClasses.mutedText}`}>Address</div>
                            <div className={themeClasses.headingText}>{contactDetail.address}</div>
                          </>
                        )}
                      </div>

                      {/* Tags */}
                      {contactDetail.tags && contactDetail.tags.length > 0 && (
                        <>
                          <div className={`text-xs font-medium mb-2 ${themeClasses.mutedText}`}>Tags</div>
                          <div className="flex flex-wrap gap-2">
                            {contactDetail.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className={`inline-flex items-center rounded px-2 py-1 text-xs ${
                                  isDark
                                    ? "bg-slate-700 text-slate-300"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Metadata */}
                      <div className={`pt-4 border-t ${themeClasses.panelBorder}`}>
                        <div className={`text-xs space-y-1 ${themeClasses.mutedText}`}>
                        </div>
                      </div>

                      {/* Notes Section */}
                      <div className={`pt-6 border-t ${themeClasses.panelBorder}`}>
                        <div className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                          Notes {notes.length > 0 && `(${notes.length})`}
                        </div>

                        {isLoadingNotes ? (
                          <div className="space-y-3">
                            <Skeleton className="h-20 w-full rounded-lg" isDark={isDark} />
                            <Skeleton className="h-10 w-24 rounded-full" isDark={isDark} />
                            <div className="space-y-2">
                              <Skeleton className="h-16 w-full rounded-lg" isDark={isDark} />
                              <Skeleton className="h-16 w-full rounded-lg" isDark={isDark} />
                            </div>
                          </div>
                        ) : (
                          <>
                        {/* Add Note Form */}
                        <div className="mb-4 space-y-2">
                          <textarea
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            placeholder="Add a note about this contact..."
                            className={getInputClasses(isDark)}
                            rows={3}
                            disabled={isAddingNote}
                          />
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={handleAddNote}
                              disabled={isAddingNote || !newNoteText.trim()}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                isAddingNote || !newNoteText.trim()
                                  ? isDark
                                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                  : isDark
                                  ? "bg-blue-700 text-white hover:bg-blue-600"
                                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              }`}
                            >
                              {isAddingNote ? "Adding..." : "Add Note"}
                            </button>
                            {notesError && (
                              <div className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                                {notesError}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes List */}
                        {notes.length === 0 ? (
                          <div className={`text-center py-6 ${themeClasses.mutedText}`}>
                            <p className="text-sm">No notes yet. Add a note to remember key details.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {notes.map((note) => (
                              <div
                                key={note.id}
                                className={`p-3 rounded-lg ${
                                  isDark ? "bg-slate-800/50" : "bg-slate-50"
                                }`}
                              >
                                <div className={`text-sm ${themeClasses.headingText} whitespace-pre-wrap`}>
                                  {note.content}
                                </div>
                                <div className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                                  {new Date(note.createdAt).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                          </>
                        )}
                      </div>

                      {/* Activities Section */}
                      <div className={`pt-6 border-t ${themeClasses.panelBorder}`}>
                        <div className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                          Activity Timeline {activities.length > 0 && `(${activities.length})`}
                        </div>

                        {isLoadingActivities ? (
                          <div className="space-y-3">
                            <Skeleton className="h-10 w-full rounded" isDark={isDark} />
                            <Skeleton className="h-10 w-full rounded" isDark={isDark} />
                            <Skeleton className="h-10 w-32 rounded-full" isDark={isDark} />
                            <div className="space-y-2">
                              <Skeleton className="h-16 w-full rounded-lg" isDark={isDark} />
                              <Skeleton className="h-16 w-full rounded-lg" isDark={isDark} />
                            </div>
                          </div>
                        ) : (
                          <>
                        {/* Add Activity Form */}
                        <div className="mb-4 space-y-3">
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Activity Type
                            </label>
                            <select
                              value={newActivityType}
                              onChange={(e) => setNewActivityType(e.target.value as typeof newActivityType)}
                              className={getInputClasses(isDark)}
                              disabled={isAddingActivity}
                            >
                              <option value="CALL">Call</option>
                              <option value="EMAIL">Email</option>
                              <option value="TEXT">Text</option>
                              <option value="MEETING">Meeting</option>
                              <option value="TASK">Task</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Summary
                            </label>
                            <input
                              type="text"
                              value={newActivitySummary}
                              onChange={(e) => setNewActivitySummary(e.target.value)}
                              placeholder="Brief description of the activity..."
                              className={getInputClasses(isDark)}
                              disabled={isAddingActivity}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Date & Time <span className="text-xs font-normal opacity-75">(optional)</span>
                            </label>
                            <input
                              type="datetime-local"
                              value={newActivityOccurredAt}
                              onChange={(e) => setNewActivityOccurredAt(e.target.value)}
                              className={getInputClasses(isDark)}
                              disabled={isAddingActivity}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={handleAddActivity}
                              disabled={isAddingActivity || !newActivitySummary.trim()}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                isAddingActivity || !newActivitySummary.trim()
                                  ? isDark
                                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                  : isDark
                                  ? "bg-green-700 text-white hover:bg-green-600"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {isAddingActivity ? "Logging..." : "Log Activity"}
                            </button>
                            {activitiesError && (
                              <div className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                                {activitiesError}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Activities Timeline */}
                        {activities.length === 0 ? (
                          <div className={`text-center py-6 ${themeClasses.mutedText}`}>
                            <p className="text-sm">No activity yet. Log calls, emails, and tasks.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activities.map((activity) => {
                              const activityDate = activity.occurredAt 
                                ? new Date(activity.occurredAt)
                                : new Date(activity.createdAt);
                              
                              const typeLabels: Record<string, string> = {
                                CALL: "Call",
                                EMAIL: "Email",
                                TEXT: "Text",
                                MEETING: "Meeting",
                                TASK: "Task",
                                OTHER: "Other",
                              };

                              const typeColors: Record<string, { dark: string; light: string }> = {
                                CALL: { dark: "bg-blue-900/30 text-blue-400", light: "bg-blue-100 text-blue-700" },
                                EMAIL: { dark: "bg-purple-900/30 text-purple-400", light: "bg-purple-100 text-purple-700" },
                                TEXT: { dark: "bg-green-900/30 text-green-400", light: "bg-green-100 text-green-700" },
                                MEETING: { dark: "bg-orange-900/30 text-orange-400", light: "bg-orange-100 text-orange-700" },
                                TASK: { dark: "bg-yellow-900/30 text-yellow-400", light: "bg-yellow-100 text-yellow-700" },
                                OTHER: { dark: "bg-gray-900/30 text-gray-400", light: "bg-gray-100 text-gray-700" },
                              };

                              const colors = typeColors[activity.type] || typeColors.OTHER;

                              return (
                                <div
                                  key={activity.id}
                                  className={`p-3 rounded-lg ${
                                    isDark ? "bg-slate-800/50" : "bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        isDark ? colors.dark : colors.light
                                      }`}
                                    >
                                      {typeLabels[activity.type] || activity.type}
                                    </span>
                                    <div className={`text-xs ${themeClasses.mutedText}`}>
                                      {activityDate.toLocaleString()}
                                    </div>
                                  </div>
                                  <div className={`text-sm ${themeClasses.headingText}`}>
                                    {activity.summary}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                          </>
                        )}
                      </div>

                      {/* Next Follow-Up Section */}
                      <div className={`pt-6 border-t ${themeClasses.panelBorder}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`text-sm font-semibold ${themeClasses.headingText}`}>
                            Next Follow-Up
                          </div>
                          {(() => {
                            const status = getFollowUpStatus(contactDetail?.nextFollowUpAt || null);
                            if (status === "OVERDUE") {
                              return (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isDark
                                    ? "bg-red-900/30 text-red-400 border border-red-700/30"
                                    : "bg-red-100 text-red-700 border border-red-200"
                                }`}>
                                  Overdue
                                </span>
                              );
                            }
                            if (status === "TODAY") {
                              return (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isDark
                                    ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30"
                                    : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                }`}>
                                  Today
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Date & Time
                            </label>
                            {/* Quick set buttons */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs ${themeClasses.mutedText}`}>Quick set:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  const timeOfDay = getPreferredTimeOfDay();
                                  const newValue = setDateWithTime(tomorrow, timeOfDay);
                                  setFollowUpAt(newValue);
                                  showFollowUpToast("Date set — click Save to apply", 1500);
                                }}
                                disabled={isSavingFollowUp || isLoadingDetail}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  isSavingFollowUp || isLoadingDetail
                                    ? isDark
                                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                Tomorrow
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextWeek = new Date();
                                  nextWeek.setDate(nextWeek.getDate() + 7);
                                  const timeOfDay = getPreferredTimeOfDay();
                                  const newValue = setDateWithTime(nextWeek, timeOfDay);
                                  setFollowUpAt(newValue);
                                  showFollowUpToast("Date set — click Save to apply", 1500);
                                }}
                                disabled={isSavingFollowUp || isLoadingDetail}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  isSavingFollowUp || isLoadingDetail
                                    ? isDark
                                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                Next week
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const today = new Date();
                                  const nextMonth = addMonthsClamped(today, 1);
                                  const timeOfDay = getPreferredTimeOfDay();
                                  const newValue = setDateWithTime(nextMonth, timeOfDay);
                                  setFollowUpAt(newValue);
                                  showFollowUpToast("Date set — click Save to apply", 1500);
                                }}
                                disabled={isSavingFollowUp || isLoadingDetail}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  isSavingFollowUp || isLoadingDetail
                                    ? isDark
                                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                Next month
                              </button>
                            </div>
                            <input
                              type="datetime-local"
                              value={followUpAt}
                              onChange={(e) => setFollowUpAt(e.target.value)}
                              className={getInputClasses(isDark)}
                              disabled={isSavingFollowUp}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Note <span className="text-xs font-normal opacity-75">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={followUpNote}
                              onChange={(e) => setFollowUpNote(e.target.value)}
                              placeholder="Reminder note..."
                              className={getInputClasses(isDark)}
                              disabled={isSavingFollowUp}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSaveFollowUp}
                              disabled={isSavingFollowUp}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                isSavingFollowUp
                                  ? isDark
                                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                  : isDark
                                  ? "bg-blue-700 text-white hover:bg-blue-600"
                                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              }`}
                            >
                              {isSavingFollowUp ? "Saving..." : "Save Follow-Up"}
                            </button>
                            {(followUpAt || followUpNote) && (
                              <button
                                type="button"
                                onClick={handleClearFollowUp}
                                disabled={isSavingFollowUp}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                  isSavingFollowUp
                                    ? isDark
                                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          
                          {/* Snooze buttons - only show when follow-up exists */}
                          {contactDetail?.nextFollowUpAt && (
                            <div className="flex items-center gap-2 pt-2 border-t border-current/10">
                              <span className={`text-xs ${themeClasses.mutedText}`}>Snooze:</span>
                              <button
                                type="button"
                                onClick={() => handleSnoozeFollowUp(1)}
                                disabled={isSavingFollowUp}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                  isSavingFollowUp
                                    ? isDark
                                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                1 day
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSnoozeFollowUp(7)}
                                disabled={isSavingFollowUp}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                  isSavingFollowUp
                                    ? isDark
                                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : isDark
                                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                1 week
                              </button>
                            </div>
                          )}
                          
                          {/* Toast message */}
                          {followUpToastMessage && (
                            <div 
                              className={`text-xs px-3 py-2 rounded-lg border ${
                                isDark
                                  ? "bg-green-900/20 text-green-400 border-green-700/30"
                                  : "bg-green-50 text-green-700 border-green-200"
                              }`}
                              aria-live="polite"
                              role="status"
                            >
                              {followUpToastMessage}
                            </div>
                          )}
                          
                          {followUpError && (
                            <div className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                              {followUpError}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Review Request Integration Modal */}
      {showReviewRequestModal && contactDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <OBDPanel isDark={isDark} className="max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Send Review Request
              </OBDHeading>
              <button
                type="button"
                onClick={() => setShowReviewRequestModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Contact
                </div>
                <div className={themeClasses.headingText}>{contactDetail.name}</div>
              </div>

              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Email
                </div>
                <div className={`flex items-center gap-2 ${contactDetail.email ? themeClasses.headingText : themeClasses.mutedText}`}>
                  {contactDetail.email || "—"}
                  {contactDetail.email && (
                    <span className={`text-xs ${themeClasses.mutedText}`}>(selected)</span>
                  )}
                </div>
              </div>

              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Phone
                </div>
                <div className={`flex items-center gap-2 ${contactDetail.phone ? themeClasses.headingText : themeClasses.mutedText}`}>
                  {contactDetail.phone || "—"}
                  {contactDetail.phone && (
                    <span className={`text-xs ${themeClasses.mutedText}`}>(selected)</span>
                  )}
                </div>
              </div>

              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Channel
                </div>
                <select
                  className={getInputClasses(isDark)}
                  defaultValue="email"
                >
                  <option value="email">Email</option>
                  <option value="sms" disabled>SMS (coming soon)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReviewRequestModal(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("from", "crm");
                    params.set("contactId", contactDetail.id);
                    params.set("name", contactDetail.name);
                    if (contactDetail.email) params.set("email", contactDetail.email);
                    if (contactDetail.phone) params.set("phone", contactDetail.phone);
                    // Add returnUrl to come back to this contact
                    const returnUrl = `/apps/obd-crm?contactId=${encodeURIComponent(contactDetail.id)}`;
                    params.set("returnUrl", returnUrl);
                    router.push(`/apps/review-request-automation?${params.toString()}`);
                  }}
                  className={SUBMIT_BUTTON_CLASSES + " flex-1"}
                >
                  Continue
                </button>
              </div>
            </div>
          </OBDPanel>
        </div>
      )}

      {/* AI Help Desk Integration Modal */}
      {showHelpDeskModal && contactDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <OBDPanel isDark={isDark} className="max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Ask AI Help Desk
              </OBDHeading>
              <button
                type="button"
                onClick={() => setShowHelpDeskModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Prompt
                </div>
                <textarea
                  value={helpDeskPrompt}
                  onChange={(e) => setHelpDeskPrompt(e.target.value)}
                  className={getInputClasses(isDark)}
                  rows={4}
                  placeholder="Enter your question or request..."
                />
              </div>

              {contactDetail.activities && contactDetail.activities.length > 0 && (
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={useLastNote}
                      onChange={(e) => setUseLastNote(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Use last note as context</span>
                  </label>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={useActivityTimeline}
                      onChange={(e) => setUseActivityTimeline(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Use activity timeline</span>
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHelpDeskModal(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Store prompt and contactId in sessionStorage for privacy
                    if (typeof window !== "undefined") {
                      try {
                        sessionStorage.setItem("obd_ai_helpdesk_prefill_prompt", helpDeskPrompt);
                        sessionStorage.setItem("obd_ai_helpdesk_prefill_contactId", contactDetail.id);
                      } catch (error) {
                        // Silently fail if sessionStorage is unavailable
                        console.warn("Failed to store prompt in sessionStorage:", error);
                      }
                    }

                    const params = new URLSearchParams();
                    params.set("from", "crm");
                    params.set("context", "crm");
                    params.set("contactId", contactDetail.id);
                    // Note: prompt is now stored in sessionStorage, not in URL
                    if (useLastNote) params.set("useLastNote", "1");
                    if (useActivityTimeline) params.set("useActivityTimeline", "1");
                    // Add returnUrl to come back to this contact
                    const returnUrl = `/apps/obd-crm?contactId=${encodeURIComponent(contactDetail.id)}`;
                    params.set("returnUrl", returnUrl);
                    router.push(`/apps/ai-help-desk?${params.toString()}`);
                  }}
                  className={SUBMIT_BUTTON_CLASSES + " flex-1"}
                >
                  Open in AI Help Desk
                </button>
              </div>
            </div>
          </OBDPanel>
        </div>
      )}

      {/* Social Post Integration Modal */}
      {showSocialPostModal && contactDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <OBDPanel isDark={isDark} className="max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Draft a Social Post
              </OBDHeading>
              <button
                type="button"
                onClick={() => setShowSocialPostModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Contact
                </div>
                <div className={`flex items-center gap-2 ${themeClasses.headingText}`}>
                  {contactDetail.name}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      contactDetail.status === "Active"
                        ? isDark
                          ? "bg-green-900/30 text-green-400"
                          : "bg-green-100 text-green-700"
                        : contactDetail.status === "Lead"
                        ? isDark
                          ? "bg-blue-900/30 text-blue-400"
                          : "bg-blue-100 text-blue-700"
                        : contactDetail.status === "Past"
                        ? isDark
                          ? "bg-gray-900/30 text-gray-400"
                          : "bg-gray-100 text-gray-700"
                        : isDark
                        ? "bg-red-900/30 text-red-400"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {contactDetail.status}
                  </span>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Post Intent
                </label>
                <select
                  value={socialPostIntent}
                  onChange={(e) => setSocialPostIntent(e.target.value as typeof socialPostIntent)}
                  className={getInputClasses(isDark)}
                >
                  <option value="Follow-up">Follow-up</option>
                  <option value="Thank-you">Thank-you</option>
                  <option value="Testimonial ask">Testimonial ask</option>
                  <option value="Promo mention">Promo mention</option>
                </select>
              </div>

              {contactDetail.activities && contactDetail.activities.length > 0 && (
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={socialPostUseLastNote}
                      onChange={(e) => setSocialPostUseLastNote(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Use last note as context</span>
                  </label>
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={socialPostUseLastActivity}
                      onChange={(e) => setSocialPostUseLastActivity(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Use last activity as context</span>
                  </label>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Platform Preset
                </label>
                <select
                  value={socialPostPlatform}
                  onChange={(e) => setSocialPostPlatform(e.target.value as typeof socialPostPlatform)}
                  className={getInputClasses(isDark)}
                >
                  <option value="All">All</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google Business">Google Business</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSocialPostModal(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Store prefill data in sessionStorage
                    if (typeof window !== "undefined") {
                      try {
                        const prefillData = {
                          source: "crm",
                          contactId: contactDetail.id,
                          contactName: contactDetail.name,
                          intent: socialPostIntent,
                          platformPreset: socialPostPlatform,
                          useLastNote: socialPostUseLastNote,
                          useLastActivity: socialPostUseLastActivity,
                        };
                        sessionStorage.setItem("obd_social_prefill", JSON.stringify(prefillData));
                      } catch (error) {
                        console.warn("Failed to store prefill data in sessionStorage:", error);
                      }
                    }

                    const params = new URLSearchParams();
                    params.set("from", "crm");
                    params.set("context", "crm");
                    params.set("contactId", contactDetail.id);
                    // Add returnUrl to come back to this contact
                    const returnUrl = `/apps/obd-crm?contactId=${encodeURIComponent(contactDetail.id)}`;
                    params.set("returnUrl", returnUrl);
                    router.push(`/apps/social-auto-poster/composer?${params.toString()}`);
                  }}
                  className={SUBMIT_BUTTON_CLASSES + " flex-1"}
                >
                  Open Social Auto-Poster
                </button>
              </div>
            </div>
          </OBDPanel>
        </div>
      )}

      {/* Offers Builder Integration Modal */}
      {showOffersModal && contactDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <OBDPanel isDark={isDark} className="max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Create an Offer
              </OBDHeading>
              <button
                type="button"
                onClick={() => setShowOffersModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Contact
                </div>
                <div className={`flex items-center gap-2 ${themeClasses.headingText}`}>
                  {contactDetail.name}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      contactDetail.status === "Active"
                        ? isDark
                          ? "bg-green-900/30 text-green-400"
                          : "bg-green-100 text-green-700"
                        : contactDetail.status === "Lead"
                        ? isDark
                          ? "bg-blue-900/30 text-blue-400"
                          : "bg-blue-100 text-blue-700"
                        : contactDetail.status === "Past"
                        ? isDark
                          ? "bg-gray-900/30 text-gray-400"
                          : "bg-gray-100 text-gray-700"
                        : isDark
                        ? "bg-red-900/30 text-red-400"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {contactDetail.status}
                  </span>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Offer Goal
                </label>
                <select
                  value={offerGoal}
                  onChange={(e) => setOfferGoal(e.target.value as typeof offerGoal)}
                  className={getInputClasses(isDark)}
                >
                  <option value="Reactivation">Reactivation</option>
                  <option value="New customer">New customer</option>
                  <option value="Upsell">Upsell</option>
                  <option value="Referral">Referral</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Offer Type
                </label>
                <select
                  value={offerType}
                  onChange={(e) => setOfferType(e.target.value as typeof offerType)}
                  className={getInputClasses(isDark)}
                >
                  <option value="Discount">Discount</option>
                  <option value="Free add-on">Free add-on</option>
                  <option value="Limited-time deal">Limited-time deal</option>
                  <option value="Bundle">Bundle</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Offer Hint <span className="text-xs font-normal opacity-75">(optional)</span>
                </label>
                <input
                  type="text"
                  value={offerHint}
                  onChange={(e) => setOfferHint(e.target.value)}
                  className={getInputClasses(isDark)}
                  placeholder="e.g., 20% off first service, free upgrade, etc."
                />
              </div>

              {contactDetail.activities && contactDetail.activities.length > 0 && (
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={offerUseLastNote}
                      onChange={(e) => setOfferUseLastNote(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Use last note as context</span>
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOffersModal(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-white hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Store prefill data in sessionStorage
                    if (typeof window !== "undefined") {
                      try {
                        const prefillData = {
                          source: "crm",
                          contactId: contactDetail.id,
                          contactName: contactDetail.name,
                          offerGoal,
                          offerType,
                          offerHint: offerHint.trim() || undefined,
                          useLastNote: offerUseLastNote,
                        };
                        sessionStorage.setItem("obd_offers_prefill", JSON.stringify(prefillData));
                      } catch (error) {
                        console.warn("Failed to store prefill data in sessionStorage:", error);
                      }
                    }

                    const params = new URLSearchParams();
                    params.set("from", "crm");
                    params.set("context", "crm");
                    params.set("contactId", contactDetail.id);
                    // Add returnUrl to come back to this contact
                    const returnUrl = `/apps/obd-crm?contactId=${encodeURIComponent(contactDetail.id)}`;
                    params.set("returnUrl", returnUrl);
                    router.push(`/apps/offers-builder?${params.toString()}`);
                  }}
                  className={SUBMIT_BUTTON_CLASSES + " flex-1"}
                >
                  Open Offers Builder
                </button>
              </div>
            </div>
          </OBDPanel>
        </div>
      )}
      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <OBDPanel isDark={isDark} className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>
                Import CSV Contacts
              </OBDHeading>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportStep(1);
                  setCsvFile(null);
                  setCsvData(null);
                  setColumnMapping({ name: "", email: "", phone: "", status: "", tags: "" });
                  setImportPreview([]);
                  setImportResult(null);
                }}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              >
                ×
              </button>
            </div>

            {/* Step Indicator */}
            <div className="mb-6">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        importStep >= step
                          ? isDark
                            ? "bg-blue-700 text-white"
                            : "bg-blue-100 text-blue-700"
                          : isDark
                          ? "bg-slate-700 text-slate-400"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {step}
                    </div>
                    {step < 4 && (
                      <div
                        className={`h-1 w-12 ${
                          importStep > step
                            ? isDark
                              ? "bg-blue-700"
                              : "bg-blue-100"
                            : isDark
                            ? "bg-slate-700"
                            : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {importStep === 1 && "Upload CSV file"}
                {importStep === 2 && "Preview data"}
                {importStep === 3 && "Map columns"}
                {importStep === 4 && "Import complete"}
              </div>
            </div>

            {/* Step 1: Upload */}
            {importStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className={getInputClasses(isDark)}
                  />
                  <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                    CSV must have a header row with column names.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {importStep === 2 && csvData && (
              <div className="space-y-4">
                <p className={`text-sm ${themeClasses.headingText}`}>
                  Found {csvData.rows.length} rows. Preview (first 10):
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${themeClasses.panelBorder}`}>
                        {csvData.headers.map((header, idx) => (
                          <th key={idx} className={`text-left py-2 px-3 ${themeClasses.labelText}`}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 10).map((row, rowIdx) => (
                        <tr key={rowIdx} className={`border-b ${themeClasses.panelBorder}`}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className={`py-2 px-3 ${themeClasses.mutedText}`}>
                              {cell || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setImportStep(3)}
                    className={SUBMIT_BUTTON_CLASSES}
                  >
                    Continue to Mapping
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportStep(1)}
                    className={`px-4 py-2 rounded-full font-medium ${
                      isDark
                        ? "bg-slate-700 text-white hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Column Mapping */}
            {importStep === 3 && csvData && (
              <div className="space-y-4">
                <p className={`text-sm ${themeClasses.headingText}`}>
                  Map CSV columns to contact fields:
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={columnMapping.name}
                      onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">Select column...</option>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Email
                    </label>
                    <select
                      value={columnMapping.email}
                      onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">Select column...</option>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Phone
                    </label>
                    <select
                      value={columnMapping.phone}
                      onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">Select column...</option>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Status
                    </label>
                    <select
                      value={columnMapping.status}
                      onChange={(e) => setColumnMapping({ ...columnMapping, status: e.target.value })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">Select column...</option>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Tags (comma-separated tag names)
                    </label>
                    <select
                      value={columnMapping.tags}
                      onChange={(e) => setColumnMapping({ ...columnMapping, tags: e.target.value })}
                      className={getInputClasses(isDark)}
                    >
                      <option value="">Select column...</option>
                      {csvData.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!columnMapping.name}
                    className={`px-4 py-2 rounded-full font-medium ${
                      !columnMapping.name
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    } ${SUBMIT_BUTTON_CLASSES}`}
                  >
                    Preview Import
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportStep(2)}
                    className={`px-4 py-2 rounded-full font-medium ${
                      isDark
                        ? "bg-slate-700 text-white hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Confirm Import */}
            {importStep === 4 && importResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  isDark ? "bg-green-900/20 border border-green-700" : "bg-green-50 border border-green-200"
                }`}>
                  <p className={`font-medium ${isDark ? "text-green-400" : "text-green-700"}`}>
                    Import Complete!
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className={themeClasses.mutedText}>
                      Created: {importResult.createdCount} contacts
                    </p>
                    <p className={themeClasses.mutedText}>
                      Skipped: {importResult.skippedCount} contacts (duplicates or invalid)
                    </p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-3">
                        <p className={`text-sm font-medium ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                          Errors:
                        </p>
                        <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                          {importResult.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx} className={themeClasses.mutedText}>
                              Row {err.row}: {err.error}
                            </li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li className={themeClasses.mutedText}>
                              ... and {importResult.errors.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportStep(1);
                    setCsvFile(null);
                    setCsvData(null);
                    setColumnMapping({ name: "", email: "", phone: "", status: "", tags: "" });
                    setImportPreview([]);
                    setImportResult(null);
                  }}
                  className={SUBMIT_BUTTON_CLASSES + " w-full"}
                >
                  Close
                </button>
              </div>
            ) : importStep === 3 && importPreview.length > 0 ? (
              <div className="space-y-4">
                <p className={`text-sm ${themeClasses.headingText}`}>
                  Preview of {importPreview.length} rows to import:
                </p>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${themeClasses.panelBorder}`}>
                        <th className={`text-left py-2 px-3 ${themeClasses.labelText}`}>Name</th>
                        <th className={`text-left py-2 px-3 ${themeClasses.labelText}`}>Email</th>
                        <th className={`text-left py-2 px-3 ${themeClasses.labelText}`}>Phone</th>
                        <th className={`text-left py-2 px-3 ${themeClasses.labelText}`}>Status</th>
                        <th className={`text-left py-2 px-3 ${themeClasses.labelText}`}>Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, idx) => (
                        <tr key={idx} className={`border-b ${themeClasses.panelBorder}`}>
                          <td className={`py-2 px-3 ${themeClasses.headingText}`}>{row.name}</td>
                          <td className={`py-2 px-3 ${themeClasses.mutedText}`}>{row.email || "—"}</td>
                          <td className={`py-2 px-3 ${themeClasses.mutedText}`}>{row.phone || "—"}</td>
                          <td className={`py-2 px-3 ${themeClasses.mutedText}`}>{row.status || "—"}</td>
                          <td className={`py-2 px-3 ${themeClasses.mutedText}`}>
                            {row.tags?.join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={isImporting}
                    className={`px-4 py-2 rounded-full font-medium ${
                      isImporting ? "opacity-50 cursor-not-allowed" : ""
                    } ${SUBMIT_BUTTON_CLASSES}`}
                  >
                    {isImporting ? "Importing..." : `Import ${csvData?.rows.length || 0} Contacts`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportStep(3)}
                    disabled={isImporting}
                    className={`px-4 py-2 rounded-full font-medium ${
                      isDark
                        ? "bg-slate-700 text-white hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : null}
          </OBDPanel>
        </div>
      )}

      {/* Mobile FAB (Floating Action Button) */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        {/* FAB Menu */}
        {showFabMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20"
              onClick={() => setShowFabMenu(false)}
            />
            {/* Menu Items */}
            <div className="absolute bottom-16 right-0 flex flex-col gap-2 min-w-[160px]">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(true);
                  setShowFabMenu(false);
                }}
                className={`px-4 py-3 rounded-lg font-medium shadow-lg flex items-center gap-2 ${
                  isDark
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <span>Add Contact</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  setImportStep(1);
                  setCsvFile(null);
                  setCsvData(null);
                  setColumnMapping({ name: "", email: "", phone: "", status: "", tags: "" });
                  setImportPreview([]);
                  setImportResult(null);
                  setShowFabMenu(false);
                }}
                className={`px-4 py-3 rounded-lg font-medium shadow-lg flex items-center gap-2 ${
                  isDark
                    ? "bg-slate-700 text-white hover:bg-slate-600"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
                }`}
              >
                <span>Import CSV</span>
              </button>
            </div>
          </>
        )}
        {/* FAB Button */}
        <button
          type="button"
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold transition-transform ${
            showFabMenu ? "rotate-45" : "rotate-0"
          } ${
            isDark
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          aria-label="Quick actions"
        >
          {showFabMenu ? "×" : "+"}
        </button>
      </div>

    </OBDPageContainer>
  );
}

export default function OBDCRMPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OBDCRMPageContent />
    </Suspense>
  );
}

/**
 * UNDO FUNCTIONALITY FOR DESTRUCTIVE ACTIONS
 * 
 * NOTE: This feature is currently NOT implemented because:
 * - DELETE endpoints exist for contacts (/api/obd-crm/contacts/[id]) and tags (/api/obd-crm/tags)
 * - However, NO delete UI/buttons exist in the frontend
 * - Per requirements: "If no delete exists, do not implement delete just for this"
 * 
 * If delete functionality is added in the future, implement undo as follows:
 * 
 * 1. State management:
 *    - pendingDeletes: Map<id, { type: 'contact' | 'tag', data: any, timer: NodeJS.Timeout }>
 * 
 * 2. Delete handler:
 *    - Mark item as "pending delete" (remove from UI but keep in state)
 *    - Start 8-10 second timer
 *    - Show toast/banner: "Deleted — Undo"
 * 
 * 3. Undo handler:
 *    - Cancel timer
 *    - Restore item to UI
 *    - Remove from pendingDeletes
 * 
 * 4. Timer expiration:
 *    - Call DELETE endpoint
 *    - Remove from pendingDeletes
 * 
 * 5. Navigation safety:
 *    - On drawer/page close: finalize all pending deletes immediately
 *    - Use useEffect cleanup to cancel timers
 * 
 * Toast implementation (minimal inline banner):
 *    - Fixed position banner at top/bottom
 *    - Shows "Deleted — Undo" with countdown
 *    - Undo button cancels and restores
 */

