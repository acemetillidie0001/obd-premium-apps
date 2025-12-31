"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import { isValidReturnUrl } from "@/lib/utils/crm-integration-helpers";
import { CrmIntegrationIndicator } from "@/components/crm/CrmIntegrationIndicator";
import type {
  SearchResponse,
  ChatResponse,
  SearchResult,
  ChatSource,
} from "@/lib/apps/ai-help-desk/types";
import KnowledgeList, { type KnowledgeEntry } from "./knowledge/components/KnowledgeList";
import KnowledgeEditor from "./knowledge/components/KnowledgeEditor";
import InsightsPanel from "./insights/components/InsightsPanel";
import WebsiteImport from "./knowledge/components/WebsiteImport";
import WidgetSettings from "./widget/components/WidgetSettings";

type ViewMode = "search" | "chat";
type TabMode = "help-desk" | "knowledge" | "insights" | "widget";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

interface SetupStatus {
  env: {
    hasBaseUrl: boolean;
    hasApiKey: boolean;
    baseUrlPreview: string | null;
  };
  db: {
    canQuery: boolean;
    hasAiWorkspaceMap: boolean;
  };
}

interface MappingData {
  id: string;
  businessId: string;
  workspaceSlug: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionTestResult {
  searchOk: boolean;
  chatOk: boolean;
  sourcesCount: number;
  timestamp: number;
  isFallback?: boolean;
}

type ConnectionStatus = "green" | "yellow" | "red" | "checking";

const defaultBusinessId = "";

function AIHelpDeskPageContent() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();

  // Setup state
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  // Business selection
  const [businessId, setBusinessId] = useState(defaultBusinessId);
  const [businessName, setBusinessName] = useState("");
  const [currentMapping, setCurrentMapping] = useState<MappingData | null>(null);
  const [mappingCheckLoading, setMappingCheckLoading] = useState(false);
  const [mappingCheckError, setMappingCheckError] = useState<string | null>(null);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking");
  const connectionTestCache = useRef<Map<string, ConnectionTestResult>>(new Map());
  
  // Health panel state
  const [healthPanelExpanded, setHealthPanelExpanded] = useState(false);
  const [lastSuccessfulSearch, setLastSuccessfulSearch] = useState<number | null>(null);
  const [lastSuccessfulChat, setLastSuccessfulChat] = useState<number | null>(null);
  const [lastTestResult, setLastTestResult] = useState<ConnectionTestResult | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  
  // Track if we're in development mode (for demo banner - client-safe)
  const [isDevMode, setIsDevMode] = useState(false);

  // Tab mode
  const [tabMode, setTabMode] = useState<TabMode>("help-desk");

  // View mode (search vs chat) - only for help-desk tab
  const [viewMode, setViewMode] = useState<ViewMode>("search");

  // Knowledge state
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [initialEditorTitle, setInitialEditorTitle] = useState<string | undefined>(undefined);
  const [knowledgeReloadKey, setKnowledgeReloadKey] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>();

  // Refs for auto-scrolling chat
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current && messagesContainerRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Load setup status and admin check on mount
  useEffect(() => {
    loadSetupStatus();
    checkAdminStatus();
    // Set dev mode flag (client-side only, safe to check on mount)
    setIsDevMode(process.env.NODE_ENV === "development");
  }, []);

  // CRM integration state
  const [crmContextLoaded, setCrmContextLoaded] = useState(false);
  const [crmReturnUrl, setCrmReturnUrl] = useState<string | null>(null);
  const [showCrmBanner, setShowCrmBanner] = useState(true);

  // Handle CRM integration prefill
  useEffect(() => {
    if (searchParams && typeof window !== "undefined") {
      const context = searchParams.get("context");
      const fromCRM = searchParams.get("from") === "crm";
      const contactId = searchParams.get("contactId");
      const returnUrl = searchParams.get("returnUrl");
      
      // Store CRM return URL if valid (check both fromCRM and context=crm)
      if ((fromCRM || context === "crm") && returnUrl && isValidReturnUrl(returnUrl)) {
        setCrmReturnUrl(returnUrl);
      } else {
        setCrmReturnUrl(null);
      }
      
      if (context === "crm") {
        // Try to read prompt from sessionStorage first (privacy-friendly)
        let prompt: string | null = null;
        try {
          const storedPrompt = sessionStorage.getItem("obd_ai_helpdesk_prefill_prompt");
          const storedContactId = sessionStorage.getItem("obd_ai_helpdesk_prefill_contactId");
          
          // Verify contactId matches if both are present
          if (storedPrompt && (!storedContactId || storedContactId === contactId)) {
            prompt = storedPrompt;
            // Remove from sessionStorage after reading (one-time use)
            sessionStorage.removeItem("obd_ai_helpdesk_prefill_prompt");
            sessionStorage.removeItem("obd_ai_helpdesk_prefill_contactId");
          }
        } catch (error) {
          // Silently fail if sessionStorage is unavailable
          console.warn("Failed to read prompt from sessionStorage:", error);
        }
        
        // Fall back to query param if sessionStorage didn't have it (backward compatibility)
        if (!prompt) {
          prompt = searchParams.get("prompt");
        }
        
        if (prompt) {
          // Prefill chat input with prompt from CRM
          setChatInput(prompt);
        }
        // Set CRM context loaded flag even if no prompt (for banner display)
        setCrmContextLoaded(true);
        // Switch to chat mode if not already
        if (viewMode !== "chat") {
          setViewMode("chat");
        }
        // Switch to help-desk tab
        setTabMode("help-desk");
      }
    }
  }, [searchParams, viewMode]);

  // Check if current user is admin
  const checkAdminStatus = async () => {
    setAdminCheckLoading(true);
    try {
      const res = await fetch("/api/ai-help-desk/setup/admin");
      const json = await res.json();

      if (res.ok && json.ok && json.data) {
        setIsAdmin(json.data.isAdmin || false);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Admin check error:", error);
      setIsAdmin(false);
    } finally {
      setAdminCheckLoading(false);
    }
  };

  // Update connection status based on test result
  const updateConnectionStatus = useCallback((result: ConnectionTestResult) => {
    if (result.searchOk && result.chatOk && result.sourcesCount > 0) {
      setConnectionStatus("green");
    } else if (result.searchOk && result.chatOk && result.sourcesCount === 0) {
      setConnectionStatus("yellow");
    } else {
      setConnectionStatus("red");
    }
  }, []);

  // Check mapping when businessId changes (if setup is complete)
  useEffect(() => {
    if (setupComplete && businessId.trim()) {
      checkMapping(businessId.trim());
    } else {
      setCurrentMapping(null);
      setConnectionStatus("checking");
    }
  }, [businessId, setupComplete]);

  // Test connection when mapping is found (cached per session)
  useEffect(() => {
    const testConnection = async () => {
      if (!currentMapping || !businessId.trim()) {
        setConnectionStatus("checking");
        return;
      }

      const cacheKey = `${currentMapping.workspaceSlug}-${businessId}`;
      const cached = connectionTestCache.current.get(cacheKey);
      
      // Use cached result if it exists and is less than 5 minutes old
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setLastTestResult(cached);
        updateConnectionStatus(cached);
        return;
      }

      // Run test silently
      setConnectionStatus("checking");
      try {
        const res = await fetch("/api/ai-help-desk/setup/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: businessId.trim(),
            query: "test",
          }),
        });

        const json = await res.json();

        if (res.ok && json.ok && json.data) {
          const result: ConnectionTestResult = {
            searchOk: json.data.searchOk || false,
            chatOk: json.data.chatOk || false,
            sourcesCount: json.data.sourcesCount || 0,
            timestamp: Date.now(),
            isFallback: json.data.isFallback || false,
          };

          // Cache the result
          connectionTestCache.current.set(cacheKey, result);

          updateConnectionStatus(result);
        } else {
          // Test failed
          setConnectionStatus("red");
        }
      } catch (error) {
        console.error("Connection test error:", error);
        setConnectionStatus("red");
      }
    };

    testConnection();
  }, [currentMapping, businessId, updateConnectionStatus]);

  // Load setup status
  const loadSetupStatus = async () => {
    setSetupLoading(true);
    try {
      const res = await fetch("/api/ai-help-desk/setup/status");
      const json = await res.json();

      if (!res.ok || !json.ok) {
        // If status check fails, assume setup is incomplete
        setSetupStatus(null);
        setSetupComplete(false);
        return;
      }

      const status = json.data as SetupStatus;
      setSetupStatus(status);

      // Setup is complete if:
      // 1. Base URL is set
      // 2. AiWorkspaceMap table exists
      // (db.canQuery is not required for the setup check - it's informational)
      const isComplete =
        status.env.hasBaseUrl &&
        status.db.hasAiWorkspaceMap;

      setSetupComplete(isComplete);
    } catch (error) {
      console.error("Setup status error:", error);
      setSetupStatus(null);
      setSetupComplete(false);
    } finally {
      setSetupLoading(false);
    }
  };

  // Check mapping for a business ID
  const checkMapping = async (id: string) => {
    setMappingCheckLoading(true);
    setMappingCheckError(null);

    try {
      const res = await fetch(
        `/api/ai-help-desk/setup/mapping?businessId=${encodeURIComponent(id)}`
      );
      const json = await res.json();

      if (res.ok && json.ok && json.data) {
        setCurrentMapping(json.data);
      } else {
        setCurrentMapping(null);
      }
    } catch (error) {
      console.error("Mapping check error:", error);
      setMappingCheckError(
        error instanceof Error ? error.message : "Failed to check business connection"
      );
      setCurrentMapping(null);
    } finally {
      setMappingCheckLoading(false);
    }
  };

  // Handle manual mapping check button click
  const handleCheckMapping = () => {
    if (!businessId.trim()) {
      setMappingCheckError("Please enter a business name first");
      return;
    }
    checkMapping(businessId.trim());
  };

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessId.trim()) {
      setSearchError("Business name is required");
      return;
    }

    if (!searchQuery.trim()) {
      setSearchError("Search query is required");
      return;
    }

    setSearchError(null);
    setSearchLoading(true);
    setSelectedResult(null);

    try {
      const res = await fetch("/api/ai-help-desk/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          query: searchQuery.trim(),
          limit: 10,
        }),
      });

      const jsonResponse = await res.json();

      if (!res.ok || !jsonResponse.ok) {
        const errorMessage =
          jsonResponse.error || "Failed to search help desk";
        throw new Error(errorMessage);
      }

      const data = (jsonResponse.data || jsonResponse) as SearchResponse["data"];
      setSearchResults(data.results || []);
      setLastSuccessfulSearch(Date.now());
    } catch (error) {
      console.error("Search error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setSearchError(errorMessage);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessId.trim()) {
      setChatError("Business name is required");
      return;
    }

    if (!chatInput.trim()) {
      setChatError("Message is required");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const res = await fetch("/api/ai-help-desk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessId.trim(),
          message: userMessage.content,
          threadId: currentThreadId,
        }),
      });

      const jsonResponse = await res.json();

      if (!res.ok || !jsonResponse.ok) {
        const errorMessage =
          jsonResponse.error || "Failed to get chat response";
        throw new Error(errorMessage);
      }

      const data = (jsonResponse.data || jsonResponse) as ChatResponse["data"];

      // Update thread ID if provided
      if (data.threadId) {
        setCurrentThreadId(data.threadId);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "I couldn't find that in your business help desk yet.",
        sources: data.sources,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
      setLastSuccessfulChat(Date.now());
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      // Add error message to chat
      const errorMessageObj: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `I'm sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessageObj]);
      setChatError(errorMessage);
    } finally {
      setChatLoading(false);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedResult(null);
    setSearchError(null);
  };

  // Start new conversation
  const handleNewConversation = () => {
    setChatMessages([]);
    setCurrentThreadId(undefined);
    setChatError(null);
    setChatInput("");
  };

  // Use selected result in chat
  const handleUseInChat = (result: SearchResult) => {
    setViewMode("chat");
    setChatInput(result.snippet || result.title);
    // Scroll to chat input after a brief delay
    setTimeout(() => {
      const chatInputElement = document.getElementById("chat-input");
      chatInputElement?.focus();
    }, 100);
  };

  // Generate business ID from business name (simple slug)
  useEffect(() => {
    if (businessName.trim()) {
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      setBusinessId(slug);
    } else {
      setBusinessId("");
    }
  }, [businessName]);

  // Determine if setup is required (env/db level, not business-specific)
  // Setup is required if ANYTHINGLLM_BASE_URL is missing OR AiWorkspaceMap table is missing
  const needsSetup =
    !setupStatus ||
    !setupStatus.env.hasBaseUrl ||
    !setupStatus.db.hasAiWorkspaceMap;

  // Determine if we can show the main UI
  // Can show UI if: setup is complete (env + table exist) AND (mapping exists OR no businessId entered yet OR mapping check is in progress)
  // Note: Dev fallback (AI_HELP_DESK_DEV_WORKSPACE_SLUG) is handled server-side, so we still require mapping here
  // but the server will use dev fallback if NODE_ENV is not production
  // Allow UI to show while user is typing (mappingCheckLoading) to prevent disappearing input
  const canShowMainUI =
    !needsSetup &&
    setupStatus &&
    setupStatus.env.hasBaseUrl &&
    setupStatus.db.hasAiWorkspaceMap &&
    (!businessId.trim() || currentMapping || mappingCheckLoading);

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="AI Help Desk"
      tagline="Search your help desk knowledge and get AI-powered answers to questions."
    >
      <CrmIntegrationIndicator
        isDark={isDark}
        showContextPill={false}
        showBackLink={!!crmReturnUrl}
        returnUrl={crmReturnUrl}
      />

      {/* Connection Status Badge */}
      {canShowMainUI && currentMapping && connectionStatus !== "checking" && (
        <div className="mt-3 flex items-center">
          <ConnectionStatusBadge
            status={connectionStatus}
            isDark={isDark}
            onRedClick={() => {
              window.location.href = `/apps/ai-help-desk/setup?businessId=${encodeURIComponent(businessId)}`;
            }}
          />
        </div>
      )}

      {/* Setup Status Loading */}
      {setupLoading && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>
            <p>Checking setup status...</p>
          </div>
        </OBDPanel>
      )}

      {/* Setup Required Panel */}
      {!setupLoading && needsSetup && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="space-y-4">
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-2">
                Setup Required
              </OBDHeading>
              <p className={`text-sm ${themeClasses.mutedText} mb-4`}>
                The AI Help Desk needs to be configured before you can use it.
              </p>
            </div>

            {/* Show specific missing items */}
            {setupStatus && (
              <div className="space-y-2">
                {!setupStatus.env.hasBaseUrl && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                  }`}>
                    <p className={`text-sm ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
                      ⚠ Environment variable ANYTHINGLLM_BASE_URL is missing
                    </p>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Add this environment variable to connect to your AnythingLLM instance.
                    </p>
                  </div>
                )}
                {!setupStatus.db.hasAiWorkspaceMap && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                  }`}>
                    <p className={`text-sm ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
                      ⚠ Database table for business connections is missing
                    </p>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Run the database migration to create the required table.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/apps/ai-help-desk/setup"
                className={SUBMIT_BUTTON_CLASSES + " text-center"}
              >
                Open Setup Wizard
              </Link>
              <button
                type="button"
                onClick={loadSetupStatus}
                disabled={setupLoading}
                className={`px-6 py-3 text-center font-medium rounded-full border transition-colors ${
                  setupLoading
                    ? isDark
                      ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : isDark
                      ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Re-check Status
              </button>
            </div>
          </div>
        </OBDPanel>
      )}

      {/* Business Name Input - Always show when setup is complete (never disappears while typing) */}
      {!setupLoading && !needsSetup && setupStatus && setupStatus.env.hasBaseUrl && setupStatus.db.hasAiWorkspaceMap && (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="businessName"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Business Name <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={getInputClasses(isDark, "flex-1")}
                  placeholder="Enter your business name"
                  required
                />
                <button
                  type="button"
                  onClick={handleCheckMapping}
                  disabled={mappingCheckLoading || !businessId.trim()}
                  className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
                    mappingCheckLoading || !businessId.trim()
                      ? isDark
                        ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : isDark
                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {mappingCheckLoading ? "Checking..." : "Check Connection"}
                </button>
              </div>
              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                This helps scope search and chat to your help desk knowledge.
              </p>
            </div>

            {/* Mapping Status */}
            {currentMapping && (
              <div className={`p-3 rounded-lg border ${
                isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-green-400" : "text-green-800"}`}>
                      ✓ Business connection found
                    </p>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Help Desk Knowledge: <strong>{currentMapping.workspaceSlug}</strong>
                    </p>
                  </div>
                  <Link
                    href={`/apps/ai-help-desk/setup?businessId=${encodeURIComponent(businessId)}`}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )}

            {mappingCheckError && (
              <div className={getErrorPanelClasses(isDark)}>
                <p className="text-sm">{mappingCheckError}</p>
              </div>
            )}

            {/* Mapping Missing Warning */}
            {businessId.trim() &&
              !currentMapping &&
              !mappingCheckLoading &&
              !mappingCheckError && (
                <div className={`p-4 rounded-lg border ${
                  isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-1 ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
                        ⚠ This business isn't connected yet
                      </p>
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        To use the AI Help Desk, connect this business to its knowledge base.
                      </p>
                    </div>
                    <Link
                      href={`/apps/ai-help-desk/setup?businessId=${encodeURIComponent(businessId)}`}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                        isDark
                          ? "border-yellow-700 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40"
                          : "border-yellow-600 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                      }`}
                    >
                      Connect This Business
                    </Link>
                  </div>
                  <p className={`text-xs mt-3 ${themeClasses.mutedText} opacity-75`}>
                    This is a one-time setup. Your data stays isolated and private.
                  </p>
                </div>
              )}
          </div>
        </OBDPanel>
      )}

      {/* Main UI - Only show if setup is complete AND mapping exists (unless no businessId entered yet) */}
      {!setupLoading && canShowMainUI && (
        <>
          {/* Tabs */}
          <div className="mt-6">
            <div className="flex gap-2 border-b" style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}>
              <button
                type="button"
                onClick={() => setTabMode("help-desk")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabMode === "help-desk"
                    ? isDark
                      ? "border-[#29c4a9] text-[#29c4a9]"
                      : "border-[#29c4a9] text-[#29c4a9]"
                    : isDark
                      ? "border-transparent text-slate-400 hover:text-slate-200"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Help Desk
              </button>
              <button
                type="button"
                onClick={() => setTabMode("knowledge")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabMode === "knowledge"
                    ? isDark
                      ? "border-[#29c4a9] text-[#29c4a9]"
                      : "border-[#29c4a9] text-[#29c4a9]"
                    : isDark
                      ? "border-transparent text-slate-400 hover:text-slate-200"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Knowledge
              </button>
              <button
                type="button"
                onClick={() => setTabMode("insights")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabMode === "insights"
                    ? isDark
                      ? "border-[#29c4a9] text-[#29c4a9]"
                      : "border-[#29c4a9] text-[#29c4a9]"
                    : isDark
                      ? "border-transparent text-slate-400 hover:text-slate-200"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Insights
              </button>
              <button
                type="button"
                onClick={() => setTabMode("widget")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabMode === "widget"
                    ? isDark
                      ? "border-[#29c4a9] text-[#29c4a9]"
                      : "border-[#29c4a9] text-[#29c4a9]"
                    : isDark
                      ? "border-transparent text-slate-400 hover:text-slate-200"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Widget
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {tabMode === "help-desk" && (
            <div className="mt-6">
            {/* Mobile: Tabs */}
            <div className="lg:hidden mb-4">
          <div className="flex gap-2 border-b" style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}>
            <button
              type="button"
              onClick={() => setViewMode("search")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                viewMode === "search"
                  ? isDark
                    ? "border-[#29c4a9] text-[#29c4a9]"
                    : "border-[#29c4a9] text-[#29c4a9]"
                  : isDark
                    ? "border-transparent text-slate-400 hover:text-slate-200"
                    : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chat")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                viewMode === "chat"
                  ? isDark
                    ? "border-[#29c4a9] text-[#29c4a9]"
                    : "border-[#29c4a9] text-[#29c4a9]"
                  : isDark
                    ? "border-transparent text-slate-400 hover:text-slate-200"
                    : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Chat
            </button>
          </div>
            </div>

            {/* Desktop: Split Layout */}
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
              {/* Search Panel */}
              <div>
            <SearchPanel
              isDark={isDark}
              themeClasses={themeClasses}
              businessId={businessId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              searchError={searchError}
              selectedResult={selectedResult}
              setSelectedResult={setSelectedResult}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
              onUseInChat={handleUseInChat}
            />
              </div>

              {/* Chat Panel */}
              <div>
            <ChatPanel
              isDark={isDark}
              themeClasses={themeClasses}
              businessId={businessId}
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatLoading={chatLoading}
              chatError={chatError}
              messagesContainerRef={messagesContainerRef}
              chatEndRef={chatEndRef}
              onChatSubmit={handleChatSubmit}
              onNewConversation={handleNewConversation}
              crmContextLoaded={crmContextLoaded}
              onDismissCrmContext={() => setCrmContextLoaded(false)}
              crmReturnUrl={crmReturnUrl}
              showCrmBanner={showCrmBanner}
              onDismissCrmBanner={() => setShowCrmBanner(false)}
            />
              </div>
            </div>

            {/* Mobile: Single View */}
            <div className="lg:hidden">
          {viewMode === "search" ? (
            <SearchPanel
              isDark={isDark}
              themeClasses={themeClasses}
              businessId={businessId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              searchError={searchError}
              selectedResult={selectedResult}
              setSelectedResult={setSelectedResult}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
              onUseInChat={handleUseInChat}
            />
          ) : (
            <ChatPanel
              isDark={isDark}
              themeClasses={themeClasses}
              businessId={businessId}
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatLoading={chatLoading}
              chatError={chatError}
              messagesContainerRef={messagesContainerRef}
              chatEndRef={chatEndRef}
              onChatSubmit={handleChatSubmit}
              onNewConversation={handleNewConversation}
              crmContextLoaded={crmContextLoaded}
              onDismissCrmContext={() => setCrmContextLoaded(false)}
              crmReturnUrl={crmReturnUrl}
              showCrmBanner={showCrmBanner}
              onDismissCrmBanner={() => setShowCrmBanner(false)}
            />
        )}
            </div>
          </div>
          )}

          {tabMode === "knowledge" && (
            <div className="mt-6 space-y-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-semibold ${themeClasses.headingText}`}>
                    Knowledge Manager
                  </h2>
                  <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                    Manage your FAQs, services, policies, and notes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntry(null);
                    setIsEditorOpen(true);
                  }}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  + Add Entry
                </button>
              </div>
              
              {/* Website Import Panel */}
              <WebsiteImport
                isDark={isDark}
                businessId={businessId}
                onImportComplete={() => {
                  // Trigger reload of KnowledgeList
                  setKnowledgeReloadKey((prev) => prev + 1);
                }}
              />

              {/* Knowledge List */}
              <div key={knowledgeReloadKey}>
                <KnowledgeList
                  isDark={isDark}
                  businessId={businessId}
                  onEdit={(entry) => {
                    setEditingEntry(entry);
                    setIsEditorOpen(true);
                  }}
                  onDelete={() => {}} // Handled internally
                  onToggleActive={() => {}} // Handled internally
                />
              </div>
            </div>
          )}

          {tabMode === "insights" && (
            <div className="mt-6">
              <InsightsPanel
                isDark={isDark}
                businessId={businessId}
                onTurnIntoFAQ={(question) => {
                  // Create a new FAQ entry with the question as title
                  setEditingEntry(null);
                  setInitialEditorTitle(question);
                  setIsEditorOpen(true);
                  // Switch to Knowledge tab to see the new entry
                  setTabMode("knowledge");
                }}
              />
            </div>
          )}

          {tabMode === "widget" && (
            <div className="mt-6">
              <WidgetSettings isDark={isDark} businessId={businessId} businessName={businessName} />
            </div>
          )}

          {/* Knowledge Editor Modal */}
          {isEditorOpen && (
            <KnowledgeEditor
              isDark={isDark}
              businessId={businessId}
              entry={editingEntry}
              initialTitle={initialEditorTitle}
              onClose={() => {
                setIsEditorOpen(false);
                setEditingEntry(null);
                setInitialEditorTitle(undefined);
              }}
              onSave={() => {
                // Trigger reload in KnowledgeList by closing and reopening
                setIsEditorOpen(false);
                setEditingEntry(null);
                setInitialEditorTitle(undefined);
              }}
            />
          )}

          {/* Demo Mode Banner (Dev-only, shown when using fallback workspace) */}
          {isDevMode && lastTestResult?.isFallback && (
            <OBDPanel isDark={isDark} className="mt-6">
              <div className={`p-4 rounded-lg border ${
                isDark ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
              }`}>
                <p className={`text-sm ${isDark ? "text-blue-300" : "text-blue-800"}`}>
                  <strong>Demo Mode:</strong> Using your developer help desk workspace (not a business-specific connection).
                </p>
              </div>
            </OBDPanel>
          )}

          {/* Help Desk Health Panel (Admin Only) */}
          {!adminCheckLoading && isAdmin && currentMapping && (
            <HelpDeskHealthPanel
              isDark={isDark}
              themeClasses={themeClasses}
              isExpanded={healthPanelExpanded}
              onToggle={() => setHealthPanelExpanded(!healthPanelExpanded)}
              workspaceSlug={currentMapping.workspaceSlug}
              lastSuccessfulSearch={lastSuccessfulSearch}
              lastSuccessfulChat={lastSuccessfulChat}
              sourcesCount={lastTestResult?.sourcesCount}
              baseUrl={setupStatus?.env.baseUrlPreview || null}
              businessId={businessId}
            />
          )}
        </>
      )}
    </OBDPageContainer>
  );
}

// Help Desk Health Panel Component (Admin Only)
interface HelpDeskHealthPanelProps {
  isDark: boolean;
  themeClasses: ReturnType<typeof getThemeClasses>;
  isExpanded: boolean;
  onToggle: () => void;
  workspaceSlug: string;
  lastSuccessfulSearch: number | null;
  lastSuccessfulChat: number | null;
  sourcesCount: number | undefined;
  baseUrl: string | null;
  businessId: string;
}

function HelpDeskHealthPanel({
  isDark,
  themeClasses,
  isExpanded,
  onToggle,
  workspaceSlug,
  lastSuccessfulSearch,
  lastSuccessfulChat,
  sourcesCount,
  baseUrl,
  businessId,
}: HelpDeskHealthPanelProps) {
  // Format timestamp to readable string
  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  // Construct AnythingLLM workspace URL
  const workspaceUrl = baseUrl
    ? `${baseUrl}/workspace/${workspaceSlug}`
    : null;

  return (
    <OBDPanel isDark={isDark} className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={isExpanded}
        aria-controls="health-panel-content"
      >
        <OBDHeading level={2} isDark={isDark} className="mb-0">
          Help Desk Health
        </OBDHeading>
        <span className={`text-lg transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div id="health-panel-content" className="mt-4 space-y-4">
          {/* Help Desk Knowledge Info */}
          <div>
            <h3 className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Help Desk Knowledge
            </h3>
            <p className={`text-sm ${themeClasses.mutedText} font-mono`}>
              {workspaceSlug}
            </p>
          </div>

          {/* Last Successful Operations */}
          <div className="space-y-3">
            <div>
              <h3 className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Last Successful Operations
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${themeClasses.mutedText}`}>
                    Last search:
                  </span>
                  <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                    {formatTimestamp(lastSuccessfulSearch)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${themeClasses.mutedText}`}>
                    Last chat:
                  </span>
                  <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                    {formatTimestamp(lastSuccessfulChat)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sources Available */}
          {sourcesCount !== undefined && (
            <div>
              <h3 className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Knowledge Base
              </h3>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                {sourcesCount > 0
                  ? `${sourcesCount} source${sourcesCount === 1 ? "" : "s"} available`
                  : "No sources found in last test"}
              </p>
            </div>
          )}

          {/* Quick Links */}
          <div>
            <h3 className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Quick Links
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              {workspaceUrl && (
                <a
                  href={workspaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors text-center ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Open AnythingLLM Workspace
                </a>
              )}
              <Link
                href={`/apps/ai-help-desk/setup${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors text-center ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Open Setup Wizard
              </Link>
            </div>
          </div>
        </div>
      )}
    </OBDPanel>
  );
}

// Connection Status Badge Component
interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  isDark: boolean;
  onRedClick: () => void;
}

function ConnectionStatusBadge({ status, isDark, onRedClick }: ConnectionStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "green":
        return {
          text: "Help Desk Connected",
          bgColor: isDark ? "bg-green-900/30" : "bg-green-50",
          borderColor: isDark ? "border-green-700" : "border-green-200",
          textColor: isDark ? "text-green-400" : "text-green-700",
          icon: "✓",
        };
      case "yellow":
        return {
          text: "Limited Data",
          bgColor: isDark ? "bg-yellow-900/30" : "bg-yellow-50",
          borderColor: isDark ? "border-yellow-700" : "border-yellow-200",
          textColor: isDark ? "text-yellow-400" : "text-yellow-700",
          icon: "⚠",
        };
      case "red":
        return {
          text: "Connection Issue",
          bgColor: isDark ? "bg-red-900/30" : "bg-red-50",
          borderColor: isDark ? "border-red-700" : "border-red-200",
          textColor: isDark ? "text-red-400" : "text-red-700",
          icon: "✗",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const baseClasses = `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${config.bgColor} ${config.borderColor} ${config.textColor}`;
  const clickableClasses = status === "red" ? "cursor-pointer hover:opacity-80" : "cursor-default";

  const badge = (
    <span
      className={`${baseClasses} ${clickableClasses}`}
      onClick={status === "red" ? onRedClick : undefined}
      role={status === "red" ? "button" : "status"}
      aria-label={config.text}
      tabIndex={status === "red" ? 0 : undefined}
      onKeyDown={
        status === "red"
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRedClick();
              }
            }
          : undefined
      }
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.text}</span>
    </span>
  );

  // Add tooltip for yellow status
  if (status === "yellow") {
    return (
      <div className="relative group">
        {badge}
        <div
          className={`absolute left-0 top-full mt-2 z-50 px-3 py-2 text-xs rounded-lg border shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${config.bgColor} ${config.borderColor} ${config.textColor}`}
          role="tooltip"
          aria-hidden="true"
        >
          Some answers may be incomplete until more content is added.
        </div>
      </div>
    );
  }

  return badge;
}

// Search Panel Component
interface SearchPanelProps {
  isDark: boolean;
  themeClasses: ReturnType<typeof getThemeClasses>;
  businessId: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  selectedResult: SearchResult | null;
  setSelectedResult: (result: SearchResult | null) => void;
  onSearch: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  onUseInChat: (result: SearchResult) => void;
}

function SearchPanel({
  isDark,
  themeClasses,
  businessId,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchLoading,
  searchError,
  selectedResult,
  setSelectedResult,
  onSearch,
  onClearSearch,
  onUseInChat,
}: SearchPanelProps) {
  return (
    <OBDPanel isDark={isDark}>
      <OBDHeading level={2} isDark={isDark} className="mb-4">
        Search Help Desk
      </OBDHeading>

      {/* Search Form */}
      <form onSubmit={onSearch} className="space-y-4">
        <div>
          <label
            htmlFor="search-query"
            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
          >
            Search Query
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="search-query"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={getInputClasses(isDark, "flex-1")}
              placeholder="Search your business help desk…"
              disabled={searchLoading || !businessId}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={searchLoading || !businessId || !searchQuery.trim()}
          className={SUBMIT_BUTTON_CLASSES}
        >
          {searchLoading ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Error Display */}
      {searchError && (
        <div className={`mt-4 ${getErrorPanelClasses(isDark)}`}>
          <p className="text-sm">{searchError}</p>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-semibold ${themeClasses.labelText}`}>
              Results ({searchResults.length})
            </h3>
          </div>
          <div className="space-y-2">
            {searchResults.map((result) => (
              <div
                key={result.id}
                onClick={() => setSelectedResult(result)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  selectedResult?.id === result.id
                    ? isDark
                      ? "bg-slate-800 border-[#29c4a9]"
                      : "bg-[#29c4a9]/10 border-[#29c4a9]"
                    : isDark
                      ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className={`font-medium ${themeClasses.headingText}`}>
                      {result.title}
                    </h4>
                    {result.sourceType && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                          isDark
                            ? "bg-slate-700 text-slate-300"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {result.sourceType}
                      </span>
                    )}
                    <p className={`mt-2 text-sm ${themeClasses.mutedText} line-clamp-2`}>
                      {result.snippet}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searchLoading &&
        !searchError &&
        searchResults.length === 0 &&
        searchQuery && (
          <div className={`mt-6 text-center py-8 ${themeClasses.mutedText}`}>
            <p>No results found. Try a different search query.</p>
          </div>
        )}

      {/* Initial Empty State */}
      {!searchLoading &&
        !searchError &&
        searchResults.length === 0 &&
        !searchQuery && (
          <div className={`mt-6 text-center py-8 ${themeClasses.mutedText}`}>
            <p>Search your help desk or ask a question.</p>
          </div>
        )}

      {/* Selected Result Preview */}
      {selectedResult && (
        <div className={`mt-6 p-4 rounded-xl border ${
          isDark
            ? "bg-slate-800 border-slate-700"
            : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-start justify-between mb-2">
            <h4 className={`font-semibold ${themeClasses.headingText}`}>
              {selectedResult.title}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedResult(null)}
              className={`text-sm ${themeClasses.mutedText} hover:${isDark ? "text-slate-200" : "text-slate-700"}`}
            >
              Close
            </button>
          </div>
          {selectedResult.sourceType && (
            <span
              className={`inline-block mb-2 px-2 py-0.5 text-xs rounded ${
                isDark
                  ? "bg-slate-700 text-slate-300"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {selectedResult.sourceType}
            </span>
          )}
          <p className={`mt-2 text-sm whitespace-pre-wrap ${themeClasses.labelText}`}>
            {selectedResult.snippet}
          </p>
          <button
            type="button"
            onClick={() => onUseInChat(selectedResult)}
            className={`mt-4 px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
              isDark
                ? "border-[#29c4a9] bg-[#29c4a9]/20 text-[#29c4a9] hover:bg-[#29c4a9]/30"
                : "border-[#29c4a9] bg-[#29c4a9]/10 text-[#29c4a9] hover:bg-[#29c4a9]/20"
            }`}
          >
            Use this in chat
          </button>
        </div>
      )}
    </OBDPanel>
  );
}

// Helper function to highlight matching text in snippet
function highlightMatchingText(snippet: string, query: string): React.ReactNode {
  if (!query || !snippet) return snippet;
  
  const queryLower = query.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  
  // Find the first occurrence of any significant word from the query
  const queryWords = queryLower
    .split(/\s+/)
    .filter((word) => word.length > 2) // Only highlight words longer than 2 chars
    .sort((a, b) => b.length - a.length); // Sort by length, longest first
  
  for (const word of queryWords) {
    const index = snippetLower.indexOf(word);
    if (index !== -1) {
      // Found a match - highlight it
      const before = snippet.substring(0, index);
      const match = snippet.substring(index, index + word.length);
      const after = snippet.substring(index + word.length);
      
      return (
        <>
          {before}
          <mark className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded">
            {match}
          </mark>
          {after}
        </>
      );
    }
  }
  
  // No match found, return original
  return snippet;
}

// Chat Panel Component
interface ChatPanelProps {
  isDark: boolean;
  themeClasses: ReturnType<typeof getThemeClasses>;
  businessId: string;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  chatLoading: boolean;
  chatError: string | null;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onChatSubmit: (e: React.FormEvent) => void;
  onNewConversation: () => void;
  crmContextLoaded?: boolean;
  onDismissCrmContext?: () => void;
  crmReturnUrl?: string | null;
  showCrmBanner?: boolean;
  onDismissCrmBanner?: () => void;
}

function ChatPanel({
  isDark,
  themeClasses,
  businessId,
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  chatError,
  messagesContainerRef,
  chatEndRef,
  onChatSubmit,
  onNewConversation,
  crmContextLoaded = false,
  onDismissCrmContext,
  crmReturnUrl = null,
  showCrmBanner = true,
  onDismissCrmBanner,
}: ChatPanelProps) {
  // Helper function to prepend instruction to chat input
  const prependInstruction = (instruction: string) => {
    const trimmed = chatInput.trim();
    if (trimmed.startsWith(instruction.trim())) {
      // Already has this instruction, don't duplicate
      return;
    }
    setChatInput(instruction + (trimmed ? " " + trimmed : ""));
  };
  return (
    <OBDPanel isDark={isDark} className="flex flex-col" style={{ minHeight: "500px", maxHeight: "800px" }}>
      <div className="flex items-center justify-between mb-4">
        <OBDHeading level={2} isDark={isDark}>
          Chat
        </OBDHeading>
        {chatMessages.length > 0 && (
          <button
            type="button"
            onClick={onNewConversation}
            className={`text-sm font-medium ${themeClasses.mutedText} hover:${isDark ? "text-slate-200" : "text-slate-700"} transition-colors`}
          >
            New Conversation
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4"
        style={{ maxHeight: "calc(800px - 200px)" }}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {chatMessages.length === 0 ? (
          <div className="text-center py-12">
            <p className={`text-base mb-6 ${themeClasses.labelText}`}>
              Ask anything about your business — policies, services, hours, or FAQs.
            </p>
            {businessId && (
              <div className="space-y-2 max-w-md mx-auto">
                <p className={`text-xs mb-3 ${themeClasses.mutedText}`}>
                  Try asking:
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    "What services do we offer?",
                    "What are our hours?",
                    "Do you offer refunds?",
                    "How can customers contact us?",
                  ].map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setChatInput(suggestion)}
                      className={`px-4 py-2 text-sm text-left rounded-lg border transition-colors ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!businessId && (
              <p className={`mt-4 text-sm ${themeClasses.mutedText}`}>
                Please enter a business name above to start chatting.
              </p>
            )}
          </div>
        ) : (
          chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? isDark
                      ? "bg-[#29c4a9] text-white"
                      : "bg-[#29c4a9] text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-100"
                      : "bg-slate-100 text-slate-900"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>

                {/* Sources */}
                {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                  <div className={`mt-3 pt-3 border-t ${
                    isDark ? "border-slate-700" : "border-slate-300"
                  }`}>
                    <p className={`text-xs font-medium mb-2 ${themeClasses.mutedText}`}>
                      Sources used:
                    </p>
                    <ul className="space-y-2">
                      {message.sources.map((source, idx) => {
                        // Find the user question that preceded this assistant response
                        const messageIndex = chatMessages.findIndex((m) => m.id === message.id);
                        const previousUserMessage = messageIndex > 0 
                          ? chatMessages[messageIndex - 1] 
                          : null;
                        const query = previousUserMessage?.role === "user" 
                          ? previousUserMessage.content 
                          : "";
                        
                        return (
                          <li key={idx} className={`text-xs ${themeClasses.mutedText}`}>
                            <div className="font-medium">{source.title}</div>
                            {source.snippet && (
                              <div className="mt-1 opacity-75">
                                {highlightMatchingText(source.snippet, query)}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* No sources indicator */}
                {message.role === "assistant" &&
                  (!message.sources || message.sources.length === 0) &&
                  message.content.includes("couldn't find") && (
                    <p className={`mt-2 text-xs italic ${themeClasses.mutedText}`}>
                      Want to add an FAQ for this?
                    </p>
                  )}
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {chatLoading && (
          <div className="flex justify-start">
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isDark ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Error Display */}
      {chatError && (
        <div className={`mb-4 ${getErrorPanelClasses(isDark)}`}>
          <p className="text-sm">{chatError}</p>
        </div>
      )}

      {/* CRM Follow-Up Generator Banner */}
      {crmContextLoaded && showCrmBanner && (
        <div className="mb-4 space-y-2">
          {/* Banner/Pill */}
          <div
            className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
              isDark
                ? "bg-blue-900/30 text-blue-300 border border-blue-700/50"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            <span className="font-medium">CRM follow-up generator</span>
            <span className={`text-xs ${isDark ? "text-blue-400/80" : "text-blue-600/80"}`}>
              Context loaded from CRM
            </span>
            {crmReturnUrl && isValidReturnUrl(crmReturnUrl) && (
              <Link
                href={crmReturnUrl}
                className={`ml-auto text-xs font-medium hover:underline ${
                  isDark ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-700"
                }`}
              >
                Back to CRM contact
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                if (onDismissCrmBanner) {
                  onDismissCrmBanner();
                }
              }}
              className="ml-auto hover:opacity-70"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>

          {/* Helper Chips */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => prependInstruction("Write an SMS follow-up message.")}
              disabled={chatLoading}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                chatLoading
                  ? isDark
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              Generate SMS
            </button>
            <button
              type="button"
              onClick={() => prependInstruction("Write an email follow-up message.")}
              disabled={chatLoading}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                chatLoading
                  ? isDark
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              Generate Email
            </button>
          </div>
        </div>
      )}

      {/* Chat Input Form */}
      <form onSubmit={onChatSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            id="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className={getInputClasses(isDark, "flex-1")}
            placeholder="Ask a question…"
            disabled={chatLoading || !businessId}
            aria-label="Chat message input"
          />
          <button
            type="submit"
            disabled={chatLoading || !businessId || !chatInput.trim()}
            className={`px-6 py-2 font-medium rounded-xl transition-colors ${
              chatLoading || !businessId || !chatInput.trim()
                ? isDark
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
                : SUBMIT_BUTTON_CLASSES
            }`}
          >
            Send
          </button>
        </div>
      </form>
    </OBDPanel>
  );
}

export default function AIHelpDeskPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AIHelpDeskPageContent />
    </Suspense>
  );
}

