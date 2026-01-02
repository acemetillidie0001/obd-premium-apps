"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import { ErrorBoundary } from "@/components/obd/ErrorBoundary";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type { BookingService, CreateBookingRequestRequest } from "@/lib/apps/obd-scheduler/types";

function OBDSchedulerPublicPageContent() {
  const searchParams = useSearchParams();
  const bookingKey = searchParams.get("key");

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [services, setServices] = useState<BookingService[]>([]);
  const [policyText, setPolicyText] = useState<string | null>(null);
  const [minNoticeHours, setMinNoticeHours] = useState<number | null>(null);
  const [timeAdjusted, setTimeAdjusted] = useState(false);
  const [formData, setFormData] = useState<CreateBookingRequestRequest>({
    serviceId: null,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    preferredStart: "",
    message: "",
  });

  // Load services and context if bookingKey is provided
  useEffect(() => {
    if (!bookingKey) {
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

        setServices(data.data.services || []);
        setPolicyText(data.data.policyText || null);
        setMinNoticeHours(data.data.minNoticeHours || null);
      } catch (error) {
        console.error("Error loading context:", error);
        // Don't set error here - let the form still work without services
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, [bookingKey]);

  // Calculate suggested start time
  const suggestedStartTime = useMemo(() => {
    try {
      // Start from now (use local browser time)
      const now = new Date();
      
      // Round up to next full hour
      const nextHour = new Date(now);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      nextHour.setMilliseconds(0);
      nextHour.setHours(nextHour.getHours() + 1);
      
      // Add minNoticeHours (from context or default to 24)
      const noticeHours = minNoticeHours || 24;
      const suggested = new Date(nextHour.getTime() + noticeHours * 60 * 60 * 1000);
      
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
  }, [minNoticeHours]);

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
        bookingKey: bookingKey || undefined,
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
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        title="Booking Request"
        tagline="Submit a booking request"
      >
        <OBDPanel isDark={isDark}>
          <div className={getErrorPanelClasses(isDark)}>
            <p>Invalid booking link. Please use the link provided by the business.</p>
          </div>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  if (loading) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        title="Booking Request"
        tagline="Submit a booking request"
      >
        <OBDPanel isDark={isDark}>
          <p className={themeClasses.mutedText}>Loading booking form...</p>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  if (submitted) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        title="Booking Request"
        tagline="Submit a booking request"
      >
        <OBDPanel isDark={isDark}>
          <div className={`rounded-xl border p-6 ${isDark ? "bg-green-900/20 border-green-700 text-green-400" : "bg-green-50 border-green-200 text-green-600"}`}>
            <h2 className="text-lg font-semibold mb-2">Request Submitted Successfully!</h2>
            <p>Thank you for your booking request. The business owner will review it and get back to you soon.</p>
          </div>
        </OBDPanel>
      </OBDPageContainer>
    );
  }

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Booking Request"
      tagline="Submit a booking request"
    >
      <OBDPanel isDark={isDark}>
        {bookingKey && (
          <div className={`mb-4 p-3 rounded-lg border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              <span className={themeClasses.headingText}>Note:</span> For a cleaner URL, use{" "}
              <a
                href={`/book/${bookingKey}`}
                className="text-[#29c4a9] hover:underline"
              >
                /book/{bookingKey}
              </a>
            </p>
          </div>
        )}

        {policyText && (
          <div className={`mb-6 p-4 rounded-lg border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Booking Policies</h3>
            <p className={`text-sm whitespace-pre-wrap ${themeClasses.mutedText}`}>{policyText}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {services.length > 0 && (
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
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.durationMinutes} min)
                  </option>
                ))}
              </select>
              {formData.serviceId && (() => {
                const selectedService = services.find(s => s.id === formData.serviceId);
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
              Your Name * <span className="text-red-500">*</span>
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
              Email * <span className="text-red-500">*</span>
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
                    setFormData({ ...formData, preferredStart: suggestedDate.toISOString() });
                  }}
                  className={`px-2 py-1 text-xs rounded ${isDark ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-teal-500 text-white hover:bg-teal-600"} transition-colors`}
                >
                  Use suggested time
                </button>
              </div>
            )}
            {formData.preferredStart && formData.serviceId && (() => {
              const selectedService = services.find(s => s.id === formData.serviceId);
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
            {!formData.preferredStart && formData.serviceId && (() => {
              const selectedService = services.find(s => s.id === formData.serviceId);
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
        </form>
      </OBDPanel>
    </OBDPageContainer>
  );
}

export default function OBDSchedulerPublicPage() {
  return (
    <ErrorBoundary
      fallbackTitle="Something went wrong"
      fallbackMessage="We encountered an error loading the booking form. Please try again or contact the business directly."
      showHomeLink={false}
    >
      <OBDSchedulerPublicPageContent />
    </ErrorBoundary>
  );
}

