"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
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
  UpdateAvailabilityRequest,
  BookingTheme,
  UpdateBookingThemeRequest,
} from "@/lib/apps/obd-scheduler/types";
import { BookingStatus, BookingMode, AvailabilityExceptionType } from "@/lib/apps/obd-scheduler/types";

type Tab = "requests" | "services" | "availability" | "branding" | "settings";

export default function OBDSchedulerPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [activeTab, setActiveTab] = useState<Tab>("requests");

  // Requests tab state
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [showRequestDetail, setShowRequestDetail] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [requestFilter, setRequestFilter] = useState<BookingStatus | "all">("all");

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
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityWindows, setAvailabilityWindows] = useState<Omit<AvailabilityWindow, "id" | "businessId" | "createdAt" | "updatedAt">[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<Omit<AvailabilityException, "id" | "businessId" | "createdAt" | "updatedAt">[]>([]);

  // Branding tab state
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

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === "requests") {
      loadRequests();
    } else if (activeTab === "services") {
      loadServices();
    } else if (activeTab === "availability") {
      loadAvailability();
    } else if (activeTab === "branding") {
      loadTheme();
    } else if (activeTab === "settings") {
      loadSettings();
    }
  }, [activeTab, requestFilter]);

  // Load requests
  const loadRequests = async () => {
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const params = new URLSearchParams();
      if (requestFilter !== "all") {
        params.set("status", requestFilter);
      }
      const res = await fetch(`/api/obd-scheduler/requests?${params.toString()}`);
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
  };

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

  // Update request status
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
      alert(error instanceof Error ? error.message : "Failed to update request");
    }
  };

  // Save service
  const saveService = async () => {
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
    } catch (error) {
      console.error("Error saving service:", error);
      alert(error instanceof Error ? error.message : "Failed to save service");
    }
  };

  // Save settings
  const saveSettings = async () => {
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
      alert("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  // Save availability
  const saveAvailability = async () => {
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
      alert("Availability saved successfully");
    } catch (error) {
      console.error("Error saving availability:", error);
      alert(error instanceof Error ? error.message : "Failed to save availability");
    }
  };

  // Save theme
  const saveTheme = async () => {
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
      alert("Theme saved successfully");
    } catch (error) {
      console.error("Error saving theme:", error);
      alert(error instanceof Error ? error.message : "Failed to save theme");
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

  // Get status badge color
  const getStatusColor = (status: BookingStatus) => {
    const colors: Record<BookingStatus, string> = {
      REQUESTED: "bg-blue-500/20 text-blue-400 border-blue-500",
      APPROVED: "bg-green-500/20 text-green-400 border-green-500",
      DECLINED: "bg-red-500/20 text-red-400 border-red-500",
      PROPOSED_TIME: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
      COMPLETED: "bg-slate-500/20 text-slate-400 border-slate-500",
      CANCELED: "bg-gray-500/20 text-gray-400 border-gray-500",
    };
    return colors[status] || colors.REQUESTED;
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Scheduler & Booking"
      tagline="Manage booking requests, services, availability, and settings for your business."
    >
      {/* Tabs */}
      <OBDPanel isDark={isDark} className="mb-6" variant="toolbar">
        <div className={`flex flex-wrap gap-2 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          {[
            { id: "requests" as Tab, label: "Requests" },
            { id: "services" as Tab, label: "Services" },
            { id: "availability" as Tab, label: "Availability" },
            { id: "branding" as Tab, label: "Branding" },
            { id: "settings" as Tab, label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
          <div className="mb-4 flex items-center justify-between">
            <OBDHeading level={2} isDark={isDark}>Booking Requests</OBDHeading>
            <select
              value={requestFilter}
              onChange={(e) => setRequestFilter(e.target.value as BookingStatus | "all")}
              className={getInputClasses(isDark)}
            >
              <option value="all">All Status</option>
              <option value="REQUESTED">Requested</option>
              <option value="APPROVED">Approved</option>
              <option value="DECLINED">Declined</option>
              <option value="PROPOSED_TIME">Proposed Time</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>

          {requestsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{requestsError}</p>
            </div>
          )}

          {requestsLoading ? (
            <p className={themeClasses.mutedText}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p className={themeClasses.mutedText}>No booking requests found.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`rounded-lg border p-4 cursor-pointer hover:opacity-80 ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowRequestDetail(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
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
                  </div>
                </div>
              ))}
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

              <button onClick={saveAvailability} className={SUBMIT_BUTTON_CLASSES}>
                Save Availability
              </button>
            </div>
          )}
        </OBDPanel>
      )}

      {/* Branding Tab */}
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
            <p className={themeClasses.mutedText}>Loading theme...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Logo URL
                </label>
                <input
                  type="url"
                  value={themeForm.logoUrl || ""}
                  onChange={(e) => setThemeForm({ ...themeForm, logoUrl: e.target.value })}
                  className={getInputClasses(isDark)}
                  placeholder="https://example.com/logo.png"
                />
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  URL to your business logo image.
                </p>
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
                  onChange={(e) => setThemeForm({ ...themeForm, headlineText: e.target.value })}
                  className={getInputClasses(isDark)}
                  placeholder="Book your appointment"
                  maxLength={200}
                />
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Main headline displayed on the booking page.
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Introduction Text
                </label>
                <textarea
                  value={themeForm.introText || ""}
                  onChange={(e) => setThemeForm({ ...themeForm, introText: e.target.value })}
                  rows={4}
                  className={getInputClasses(isDark, "resize-none")}
                  placeholder="Welcome! Select a service and time that works for you."
                  maxLength={1000}
                />
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Brief introduction text displayed below the headline.
                </p>
              </div>

              <button onClick={saveTheme} className={SUBMIT_BUTTON_CLASSES}>
                Save Branding
              </button>
            </div>
          )}
        </OBDPanel>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark}>Booking Settings</OBDHeading>

          {settingsError && (
            <div className={getErrorPanelClasses(isDark)}>
              <p>{settingsError}</p>
            </div>
          )}

          {settingsLoading ? (
            <p className={themeClasses.mutedText}>Loading settings...</p>
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
                  onChange={(e) => setSettingsForm({ ...settingsForm, notificationEmail: e.target.value })}
                  className={getInputClasses(isDark)}
                  placeholder="owner@business.com"
                />
                <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Where booking request alerts should be sent.
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Booking Policies
                </label>
                <textarea
                  value={settingsForm.policyText || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, policyText: e.target.value })}
                  rows={6}
                  className={getInputClasses(isDark, "resize-none")}
                  placeholder="Enter your booking policies, cancellation policy, etc."
                />
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
                        alert("Link copied to clipboard!");
                      }}
                      className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
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

              <button onClick={saveSettings} className={SUBMIT_BUTTON_CLASSES}>
                Save Settings
              </button>
            </div>
          )}
        </OBDPanel>
      )}

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
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className={`text-sm font-medium ${themeClasses.labelText}`}>Customer</p>
                <p className={themeClasses.headingText}>{selectedRequest.customerName}</p>
                <p className={themeClasses.mutedText}>{selectedRequest.customerEmail}</p>
                {selectedRequest.customerPhone && (
                  <p className={themeClasses.mutedText}>{selectedRequest.customerPhone}</p>
                )}
              </div>

              {selectedRequest.service && (
                <div>
                  <p className={`text-sm font-medium ${themeClasses.labelText}`}>Service</p>
                  <p className={themeClasses.headingText}>{selectedRequest.service.name}</p>
                </div>
              )}

              <div>
                <p className={`text-sm font-medium ${themeClasses.labelText}`}>Status</p>
                <span
                  className={`px-2 py-1 rounded text-xs border ${getStatusColor(selectedRequest.status)}`}
                >
                  {selectedRequest.status}
                </span>
              </div>

              <div>
                <p className={`text-sm font-medium ${themeClasses.labelText}`}>Preferred Start</p>
                <p className={themeClasses.headingText}>
                  {selectedRequest.preferredStart ? formatDateTime(selectedRequest.preferredStart) : "No preference"}
                </p>
              </div>

              {selectedRequest.proposedStart && (
                <div>
                  <p className={`text-sm font-medium ${themeClasses.labelText}`}>Proposed Start</p>
                  <p className={themeClasses.headingText}>{formatDateTime(selectedRequest.proposedStart)}</p>
                </div>
              )}

              {selectedRequest.proposedEnd && (
                <div>
                  <p className={`text-sm font-medium ${themeClasses.labelText}`}>Proposed End</p>
                  <p className={themeClasses.headingText}>{formatDateTime(selectedRequest.proposedEnd)}</p>
                </div>
              )}

              {selectedRequest.message && (
                <div>
                  <p className={`text-sm font-medium ${themeClasses.labelText}`}>Message</p>
                  <p className={themeClasses.headingText}>{selectedRequest.message}</p>
                </div>
              )}

              <div>
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

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-300 dark:border-slate-600">
                {selectedRequest.status === "REQUESTED" && (
                  <>
                    <button
                      onClick={() =>
                        updateRequestStatus(selectedRequest.id, { status: BookingStatus.APPROVED })
                      }
                      className={`px-4 py-2 rounded text-sm ${isDark ? "bg-green-600 text-white" : "bg-green-500 text-white"}`}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        updateRequestStatus(selectedRequest.id, { status: BookingStatus.DECLINED })
                      }
                      className={`px-4 py-2 rounded text-sm ${isDark ? "bg-red-600 text-white" : "bg-red-500 text-white"}`}
                    >
                      Decline
                    </button>
                  </>
                )}
                {selectedRequest.status === "APPROVED" && (
                  <button
                    onClick={() =>
                      updateRequestStatus(selectedRequest.id, { status: BookingStatus.COMPLETED })
                    }
                    className={`px-4 py-2 rounded text-sm ${isDark ? "bg-blue-600 text-white" : "bg-blue-500 text-white"}`}
                  >
                    Mark Complete
                  </button>
                )}
                <button
                  onClick={async () => {
                    const proposedStart = prompt("Enter proposed start time (ISO format):");
                    const proposedEnd = prompt("Enter proposed end time (ISO format):");
                    if (proposedStart && proposedEnd) {
                      await updateRequestStatus(selectedRequest.id, {
                        status: BookingStatus.PROPOSED_TIME,
                        proposedStart,
                        proposedEnd,
                      });
                    }
                  }}
                  className={`px-4 py-2 rounded text-sm ${isDark ? "bg-yellow-600 text-white" : "bg-yellow-500 text-white"}`}
                >
                  Propose New Time
                </button>
                <button
                  onClick={async () => {
                    await updateRequestStatus(selectedRequest.id, {
                      internalNotes: selectedRequest.internalNotes || null,
                    });
                  }}
                  className={`px-4 py-2 rounded text-sm ${isDark ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-700"}`}
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-xl border p-6 max-w-md w-full ${
              isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                {editingService ? "Edit Service" : "Add Service"}
              </h3>
              <button
                onClick={() => {
                  setShowServiceModal(false);
                  setEditingService(null);
                }}
                className={themeClasses.mutedText}
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
                <button onClick={saveService} className={SUBMIT_BUTTON_CLASSES}>
                  {editingService ? "Update" : "Create"}
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
    </OBDPageContainer>
  );
}

