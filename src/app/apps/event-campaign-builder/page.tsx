"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import ResultCard from "@/components/obd/ResultCard";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import {
  EventCampaignFormValues,
  EventCampaignResponse,
  EventGoal,
  EventType,
  PersonalityStyle,
  LanguageOption,
} from "./types";

const defaultFormValues: EventCampaignFormValues = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  eventName: "",
  eventDate: "",
  eventTime: "",
  eventLocation: "",
  eventType: "InPerson",
  eventDescription: "",
  audience: "",
  mainGoal: "Awareness",
  budgetLevel: "Free",
  urgencyLevel: "Normal",
  brandVoice: "",
  personalityStyle: "None",
  language: "English",
  includeFacebook: true,
  includeInstagram: true,
  includeX: false,
  includeGoogleBusiness: true,
  includeEmail: false,
  includeSms: false,
  includeImageCaption: false,
  campaignDurationDays: 10,
  notesForAI: "",
};

const EVENT_GOALS: EventGoal[] = [
  "Awareness",
  "RSVPs",
  "TicketSales",
  "WalkIns",
  "Leads",
  "Other",
];

const EVENT_TYPES: EventType[] = ["InPerson", "Virtual", "Hybrid"];

const BUDGET_LEVELS: ("Free" | "Low" | "Moderate" | "Premium")[] = [
  "Free",
  "Low",
  "Moderate",
  "Premium",
];

const URGENCY_LEVELS: ("Normal" | "Last-Minute")[] = ["Normal", "Last-Minute"];

export default function EventCampaignBuilderPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<EventCampaignFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventCampaignResponse | null>(null);
  const [lastPayload, setLastPayload] =
    useState<EventCampaignFormValues | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  function updateFormValue<K extends keyof EventCampaignFormValues>(
    key: K,
    value: EventCampaignFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError(null);
    setResult(null);

    // Validation
    if (!form.businessName.trim()) {
      setError("Please enter a business name.");
      return;
    }

    if (!form.businessType.trim()) {
      setError("Please enter a business type.");
      return;
    }

    if (!form.eventName.trim()) {
      setError("Please enter an event name.");
      return;
    }

    if (!form.eventDescription.trim()) {
      setError("Please describe the event.");
      return;
    }

    if (!form.eventDate.trim()) {
      setError("Please enter an event date.");
      return;
    }

    if (!form.eventTime.trim()) {
      setError("Please enter an event time.");
      return;
    }

    if (!form.eventLocation.trim()) {
      setError("Please enter an event location.");
      return;
    }

    if (
      !form.includeFacebook &&
      !form.includeInstagram &&
      !form.includeX &&
      !form.includeGoogleBusiness &&
      !form.includeEmail &&
      !form.includeSms
    ) {
      setError("Please select at least one channel.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/event-campaign-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json();
      
      // Handle new response format: { ok: true, data: EventCampaignResponse }
      if (response.ok && response.data) {
        setResult(response.data);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        // Scroll to results
        setTimeout(() => {
          const resultsElement = document.getElementById("campaign-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        // Fallback for old format (direct EventCampaignResponse)
        setResult(response);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      }
      
      setLastPayload({ ...form });
    } catch (error) {
      console.error("EventCampaignBuilder Submit Error:", error);
      let errorMessage = "Something went wrong while generating your campaign. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    setForm(lastPayload);
    await handleSubmit();
  };

  const handleStartNew = () => {
    setForm(defaultFormValues);
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Event Campaign Builder"
      tagline="Turn your event details into a complete, ready-to-post promotional campaign in minutes."
    >
      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Business Basics */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Business Basics
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Name *
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) =>
                      updateFormValue("businessName", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="businessType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Type *
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={form.businessType}
                    onChange={(e) =>
                      updateFormValue("businessType", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="services"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Services
                  </label>
                  <textarea
                    id="services"
                    value={form.services}
                    onChange={(e) => updateFormValue("services", e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Pressure washing, driveway cleaning, window cleaning"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="city"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={form.city}
                      onChange={(e) => updateFormValue("city", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Ocala"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="state"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={form.state}
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Event Core Details */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Event Details
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="eventName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Name *
                  </label>
                  <input
                    type="text"
                    id="eventName"
                    value={form.eventName}
                    onChange={(e) =>
                      updateFormValue("eventName", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Spring Open House"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="eventDate"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Event Date *
                    </label>
                    <input
                      type="text"
                      id="eventDate"
                      value={form.eventDate}
                      onChange={(e) =>
                        updateFormValue("eventDate", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="March 15, 2026"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="eventTime"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Event Time *
                    </label>
                    <input
                      type="text"
                      id="eventTime"
                      value={form.eventTime}
                      onChange={(e) =>
                        updateFormValue("eventTime", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="6:00 PM – 9:00 PM"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="eventLocation"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Location *
                  </label>
                  <input
                    type="text"
                    id="eventLocation"
                    value={form.eventLocation}
                    onChange={(e) =>
                      updateFormValue("eventLocation", e.target.value)
                    }
                    className={getInputClasses(isDark)}
                    placeholder="123 Main St, Ocala, FL"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="eventType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Type
                  </label>
                  <select
                    id="eventType"
                    value={form.eventType}
                    onChange={(e) =>
                      updateFormValue("eventType", e.target.value as EventType)
                    }
                    className={getInputClasses(isDark)}
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "InPerson"
                          ? "In-Person"
                          : type === "Virtual"
                          ? "Virtual"
                          : "Hybrid"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="eventDescription"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Event Description *
                  </label>
                  <textarea
                    id="eventDescription"
                    value={form.eventDescription}
                    onChange={(e) =>
                      updateFormValue("eventDescription", e.target.value)
                    }
                    rows={5}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="What's happening at this event? What should attendees expect?"
                    required
                  />
                  <div className="flex items-center justify-end mt-1">
                    <p
                      className={`text-xs ${
                        form.eventDescription.length === 0
                          ? themeClasses.mutedText
                          : form.eventDescription.length <= 600
                          ? themeClasses.mutedText
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {form.eventDescription.length} / 600 characters
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Strategy */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Strategy
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="audience"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Target Audience
                  </label>
                  <input
                    type="text"
                    id="audience"
                    value={form.audience}
                    onChange={(e) => updateFormValue("audience", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Local families, horse owners, small business owners"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mainGoal"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Main Goal
                  </label>
                  <select
                    id="mainGoal"
                    value={form.mainGoal}
                    onChange={(e) =>
                      updateFormValue("mainGoal", e.target.value as EventGoal)
                    }
                    className={getInputClasses(isDark)}
                  >
                    {EVENT_GOALS.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="budgetLevel"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Budget Level
                    </label>
                    <select
                      id="budgetLevel"
                      value={form.budgetLevel}
                      onChange={(e) =>
                        updateFormValue(
                          "budgetLevel",
                          e.target.value as "Free" | "Low" | "Moderate" | "Premium"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      {BUDGET_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="urgencyLevel"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Urgency Level
                    </label>
                    <select
                      id="urgencyLevel"
                      value={form.urgencyLevel}
                      onChange={(e) =>
                        updateFormValue(
                          "urgencyLevel",
                          e.target.value as "Normal" | "Last-Minute"
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      {URGENCY_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level === "Last-Minute" ? "Last-Minute" : "Normal"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Brand & Style */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Brand & Style
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="brandVoice"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Brand Voice
                  </label>
                  <textarea
                    id="brandVoice"
                    value={form.brandVoice}
                    onChange={(e) =>
                      updateFormValue("brandVoice", e.target.value)
                    }
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste 2–4 sentences that sound like your existing brand voice"
                  />
                  <div className="flex items-center justify-end mt-1">
                    <p
                      className={`text-xs ${
                        form.brandVoice.length === 0
                          ? themeClasses.mutedText
                          : form.brandVoice.length <= 400
                          ? themeClasses.mutedText
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {form.brandVoice.length} / 400 characters
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="personalityStyle"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Personality Style
                    </label>
                    <select
                      id="personalityStyle"
                      value={form.personalityStyle}
                      onChange={(e) =>
                        updateFormValue(
                          "personalityStyle",
                          e.target.value as PersonalityStyle
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="None">None</option>
                      <option value="Soft">Soft</option>
                      <option value="Bold">Bold</option>
                      <option value="High-Energy">High-Energy</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="language"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Language
                    </label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(e) =>
                        updateFormValue(
                          "language",
                          e.target.value as LanguageOption
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Bilingual">Bilingual</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Channels */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Channels
              </OBDHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Facebook */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeFacebook", !form.includeFacebook);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeFacebook
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Facebook Posts
                    </span>
                    {form.includeFacebook && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Great for community reach
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeFacebook}
                    onChange={(e) =>
                      updateFormValue("includeFacebook", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include Facebook posts"
                  />
                </label>

                {/* Instagram */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeInstagram", !form.includeInstagram);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeInstagram
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Instagram
                    </span>
                    {form.includeInstagram && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Feed posts & story ideas
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeInstagram}
                    onChange={(e) =>
                      updateFormValue("includeInstagram", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include Instagram content"
                  />
                </label>

                {/* X (Twitter) */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeX", !form.includeX);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeX
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      X (Twitter)
                    </span>
                    {form.includeX && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Concise, punchy posts
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeX}
                    onChange={(e) =>
                      updateFormValue("includeX", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include X (Twitter) posts"
                  />
                </label>

                {/* Google Business */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeGoogleBusiness", !form.includeGoogleBusiness);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeGoogleBusiness
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Google Business
                    </span>
                    {form.includeGoogleBusiness && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Local discovery posts
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeGoogleBusiness}
                    onChange={(e) =>
                      updateFormValue("includeGoogleBusiness", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include Google Business posts"
                  />
                </label>

                {/* Email */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeEmail", !form.includeEmail);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeEmail
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Email
                    </span>
                    {form.includeEmail && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Announcement email
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeEmail}
                    onChange={(e) =>
                      updateFormValue("includeEmail", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include email announcement"
                  />
                </label>

                {/* SMS */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeSms", !form.includeSms);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeSms
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      SMS Messages
                    </span>
                    {form.includeSms && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Short text blasts
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeSms}
                    onChange={(e) =>
                      updateFormValue("includeSms", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include SMS messages"
                  />
                </label>

                {/* Image Caption */}
                <label
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateFormValue("includeImageCaption", !form.includeImageCaption);
                    }
                  }}
                  className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${
                    form.includeImageCaption
                      ? isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/10 shadow-md"
                        : "border-[#29c4a9] bg-[#29c4a9]/5 shadow-md"
                      : isDark
                      ? "border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${themeClasses.labelText}`}>
                      Image Caption
                    </span>
                    {form.includeImageCaption && (
                      <svg
                        className="h-5 w-5 text-[#29c4a9]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    Flyer or poster text
                  </p>
                  <input
                    type="checkbox"
                    checked={form.includeImageCaption}
                    onChange={(e) =>
                      updateFormValue("includeImageCaption", e.target.checked)
                    }
                    className="sr-only"
                    aria-label="Include image caption"
                  />
                </label>
              </div>
            </div>

            <div className={getDividerClass(isDark)} />

            {/* Extra Options */}
            <div>
              <OBDHeading level={2} isDark={isDark} className="mb-4">
                Campaign Settings
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="campaignDurationDays"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Campaign Duration (Days)
                  </label>
                  <input
                    type="number"
                    id="campaignDurationDays"
                    min={3}
                    max={30}
                    value={form.campaignDurationDays}
                    onChange={(e) =>
                      updateFormValue(
                        "campaignDurationDays",
                        Math.max(3, Math.min(30, parseInt(e.target.value) || 10))
                      )
                    }
                    className={getInputClasses(isDark)}
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    How many days before the event should the campaign start? (3–30 days)
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="notesForAI"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Additional Notes
                  </label>
                  <textarea
                    id="notesForAI"
                    value={form.notesForAI}
                    onChange={(e) =>
                      updateFormValue("notesForAI", e.target.value)
                    }
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Any special instructions, tone preferences, or context..."
                  />
                  <div className="flex items-center justify-end mt-1">
                    <p
                      className={`text-xs ${
                        form.notesForAI.length === 0
                          ? themeClasses.mutedText
                          : form.notesForAI.length <= 500
                          ? themeClasses.mutedText
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {form.notesForAI.length} / 500 characters
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Campaign"
              )}
            </button>
          </div>
        </form>
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error</p>
            <p>{error}</p>
          </div>
        </OBDPanel>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 rounded-lg border shadow-lg px-4 py-3 transition-all max-w-sm mx-auto sm:mx-0 ${
            isDark
              ? "bg-[#29c4a9] border-[#29c4a9] text-white"
              : "bg-[#29c4a9] border-[#29c4a9] text-white"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Campaign generated</p>
              <p className="text-sm opacity-90">
                Your event campaign is ready. Review the cards below and copy anything you want to use.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8" id="campaign-results">
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Generated Campaign
            </OBDHeading>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="animate-spin h-8 w-8 text-[#29c4a9]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className={themeClasses.mutedText}>Generating campaign...</p>
                <p className={`text-xs ${themeClasses.mutedText}`}>
                  This usually takes 10-20 seconds
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Meta Info */}
              <div>
                <h3
                  className={`text-base font-semibold mb-3 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Campaign Overview
                </h3>
                <ResultCard
                  title=""
                  isDark={isDark}
                  copyText={`${result.meta.primaryTagline}\n\n${result.meta.primaryCallToAction}${result.meta.recommendedStartDateNote ? `\n\n${result.meta.recommendedStartDateNote}` : ""}${result.meta.timezoneNote ? `\n\n${result.meta.timezoneNote}` : ""}`}
                >
                  <div className="space-y-3">
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Primary Tagline
                      </p>
                      <p
                        className={`font-semibold text-lg ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {result.meta.primaryTagline}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Primary Call to Action
                      </p>
                      <p className="font-medium">{result.meta.primaryCallToAction}</p>
                    </div>
                    {result.meta.recommendedStartDateNote && (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Recommended Start Date
                        </p>
                        <p className="text-sm italic">
                          {result.meta.recommendedStartDateNote}
                        </p>
                      </div>
                    )}
                    {result.meta.timezoneNote && (
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Timezone
                        </p>
                        <p className="text-sm">{result.meta.timezoneNote}</p>
                      </div>
                    )}
                  </div>
                </ResultCard>
              </div>

              {/* Event Titles */}
              {result.assets.eventTitles.length > 0 && (
                <div>
                  <ResultCard
                    title="Event Titles"
                    isDark={isDark}
                    copyText={result.assets.eventTitles.join("\n")}
                  >
                    <div className="space-y-2">
                      {result.assets.eventTitles.map((title, idx) => (
                        <div key={idx} className="p-2 rounded border border-slate-300 dark:border-slate-600">
                          <p className="font-medium">{title}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Short Descriptions */}
              {result.assets.shortDescriptions.length > 0 && (
                <div>
                  <ResultCard
                    title="Short Descriptions"
                    isDark={isDark}
                    copyText={result.assets.shortDescriptions.join("\n\n")}
                  >
                    <div className="space-y-3">
                      {result.assets.shortDescriptions.map((desc, idx) => (
                        <p key={idx} className="whitespace-pre-wrap">{desc}</p>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Long Description */}
              {result.assets.longDescription && (
                <div>
                  <ResultCard
                    title="Long Description"
                    isDark={isDark}
                    copyText={result.assets.longDescription}
                  >
                    <p className="whitespace-pre-wrap">
                      {result.assets.longDescription}
                    </p>
                  </ResultCard>
                </div>
              )}

              {/* Social Posts */}
              {(result.assets.facebookPosts.length > 0 ||
                result.assets.instagramCaptions.length > 0 ||
                result.assets.xPosts.length > 0 ||
                result.assets.googleBusinessPosts.length > 0) && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Social Media Posts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.assets.facebookPosts.map((post, idx) => (
                      <ResultCard
                        key={`fb-${idx}`}
                        title="Facebook"
                        isDark={isDark}
                        copyText={post}
                      >
                        <p className="whitespace-pre-wrap">{post}</p>
                      </ResultCard>
                    ))}

                    {result.assets.instagramCaptions.map((caption, idx) => (
                      <ResultCard
                        key={`ig-${idx}`}
                        title="Instagram Caption"
                        isDark={isDark}
                        copyText={caption}
                      >
                        <p className="whitespace-pre-wrap">{caption}</p>
                      </ResultCard>
                    ))}

                    {result.assets.xPosts.map((post, idx) => (
                      <ResultCard
                        key={`x-${idx}`}
                        title="X (Twitter)"
                        isDark={isDark}
                        copyText={post}
                      >
                        <p className="whitespace-pre-wrap">{post}</p>
                      </ResultCard>
                    ))}

                    {result.assets.googleBusinessPosts.map((post, idx) => (
                      <ResultCard
                        key={`gbp-${idx}`}
                        title="Google Business Profile"
                        isDark={isDark}
                        copyText={post}
                      >
                        <p className="whitespace-pre-wrap">{post}</p>
                      </ResultCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Instagram Story Ideas */}
              {result.assets.instagramStoryIdeas.length > 0 && (
                <div>
                  <ResultCard
                    title="Instagram Stories"
                    isDark={isDark}
                    copyText={result.assets.instagramStoryIdeas.join("\n\n")}
                  >
                    <div className="space-y-3">
                      {result.assets.instagramStoryIdeas.map((idea, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <p className="whitespace-pre-wrap">{idea}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Email Announcement */}
              {result.assets.emailAnnouncement && (
                <div>
                  <ResultCard
                    title="Email Announcement"
                    isDark={isDark}
                    copyText={`Subject: ${result.assets.emailAnnouncement.subject}\n\nPreview: ${result.assets.emailAnnouncement.previewText}\n\n${result.assets.emailAnnouncement.bodyText}`}
                  >
                    <div className="space-y-4">
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Subject
                        </p>
                        <p>{result.assets.emailAnnouncement.subject}</p>
                      </div>
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Preview Text
                        </p>
                        <p className="text-sm italic">
                          {result.assets.emailAnnouncement.previewText}
                        </p>
                      </div>
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Body (Text)
                        </p>
                        <p className="whitespace-pre-wrap">
                          {result.assets.emailAnnouncement.bodyText}
                        </p>
                      </div>
                      {result.assets.emailAnnouncement.bodyHtml && (
                        <div>
                          <p
                            className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                              isDark ? "text-slate-400" : "text-slate-500"
                            }`}
                          >
                            Body (HTML)
                          </p>
                          <div
                            className="p-3 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            dangerouslySetInnerHTML={{
                              __html: result.assets.emailAnnouncement.bodyHtml,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* SMS Blasts */}
              {result.assets.smsBlasts && result.assets.smsBlasts.length > 0 && (
                <div>
                  <ResultCard
                    title="SMS Messages"
                    isDark={isDark}
                    copyText={result.assets.smsBlasts.join("\n\n")}
                  >
                    <div className="space-y-3">
                      {result.assets.smsBlasts.map((sms, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <p className="whitespace-pre-wrap">{sms}</p>
                          <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                            Length: {sms.length} characters
                          </p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}

              {/* Image Caption */}
              {result.assets.imageCaption && (
                <div>
                  <ResultCard
                    title="Image Caption"
                    isDark={isDark}
                    copyText={result.assets.imageCaption}
                  >
                    <p className="whitespace-pre-wrap">
                      {result.assets.imageCaption}
                    </p>
                  </ResultCard>
                </div>
              )}

              {/* Hashtag Bundles */}
              {result.assets.hashtagBundles.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Hashtag Bundles
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.assets.hashtagBundles.map((bundle, idx) => (
                      <ResultCard
                        key={idx}
                        title={`${bundle.platform} Hashtags`}
                        isDark={isDark}
                        copyText={bundle.tags.join(" ")}
                      >
                        <div className="flex flex-wrap gap-2">
                          {bundle.tags.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className={`px-2 py-1 rounded text-xs ${
                                isDark
                                  ? "bg-slate-700 text-slate-200"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </ResultCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule Ideas */}
              {result.assets.scheduleIdeas.length > 0 && (
                <div>
                  <div className={getDividerClass(isDark)} />
                  <h3
                    className={`text-base font-semibold mt-6 mb-4 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Posting Schedule
                  </h3>
                  <ResultCard title="" isDark={isDark}>
                    <div className="space-y-4">
                      {result.assets.scheduleIdeas.map((idea, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded border border-slate-300 dark:border-slate-600"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {idea.label}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                isDark
                                  ? "bg-slate-700 text-slate-200"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {idea.channel}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{idea.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                </div>
              )}
            </div>
          )}
        </OBDPanel>
      )}

      {!result && !loading && !error && (
        <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">📅</div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Ready to create your event campaign?
            </h3>
            <p className={themeClasses.mutedText}>
              Fill out the form above and click Generate Campaign to create your
              multi-channel promotional campaign.
            </p>
          </div>
        </OBDPanel>
      )}

      {/* Sticky Bottom Action Bar */}
      {result && !loading && (
        <div
          className={`sticky bottom-0 left-0 right-0 z-10 mt-12 border-t ${
            isDark
              ? "bg-slate-950 border-slate-800"
              : "bg-white border-slate-200"
          } shadow-lg`}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className={`px-6 py-2.5 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Regenerate
              </button>
              <button
                onClick={handleStartNew}
                className={`px-6 py-2.5 font-medium rounded-xl transition-colors ${
                  isDark
                    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                }`}
              >
                Start New Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}
