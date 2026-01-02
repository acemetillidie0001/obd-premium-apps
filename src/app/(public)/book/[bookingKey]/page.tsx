"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { CreateBookingRequestRequest, BookingService, BookingMode } from "@/lib/apps/obd-scheduler/types";
import { BookingMode as BookingModeEnum } from "@/lib/apps/obd-scheduler/types";
import { validateEmail, validatePhone, validatePreferredStart } from "@/lib/apps/obd-scheduler/validation";

/**
 * P1-22: Style Isolation Documentation
 * 
 * This page uses hardcoded light-mode CSS classes instead of the OBD framework theme system
 * to maintain complete isolation from the dashboard. This ensures:
 * 1. Public booking pages don't depend on dashboard theme tokens/styles
 * 2. Public pages remain functional even if dashboard styling changes
 * 3. Prevents accidental coupling between public and authenticated pages
 * 
 * If theme support is needed in the future, implement a separate theme system
 * that doesn't rely on dashboard context or shared theme utilities.
 */

// Hardcoded light mode classes (fully isolated from OBD framework)
const PANEL_CLASSES = "w-full rounded-3xl border border-slate-200 bg-white shadow-md shadow-slate-300/60 hover:shadow-lg hover:shadow-slate-400/70 px-6 py-6 md:px-8 md:py-7 transition-shadow";
// P2-12: Enhanced focus indicators with focus-visible for keyboard navigation
const INPUT_CLASSES = "w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-xl focus-visible:ring-2 focus-visible:ring-[#29c4a9] focus-visible:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed";
const SUBMIT_BUTTON_CLASSES = "w-full px-6 py-3 bg-[#29c4a9] text-white font-medium rounded-full hover:bg-[#22ad93] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#29c4a9] focus-visible:ring-offset-2 outline-none";
const ERROR_PANEL_CLASSES = "rounded-xl border border-red-200 bg-red-50 text-red-600 p-3";

interface BusinessContext {
  businessId: string;
  bookingModeDefault: BookingMode;
  timezone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysOut: number;
  policyText: string | null;
  services: BookingService[];
  businessName: string | null;
  logoUrl: string | null;
}

interface Slot {
  startTime: string;
  displayTime: string;
}

interface SlotsResponse {
  date: string;
  slots: Slot[];
  calendarWarning?: string | null;
}

// Default context object - ensures context is never null (prevents React #310)
// Defined outside component to avoid recreation on every render
const defaultContext: BusinessContext = {
  businessId: "",
  bookingModeDefault: BookingModeEnum.REQUEST_ONLY,
  timezone: "America/New_York",
  bufferMinutes: 15,
  minNoticeHours: 24,
  maxDaysOut: 90,
  policyText: null,
  services: [],
  businessName: null,
  logoUrl: null,
};

export default function PublicBookingPage() {
  const params = useParams();
  const bookingKey = params?.bookingKey as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState<BusinessContext>(defaultContext);
  const [contextError, setContextError] = useState(false);
  const [timeAdjusted, setTimeAdjusted] = useState(false);
  const [formData, setFormData] = useState<CreateBookingRequestRequest>({
    serviceId: null,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    preferredStart: "",
    message: "",
  });

  // Instant booking state
  const [showRequestForm, setShowRequestForm] = useState(false); // Toggle to show request form fallback
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  // Load business context
  useEffect(() => {
    if (!bookingKey) {
      setError("Invalid booking link");
      setLoading(false);
      return;
    }

    const loadContext = async () => {
      try {
        // Use bookingKey parameter (API accepts both 'key' and 'bookingKey')
        const res = await fetch(`/api/obd-scheduler/public/context?bookingKey=${encodeURIComponent(bookingKey)}`);
        
        // Check if response is OK before parsing
        if (!res.ok) {
          // For 404, set context error but don't block form rendering
          if (res.status === 404) {
            setContextError(true);
            setError("This booking link isn't available");
            // Set minimal context to allow form to render
            setContext(defaultContext);
            setLoading(false);
            return;
          }
          
          // Try to read error message from response
          let errorMessage = "Failed to load booking form";
          try {
            const errorText = await res.text();
            // Try to parse as JSON
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorMessage;
            } catch {
              // If not JSON, use the text or default message
              errorMessage = errorText || errorMessage;
            }
          } catch {
            // If reading response fails, use default message
            errorMessage = `Failed to load booking form (${res.status})`;
          }
          setContextError(true);
          setError(errorMessage);
          // Set minimal context to allow form to render
          setContext(defaultContext);
          setLoading(false);
          return;
        }

        // Safely parse JSON response
        let data;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError);
          setContextError(true);
          setError("Invalid response from server");
          // Set minimal context to allow form to render
          setContext(defaultContext);
          setLoading(false);
          return;
        }

        // Validate response shape
        if (!data || typeof data !== "object") {
          setContextError(true);
          setError("Invalid response format");
          // Set minimal context to allow form to render
          setContext(defaultContext);
          setLoading(false);
          return;
        }

        if (!data.ok) {
          setContextError(true);
          setError(data.error || "Failed to load booking form");
          // Set minimal context to allow form to render
          setContext(defaultContext);
          setLoading(false);
          return;
        }

        // Ensure data.data exists and has required fields
        if (!data.data) {
          setContextError(true);
          setError("Missing data in response");
          // Set minimal context to allow form to render
          setContext(defaultContext);
          setLoading(false);
          return;
        }

        // Ensure services is always an array and all required fields are present (defensive)
        const contextData: BusinessContext = {
          businessId: data.data.businessId ?? "",
          bookingModeDefault: data.data.bookingModeDefault ?? BookingModeEnum.REQUEST_ONLY,
          timezone: data.data.timezone ?? "America/New_York",
          bufferMinutes: data.data.bufferMinutes ?? 15,
          minNoticeHours: data.data.minNoticeHours ?? 24,
          maxDaysOut: data.data.maxDaysOut ?? 90,
          policyText: data.data.policyText ?? null,
          services: Array.isArray(data.data.services) ? data.data.services : [],
          businessName: data.data.businessName ?? null,
          logoUrl: data.data.logoUrl ?? null,
        };

        setContext(contextData);
        setContextError(false);
        setError("");
      } catch (error) {
        console.error("Error loading context:", error);
        setContextError(true);
        setError(error instanceof Error ? error.message : "Failed to load booking form");
        // Set minimal context to allow form to render
        setContext(defaultContext);
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, [bookingKey]);

  // Extract primitive values from context (plain const, not hooks)
  const minNoticeHours = context.minNoticeHours ?? 24;
  const maxDaysOut = context.maxDaysOut ?? 90;
  const bookingModeDefault = context.bookingModeDefault;

  // Calculate suggested start time (plain const computation, no useMemo)
  const suggestedStartTime = (() => {
    try {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      nextHour.setMilliseconds(0);
      nextHour.setHours(nextHour.getHours() + 1);
      const suggested = new Date(nextHour.getTime() + minNoticeHours * 60 * 60 * 1000);
      const minutes = suggested.getMinutes();
      const roundedMinutes = Math.ceil(minutes / 15) * 15;
      if (roundedMinutes >= 60) {
        suggested.setHours(suggested.getHours() + 1);
        suggested.setMinutes(0);
      } else {
        suggested.setMinutes(roundedMinutes);
      }
      suggested.setSeconds(0);
      suggested.setMilliseconds(0);
      return suggested.toISOString();
    } catch {
      return null;
    }
  })();

  // Handle date or service change for instant booking
  // Inline fetch logic directly in useEffect to avoid useCallback dependency
  useEffect(() => {
    if (bookingModeDefault === BookingModeEnum.INSTANT_ALLOWED && selectedDate && bookingKey) {
      // Fetch slots inline (no useCallback needed)
      const fetchSlots = async () => {
        setSlotsLoading(true);
        setSlotsError("");
        setSlots([]);
        setSelectedSlot(null);

        try {
          const params = new URLSearchParams({
            bookingKey,
            date: selectedDate,
          });
          if (formData.serviceId) {
            params.set("serviceId", formData.serviceId);
          }

          const res = await fetch(`/api/obd-scheduler/slots?${params.toString()}`);
          const data = await res.json();

          if (!res.ok || !data.ok) {
            throw new Error(data.error || "Failed to load available times");
          }

          const slotsData: SlotsResponse = data.data;
          setSlots(slotsData.slots);
          
          // Show calendar warning if present (non-blocking)
          if (data.data.calendarWarning) {
            setCalendarWarning(data.data.calendarWarning);
          } else {
            setCalendarWarning(null);
          }
          
          // Show calendar warning if present (non-blocking)
          if (data.data.calendarWarning) {
            setCalendarWarning(data.data.calendarWarning);
          } else {
            setCalendarWarning(null);
          }
        } catch (error) {
          console.error("Error loading slots:", error);
          setSlotsError(error instanceof Error ? error.message : "Failed to load available times");
        } finally {
          setSlotsLoading(false);
        }
      };

      fetchSlots();
    }
  }, [selectedDate, formData.serviceId, bookingModeDefault, bookingKey]);

  // Handle instant booking submission
  const handleInstantBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    // P2-1: Block submission if context failed to load
    if (contextError) {
      setError("Cannot submit booking request. Please refresh the page or contact the business.");
      return;
    }
    setSubmitting(true);
    setError("");

    if (!selectedSlot) {
      setError("Please select a time slot");
      setSubmitting(false);
      return;
    }

    if (!formData.customerName.trim()) {
      setError("Please enter your name");
      setSubmitting(false);
      return;
    }

    if (!formData.customerEmail.trim()) {
      setError("Please enter your email");
      setSubmitting(false);
      return;
    }

    // P1-12: Use shared validation helpers
    // P1-1: Validate email format
    if (!validateEmail(formData.customerEmail)) {
      setError("Please enter a valid email address");
      setSubmitting(false);
      return;
    }

    // P1-13: Validate phone format (if provided) - for instant booking too
    if (!validatePhone(formData.customerPhone)) {
      setError("Phone number must contain 10-15 digits and use only valid formatting characters");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        bookingKey,
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail.trim(),
        customerPhone: formData.customerPhone?.trim() || null,
        message: formData.message?.trim() || null,
        serviceId: formData.serviceId || null,
        startTime: selectedSlot.startTime,
      };

      const res = await fetch("/api/obd-scheduler/bookings/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create booking");
      }

      setSubmitSuccess(true);
      setFormData({
        serviceId: null,
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        preferredStart: "",
        message: "",
      });
      setSelectedSlot(null);
      setSelectedDate("");
      setSlots([]);
    } catch (error) {
      console.error("Error creating instant booking:", error);
      setError(error instanceof Error ? error.message : "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // P2-1: Block submission if context failed to load
    if (contextError) {
      setError("Cannot submit booking request. Please refresh the page or contact the business.");
      return;
    }
    setSubmitting(true);
    setError("");

    // Normalize preferredStart to 15-minute increments before submit (extra safety)
    if (formData.preferredStart) {
      try {
        const date = new Date(formData.preferredStart);
        const minutes = date.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        if (minutes !== roundedMinutes) {
          date.setMinutes(roundedMinutes);
          date.setSeconds(0);
          date.setMilliseconds(0);
          setFormData({ ...formData, preferredStart: date.toISOString() });
        }
      } catch {
        // If date parsing fails, continue with validation
      }
    }

    if (!formData.customerName.trim()) {
      setError("Please enter your name");
      setSubmitting(false);
      return;
    }

    if (!formData.customerEmail.trim()) {
      setError("Please enter your email");
      setSubmitting(false);
      return;
    }

    // P1-12: Use shared validation helpers
    // P1-1: Validate email format
    if (!validateEmail(formData.customerEmail)) {
      setError("Please enter a valid email address");
      setSubmitting(false);
      return;
    }

    // P1-13: Validate phone format (if provided)
    if (!validatePhone(formData.customerPhone)) {
      setError("Phone number must contain 10-15 digits and use only valid formatting characters");
      setSubmitting(false);
      return;
    }

    // P1-3: Validate service selection (if provided)
    if (formData.serviceId) {
      const selectedService = context.services.find((s) => s.id === formData.serviceId);
      if (!selectedService) {
        setError("Selected service is not available. Please select a different service.");
        setSubmitting(false);
        return;
      }
      // Note: context.services only includes active services, but double-check for safety
      if (!selectedService.active) {
        setError("Selected service is not available. Please select a different service.");
        setSubmitting(false);
        return;
      }
    }

    // P1-2: Validate preferredStart time constraints (if provided) - using shared helper
    if (formData.preferredStart) {
      const timeValidation = validatePreferredStart(formData.preferredStart, {
        minNoticeHours: context.minNoticeHours ?? 24,
        maxDaysOut: context.maxDaysOut ?? 90,
      });
      if (!timeValidation.ok) {
        setError(timeValidation.message);
        setSubmitting(false);
        return;
      }
    }

    try {
      const payload: CreateBookingRequestRequest = {
        ...formData,
        bookingKey,
      };

      const res = await fetch("/api/obd-scheduler/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to submit booking request");
      }

      setSubmitSuccess(true);
      setFormData({
        serviceId: null,
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        preferredStart: "",
        message: "",
      });
    } catch (error) {
      console.error("Error submitting booking request:", error);
      setError(error instanceof Error ? error.message : "Failed to submit booking request");
    } finally {
      setSubmitting(false);
    }
  };

  // Safe defaults for business name and logo
  const businessName = context.businessName ?? null;
  const logoUrl = context.logoUrl ?? null;

  // Reset form handler
  const handleResetForm = () => {
    setSubmitSuccess(false);
    setError("");
    setFormData({
      serviceId: null,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      preferredStart: "",
      message: "",
    });
    setSelectedSlot(null);
    setSelectedDate("");
    setSlots([]);
  };

  const isInstantMode = bookingModeDefault === BookingModeEnum.INSTANT_ALLOWED && !showRequestForm;

  // Calculate min and max dates for date picker (plain const computations, no useMemo)
  const now = new Date();
  const minDate = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000).toISOString().split("T")[0];
  const maxDate = new Date(now.getTime() + maxDaysOut * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // NO EARLY RETURNS - All hooks must run unconditionally
  // Handle missing bookingKey in JSX instead of early return
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      {/* P2-13: Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#29c4a9] focus:text-white focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#29c4a9] focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <div className="max-w-2xl mx-auto" id="main-content">
        {!bookingKey ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Booking Request</h1>
            <p className="text-sm md:text-base text-slate-600 mb-8">Submit a booking request</p>
            <div className={PANEL_CLASSES}>
              <div className={ERROR_PANEL_CLASSES}>
                <p>Invalid booking link. Please use the link provided by the business.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Business Logo and Name Header */}
            {(logoUrl || businessName) && (
              <div className="mb-8 text-center">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={businessName || "Business logo"}
                    className="mx-auto mb-3 max-h-12 object-contain"
                    width={200}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Hide image if it fails to load
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                {businessName && (
                  <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                    {businessName}
                  </h2>
                )}
              </div>
            )}

            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{isInstantMode ? "Book Appointment" : "Booking Request"}</h1>
            <p className="text-sm md:text-base text-slate-600 mb-8">{isInstantMode ? "Select a time and book instantly" : "Submit a booking request"}</p>
            
            {/* P2-1: Context Error Warning Banner - blocks form submission */}
            {contextError && (
              <div className="mb-6">
                <div className={PANEL_CLASSES}>
                  <div className={ERROR_PANEL_CLASSES}>
                    <h2 className="text-lg font-semibold mb-2">We couldn't load booking details</h2>
                    <p>Please refresh the page or contact the business for assistance.</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className={PANEL_CLASSES}>
        {loading ? (
          // Loading state
          <p className="text-slate-600">Loading booking form...</p>
        ) : submitSuccess ? (
          // Success State
          <div className="space-y-6">
            <div className="rounded-xl border border-green-200 bg-green-50 text-green-600 p-6">
              <h2 className="text-lg font-semibold mb-2">Request sent!</h2>
              <p className="mb-4">
                Thanks — your request has been sent to the business for review. You'll receive confirmation once they approve the time or suggest a new one.
              </p>
              <p className="text-sm opacity-80">
                You can close this page now.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetForm}
              className={SUBMIT_BUTTON_CLASSES}
            >
              Submit another request
            </button>
          </div>
        ) : (
          <>
            {context.policyText && (
          <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold mb-2 text-slate-900">Booking Policies</h3>
            <p className="text-sm whitespace-pre-wrap text-slate-600">{context.policyText}</p>
          </div>
        )}

        {isInstantMode ? (
          // Instant Booking UI
          <form onSubmit={handleInstantBooking} className="space-y-6">
            {context.services && context.services.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Service (Optional)
                </label>
                <select
                  value={formData.serviceId || ""}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value || null })}
                  className={INPUT_CLASSES}
                >
                  <option value="">Select a service...</option>
                  {context.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.durationMinutes} min)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="select-date" className="block text-sm font-medium mb-2 text-slate-700">
                Select Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="select-date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDate}
                max={maxDate}
                className={INPUT_CLASSES}
                required
                disabled={contextError}
              />
              <p className="mt-1 text-xs text-slate-600">
                Select a date to see available times.
              </p>
            </div>

            {selectedDate && (
              <div>
                <label htmlFor="time-slot-selector" className="block text-sm font-medium mb-2 text-slate-700">
                  Select Time <span className="text-red-500">*</span>
                </label>
                {slotsLoading ? (
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <p className="text-slate-600">Loading available times...</p>
                  </div>
                ) : slotsError ? (
                  <div className={ERROR_PANEL_CLASSES}>
                    <p>{slotsError}</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <p className="text-slate-600">
                      No times available for this date. Please select another date or{" "}
                      <button
                        type="button"
                        onClick={() => setShowRequestForm(true)}
                        className="underline text-teal-600"
                      >
                        request a different time
                      </button>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    {calendarWarning && (
                      <div className="mb-3 p-2 rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs">
                        {calendarWarning}
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded border text-sm transition-colors ${
                            selectedSlot?.startTime === slot.startTime
                              ? "bg-teal-500 border-teal-600 text-white"
                              : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {slot.displayTime}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <label htmlFor="customer-name-instant" className="block text-sm font-medium mb-2 text-slate-700">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="customer-name-instant"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className={INPUT_CLASSES}
                required
                disabled={contextError}
              />
            </div>

            <div>
              <label htmlFor="customer-email-instant" className="block text-sm font-medium mb-2 text-slate-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="customer-email-instant"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className={INPUT_CLASSES}
                required
                disabled={contextError}
              />
            </div>

            <div>
              <label htmlFor="customer-phone-instant" className="block text-sm font-medium mb-2 text-slate-700">
                Phone (Optional)
              </label>
              <input
                type="tel"
                id="customer-phone-instant"
                value={formData.customerPhone || ""}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className={INPUT_CLASSES}
                disabled={contextError}
              />
            </div>

            <div>
              <label htmlFor="customer-message-instant" className="block text-sm font-medium mb-2 text-slate-700">
                Message (Optional)
              </label>
              <textarea
                id="customer-message-instant"
                value={formData.message || ""}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className={`${INPUT_CLASSES} resize-none`}
                placeholder="Any additional information or special requests..."
                disabled={contextError}
              />
            </div>

            {error && (
              <div className={ERROR_PANEL_CLASSES}>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot || !selectedDate || contextError}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {submitting ? "Booking..." : "Book Now"}
            </button>

            <p className="mt-3 text-xs text-slate-500 text-center">
              After you submit your request, it's sent to the business for review. They'll confirm the time or suggest a new one before anything is booked.
            </p>

            <div className="pt-4 border-t border-slate-300">
              <p className="text-sm text-slate-600 mb-2">
                Prefer a different time?
              </p>
              <button
                type="button"
                onClick={() => setShowRequestForm(true)}
                className="text-sm underline text-teal-600"
              >
                Submit a booking request instead
              </button>
            </div>
          </form>
        ) : (
          // Request Form (V3 behavior)
          <form onSubmit={handleSubmit} className="space-y-6">
          {context && context.services.length > 0 && (
            <div>
              <label htmlFor="service-select" className="block text-sm font-medium mb-2 text-slate-700">
                Service (Optional)
              </label>
              <select
                id="service-select"
                value={formData.serviceId || ""}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value || null })}
                className={INPUT_CLASSES}
                disabled={contextError}
              >
                <option value="">Select a service...</option>
                {context.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.durationMinutes} min)
                  </option>
                ))}
              </select>
              {formData.serviceId && context && (() => {
                const selectedService = context.services.find(s => s.id === formData.serviceId);
                if (selectedService && selectedService.durationMinutes) {
                  return (
                    <p className="mt-1 text-xs text-slate-600">
                      This service typically takes about {selectedService.durationMinutes} minutes.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}

          <div>
            <label htmlFor="customer-name" className="block text-sm font-medium mb-2 text-slate-700">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="customer-name"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className={INPUT_CLASSES}
              required
              disabled={contextError}
            />
          </div>

          <div>
            <label htmlFor="customer-email" className="block text-sm font-medium mb-2 text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="customer-email"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              className={INPUT_CLASSES}
              required
              disabled={contextError}
            />
          </div>

          <div>
            <label htmlFor="customer-phone" className="block text-sm font-medium mb-2 text-slate-700">
              Phone (Optional)
            </label>
            <input
              type="tel"
              id="customer-phone"
              value={formData.customerPhone || ""}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              className={INPUT_CLASSES}
              disabled={contextError}
            />
          </div>

          <div>
            <label htmlFor="preferred-start" className="block text-sm font-medium mb-2 text-slate-700">
              Preferred Start Time (Optional)
            </label>
            <input
              type="datetime-local"
              id="preferred-start"
              step={900}
              value={formData.preferredStart ? new Date(formData.preferredStart).toISOString().slice(0, 16) : ""}
              onChange={(e) => {
                setTimeAdjusted(false);
                if (!e.target.value) {
                  setFormData({ ...formData, preferredStart: "" });
                  return;
                }
                // Normalize to 15-minute increments
                const date = new Date(e.target.value);
                const minutes = date.getMinutes();
                const roundedMinutes = Math.round(minutes / 15) * 15;
                date.setMinutes(roundedMinutes);
                date.setSeconds(0);
                date.setMilliseconds(0);
                setFormData({ ...formData, preferredStart: date.toISOString() });
              }}
              onBlur={(e) => {
                if (!e.target.value || !formData.preferredStart) {
                  setTimeAdjusted(false);
                  return;
                }
                // Normalize on blur to handle manual typing
                const date = new Date(e.target.value);
                const originalMinutes = date.getMinutes();
                const roundedMinutes = Math.round(originalMinutes / 15) * 15;
                
                if (originalMinutes !== roundedMinutes) {
                  date.setMinutes(roundedMinutes);
                  date.setSeconds(0);
                  date.setMilliseconds(0);
                  setFormData({ ...formData, preferredStart: date.toISOString() });
                  setTimeAdjusted(true);
                  // Clear the message after 3 seconds
                  setTimeout(() => setTimeAdjusted(false), 3000);
                } else {
                  setTimeAdjusted(false);
                }
              }}
              className={INPUT_CLASSES}
              disabled={contextError}
            />
            <p className="mt-1 text-xs text-slate-600">
              Optional — pick your preferred start time. The service duration is handled automatically.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Times are available in 15-minute increments.
            </p>
            {timeAdjusted && (
              <p className="mt-1 text-xs text-teal-600">
                Adjusted to the nearest 15-minute increment.
              </p>
            )}
            {!formData.preferredStart && suggestedStartTime && (
              <div className="mt-2 flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50">
                <span className="text-xs text-slate-600">
                  Suggested: {new Date(suggestedStartTime).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const suggestedDate = new Date(suggestedStartTime);
                    const localDateTime = new Date(suggestedDate.getTime() - suggestedDate.getTimezoneOffset() * 60000);
                    const isoString = localDateTime.toISOString().slice(0, 16);
                    setFormData({ ...formData, preferredStart: suggestedDate.toISOString() });
                  }}
                  className="px-2 py-1 text-xs rounded bg-teal-500 text-white hover:bg-teal-600 transition-colors"
                >
                  Use suggested time
                </button>
              </div>
            )}
            {formData.preferredStart && formData.serviceId && context && (() => {
              const selectedService = context.services.find(s => s.id === formData.serviceId);
              if (selectedService && selectedService.durationMinutes) {
                try {
                  const startDate = new Date(formData.preferredStart);
                  const endDate = new Date(startDate.getTime() + selectedService.durationMinutes * 60000);
                  const formattedEnd = endDate.toLocaleString();
                  return (
                    <p className="mt-1 text-xs font-medium text-teal-600">
                      Estimated end time: {formattedEnd}
                    </p>
                  );
                } catch {
                  return null;
                }
              }
              return null;
            })()}
            {!formData.preferredStart && formData.serviceId && context && (() => {
              const selectedService = context.services.find(s => s.id === formData.serviceId);
              if (selectedService && selectedService.durationMinutes) {
                return (
                  <p className="mt-1 text-xs text-slate-600">
                    Pick a preferred start time and we'll estimate the end time based on service duration.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">
              Message (Optional)
            </label>
            <textarea
              value={formData.message || ""}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              className={`${INPUT_CLASSES} resize-none`}
              placeholder="Any additional information or special requests..."
            />
          </div>

          {error && (
            <div className={ERROR_PANEL_CLASSES}>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className={SUBMIT_BUTTON_CLASSES}
          >
            {submitting ? "Submitting..." : loading ? "Loading..." : "Submit Booking Request"}
          </button>

          <p className="mt-3 text-xs text-slate-500 text-center">
            After you submit your request, it's sent to the business for review. They'll confirm the time or suggest a new one before anything is booked.
          </p>
        </form>
        )}
            </>
          )}
        </div>
        </>
        )}
        
        {/* Footer - Always shown */}
      <div className="mt-12 pb-8 text-center">
        <p className="text-xs text-slate-500">
          Powered by{" "}
          <a
            href="https://ocalabusinessdirectory.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-slate-900 underline"
          >
            Ocala Business Directory
          </a>
        </p>
      </div>
      </div>
    </main>
  );
}

