"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import ResultCard from "@/components/obd/ResultCard";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses, getPanelClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import {
  Campaign,
  Customer,
  Event,
  ReviewRequestAutomationRequest,
  ReviewRequestAutomationResponse,
  TriggerType,
  Language,
  ToneStyle,
  ReviewPlatform,
  FrequencyCapDays,
  CustomerStatus,
} from "@/lib/apps/review-request-automation/types";
import { parseCSV, generateCSVTemplate, exportCustomersToCSV, CSVParseResult } from "@/lib/apps/review-request-automation/csv-utils";
import {
  addSnapshotToHistoryStore,
  generateSnapshotId,
  loadActiveSnapshot,
  loadSnapshotHistoryStore,
  RRA_SNAPSHOT_SCHEMA_VERSION,
  saveActiveSnapshot,
  setActiveSnapshotIdInHistoryStore,
  type ReviewRequestCampaignSnapshot,
  type ReviewRequestSnapshotHistoryStore,
} from "@/lib/apps/review-request-automation/snapshot-storage";
import { CrmIntegrationIndicator } from "@/components/crm/CrmIntegrationIndicator";
import { isValidReturnUrl } from "@/lib/utils/crm-integration-helpers";

// Generate UUID for client-side
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Review Request Templates (V1 - constants, no DB)
export interface ReviewRequestTemplate {
  id: string;
  name: string;
  subject: string; // for email
  body: string; // email body text (with placeholders like {firstName} or {name} if supported)
  toneStyle: ToneStyle; // maps to campaign toneStyle
}

export const REVIEW_REQUEST_TEMPLATES: ReviewRequestTemplate[] = [
  {
    id: "default",
    name: "Default request",
    subject: "We'd love your feedback!",
    body: "Hi {name}, we hope you had a great experience with us! Your feedback helps us improve and helps other customers find us. Could you take a moment to leave us a review?",
    toneStyle: "Friendly",
  },
  {
    id: "short-friendly",
    name: "Short & Friendly",
    subject: "Quick favor?",
    body: "Hi {name}! We'd really appreciate it if you could leave us a quick review. Thanks so much!",
    toneStyle: "Friendly",
  },
  {
    id: "professional",
    name: "Professional",
    subject: "Request for Review",
    body: "Dear {name}, Thank you for choosing our services. We value your feedback and would appreciate if you could share your experience by leaving a review. Your input helps us maintain our high standards.",
    toneStyle: "Professional",
  },
  {
    id: "service-follow-up",
    name: "Service Follow-Up",
    subject: "How was your recent visit?",
    body: "Hi {name}, We hope you're satisfied with the service you received. Your review would mean a lot to us and help other customers make informed decisions. Thank you!",
    toneStyle: "Friendly",
  },
];

function ReviewRequestAutomationPageContent() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);

  // Campaign state
  const [campaign, setCampaign] = useState<Campaign>({
    businessName: "",
    businessType: "",
    platform: "Google",
    reviewLink: "",
    language: "English",
    toneStyle: "Friendly",
    brandVoice: "",
    rules: {
      triggerType: "manual",
      sendDelayHours: 24,
      followUpEnabled: false,
      followUpDelayDays: 7,
      frequencyCapDays: 30,
      quietHours: {
        start: "09:00",
        end: "19:00",
      },
    },
  });

  // Customers and events
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<ReviewRequestCampaignSnapshot | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<ReviewRequestSnapshotHistoryStore>({
    schemaVersion: RRA_SNAPSHOT_SCHEMA_VERSION,
    snapshots: [],
    activeSnapshotId: null,
  });
  const [snapshotHistoryExpanded, setSnapshotHistoryExpanded] = useState(true);
  const [historyViewerSnapshotId, setHistoryViewerSnapshotId] = useState<string | null>(null);
  const [showReviewChangesModal, setShowReviewChangesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaign" | "customers" | "templates" | "queue" | "results">("campaign");
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [selectedQueueItems, setSelectedQueueItems] = useState<Set<string>>(new Set());
  const [expandedInfo, setExpandedInfo] = useState<Set<string>>(new Set());
  
  // Database save state
  const [saveToDb, setSaveToDb] = useState(true); // Default ON
  const [savedDatasetId, setSavedDatasetId] = useState<string | null>(null); // UI banner only
  const [savingToDb, setSavingToDb] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<"connected" | "fallback" | "local-only" | "checking">("checking");
  
  // Email sending state
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ sent: number; failed: number } | null>(null);

  // Cross-app state memory (LEVEL 3)
  const searchParams = useSearchParams();
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [showFromRDBanner, setShowFromRDBanner] = useState(false);
  const focusRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bannerDismissedRef = useRef(false);

  // Modal state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    customerName: "",
    phone: "",
    email: "",
    tags: [],
    lastVisitDate: "",
    serviceType: "",
    jobId: "",
  });

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<CSVParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const csvModalRef = useRef<HTMLDivElement>(null);

  // localStorage persistence (draft edits only; snapshots are stored separately)
  const DRAFT_STORAGE_KEY = "review-request-automation-draft.v1";

  useEffect(() => {
    // Load draft edits from localStorage on mount
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.campaign) {
          setCampaign(data.campaign);
        }
        if (data.customers && Array.isArray(data.customers)) {
          setCustomers(data.customers);
        }
        if (data.events && Array.isArray(data.events)) {
          setEvents(data.events);
        }
        // If we have data, don't show quick start
        if (data.campaign?.businessName || (data.customers && data.customers.length > 0)) {
          setShowQuickStart(false);
        } else {
          setShowQuickStart(true);
        }
      } else {
        // First load - show quick start
        setShowQuickStart(true);
      }
    } catch {
      // Silently fail - localStorage may be unavailable or corrupted
      setShowQuickStart(true);
    }

    // Load active snapshot (canonical view for templates/queue/results)
    const snap = loadActiveSnapshot();
    if (snap) {
      setActiveSnapshot(snap);
      // If a snapshot exists, default away from quick start
      setShowQuickStart(false);
    }

    // Load snapshot history (read-only review; does not change active unless explicit)
    const history = loadSnapshotHistoryStore();
    setSnapshotHistory(history);
    setSnapshotHistoryExpanded(history.snapshots.length > 0);

    // If the legacy active snapshot key is missing, fall back to the history-selected active snapshot.
    if (!snap && history.activeSnapshotId) {
      const fromHistory = history.snapshots.find((s) => s.id === history.activeSnapshotId);
      if (fromHistory) {
        setActiveSnapshot(fromHistory);
      }
    }

    // Check DB status on mount
    const checkDbStatus = async () => {
      try {
        const res = await fetch("/api/review-request-automation/latest");
        if (res.ok) {
          const data = await res.json();
          // Check if campaign exists (campaign can be null for first-time users)
          if (data.campaign) {
            setDbStatus("connected");
          } else {
            // No campaign yet, but DB is connected
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (saved) {
              setDbStatus("fallback");
            } else {
              setDbStatus("connected"); // Connected but no data yet
            }
          }
        } else if (res.status !== 401) {
          // Not 401, so DB issue
          const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (saved) {
            setDbStatus("fallback");
          } else {
            setDbStatus("fallback");
          }
        } else {
          // 401 - not logged in, but that's fine
          setDbStatus("connected");
        }
      } catch (err) {
        // DB unavailable
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          setDbStatus("fallback");
        } else {
          setDbStatus("connected"); // Assume connected if no local data
        }
      }
    };

    checkDbStatus();

    // Check if banner was dismissed in this session
    if (typeof window !== "undefined" && sessionStorage.getItem("rd-banner-dismissed") === "true") {
      bannerDismissedRef.current = true;
    }
  }, []);

  useEffect(() => {
    // Save draft edits to localStorage whenever they change
    try {
      const data = {
        campaign,
        customers,
        events,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail - localStorage may be unavailable or quota exceeded
    }
  }, [campaign, customers, events]);

  // ESC key handler for modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddCustomerModal) setShowAddCustomerModal(false);
        if (csvPreview) setCsvPreview(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showAddCustomerModal, csvPreview]);

  // Focus trap for modals
  useEffect(() => {
    if (showAddCustomerModal && modalRef.current) {
      const modal = modalRef.current;
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };
      
      modal.addEventListener("keydown", handleTab);
      firstElement?.focus();
      
      return () => modal.removeEventListener("keydown", handleTab);
    }
  }, [showAddCustomerModal]);

  // CRM return link state
  const [crmReturnUrl, setCrmReturnUrl] = useState<string | null>(null);
  const [crmContextLoaded, setCrmContextLoaded] = useState(false);
  
  // Template selector state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("default");
  
  // CRM draft confirmation state
  const [showCrmDraftConfirm, setShowCrmDraftConfirm] = useState(false);
  const [crmDraftContactIds, setCrmDraftContactIds] = useState<string[]>([]);
  const [crmDraftTemplateId, setCrmDraftTemplateId] = useState<string>("default");
  const [crmDraftChannel, setCrmDraftChannel] = useState<"email" | "sms">("email");

  // Deep linking: Handle query parameters (tab, focus, from=rd, CRM integration)
  useEffect(() => {
    if (!searchParams) return;

    const tab = searchParams.get("tab");
    const focus = searchParams.get("focus");
    const fromRD = searchParams.get("from") === "rd";
    const fromCRM = searchParams.get("from") === "crm";
    const context = searchParams.get("context");
    const returnUrl = searchParams.get("returnUrl");

    // Handle CRM draft confirmation mode (context=crm + contactIds)
    const contactIdsParam = searchParams.get("contactIds");
    const templateParam = searchParams.get("template");
    const channelParam = searchParams.get("channel");
    
    if (context === "crm" && contactIdsParam) {
      // Parse contact IDs (comma-separated)
      const contactIds = contactIdsParam.split(",").filter(id => id.trim().length > 0);
      if (contactIds.length > 0) {
        setCrmDraftContactIds(contactIds);
        setCrmDraftTemplateId(templateParam || "default");
        setCrmDraftChannel((channelParam === "sms" ? "sms" : "email") as "email" | "sms");
        setShowCrmDraftConfirm(true);
        // Store return URL if valid
        if (returnUrl && isValidReturnUrl(returnUrl)) {
          setCrmReturnUrl(returnUrl);
        }
        setCrmContextLoaded(true);
        // DO NOT proceed automatically - wait for user to click "Proceed"
        return; // Exit early to prevent other prefill logic
      }
    }

    // Store CRM return URL if valid (for other CRM integrations)
    if (fromCRM && returnUrl && isValidReturnUrl(returnUrl)) {
      setCrmReturnUrl(returnUrl);
      setCrmContextLoaded(true);
    } else {
      setCrmReturnUrl(null);
      setCrmContextLoaded(false);
    }

    // Switch tab if provided and valid
    if (tab) {
      const validTabs: Array<"campaign" | "customers" | "templates" | "queue" | "results"> = [
        "campaign",
        "customers",
        "templates",
        "queue",
        "results",
      ];
      if (validTabs.includes(tab as typeof validTabs[number])) {
        setActiveTab(tab as typeof validTabs[number]);
      }
    }

    // Show banner if from RD and not dismissed
    if (fromRD && !bannerDismissedRef.current) {
      setShowFromRDBanner(true);
    }

    // Check for CRM integration prefill params (single contact - legacy)
    const contactId = searchParams.get("contactId");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    
    if (contactId && name && context !== "crm") {
      // Prefill customer modal with CRM contact data (only if not in draft confirmation mode)
      setNewCustomer({
        customerName: name || "",
        email: email || "",
        phone: phone || "",
        tags: [],
        lastVisitDate: "",
        serviceType: "",
        jobId: "",
      });
      // Open the customer modal and switch to customers tab
      setShowAddCustomerModal(true);
      setActiveTab("customers");
    }
  }, [searchParams]); // Only run when searchParams changes

  // Handle field focusing after tab has switched
  useEffect(() => {
    if (!searchParams) return;

    const focus = searchParams.get("focus");
    if (!focus) return;

    // Wait for tab content to render, then scroll and highlight
    const timeoutId = setTimeout(() => {
      const element = focusRefs.current[focus];
      if (element) {
        // Smooth scroll to element
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Add highlight ring animation
        element.classList.add("ring-2", "ring-[#29c4a9]", "ring-offset-2");
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-[#29c4a9]", "ring-offset-2");
          setFocusTarget(null);
        }, 2000);
      }
    }, 300); // Wait 300ms for tab content to render

    return () => clearTimeout(timeoutId);
  }, [searchParams, activeTab]); // Re-run when tab switches or searchParams changes

  // Handle CRM draft confirmation - Proceed
  const handleCrmDraftProceed = async () => {
    // Close confirmation panel
    setShowCrmDraftConfirm(false);
    
    // Prefill template
    setSelectedTemplateId(crmDraftTemplateId);
    const selectedTemplate = REVIEW_REQUEST_TEMPLATES.find(t => t.id === crmDraftTemplateId);
    if (selectedTemplate) {
      setCampaign({ ...campaign, toneStyle: selectedTemplate.toneStyle });
    }
    
    // Fetch contact details from CRM API and add as customers
    try {
      const fetchedCustomers: Customer[] = [];
      for (const contactId of crmDraftContactIds) {
        try {
          const res = await fetch(`/api/obd-crm/contacts/${contactId}`);
          if (res.ok) {
            const contact = await res.json();
            // Map CRM contact to Customer format
            const customer: Customer = {
              id: generateUUID(),
              customerName: contact.name || "Unknown",
              email: contact.email || undefined,
              phone: contact.phone || undefined,
              tags: contact.tags || [],
              lastVisitDate: contact.lastTouchAt || undefined,
              serviceType: contact.status || undefined,
              optedOut: false,
              createdAt: new Date().toISOString(),
            };
            fetchedCustomers.push(customer);
          }
        } catch (err) {
          console.warn(`Failed to fetch contact ${contactId}:`, err);
          // Continue with other contacts even if one fails
        }
      }
      
      // Add fetched customers to the customers list
      if (fetchedCustomers.length > 0) {
        setCustomers(prev => [...prev, ...fetchedCustomers]);
        // Switch to customers tab
        setActiveTab("customers");
      }
    } catch (err) {
      console.error("Error fetching CRM contacts:", err);
      // Don't block - user can manually add customers
    }
  };

  // Handle CRM draft confirmation - Cancel
  const handleCrmDraftCancel = () => {
    setShowCrmDraftConfirm(false);
    setCrmDraftContactIds([]);
    // Clear CRM context if user cancels
    setCrmContextLoaded(false);
    setCrmReturnUrl(null);
  };

  const persistNewSnapshot = (snapshot: ReviewRequestCampaignSnapshot) => {
    setActiveSnapshot(snapshot);
    saveActiveSnapshot(snapshot);
    const nextHistory = addSnapshotToHistoryStore(snapshot, { setActive: true });
    setSnapshotHistory(nextHistory);
  };

  const setActiveSnapshotExplicit = (snapshot: ReviewRequestCampaignSnapshot) => {
    setActiveSnapshot(snapshot);
    saveActiveSnapshot(snapshot);
    const nextHistory = setActiveSnapshotIdInHistoryStore(snapshot.id);
    setSnapshotHistory(nextHistory);
  };

  const updateActiveSnapshot = (
    updater: (prev: ReviewRequestCampaignSnapshot) => ReviewRequestCampaignSnapshot
  ) => {
    setActiveSnapshot((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveActiveSnapshot(next);
      return next;
    });
  };

  const handleCreateNewSnapshot = async () => {
    setError(null);
    setLoading(true);

    try {
      const request: ReviewRequestAutomationRequest = {
        campaign,
        customers,
        events,
      };

      const res = await fetch("/api/review-request-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json() as ReviewRequestAutomationResponse;

      const snapshotBase: ReviewRequestCampaignSnapshot = {
        id: generateSnapshotId(),
        createdAt: new Date().toISOString(),
        schemaVersion: RRA_SNAPSHOT_SCHEMA_VERSION,
        campaign,
        customers,
        events,
        response: data,
      };

      persistNewSnapshot(snapshotBase);
      setActiveTab("results");
      setShowQuickStart(false); // Dismiss quick start when snapshot is created
      
      if (data.validationErrors.length > 0) {
        setError(data.validationErrors.join("; "));
      }

      // Save to database if toggle is enabled
      if (saveToDb) {
        setSavingToDb(true);
        setSaveError(null);
        try {
          const saveRes = await fetch("/api/review-request-automation/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaign,
              customers,
              queue: data.sendQueue,
              results: data,
            }),
          });

          if (!saveRes.ok) {
            const errorData = await saveRes.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to save to database");
          }

          const saveResult = await saveRes.json();
          updateActiveSnapshot((prev) => ({
            ...prev,
            datasetId: saveResult.datasetId || null,
          }));
          setSavedDatasetId(saveResult.datasetId || null);
          setDbStatus("connected");
        } catch (err) {
          console.error("Error saving to database:", err);
          setSaveError(
            err instanceof Error
              ? err.message
              : "Failed to save to database. Your results are still available."
          );
          // Set fallback status if local results exist
          if (data) {
            setDbStatus("fallback");
          }
          // Don't show this as a blocking error - results are still displayed
        } finally {
          setSavingToDb(false);
        }
      } else {
        // Toggle is OFF - set to local-only
        setDbStatus("local-only");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while processing your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const openReviewChangesModal = () => {
    // UI-only step right before snapshot creation (no API calls).
    setShowReviewChangesModal(true);
  };

  const confirmCreateNewSnapshotFromPreview = () => {
    setShowReviewChangesModal(false);
    // Finalize: perform the actual snapshot creation.
    handleCreateNewSnapshot();
  };

  const handleAddCustomer = () => {
    if (!newCustomer.customerName?.trim()) {
      setError("Customer name is required");
      return;
    }

    if (!newCustomer.phone?.trim() && !newCustomer.email?.trim()) {
      setError("At least phone or email is required");
      return;
    }

    const customer: Customer = {
      id: generateUUID(),
      customerName: newCustomer.customerName.trim(),
      phone: newCustomer.phone?.trim() || undefined,
      email: newCustomer.email?.trim() || undefined,
      tags: newCustomer.tags && newCustomer.tags.length > 0 ? newCustomer.tags : undefined,
      lastVisitDate: newCustomer.lastVisitDate?.trim() || undefined,
      serviceType: newCustomer.serviceType?.trim() || undefined,
      jobId: newCustomer.jobId?.trim() || undefined,
      optedOut: false,
      createdAt: new Date().toISOString(),
    };

    setCustomers([...customers, customer]);
    setNewCustomer({
      customerName: "",
      phone: "",
      email: "",
      tags: [],
      lastVisitDate: "",
      serviceType: "",
      jobId: "",
    });
    setShowAddCustomerModal(false);
    setError(null);
    setShowQuickStart(false); // Dismiss quick start when customer is added
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parseResult = parseCSV(text);
      
      if (parseResult.errors.length > 0 && parseResult.customers.length === 0) {
        setError(`CSV parsing errors: ${parseResult.errors.map((e) => e.errors.join(", ")).join("; ")}`);
        return;
      }

      setCsvPreview(parseResult);
      setError(null);
    };

    reader.readAsText(file);
  };

  const handleConfirmCSVImport = () => {
    if (csvPreview && csvPreview.customers.length > 0) {
      setCustomers([...customers, ...csvPreview.customers]);
      setCsvPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setShowQuickStart(false); // Dismiss quick start when customers are imported
    }
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "review-request-automation-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (customers.length === 0) return;
    const csv = exportCustomersToCSV(customers);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${campaign.businessName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkStatus = (queueItemId: string, status: "sent" | "clicked" | "reviewed" | "optedOut") => {
    if (!activeSnapshot) return;
    const queueItem = activeSnapshot.response.sendQueue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    const event: Event = {
      id: generateUUID(),
      customerId: queueItem.customerId,
      type: status,
      timestamp: new Date().toISOString(),
    };

    // Keep draft event history in sync (explicit user action; no recomputation).
    setEvents((prev) => [...prev, event]);

    // Snapshot-derived only: update snapshot state (no recomputation).
    updateActiveSnapshot((prev) => ({
      ...prev,
      events: [...prev.events, event],
      response: {
        ...prev.response,
        sendQueue: prev.response.sendQueue.map((q) =>
          q.id === queueItemId ? { ...q, status } : q
        ),
      },
    }));
  };

  const handleBulkMarkStatus = (status: "sent" | "clicked" | "reviewed" | "optedOut") => {
    if (!activeSnapshot || selectedQueueItems.size === 0) return;

    const newEvents: Event[] = [];
    selectedQueueItems.forEach((queueItemId) => {
      const queueItem = activeSnapshot.response.sendQueue.find((q) => q.id === queueItemId);
      if (queueItem && queueItem.status === "pending") {
        newEvents.push({
          id: generateUUID(),
          customerId: queueItem.customerId,
          type: status,
          timestamp: new Date().toISOString(),
        });
      }
    });

    if (newEvents.length > 0) {
      // Keep draft event history in sync (explicit user action; no recomputation).
      setEvents((prev) => [...prev, ...newEvents]);
      setSelectedQueueItems(new Set());

      updateActiveSnapshot((prev) => ({
        ...prev,
        events: [...prev.events, ...newEvents],
        response: {
          ...prev.response,
          sendQueue: prev.response.sendQueue.map((q) =>
            selectedQueueItems.has(q.id) && q.status === "pending" ? { ...q, status } : q
          ),
        },
      }));
    }
  };

  const handleToggleQueueItem = (queueItemId: string) => {
    const newSelected = new Set(selectedQueueItems);
    if (newSelected.has(queueItemId)) {
      newSelected.delete(queueItemId);
    } else {
      newSelected.add(queueItemId);
    }
    setSelectedQueueItems(newSelected);
  };

  const handleSelectAllQueueItems = () => {
    if (!activeSnapshot) return;
    const pendingItems = activeSnapshot.response.sendQueue.filter((q) => q.status === "pending");
    if (selectedQueueItems.size === pendingItems.length) {
      setSelectedQueueItems(new Set());
    } else {
      setSelectedQueueItems(new Set(pendingItems.map((q) => q.id)));
    }
  };

  const handleExportQueueCSV = () => {
    if (!activeSnapshot || activeSnapshot.response.sendQueue.length === 0) return;
    
    const headers = ["customerId", "customerName", "scheduledAt", "variant", "channel", "status", "skippedReason"];
    const rows = activeSnapshot.response.sendQueue.map((item) => {
      const customer = activeSnapshot.customers.find((c) => c.id === item.customerId);
      return [
        item.customerId,
        customer?.customerName || "Unknown",
        item.scheduledAt,
        item.variant,
        item.channel,
        item.status,
        item.skippedReason || "",
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const snapshotIdShort = activeSnapshot.id.slice(0, 8);
    a.download = `review-requests-snapshot-${snapshotIdShort}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCampaignJSON = () => {
    if (!activeSnapshot) return;
    const exportData = {
      snapshot: activeSnapshot,
      exportedAt: new Date().toISOString(),
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const snapshotIdShort = activeSnapshot.id.slice(0, 8);
    a.download = `review-requests-snapshot-${snapshotIdShort}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Silently fail - clipboard API may be unavailable
    }
  };

  const handleSendEmails = async (queueItemIds?: string[]) => {
    if (!activeSnapshot) {
      setError("Create a new snapshot first to enable send actions.");
      return;
    }
    // Check if data is saved to database (required for send-email route)
    if (!saveToDb || !activeSnapshot.datasetId) {
      setError("Please save your snapshot to the database first (enable “Save to database” and create a new snapshot).");
      return;
    }

    setSendingEmails(true);
    setEmailSendResult(null);
    setError(null);

    try {
      // Send-email route handles fetching latest dataset server-side
      // If queueItemIds provided, use those; otherwise server will fetch all pending EMAIL items
      const res = await fetch("/api/review-request-automation/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueItemIds: queueItemIds && queueItemIds.length > 0 ? queueItemIds : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send emails");
      }

      const data = await res.json();
      setEmailSendResult({
        sent: data.sent || 0,
        failed: data.failed || 0,
      });

      // Snapshot is canonical and does not recompute automatically.
      // If the user wants an updated computed view, they can explicitly create a new snapshot.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send emails. Please try again."
      );
    } finally {
      setSendingEmails(false);
    }
  };

  const getSMSCharacterCount = (text: string): { count: number; segments: number } => {
    const count = text.length;
    // SMS segments: 160 chars per segment, but 153 if using GSM-7 with UDH
    // For simplicity, we use 160
    const segments = Math.ceil(count / 160);
    return { count, segments };
  };

  const getCustomerStatus = (customer: Customer): CustomerStatus => {
    const customerEvents = events.filter((e) => e.customerId === customer.id);
    const sortedEvents = customerEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    for (const event of sortedEvents) {
      if (event.type === "optedOut") return "optedOut";
      if (event.type === "reviewed") return "reviewed";
      if (event.type === "clicked") return "clicked";
      if (event.type === "sent") return "sent";
    }
    
    return "queued";
  };

  const formatSnapshotLabel = (snapshot: ReviewRequestCampaignSnapshot): string => {
    const dt = new Date(snapshot.createdAt);
    const formatted = Number.isFinite(dt.getTime())
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(dt)
      : snapshot.createdAt;
    return `Snapshot — ${formatted}`;
  };

  const buildReviewChangesLines = (): string[] => {
    if (!activeSnapshot) {
      const lines: string[] = ["This will create your first snapshot."];
      lines.push(`Customers: ${customers.length}`);
      lines.push(`Rules: Quiet hours ${campaign.rules.quietHours.start}–${campaign.rules.quietHours.end}`);
      lines.push(`Review link / platform: ${campaign.platform}${campaign.reviewLink ? " (link set)" : " (no link)"}`);
      return lines.slice(0, 6);
    }

    const lines: string[] = [];

    const normalizeText = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const sameText = (a: unknown, b: unknown) => normalizeText(a) === normalizeText(b);

    const fingerprintCustomers = (list: Customer[]): string => {
      // Deterministic lightweight fingerprint (no heavy diff): id + a few stable fields, sorted.
      return list
        .map((c) => ({
          id: c.id,
          customerName: c.customerName,
          email: c.email ?? "",
          phone: c.phone ?? "",
          optedOut: !!c.optedOut,
          tags: (c.tags ?? []).slice().sort(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => `${c.id}|${c.customerName}|${c.email}|${c.phone}|${c.optedOut ? "1" : "0"}|${c.tags.join(",")}`)
        .join("~");
    };

    const prevCustomersCount = activeSnapshot.customers.length;
    const nowCustomersCount = customers.length;
    const customersChanged =
      prevCustomersCount !== nowCustomersCount ||
      fingerprintCustomers(activeSnapshot.customers) !== fingerprintCustomers(customers);
    lines.push(
      customersChanged
        ? `Customers: Changed (now ${nowCustomersCount})`
        : `Customers: Unchanged (${nowCustomersCount})`
    );

    const quietHoursChanged =
      !sameText(campaign.rules.quietHours.start, activeSnapshot.campaign.rules.quietHours.start) ||
      !sameText(campaign.rules.quietHours.end, activeSnapshot.campaign.rules.quietHours.end);
    lines.push(quietHoursChanged ? "Rules: Quiet hours updated" : "Rules: Quiet hours unchanged");

    const freqChanged = campaign.rules.frequencyCapDays !== activeSnapshot.campaign.rules.frequencyCapDays;
    lines.push(freqChanged ? "Rules: Frequency cap updated" : "Rules: Frequency cap unchanged");

    const reviewLinkOrPlatformChanged =
      campaign.platform !== activeSnapshot.campaign.platform ||
      !sameText(campaign.reviewLink, activeSnapshot.campaign.reviewLink);
    lines.push(reviewLinkOrPlatformChanged ? "Review link / platform: Updated" : "Review link / platform: Unchanged");

    // Templates are snapshot-derived; we only show an "Updated" boolean based on draft inputs that affect generation.
    const templateRelevantChanged =
      !sameText(campaign.businessName, activeSnapshot.campaign.businessName) ||
      !sameText(campaign.businessType, activeSnapshot.campaign.businessType) ||
      campaign.platform !== activeSnapshot.campaign.platform ||
      !sameText(campaign.reviewLink, activeSnapshot.campaign.reviewLink) ||
      campaign.language !== activeSnapshot.campaign.language ||
      campaign.toneStyle !== activeSnapshot.campaign.toneStyle ||
      !sameText(campaign.brandVoice, activeSnapshot.campaign.brandVoice);
    lines.push(templateRelevantChanged ? "Templates: Updated" : "Templates: Unchanged");

    const queuedNow = activeSnapshot.response?.sendQueue?.length ?? 0;
    lines.push(`Current snapshot queued: ${queuedNow}`);

    return lines.slice(0, 6);
  };

  const getSnapshotChannels = (snapshot: ReviewRequestCampaignSnapshot): string[] => {
    const sendQueue = snapshot.response?.sendQueue ?? [];
    const channels = new Set<string>();
    for (const item of sendQueue) {
      const raw = (item as unknown as { channel?: string | null }).channel;
      if (typeof raw === "string" && raw.trim()) channels.add(raw);
    }
    return Array.from(channels).sort();
  };

  const historyViewerSnapshot =
    historyViewerSnapshotId
      ? snapshotHistory.snapshots.find((s) => s.id === historyViewerSnapshotId) ?? null
      : null;

  const reviewChangesLines = showReviewChangesModal ? buildReviewChangesLines() : [];

  const filteredCustomers = customers;
  const snapshotResponse = activeSnapshot?.response ?? null;
  const snapshotCampaign = activeSnapshot?.campaign ?? null;
  const snapshotCustomers = activeSnapshot?.customers ?? [];
  const snapshotSendQueue = snapshotResponse?.sendQueue ?? [];
  const hasActiveSnapshot = !!activeSnapshot;
  const activeSnapshotIdShort = activeSnapshot?.id ? activeSnapshot.id.slice(0, 8) : null;
  const hasQueueItems = snapshotSendQueue.length > 0;
  const pendingQueueCount = snapshotSendQueue.filter((q) => q.status === "pending").length;
  const hasPendingEmailQueueItems = snapshotSendQueue.some((q) => q.status === "pending" && q.channel === "email");
  const quietHoursConfigured = !!(
    snapshotCampaign?.rules?.quietHours?.start &&
    snapshotCampaign?.rules?.quietHours?.end &&
    snapshotCampaign.rules.quietHours.start !== snapshotCampaign.rules.quietHours.end
  );
  const frequencyCapsSet = typeof snapshotCampaign?.rules?.frequencyCapDays === "number";
  const templatesReviewed = !!snapshotResponse?.templates;
  const TAB_LABELS: Record<"campaign" | "customers" | "templates" | "queue" | "results", string> = {
    campaign: "Campaign",
    customers: "Customers",
    templates: "Templates",
    queue: "Queue",
    results: "Campaign Results (Snapshot)",
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="Review Request Automation"
      tagline="Plan, queue, and manage review request messages — safely and on your terms."
    >
      <CrmIntegrationIndicator
        isDark={isDark}
        showContextPill={crmContextLoaded}
        showBackLink={!!crmReturnUrl}
        returnUrl={crmReturnUrl}
        onDismissContext={() => setCrmContextLoaded(false)}
      />

      {/* Tier 5A: Trust banner (draft-first, calm, no automation claims) */}
      <div
        className={`mt-7 rounded-2xl border p-4 md:p-5 ${
          isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
        }`}
      >
        <p className={`text-sm font-semibold ${themeClasses.headingText}`}>Draft-first &amp; controlled delivery</p>
        <ul className={`mt-2 list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.labelText}`}>
          <li>
            <span className="font-medium">Templates and queue items are generated on-demand, when you click Create New Snapshot.</span>
          </li>
          <li>
            <span className="font-medium">Nothing is sent in the background—sending (or exporting) is always user-initiated.</span>
          </li>
          <li>
            <span className="font-medium">No background crawling. No platform manipulation. No auto-sending.</span>
          </li>
        </ul>
        <div className="mt-3">
          <a
            href="/apps/reputation-dashboard"
            className={`text-xs underline ${
              isDark ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Open Reputation Dashboard (link only)"
          >
            View review impact in Reputation Dashboard
          </a>
        </div>
      </div>

      {/* LEVEL 3: From RD Banner */}
      {showFromRDBanner && (
        <div className={`mb-4 p-3 rounded-lg border flex items-center justify-between ${
          isDark
            ? "bg-blue-900/20 border-blue-700"
            : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <p className={`text-sm ${isDark ? "text-blue-300" : "text-blue-700"}`}>
              <strong>Tip:</strong> Fixing this will improve your review request conversion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowFromRDBanner(false);
              bannerDismissedRef.current = true;
              // Store in sessionStorage so it doesn't show again this session
              if (typeof window !== "undefined") {
                sessionStorage.setItem("rd-banner-dismissed", "true");
              }
            }}
            className={`text-xs px-2 py-1 rounded ${
              isDark
                ? "hover:bg-blue-800/50 text-blue-300"
                : "hover:bg-blue-100 text-blue-700"
            }`}
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}

      {/* CRM Draft Confirmation Panel */}
      {showCrmDraftConfirm && (
        <OBDPanel isDark={isDark} className="mt-4">
          <div className="space-y-4">
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${themeClasses.headingText}`}>
                Review Request Draft
              </h3>
              <p className={`text-sm ${themeClasses.labelText}`}>
                You&apos;re about to send review requests to {crmDraftContactIds.length} contact{crmDraftContactIds.length !== 1 ? "s" : ""}.
              </p>
            </div>
            
            <div className={`p-4 rounded-lg ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
              <div className="space-y-2">
                <div>
                  <span className={`text-sm font-medium ${themeClasses.labelText}`}>Template: </span>
                  <span className={`text-sm ${themeClasses.mutedText}`}>
                    {REVIEW_REQUEST_TEMPLATES.find(t => t.id === crmDraftTemplateId)?.name || "Default request"}
                  </span>
                </div>
                <div>
                  <span className={`text-sm font-medium ${themeClasses.labelText}`}>Preview: </span>
                  <p className={`text-sm mt-1 ${themeClasses.mutedText} line-clamp-2`}>
                    {(() => {
                      const template = REVIEW_REQUEST_TEMPLATES.find(t => t.id === crmDraftTemplateId);
                      if (template) {
                        const preview = template.body.substring(0, 200);
                        return preview + (template.body.length > 200 ? "..." : "");
                      }
                      return "No preview available";
                    })()}
                  </p>
                </div>
                <div>
                  <span className={`text-sm font-medium ${themeClasses.labelText}`}>Channel: </span>
                  <span className={`text-sm ${themeClasses.mutedText}`}>
                    Email
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCrmDraftProceed}
                className={SUBMIT_BUTTON_CLASSES}
              >
                Proceed
              </button>
              <button
                type="button"
                onClick={handleCrmDraftCancel}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </OBDPanel>
      )}

      {/* DB Status Pill */}
      <div className="mt-4 flex items-center justify-end">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            dbStatus === "connected"
              ? isDark
                ? "bg-green-900/50 text-green-300 border border-green-700"
                : "bg-green-50 text-green-700 border border-green-200"
              : dbStatus === "fallback"
              ? isDark
                ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700"
                : "bg-yellow-50 text-yellow-700 border border-yellow-200"
              : dbStatus === "local-only"
              ? isDark
                ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                : "bg-blue-50 text-blue-700 border border-blue-200"
              : isDark
              ? "bg-slate-800 text-slate-400 border border-slate-700"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
          title={
            dbStatus === "connected"
              ? "Connected to database"
              : dbStatus === "fallback"
              ? "Using local storage (database unavailable)"
              : dbStatus === "local-only"
              ? "Local storage only — data not saved to database"
              : "Checking connection..."
          }
        >
          {dbStatus === "connected"
            ? "✓ Connected"
            : dbStatus === "fallback"
            ? "⚠ Fallback (Local)"
            : dbStatus === "local-only"
            ? "○ Local Only"
            : "○ Checking..."}
        </span>
      </div>
      {/* Save Success Banner */}
      {savedDatasetId && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            isDark ? "bg-green-900/20 border border-green-700" : "bg-green-50 border border-green-200"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span className={`text-sm font-medium ${themeClasses.headingText}`}>
                Saved to your account
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
              }`}>
                {savedDatasetId.substring(0, 8)}...
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSavedDatasetId(null)}
              className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              aria-label="Dismiss save confirmation"
            >
              ×
            </button>
          </div>
        </OBDPanel>
      )}

      {/* Save Error Banner */}
      {saveError && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            isDark ? "bg-yellow-900/20 border border-yellow-700" : "bg-yellow-50 border border-yellow-200"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">⚠</span>
              <span className={`text-sm ${themeClasses.mutedText}`}>
                {saveError}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </OBDPanel>
      )}

      {/* Quick Start Banner */}
      {showQuickStart && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Quick Start Guide
              </h3>
              <ol className={`space-y-2 text-sm ${themeClasses.mutedText} list-decimal list-inside`}>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("campaign");
                      setShowQuickStart(false);
                    }}
                    className="text-[#29c4a9] hover:underline font-medium"
                  >
                    Create your campaign
                  </button>
                  {" "}— Set up business info, review link, and delivery rules
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("customers");
                      setShowQuickStart(false);
                    }}
                    className="text-[#29c4a9] hover:underline font-medium"
                  >
                    Import customers
                  </button>
                  {" "}— Add customers manually or import via CSV
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("campaign");
                      setShowQuickStart(false);
                    }}
                    className="text-[#29c4a9] hover:underline font-medium"
                  >
                    Create a snapshot
                  </button>
                  {" "}— Click &quot;Create New Snapshot&quot; to compute templates and build your queue once
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("queue");
                      setShowQuickStart(false);
                    }}
                    className="text-[#29c4a9] hover:underline font-medium"
                  >
                    Review the queue
                  </button>
                  {" "}— Copy messages, mark status, and track progress
                </li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickStart(false)}
              className={`ml-4 text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
              aria-label="Dismiss quick start guide"
              title="Dismiss quick start guide"
            >
              ×
            </button>
          </div>
        </OBDPanel>
      )}

      {/* Snapshot History (read-only) */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Snapshot History
            </h3>
            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
              Review prior campaign snapshots without restoring, replaying, or re-queuing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSnapshotHistoryExpanded((v) => !v)}
            className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
            aria-expanded={snapshotHistoryExpanded}
            aria-label={snapshotHistoryExpanded ? "Collapse snapshot history" : "Expand snapshot history"}
            title={snapshotHistoryExpanded ? "Collapse" : "Expand"}
          >
            {snapshotHistoryExpanded ? "Hide" : "Show"} ({snapshotHistory.snapshots.length})
          </button>
        </div>

        {snapshotHistoryExpanded && (
          snapshotHistory.snapshots.length > 0 ? (
            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {snapshotHistory.snapshots.map((s) => {
                const isActive = snapshotHistory.activeSnapshotId === s.id;
                const queuedCount = s.response?.sendQueue?.length ?? 0;
                const channels = getSnapshotChannels(s);
                const channelLabel = channels.length > 0 ? channels.join(", ") : "—";

                const chipClass = `inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setHistoryViewerSnapshotId(s.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      isDark
                        ? "bg-slate-900/30 border-slate-800 hover:bg-slate-800/40"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                    aria-label={`Open ${formatSnapshotLabel(s)} viewer`}
                    title="Open read-only snapshot viewer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${themeClasses.headingText}`}>
                          {formatSnapshotLabel(s)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={chipClass}>Customers: {s.customers.length}</span>
                          <span className={chipClass}>Queued: {queuedCount}</span>
                          <span className={chipClass}>Channels: {channelLabel}</span>
                        </div>
                      </div>
                      {isActive && (
                        <span
                          className={`shrink-0 text-xs px-2 py-1 rounded-full ${
                            isDark ? "bg-[#29c4a9]/20 text-[#76f2de] border border-[#29c4a9]/40" : "bg-[#29c4a9]/10 text-[#0f766e] border border-[#29c4a9]/30"
                          }`}
                          title="This is your active snapshot"
                        >
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={`text-sm mt-4 ${themeClasses.mutedText}`}>
              No snapshots yet. Create one to start a reviewable history.
            </p>
          )
        )}
      </OBDPanel>

      {/* Tabs */}
      <div className="mt-7 flex gap-2 border-b border-slate-300 dark:border-slate-700">
            {(["campaign", "customers", "templates", "queue", "results"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[#29c4a9] text-[#29c4a9]"
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title={`Switch to ${TAB_LABELS[tab]}`}
            aria-label={`${TAB_LABELS[tab]} tab`}
            aria-current={activeTab === tab ? "page" : undefined}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Campaign Tab */}
      {activeTab === "campaign" && (
        <OBDPanel isDark={isDark} className="mt-7">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-6">
              <div>
                <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                  Business Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      value={campaign.businessName}
                      onChange={(e) => setCampaign({ ...campaign, businessName: e.target.value })}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., Ocala Coffee Shop"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Business Type (Optional)
                    </label>
                    <input
                      type="text"
                      id="businessType"
                      value={campaign.businessType || ""}
                      onChange={(e) => {
                        setCampaign({ ...campaign, businessType: e.target.value });
                        if (e.target.value.trim()) setShowQuickStart(false);
                      }}
                      className={getInputClasses(isDark)}
                      placeholder="e.g., Restaurant, Retail, Service"
                      aria-label="Business type"
                    />
                    {snapshotResponse?.businessTypeRecommendation && (
                      <div className={`mt-2 p-3 rounded-lg ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className={`text-xs font-semibold mb-1 ${themeClasses.headingText}`}>
                              Recommended Settings for {snapshotResponse.businessTypeRecommendation.businessType}
                            </div>
                            <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>
                              {snapshotResponse.businessTypeRecommendation.explanation}
                            </p>
                            <div className={`text-xs space-y-1 ${themeClasses.mutedText}`}>
                              <div>Send Delay: {snapshotResponse.businessTypeRecommendation.sendDelayHours.recommended} hours (range: {snapshotResponse.businessTypeRecommendation.sendDelayHours.min}-{snapshotResponse.businessTypeRecommendation.sendDelayHours.max})</div>
                              {campaign.rules.followUpEnabled && (
                                <div>Follow-Up Delay: {snapshotResponse.businessTypeRecommendation.followUpDelayDays.recommended} days (range: {snapshotResponse.businessTypeRecommendation.followUpDelayDays.min}-{snapshotResponse.businessTypeRecommendation.followUpDelayDays.max})</div>
                              )}
                              <div>Tone Style: {snapshotResponse.businessTypeRecommendation.toneStyle.join(" or ")}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const rec = snapshotResponse.businessTypeRecommendation;
                              if (rec) {
                                setCampaign({
                                  ...campaign,
                                  rules: {
                                    ...campaign.rules,
                                    sendDelayHours: rec.sendDelayHours.recommended,
                                    followUpDelayDays: rec.followUpDelayDays.recommended,
                                  },
                                  toneStyle: rec.toneStyle[0] as ToneStyle,
                                });
                              }
                            }}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                              isDark
                                ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                                : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                            }`}
                            title="Apply recommended settings"
                            aria-label="Apply recommended settings"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                const rec = snapshotResponse.businessTypeRecommendation;
                                if (rec) {
                                  setCampaign({
                                    ...campaign,
                                    rules: {
                                      ...campaign.rules,
                                      sendDelayHours: rec.sendDelayHours.recommended,
                                      followUpDelayDays: rec.followUpDelayDays.recommended,
                                    },
                                    toneStyle: rec.toneStyle[0] as ToneStyle,
                                  });
                                }
                              }
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Review Platform <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="platform"
                      value={campaign.platform}
                      onChange={(e) => setCampaign({ ...campaign, platform: e.target.value as ReviewPlatform })}
                      className={getInputClasses(isDark)}
                      required
                    >
                      <option value="Google">Google</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Yelp">Yelp</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div
                    ref={(el) => {
                      focusRefs.current["reviewLinkUrl"] = el;
                    }}
                  >
                    <label htmlFor="reviewLink" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Review Link <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      id="reviewLink"
                      value={campaign.reviewLink}
                      onChange={(e) => setCampaign({ ...campaign, reviewLink: e.target.value })}
                      className={getInputClasses(isDark)}
                      placeholder="https://g.page/r/..."
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)}></div>

              <div>
                <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                  Message Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Language <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="language"
                      value={campaign.language}
                      onChange={(e) => setCampaign({ ...campaign, language: e.target.value as Language })}
                      className={getInputClasses(isDark)}
                      required
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Bilingual">Bilingual</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="toneStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Tone Style <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="toneStyle"
                      value={campaign.toneStyle}
                      onChange={(e) => setCampaign({ ...campaign, toneStyle: e.target.value as ToneStyle })}
                      className={getInputClasses(isDark)}
                      required
                    >
                      <option value="Friendly">Friendly</option>
                      <option value="Professional">Professional</option>
                      <option value="Bold">Bold</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="template" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Template
                    </label>
                    <select
                      id="template"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        const template = REVIEW_REQUEST_TEMPLATES.find(t => t.id === e.target.value);
                        if (template) {
                          // Update toneStyle to match template
                          setCampaign({ ...campaign, toneStyle: template.toneStyle });
                        }
                      }}
                      className={getInputClasses(isDark)}
                    >
                      {REVIEW_REQUEST_TEMPLATES.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Template preview will appear after creating a snapshot
                    </p>
                  </div>
                  <div>
                    <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Brand Voice (Optional)
                    </label>
                    <textarea
                      id="brandVoice"
                      value={campaign.brandVoice || ""}
                      onChange={(e) => setCampaign({ ...campaign, brandVoice: e.target.value })}
                      className={getInputClasses(isDark, "resize-none")}
                      rows={3}
                      placeholder="Describe your brand voice..."
                    />
                  </div>
                </div>
              </div>

              <div className={getDividerClass(isDark)}></div>

              <div>
                <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                  Storage Options
                </h3>
                <div className="space-y-4">
                  <label className={`flex items-center gap-2 cursor-pointer ${themeClasses.labelText}`}>
                    <input
                      type="checkbox"
                      checked={saveToDb}
                      onChange={(e) => {
                        setSaveToDb(e.target.checked);
                        if (!e.target.checked) {
                          setDbStatus("local-only");
                        } else {
                          // Check connection when toggling back on
                          setDbStatus("checking");
                          fetch("/api/review-request-automation/latest")
                            .then((res) => {
                              if (res.ok) {
                                setDbStatus("connected");
                              } else {
                                setDbStatus("fallback");
                              }
                            })
                            .catch(() => setDbStatus("fallback"));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">
                      Save to database (recommended) — enables integration with Reputation Dashboard
                    </span>
                  </label>
                  <p className={`text-xs ${themeClasses.mutedText} ml-6`}>
                    When enabled, your campaign data will be saved to your account and can be viewed in the Reputation Dashboard.
                  </p>
                </div>
              </div>

              <div className={getDividerClass(isDark)}></div>

              <div>
                <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                  Delivery Rules
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="triggerType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Trigger Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="triggerType"
                      value={campaign.rules.triggerType}
                      onChange={(e) => setCampaign({
                        ...campaign,
                        rules: { ...campaign.rules, triggerType: e.target.value as TriggerType }
                      })}
                      className={getInputClasses(isDark)}
                      required
                    >
                      <option value="manual">Manual</option>
                      <option value="after_service">After Service</option>
                      <option value="after_payment">After Payment</option>
                    </select>
                  </div>
                  <div
                    ref={(el) => {
                      focusRefs.current["timing"] = el;
                    }}
                  >
                    <label htmlFor="sendDelayHours" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Send Delay (Hours) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="sendDelayHours"
                      min="0"
                      max="168"
                      value={campaign.rules.sendDelayHours}
                      onChange={(e) => setCampaign({
                        ...campaign,
                        rules: { ...campaign.rules, sendDelayHours: parseInt(e.target.value, 10) || 0 }
                      })}
                      className={getInputClasses(isDark)}
                      required
                    />
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Delay before sending (0-168 hours)
                    </p>
                  </div>
                  <div>
                    <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                      <input
                        type="checkbox"
                        checked={campaign.rules.followUpEnabled}
                        onChange={(e) => setCampaign({
                          ...campaign,
                          rules: { ...campaign.rules, followUpEnabled: e.target.checked }
                        })}
                        className="rounded"
                      />
                      Enable Follow-Up
                    </label>
                  </div>
                  {campaign.rules.followUpEnabled && (
                    <div
                      ref={(el) => {
                        focusRefs.current["followUpDelayDays"] = el;
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <label htmlFor="followUpDelayDays" className={`block text-sm font-medium ${themeClasses.labelText}`}>
                          Follow-Up Delay (Days) <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const newExpanded = new Set(expandedInfo);
                            if (newExpanded.has("followUpDelay")) {
                              newExpanded.delete("followUpDelay");
                            } else {
                              newExpanded.add("followUpDelay");
                            }
                            setExpandedInfo(newExpanded);
                          }}
                          className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText} focus:outline-none focus:ring-2 focus:ring-[#29c4a9] rounded`}
                          aria-label="Learn more about follow-up delay"
                          aria-expanded={expandedInfo.has("followUpDelay")}
                          title="Why this matters"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              const newExpanded = new Set(expandedInfo);
                              if (newExpanded.has("followUpDelay")) {
                                newExpanded.delete("followUpDelay");
                              } else {
                                newExpanded.add("followUpDelay");
                              }
                              setExpandedInfo(newExpanded);
                            }
                          }}
                        >
                          ℹ️
                        </button>
                      </div>
                      {expandedInfo.has("followUpDelay") && (
                        <div className={`mb-2 p-3 rounded-lg text-xs ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
                          <p className={themeClasses.mutedText}>
                            Follow-up messages remind customers who haven&apos;t reviewed yet. A delay of 2-7 days gives them time to review naturally, while still keeping your business top of mind. Too short (less than 2 days) may feel pushy.
                          </p>
                        </div>
                      )}
                      <input
                        type="number"
                        id="followUpDelayDays"
                        min="1"
                        max="30"
                        value={campaign.rules.followUpDelayDays}
                        onChange={(e) => setCampaign({
                          ...campaign,
                          rules: { ...campaign.rules, followUpDelayDays: parseInt(e.target.value, 10) || 1 }
                        })}
                        className={getInputClasses(isDark)}
                        required
                      />
                    </div>
                  )}
                  <div
                    ref={(el) => {
                      focusRefs.current["frequencyCapDays"] = el;
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="frequencyCapDays" className={`block text-sm font-medium ${themeClasses.labelText}`}>
                        Frequency Cap (Days) <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newExpanded = new Set(expandedInfo);
                          if (newExpanded.has("frequencyCap")) {
                            newExpanded.delete("frequencyCap");
                          } else {
                            newExpanded.add("frequencyCap");
                          }
                          setExpandedInfo(newExpanded);
                        }}
                        className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText} focus:outline-none focus:ring-2 focus:ring-[#29c4a9] rounded`}
                        aria-label="Learn more about frequency cap"
                        aria-expanded={expandedInfo.has("frequencyCap")}
                        title="Why this matters"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const newExpanded = new Set(expandedInfo);
                            if (newExpanded.has("frequencyCap")) {
                              newExpanded.delete("frequencyCap");
                            } else {
                              newExpanded.add("frequencyCap");
                            }
                            setExpandedInfo(newExpanded);
                          }
                        }}
                      >
                        ℹ️
                      </button>
                    </div>
                    {expandedInfo.has("frequencyCap") && (
                      <div className={`mb-2 p-3 rounded-lg text-xs ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
                        <p className={themeClasses.mutedText}>
                          Frequency cap prevents sending multiple review requests to the same customer within a set time period. This protects your reputation and respects customer preferences. 30 days is standard, but 60-90 days may be better for businesses with repeat customers.
                        </p>
                      </div>
                    )}
                    <select
                      id="frequencyCapDays"
                      value={campaign.rules.frequencyCapDays}
                      onChange={(e) => setCampaign({
                        ...campaign,
                        rules: { ...campaign.rules, frequencyCapDays: parseInt(e.target.value, 10) as FrequencyCapDays }
                      })}
                      className={getInputClasses(isDark)}
                      required
                    >
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className={`block text-sm font-medium ${themeClasses.labelText}`}>
                        Quiet Hours <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newExpanded = new Set(expandedInfo);
                          if (newExpanded.has("quietHours")) {
                            newExpanded.delete("quietHours");
                          } else {
                            newExpanded.add("quietHours");
                          }
                          setExpandedInfo(newExpanded);
                        }}
                        className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText} focus:outline-none focus:ring-2 focus:ring-[#29c4a9] rounded`}
                        aria-label="Learn more about quiet hours"
                        aria-expanded={expandedInfo.has("quietHours")}
                        title="Why this matters"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const newExpanded = new Set(expandedInfo);
                            if (newExpanded.has("quietHours")) {
                              newExpanded.delete("quietHours");
                            } else {
                              newExpanded.add("quietHours");
                            }
                            setExpandedInfo(newExpanded);
                          }
                        }}
                      >
                        ℹ️
                      </button>
                    </div>
                    {expandedInfo.has("quietHours") && (
                      <div className={`mb-2 p-3 rounded-lg text-xs ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
                        <p className={themeClasses.mutedText}>
                          Quiet hours prevent sending messages during times when customers are likely sleeping or busy. Queue items that fall inside quiet hours are scheduled for the next allowed time. Default is 9 AM to 7 PM.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="quietHoursStart" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          Start <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          id="quietHoursStart"
                          value={campaign.rules.quietHours.start}
                          onChange={(e) => setCampaign({
                            ...campaign,
                            rules: {
                              ...campaign.rules,
                              quietHours: { ...campaign.rules.quietHours, start: e.target.value }
                            }
                          })}
                          className={getInputClasses(isDark)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="quietHoursEnd" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                          End <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          id="quietHoursEnd"
                          value={campaign.rules.quietHours.end}
                          onChange={(e) => setCampaign({
                            ...campaign,
                            rules: {
                              ...campaign.rules,
                              quietHours: { ...campaign.rules.quietHours, end: e.target.value }
                            }
                          })}
                          className={getInputClasses(isDark)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className={getErrorPanelClasses(isDark)}>{error}</div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={openReviewChangesModal}
                  disabled={loading || savingToDb}
                  className={SUBMIT_BUTTON_CLASSES}
                title="Create a new snapshot (templates + queue computed once)"
                  aria-label="Create new snapshot"
                >
                  {loading ? "Processing..." : savingToDb ? "Saving..." : "Create New Snapshot"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("queue");
                    setShowQuickStart(false);
                  }}
                  disabled={!hasActiveSnapshot}
                  className={`px-6 py-3 rounded-full font-medium transition-colors ${
                    !hasActiveSnapshot
                      ? "opacity-50 cursor-not-allowed"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  title={!hasActiveSnapshot ? "Create a new snapshot first" : "Review your queue before sending or exporting"}
                  aria-label="Review and queue messages"
                >
                  Review &amp; Queue Messages
                </button>
              </div>
            </div>
          </form>
        </OBDPanel>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div
          ref={(el) => {
            focusRefs.current["contacts"] = el;
          }}
        >
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                Customers ({customers.length})
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  title="Add a new customer manually"
                  aria-label="Add customer"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowAddCustomerModal(true);
                    }
                  }}
                >
                  Add Customer
                </button>
                <label
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  title="Import customers from CSV file"
                  aria-label="Import CSV"
                >
                  Import CSV
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="hidden"
                    aria-label="Select CSV file to import"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  title="Download CSV template with example data"
                  aria-label="Download CSV template"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDownloadTemplate();
                    }
                  }}
                >
                  Download CSV Template
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={customers.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    customers.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  title={customers.length === 0 ? "Add or import customers first" : "Export customers to CSV"}
                  aria-label="Export customers to CSV"
                  onKeyDown={(e) => {
                    if (customers.length === 0) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleExportCSV();
                    }
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {customers.length > 0 ? (
              <div
                className={`text-xs rounded-lg border p-3 ${
                  isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                Customers remain independent of CRM unless you manually import them.
              </div>
            ) : null}

            {customers.length === 0 ? (
              <p className={`text-sm ${themeClasses.mutedText} py-4`}>
                No customers yet. Add customers manually or import via CSV.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCustomers.map((customer) => {
                  const status = getCustomerStatus(customer);
                  return (
                    <div
                      key={customer.id}
                      className={`p-3 rounded-lg border ${
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-medium ${themeClasses.headingText}`}>
                            {customer.customerName}
                          </div>
                          <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                            {customer.phone && `Phone: ${customer.phone}`}
                            {customer.phone && customer.email && " • "}
                            {customer.email && `Email: ${customer.email}`}
                          </div>
                          {customer.lastVisitDate && (
                            <div className={`text-xs ${themeClasses.mutedText}`}>
                              Last visit: {new Date(customer.lastVisitDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            status === "reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            : status === "clicked" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                            : status === "sent" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                            : status === "optedOut" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          }`}>
                            {status}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCustomers(customers.filter((c) => c.id !== customer.id))}
                            className={`text-red-500 hover:text-red-600 ${isDark ? "hover:text-red-400" : ""}`}
                            title="Remove this customer"
                            aria-label={`Remove ${customer.customerName}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setCustomers(customers.filter((c) => c.id !== customer.id));
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </OBDPanel>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div
          ref={(el) => {
            focusRefs.current["sms"] = el;
            focusRefs.current["cta"] = el;
          }}
        >
        {snapshotResponse ? (
          <div className="mt-7 space-y-7">
          <OBDPanel isDark={isDark}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                Message Templates
              </h3>
              <button
                type="button"
                onClick={openReviewChangesModal}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title="Create a new snapshot (recompute templates + queue)"
                aria-label="Create a new snapshot"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openReviewChangesModal();
                  }
                }}
              >
                Create New Snapshot
              </button>
            </div>
            <div className="space-y-4">
              {snapshotResponse.templateQuality.map((quality) => {
                const templateKey = quality.templateKey;
                const templateText = templateKey === "email" 
                  ? `${snapshotResponse.templates.email.subject}\n\n${snapshotResponse.templates.email.body}`
                  : snapshotResponse.templates[templateKey];
                const copyText = templateKey === "email"
                  ? `Subject: ${snapshotResponse.templates.email.subject}\n\n${snapshotResponse.templates.email.body}`
                  : templateText;
                const title = templateKey === "smsShort" ? "SMS Short"
                  : templateKey === "smsStandard" ? "SMS Standard"
                  : templateKey === "followUpSms" ? "Follow-Up SMS"
                  : "Email";
                
                return (
                  <div key={templateKey} className="relative">
                    <div className="absolute -top-2 -right-2 z-10">
                      <div className="relative group">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          quality.severity === "critical"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                            : quality.severity === "warning"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                        }`}>
                          {quality.label}
                        </span>
                        <div className={`absolute right-0 top-full mt-2 w-64 p-3 rounded-lg shadow-lg z-20 hidden group-hover:block ${
                          isDark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-200"
                        }`}>
                          <div className={`text-xs font-semibold mb-2 ${themeClasses.headingText}`}>
                            Quality Details:
                          </div>
                          <ul className={`text-xs space-y-1 ${themeClasses.mutedText} list-disc list-inside mb-2`}>
                            {quality.details.map((detail, idx) => (
                              <li key={idx}>{detail}</li>
                            ))}
                          </ul>
                          {quality.suggestion && (
                            <div className={`text-xs font-medium mt-2 pt-2 border-t ${
                              isDark ? "border-slate-700" : "border-slate-200"
                            } ${themeClasses.headingText}`}>
                              Suggestion: {quality.suggestion}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <ResultCard
                      title={title}
                      isDark={isDark}
                      copyText={copyText}
                    >
                      {templateKey === "email" ? (
                        <div className="space-y-2">
                          <div>
                            <p className={`font-medium mb-1 ${themeClasses.headingText}`}>Subject:</p>
                            <p>{snapshotResponse.templates.email.subject}</p>
                          </div>
                          <div>
                            <p className={`font-medium mb-1 ${themeClasses.headingText}`}>Body:</p>
                            <p className="whitespace-pre-wrap">{snapshotResponse.templates.email.body}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap">{templateText}</p>
                          {(() => {
                            const { count, segments } = getSMSCharacterCount(templateText);
                            return (
                              <p className={`text-xs ${themeClasses.mutedText}`}>
                                {count} characters • {segments} segment{segments !== 1 ? "s" : ""}
                                {segments > 1 && " (may be split into multiple messages)"}
                                {quality.label === "Too Long" && ` • ${quality.details.find(d => d.includes("characters")) || ""}`}
                              </p>
                            );
                          })()}
                        </div>
                      )}
                    </ResultCard>
                  </div>
                );
              })}
            </div>
          </OBDPanel>
        </div>
        ) : (
          <OBDPanel isDark={isDark} className="mt-7">
            <p className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
              No snapshot yet. Configure your campaign and click &quot;Create New Snapshot&quot; to compute templates and build your queue.
            </p>
          </OBDPanel>
        )}
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === "queue" && (
        <div
          ref={(el) => {
            focusRefs.current["skips"] = el;
          }}
        >
        {snapshotResponse ? (
        <>
          {/* Planned Send Timeline */}
          {snapshotResponse.sendTimeline.events.length > 0 ? (
            <OBDPanel isDark={isDark} className="mt-7">
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Planned Send Timeline
              </h3>
              <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
                Actual delivery depends on channel availability and recipient eligibility.
              </p>
              <div className="relative">
                <div className="flex items-center justify-between relative">
                  {snapshotResponse.sendTimeline.events.map((event) => {
                    const eventDate = new Date(event.timestamp);
                    const isPast = eventDate < new Date();
                    return (
                      <div key={event.id} className="flex-1 flex flex-col items-center relative z-10">
                        <div className={`w-3 h-3 rounded-full mb-2 ${
                          event.type === "now" ? "bg-[#29c4a9]"
                          : event.type === "initial_send" ? "bg-blue-500"
                          : "bg-yellow-500"
                        } ${isPast ? "opacity-50" : ""}`} />
                        <div className={`text-xs text-center ${themeClasses.mutedText}`}>
                          <div className="font-medium">{event.label}</div>
                          <div>{eventDate.toLocaleDateString()}</div>
                          <div>{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Connecting line */}
                  <div 
                    className={`absolute top-1.5 left-0 right-0 h-0.5 ${
                      isDark ? "bg-slate-700" : "bg-slate-300"
                    }`}
                    style={{ top: '6px' }}
                  />
                </div>
              </div>
            </OBDPanel>
          ) : (
            <OBDPanel isDark={isDark} className="mt-7">
              <p className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
                Timeline appears after a snapshot is created.
              </p>
            </OBDPanel>
          )}
          <OBDPanel isDark={isDark} className="mt-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Send Queue ({snapshotSendQueue.length} items)
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSendEmails()}
                disabled={sendingEmails || !hasPendingEmailQueueItems || !saveToDb || !activeSnapshot?.datasetId}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sendingEmails || !hasPendingEmailQueueItems || !saveToDb || !activeSnapshot?.datasetId
                    ? "opacity-50 cursor-not-allowed"
                    : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                }`}
                title={
                  !hasPendingEmailQueueItems
                    ? "No pending email items to send"
                    : !saveToDb || !activeSnapshot?.datasetId
                    ? "Save to database first (create a snapshot with Save to database enabled)"
                    : "Send pending email queue items now (manual, one-time)"
                }
                aria-label="Send pending emails"
              >
                {sendingEmails ? "Sending..." : "Send Pending Emails"}
              </button>
              <button
                type="button"
                onClick={handleExportQueueCSV}
                disabled={!hasQueueItems}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !hasQueueItems
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title={
                  !hasQueueItems
                    ? "No queue items to export"
                    : `Export send queue from active snapshot${activeSnapshotIdShort ? ` (${activeSnapshotIdShort})` : ""}`
                }
                aria-label="Export send queue to CSV"
              >
                Export Queue CSV
              </button>
              <button
                type="button"
                onClick={handleExportCampaignJSON}
                disabled={!hasActiveSnapshot}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !hasActiveSnapshot
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title={
                  !hasActiveSnapshot
                    ? "Create a new snapshot first"
                    : `Export active snapshot to JSON${activeSnapshotIdShort ? ` (${activeSnapshotIdShort})` : ""}`
                }
                aria-label="Export campaign data to JSON"
              >
                Export Campaign JSON
              </button>
            </div>
          </div>

          {/* Email send result banner */}
          {emailSendResult && (
            <div className={`mb-4 p-3 rounded-lg border ${
              emailSendResult.failed > 0
                ? isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                : isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
            }`}>
              <div className={`text-sm font-medium ${
                emailSendResult.failed > 0
                  ? isDark ? "text-yellow-300" : "text-yellow-800"
                  : isDark ? "text-green-300" : "text-green-800"
              }`}>
                {emailSendResult.sent > 0 && emailSendResult.failed === 0
                  ? `✅ Successfully sent ${emailSendResult.sent} email${emailSendResult.sent !== 1 ? "s" : ""}`
                  : emailSendResult.sent > 0 && emailSendResult.failed > 0
                  ? `⚠️ Sent ${emailSendResult.sent} email${emailSendResult.sent !== 1 ? "s" : ""}, ${emailSendResult.failed} failed`
                  : `❌ Failed to send ${emailSendResult.failed} email${emailSendResult.failed !== 1 ? "s" : ""}`
                }
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          <div
            className={`mb-4 p-3 rounded-lg border ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <label className={`flex items-center gap-2 ${pendingQueueCount === 0 ? "opacity-50" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  disabled={pendingQueueCount === 0}
                  checked={
                    pendingQueueCount > 0 && selectedQueueItems.size === pendingQueueCount
                  }
                  onChange={handleSelectAllQueueItems}
                  className="rounded"
                  aria-label="Select all pending queue items"
                  title={pendingQueueCount === 0 ? "No pending items to select" : "Select all pending items"}
                />
                <span className={`text-sm ${themeClasses.labelText}`}>
                  Select All ({pendingQueueCount} pending)
                </span>
              </label>

              <span className={`text-sm ${themeClasses.mutedText}`}>
                {selectedQueueItems.size} selected
              </span>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBulkMarkStatus("sent")}
                  disabled={selectedQueueItems.size === 0}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectedQueueItems.size === 0
                      ? "opacity-50 cursor-not-allowed bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                      : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300"
                  }`}
                  title={selectedQueueItems.size === 0 ? "Select one or more pending items first" : "Mark selected items as sent"}
                  aria-label="Mark selected items as sent"
                >
                  Mark Selected as Sent
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMarkStatus("clicked")}
                  disabled={selectedQueueItems.size === 0}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectedQueueItems.size === 0
                      ? "opacity-50 cursor-not-allowed bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300"
                  }`}
                  title={selectedQueueItems.size === 0 ? "Select one or more pending items first" : "Mark selected items as clicked"}
                  aria-label="Mark selected items as clicked"
                >
                  Mark Selected as Clicked
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMarkStatus("reviewed")}
                  disabled={selectedQueueItems.size === 0}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectedQueueItems.size === 0
                      ? "opacity-50 cursor-not-allowed bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300"
                  }`}
                  title={selectedQueueItems.size === 0 ? "Select one or more pending items first" : "Mark selected items as reviewed"}
                  aria-label="Mark selected items as reviewed"
                >
                  Mark Selected as Reviewed
                </button>
              </div>

              {pendingQueueCount === 0 ? (
                <div className={`text-xs ${themeClasses.mutedText}`}>
                  No pending items available for bulk updates.
                </div>
              ) : null}
            </div>
          </div>

          {snapshotSendQueue.length === 0 ? (
            <p className={`text-sm ${themeClasses.mutedText} py-4`}>
              No items in the queue yet. Create a new snapshot to build a queue you can review.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {snapshotSendQueue.map((item) => {
                const customer = snapshotCustomers.find((c) => c.id === item.customerId);
                const firstName = customer?.customerName?.split(" ")[0] || "Customer";
                let personalizedText: string;
                if (item.variant === "email") {
                  personalizedText = `Subject: ${snapshotResponse.templates.email.subject.replace(/{firstName}/g, firstName)}\n\n${snapshotResponse.templates.email.body.replace(/{firstName}/g, firstName)}`;
                } else {
                  const templateText = snapshotResponse.templates[item.variant];
                  personalizedText = templateText.replace(/{firstName}/g, firstName);
                }
                
                const isSelected = selectedQueueItems.has(item.id);
                const isPending = item.status === "pending";
                
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    } ${isSelected ? "ring-2 ring-[#29c4a9]" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {isPending && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleQueueItem(item.id)}
                            className="rounded"
                            aria-label={`Select queue item for ${customer?.customerName || "Unknown Customer"}`}
                            title="Select for bulk action"
                          />
                        )}
                        <div className="flex-1">
                          <div className={`font-medium ${themeClasses.headingText}`}>
                            {customer?.customerName || "Unknown Customer"}
                          </div>
                          <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                            Scheduled: {new Date(item.scheduledAt).toLocaleString()}
                          </div>
                          <div className={`text-xs ${themeClasses.mutedText}`}>
                            {item.variant} • {item.channel} • {item.status}
                            {item.skippedReason && ` • ${item.skippedReason}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(personalizedText)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            isDark
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                          title="Copy personalized message to clipboard"
                          aria-label="Copy message"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleCopy(personalizedText);
                            }
                          }}
                        >
                          Copy
                        </button>
                        {isPending && (
                          <>
                            {item.channel === "email" && (
                              <button
                                type="button"
                                onClick={() => handleSendEmails()}
                                disabled={sendingEmails || !saveToDb || !activeSnapshot?.datasetId}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  sendingEmails || !saveToDb || !activeSnapshot?.datasetId
                                    ? "opacity-50 cursor-not-allowed bg-slate-400 text-slate-200"
                                    : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                                }`}
                                title={
                                  !saveToDb || !activeSnapshot?.datasetId
                                    ? "Save to database first (create a snapshot with Save to database enabled)"
                                    : "Send all pending emails (including this one)"
                                }
                                aria-label="Send emails"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (!sendingEmails && saveToDb && activeSnapshot?.datasetId) {
                                      handleSendEmails();
                                    }
                                  }
                                }}
                              >
                                {sendingEmails ? "Sending..." : "Send"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMarkStatus(item.id, "sent")}
                              className="px-3 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300"
                              title="Mark this item as sent"
                              aria-label="Mark as sent"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleMarkStatus(item.id, "sent");
                                }
                              }}
                            >
                              Mark Sent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkStatus(item.id, "clicked")}
                              className="px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300"
                              title="Mark this item as clicked"
                              aria-label="Mark as clicked"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleMarkStatus(item.id, "clicked");
                                }
                              }}
                            >
                              Mark Clicked
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkStatus(item.id, "reviewed")}
                              className="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300"
                              title="Mark this item as reviewed"
                              aria-label="Mark as reviewed"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleMarkStatus(item.id, "reviewed");
                                }
                              }}
                            >
                              Mark Reviewed
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkStatus(item.id, "optedOut")}
                              className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300"
                              title="Mark customer as opted out"
                              aria-label="Opt out customer"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleMarkStatus(item.id, "optedOut");
                                }
                              }}
                            >
                              Opt Out
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </OBDPanel>
        </>
        ) : (
          <OBDPanel isDark={isDark} className="mt-7">
            <p className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
              No queue available yet. Create a new snapshot to build a queue you can review.
            </p>
          </OBDPanel>
        )}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (
        snapshotResponse ? (
          <div className="mt-7 space-y-7">
            <OBDPanel isDark={isDark}>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                These results reflect the state of your campaign at the time it was queued.
              </p>
            </OBDPanel>
            {/* Campaign Readiness (Tier 6-lite, calm, no scoring) */}
            <OBDPanel isDark={isDark}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                  Campaign Readiness
                </h3>
              </div>
              <div className="space-y-2">
                <div className={`flex items-center justify-between text-sm ${themeClasses.labelText}`}>
                  <span>Quiet hours configured</span>
                  <span className={quietHoursConfigured ? (isDark ? "text-green-300" : "text-green-700") : themeClasses.mutedText}>
                    {quietHoursConfigured ? "✓" : "—"}
                  </span>
                </div>
                <div className={`flex items-center justify-between text-sm ${themeClasses.labelText}`}>
                  <span>Frequency caps set</span>
                  <span className={frequencyCapsSet ? (isDark ? "text-green-300" : "text-green-700") : themeClasses.mutedText}>
                    {frequencyCapsSet ? "✓" : "—"}
                  </span>
                </div>
                <div className={`flex items-center justify-between text-sm ${themeClasses.labelText}`}>
                  <span>Templates reviewed</span>
                  <span className={templatesReviewed ? (isDark ? "text-green-300" : "text-green-700") : themeClasses.mutedText}>
                    {templatesReviewed ? "✓" : "—"}
                  </span>
                </div>
                <div className={`flex items-center justify-between text-sm ${themeClasses.labelText}`}>
                  <span>Customers queued</span>
                  <span className={themeClasses.headingText}>{snapshotSendQueue.length}</span>
                </div>
              </div>
            </OBDPanel>
            
            {/* Guidance Benchmarks */}
            {snapshotResponse.guidanceBenchmarks.length > 0 && (
              <OBDPanel isDark={isDark}>
                <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                  Best-Practice Guidance
                </h3>
                <div className="space-y-3">
                  {snapshotResponse.guidanceBenchmarks.map((benchmark) => (
                    <div
                      key={benchmark.id}
                      className={`p-3 rounded-lg border ${
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                      } ${!benchmark.isWithinRange ? "border-yellow-300 dark:border-yellow-700" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className={`text-sm font-medium mb-1 ${themeClasses.headingText}`}>
                            {benchmark.title}
                          </div>
                          <p className={`text-xs ${themeClasses.mutedText} mb-1`}>
                            {benchmark.recommendation}
                          </p>
                          <div className={`text-xs ${themeClasses.mutedText}`}>
                            Current: {benchmark.currentValue}
                            {!benchmark.isWithinRange && benchmark.suggestion && (
                              <span className={`ml-2 font-medium ${isDark ? "text-yellow-300" : "text-yellow-700"}`}>
                                • {benchmark.suggestion}
                              </span>
                            )}
                          </div>
                        </div>
                        {benchmark.isWithinRange && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            isDark ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-700"
                          }`}>
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </OBDPanel>
            )}
            
            {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {snapshotResponse.metrics.loaded}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Loaded</div>
              </div>
            </OBDPanel>
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {snapshotResponse.metrics.ready}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Ready</div>
              </div>
            </OBDPanel>
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {snapshotResponse.metrics.queued}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Queued</div>
              </div>
            </OBDPanel>
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {snapshotResponse.metrics.reviewed}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Reviewed</div>
              </div>
            </OBDPanel>
          </div>

          {/* Quality Checks */}
          {snapshotResponse.qualityChecks.length > 0 && (
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Quality Checks
              </h3>
              <div className="space-y-3">
                {snapshotResponse.qualityChecks.map((check) => {
                  const severityColors = {
                    info: isDark ? "bg-blue-900/20 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700",
                    warning: isDark ? "bg-yellow-900/20 border-yellow-700 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-700",
                    error: isDark ? "bg-red-900/20 border-red-700 text-red-300" : "bg-red-50 border-red-200 text-red-700",
                  };
                  
                  return (
                    <div
                      key={check.id}
                      className={`p-3 rounded-lg border ${severityColors[check.severity]}`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="font-semibold">{check.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          check.severity === "error" 
                            ? isDark ? "bg-red-900/50" : "bg-red-100"
                            : check.severity === "warning"
                            ? isDark ? "bg-yellow-900/50" : "bg-yellow-100"
                            : isDark ? "bg-blue-900/50" : "bg-blue-100"
                        }`}>
                          {check.severity}
                        </span>
                      </div>
                      <p className={`text-sm mb-2 ${themeClasses.mutedText}`}>
                        {check.description}
                      </p>
                      {check.suggestedFix && (
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          <strong>Fix:</strong> {check.suggestedFix}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </OBDPanel>
          )}

          {/* Next Actions */}
          {snapshotResponse.nextActions.length > 0 && (
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Next Actions
              </h3>
              <div className="space-y-3">
                {snapshotResponse.nextActions.map((action) => (
                  <ResultCard
                    key={action.id}
                    title={action.title}
                    isDark={isDark}
                    copyText={action.copyText}
                  >
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      {action.description}
                    </p>
                  </ResultCard>
                ))}
              </div>
            </OBDPanel>
          )}
        </div>
        ) : (
          <OBDPanel isDark={isDark} className="mt-7">
            <p className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
              No results available yet. Create a new snapshot to see metrics and insights.
            </p>
          </OBDPanel>
        )
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowAddCustomerModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-customer-title"
        >
          <div
            ref={modalRef}
            className={`${getPanelClasses(isDark)} max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="add-customer-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Add Customer
              </h2>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomer.customerName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, customerName: e.target.value })}
                  className={getInputClasses(isDark)}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newCustomer.tags?.join(", ") || ""}
                  onChange={(e) => setNewCustomer({
                    ...newCustomer,
                    tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                  })}
                  className={getInputClasses(isDark)}
                  placeholder="VIP, Regular, New Customer"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Last Visit Date (Optional)
                </label>
                <input
                  type="date"
                  value={newCustomer.lastVisitDate}
                  onChange={(e) => setNewCustomer({ ...newCustomer, lastVisitDate: e.target.value })}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Service Type (Optional)
                </label>
                <input
                  type="text"
                  value={newCustomer.serviceType}
                  onChange={(e) => setNewCustomer({ ...newCustomer, serviceType: e.target.value })}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Job ID (Optional)
                </label>
                <input
                  type="text"
                  value={newCustomer.jobId}
                  onChange={(e) => setNewCustomer({ ...newCustomer, jobId: e.target.value })}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddCustomer}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  Add Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className={`px-6 py-3 rounded-full font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Changes Modal (UI-only, deterministic summary) */}
      {showReviewChangesModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowReviewChangesModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-changes-title"
        >
          <div
            className={`${getPanelClasses(isDark)} max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="review-changes-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Review changes
              </h2>
              <button
                onClick={() => setShowReviewChangesModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close review changes"
              >
                ×
              </button>
            </div>

            <p className={`text-sm ${themeClasses.mutedText}`}>
              A compact preview of what will change compared to your current active snapshot. No values are recomputed here.
            </p>

            <div className={`mt-4 p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <ul className={`list-disc pl-5 space-y-1 text-sm ${themeClasses.labelText}`}>
                {reviewChangesLines.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={confirmCreateNewSnapshotFromPreview}
                disabled={loading || savingToDb}
                className={SUBMIT_BUTTON_CLASSES}
                aria-label="Confirm create new snapshot"
                title="Create snapshot (templates + queue computed once)"
              >
                {loading ? "Processing..." : savingToDb ? "Saving..." : "Create New Snapshot"}
              </button>
              <button
                type="button"
                onClick={() => setShowReviewChangesModal(false)}
                className={`px-6 py-3 rounded-full font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                aria-label="Cancel review changes"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Viewer Modal (read-only) */}
      {historyViewerSnapshot && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setHistoryViewerSnapshotId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-viewer-title"
        >
          <div
            className={`${getPanelClasses(isDark)} max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="snapshot-viewer-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Snapshot Viewer (Read-only)
              </h2>
              <button
                onClick={() => setHistoryViewerSnapshotId(null)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close snapshot viewer"
              >
                ×
              </button>
            </div>

            <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div className={`text-sm font-medium ${themeClasses.headingText}`}>
                {formatSnapshotLabel(historyViewerSnapshot)}
              </div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Snapshot ID: <span className={themeClasses.labelText}>{historyViewerSnapshot.id}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const channels = getSnapshotChannels(historyViewerSnapshot);
                  const queuedCount = historyViewerSnapshot.response?.sendQueue?.length ?? 0;
                  const chipClass = `inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    isDark
                      ? "bg-slate-900/30 border-slate-700 text-slate-300"
                      : "bg-white border-slate-200 text-slate-600"
                  }`;
                  return (
                    <>
                      <span className={chipClass}>Customers: {historyViewerSnapshot.customers.length}</span>
                      <span className={chipClass}>Queued: {queuedCount}</span>
                      <span className={chipClass}>Channels: {channels.length > 0 ? channels.join(", ") : "—"}</span>
                    </>
                  );
                })()}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className={`text-xs font-medium ${themeClasses.labelText}`}>Business</div>
                  <div className={`text-sm ${themeClasses.mutedText}`}>
                    {historyViewerSnapshot.campaign.businessName || "—"}
                  </div>
                </div>
                <div>
                  <div className={`text-xs font-medium ${themeClasses.labelText}`}>Platform</div>
                  <div className={`text-sm ${themeClasses.mutedText}`}>
                    {historyViewerSnapshot.campaign.platform || "—"}
                  </div>
                </div>
              </div>
              <p className={`text-xs mt-4 ${themeClasses.mutedText}`}>
                This viewer is snapshot-derived and does not recompute templates, queue items, or results.
              </p>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              {(() => {
                const isAlreadyActive = snapshotHistory.activeSnapshotId === historyViewerSnapshot.id;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSnapshotExplicit(historyViewerSnapshot);
                      setHistoryViewerSnapshotId(null);
                    }}
                    disabled={isAlreadyActive}
                    className={`${SUBMIT_BUTTON_CLASSES} ${isAlreadyActive ? "opacity-50 cursor-not-allowed" : ""}`}
                    aria-label="Set active snapshot"
                    title={isAlreadyActive ? "This snapshot is already active" : "Set this snapshot as active (explicit)"}
                  >
                    {isAlreadyActive ? "Active Snapshot" : "Set Active Snapshot"}
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => setHistoryViewerSnapshotId(null)}
                className={`px-6 py-3 rounded-full font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                aria-label="Close snapshot viewer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setCsvPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-preview-title"
        >
          <div
            ref={csvModalRef}
            className={`${getPanelClasses(isDark)} max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="csv-preview-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                CSV Preview ({csvPreview.customers.length} valid customers
                {csvPreview.errors.length > 0 && `, ${csvPreview.errors.length} errors`})
              </h2>
              <button
                onClick={() => setCsvPreview(null)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {csvPreview.errors.length > 0 && (
              <div className={`mb-4 p-3 rounded-lg ${isDark ? "bg-yellow-900/20 border border-yellow-700" : "bg-yellow-50 border border-yellow-200"}`}>
                <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Row Errors:</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {csvPreview.errors.map((error, idx) => (
                    <div key={idx} className={`text-xs ${themeClasses.mutedText}`}>
                      Row {error.rowIndex}: {error.errors.join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {csvPreview.customers.map((customer, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-xs ${
                    isDark ? "bg-slate-800" : "bg-slate-100"
                  }`}
                >
                  <span className={themeClasses.labelText}>
                    {customer.customerName} • {customer.phone || customer.email || "No contact"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmCSVImport}
                className={SUBMIT_BUTTON_CLASSES}
                disabled={csvPreview.customers.length === 0}
              >
                Confirm Import ({csvPreview.customers.length} customers)
              </button>
              <button
                type="button"
                onClick={() => setCsvPreview(null)}
                className={`px-6 py-3 rounded-full font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}

export default function ReviewRequestAutomationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReviewRequestAutomationPageContent />
    </Suspense>
  );
}
