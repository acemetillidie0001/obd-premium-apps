"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import type { CreateBookingRequestRequest, BookingService } from "@/lib/apps/obd-scheduler/types";

interface BusinessContext {
  businessId: string;
  timezone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysOut: number;
  policyText: string | null;
  services: BookingService[];
}

export default function PublicBookingPage() {
  const params = useParams();
  const bookingKey = params?.bookingKey as string;

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [formData, setFormData] = useState<CreateBookingRequestRequest>({
    serviceId: null,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    preferredStart: "",
    message: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

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

  if (error && !context) {
    return (
      <OBDPageContainer
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        title="Booking Request"
        tagline="Submit a booking request"
      >
        <OBDPanel isDark={isDark}>
          <div className={getErrorPanelClasses(isDark)}>
            <p>{error}</p>
          </div>
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
            <h2 className="text-lg font-semibold mb-2">Request Received</h2>
            <p>The business will confirm shortly.</p>
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
        {context?.policyText && (
          <div className={`mb-6 p-4 rounded-lg border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Booking Policies</h3>
            <p className={`text-sm whitespace-pre-wrap ${themeClasses.mutedText}`}>{context.policyText}</p>
          </div>
        )}

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
              value={formData.preferredStart ? new Date(formData.preferredStart).toISOString().slice(0, 16) : ""}
              onChange={(e) => setFormData({ ...formData, preferredStart: e.target.value ? new Date(e.target.value).toISOString() : "" })}
              className={getInputClasses(isDark)}
            />
            <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
              Optional — pick your preferred start time. The service duration is handled automatically.
            </p>
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

