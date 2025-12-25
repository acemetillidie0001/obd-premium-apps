"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import ResultCard from "@/components/obd/ResultCard";
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

// Generate UUID for client-side
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ReviewRequestAutomationPageContent() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
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
  const [result, setResult] = useState<ReviewRequestAutomationResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"campaign" | "customers" | "templates" | "queue" | "results">("campaign");
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [selectedQueueItems, setSelectedQueueItems] = useState<Set<string>>(new Set());
  const [expandedInfo, setExpandedInfo] = useState<Set<string>>(new Set());
  
  // Database save state
  const [saveToDb, setSaveToDb] = useState(true); // Default ON
  const [savedDatasetId, setSavedDatasetId] = useState<string | null>(null);
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

  // localStorage persistence
  const STORAGE_KEY = "review-request-automation-data";

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
        if (data.result) {
          setResult(data.result);
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

    // Check DB status on mount
    const checkDbStatus = async () => {
      try {
        const res = await fetch("/api/review-request-automation/latest");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && !data.empty) {
            setDbStatus("connected");
          } else {
            // Check if we have local data
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              setDbStatus("fallback");
            } else {
              setDbStatus("connected"); // Connected but no data yet
            }
          }
        } else if (res.status !== 401) {
          // Not 401, so DB issue
          const saved = localStorage.getItem(STORAGE_KEY);
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
        const saved = localStorage.getItem(STORAGE_KEY);
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
    // Save to localStorage whenever data changes
    try {
      const data = {
        campaign,
        customers,
        events,
        result,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail - localStorage may be unavailable or quota exceeded
    }
  }, [campaign, customers, events, result]);

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

  // Deep linking: Handle query parameters (tab, focus, from=rd)
  useEffect(() => {
    if (!searchParams) return;

    const tab = searchParams.get("tab");
    const focus = searchParams.get("focus");
    const fromRD = searchParams.get("from") === "rd";

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

  const handleProcess = async () => {
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
      setResult(data);
      setActiveTab("results");
      setShowQuickStart(false); // Dismiss quick start when templates are generated
      
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
          : "Something went wrong processing the automation. Please try again."
      );
    } finally {
      setLoading(false);
    }
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
    const queueItem = result?.sendQueue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    const event: Event = {
      id: generateUUID(),
      customerId: queueItem.customerId,
      type: status,
      timestamp: new Date().toISOString(),
    };

    setEvents([...events, event]);
    
    // Re-process to update results
    setTimeout(() => {
      handleProcess();
    }, 100);
  };

  const handleBulkMarkStatus = (status: "sent" | "clicked" | "reviewed" | "optedOut") => {
    if (!result || selectedQueueItems.size === 0) return;

    const newEvents: Event[] = [];
    selectedQueueItems.forEach((queueItemId) => {
      const queueItem = result.sendQueue.find((q) => q.id === queueItemId);
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
      setEvents([...events, ...newEvents]);
      setSelectedQueueItems(new Set());
      
      // Re-process to update results
      setTimeout(() => {
        handleProcess();
      }, 100);
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
    if (!result) return;
    const pendingItems = result.sendQueue.filter((q) => q.status === "pending");
    if (selectedQueueItems.size === pendingItems.length) {
      setSelectedQueueItems(new Set());
    } else {
      setSelectedQueueItems(new Set(pendingItems.map((q) => q.id)));
    }
  };

  const handleExportQueueCSV = () => {
    if (!result || result.sendQueue.length === 0) return;
    
    const headers = ["customerId", "customerName", "scheduledAt", "variant", "channel", "status", "skippedReason"];
    const rows = result.sendQueue.map((item) => {
      const customer = customers.find((c) => c.id === item.customerId);
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
    a.download = `send-queue-${campaign.businessName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCampaignJSON = () => {
    const exportData = {
      campaign,
      customers,
      events,
      result,
      exportedAt: new Date().toISOString(),
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${campaign.businessName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.json`;
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
    // Check if data is saved to database
    if (!saveToDb || !savedDatasetId) {
      setError("Please save your campaign to the database first (enable 'Save to database' toggle and generate templates)");
      return;
    }

    setSendingEmails(true);
    setEmailSendResult(null);
    setError(null);

    try {
      // Fetch latest dataset to get database queue item IDs
      const latestRes = await fetch("/api/review-request-automation/latest");
      if (!latestRes.ok) {
        throw new Error("Failed to fetch latest dataset. Please ensure your campaign is saved.");
      }

      const latestData = await latestRes.json();
      if (!latestData.ok || latestData.empty) {
        throw new Error("No saved campaign found. Please save your campaign first.");
      }

      // If specific queue item IDs provided, use those; otherwise fetch all pending EMAIL items from DB
      let itemsToSend: string[];
      if (queueItemIds && queueItemIds.length > 0) {
        itemsToSend = queueItemIds;
      } else {
        // Fetch pending EMAIL queue items from database
        // Note: We'll need to get these from the database, but for now we'll use the API
        // which will fetch them server-side
        itemsToSend = []; // Empty array means "send all pending EMAIL items"
      }

      const res = await fetch("/api/review-request-automation/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: queueItemIds && queueItemIds.length > 0 ? "single" : "batch",
          queueItemIds: itemsToSend.length > 0 ? itemsToSend : undefined, // If empty, server will fetch all pending
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

      // Re-process to update local state
      if (result) {
        setTimeout(() => {
          handleProcess();
        }, 1000);
      }
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

  const filteredCustomers = customers;

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Review Request Automation"
      tagline="Send automatic review requests by email or SMS after each visit."
    >
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
                  {" "}— Set up business info, review link, and automation rules
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
                    Generate templates
                  </button>
                  {" "}— Click &quot;Generate Templates &amp; Queue&quot; to create message templates
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
                    Work the send queue
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
            title={`Switch to ${tab} tab`}
            aria-label={`${tab} tab`}
            aria-current={activeTab === tab ? "page" : undefined}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign Tab */}
      {activeTab === "campaign" && (
        <OBDPanel isDark={isDark} className="mt-7">
          <form onSubmit={(e) => { e.preventDefault(); handleProcess(); }}>
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
                    {result?.businessTypeRecommendation && (
                      <div className={`mt-2 p-3 rounded-lg ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className={`text-xs font-semibold mb-1 ${themeClasses.headingText}`}>
                              Recommended Settings for {result.businessTypeRecommendation.businessType}
                            </div>
                            <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>
                              {result.businessTypeRecommendation.explanation}
                            </p>
                            <div className={`text-xs space-y-1 ${themeClasses.mutedText}`}>
                              <div>Send Delay: {result.businessTypeRecommendation.sendDelayHours.recommended} hours (range: {result.businessTypeRecommendation.sendDelayHours.min}-{result.businessTypeRecommendation.sendDelayHours.max})</div>
                              {campaign.rules.followUpEnabled && (
                                <div>Follow-Up Delay: {result.businessTypeRecommendation.followUpDelayDays.recommended} days (range: {result.businessTypeRecommendation.followUpDelayDays.min}-{result.businessTypeRecommendation.followUpDelayDays.max})</div>
                              )}
                              <div>Tone Style: {result.businessTypeRecommendation.toneStyle.join(" or ")}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const rec = result.businessTypeRecommendation;
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
                                const rec = result.businessTypeRecommendation;
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
                  Automation Rules
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
                          Quiet hours prevent sending messages during times when customers are likely sleeping or busy. Messages sent during quiet hours are automatically scheduled for the next allowed time. Default is 9 AM to 7 PM.
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

              <button
                type="submit"
              disabled={loading || savingToDb}
              className={SUBMIT_BUTTON_CLASSES}
              title="Generate message templates and compute send queue"
              aria-label="Generate templates and queue"
            >
              {loading ? "Processing..." : savingToDb ? "Saving..." : "Generate Templates & Queue"}
            </button>
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
                {customers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                    title="Export customers to CSV file"
                    aria-label="Export customers CSV"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleExportCSV();
                      }
                    }}
                  >
                    Export CSV
                  </button>
                )}
              </div>
            </div>

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
        {result ? (
          <div className="mt-7 space-y-7">
          <OBDPanel isDark={isDark}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                Message Templates
              </h3>
              <button
                type="button"
                onClick={handleProcess}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title="Regenerate message templates"
                aria-label="Generate templates again"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleProcess();
                  }
                }}
              >
                Generate Again
              </button>
            </div>
            <div className="space-y-4">
              {result.templateQuality.map((quality) => {
                const templateKey = quality.templateKey;
                const templateText = templateKey === "email" 
                  ? `${result.templates.email.subject}\n\n${result.templates.email.body}`
                  : result.templates[templateKey];
                const copyText = templateKey === "email"
                  ? `Subject: ${result.templates.email.subject}\n\n${result.templates.email.body}`
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
                            <p>{result.templates.email.subject}</p>
                          </div>
                          <div>
                            <p className={`font-medium mb-1 ${themeClasses.headingText}`}>Body:</p>
                            <p className="whitespace-pre-wrap">{result.templates.email.body}</p>
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
              No templates generated yet. Configure your campaign and click &quot;Generate Templates &amp; Queue&quot; to create message templates.
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
        {result ? (
        <>
          {/* Send Timeline */}
          {result.sendTimeline.events.length > 0 ? (
            <OBDPanel isDark={isDark} className="mt-7">
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Send Timeline
              </h3>
              <div className="relative">
                <div className="flex items-center justify-between relative">
                  {result.sendTimeline.events.map((event) => {
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
                Timeline appears after customers are queued.
              </p>
            </OBDPanel>
          )}
          <OBDPanel isDark={isDark} className="mt-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
              Send Queue ({result.sendQueue.length} items)
            </h3>
            <div className="flex gap-2">
              {result.sendQueue.some((q) => q.status === "pending" && q.channel === "email") && (
                <button
                  type="button"
                  onClick={() => handleSendEmails()}
                  disabled={sendingEmails || !saveToDb || !savedDatasetId}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sendingEmails || !saveToDb || !savedDatasetId
                      ? "opacity-50 cursor-not-allowed"
                      : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                  }`}
                  title={
                    !saveToDb || !savedDatasetId
                      ? "Please save your campaign to the database first"
                      : "Send all pending EMAIL queue items via Resend"
                  }
                  aria-label="Send emails now"
                >
                  {sendingEmails ? "Sending..." : "Send Emails Now"}
                </button>
              )}
              <button
                type="button"
                onClick={handleExportQueueCSV}
                disabled={!result || result.sendQueue.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !result || result.sendQueue.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title="Export send queue to CSV"
                aria-label="Export send queue to CSV"
              >
                Export Queue CSV
              </button>
              <button
                type="button"
                onClick={handleExportCampaignJSON}
                disabled={!campaign.businessName}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !campaign.businessName
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title="Export campaign data to JSON"
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
          {result.sendQueue.length > 0 && result.sendQueue.some((q) => q.status === "pending") && (
            <div className={`mb-4 p-3 rounded-lg border ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={result.sendQueue.filter((q) => q.status === "pending").length > 0 && 
                             selectedQueueItems.size === result.sendQueue.filter((q) => q.status === "pending").length}
                    onChange={handleSelectAllQueueItems}
                    className="rounded"
                    aria-label="Select all pending queue items"
                  />
                  <span className={`text-sm ${themeClasses.labelText}`}>
                    Select All ({result.sendQueue.filter((q) => q.status === "pending").length} pending)
                  </span>
                </label>
                {selectedQueueItems.size > 0 && (
                  <>
                    <span className={`text-sm ${themeClasses.mutedText}`}>
                      {selectedQueueItems.size} selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBulkMarkStatus("sent")}
                        className="px-3 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300"
                        title="Mark selected items as sent"
                        aria-label="Mark selected items as sent"
                      >
                        Mark Selected as Sent
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkMarkStatus("clicked")}
                        className="px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300"
                        title="Mark selected items as clicked"
                        aria-label="Mark selected items as clicked"
                      >
                        Mark Selected as Clicked
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkMarkStatus("reviewed")}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300"
                        title="Mark selected items as reviewed"
                        aria-label="Mark selected items as reviewed"
                      >
                        Mark Selected as Reviewed
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {result.sendQueue.length === 0 ? (
            <p className={`text-sm ${themeClasses.mutedText} py-4`}>
              No items in send queue. Generate templates and queue to see scheduled sends.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {result.sendQueue.map((item) => {
                const customer = customers.find((c) => c.id === item.customerId);
                const firstName = customer?.customerName?.split(" ")[0] || "Customer";
                let personalizedText: string;
                if (item.variant === "email") {
                  personalizedText = `Subject: ${result.templates.email.subject.replace(/{firstName}/g, firstName)}\n\n${result.templates.email.body.replace(/{firstName}/g, firstName)}`;
                } else {
                  const templateText = result.templates[item.variant];
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
                                disabled={sendingEmails || !saveToDb || !savedDatasetId}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  sendingEmails || !saveToDb || !savedDatasetId
                                    ? "opacity-50 cursor-not-allowed bg-slate-400 text-slate-200"
                                    : "bg-[#29c4a9] text-white hover:bg-[#1EB9A7]"
                                }`}
                                title={
                                  !saveToDb || !savedDatasetId
                                    ? "Please save your campaign to the database first"
                                    : "Send all pending emails (including this one)"
                                }
                                aria-label="Send emails"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (!sendingEmails && saveToDb && savedDatasetId) {
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
              No send queue available. Generate templates and queue to see scheduled sends.
            </p>
          </OBDPanel>
        )}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (
        result ? (
          <div className="mt-7 space-y-7">
            {/* Campaign Health Badge */}
            <OBDPanel isDark={isDark}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                  Campaign Health
                </h3>
                <div className="relative group">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.campaignHealth.status === "Good" 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      : result.campaignHealth.status === "Needs Attention"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                  }`}>
                    {result.campaignHealth.status} ({result.campaignHealth.score}/100)
                  </span>
                  <div className={`absolute right-0 top-full mt-2 w-64 p-3 rounded-lg shadow-lg z-10 hidden group-hover:block ${
                    isDark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-200"
                  }`}>
                    <div className={`text-xs font-semibold mb-2 ${themeClasses.headingText}`}>
                      How it&apos;s calculated:
                    </div>
                    <ul className={`text-xs space-y-1 ${themeClasses.mutedText} list-disc list-inside`}>
                      {result.campaignHealth.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </OBDPanel>
            
            {/* Guidance Benchmarks */}
            {result.guidanceBenchmarks.length > 0 && (
              <OBDPanel isDark={isDark}>
                <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                  Best-Practice Guidance
                </h3>
                <div className="space-y-3">
                  {result.guidanceBenchmarks.map((benchmark) => (
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
                  {result.metrics.loaded}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Loaded</div>
              </div>
            </OBDPanel>
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {result.metrics.ready}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Ready</div>
              </div>
            </OBDPanel>
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {result.metrics.queued}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Queued</div>
              </div>
            </OBDPanel>
            <OBDPanel isDark={isDark}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                  {result.metrics.reviewed}
                </div>
                <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Reviewed</div>
              </div>
            </OBDPanel>
          </div>

          {/* Quality Checks */}
          {result.qualityChecks.length > 0 && (
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Quality Checks
              </h3>
              <div className="space-y-3">
                {result.qualityChecks.map((check) => {
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
          {result.nextActions.length > 0 && (
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Next Actions
              </h3>
              <div className="space-y-3">
                {result.nextActions.map((action) => (
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
              No results available. Generate templates and queue to see metrics and insights.
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
