"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import OBDPanel from "@/components/obd/OBDPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type { CreateBookingRequestRequest, BookingService, BookingMode } from "@/lib/apps/obd-scheduler/types";
import { BookingMode as BookingModeEnum } from "@/lib/apps/obd-scheduler/types";

interface BusinessContext {
  businessId: string;
  bookingModeDefault: BookingMode;
  timezone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysOut: number;
  policyText: string | null;
  services: BookingService[];
}

interface Slot {
  startTime: string;
  displayTime: string;
}

interface SlotsResponse {
  date: string;
  slots: Slot[];
}

export default function PublicBookingPage() {
  const params = useParams();
  const bookingKey = params?.bookingKey as string;

  // Force light mode for public booking page (no theme toggle)
  const isDark = false;
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState<BusinessContext | null>(null);
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
        const res = await fetch(`/api/obd-scheduler/public/context?key=${encodeURIComponent(bookingKey)}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load booking form");
        }

        setContext(data.data);
      } catch (error) {
        console.error("Error loading context:", error);
        setError(error instanceof Error ? error.message : "Failed to load booking form");
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, [bookingKey]);

  // Calculate suggested start time
  const suggestedStartTime = useMemo(() => {
    if (!context) return null;
    
    try {
      // Start from now (use business timezone if available, otherwise local)
      const now = new Date();
      
      // Round up to next full hour
      const nextHour = new Date(now);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      nextHour.setMilliseconds(0);
      nextHour.setHours(nextHour.getHours() + 1);
      
      // Add minNoticeHours (from context or default to 24)
      const minNoticeHours = context.minNoticeHours || 24;
      const suggested = new Date(nextHour.getTime() + minNoticeHours * 60 * 60 * 1000);
      
      // Snap minutes to next 15-minute boundary (ceil to 0/15/30/45)
      const minutes = suggested.getMinutes();
      const roundedMinutes = Math.ceil(minutes / 15) * 15;
      if (roundedMinutes >= 60) {
        // If rounded to 60, move to next hour
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
  }, [context]);

  // Fetch slots for selected date and service
  const fetchSlots = async (date: string, serviceId: string | null) => {
    if (!bookingKey || !date) return;

    setSlotsLoading(true);
    setSlotsError("");
    setSlots([]);
    setSelectedSlot(null);

    try {
      const params = new URLSearchParams({
        bookingKey,
        date,
      });
      if (serviceId) {
        params.set("serviceId", serviceId);
      }

      const res = await fetch(`/api/obd-scheduler/slots?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load available times");
      }

      const slotsData: SlotsResponse = data.data;
      setSlots(slotsData.slots);
    } catch (error) {
      console.error("Error loading slots:", error);
      setSlotsError(error instanceof Error ? error.message : "Failed to load available times");
    } finally {
      setSlotsLoading(false);
    }
  };

  // Handle date or service change for instant booking
  useEffect(() => {
    if (context?.bookingModeDefault === BookingModeEnum.INSTANT_ALLOWED && selectedDate) {
      fetchSlots(selectedDate, formData.serviceId ?? null);
    }
  }, [selectedDate, formData.serviceId, context?.bookingModeDefault, bookingKey]);

  // Handle instant booking submission
  const handleInstantBooking = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.customerEmail)) {
      setError("Please enter a valid email address");
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

      setSubmitted(true);
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.customerEmail)) {
      setError("Please enter a valid email address");
      setSubmitting(false);
      return;
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

      setSubmitted(true);
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

  if (!bookingKey) {
    return (
      <main className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Booking Request</h1>
          <p className="text-sm md:text-base text-slate-600 mb-8">Submit a booking request</p>
          <OBDPanel isDark={isDark}>
            <div className={getErrorPanelClasses(isDark)}>
              <p>Invalid booking link. Please use the link provided by the business.</p>
            </div>
          </OBDPanel>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Booking Request</h1>
          <p className="text-sm md:text-base text-slate-600 mb-8">Submit a booking request</p>
          <OBDPanel isDark={isDark}>
            <p className={themeClasses.mutedText}>Loading booking form...</p>
          </OBDPanel>
        </div>
      </main>
    );
  }

  if (error && !context) {
    return (
      <main className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Booking Request</h1>
          <p className="text-sm md:text-base text-slate-600 mb-8">Submit a booking request</p>
          <OBDPanel isDark={isDark}>
            <div className={getErrorPanelClasses(isDark)}>
              <p>{error}</p>
            </div>
          </OBDPanel>
        </div>
      </main>
    );
  }

  if (submitted) {
    const isInstant = context?.bookingModeDefault === BookingModeEnum.INSTANT_ALLOWED;
    return (
      <main className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{isInstant ? "Booking Confirmed" : "Booking Request"}</h1>
          <p className="text-sm md:text-base text-slate-600 mb-8">{isInstant ? "Your booking is confirmed" : "Submit a booking request"}</p>
          <OBDPanel isDark={isDark}>
            <div className={`rounded-xl border p-6 ${isDark ? "bg-green-900/20 border-green-700 text-green-400" : "bg-green-50 border-green-200 text-green-600"}`}>
              <h2 className="text-lg font-semibold mb-2">{isInstant ? "Booking Confirmed!" : "Request Received"}</h2>
              <p>{isInstant ? "Your booking has been confirmed. You'll receive a confirmation email shortly." : "The business will confirm shortly."}</p>
            </div>
          </OBDPanel>
        </div>
      </main>
    );
  }

  const isInstantMode = context?.bookingModeDefault === BookingModeEnum.INSTANT_ALLOWED && !showRequestForm;

  // Calculate min and max dates for date picker
  const minDate = useMemo(() => {
    if (!context) return "";
    const now = new Date();
    const minNotice = new Date(now.getTime() + context.minNoticeHours * 60 * 60 * 1000);
    return minNotice.toISOString().split("T")[0];
  }, [context]);

  const maxDate = useMemo(() => {
    if (!context) return "";
    const now = new Date();
    const max = new Date(now.getTime() + context.maxDaysOut * 24 * 60 * 60 * 1000);
    return max.toISOString().split("T")[0];
  }, [context]);

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{isInstantMode ? "Book Appointment" : "Booking Request"}</h1>
        <p className="text-sm md:text-base text-slate-600 mb-8">{isInstantMode ? "Select a time and book instantly" : "Submit a booking request"}</p>
        <OBDPanel isDark={isDark}>
        {context?.policyText && (
          <div className={`mb-6 p-4 rounded-lg border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Booking Policies</h3>
            <p className={`text-sm whitespace-pre-wrap ${themeClasses.mutedText}`}>{context.policyText}</p>
          </div>
        )}

        {isInstantMode ? (
          // Instant Booking UI
          <form onSubmit={handleInstantBooking} className="space-y-6">
            {context && context.services.length > 0 && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Service (Optional)
                </label>
                <select
                  value={formData.serviceId || ""}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value || null })}
                  className={getInputClasses(isDark)}
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
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Select Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDate}
                max={maxDate}
                className={getInputClasses(isDark)}
                required
              />
              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                Select a date to see available times.
              </p>
            </div>

            {selectedDate && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Select Time <span className="text-red-500">*</span>
                </label>
                {slotsLoading ? (
                  <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <p className={themeClasses.mutedText}>Loading available times...</p>
                  </div>
                ) : slotsError ? (
                  <div className={getErrorPanelClasses(isDark)}>
                    <p>{slotsError}</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className={`p-4 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <p className={themeClasses.mutedText}>
                      No times available for this date. Please select another date or{" "}
                      <button
                        type="button"
                        onClick={() => setShowRequestForm(true)}
                        className={`underline ${isDark ? "text-teal-400" : "text-teal-600"}`}
                      >
                        request a different time
                      </button>
                      .
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded border text-sm transition-colors ${
                          selectedSlot?.startTime === slot.startTime
                            ? isDark
                              ? "bg-teal-600 border-teal-500 text-white"
                              : "bg-teal-500 border-teal-600 text-white"
                            : isDark
                            ? "bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700"
                            : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {slot.displayTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className={getInputClasses(isDark)}
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
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
                value={formData.customerPhone || ""}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className={getInputClasses(isDark)}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Message (Optional)
              </label>
              <textarea
                value={formData.message || ""}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className={getInputClasses(isDark, "resize-none")}
                placeholder="Any additional information or special requests..."
              />
            </div>

            {error && (
              <div className={getErrorPanelClasses(isDark)}>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot || !selectedDate}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {submitting ? "Booking..." : "Book Now"}
            </button>

            <p className="mt-3 text-xs text-slate-500 text-center">
              After you submit your request, it's sent to the business for review. They'll confirm the time or suggest a new one before anything is booked.
            </p>

            <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
              <p className={`text-sm ${themeClasses.mutedText} mb-2`}>
                Prefer a different time?
              </p>
              <button
                type="button"
                onClick={() => setShowRequestForm(true)}
                className={`text-sm underline ${isDark ? "text-teal-400" : "text-teal-600"}`}
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
              <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                Service (Optional)
              </label>
              <select
                value={formData.serviceId || ""}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value || null })}
                className={getInputClasses(isDark)}
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
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      This service typically takes about {selectedService.durationMinutes} minutes.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className={getInputClasses(isDark)}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
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
              value={formData.customerPhone || ""}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              className={getInputClasses(isDark)}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Preferred Start Time (Optional)
            </label>
            <input
              type="datetime-local"
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
              className={getInputClasses(isDark)}
            />
            <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
              Optional — pick your preferred start time. The service duration is handled automatically.
            </p>
            <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
              Times are available in 15-minute increments.
            </p>
            {timeAdjusted && (
              <p className={`mt-1 text-xs ${isDark ? "text-teal-400" : "text-teal-600"}`}>
                Adjusted to the nearest 15-minute increment.
              </p>
            )}
            {!formData.preferredStart && suggestedStartTime && (
              <div className={`mt-2 flex items-center gap-2 p-2 rounded border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <span className={`text-xs ${themeClasses.mutedText}`}>
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
                  className={`px-2 py-1 text-xs rounded ${isDark ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-teal-500 text-white hover:bg-teal-600"} transition-colors`}
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
                    <p className={`mt-1 text-xs font-medium ${isDark ? "text-teal-400" : "text-teal-600"}`}>
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
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Pick a preferred start time and we'll estimate the end time based on service duration.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
              Message (Optional)
            </label>
            <textarea
              value={formData.message || ""}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              className={getInputClasses(isDark, "resize-none")}
              placeholder="Any additional information or special requests..."
            />
          </div>

          {error && (
            <div className={getErrorPanelClasses(isDark)}>
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
      </OBDPanel>
      </div>
    </main>
  );
}

