"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CheckCircle2, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDToast from "@/components/obd/OBDToast";
import type { OBDToastItem, OBDToastType } from "@/components/obd/toastTypes";
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
  BookingRequestAuditLog,
  SchedulerMetrics,
  MetricsRange,
  SchedulerBusyBlock,
  CreateBusyBlockRequest,
  SchedulerCalendarConnection,
  CalendarIntegrationStatusResponse,
} from "@/lib/apps/obd-scheduler/types";
import { BookingStatus, BookingMode } from "@/lib/apps/obd-scheduler/types";
import { assertNever } from "@/lib/dev/assertNever";

type SchedulerTab = "requests" | "services" | "availability" | "branding" | "settings" | "metrics" | "verification" | "calendar";
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

  // Requests tab state (needed for storage key prefix)
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  
  // P2-10: Generate storage key prefix from businessId (extracted from requests)
  // Since all requests belong to the same business, we use the first request's businessId
  const getStorageKeyPrefix = (): string => {
    if (requests.length > 0 && requests[0].businessId) {
      // Use businessId as namespace prefix
      return `obd:scheduler:${requests[0].businessId}:`;
    }
    // Fallback to default prefix if no requests loaded yet (migration will happen on first load)
    return "obd:scheduler:";
  };

  // P2-10: Helper to migrate old localStorage keys to namespaced keys
  const migrateStorageKey = (oldKey: string, newKey: string, setter: (value: string) => void, validator?: (value: string) => boolean) => {
    try {
      const oldValue = localStorage.getItem(oldKey);
      const newValue = localStorage.getItem(newKey);
      
      // If new key exists, use it
      if (newValue !== null) {
        if (validator && validator(newValue)) {
          setter(newValue);
        } else if (!validator) {
          setter(newValue);
        }
        return;
      }
      
      // If old key exists and new key doesn't, migrate it
      if (oldValue !== null) {
        if (validator && validator(oldValue)) {
          localStorage.setItem(newKey, oldValue);
          setter(oldValue);
          // Optionally remove old key after migration (commented out for safety)
          // localStorage.removeItem(oldKey);
        } else if (!validator) {
          localStorage.setItem(newKey, oldValue);
          setter(oldValue);
        }
      }
    } catch (error) {
      console.warn(`[Storage Migration] Error migrating ${oldKey} to ${newKey}:`, error);
    }
  };

  // Load verification auto-run preference from localStorage
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    const savedAutoRun = localStorage.getItem(`${prefix}verification:autoRun`);
    if (savedAutoRun === "true") {
      setVerificationAutoRun(true);
    }
  }, [requests]);

  // Load theme, activeTab, and activeView from localStorage after hydration
  // P2-10: These keys will be migrated to namespaced keys when requests load
  useEffect(() => {
    const savedTheme = localStorage.getItem("obd:scheduler:theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
    
    const savedTab = localStorage.getItem("obd:scheduler:activeTab");
    if (savedTab === "requests" || savedTab === "services" || savedTab === "availability" || savedTab === "branding" || savedTab === "settings" || savedTab === "metrics" || savedTab === "verification" || savedTab === "calendar") {
      setActiveTab(savedTab as SchedulerTab);
    }
    
    const savedView = localStorage.getItem("obd:scheduler:activeView");
    if (savedView === "needs-action" || savedView === "upcoming" || savedView === "past-due" || savedView === "completed" || savedView === "declined" || savedView === "all") {
      setActiveView(savedView as RequestView);
    }
  }, []);

  // P2-10: Save activeTab to namespaced localStorage key
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      localStorage.setItem(`${prefix}activeTab`, activeTab);
    } catch {
      // Ignore storage errors
    }
  }, [activeTab, requests]);

  // P2-10: Save theme to namespaced localStorage key
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      localStorage.setItem(`${prefix}theme`, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme, requests]);

  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [showRequestDetail, setShowRequestDetail] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [isPilotMode, setIsPilotMode] = useState<boolean>(false);
  // Initialize activeView with consistent default (fixes hydration mismatch)
  // Will be updated from localStorage in useEffect after hydration
  const [activeView, setActiveView] = useState<RequestView>("needs-action");
  const [sortBy, setSortBy] = useState<RequestSort>("newest-first");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // P2-4: Load sortBy from localStorage after hydration
  useEffect(() => {
    try {
      const savedSortBy = localStorage.getItem("obd:scheduler:sortBy");
      if (savedSortBy && ["newest-first", "oldest-first", "soonest-appointment", "recently-updated"].includes(savedSortBy)) {
        setSortBy(savedSortBy as RequestSort);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // P2-10: Save activeView to namespaced localStorage key
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      localStorage.setItem(`${prefix}activeView`, activeView);
    } catch {
      // Ignore storage errors
    }
  }, [activeView, requests]);

  // P2-4/P2-10: Save sortBy to namespaced localStorage key
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      localStorage.setItem(`${prefix}sortBy`, sortBy);
    } catch {
      // Ignore storage errors
    }
  }, [sortBy, requests]);

  // Reset to page 1 when filters/sort/showArchived changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeView, showArchived, sortBy]);

  // P2-10: Load archived IDs from namespaced localStorage key
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      const savedArchived = localStorage.getItem(`${prefix}archivedIds`);
      if (savedArchived) {
        const ids = JSON.parse(savedArchived) as string[];
        if (Array.isArray(ids)) {
          setArchivedIds(new Set(ids));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [requests]);

  // P2-10: Save archived IDs to namespaced localStorage key
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      localStorage.setItem(`${prefix}archivedIds`, JSON.stringify(Array.from(archivedIds)));
    } catch {
      // Ignore storage errors
    }
  }, [archivedIds, requests]);

  // P1-6/P2-10: Cross-tab sync for archive state and activeView/sortBy (using namespaced keys)
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    
    const handleStorageChange = (e: StorageEvent) => {
      // Only react to changes from other tabs/windows for namespaced keys
      if (e.key === `${prefix}archivedIds` && e.newValue) {
        try {
          const ids = JSON.parse(e.newValue) as string[];
          if (Array.isArray(ids)) {
            setArchivedIds(new Set(ids));
          }
        } catch {
          // Ignore parse errors
        }
      } else if (e.key === `${prefix}activeView` && e.newValue) {
        if (["needs-action", "upcoming", "past-due", "completed", "declined", "all"].includes(e.newValue)) {
          setActiveView(e.newValue as RequestView);
        }
      } else if (e.key === `${prefix}sortBy` && e.newValue) {
        if (["newest-first", "oldest-first", "soonest-appointment", "recently-updated"].includes(e.newValue)) {
          setSortBy(e.newValue as RequestSort);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [requests]);

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
  const [showReactivateConfirm, setShowReactivateConfirm] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeErrors, setCompleteErrors] = useState<Record<string, string>>({});
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<BookingRequestAuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
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
  // Public link state
  const [publicLink, setPublicLink] = useState<{
    code: string;
    slug: string | null;
    shortUrl: string;
    prettyUrl: string | null;
  } | null>(null);
  const [publicLinkSlug, setPublicLinkSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [publicLinkLoading, setPublicLinkLoading] = useState(false);
  const [publicLinkError, setPublicLinkError] = useState("");

  // Availability tab state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityWindows, setAvailabilityWindows] = useState<Omit<AvailabilityWindow, "id" | "businessId" | "createdAt" | "updatedAt">[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<Omit<AvailabilityException, "id" | "businessId" | "createdAt" | "updatedAt">[]>([]);
  
  // Phase 3A: Busy blocks state
  const [busyBlocks, setBusyBlocks] = useState<SchedulerBusyBlock[]>([]);
  const [busyBlocksLoading, setBusyBlocksLoading] = useState(false);
  const [busyBlocksError, setBusyBlocksError] = useState("");
  const [showBusyBlockModal, setShowBusyBlockModal] = useState(false);
  const [busyBlockForm, setBusyBlockForm] = useState<CreateBusyBlockRequest>({
    start: "",
    end: "",
    reason: "",
  });
  const [busyBlockErrors, setBusyBlockErrors] = useState<Record<string, string>>({});
  const [deletingBusyBlockId, setDeletingBusyBlockId] = useState<string | null>(null);

  // Branding tab state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bookingTheme, setBookingTheme] = useState<BookingTheme | null>(null);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState("");

  // Metrics tab state
  const [metrics, setMetrics] = useState<SchedulerMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [metricsRange, setMetricsRange] = useState<MetricsRange>("30d");

  // Verification tab state
  const [verificationChecks, setVerificationChecks] = useState<Array<{
    name: string;
    status: "pass" | "fail";
    message: string;
    details?: string;
    timestamp: string;
  }>>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationTimestamp, setVerificationTimestamp] = useState<string>("");
  const [verificationAutoRun, setVerificationAutoRun] = useState(false);

  // Calendar tab state
  const [calendarConnections, setCalendarConnections] = useState<Array<{
    provider: string;
    accountEmail: string | null;
    enabled: boolean;
    expiresAt: string;
    isExpired: boolean;
    expiresSoon: boolean;
    needsReconnect: boolean;
  }>>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  
  // Phase 3B: Calendar Integration status (V3.1)
  const [calendarIntegration, setCalendarIntegration] = useState<CalendarIntegrationStatusResponse | null>(null);
  const [calendarIntegrationLoading, setCalendarIntegrationLoading] = useState(false);
  const [calendarIntegrationError, setCalendarIntegrationError] = useState("");
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  
  // Golden Flow checklist state (client-only, not persisted)
  const [goldenFlowChecklist, setGoldenFlowChecklist] = useState<Record<string, boolean>>({
    "submit-booking-request": false,
    "approve-request-email": false,
    "decline-request-email": false,
    "reactivate-request": false,
    "history-modal-audit": false,
    "metrics-reflect-activity": false,
  });
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

  // Toast queue state - P1-23: Standardized toast structure
  const [toasts, setToasts] = useState<OBDToastItem[]>([]);

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
    reactivate: useRef<HTMLDivElement>(null),
    history: useRef<HTMLDivElement>(null),
    busyBlock: useRef<HTMLDivElement>(null),
  };

  // Focus trap and restoration for modals
  useEffect(() => {
    const anyModalOpen = showProposeModal || showServiceModal || showBulkDeclineConfirm || showCompleteModal || showDeclineConfirm || showReactivateConfirm || showHistoryModal;
    
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
          (showDeclineConfirm && modalRefs.decline.current) ||
          (showReactivateConfirm && modalRefs.reactivate.current) ||
          (showHistoryModal && modalRefs.history.current) ||
          (showBusyBlockModal && modalRefs.busyBlock.current);
        
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
  }, [showProposeModal, showServiceModal, showBulkDeclineConfirm, showCompleteModal, showDeclineConfirm, showReactivateConfirm, showHistoryModal]);

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
        } else if (showReactivateConfirm) {
          setShowReactivateConfirm(null);
        } else if (showHistoryModal) {
          setShowHistoryModal(null);
          setAuditLogs([]);
        } else if (showBusyBlockModal) {
          setShowBusyBlockModal(false);
          setBusyBlockForm({ start: "", end: "", reason: "" });
          setBusyBlockErrors({});
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showProposeModal, showServiceModal, showBulkDeclineConfirm, showCompleteModal, showDeclineConfirm, showReactivateConfirm, showHistoryModal]);

  // P2-10: Persist theme to namespaced localStorage key (duplicate for backward compat, will be removed)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefix = getStorageKeyPrefix();
      try {
        localStorage.setItem(`${prefix}theme`, theme);
      } catch {
        // Ignore storage errors
      }
    }
  }, [theme, requests]);

  // P2-10: Persist activeTab to namespaced localStorage key (duplicate for backward compat, will be removed)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefix = getStorageKeyPrefix();
      try {
        localStorage.setItem(`${prefix}activeTab`, activeTab);
      } catch {
        // Ignore storage errors
      }
    }
  }, [activeTab, requests]);

  // Check pilot mode status (one-time check on mount)
  useEffect(() => {
    const checkPilotMode = async () => {
      try {
        const res = await fetch("/api/obd-scheduler/health");
        if (res.ok) {
          const data = await res.json();
          if (data.pilotMode !== undefined) {
            setIsPilotMode(data.pilotMode === true);
          }
        }
      } catch {
        // Silently fail - default to false
      }
    };
    checkPilotMode();
  }, []);

  // Load requests (fetch all, filtering done client-side)
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const res = await fetch(`/api/obd-scheduler/requests`);
      
      // Handle network/fetch errors
      if (!res.ok && res.status >= 500) {
        // Only show error for server errors (database connection, etc.)
        const errorText = await res.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: "Database connection error", code: "DATABASE_ERROR" };
        }
        throw new Error(errorData.error || "Database connection error. Please try again.");
      }
      
      const data = await res.json();
      
      // Only show error for actual database failures, not empty states
      if (!data.ok) {
        const errorMessage = data.error || "";
        const errorCode = data.code || "";
        
        // Handle PILOT_ONLY error (403) - show pilot message and stop loading
        if (errorCode === "PILOT_ONLY" || res.status === 403) {
          setRequestsError("PILOT_ONLY");
          setRequests([]);
          return;
        }
        
        // Only show error if it's a database/connection issue (500+ status or DATABASE_ERROR code)
        if (
          res.status >= 500 ||
          errorCode === "DATABASE_ERROR" ||
          errorCode === "DATABASE_CONNECTION_ERROR" ||
          errorCode === "DATABASE_MODEL_ERROR" ||
          errorMessage.toLowerCase().includes("database") ||
          errorMessage.toLowerCase().includes("connection")
        ) {
          throw new Error(errorMessage || "Database error. Please try again.");
        }
        // For other errors (auth, validation, etc.), log but don't show banner
        console.warn("[OBD Scheduler] Requests load error (non-database):", errorMessage);
        // Set empty array as fallback
        setRequests([]);
        return;
      }
      
      // Empty array is valid - never treat as error
      const loadedRequests = data.data?.requests || [];
      setRequests(loadedRequests);
      
      // P2-10: Migrate localStorage keys to namespaced keys after requests load
      if (loadedRequests.length > 0 && loadedRequests[0].businessId) {
        const prefix = `obd:scheduler:${loadedRequests[0].businessId}:`;
        
        // Migrate theme
        migrateStorageKey(
          "obd:scheduler:theme",
          `${prefix}theme`,
          (value) => {
            if (value === "dark" || value === "light") setTheme(value);
          },
          (value) => value === "dark" || value === "light"
        );
        
        // Migrate activeTab
        migrateStorageKey(
          "obd:scheduler:activeTab",
          `${prefix}activeTab`,
          (value) => {
            if (["requests", "services", "availability", "branding", "settings"].includes(value)) {
              setActiveTab(value as SchedulerTab);
            }
          },
          (value) => ["requests", "services", "availability", "branding", "settings"].includes(value)
        );
        
        // Migrate activeView
        migrateStorageKey(
          "obd:scheduler:activeView",
          `${prefix}activeView`,
          (value) => {
            if (["needs-action", "upcoming", "past-due", "completed", "declined", "all"].includes(value)) {
              setActiveView(value as RequestView);
            }
          },
          (value) => ["needs-action", "upcoming", "past-due", "completed", "declined", "all"].includes(value)
        );
        
        // Migrate sortBy
        migrateStorageKey(
          "obd:scheduler:sortBy",
          `${prefix}sortBy`,
          (value) => {
            if (["newest-first", "oldest-first", "soonest-appointment", "recently-updated"].includes(value)) {
              setSortBy(value as RequestSort);
            }
          },
          (value) => ["newest-first", "oldest-first", "soonest-appointment", "recently-updated"].includes(value)
        );
        
        // Migrate archivedIds
        migrateStorageKey(
          "obd:scheduler:archivedIds",
          `${prefix}archivedIds`,
          (value) => {
            try {
              const ids = JSON.parse(value) as string[];
              if (Array.isArray(ids)) {
                setArchivedIds(new Set(ids));
              }
            } catch {
              // Ignore parse errors
            }
          },
          (value) => {
            try {
              JSON.parse(value);
              return true;
            } catch {
              return false;
            }
          }
        );
      }
    } catch (error) {
      console.error("Error loading requests:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load requests";
      
      // Only set error for database-related failures
      if (
        errorMessage.toLowerCase().includes("database") ||
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("prisma")
      ) {
        setRequestsError(errorMessage);
      } else {
        // For non-database errors, log but don't show banner
        console.warn("[OBD Scheduler] Requests load error (non-database):", errorMessage);
        setRequestsError("");
        // Set empty array as fallback
        setRequests([]);
      }
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
      const settingsRes = await fetch("/api/obd-scheduler/settings");
      
      // Parse response
      let settingsData;
      try {
        settingsData = await settingsRes.json();
      } catch (parseError) {
        // If JSON parsing fails, it's likely a network/server error
        const errorText = await settingsRes.text().catch(() => "Unknown error");
        throw new Error(`Failed to parse response: ${errorText}`);
      }
      
      // Handle error responses based on error code
      if (!settingsData.ok) {
        const errorCode = settingsData.code || "UNKNOWN_ERROR";
        const errorMessage = settingsData.error || "Failed to load settings";
        
        // Only show red banner for actual database failures
        if (
          errorCode === "DATABASE_ERROR" ||
          errorCode === "DATABASE_CONNECTION_ERROR" ||
          errorCode === "DATABASE_MODEL_ERROR" ||
          errorCode === "PRISMA_CLIENT_OUTDATED" ||
          settingsRes.status >= 500
        ) {
          // Real database failure - show error banner
          setSettingsError(errorMessage);
          console.error("Settings load failed (database error):", errorCode, errorMessage);
          return;
        } else if (errorCode === "UNAUTHORIZED") {
          // Auth failure - show user-friendly message but not red banner
          console.warn("Settings load failed (unauthorized):", errorMessage);
          setSettingsError("");
          // Could show a toast notification here if needed
          return;
        } else if (errorCode === "VALIDATION_ERROR") {
          // Validation failure - log but don't show red banner
          console.warn("Settings load failed (validation):", errorMessage);
          setSettingsError("");
          return;
        } else {
          // Other errors - log but don't show red banner
          console.warn("Settings load failed (other):", errorCode, errorMessage);
          setSettingsError("");
          return;
        }
      }
      
      // Success - load settings
      const loadedSettings = settingsData.data;
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
      // Network errors or unexpected errors - only show if likely database-related
      const errorMessage = error instanceof Error ? error.message : "Failed to load settings";
      // Check if it's a database-related error by message content
      if (
        errorMessage.toLowerCase().includes("database") || 
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("prisma")
      ) {
        setSettingsError(errorMessage);
      } else {
        // For network/other errors, log but don't show red banner
        console.warn("Settings load error (non-database):", errorMessage);
        setSettingsError("");
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  // Load public link (separate from settings to avoid breaking settings if this fails)
  const loadPublicLink = async () => {
    setPublicLinkLoading(true);
    setPublicLinkError("");
    try {
      const res = await fetch("/api/obd-scheduler/public-link");
      
      // Handle network/fetch errors
      if (!res.ok && res.status >= 500) {
        // Only show error for server errors (database connection, etc.)
        const errorText = await res.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: "Database connection error", code: "DATABASE_ERROR" };
        }
        throw new Error(errorData.error || "Database connection error. Please try again.");
      }
      
      const data = await res.json();
      
      // Only show error for actual database failures, not missing data
      if (!data.ok) {
        const errorMessage = data.error || "";
        const errorCode = data.code || "";
        
        // Only show error if it's a database/connection issue (500+ status or DATABASE_ERROR code)
        if (
          res.status >= 500 ||
          errorCode === "DATABASE_ERROR" ||
          errorCode === "DATABASE_CONNECTION_ERROR" ||
          errorCode === "DATABASE_MODEL_ERROR" ||
          errorMessage.toLowerCase().includes("database") ||
          errorMessage.toLowerCase().includes("connection")
        ) {
          throw new Error(errorMessage || "Database error. Please try again.");
        }
        // For other errors (auth, validation, etc.), log but don't show banner
        console.warn("[OBD Scheduler] Public link load error (non-database):", errorMessage);
        setPublicLinkError("");
        return;
      }
      
      // Success - set the link data
      setPublicLink({
        code: data.data.code,
        slug: data.data.slug,
        shortUrl: data.data.shortUrl,
        prettyUrl: data.data.prettyUrl,
      });
      setPublicLinkSlug(data.data.slug || "");
    } catch (error) {
      console.error("Error loading public link:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load public link";
      
      // Only set error for database-related failures
      if (
        errorMessage.toLowerCase().includes("database") ||
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("prisma")
      ) {
        setPublicLinkError(errorMessage);
      } else {
        // For non-database errors, log but don't show banner
        console.warn("[OBD Scheduler] Public link load error (non-database):", errorMessage);
        setPublicLinkError("");
      }
    } finally {
      setPublicLinkLoading(false);
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

  // Phase 3A: Load busy blocks
  const loadBusyBlocks = async () => {
    setBusyBlocksLoading(true);
    setBusyBlocksError("");
    try {
      const res = await fetch("/api/obd-scheduler/busy-blocks");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load busy blocks");
      }
      setBusyBlocks(data.data || []);
    } catch (error) {
      console.error("Error loading busy blocks:", error);
      setBusyBlocksError(error instanceof Error ? error.message : "Failed to load busy blocks");
    } finally {
      setBusyBlocksLoading(false);
    }
  };

  // Phase 3A: Create busy block
  const createBusyBlock = async () => {
    setBusyBlockErrors({});
    
    // Validation
    const errors: Record<string, string> = {};
    if (!busyBlockForm.start) {
      errors.start = "Start time is required";
    }
    if (!busyBlockForm.end) {
      errors.end = "End time is required";
    }
    if (busyBlockForm.start && busyBlockForm.end) {
      const startDate = new Date(busyBlockForm.start);
      const endDate = new Date(busyBlockForm.end);
      if (endDate <= startDate) {
        errors.end = "End time must be after start time";
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setBusyBlockErrors(errors);
      return;
    }

    try {
      const res = await fetch("/api/obd-scheduler/busy-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(busyBlockForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create busy block");
      }
      showNotification("Blocked time added successfully");
      setShowBusyBlockModal(false);
      setBusyBlockForm({ start: "", end: "", reason: "" });
      await loadBusyBlocks();
    } catch (error) {
      console.error("Error creating busy block:", error);
      showNotification(error instanceof Error ? error.message : "Failed to create busy block", "error");
    }
  };

  // Phase 3A: Delete busy block
  const deleteBusyBlock = async (blockId: string) => {
    if (!confirm("Are you sure you want to remove this blocked time?")) {
      return;
    }
    
    setDeletingBusyBlockId(blockId);
    try {
      const res = await fetch(`/api/obd-scheduler/busy-blocks/${blockId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete busy block");
      }
      showNotification("Blocked time removed");
      await loadBusyBlocks();
    } catch (error) {
      console.error("Error deleting busy block:", error);
      showNotification(error instanceof Error ? error.message : "Failed to delete busy block", "error");
    } finally {
      setDeletingBusyBlockId(null);
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
      loadBusyBlocks();
    } else if (activeTab === "branding") {
      loadTheme();
    } else if (activeTab === "settings") {
      loadSettings();
      loadPublicLink();
    } else if (activeTab === "metrics") {
      // Metrics are loaded via useEffect when tab is active
      // No initial load needed here
    } else if (activeTab === "verification") {
      // Verification tab loads its own data
      // No initial load needed here
    } else if (activeTab === "calendar") {
      // Calendar tab loads its own data via useEffect
      loadCalendarIntegrationStatus();
    } else {
      assertNever(activeTab, "Unhandled tab case");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadRequests]);

  // P1-23: Notification helper - adds to toast queue with standardized structure
  const showNotification = (message: string, type: OBDToastType = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    const createdAt = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, message, type, createdAt }]); // Keep max 3 toasts
    
    // Auto-dismiss after 3 seconds (or 5 seconds for info/warning)
    const dismissDelay = type === "info" || type === "warning" ? 5000 : 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, dismissDelay);
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
    action: "approve" | "propose" | "decline" | "complete" | "reactivate",
    actionData?: { proposedStart?: string; proposedEnd?: string; internalNotes?: string | null }
  ) => {
    // Prevent double submits
    if (actionLoading[requestId]) return;
    
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));

    // P1-5: Optimistic update - store previous state for rollback
    const previousRequest = requests.find((r) => r.id === requestId);
    if (!previousRequest) {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      return;
    }

    // P1-5: Optimistically update state based on action (only for status-changing actions)
    if (action !== "propose") {
      let optimisticStatus: BookingStatus;
      if (action === "approve") {
        optimisticStatus = BookingStatus.APPROVED;
      } else if (action === "decline") {
        optimisticStatus = BookingStatus.DECLINED;
      } else if (action === "reactivate") {
        optimisticStatus = BookingStatus.REQUESTED;
      } else {
        optimisticStatus = BookingStatus.COMPLETED; // complete
      }

      const optimisticRequest: BookingRequest = {
        ...previousRequest,
        status: optimisticStatus,
        updatedAt: new Date().toISOString(),
      };
      setRequests((prev) => prev.map((r) => (r.id === requestId ? optimisticRequest : r)));
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(optimisticRequest);
      }
    }

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

      // Update request in local state with server response
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
      } else if (action === "reactivate") {
        showNotification("Request reactivated", "success");
      }

      // Close modals
      setShowProposeModal(false);
      setProposingRequestId(null);
      setProposeForm({ proposedStart: "", proposedEnd: "", internalNotes: "" });
      setProposeErrors({});
      setShowDeclineConfirm(null);
    } catch (error) {
      // P1-5: Revert optimistic update on error
      setRequests((prev) => prev.map((r) => (r.id === requestId ? previousRequest : r)));
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(previousRequest);
      }

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

  // Handle reactivate action
  const handleReactivate = async (requestId: string) => {
    await performRequestAction(requestId, "reactivate");
    setShowReactivateConfirm(null);
  };

  // Fetch audit log for a request
  const fetchAuditLog = async (requestId: string) => {
    setAuditLogsLoading(true);
    try {
      const res = await fetch(`/api/obd-scheduler/requests/${requestId}/audit`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to fetch audit log");
      }
      setAuditLogs(data.data as BookingRequestAuditLog[]);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      showNotification(
        error instanceof Error ? error.message : "Failed to fetch audit log",
        "error"
      );
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Handle history button click
  const handleHistoryClick = (requestId: string) => {
    setShowHistoryModal(requestId);
    fetchAuditLog(requestId);
  };

  // Fetch metrics
  const fetchMetrics = async (range: MetricsRange) => {
    setMetricsLoading(true);
    setMetricsError("");
    try {
      const res = await fetch(`/api/obd-scheduler/metrics?range=${range}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to fetch metrics");
      }
      setMetrics(data.data as SchedulerMetrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      setMetricsError(
        error instanceof Error ? error.message : "Failed to fetch metrics"
      );
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Load metrics when tab is active or range changes
  useEffect(() => {
    if (activeTab === "metrics") {
      fetchMetrics(metricsRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, metricsRange]);

  // Run verification checks function (extracted for reuse)
  const runVerificationChecks = async () => {
    setVerificationLoading(true);
    setVerificationError("");
    setVerificationChecks([]);
    try {
      const res = await fetch("/api/obd-scheduler/verification");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to run verification checks");
      }
      setVerificationChecks(data.data.checks || []);
      setVerificationTimestamp(data.data.timestamp || "");
    } catch (error) {
      console.error("Error running verification:", error);
      setVerificationError(error instanceof Error ? error.message : "Failed to run verification checks");
    } finally {
      setVerificationLoading(false);
    }
  };

  // Auto-run verification checks when tab opens (if enabled)
  useEffect(() => {
    if (activeTab === "verification" && verificationAutoRun && verificationChecks.length === 0 && !verificationLoading) {
      runVerificationChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, verificationAutoRun]);

  // Save verification auto-run preference to localStorage
  useEffect(() => {
    const prefix = getStorageKeyPrefix();
    try {
      localStorage.setItem(`${prefix}verification:autoRun`, verificationAutoRun ? "true" : "false");
    } catch {
      // Ignore storage errors
    }
  }, [verificationAutoRun, requests]);

  // Calendar tab handlers
  const loadCalendarConnections = async () => {
    setCalendarLoading(true);
    setCalendarError("");
    try {
      const res = await fetch("/api/obd-scheduler/calendar/status");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load calendar connections");
      }
      setCalendarConnections(data.data.connections || []);
    } catch (error) {
      console.error("Error loading calendar connections:", error);
      setCalendarError(error instanceof Error ? error.message : "Failed to load calendar connections");
    } finally {
      setCalendarLoading(false);
    }
  };

  // Helper function to determine Google Calendar connection state
  const getGoogleCalendarState = (): "NOT_CONNECTED" | "CONNECTED_ENABLED" | "CONNECTED_DISABLED" | "ERROR_ATTENTION" => {
    const googleConnection = calendarConnections.find(c => c.provider === "google");
    
    if (!googleConnection) {
      return "NOT_CONNECTED";
    }
    
    // Check for error conditions (needsReconnect indicates auth/token issues)
    // Only consider calendarError if there's actually a connection (to avoid false positives)
    if (googleConnection.needsReconnect || (calendarError && googleConnection)) {
      return "ERROR_ATTENTION";
    }
    
    // Check if filtering is enabled
    if (googleConnection.enabled) {
      return "CONNECTED_ENABLED";
    }
    
    return "CONNECTED_DISABLED";
  };

  // Load calendar connections when tab is active
  useEffect(() => {
    if (activeTab === "calendar") {
      loadCalendarConnections();
      loadCalendarIntegrationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Phase 3B: Load calendar integration status
  const loadCalendarIntegrationStatus = async () => {
    setCalendarIntegrationLoading(true);
    setCalendarIntegrationError("");
    try {
      const res = await fetch("/api/obd-scheduler/calendar/status");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load calendar integration status");
      }
      setCalendarIntegration(data.data as CalendarIntegrationStatusResponse);
    } catch (error) {
      console.error("Error loading calendar integration status:", error);
      setCalendarIntegrationError(error instanceof Error ? error.message : "Failed to load calendar integration status");
    } finally {
      setCalendarIntegrationLoading(false);
    }
  };

  // Phase 3B: Handle calendar connect (stub)
  const handleCalendarConnect = async (provider: "google") => {
    if (!calendarIntegration?.canConnect) {
      showNotification("Calendar OAuth is not configured", "error");
      return;
    }

    try {
      const res = await fetch("/api/obd-scheduler/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to initiate calendar connection");
      }
      // TODO: Handle OAuth redirect when implemented
      showNotification("Calendar connection not yet implemented", "info");
    } catch (error) {
      console.error("Error connecting calendar:", error);
      showNotification(error instanceof Error ? error.message : "Failed to connect calendar", "error");
    }
  };

  // Phase 3B: Handle calendar sync (stub)
  const handleCalendarSync = async (provider: "google" = "google") => {
    setSyncingCalendar(true);
    try {
      const res = await fetch("/api/obd-scheduler/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to sync calendar");
      }
      // TODO: Handle sync success when implemented
      showNotification("Calendar sync not yet implemented", "info");
      await loadCalendarIntegrationStatus();
    } catch (error) {
      console.error("Error syncing calendar:", error);
      showNotification(error instanceof Error ? error.message : "Failed to sync calendar", "error");
    } finally {
      setSyncingCalendar(false);
    }
  };

  // Handle OAuth callback URL parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const calendarParam = params.get("calendar");
      const providerParam = params.get("provider");
      const messageParam = params.get("message");

      if (calendarParam === "connected" && providerParam) {
        showNotification(`${providerParam === "google" ? "Google" : "Microsoft"} calendar connected successfully`, "success");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        // Reload connections
        if (activeTab === "calendar") {
          loadCalendarConnections();
        }
      } else if (calendarParam === "error" && messageParam) {
        showNotification(`Calendar connection error: ${decodeURIComponent(messageParam)}`, "error");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle calendar toggle
  const handleCalendarToggle = async (provider: "google" | "microsoft", enabled: boolean) => {
    try {
      const res = await fetch("/api/obd-scheduler/calendar/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to toggle calendar");
      }
      await loadCalendarConnections();
      showNotification(`${provider === "google" ? "Google" : "Microsoft"} calendar ${enabled ? "enabled" : "disabled"}`, "success");
    } catch (error) {
      console.error("Error toggling calendar:", error);
      showNotification(error instanceof Error ? error.message : "Failed to toggle calendar", "error");
    }
  };

  // Handle calendar disconnect
  const handleCalendarDisconnect = async (provider: "google" | "microsoft") => {
    if (!confirm(`Are you sure you want to disconnect your ${provider === "google" ? "Google" : "Microsoft"} calendar?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/obd-scheduler/calendar/disconnect?provider=${provider}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to disconnect calendar");
      }
      await loadCalendarConnections();
      showNotification(`${provider === "google" ? "Google" : "Microsoft"} calendar disconnected`, "success");
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      showNotification(error instanceof Error ? error.message : "Failed to disconnect calendar", "error");
    }
  };

  // Copy debug bundle to clipboard
  const copyDebugBundle = async () => {
    try {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        route: typeof window !== "undefined" ? window.location.href : "unknown",
        verificationResults: verificationChecks.map(check => ({
          name: check.name,
          status: check.status,
          message: check.message,
          details: check.details,
          timestamp: check.timestamp,
        })),
        failingChecks: verificationChecks
          .filter(check => check.status === "fail")
          .map(check => ({
            name: check.name,
            endpoint: `/api/obd-scheduler/verification`,
            status: "fail",
            message: check.message,
            details: check.details,
          })),
        tenantIdentifier: requests.length > 0 && requests[0].businessId 
          ? `businessId:${requests[0].businessId.substring(0, 8)}...` 
          : "unknown",
        buildInfo: {
          commitSha: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA as string | undefined)
            ? (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA as string).substring(0, 7)
            : "unknown",
        },
      };

      const debugText = JSON.stringify(debugInfo, null, 2);
      await navigator.clipboard.writeText(debugText);
      showNotification("Debug bundle copied to clipboard", "success");
    } catch (error) {
      console.error("Error copying debug bundle:", error);
      showNotification("Failed to copy debug bundle", "error");
    }
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
    // P1-4: Collect failed requests with error details
    const failedRequests: Array<{ id: string; customerName: string; error: string }> = [];

    try {
      // Decline each request sequentially using existing single-decline logic
      for (const requestId of eligibleIds) {
        try {
          await performRequestAction(requestId, "decline");
          declinedCount++;
        } catch (error) {
          console.error(`Error declining request ${requestId}:`, error);
          errorCount++;
          // P1-4: Collect failed request details
          const request = requests.find((r) => r.id === requestId);
          const customerName = request?.customerName || "Unknown";
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          failedRequests.push({ id: requestId, customerName, error: errorMessage });
          // Continue with next request even if one fails
        }
      }

      // P1-4: Show detailed notification with failed request info
      const parts: string[] = [];
      if (declinedCount > 0) {
        parts.push(`Declined ${declinedCount} request${declinedCount !== 1 ? "s" : ""}`);
      }
      if (skippedCount > 0) {
        parts.push(`skipped ${skippedCount} already declined`);
      }
      if (errorCount > 0) {
        parts.push(`${errorCount} failed`);
        // P1-4: Add details about failed requests (compact format)
        if (failedRequests.length > 0) {
          const failedDetails = failedRequests.slice(0, 3).map((f) => {
            // Show customer name and short error (truncate if needed)
            const shortError = f.error.length > 30 ? f.error.substring(0, 27) + "..." : f.error;
            return `${f.customerName}: ${shortError}`;
          }).join("; ");
          const moreText = failedRequests.length > 3 ? ` (and ${failedRequests.length - 3} more)` : "";
          parts.push(`Failed: ${failedDetails}${moreText}`);
        }
      }

      if (declinedCount > 0) {
        showNotification(parts.join(". "), errorCount > 0 ? "error" : "success");
      } else {
        showNotification(parts.join(". "), "error");
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

  // Save slug for public link
  const saveSlug = async () => {
    if (savingSlug) return;
    
    // Validate slug client-side
    const trimmedSlug = publicLinkSlug.trim();
    if (trimmedSlug && !/^[a-z0-9-]+$/.test(trimmedSlug)) {
      showNotification("Slug must contain only lowercase letters, numbers, and hyphens", "error");
      return;
    }
    if (trimmedSlug && trimmedSlug.length < 2) {
      showNotification("Slug must be at least 2 characters long", "error");
      return;
    }
    
    setSavingSlug(true);
    try {
      const res = await fetch("/api/obd-scheduler/public-link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: trimmedSlug || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save custom URL");
      }
      await loadPublicLink(); // Reload to get updated public link
      showNotification("Custom URL saved successfully");
    } catch (error) {
      console.error("Error saving slug:", error);
      showNotification(error instanceof Error ? error.message : "Failed to save custom URL", "error");
    } finally {
      setSavingSlug(false);
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

  // P1-18/P2-3: CSV Export (non-blocking with chunked processing)
  const exportToCSV = async () => {
    if (sortedRequests.length === 0) {
      showNotification("No requests to export", "error");
      return;
    }

    // Show progress notification
    const progressToastId = `csv-export-${Date.now()}`;
    showNotification("Preparing CSV...", "info");

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

    try {
      // P1-18/P2-3: Process rows in chunks to avoid blocking UI
      const CHUNK_SIZE = 100; // Process 100 rows at a time
      const totalRows = sortedRequests.length;
      const rows: string[] = [];

      // Process chunks asynchronously
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = sortedRequests.slice(i, i + CHUNK_SIZE);
        
        // Process chunk
        const chunkRows = chunk.map((request) => {
          return [
            escapeCSVField(request.customerName),
            escapeCSVField(request.customerEmail),
            escapeCSVField(request.customerPhone),
            escapeCSVField(request.service?.name || ""),
            escapeCSVField(request.status),
            formatDateForCSV(request.preferredStart),
            formatDateForCSV(request.proposedStart),
            formatDateForCSV(request.createdAt),
          ].join(",");
        });
        
        rows.push(...chunkRows);

        // Yield to browser between chunks
        if (i + CHUNK_SIZE < totalRows) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Combine header and rows
      const csvContent = [
        headers.join(","),
        ...rows,
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

      showNotification(`Exported ${totalRows} request(s) to CSV`, "success");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      showNotification("Export failed. Please try again.", "error");
    }
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

  // P2-11: Memoize computed selection values to avoid unnecessary re-renders
  const visibleSelectableRequests = useMemo(() => {
    return paginatedRequests.filter((r) => r.status !== "DECLINED");
  }, [paginatedRequests]);

  const selectedVisibleCount = useMemo(() => {
    return visibleSelectableRequests.filter((r) => selectedRequestIds.has(r.id)).length;
  }, [visibleSelectableRequests, selectedRequestIds]);

  const allVisibleSelected = useMemo(() => {
    return visibleSelectableRequests.length > 0 && selectedVisibleCount === visibleSelectableRequests.length;
  }, [visibleSelectableRequests.length, selectedVisibleCount]);

  const someVisibleSelected = useMemo(() => {
    return selectedVisibleCount > 0 && selectedVisibleCount < visibleSelectableRequests.length;
  }, [selectedVisibleCount, visibleSelectableRequests.length]);

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
      <OBDPanel isDark={isDark} className="mb-6">
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
            { id: "metrics" as SchedulerTab, label: "Metrics" },
            { id: "verification" as SchedulerTab, label: "Verification" },
            { id: "calendar" as SchedulerTab, label: "Calendar" },
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

      {/* Pilot Mode Message */}
      {requestsError === "PILOT_ONLY" && (
        <OBDPanel isDark={isDark} className="mb-6">
          <div className={`rounded-xl border p-6 text-center ${
            isDark 
              ? "border-slate-700 bg-slate-800/50 text-slate-100" 
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}>
            <h2 className={`text-lg font-semibold mb-2 ${themeClasses.headingText}`}>
              Scheduler is in pilot rollout
            </h2>
            <p className={themeClasses.mutedText}>
              Your account will be enabled soon. If you need access immediately, please contact support.
            </p>
          </div>
        </OBDPanel>
      )}

      {/* V1 Scope Banner */}
      {requestsError !== "PILOT_ONLY" && (
        <OBDPanel isDark={isDark} className="mb-6">
          <div className={`rounded-lg border p-4 ${
            isDark 
              ? "border-slate-700 bg-slate-800/30 text-slate-200" 
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}>
            <h3 className={`text-sm font-semibold mb-1 ${themeClasses.headingText}`}>
              Scheduler V1
            </h3>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              Includes request + instant booking, service selection, and availability windows. Coming soon: calendar sync, SMS, and payments.
              {isPilotMode && " Pilot rollout is in progress."}
            </p>
          </div>
        </OBDPanel>
      )}

      {/* Requests Tab */}
      {activeTab === "requests" && requestsError !== "PILOT_ONLY" && (
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
      {activeTab === "services" && requestsError !== "PILOT_ONLY" && (
        <OBDPanel isDark={isDark}>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
            <OBDHeading level={2} isDark={isDark}>Services</OBDHeading>
            <button
              onClick={() => {
                setEditingService(null);
                setServiceForm({ name: "", durationMinutes: 60, description: "", active: true });
                setShowServiceModal(true);
              }}
              className={`w-full md:w-auto px-4 py-2 bg-[#29c4a9] text-white text-sm font-medium rounded-lg hover:bg-[#22ad93] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "shadow-[#29c4a9]/10" : ""}`}
            >
              Add a Service
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
      {activeTab === "availability" && requestsError !== "PILOT_ONLY" && (
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

              {/* Phase 3A: Blocked Time Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>Blocked Time</h3>
                  <button
                    onClick={() => {
                      setBusyBlockForm({ start: "", end: "", reason: "" });
                      setBusyBlockErrors({});
                      setShowBusyBlockModal(true);
                    }}
                    className={`px-4 py-2 text-sm rounded font-medium transition-colors ${SUBMIT_BUTTON_CLASSES}`}
                  >
                    Add Blocked Time
                  </button>
                </div>
                <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
                  Manually block specific date/time ranges to prevent bookings. These blocks will be excluded from available slots.
                </p>

                {busyBlocksError && (
                  <div className={getErrorPanelClasses(isDark)}>
                    <p>{busyBlocksError}</p>
                  </div>
                )}

                {busyBlocksLoading ? (
                  <p className={themeClasses.mutedText}>Loading blocked time...</p>
                ) : busyBlocks.length === 0 ? (
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    No blocked time periods. Click "Add Blocked Time" to block specific date/time ranges.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {busyBlocks
                      .filter((block) => new Date(block.end) >= new Date()) // Only show future/present blocks
                      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                      .map((block) => {
                        const startDate = new Date(block.start);
                        const endDate = new Date(block.end);
                        const startStr = startDate.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        });
                        const endStr = endDate.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        });
                        
                        return (
                          <div
                            key={block.id}
                            className={`flex items-start justify-between p-3 rounded border ${
                              isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium ${themeClasses.headingText}`}>
                                {startStr} - {endStr}
                              </div>
                              {block.reason && (
                                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                                  {block.reason}
                                </div>
                              )}
                              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                                {block.source === "manual" ? "Manual block" : `From ${block.source}`}
                              </div>
                            </div>
                            {block.source === "manual" && (
                              <button
                                onClick={() => deleteBusyBlock(block.id)}
                                disabled={deletingBusyBlockId === block.id}
                                className={`ml-4 px-3 py-1 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isDark
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : "bg-red-500 hover:bg-red-600 text-white"
                                }`}
                              >
                                {deletingBusyBlockId === block.id ? "Removing..." : "Remove"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
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
      {activeTab === "branding" && requestsError !== "PILOT_ONLY" && (
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
      {activeTab === "settings" && requestsError !== "PILOT_ONLY" && (
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
                        Customers can book instantly when slots are available. Connect Google Calendar in the Calendar tab to hide unavailable times.
                      </p>
                    </label>
                  </div>
                </div>
              </div>

              {/* Calendar Integration Info */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Calendar Integration</h3>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm mb-2 ${themeClasses.mutedText}`}>
                    Connect your Google Calendar to automatically hide unavailable times in booking slots.
                  </p>
                  <button
                    onClick={() => setActiveTab("calendar")}
                    className={`text-sm underline ${isDark ? "text-[#29c4a9] hover:text-[#22ad93]" : "text-[#29c4a9] hover:text-[#22ad93]"}`}
                  >
                    Go to Calendar tab to connect →
                  </button>
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
                    <>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Public Booking Link
                        </label>
                        
                        {publicLinkLoading ? (
                          <div className={`p-3 rounded ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
                            <p className={`text-sm ${themeClasses.mutedText}`}>Loading booking link...</p>
                          </div>
                        ) : publicLinkError ? (
                          <div className="mb-2">
                            <div className={`p-2 rounded border ${isDark ? "bg-red-900/20 border-red-700 text-red-400" : "bg-red-50 border-red-200 text-red-600"} text-sm`}>
                              {publicLinkError}
                            </div>
                            {settings.bookingKey && (
                              <div className="mt-2">
                                <p className={`text-xs ${themeClasses.mutedText} mb-2`}>Using legacy booking link:</p>
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
                              </div>
                            )}
                          </div>
                        ) : publicLink ? (
                          <>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={publicLink.shortUrl}
                                className={getInputClasses(isDark)}
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(publicLink.shortUrl);
                                  showNotification("Link copied to clipboard!");
                                }}
                                className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                aria-label="Copy booking link"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => {
                                  window.open(publicLink.shortUrl, "_blank", "noopener,noreferrer");
                                }}
                                className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                              >
                                Test Link
                              </button>
                            </div>
                            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                              Share this link with customers to allow them to submit booking requests.
                            </p>
                          </>
                        ) : settings.bookingKey ? (
                          <>
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
                          </>
                        ) : null}

                        {publicLink?.prettyUrl && (
                          <div className="mt-4">
                            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Pretty Link (Optional)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={publicLink.prettyUrl}
                                className={getInputClasses(isDark)}
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(publicLink.prettyUrl!);
                                  showNotification("Pretty link copied to clipboard!");
                                }}
                                className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                aria-label="Copy pretty link"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => {
                                  window.open(publicLink.prettyUrl!, "_blank", "noopener,noreferrer");
                                }}
                                className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                              >
                                Test Link
                              </button>
                            </div>
                          </div>
                        )}

                        {publicLink && (
                          <div className="mt-4">
                            <label htmlFor="public-link-slug" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                              Custom Booking URL (Optional)
                            </label>
                            <div className="flex gap-2">
                              <input
                                id="public-link-slug"
                                type="text"
                                value={publicLinkSlug}
                                onChange={(e) => setPublicLinkSlug(e.target.value)}
                                placeholder="my-business-name"
                                className={getInputClasses(isDark)}
                                maxLength={50}
                              />
                              <button
                                onClick={saveSlug}
                                disabled={savingSlug || publicLinkSlug === (publicLink.slug || "")}
                                className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {savingSlug ? "Saving..." : "Save"}
                              </button>
                            </div>
                            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                              Use letters, numbers, and hyphens only (e.g., &quot;my-business-name&quot;). Leave empty to remove custom URL.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
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

      {/* ===== TAB: METRICS (start) ===== */}
      {activeTab === "metrics" && requestsError !== "PILOT_ONLY" && (
        <OBDPanel isDark={isDark}>
          <div className="flex items-center justify-between mb-6" data-testid="metrics-container">
            <OBDHeading level={2} isDark={isDark}>Business Metrics</OBDHeading>
            <div className="flex items-center gap-2">
              <label className={`text-sm ${themeClasses.mutedText}`}>Range:</label>
              <select
                value={metricsRange}
                onChange={(e) => setMetricsRange(e.target.value as MetricsRange)}
                className={getInputClasses(isDark, "text-sm")}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>

          {metricsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{metricsError}</p>
            </div>
          )}

          {metricsLoading ? (
            <div className="py-8 text-center">
              <p className={themeClasses.mutedText}>Loading metrics...</p>
            </div>
          ) : metrics ? (
            <div className="space-y-6">
              {/* Headline Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm ${themeClasses.mutedText} mb-1`}>Total Requests</p>
                  <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{metrics.totalRequests}</p>
                </div>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm ${themeClasses.mutedText} mb-1`}>Conversion Rate</p>
                  <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{metrics.conversionRate.toFixed(1)}%</p>
                </div>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm ${themeClasses.mutedText} mb-1`}>Approved</p>
                  <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{metrics.requestsByStatus.APPROVED || 0}</p>
                </div>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm ${themeClasses.mutedText} mb-1`}>Declined</p>
                  <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{metrics.requestsByStatus.DECLINED || 0}</p>
                </div>
              </div>

              {/* Response Times */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm font-medium mb-2 ${themeClasses.headingText}`}>Median Time to First Response</p>
                  <p className={`text-xl ${themeClasses.mutedText}`}>
                    {metrics.medianTimeToFirstResponse !== null 
                      ? `${metrics.medianTimeToFirstResponse} minutes`
                      : "N/A"}
                  </p>
                </div>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm font-medium mb-2 ${themeClasses.headingText}`}>Median Time to Approval</p>
                  <p className={`text-xl ${themeClasses.mutedText}`}>
                    {metrics.medianTimeToApproval !== null 
                      ? `${metrics.medianTimeToApproval} minutes`
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Status Breakdown */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Requests by Status</h3>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="space-y-2">
                    {Object.entries(metrics.requestsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className={`text-sm ${themeClasses.mutedText}`}>{status}</span>
                        <span className={`text-sm font-medium ${themeClasses.headingText}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Service Popularity */}
              {metrics.servicePopularity.length > 0 && (
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Service Popularity</h3>
                  <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <div className="space-y-2">
                      {metrics.servicePopularity.slice(0, 5).map((service: { serviceId: string; serviceName: string; count: number }) => {
                        const maxCount = metrics.servicePopularity[0]?.count || 1;
                        const percentage = (service.count / maxCount) * 100;
                        return (
                          <div key={service.serviceId}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm ${themeClasses.mutedText}`}>{service.serviceName}</span>
                              <span className={`text-sm font-medium ${themeClasses.headingText}`}>{service.count}</span>
                            </div>
                            <div className={`h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                              <div
                                className={`h-full rounded-full ${isDark ? "bg-[#29c4a9]" : "bg-[#29c4a9]"}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Peak Hours Chart */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Peak Hours</h3>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="grid grid-cols-12 gap-1">
                    {metrics.peakHours.map(({ hour, count }: { hour: number; count: number }) => {
                      const maxCount = Math.max(...metrics.peakHours.map((h: { hour: number; count: number }) => h.count), 1);
                      const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={hour} className="flex flex-col items-center">
                          <div className={`w-full rounded-t ${isDark ? "bg-[#29c4a9]" : "bg-[#29c4a9]"}`} style={{ height: `${Math.max(height, 5)}%`, minHeight: "4px" }} />
                          <span className={`text-xs mt-1 ${themeClasses.mutedText}`}>{hour}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Peak Days Chart */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>Peak Days</h3>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="space-y-2">
                    {metrics.peakDays.map(({ day, dayName, count }: { day: number; dayName: string; count: number }) => {
                      const maxCount = Math.max(...metrics.peakDays.map((d: { day: number; dayName: string; count: number }) => d.count), 1);
                      const percentage = (count / maxCount) * 100;
                      return (
                        <div key={day}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm ${themeClasses.mutedText}`}>{dayName}</span>
                            <span className={`text-sm font-medium ${themeClasses.headingText}`}>{count}</span>
                          </div>
                          <div className={`h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                            <div
                              className={`h-full rounded-full ${isDark ? "bg-[#29c4a9]" : "bg-[#29c4a9]"}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm font-medium mb-1 ${themeClasses.headingText}`}>Cancellations</p>
                  <p className={`text-2xl font-bold ${themeClasses.mutedText}`}>{metrics.cancellationCount}</p>
                </div>
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-sm font-medium mb-1 ${themeClasses.headingText}`}>Reactivations</p>
                  <p className={`text-2xl font-bold ${themeClasses.mutedText}`}>{metrics.reactivateCount}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className={themeClasses.mutedText}>No metrics available for this period.</p>
            </div>
          )}
        </OBDPanel>
      )}
      {/* ===== TAB: METRICS (end) ===== */}

      {/* ===== TAB: VERIFICATION (start) ===== */}
      {activeTab === "verification" && requestsError !== "PILOT_ONLY" && (
        <>
          <OBDPanel isDark={isDark} className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <OBDHeading level={2} isDark={isDark}>Production Verification</OBDHeading>
              <div className="flex items-center gap-3">
                <label className={`flex items-center gap-2 text-sm ${themeClasses.mutedText}`}>
                  <input
                    type="checkbox"
                    checked={verificationAutoRun}
                    onChange={(e) => setVerificationAutoRun(e.target.checked)}
                    className={getInputClasses(isDark, "w-4 h-4")}
                  />
                  Auto-run on open
                </label>
                <button
                  onClick={runVerificationChecks}
                  disabled={verificationLoading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {verificationLoading ? "Running Checks..." : "Run Checks"}
                </button>
              </div>
            </div>

          {verificationError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{verificationError}</p>
            </div>
          )}

          {verificationLoading ? (
            <div className="py-8 text-center">
              <p className={themeClasses.mutedText}>Running verification checks...</p>
            </div>
          ) : verificationChecks.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                {verificationTimestamp && (
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    Last run: {new Date(verificationTimestamp).toLocaleString()}
                  </p>
                )}
                <button
                  onClick={copyDebugBundle}
                  className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 hover:bg-slate-600 text-white"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  }`}
                >
                  Copy Debug Bundle
                </button>
              </div>
              {verificationChecks.map((check, index) => (
                <div
                  key={index}
                  className={`p-4 rounded border ${
                    check.status === "pass"
                      ? isDark
                        ? "bg-green-900/20 border-green-700"
                        : "bg-green-50 border-green-200"
                      : isDark
                      ? "bg-red-900/20 border-red-700"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      check.status === "pass"
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                    }`}>
                      {check.status === "pass" ? "✓" : "✗"}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold mb-1 ${
                        check.status === "pass"
                          ? isDark ? "text-green-300" : "text-green-700"
                          : isDark ? "text-red-300" : "text-red-700"
                      }`}>
                        {check.name}
                      </h3>
                      <p className={`text-sm mb-1 ${
                        check.status === "pass"
                          ? isDark ? "text-green-200" : "text-green-600"
                          : isDark ? "text-red-200" : "text-red-600"
                      }`}>
                        {check.message}
                      </p>
                      {check.details && (
                        <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                          {check.details}
                        </p>
                      )}
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        {new Date(check.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className={themeClasses.mutedText}>
                Click &quot;Run Checks&quot; to verify your production setup.
              </p>
              <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
                All checks are read-only and will not modify any data.
              </p>
            </div>
          )}
        </OBDPanel>

        {/* Golden Flow (Manual) Checklist */}
        <OBDPanel isDark={isDark} className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>Golden Flow (Manual)</OBDHeading>
            <button
              onClick={() => {
                setGoldenFlowChecklist({
                  "submit-booking-request": false,
                  "approve-request-email": false,
                  "decline-request-email": false,
                  "reactivate-request": false,
                  "history-modal-audit": false,
                  "metrics-reflect-activity": false,
                });
              }}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                isDark
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              Reset Checklist
            </button>
          </div>
          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
            Manually verify the complete booking flow. Check off each step as you complete it.
          </p>
          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              goldenFlowChecklist["submit-booking-request"]
                ? isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                : isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}>
              <input
                type="checkbox"
                checked={goldenFlowChecklist["submit-booking-request"]}
                onChange={(e) => setGoldenFlowChecklist({ ...goldenFlowChecklist, "submit-booking-request": e.target.checked })}
                className={getInputClasses(isDark, "w-5 h-5 mt-0.5")}
              />
              <div className="flex-1">
                <p className={`font-medium ${themeClasses.headingText}`}>Submit booking request (public)</p>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Submit a booking request through the public booking page
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              goldenFlowChecklist["approve-request-email"]
                ? isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                : isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}>
              <input
                type="checkbox"
                checked={goldenFlowChecklist["approve-request-email"]}
                onChange={(e) => setGoldenFlowChecklist({ ...goldenFlowChecklist, "approve-request-email": e.target.checked })}
                className={getInputClasses(isDark, "w-5 h-5 mt-0.5")}
              />
              <div className="flex-1">
                <p className={`font-medium ${themeClasses.headingText}`}>Approve request → confirmation email received</p>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Approve a request and verify the customer receives a confirmation email
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              goldenFlowChecklist["decline-request-email"]
                ? isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                : isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}>
              <input
                type="checkbox"
                checked={goldenFlowChecklist["decline-request-email"]}
                onChange={(e) => setGoldenFlowChecklist({ ...goldenFlowChecklist, "decline-request-email": e.target.checked })}
                className={getInputClasses(isDark, "w-5 h-5 mt-0.5")}
              />
              <div className="flex-1">
                <p className={`font-medium ${themeClasses.headingText}`}>Decline request → decline email received</p>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Decline a request and verify the customer receives a decline email
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              goldenFlowChecklist["reactivate-request"]
                ? isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                : isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}>
              <input
                type="checkbox"
                checked={goldenFlowChecklist["reactivate-request"]}
                onChange={(e) => setGoldenFlowChecklist({ ...goldenFlowChecklist, "reactivate-request": e.target.checked })}
                className={getInputClasses(isDark, "w-5 h-5 mt-0.5")}
              />
              <div className="flex-1">
                <p className={`font-medium ${themeClasses.headingText}`}>Reactivate request</p>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Reactivate a declined request and verify it returns to pending status
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              goldenFlowChecklist["history-modal-audit"]
                ? isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                : isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}>
              <input
                type="checkbox"
                checked={goldenFlowChecklist["history-modal-audit"]}
                onChange={(e) => setGoldenFlowChecklist({ ...goldenFlowChecklist, "history-modal-audit": e.target.checked })}
                className={getInputClasses(isDark, "w-5 h-5 mt-0.5")}
              />
              <div className="flex-1">
                <p className={`font-medium ${themeClasses.headingText}`}>History modal shows audit trail entries</p>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Open the history modal for a request and verify audit trail entries are displayed
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              goldenFlowChecklist["metrics-reflect-activity"]
                ? isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
                : isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}>
              <input
                type="checkbox"
                checked={goldenFlowChecklist["metrics-reflect-activity"]}
                onChange={(e) => setGoldenFlowChecklist({ ...goldenFlowChecklist, "metrics-reflect-activity": e.target.checked })}
                className={getInputClasses(isDark, "w-5 h-5 mt-0.5")}
              />
              <div className="flex-1">
                <p className={`font-medium ${themeClasses.headingText}`}>Metrics tab reflects the test activity</p>
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Navigate to the Metrics tab and verify the test activity is reflected in the metrics
                </p>
              </div>
            </label>
          </div>
        </OBDPanel>
        </>
      )}
      {/* ===== TAB: VERIFICATION (end) ===== */}

      {/* ===== TAB: CALENDAR (start) ===== */}
      {activeTab === "calendar" && requestsError !== "PILOT_ONLY" && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark}>Calendar Integration</OBDHeading>
          
          {calendarLoading ? (
            <div className="py-8 text-center">
              <p className={themeClasses.mutedText}>Loading calendar connections...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Phase 3B: Calendar Sync Status Panel */}
              <div className={`p-4 rounded border ${
                isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>
                      Calendar Sync (Coming Soon)
                    </h3>
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      Automatically sync busy times from your Google Calendar to block booking slots.
                    </p>
                  </div>
                </div>

                {calendarIntegrationLoading ? (
                  <p className={themeClasses.mutedText}>Loading sync status...</p>
                ) : calendarIntegrationError ? (
                  <div className={getErrorPanelClasses(isDark)}>
                    <p>{calendarIntegrationError}</p>
                  </div>
                ) : calendarIntegration ? (
                  <div className="space-y-4">
                    {/* Status Display */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${themeClasses.labelText}`}>Status:</span>
                        <span className={`text-sm px-2 py-1 rounded ${
                          calendarIntegration.integration?.status === "connected"
                            ? isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-700"
                            : calendarIntegration.integration?.status === "error"
                            ? isDark ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-700"
                            : isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                        }`}>
                          {calendarIntegration.integration?.status === "connected" ? "Connected" :
                           calendarIntegration.integration?.status === "error" ? "Error" : "Disabled"}
                        </span>
                      </div>
                      
                      {calendarIntegration.integration?.lastSyncAt && (
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${themeClasses.labelText}`}>Last Sync:</span>
                          <span className={`text-sm ${themeClasses.mutedText}`}>
                            {new Date(calendarIntegration.integration.lastSyncAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {calendarIntegration.integration?.errorMessage && (
                        <div className={`text-sm p-2 rounded ${
                          isDark ? "bg-red-900/20 text-red-300" : "bg-red-50 text-red-700"
                        }`}>
                          {calendarIntegration.integration.errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Connect Button */}
                    {!calendarIntegration.oauthConfigured ? (
                      <div className={`text-sm p-3 rounded ${
                        isDark ? "bg-amber-900/20 border border-amber-700 text-amber-300" : "bg-amber-50 border border-amber-200 text-amber-700"
                      }`}>
                        ⚠️ Calendar OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.
                      </div>
                    ) : calendarIntegration.canConnect ? (
                      <button
                        onClick={() => handleCalendarConnect("google")}
                        disabled={true} // Disabled until OAuth is wired
                        className={`w-full px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          SUBMIT_BUTTON_CLASSES
                        }`}
                        title="OAuth flow will be wired in next step"
                      >
                        Connect Google Calendar
                      </button>
                    ) : calendarIntegration.integration?.status === "connected" ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleCalendarSync("google")}
                          disabled={syncingCalendar || true} // Disabled until sync is implemented
                          className={`w-full px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            SUBMIT_BUTTON_CLASSES
                          }`}
                          title="Sync logic will be implemented in next step"
                        >
                          {syncingCalendar ? "Syncing..." : "Sync Now"}
                        </button>
                        <p className={`text-xs text-center ${themeClasses.mutedText}`}>
                          Sync logic coming soon. This will create busy blocks from your Google Calendar events.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Status Card */}
              {(() => {
                const googleState = getGoogleCalendarState();
                
                let statusIcon, statusTitle, statusSubtext, statusCardClasses;
                
                switch (googleState) {
                  case "NOT_CONNECTED":
                    statusIcon = <CalendarIcon className="w-5 h-5" />;
                    statusTitle = "Not connected";
                    statusSubtext = "Connect Google Calendar to check availability against busy times.";
                    statusCardClasses = isDark 
                      ? "bg-slate-800/50 border-slate-700" 
                      : "bg-slate-50 border-slate-200";
                    break;
                  case "CONNECTED_ENABLED":
                    statusIcon = <CheckCircle2 className="w-5 h-5 text-green-500" />;
                    statusTitle = "Connected • Availability filtering enabled";
                    statusSubtext = "Busy times will be blocked from available booking slots.";
                    statusCardClasses = isDark 
                      ? "bg-slate-800/50 border-slate-700 border-green-500/30" 
                      : "bg-slate-50 border-slate-200 border-green-500/30";
                    break;
                  case "CONNECTED_DISABLED":
                    statusIcon = <CheckCircle2 className="w-5 h-5 text-blue-500" />;
                    statusTitle = "Connected • Filtering is off";
                    statusSubtext = "Calendar is connected, but not used to filter availability.";
                    statusCardClasses = isDark 
                      ? "bg-slate-800/50 border-slate-700 border-blue-500/30" 
                      : "bg-slate-50 border-slate-200 border-blue-500/30";
                    break;
                  case "ERROR_ATTENTION":
                    statusIcon = <AlertCircle className="w-5 h-5 text-amber-500" />;
                    statusTitle = "Needs attention";
                    statusSubtext = "We can't currently check calendar availability. Booking will still work normally.";
                    statusCardClasses = isDark 
                      ? "bg-slate-800/50 border-slate-700 border-amber-500/30" 
                      : "bg-slate-50 border-slate-200 border-amber-500/30";
                    break;
                }
                
                return (
                  <div className={`p-4 rounded border ${statusCardClasses}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {statusIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>
                          {statusTitle}
                        </h3>
                        <p className={`text-sm ${themeClasses.mutedText}`}>
                          {statusSubtext}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Account Section (only show if connected) */}
              {(() => {
                const googleConnection = calendarConnections.find(c => c.provider === "google");
                if (!googleConnection) return null;
                
                return (
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Connected Google account
                      </label>
                      <p className={`text-sm ${themeClasses.mutedText}`}>
                        {googleConnection.accountEmail || (
                          <span className="italic">(email unavailable)</span>
                        )}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Read-only access
                      </div>
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        OBD only checks busy/free times. Event titles and details are never accessed.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Google Calendar Controls */}
              <div className="space-y-4">
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>Google Calendar</h3>
                    </div>
                    {calendarConnections.find(c => c.provider === "google") ? (
                      <button
                        onClick={() => handleCalendarDisconnect("google")}
                        className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                          isDark
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-red-500 hover:bg-red-600 text-white"
                        }`}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <a
                        href="/api/obd-scheduler/calendar/connect/google"
                        className={`px-4 py-2 text-sm rounded font-medium transition-colors ${SUBMIT_BUTTON_CLASSES}`}
                      >
                        Connect
                      </a>
                    )}
                  </div>
                  
                  {(() => {
                    const googleConnection = calendarConnections.find(c => c.provider === "google");
                    
                    if (!googleConnection) {
                      return (
                        <p className={`text-sm ${themeClasses.mutedText}`}>
                          Connect Google Calendar to enable availability filtering.
                        </p>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        <label className={`flex items-start gap-3 text-sm ${themeClasses.mutedText}`}>
                          <input
                            type="checkbox"
                            checked={googleConnection.enabled || false}
                            onChange={(e) => handleCalendarToggle("google", e.target.checked)}
                            className={`mt-0.5 ${getInputClasses(isDark, "w-4 h-4")}`}
                            disabled={googleConnection.needsReconnect || false}
                          />
                          <div className="flex-1">
                            <span className={themeClasses.labelText}>Use Google Calendar to filter availability</span>
                            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                              {googleConnection.enabled 
                                ? "When enabled, OBD hides slots that overlap busy times."
                                : "Turn this on to hide slots that overlap busy times."}
                            </p>
                          </div>
                        </label>
                      </div>
                    );
                  })()}
                </div>

                {/* Microsoft Calendar Card (keep existing for compatibility) */}
                <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>Microsoft Outlook / 365</h3>
                      {calendarConnections.find(c => c.provider === "microsoft")?.accountEmail && (
                        <p className={`text-sm ${themeClasses.mutedText}`}>
                          {calendarConnections.find(c => c.provider === "microsoft")?.accountEmail}
                        </p>
                      )}
                    </div>
                    {calendarConnections.find(c => c.provider === "microsoft") ? (
                      <button
                        onClick={() => handleCalendarDisconnect("microsoft")}
                        className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                          isDark
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-red-500 hover:bg-red-600 text-white"
                        }`}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <a
                        href="/api/obd-scheduler/calendar/connect/microsoft"
                        className={`px-4 py-2 text-sm rounded font-medium transition-colors ${SUBMIT_BUTTON_CLASSES}`}
                      >
                        Connect
                      </a>
                    )}
                  </div>
                  {calendarConnections.find(c => c.provider === "microsoft") && (
                    <div className="space-y-2">
                      {calendarConnections.find(c => c.provider === "microsoft")?.needsReconnect && (
                        <p className={`text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          ⚠️ Token expired or expiring soon. Please reconnect.
                        </p>
                      )}
                      <label className={`flex items-center gap-2 text-sm ${themeClasses.mutedText}`}>
                        <input
                          type="checkbox"
                          checked={calendarConnections.find(c => c.provider === "microsoft")?.enabled || false}
                          onChange={(e) => handleCalendarToggle("microsoft", e.target.checked)}
                          className={getInputClasses(isDark, "w-4 h-4")}
                          disabled={calendarConnections.find(c => c.provider === "microsoft")?.needsReconnect || false}
                        />
                        Hide unavailable times using calendar
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* How it works section */}
              <div className={`pt-4 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                <h4 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>
                  How availability filtering works
                </h4>
                <div className={`text-sm space-y-1 ${themeClasses.mutedText}`}>
                  <p>When enabled, OBD checks your Google Calendar for busy times before showing slots.</p>
                  <p>If Google is unavailable, booking still works normally.</p>
                </div>
              </div>
            </div>
          )}
        </OBDPanel>
      )}
      {/* ===== TAB: CALENDAR (end) ===== */}

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
                {selectedRequest.status === "DECLINED" && (
                  <>
                    <button
                      onClick={() => setShowReactivateConfirm(selectedRequest.id)}
                      disabled={actionLoading[selectedRequest.id]}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                    >
                      {actionLoading[selectedRequest.id] ? "..." : "Reactivate"}
                    </button>
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
                {selectedRequest.status === "COMPLETED" && (
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
                <button
                  onClick={() => handleHistoryClick(selectedRequest.id)}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  History
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

      {/* Reactivate Confirmation Dialog */}
      {showReactivateConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reactivate-modal-title"
        >
          <div
            ref={modalRefs.reactivate}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <h3 id="reactivate-modal-title" className={`text-lg font-semibold mb-4 ${themeClasses.headingText}`}>
              Confirm Reactivate
            </h3>
            <p className={`mb-6 ${themeClasses.mutedText}`}>
              Reactivate this request and return it to Pending?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReactivateConfirm(null)}
                className={`flex-1 px-4 py-2 rounded font-medium ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleReactivate(showReactivateConfirm);
                }}
                disabled={actionLoading[showReactivateConfirm] || false}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                {actionLoading[showReactivateConfirm] ? "Reactivating..." : "Yes, Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div
            ref={modalRefs.history}
            className={`rounded-xl border p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="history-modal-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Request History
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(null);
                  setAuditLogs([]);
                }}
                className={themeClasses.mutedText}
                aria-label="Close history modal"
              >
                ✕
              </button>
            </div>
            {auditLogsLoading ? (
              <div className={`py-8 text-center ${themeClasses.mutedText}`}>Loading history...</div>
            ) : auditLogs.length === 0 ? (
              <div className={`py-8 text-center ${themeClasses.mutedText}`}>No history available</div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedDate = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedTime = date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                  const actorName = log.actorUserId ? "Staff" : "System";
                  const actionLabel = log.action.charAt(0).toUpperCase() + log.action.slice(1);
                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded border ${
                        isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${themeClasses.headingText}`}>
                            {actionLabel}
                          </p>
                          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                            {formattedDate} {formattedTime} — {actorName}
                          </p>
                          {log.fromStatus !== log.toStatus && (
                            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                              {log.fromStatus} → {log.toStatus}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase 3A: Add Busy Block Modal */}
      {showBusyBlockModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="busy-block-modal-title"
        >
          <div
            ref={modalRefs.busyBlock}
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="busy-block-modal-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Add Blocked Time
              </h3>
              <button
                onClick={() => {
                  setShowBusyBlockModal(false);
                  setBusyBlockForm({ start: "", end: "", reason: "" });
                  setBusyBlockErrors({});
                }}
                className={themeClasses.mutedText}
                aria-label="Close busy block modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={busyBlockForm.start ? new Date(busyBlockForm.start).toISOString().slice(0, 16) : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const isoString = value ? new Date(value).toISOString() : "";
                    setBusyBlockForm({ ...busyBlockForm, start: isoString });
                    if (busyBlockErrors.start) {
                      setBusyBlockErrors({ ...busyBlockErrors, start: "" });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  required
                />
                {busyBlockErrors.start && (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {busyBlockErrors.start}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  value={busyBlockForm.end ? new Date(busyBlockForm.end).toISOString().slice(0, 16) : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const isoString = value ? new Date(value).toISOString() : "";
                    setBusyBlockForm({ ...busyBlockForm, end: isoString });
                    if (busyBlockErrors.end) {
                      setBusyBlockErrors({ ...busyBlockErrors, end: "" });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  required
                />
                {busyBlockErrors.end && (
                  <p className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    {busyBlockErrors.end}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={busyBlockForm.reason || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 500) {
                      setBusyBlockForm({ ...busyBlockForm, reason: value });
                    }
                  }}
                  className={getInputClasses(isDark)}
                  placeholder="e.g., Lunch break, Maintenance"
                  maxLength={500}
                />
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  {(busyBlockForm.reason || "").length}/500 characters
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowBusyBlockModal(false);
                    setBusyBlockForm({ start: "", end: "", reason: "" });
                    setBusyBlockErrors({});
                  }}
                  className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                    isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={createBusyBlock}
                  className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${SUBMIT_BUTTON_CLASSES}`}
                >
                  Add Block
                </button>
              </div>
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
      homeLinkHref="/apps"
      homeLinkText="Back to Dashboard"
    >
      <OBDSchedulerPageContent />
    </ErrorBoundary>
  );
}

