"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDToast from "@/components/obd/OBDToast";
import { ErrorBoundary } from "@/components/obd/ErrorBoundary";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type {
  BookingRequest,
  BookingService,
  BookingSettings,
  CreateServiceRequest,
  UpdateBookingRequestRequest,
  UpdateBookingSettingsRequest,
  AvailabilityWindow,
  AvailabilityException,
  AvailabilityData,
  BookingTheme,
  UpdateBookingThemeRequest,
} from "@/lib/apps/obd-scheduler/types";
import { BookingStatus, BookingMode } from "@/lib/apps/obd-scheduler/types";
import { assertNever } from "@/lib/dev/assertNever";

type SchedulerTab = "requests" | "services" | "availability" | "branding" | "settings";
type RequestView = "needs-action" | "upcoming" | "past-due" | "completed" | "declined" | "all";
type RequestSort = "newest-first" | "oldest-first" | "soonest-appointment" | "recently-updated";

function OBDSchedulerPageContent() {
  // Initialize theme with consistent default (fixes hydration mismatch)
  // Will be updated from localStorage in useEffect after hydration
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  // Initialize activeTab with consistent default (fixes hydration mismatch)
  // Will be updated from localStorage in useEffect after hydration
  const [activeTab, setActiveTab] = useState<SchedulerTab>("requests");

  // Load theme, activeTab, and activeView from localStorage after hydration
  useEffect(() => {
    const savedTheme = localStorage.getItem("obd:scheduler:theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
    
    const savedTab = localStorage.getItem("obd:scheduler:activeTab");
    if (savedTab === "requests" || savedTab === "services" || savedTab === "availability" || savedTab === "branding" || savedTab === "settings") {
      setActiveTab(savedTab as SchedulerTab);
    }
    
    const savedView = localStorage.getItem("obd:scheduler:activeView");
    if (savedView === "needs-action" || savedView === "upcoming" || savedView === "past-due" || savedView === "completed" || savedView === "declined" || savedView === "all") {
      setActiveView(savedView as RequestView);
    }
  }, []);

  // Save activeTab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("obd:scheduler:activeTab", activeTab);
  }, [activeTab]);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("obd:scheduler:theme", theme);
  }, [theme]);

  // Requests tab state
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [showRequestDetail, setShowRequestDetail] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  // Initialize activeView with consistent default (fixes hydration mismatch)
  // Will be updated from localStorage in useEffect after hydration
  const [activeView, setActiveView] = useState<RequestView>("needs-action");
  const [sortBy, setSortBy] = useState<RequestSort>("newest-first");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Save activeView to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("obd:scheduler:activeView", activeView);
  }, [activeView]);

  // Reset to page 1 when filters/sort/showArchived changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeView, showArchived, sortBy]);

  // Load archived IDs from localStorage after hydration
  useEffect(() => {
    try {
      const savedArchived = localStorage.getItem("obd:scheduler:archivedIds");
      if (savedArchived) {
        const ids = JSON.parse(savedArchived) as string[];
        if (Array.isArray(ids)) {
          setArchivedIds(new Set(ids));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save archived IDs to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem("obd:scheduler:archivedIds", JSON.stringify(Array.from(archivedIds)));
    } catch {
      // Ignore storage errors
    }
  }, [archivedIds]);

  // Archive/unarchive functions (Archive/Hide - Tier 5.7F)
  const archiveRequest = (requestId: string) => {
    setArchivedIds((prev) => new Set([...prev, requestId]));
    showNotification("Request archived");
  };

  const unarchiveRequest = (requestId: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
    showNotification("Request unarchived");
  };
  
  // Action states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposingRequestId, setProposingRequestId] = useState<string | null>(null);
  const [proposeForm, setProposeForm] = useState({
    proposedStart: "",
    proposedEnd: "",
    internalNotes: "",
  });
  const [proposeErrors, setProposeErrors] = useState<Record<string, string>>({});
  const [showDeclineConfirm, setShowDeclineConfirm] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeErrors, setCompleteErrors] = useState<Record<string, string>>({});
  // Bulk actions state (Bulk Actions - Tier 5.7E)
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [showBulkDeclineConfirm, setShowBulkDeclineConfirm] = useState(false);
  const [bulkDeclineLoading, setBulkDeclineLoading] = useState(false);

  // Services tab state
  const [services, setServices] = useState<BookingService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<BookingService | null>(null);
  const [serviceForm, setServiceForm] = useState<CreateServiceRequest>({
    name: "",
    durationMinutes: 60,
    description: "",
    active: true,
  });

  // Settings tab state
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsForm, setSettingsForm] = useState<UpdateBookingSettingsRequest>({
    bookingModeDefault: BookingMode.REQUEST_ONLY,
    timezone: "America/New_York",
    bufferMinutes: 15,
    minNoticeHours: 24,
    maxDaysOut: 90,
    policyText: "",
    notificationEmail: "",
  });

  // Availability tab state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityWindows, setAvailabilityWindows] = useState<Omit<AvailabilityWindow, "id" | "businessId" | "createdAt" | "updatedAt">[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<Omit<AvailabilityException, "id" | "businessId" | "createdAt" | "updatedAt">[]>([]);

  // Branding tab state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bookingTheme, setBookingTheme] = useState<BookingTheme | null>(null);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [themeForm, setThemeForm] = useState<UpdateBookingThemeRequest>({
    logoUrl: "",
    primaryColor: "#29c4a9",
    accentColor: "",
    headlineText: "",
    introText: "",
  });

  // Save operation loading states
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingService, setSavingService] = useState(false);

  // Toast queue state
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" }>>([]);

  // Validation state
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>({});
  const [themeErrors, setThemeErrors] = useState<Record<string, string>>({});

  // Focus management for modals
  const [previousActiveElement, setPreviousActiveElement] = useState<HTMLElement | null>(null);
  const modalRefs = {
    propose: useRef<HTMLDivElement>(null),
    service: useRef<HTMLDivElement>(null),
    bulkDecline: useRef<HTMLDivElement>(null),
    complete: useRef<HTMLDivElement>(null),
    decline: useRef<HTMLDivElement>(null),
  };

  // Focus trap and restoration for modals
  useEffect(() => {
    const anyModalOpen = showProposeModal || showServiceModal || showBulkDeclineConfirm || showCompleteModal || showDeclineConfirm;
    
    if (anyModalOpen) {
      // Store the previously focused element
      setPreviousActiveElement(document.activeElement as HTMLElement);
      
      // Focus the modal container after a brief delay to ensure it's rendered
      setTimeout(() => {
        const modalContainer = 
          (showProposeModal && modalRefs.propose.current) ||
          (showServiceModal && modalRefs.service.current) ||
          (showBulkDeclineConfirm && modalRefs.bulkDecline.current) ||
          (showCompleteModal && modalRefs.complete.current) ||
          (showDeclineConfirm && modalRefs.decline.current);
        
        if (modalContainer) {
          const firstFocusable = modalContainer.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          firstFocusable?.focus();
        }
      }, 0);
    } else if (previousActiveElement) {
      // Restore focus when modal closes
      previousActiveElement.focus();
      setPreviousActiveElement(null);
    }
  }, [showProposeModal, showServiceModal, showBulkDeclineConfirm, showCompleteModal, showDeclineConfirm]);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showProposeModal) {
          setShowProposeModal(false);
          setProposingRequestId(null);
          setProposeForm({ proposedStart: "", proposedEnd: "", internalNotes: "" });
          setProposeErrors({});
        } else if (showServiceModal) {
          setShowServiceModal(false);
          setEditingService(null);
        } else if (showBulkDeclineConfirm) {
          setShowBulkDeclineConfirm(false);
        } else if (showCompleteModal) {
          setShowCompleteModal(null);
          setCompleteNotes("");
          setCompleteErrors({});
        } else if (showDeclineConfirm) {
          setShowDeclineConfirm(null);
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showProposeModal, showServiceModal, showBulkDeclineConfirm, showCompleteModal, showDeclineConfirm]);

  // Persist theme to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("obd:scheduler:theme", theme);
    }
  }, [theme]);

  // Persist activeTab to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("obd:scheduler:activeTab", activeTab);
    }
  }, [activeTab]);

  // Load requests (fetch all, filtering done client-side)
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const res = await fetch(`/api/obd-scheduler/requests`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load requests");
      }
      setRequests(data.data.requests || []);
    } catch (error) {
      console.error("Error loading requests:", error);
      setRequestsError(error instanceof Error ? error.message : "Failed to load requests");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  // Load services
  const loadServices = async () => {
    setServicesLoading(true);
    setServicesError("");
    try {
      const res = await fetch("/api/obd-scheduler/services");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load services");
      }
      setServices(data.data || []);
    } catch (error) {
      console.error("Error loading services:", error);
      setServicesError(error instanceof Error ? error.message : "Failed to load services");
    } finally {
      setServicesLoading(false);
    }
  };

  // Load settings
  const loadSettings = async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const res = await fetch("/api/obd-scheduler/settings");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load settings");
      }
      const loadedSettings = data.data;
      setSettings(loadedSettings);
      setSettingsForm({
        bookingModeDefault: loadedSettings.bookingModeDefault || BookingMode.REQUEST_ONLY,
        timezone: loadedSettings.timezone,
        bufferMinutes: loadedSettings.bufferMinutes,
        minNoticeHours: loadedSettings.minNoticeHours,
        maxDaysOut: loadedSettings.maxDaysOut,
        policyText: loadedSettings.policyText || "",
        notificationEmail: loadedSettings.notificationEmail || "",
      });
    } catch (error) {
      console.error("Error loading settings:", error);
      setSettingsError(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Load availability
  const loadAvailability = async () => {
    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const res = await fetch("/api/obd-scheduler/availability");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load availability");
      }
      const loadedAvailability = data.data;
      setAvailability(loadedAvailability);
      
      // Initialize windows - ensure all 7 days are represented
      const defaultWindows = Array.from({ length: 7 }, (_, day) => ({
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
        isEnabled: false,
      }));
      
      loadedAvailability.windows.forEach((w: AvailabilityWindow) => {
        const idx = defaultWindows.findIndex((dw) => dw.dayOfWeek === w.dayOfWeek);
        if (idx >= 0) {
          defaultWindows[idx] = {
            dayOfWeek: w.dayOfWeek,
            startTime: w.startTime,
            endTime: w.endTime,
            isEnabled: w.isEnabled,
          };
        }
      });
      
      setAvailabilityWindows(defaultWindows);
      setAvailabilityExceptions(loadedAvailability.exceptions.map((e: AvailabilityException) => ({
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        type: e.type,
      })));
    } catch (error) {
      console.error("Error loading availability:", error);
      setAvailabilityError(error instanceof Error ? error.message : "Failed to load availability");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // Load theme
  const loadTheme = async () => {
    setThemeLoading(true);
    setThemeError("");
    try {
      const res = await fetch("/api/obd-scheduler/theme");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load theme");
      }
      const loadedTheme = data.data;
      setBookingTheme(loadedTheme);
      setThemeForm({
        logoUrl: loadedTheme.logoUrl || "",
        primaryColor: loadedTheme.primaryColor || "#29c4a9",
        accentColor: loadedTheme.accentColor || "",
        headlineText: loadedTheme.headlineText || "",
        introText: loadedTheme.introText || "",
      });
    } catch (error) {
      console.error("Error loading theme:", error);
      setThemeError(error instanceof Error ? error.message : "Failed to load theme");
    } finally {
      setThemeLoading(false);
    }
  };

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === "requests") {
      loadRequests();
      // Also load settings to ensure bookingKey is available for download button
      if (!settings) {
        loadSettings();
      }
    } else if (activeTab === "services") {
      loadServices();
    } else if (activeTab === "availability") {
      loadAvailability();
    } else if (activeTab === "branding") {
      loadTheme();
    } else if (activeTab === "settings") {
      loadSettings();
    } else {
      assertNever(activeTab, "Unhandled tab case");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadRequests]);

  // Notification helper - adds to toast queue
  const showNotification = (message: string, type: "success" | "error" = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]); // Keep max 3 toasts
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  // Validation functions
  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {};
    if (settingsForm.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settingsForm.notificationEmail)) {
      errors.notificationEmail = "Please enter a valid email address";
    }
    if (settingsForm.policyText && settingsForm.policyText.length > 5000) {
      errors.policyText = "Policy text must be 5000 characters or less";
    }
    setSettingsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateTheme = (): boolean => {
    const errors: Record<string, string> = {};
    if (themeForm.headlineText && themeForm.headlineText.length > 200) {
      errors.headlineText = "Headline must be 200 characters or less";
    }
    if (themeForm.introText && themeForm.introText.length > 1000) {
      errors.introText = "Introduction text must be 1000 characters or less";
    }
    if (themeForm.logoUrl && !/^https?:\/\/.+/.test(themeForm.logoUrl)) {
      errors.logoUrl = "Please enter a valid URL starting with http:// or https://";
    }
    setThemeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Update request status (legacy - kept for backward compatibility)
  const updateRequestStatus = async (
    requestId: string,
    update: UpdateBookingRequestRequest
  ) => {
    try {
      const res = await fetch(`/api/obd-scheduler/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update request");
      }
      await loadRequests();
      setShowRequestDetail(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error updating request:", error);
      showNotification(error instanceof Error ? error.message : "Failed to update request", "error");
    }
  };

  // Perform action on booking request (Tier 5.3B)
  const performRequestAction = async (
    requestId: string,
    action: "approve" | "propose" | "decline" | "complete",
    actionData?: { proposedStart?: string; proposedEnd?: string; internalNotes?: string | null }
  ) => {
    // Prevent double submits
    if (actionLoading[requestId]) return;
    
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));

    try {
      const res = await fetch(`/api/obd-scheduler/requests/${requestId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...actionData,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Failed to ${action} request`);
      }

      // Update request in local state
      const updatedRequest = data.data as BookingRequest;
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? updatedRequest : r))
      );

      // Update selected request if it's the one being acted on
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(updatedRequest);
      }

      // Show success toast
      if (action === "approve") {
        showNotification("Booking approved", "success");
      } else if (action === "propose") {
        showNotification("New time proposed", "success");
      } else if (action === "decline") {
        showNotification("Booking declined", "success");
      } else if (action === "complete") {
        showNotification("Booking marked as complete", "success");
      }

      // Close modals
      setShowProposeModal(false);
      setProposingRequestId(null);
      setProposeForm({ proposedStart: "", proposedEnd: "", internalNotes: "" });
      setProposeErrors({});
      setShowDeclineConfirm(null);
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} request`;
      showNotification(errorMessage, "error");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  // Handle approve action
  const handleApprove = async (requestId: string) => {
    await performRequestAction(requestId, "approve");
  };

  // Handle propose action (opens modal)
  const handleProposeClick = (requestId: string) => {
    setProposingRequestId(requestId);
    setShowProposeModal(true);
    setProposeForm({ proposedStart: "", proposedEnd: "", internalNotes: "" });
    setProposeErrors({});
  };

  // Handle propose submit
  const handleProposeSubmit = async () => {
    if (!proposingRequestId) return;

    // Validate
    const errors: Record<string, string> = {};
    if (!proposeForm.proposedStart) {
      errors.proposedStart = "Proposed start time is required";
    }
    if (!proposeForm.proposedEnd) {
      errors.proposedEnd = "Proposed end time is required";
    }
    if (proposeForm.proposedStart && proposeForm.proposedEnd) {
      const start = new Date(proposeForm.proposedStart);
      const end = new Date(proposeForm.proposedEnd);
      if (end <= start) {
        errors.proposedEnd = "End time must be after start time";
      }
    }
    if (proposeForm.internalNotes && proposeForm.internalNotes.length > 2000) {
      errors.internalNotes = "Internal notes must be 2000 characters or less";
    }

    if (Object.keys(errors).length > 0) {
      setProposeErrors(errors);
      return;
    }

    // Convert datetime-local to ISO string
    const proposedStartISO = new Date(proposeForm.proposedStart).toISOString();
    const proposedEndISO = new Date(proposeForm.proposedEnd).toISOString();

    await performRequestAction(proposingRequestId, "propose", {
      proposedStart: proposedStartISO,
      proposedEnd: proposedEndISO,
      internalNotes: proposeForm.internalNotes.trim() || null,
    });
  };

  // Handle decline action
  const handleDecline = async (requestId: string) => {
    await performRequestAction(requestId, "decline");
  };

  // Bulk actions (Bulk Actions - Tier 5.7E)
  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };


  // Bulk decline handler (Tier 5.7E step 3 - execute using existing single-decline logic)
  const handleBulkDecline = async () => {
    // Guardrail: Prevent double-run while running (Tier 5.7E step 4)
    if (bulkDeclineLoading) {
      console.warn("[Bulk Decline] Already running, ignoring duplicate call");
      return;
    }

    if (selectedRequestIds.size === 0) return;

    // Filter to only non-declined requests
    const eligibleIds = Array.from(selectedRequestIds).filter((id) => {
      const request = requests.find((r) => r.id === id);
      return request && request.status !== "DECLINED";
    });

    const skippedCount = selectedRequestIds.size - eligibleIds.length;

    if (eligibleIds.length === 0) {
      showNotification(
        skippedCount > 0
          ? `All ${selectedRequestIds.size} selected request(s) are already declined`
          : "No eligible requests to decline",
        "error"
      );
      setSelectedRequestIds(new Set());
      setShowBulkDeclineConfirm(false);
      return;
    }

    setBulkDeclineLoading(true);
    let declinedCount = 0;
    let errorCount = 0;

    try {
      // Decline each request sequentially using existing single-decline logic
      for (const requestId of eligibleIds) {
        try {
          await performRequestAction(requestId, "decline");
          declinedCount++;
        } catch (error) {
          console.error(`Error declining request ${requestId}:`, error);
          errorCount++;
          // Continue with next request even if one fails
        }
      }

      // Show notification with counts
      const parts: string[] = [];
      if (declinedCount > 0) {
        parts.push(`Declined ${declinedCount} request${declinedCount !== 1 ? "s" : ""}`);
      }
      if (skippedCount > 0) {
        parts.push(`skipped ${skippedCount} already declined`);
      }
      if (errorCount > 0) {
        parts.push(`${errorCount} failed`);
      }

      if (declinedCount > 0) {
        showNotification(parts.join(", "), "success");
      } else {
        showNotification(parts.join(", "), "error");
      }

      // Clear selection after success (even if some failed, we still clear)
      setSelectedRequestIds(new Set());
      setShowBulkDeclineConfirm(false);
    } catch (error) {
      console.error("Error in bulk decline:", error);
      showNotification("Error declining some requests", "error");
    } finally {
      setBulkDeclineLoading(false);
    }
  };

  // Handle complete action (opens modal)
  const handleCompleteClick = (requestId: string) => {
    setShowCompleteModal(requestId);
    setCompleteNotes("");
    setCompleteErrors({});
  };

  // Handle complete submit
  const handleCompleteSubmit = async () => {
    if (!showCompleteModal) return;

    // Validate
    const errors: Record<string, string> = {};
    if (completeNotes && completeNotes.length > 2000) {
      errors.completeNotes = "Internal notes must be 2000 characters or less";
    }

    if (Object.keys(errors).length > 0) {
      setCompleteErrors(errors);
      return;
    }

    await performRequestAction(showCompleteModal, "complete", {
      internalNotes: completeNotes.trim() || null,
    });

    // Close modal and reset form
    setShowCompleteModal(null);
    setCompleteNotes("");
    setCompleteErrors({});
  };

  // Save service
  const saveService = async () => {
    if (savingService) return;
    setSavingService(true);
    try {
      const url = editingService
        ? `/api/obd-scheduler/services/${editingService.id}`
        : "/api/obd-scheduler/services";
      const method = editingService ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save service");
      }
      await loadServices();
      setShowServiceModal(false);
      setEditingService(null);
      setServiceForm({ name: "", durationMinutes: 60, description: "", active: true });
      showNotification(editingService ? "Service updated successfully" : "Service created successfully");
    } catch (error) {
      console.error("Error saving service:", error);
      showNotification(error instanceof Error ? error.message : "Failed to save service", "error");
    } finally {
      setSavingService(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (savingSettings) return;
    if (!validateSettings()) {
      showNotification("Please fix validation errors before saving", "error");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch("/api/obd-scheduler/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save settings");
      }
      await loadSettings();
      showNotification("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      showNotification(error instanceof Error ? error.message : "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Save availability
  const saveAvailability = async () => {
    if (savingAvailability) return;
    setSavingAvailability(true);
    try {
      const res = await fetch("/api/obd-scheduler/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          windows: availabilityWindows,
          exceptions: availabilityExceptions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save availability");
      }
      await loadAvailability();
      showNotification("Availability saved successfully");
    } catch (error) {
      console.error("Error saving availability:", error);
      showNotification(error instanceof Error ? error.message : "Failed to save availability", "error");
    } finally {
      setSavingAvailability(false);
    }
  };

  // Save theme
  const saveTheme = async () => {
    if (savingTheme) return;
    if (!validateTheme()) {
      showNotification("Please fix validation errors before saving", "error");
      return;
    }
    setSavingTheme(true);
    try {
      const res = await fetch("/api/obd-scheduler/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(themeForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save theme");
      }
      await loadTheme();
      showNotification("Theme saved successfully");
    } catch (error) {
      console.error("Error saving theme:", error);
      showNotification(error instanceof Error ? error.message : "Failed to save theme", "error");
    } finally {
      setSavingTheme(false);
    }
  };

  // Format date/time
  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return "—";
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  // CSV Export (Tier 5.7I)
  const exportToCSV = () => {
    if (sortedRequests.length === 0) {
      showNotification("No requests to export", "error");
      return;
    }

    // CSV escaping helper - wraps field in quotes if needed and escapes quotes
    const escapeCSVField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return "";
      const str = String(field);
      // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Format date for CSV (ISO format)
    const formatDateForCSV = (isoString: string | null): string => {
      if (!isoString) return "";
      try {
        return new Date(isoString).toISOString();
      } catch {
        return "";
      }
    };

    // Build CSV header
    const headers = [
      "customerName",
      "email",
      "phone",
      "service",
      "status",
      "preferredStart",
      "proposedStart",
      "createdAt",
    ];

    // Build CSV rows
    const rows = sortedRequests.map((request) => {
      return [
        escapeCSVField(request.customerName),
        escapeCSVField(request.customerEmail),
        escapeCSVField(request.customerPhone),
        escapeCSVField(request.service?.name || ""),
        escapeCSVField(request.status),
        formatDateForCSV(request.preferredStart),
        formatDateForCSV(request.proposedStart),
        formatDateForCSV(request.createdAt),
      ];
    });

    // Combine header and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    // Generate filename with current date
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const filename = `obd-booking-requests-${dateStr}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(`Exported ${sortedRequests.length} request(s) to CSV`);
  };

  // Get status badge color (updated per requirements)
  const getStatusColor = (status: BookingStatus) => {
    const colors: Record<BookingStatus, string> = {
      REQUESTED: isDark ? "bg-slate-500/20 text-slate-300 border-slate-500" : "bg-slate-200 text-slate-700 border-slate-300",
      APPROVED: "bg-green-500/20 text-green-400 border-green-500",
      DECLINED: isDark ? "bg-gray-500/20 text-gray-400 border-gray-500" : "bg-gray-200 text-gray-600 border-gray-300",
      PROPOSED_TIME: "bg-amber-500/20 text-amber-400 border-amber-500",
      COMPLETED: "bg-slate-500/20 text-slate-400 border-slate-500",
      CANCELED: "bg-gray-500/20 text-gray-400 border-gray-500",
    };
    return colors[status] || colors.REQUESTED;
  };

  // Filter requests based on active view (Smart Views - Tier 5.7A)
  // Memoized to only recalculate when requests or activeView changes
  const filteredRequests = useMemo(() => {
    const now = Date.now();
    
    switch (activeView) {
      case "needs-action":
        return requests.filter(
          (r) => r.status === "REQUESTED" || r.status === "PROPOSED_TIME"
        );
      case "upcoming":
        return requests.filter((r) => {
          if (r.status !== "APPROVED") return false;
          if (!r.proposedStart) return false;
          try {
            const proposedTime = new Date(r.proposedStart).getTime();
            return proposedTime > now;
          } catch {
            return false;
          }
        });
      case "past-due":
        return requests.filter((r) => {
          if (r.status !== "APPROVED") return false;
          if (!r.proposedStart) return false;
          try {
            const proposedTime = new Date(r.proposedStart).getTime();
            return proposedTime < now;
          } catch {
            return false;
          }
        });
      case "completed":
        return requests.filter((r) => r.status === "COMPLETED");
      case "declined":
        return requests.filter((r) => r.status === "DECLINED");
      case "all":
        return requests;
      default:
        return requests;
    }
  }, [requests, activeView]);

  // Apply archive filter (Archive/Hide - Tier 5.7F)
  // Memoized to only recalculate when filteredRequests, archivedIds, or showArchived changes
  const archiveFilteredRequests = useMemo(() => {
    if (showArchived) {
      // Show all requests (including archived)
      return filteredRequests;
    }
    // Hide archived requests
    return filteredRequests.filter((r) => !archivedIds.has(r.id));
  }, [filteredRequests, archivedIds, showArchived]);

  // Sort filtered requests (Sorting Controls - Tier 5.7C)
  // Memoized to only recalculate when archiveFilteredRequests or sortBy changes
  const sortedRequests = useMemo(() => {
    const sorted = [...archiveFilteredRequests]; // Create a copy to avoid mutating
    
    switch (sortBy) {
      case "newest-first":
        return sorted.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime; // Descending
        });
      case "oldest-first":
        return sorted.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime; // Ascending
        });
      case "soonest-appointment":
        return sorted.sort((a, b) => {
          // Nulls last
          if (!a.proposedStart && !b.proposedStart) return 0;
          if (!a.proposedStart) return 1;
          if (!b.proposedStart) return -1;
          const aTime = new Date(a.proposedStart).getTime();
          const bTime = new Date(b.proposedStart).getTime();
          return aTime - bTime; // Ascending
        });
      case "recently-updated":
        return sorted.sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt).getTime();
          return bTime - aTime; // Descending
        });
      default:
        return sorted;
    }
  }, [archiveFilteredRequests, sortBy]);

  // Paginate sorted requests (Pagination - P0)
  const totalRequests = sortedRequests.length;
  const totalPages = Math.ceil(totalRequests / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedRequests = sortedRequests.slice(startIndex, endIndex);

  // Guardrail: Revalidate selection against visible requests (Tier 5.7E step 4)
  // Keep selection stable across sorting/filter changes by removing IDs no longer visible
  useEffect(() => {
    if (selectedRequestIds.size === 0) return;

    const visibleIds = new Set(sortedRequests.map((r) => r.id));
    const needsCleanup = Array.from(selectedRequestIds).some((id) => !visibleIds.has(id));

    if (needsCleanup) {
      setSelectedRequestIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (visibleIds.has(id)) {
            next.add(id);
          }
        }
        return next;
      });
    }
  }, [sortedRequests]); // Only depend on sortedRequests, not selectedRequestIds (to avoid infinite loop)

  // Select all visible requests on current page (Tier 5.7E step 1, updated for pagination)
  const handleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      // Select all visible, selectable requests on current page (excluding declined)
      const visibleSelectableIds = paginatedRequests
        .filter((r) => r.status !== "DECLINED")
        .map((r) => r.id);
      setSelectedRequestIds((prev) => {
        const next = new Set(prev);
        visibleSelectableIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      // Deselect all visible requests on current page
      const visibleIds = paginatedRequests.map((r) => r.id);
      setSelectedRequestIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  // Check if all visible selectable requests on current page are selected
  const visibleSelectableRequests = paginatedRequests.filter((r) => r.status !== "DECLINED");
  const selectedVisibleCount = visibleSelectableRequests.filter((r) =>
    selectedRequestIds.has(r.id)
  ).length;
  const allVisibleSelected = visibleSelectableRequests.length > 0 && selectedVisibleCount === visibleSelectableRequests.length;
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleSelectableRequests.length;

  // Calculate eligible IDs for bulk decline (Tier 5.7E step 4 - guardrail)
  const eligibleSelectedIds = Array.from(selectedRequestIds).filter((id) => {
    const request = requests.find((r) => r.id === id);
    return request && request.status !== "DECLINED";
  });
  const hasEligibleSelection = eligibleSelectedIds.length > 0;

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Scheduler & Booking"
      tagline="Manage booking requests, services, availability, and settings for your business."
    >
      {/* Toast Queue */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.slice(0, 3).map((toast) => (
          <OBDToast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            isDark={isDark}
          />
        ))}
      </div>
      {/* Tabs */}
      <OBDPanel isDark={isDark} className="mb-6" variant="toolbar">
        <div
          role="tablist"
          aria-label="Scheduler sections"
          className={`flex flex-wrap gap-2 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}
        >
          {[
            { id: "requests" as SchedulerTab, label: "Requests" },
            { id: "services" as SchedulerTab, label: "Services" },
            { id: "availability" as SchedulerTab, label: "Availability" },
            { id: "branding" as SchedulerTab, label: "Branding" },
            { id: "settings" as SchedulerTab, label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveTab(tab.id);
                }
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? `text-[#29c4a9] border-b-2 border-[#29c4a9] ${themeClasses.headingText}`
                  : `${themeClasses.mutedText} hover:${themeClasses.headingText}`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </OBDPanel>

      {/* Requests Tab */}
      {activeTab === "requests" && (
        <OBDPanel isDark={isDark}>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <OBDHeading level={2} isDark={isDark}>Booking Requests</OBDHeading>
              
              {/* Sort Dropdown and Export */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="sort-select" className={`text-sm ${themeClasses.mutedText}`}>
                    Sort:
                  </label>
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as RequestSort)}
                    className={getInputClasses(isDark, "text-sm min-w-[180px]")}
                  >
                    <option value="newest-first">Newest first</option>
                    <option value="oldest-first">Oldest first</option>
                    <option value="soonest-appointment">Soonest appointment</option>
                    <option value="recently-updated">Recently updated</option>
                  </select>
                </div>
                <button
                  onClick={exportToCSV}
                  disabled={sortedRequests.length === 0}
                  className={`px-4 py-2 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  title="Export filtered and sorted requests to CSV"
                >
                  Export CSV
                </button>
              </div>
            </div>
            
            {/* Smart Views Selector */}
            <div
              role="tablist"
              aria-label="Smart view filters"
              className={`mt-4 flex flex-wrap gap-2 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}
            >
              {[
                { id: "needs-action" as const, label: "Needs Action" },
                { id: "upcoming" as const, label: "Upcoming" },
                { id: "past-due" as const, label: "Past Due" },
                { id: "completed" as const, label: "Completed" },
                { id: "declined" as const, label: "Declined" },
                { id: "all" as const, label: "All" },
              ].map((view) => (
                <button
                  key={view.id}
                  role="tab"
                  aria-selected={activeView === view.id}
                  aria-controls={`view-${view.id}`}
                  onClick={() => setActiveView(view.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveView(view.id);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeView === view.id
                      ? `text-[#29c4a9] border-b-2 border-[#29c4a9] ${themeClasses.headingText}`
                      : `${themeClasses.mutedText} hover:${themeClasses.headingText}`
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
            
            {/* Show Archived Toggle */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                id="show-archived"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="show-archived" className={`text-sm ${themeClasses.labelText} cursor-pointer`}>
                Show archived requests
              </label>
            </div>
          </div>

          {requestsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{requestsError}</p>
            </div>
          )}

          {requestsLoading ? (
            <p className={themeClasses.mutedText}>Loading requests...</p>
          ) : totalRequests === 0 ? (
            <div className={`p-8 text-center rounded-lg border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <p className={themeClasses.mutedText}>
                {activeView === "needs-action" && "No requests need action right now."}
                {activeView === "upcoming" && "No upcoming bookings."}
                {activeView === "past-due" && "No past due bookings."}
                {activeView === "completed" && "No completed bookings."}
                {activeView === "declined" && "No declined bookings."}
                {activeView === "all" && "No booking requests found."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Selection Header - Select All Checkbox (Tier 5.7E step 1) */}
              <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border mb-2 ${
                isDark ? "bg-slate-800/30 border-slate-700" : "bg-slate-50 border-slate-200"
              }`}>
                <input
                  type="checkbox"
                  id="select-all-visible"
                  checked={allVisibleSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someVisibleSelected;
                  }}
                  onChange={(e) => handleSelectAllVisible(e.target.checked)}
                  className="rounded cursor-pointer"
                  disabled={visibleSelectableRequests.length === 0}
                  aria-label={
                    visibleSelectableRequests.length === 0
                      ? "No selectable requests"
                      : allVisibleSelected
                      ? `Deselect all ${visibleSelectableRequests.length} visible requests`
                      : `Select all ${visibleSelectableRequests.length} visible requests`
                  }
                  aria-describedby="select-all-description"
                />
                <label
                  htmlFor="select-all-visible"
                  id="select-all-description"
                  className={`text-sm font-medium cursor-pointer ${
                    visibleSelectableRequests.length === 0
                      ? themeClasses.mutedText + " cursor-not-allowed"
                      : themeClasses.labelText
                  }`}
                >
                  Select all on this page ({visibleSelectableRequests.length} visible)
                  {selectedRequestIds.size > 0 && (
                    <span className={`ml-2 ${themeClasses.mutedText}`}>
                      ({selectedRequestIds.size} total selected)
                    </span>
                  )}
                </label>
              </div>

              {/* Bulk Actions Bar (Tier 5.7E step 2) */}
              {selectedRequestIds.size > 0 && (
                <div className={`rounded-lg border p-3 mb-3 ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${themeClasses.headingText}`}>
                      {selectedRequestIds.size} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRequestIds(new Set())}
                        className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                          isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                        aria-label="Clear selection"
                      >
                        Clear selection
                      </button>
                      <button
                        onClick={() => setShowBulkDeclineConfirm(true)}
                        disabled={bulkDeclineLoading || !hasEligibleSelection}
                        className={`px-3 py-1.5 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                        }`}
                        title={
                          !hasEligibleSelection
                            ? "All selected requests are already declined"
                            : bulkDeclineLoading
                            ? "Declining requests..."
                            : "Decline selected requests"
                        }
                      >
                        {bulkDeclineLoading ? "Declining..." : "Decline selected"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {paginatedRequests.map((request) => {
                const canAct = request.status === "REQUESTED" || request.status === "PROPOSED_TIME";
                const isLoading = actionLoading[request.id] || false;
                const isSelected = selectedRequestIds.has(request.id);
                const canBulkDecline = request.status !== "DECLINED";

                return (
                  <div
                    key={request.id}
                    className={`rounded-lg border p-4 ${
                      isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    } ${isSelected ? (isDark ? "border-[#29c4a9]" : "border-[#29c4a9] ring-2 ring-[#29c4a9]/20") : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Bulk Selection Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRequestSelection(request.id);
                          }}
                          disabled={!canBulkDecline}
                          className="rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => e.stopPropagation()}
                          title={canBulkDecline ? "Select for bulk actions" : "Cannot select declined requests"}
                        />
                        <div
                          className="flex-1 cursor-pointer hover:opacity-80"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRequestDetail(true);
                          }}
                        >
                        <p className={`font-medium ${themeClasses.headingText}`}>
                          {request.customerName}
                        </p>
                        <p className={`text-sm ${themeClasses.mutedText}`}>
                          {request.customerEmail}
                        </p>
                        {request.service && (
                          <p className={`text-sm ${themeClasses.mutedText}`}>
                            Service: {request.service.name}
                          </p>
                        )}
                        <p className={`text-sm ${themeClasses.mutedText}`}>
                          Preferred Start: {request.preferredStart ? formatDateTime(request.preferredStart) : "No preference"}
                        </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 rounded text-xs border ${getStatusColor(request.status)}`}
                          >
                            {request.status}
                          </span>
                          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                            {formatDateTime(request.createdAt)}
                          </p>
                        </div>
                        {canAct && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={isLoading}
                              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "bg-green-500 hover:bg-green-600 text-white"
                              }`}
                            >
                              {isLoading ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleProposeClick(request.id)}
                              disabled={isLoading}
                              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : "bg-amber-500 hover:bg-amber-600 text-white"
                              }`}
                            >
                              {isLoading ? "..." : "Propose new time"}
                            </button>
                            <button
                              onClick={() => setShowDeclineConfirm(request.id)}
                              disabled={isLoading}
                              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark
                                  ? "bg-red-600 hover:bg-red-700 text-white"
                                  : "bg-red-500 hover:bg-red-600 text-white"
                              }`}
                            >
                              {isLoading ? "..." : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalRequests > 0 && (
            <div className={`mt-6 flex items-center justify-between border-t pt-4 ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`text-sm ${themeClasses.mutedText}`}>
                Showing {startIndex + 1}–{Math.min(endIndex, totalRequests)} of {totalRequests}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
                  }`}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className={`text-sm ${themeClasses.mutedText}`}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
                  }`}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </OBDPanel>
      )}

      {/* Services Tab */}
      {activeTab === "services" && (
        <OBDPanel isDark={isDark}>
          <div className="mb-4 flex items-center justify-between">
            <OBDHeading level={2} isDark={isDark}>Services</OBDHeading>
            <button
              onClick={() => {
                setEditingService(null);
                setServiceForm({ name: "", durationMinutes: 60, description: "", active: true });
                setShowServiceModal(true);
              }}
              className={SUBMIT_BUTTON_CLASSES}
            >
              Add Service
            </button>
          </div>

          {servicesError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{servicesError}</p>
            </div>
          )}

          {servicesLoading ? (
            <p className={themeClasses.mutedText}>Loading services...</p>
          ) : services.length === 0 ? (
            <p className={themeClasses.mutedText}>No services found. Add your first service to get started.</p>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`rounded-lg border p-4 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${themeClasses.headingText}`}>
                        {service.name}
                        {!service.active && (
                          <span className={`ml-2 text-xs ${themeClasses.mutedText}`}>(Inactive)</span>
                        )}
                      </p>
                      <p className={`text-sm ${themeClasses.mutedText}`}>
                        Duration: {service.durationMinutes} minutes
                      </p>
                      {service.description && (
                        <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                          {service.description}
                        </p>
                      )}
                      {/* Payments Placeholder */}
                      <div className={`mt-2 p-2 rounded text-xs ${isDark ? "bg-slate-700/50" : "bg-gray-100"}`}>
                        <p className={themeClasses.mutedText}>
                          💳 Payments: <span className="font-medium">Stripe not configured</span>
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          Payment settings will be available after Stripe integration.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingService(service);
                          setServiceForm({
                            name: service.name,
                            durationMinutes: service.durationMinutes,
                            description: service.description || "",
                            active: service.active,
                          });
                          setShowServiceModal(true);
                        }}
                        className={`px-3 py-1 text-sm rounded ${isDark ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-700"}`}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OBDPanel>
      )}

      {/* Availability Tab */}
      {activeTab === "availability" && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark}>Availability Windows</OBDHeading>
          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
            Configure your business hours by day of the week.
          </p>

          {availabilityError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{availabilityError}</p>
            </div>
          )}

          {availabilityLoading ? (
            <p className={themeClasses.mutedText}>Loading availability...</p>
          ) : (
            <div className="space-y-6">
              {/* Availability Windows Editor */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Business Hours</h3>
                <div className="space-y-3">
                  {[
                    { day: 0, label: "Sunday" },
                    { day: 1, label: "Monday" },
                    { day: 2, label: "Tuesday" },
                    { day: 3, label: "Wednesday" },
                    { day: 4, label: "Thursday" },
                    { day: 5, label: "Friday" },
                    { day: 6, label: "Saturday" },
                  ].map(({ day, label }) => {
                    const window = availabilityWindows.find((w) => w.dayOfWeek === day) || {
                      dayOfWeek: day,
                      startTime: "09:00",
                      endTime: "17:00",
                      isEnabled: false,
                    };
                    return (
                      <div
                        key={day}
                        className={`flex items-center gap-4 p-3 rounded border ${
                          isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 w-24">
                          <input
                            type="checkbox"
                            checked={window.isEnabled}
                            onChange={(e) => {
                              const updated = [...availabilityWindows];
                              const idx = updated.findIndex((w) => w.dayOfWeek === day);
                              if (idx >= 0) {
                                updated[idx] = { ...updated[idx], isEnabled: e.target.checked };
                              } else {
                                updated.push({ ...window, isEnabled: e.target.checked });
                              }
                              setAvailabilityWindows(updated);
                            }}
                            className="rounded"
                          />
                          <label className={`text-sm font-medium ${themeClasses.labelText}`}>{label}</label>
                        </div>
                        {window.isEnabled && (
                          <>
                            <input
                              type="time"
                              value={window.startTime}
                              onChange={(e) => {
                                const updated = [...availabilityWindows];
                                const idx = updated.findIndex((w) => w.dayOfWeek === day);
                                if (idx >= 0) {
                                  updated[idx] = { ...updated[idx], startTime: e.target.value };
                                } else {
                                  updated.push({ ...window, startTime: e.target.value, isEnabled: true });
                                }
                                setAvailabilityWindows(updated);
                              }}
                              className={getInputClasses(isDark)}
                            />
                            <span className={themeClasses.mutedText}>to</span>
                            <input
                              type="time"
                              value={window.endTime}
                              onChange={(e) => {
                                const updated = [...availabilityWindows];
                                const idx = updated.findIndex((w) => w.dayOfWeek === day);
                                if (idx >= 0) {
                                  updated[idx] = { ...updated[idx], endTime: e.target.value };
                                } else {
                                  updated.push({ ...window, endTime: e.target.value, isEnabled: true });
                                }
                                setAvailabilityWindows(updated);
                              }}
                              className={getInputClasses(isDark)}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exceptions Placeholder */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Exceptions</h3>
                <p className={`text-sm ${themeClasses.mutedText}`}>
                  Closed days and custom hours will be available in a future update.
                </p>
              </div>

              <button 
                onClick={saveAvailability} 
                disabled={savingAvailability}
                className={`${SUBMIT_BUTTON_CLASSES} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {savingAvailability ? "Saving..." : "Save Availability"}
              </button>
            </div>
          )}
        </OBDPanel>
      )}

      {/* ===== TAB: BRANDING (start) ===== */}
      {activeTab === "branding" && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark}>Branding & Theme</OBDHeading>
          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
            Customize the appearance of your public booking page.
          </p>

          {themeError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{themeError}</p>
            </div>
          )}

          {themeLoading ? (
            <div className="space-y-4">
              <p className={themeClasses.mutedText}>Loading theme...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Logo URL
                </label>
                <input
                  type="url"
                  value={themeForm.logoUrl || ""}
                  onChange={(e) => {
                    setThemeForm({ ...themeForm, logoUrl: e.target.value });
                    if (themeErrors.logoUrl) {
                      setThemeErrors({ ...themeErrors, logoUrl: "" });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  placeholder="https://example.com/logo.png"
                />
                {themeErrors.logoUrl ? (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {themeErrors.logoUrl}
                  </p>
                ) : (
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    URL to your business logo image.
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeForm.primaryColor || "#29c4a9"}
                    onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
                    className="h-10 w-20 rounded border"
                  />
                  <input
                    type="text"
                    value={themeForm.primaryColor || "#29c4a9"}
                    onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="#29c4a9"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Accent Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeForm.accentColor || "#000000"}
                    onChange={(e) => setThemeForm({ ...themeForm, accentColor: e.target.value })}
                    className="h-10 w-20 rounded border"
                  />
                  <input
                    type="text"
                    value={themeForm.accentColor || ""}
                    onChange={(e) => setThemeForm({ ...themeForm, accentColor: e.target.value })}
                    className={getInputClasses(isDark)}
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Headline Text
                </label>
                <input
                  type="text"
                  value={themeForm.headlineText || ""}
                  onChange={(e) => {
                    setThemeForm({ ...themeForm, headlineText: e.target.value });
                    if (themeErrors.headlineText) {
                      setThemeErrors({ ...themeErrors, headlineText: "" });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  placeholder="Book your appointment"
                  maxLength={200}
                />
                {themeErrors.headlineText ? (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {themeErrors.headlineText}
                  </p>
                ) : (
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    Main headline displayed on the booking page.
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Introduction Text
                </label>
                <textarea
                  value={themeForm.introText || ""}
                  onChange={(e) => {
                    setThemeForm({ ...themeForm, introText: e.target.value });
                    if (themeErrors.introText) {
                      setThemeErrors({ ...themeErrors, introText: "" });
                    }
                  }}
                  rows={4}
                  className={getInputClasses(isDark, "resize-none")}
                  placeholder="Welcome! Select a service and time that works for you."
                  maxLength={1000}
                />
                {themeErrors.introText ? (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {themeErrors.introText}
                  </p>
                ) : (
                  <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                    Brief introduction text displayed below the headline.
                  </p>
                )}
              </div>

              <button 
                onClick={saveTheme} 
                disabled={savingTheme}
                className={`${SUBMIT_BUTTON_CLASSES} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {savingTheme ? "Saving..." : "Save Branding"}
              </button>
            </div>
          )}
        </OBDPanel>
      )}
      {/* ===== TAB: BRANDING (end) ===== */}

      {/* ===== TAB: SETTINGS (start) ===== */}
      {activeTab === "settings" && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark}>Booking Settings</OBDHeading>

          {settingsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{settingsError}</p>
            </div>
          )}

          {settingsLoading ? (
            <div className="space-y-6">
              <p className={themeClasses.mutedText}>Loading settings...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Booking Mode Section */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Booking Mode</h3>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-4 mb-3">
                    <input
                      type="radio"
                      id="request-only"
                      name="bookingMode"
                      checked={settingsForm.bookingModeDefault === BookingMode.REQUEST_ONLY}
                      onChange={() => setSettingsForm({ ...settingsForm, bookingModeDefault: BookingMode.REQUEST_ONLY })}
                      className="rounded"
                    />
                    <label htmlFor="request-only" className={themeClasses.labelText}>
                      <span className="font-medium">Request Only</span>
                      <p className={`text-sm ${themeClasses.mutedText}`}>
                        Customers submit booking requests that you approve manually.
                      </p>
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      id="instant-allowed"
                      name="bookingMode"
                      checked={settingsForm.bookingModeDefault === BookingMode.INSTANT_ALLOWED}
                      onChange={() => setSettingsForm({ ...settingsForm, bookingModeDefault: BookingMode.INSTANT_ALLOWED })}
                      className="rounded"
                    />
                    <label htmlFor="instant-allowed" className={themeClasses.labelText}>
                      <span className="font-medium">Instant Allowed</span>
                      <p className={`text-sm ${themeClasses.mutedText}`}>
                        Customers can book instantly when slots are available (requires calendar sync - coming soon).
                      </p>
                    </label>
                  </div>
                </div>
              </div>

              {/* Connected Calendars Placeholder */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Connected Calendars</h3>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    Calendar connections will be available in a future update. Connect your Google Calendar, Outlook, or other calendars to enable instant booking.
                  </p>
                </div>
              </div>

              {/* Other Settings */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>General Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Notification Email
                    </label>
                    <input
                      type="email"
                      value={settingsForm.notificationEmail || ""}
                      onChange={(e) => {
                        setSettingsForm({ ...settingsForm, notificationEmail: e.target.value });
                        if (settingsErrors.notificationEmail) {
                          setSettingsErrors({ ...settingsErrors, notificationEmail: "" });
                        }
                      }}
                      className={getInputClasses(isDark)}
                      placeholder="owner@business.com"
                    />
                    {settingsErrors.notificationEmail ? (
                      <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                        {settingsErrors.notificationEmail}
                      </p>
                    ) : (
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Where booking request alerts should be sent.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Booking Policies
                    </label>
                    <textarea
                      value={settingsForm.policyText || ""}
                      onChange={(e) => {
                        setSettingsForm({ ...settingsForm, policyText: e.target.value });
                        if (settingsErrors.policyText) {
                          setSettingsErrors({ ...settingsErrors, policyText: "" });
                        }
                      }}
                      rows={6}
                      className={getInputClasses(isDark, "resize-none")}
                      placeholder="Enter your booking policies, cancellation policy, etc."
                    />
                    {settingsErrors.policyText && (
                      <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                        {settingsErrors.policyText}
                      </p>
                    )}
                  </div>

                  {settings && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Public Booking Link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`https://apps.ocalabusinessdirectory.com/book/${settings.bookingKey}`}
                          className={getInputClasses(isDark)}
                        />
                        <button
                          onClick={() => {
                            const link = `https://apps.ocalabusinessdirectory.com/book/${settings.bookingKey}`;
                            navigator.clipboard.writeText(link);
                            showNotification("Link copied to clipboard!");
                          }}
                          className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                          aria-label="Copy booking link"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            const link = `https://apps.ocalabusinessdirectory.com/book/${settings.bookingKey}`;
                            window.open(link, "_blank", "noopener,noreferrer");
                          }}
                          className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        >
                          Test Link
                        </button>
                      </div>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Share this link with customers to allow them to submit booking requests.
                      </p>
                    </div>
                  )}

                  <button 
                    onClick={saveSettings} 
                    disabled={savingSettings}
                    className={`${SUBMIT_BUTTON_CLASSES} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </OBDPanel>
      )}
      {/* ===== TAB: SETTINGS (end) ===== */}

      {/* Request Detail Modal */}
      {showRequestDetail && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-xl border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Booking Request Details
              </h3>
              <button
                onClick={() => {
                  setShowRequestDetail(false);
                  setSelectedRequest(null);
                }}
                className={themeClasses.mutedText}
                aria-label="Close request detail"
              >
                ✕
              </button>
            </div>

            {/* Two-column layout on desktop, single-column on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Customer Column */}
              <div className="space-y-4">
                <div>
                  <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Customer Name</p>
                  <p className={themeClasses.headingText}>{selectedRequest.customerName}</p>
                </div>

                <div>
                  <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Email</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={`mailto:${selectedRequest.customerEmail}`}
                      className={`${themeClasses.headingText} hover:underline`}
                    >
                      {selectedRequest.customerEmail}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedRequest.customerEmail);
                        showNotification("Email copied to clipboard!");
                      }}
                      className={`px-2 py-1 text-xs rounded ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                      aria-label="Copy email address"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {selectedRequest.customerPhone && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Phone</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${selectedRequest.customerPhone}`}
                        className={`${themeClasses.headingText} hover:underline`}
                      >
                        {selectedRequest.customerPhone}
                      </a>
                      <button
                        onClick={() => {
                          if (selectedRequest.customerPhone) {
                            navigator.clipboard.writeText(selectedRequest.customerPhone);
                            showNotification("Phone copied to clipboard!");
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        aria-label="Copy phone number"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {selectedRequest.message && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Message</p>
                    <p className={`${themeClasses.headingText} whitespace-pre-wrap`}>{selectedRequest.message}</p>
                  </div>
                )}
              </div>

              {/* Appointment Column */}
              <div className="space-y-4">
                {selectedRequest.service && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Service</p>
                    <p className={themeClasses.headingText}>{selectedRequest.service.name}</p>
                  </div>
                )}

                <div>
                  <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Status</p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs border ${getStatusColor(selectedRequest.status)}`}
                  >
                    {selectedRequest.status}
                  </span>
                </div>

                <div>
                  <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Preferred Start</p>
                  <p className={themeClasses.headingText}>
                    {selectedRequest.preferredStart ? formatDateTime(selectedRequest.preferredStart) : "No preference"}
                  </p>
                </div>

                {selectedRequest.proposedStart && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Proposed Start</p>
                    <p className={themeClasses.headingText}>{formatDateTime(selectedRequest.proposedStart)}</p>
                  </div>
                )}

                {selectedRequest.proposedEnd && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>Proposed End</p>
                    <p className={themeClasses.headingText}>{formatDateTime(selectedRequest.proposedEnd)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Internal Notes - Full Width */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Internal Notes
              </label>
              <textarea
                value={selectedRequest.internalNotes || ""}
                onChange={(e) => {
                  setSelectedRequest({ ...selectedRequest, internalNotes: e.target.value });
                }}
                rows={3}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Add internal notes..."
              />
            </div>

            {/* Timeline Section */}
            <div className="pt-4 border-t mb-6 border-slate-300 dark:border-slate-600">
                <h4 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Timeline</h4>
                <div className="space-y-3">
                  {/* Requested - always show */}
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${themeClasses.headingText}`}>Requested</p>
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        {formatDateTime(selectedRequest.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Updated - always show */}
                  {selectedRequest.updatedAt && selectedRequest.updatedAt !== selectedRequest.createdAt && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${themeClasses.headingText}`}>Updated</p>
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDateTime(selectedRequest.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Proposed time sent - only if status is PROPOSED_TIME */}
                  {selectedRequest.status === "PROPOSED_TIME" && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full ${isDark ? "bg-amber-500" : "bg-amber-400"}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${themeClasses.headingText}`}>Proposed time sent</p>
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDateTime(selectedRequest.updatedAt)}
                        </p>
                        {selectedRequest.proposedStart && selectedRequest.proposedEnd && (
                          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                            {formatDateTime(selectedRequest.proposedStart)} → {formatDateTime(selectedRequest.proposedEnd)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Approved - only if status is APPROVED */}
                  {selectedRequest.status === "APPROVED" && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full ${isDark ? "bg-green-500" : "bg-green-400"}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${themeClasses.headingText}`}>Approved</p>
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDateTime(selectedRequest.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Declined - only if status is DECLINED */}
                  {selectedRequest.status === "DECLINED" && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full ${isDark ? "bg-red-500" : "bg-red-400"}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${themeClasses.headingText}`}>Declined</p>
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDateTime(selectedRequest.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Completed - only if status is COMPLETED */}
                  {selectedRequest.status === "COMPLETED" && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full ${isDark ? "bg-blue-500" : "bg-blue-400"}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${themeClasses.headingText}`}>Completed</p>
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDateTime(selectedRequest.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* Actions Section */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-300 dark:border-slate-600">
                {(selectedRequest.status === "REQUESTED" || selectedRequest.status === "PROPOSED_TIME") && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={actionLoading[selectedRequest.id]}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                    >
                      {actionLoading[selectedRequest.id] ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleProposeClick(selectedRequest.id)}
                      disabled={actionLoading[selectedRequest.id]}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
                      }`}
                    >
                      {actionLoading[selectedRequest.id] ? "..." : "Propose new time"}
                    </button>
                    <button
                      onClick={() => setShowDeclineConfirm(selectedRequest.id)}
                      disabled={actionLoading[selectedRequest.id]}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                      }`}
                    >
                      {actionLoading[selectedRequest.id] ? "..." : "Decline"}
                    </button>
                  </>
                )}
                {selectedRequest.status === "APPROVED" && (
                  <>
                    <button
                      onClick={() => handleCompleteClick(selectedRequest.id)}
                      disabled={actionLoading[selectedRequest.id]}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {actionLoading[selectedRequest.id] ? "..." : "Mark Complete"}
                    </button>
                    {settings?.bookingKey && (
                      <a
                        href={`/api/obd-scheduler/calendar/ics?bookingKey=${encodeURIComponent(settings.bookingKey)}&requestId=${encodeURIComponent(selectedRequest.id)}&mode=confirmed`}
                        download
                        className={`px-4 py-2 rounded text-sm font-medium ${
                          isDark ? "bg-slate-600 hover:bg-slate-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                      >
                        Download calendar (.ics)
                      </a>
                    )}
                  </>
                )}
                {(selectedRequest.status === "COMPLETED" || selectedRequest.status === "DECLINED") && (
                  <>
                    {archivedIds.has(selectedRequest.id) ? (
                      <button
                        onClick={() => unarchiveRequest(selectedRequest.id)}
                        className={`px-4 py-2 rounded text-sm font-medium ${
                          isDark ? "bg-slate-600 hover:bg-slate-500 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                        aria-label="Unarchive request"
                      >
                        Unarchive
                      </button>
                    ) : (
                      <button
                        onClick={() => archiveRequest(selectedRequest.id)}
                        className={`px-4 py-2 rounded text-sm font-medium ${
                          isDark ? "bg-slate-600 hover:bg-slate-500 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                        aria-label="Archive request"
                      >
                        Archive
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={async () => {
                    await updateRequestStatus(selectedRequest.id, {
                      internalNotes: selectedRequest.internalNotes || null,
                    });
                  }}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  Save Notes
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-modal-title"
        >
          <div
            ref={modalRefs.service}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="service-modal-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                {editingService ? "Edit Service" : "Add Service"}
              </h3>
              <button
                onClick={() => {
                  setShowServiceModal(false);
                  setEditingService(null);
                }}
                className={themeClasses.mutedText}
                aria-label="Close service modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Service Name *
                </label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className={getInputClasses(isDark)}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  value={serviceForm.durationMinutes}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, durationMinutes: parseInt(e.target.value) || 0 })
                  }
                  className={getInputClasses(isDark)}
                  min="1"
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Description
                </label>
                <textarea
                  value={serviceForm.description || ""}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  rows={3}
                  className={getInputClasses(isDark, "resize-none")}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                  className="rounded"
                />
                <label className={themeClasses.labelText}>Active</label>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  onClick={saveService} 
                  disabled={savingService}
                  className={`${SUBMIT_BUTTON_CLASSES} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {savingService 
                    ? "Saving..." 
                    : editingService ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowServiceModal(false);
                    setEditingService(null);
                  }}
                  className={`px-4 py-2 rounded ${isDark ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-700"}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Propose New Time Modal */}
      {showProposeModal && proposingRequestId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="propose-modal-title"
        >
          <div
            ref={modalRefs.propose}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="propose-modal-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Propose New Time
              </h3>
              <button
                onClick={() => {
                  setShowProposeModal(false);
                  setProposingRequestId(null);
                  setProposeForm({ proposedStart: "", proposedEnd: "", internalNotes: "" });
                  setProposeErrors({});
                }}
                className={themeClasses.mutedText}
                aria-label="Close propose time modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Proposed Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={proposeForm.proposedStart}
                  onChange={(e) => {
                    setProposeForm({ ...proposeForm, proposedStart: e.target.value });
                    if (proposeErrors.proposedStart) {
                      setProposeErrors({ ...proposeErrors, proposedStart: "" });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  required
                />
                {proposeErrors.proposedStart && (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {proposeErrors.proposedStart}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Proposed End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={proposeForm.proposedEnd}
                  onChange={(e) => {
                    setProposeForm({ ...proposeForm, proposedEnd: e.target.value });
                    if (proposeErrors.proposedEnd) {
                      setProposeErrors({ ...proposeErrors, proposedEnd: "" });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  required
                />
                {proposeErrors.proposedEnd && (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {proposeErrors.proposedEnd}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Internal Notes (Optional)
                </label>
                <textarea
                  value={proposeForm.internalNotes}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 2000) {
                      setProposeForm({ ...proposeForm, internalNotes: value });
                      if (proposeErrors.internalNotes) {
                        setProposeErrors({ ...proposeErrors, internalNotes: "" });
                      }
                    }
                  }}
                  rows={4}
                  className={getInputClasses(isDark, "resize-none")}
                  placeholder="Add any notes about this proposal..."
                  maxLength={2000}
                />
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  {proposeForm.internalNotes.length}/2000 characters
                </p>
                {proposeErrors.internalNotes && (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {proposeErrors.internalNotes}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowProposeModal(false);
                    setProposingRequestId(null);
                    setProposeForm({ proposedStart: "", proposedEnd: "", internalNotes: "" });
                    setProposeErrors({});
                  }}
                  className={`flex-1 px-4 py-2 rounded font-medium ${
                    isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleProposeSubmit}
                  disabled={actionLoading[proposingRequestId] || false}
                  className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-amber-500 hover:bg-amber-600 text-white"
                  }`}
                >
                  {actionLoading[proposingRequestId] ? "Submitting..." : "Propose Time"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decline Confirmation Dialog */}
      {showDeclineConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decline-modal-title"
        >
          <div
            ref={modalRefs.decline}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <h3 id="decline-modal-title" className={`text-lg font-semibold mb-4 ${themeClasses.headingText}`}>
              Confirm Decline
            </h3>
            <p className={`mb-6 ${themeClasses.mutedText}`}>
              Are you sure you want to decline this request?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeclineConfirm(null)}
                className={`flex-1 px-4 py-2 rounded font-medium ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleDecline(showDeclineConfirm);
                }}
                disabled={actionLoading[showDeclineConfirm] || false}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                {actionLoading[showDeclineConfirm] ? "Declining..." : "Yes, Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Decline Confirmation Dialog */}
      {showBulkDeclineConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-decline-modal-title"
        >
          <div
            ref={modalRefs.bulkDecline}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <h3 id="bulk-decline-modal-title" className={`text-lg font-semibold mb-4 ${themeClasses.headingText}`}>
              Confirm Bulk Decline
            </h3>
            <p className={`mb-6 ${themeClasses.mutedText}`}>
              Are you sure you want to decline {selectedRequestIds.size} selected request{selectedRequestIds.size !== 1 ? "s" : ""}?
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowBulkDeclineConfirm(false);
                }}
                disabled={bulkDeclineLoading}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDecline}
                disabled={bulkDeclineLoading || !hasEligibleSelection}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                title={
                  !hasEligibleSelection
                    ? "All selected requests are already declined"
                    : bulkDeclineLoading
                    ? "Declining requests..."
                    : undefined
                }
              >
                {bulkDeclineLoading ? "Declining..." : `Yes, Decline ${selectedRequestIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Complete Confirmation Modal */}
      {showCompleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-modal-title"
        >
          <div
            ref={modalRefs.complete}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <h3 id="complete-modal-title" className={`text-lg font-semibold mb-4 ${themeClasses.headingText}`}>
              Mark as complete?
            </h3>
            <p className={`mb-4 ${themeClasses.mutedText}`}>
              This will mark the booking as completed. You can add an optional internal note below.
            </p>
            
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Internal Notes (Optional)
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 2000) {
                    setCompleteNotes(value);
                    if (completeErrors.completeNotes) {
                      setCompleteErrors({ ...completeErrors, completeNotes: "" });
                    }
                  }
                }}
                rows={4}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Add any notes about completion..."
                maxLength={2000}
              />
              <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {completeNotes.length}/2000 characters
              </p>
              {completeErrors.completeNotes && (
                <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                  {completeErrors.completeNotes}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCompleteModal(null);
                  setCompleteNotes("");
                  setCompleteErrors({});
                }}
                disabled={actionLoading[showCompleteModal] || false}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteSubmit}
                disabled={actionLoading[showCompleteModal] || false}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {actionLoading[showCompleteModal] ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}

export default function OBDSchedulerPage() {
  return (
    <ErrorBoundary
      fallbackTitle="Something went wrong"
      fallbackMessage="We encountered an error loading the scheduler dashboard. Please try again."
      showHomeLink={true}
      homeLinkHref="/apps/obd-scheduler"
      homeLinkText="Back to Dashboard"
    >
      <OBDSchedulerPageContent />
    </ErrorBoundary>
  );
}

