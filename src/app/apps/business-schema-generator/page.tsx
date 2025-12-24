"use client";

import { useState, useEffect } from "react";
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
  SchemaGeneratorRequest,
  SchemaGeneratorResponse,
} from "./types";

const USE_BRAND_PROFILE_KEY = "obd.v3.useBrandProfile";

const BUSINESS_TYPES = [
  "LocalBusiness",
  "Restaurant",
  "Store",
  "ProfessionalService",
  "LegalService",
  "MedicalBusiness",
  "AutoRepair",
  "HomeAndGardenBusiness",
  "BeautySalon",
  "Gym",
  "RealEstateAgent",
  "AccountingService",
  "Dentist",
  "VeterinaryCare",
  "Plumber",
  "Electrician",
  "GeneralContractor",
  "AutoDealer",
  "LodgingBusiness",
  "FoodEstablishment",
];

const defaultFormValues: SchemaGeneratorRequest = {
  businessName: "",
  businessType: "LocalBusiness",
  services: [],
  city: "Ocala",
  state: "Florida",
  streetAddress: "",
  postalCode: "",
  phone: "",
  websiteUrl: "",
  googleMapsUrl: "",
  socialLinks: {
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    linkedinUrl: "",
  },
  hours: {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  },
  includeFaqSchema: false,
  includeWebPageSchema: false,
  faqs: [],
  faqTemplateMode: "none",
  pageUrl: "",
  pageTitle: "",
  pageDescription: "",
  pageType: "Homepage",
};

export default function BusinessSchemaGeneratorPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [form, setForm] = useState<SchemaGeneratorRequest>(defaultFormValues);
  const [servicesInput, setServicesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SchemaGeneratorResponse | null>(null);
  const [useBrandProfile, setUseBrandProfile] = useState(true);
  const [brandProfileLoaded, setBrandProfileLoaded] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [faqWarning, setFaqWarning] = useState<string | null>(null);

  // Load "use brand profile" preference from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(USE_BRAND_PROFILE_KEY);
      if (stored !== null) {
        setUseBrandProfile(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load useBrandProfile preference:", err);
    }
  }, []);

  // Save "use brand profile" preference to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(USE_BRAND_PROFILE_KEY, JSON.stringify(useBrandProfile));
    } catch (err) {
      console.error("Failed to save useBrandProfile preference:", err);
    }
  }, [useBrandProfile]);

  // Load brand profile on mount
  useEffect(() => {
    if (brandProfileLoaded || !useBrandProfile) {
      setBrandProfileLoaded(true);
      return;
    }

    let mounted = true;
    const loadBrandProfile = async () => {
      try {
        const res = await fetch("/api/brand-profile");
        if (res.ok && mounted) {
          const profile = await res.json();
          if (profile && mounted) {
            const newAutoFilled = new Set<string>();
            setForm((currentForm) => {
              const newForm = { ...currentForm };
              // Only prefill if field is empty
              if (!newForm.businessName && profile.businessName) {
                newForm.businessName = profile.businessName;
                newAutoFilled.add("businessName");
              }
              if (!newForm.businessType && profile.businessType) {
                newForm.businessType = profile.businessType;
                newAutoFilled.add("businessType");
              }
              if (!newForm.city && profile.city) {
                newForm.city = profile.city;
                newAutoFilled.add("city");
              }
              if (!newForm.state && profile.state) {
                newForm.state = profile.state;
                newAutoFilled.add("state");
              }
              // Services - convert to comma-separated string if array
              if ((newForm.services?.length ?? 0) === 0 && profile.services) {
                const servicesArray = Array.isArray(profile.services)
                  ? profile.services
                  : typeof profile.services === "string"
                  ? profile.services.split(",").map((s: string) => s.trim()).filter(Boolean)
                  : [];
                if (servicesArray.length > 0) {
                  newForm.services = servicesArray;
                  setServicesInput(servicesArray.join(", "));
                  newAutoFilled.add("services");
                }
              }
              return newForm;
            });
            if (newAutoFilled.size > 0) {
              setAutoFilledFields(newAutoFilled);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load brand profile:", err);
      } finally {
        if (mounted) {
          setBrandProfileLoaded(true);
        }
      }
    };
    loadBrandProfile();
    return () => {
      mounted = false;
    };
  }, [useBrandProfile, brandProfileLoaded]);

  // Clear hint chips when user edits auto-filled fields
  const handleFieldChange = <K extends keyof SchemaGeneratorRequest>(
    key: K,
    value: SchemaGeneratorRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (autoFilledFields.has(key)) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleServicesChange = (value: string) => {
    setServicesInput(value);
    const servicesArray = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setForm((prev) => ({ ...prev, services: servicesArray }));
    if (autoFilledFields.has("services")) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev);
        next.delete("services");
        return next;
      });
    }
  };

  const handleGenerate5FAQs = () => {
    const services = servicesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const location = form.city && form.state
      ? `${form.city}, ${form.state}`
      : form.city || form.state || "";

    const generatedFAQs: { question: string; answer: string }[] = [
      {
        question: `What services does ${form.businessName || "your business"} offer?`,
        answer: services.length > 0
          ? `${form.businessName || "We"} offer ${services.join(", ")}. Contact us for more details about our services and to schedule an appointment.`
          : `Contact ${form.businessName || "us"} to learn more about our services and how we can help you.`,
      },
      {
        question: location
          ? `What areas do you serve?`
          : `Where are you located?`,
        answer: location
          ? `We serve ${location} and surrounding areas. Contact us to confirm if we service your specific location.`
          : `Contact us for information about our service area and location details.`,
      },
      {
        question: `What are your business hours?`,
        answer: `Please contact us for our current business hours and availability. We're happy to work with your schedule.`,
      },
      {
        question: `How do I request a quote or schedule an appointment?`,
        answer: `You can reach out to us through our website, phone, or by visiting our location. Contact us today to discuss your needs and schedule a consultation.`,
      },
      {
        question: `Are you licensed and insured?`,
        answer: `Contact us directly for information about our licensing, insurance, and certifications. We're happy to provide details about our qualifications.`,
      },
    ];

    setForm((prev) => ({
      ...prev,
      faqs: generatedFAQs,
      faqTemplateMode: "basic",
    }));
    setFaqWarning(null);
  };

  const handleAddFAQ = () => {
    setForm((prev) => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: "", answer: "" }],
    }));
  };

  const handleRemoveFAQ = (index: number) => {
    setForm((prev) => ({
      ...prev,
      faqs: prev.faqs?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleFAQChange = (index: number, field: "question" | "answer", value: string) => {
    setForm((prev) => {
      const updatedFAQs = [...(prev.faqs || [])];
      updatedFAQs[index] = { ...updatedFAQs[index], [field]: value };
      return { ...prev, faqs: updatedFAQs };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setFaqWarning(null);

    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!form.businessType.trim()) {
      setError("Business type is required.");
      return;
    }

    if (form.includeWebPageSchema && !form.pageUrl?.trim()) {
      setError("Page URL is required when including WebPage schema.");
      return;
    }

    if (form.includeFaqSchema && (!form.faqs || form.faqs.length === 0)) {
      setFaqWarning("No FAQs added yet. FAQ schema will be omitted.");
      // Allow submit but FAQ schema will be omitted
    }

    setLoading(true);

    try {
      const payload: SchemaGeneratorRequest = {
        ...form,
        services: servicesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        // Only include FAQs if FAQ schema is enabled and FAQs exist
        faqs: form.includeFaqSchema && form.faqs && form.faqs.length > 0
          ? form.faqs.filter((faq) => faq.question.trim() && faq.answer.trim())
          : undefined,
      };

      const res = await fetch("/api/schema-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.requestId) {
            console.error("Request ID:", errorData.requestId);
          }
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const response = await res.json() as SchemaGeneratorResponse;

      if (response.ok && response.data) {
        setResult(response);
        setTimeout(() => {
          const resultsElement = document.getElementById("schema-results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (response.ok === false && response.error) {
        if (response.requestId) {
          console.error("Request ID:", response.requestId);
        }
        throw new Error(response.error);
      } else {
        setResult(response);
      }
    } catch (error) {
      console.error("Schema Generator Submit Error:", error);
      let errorMessage = "Something went wrong while generating your schema. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!result?.data?.combinedJsonLd) return;
    try {
      const jsonObj = JSON.parse(result.data.combinedJsonLd);
      const json = JSON.stringify(jsonObj, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `business-schema-bundle.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export JSON:", err);
    }
  };

  const handleExportTxt = () => {
    if (!result?.data?.combinedJsonLd) return;
    const text = result.data.combinedJsonLd;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `business-schema-bundle.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Business Schema Generator"
      tagline="Generate copy-paste JSON-LD for your website and listings."
    >
      {/* Form */}
      <OBDPanel isDark={isDark} className="mt-7">
        <OBDHeading level={2} isDark={isDark} className="mb-6">
          Business Information
        </OBDHeading>

        {/* Use saved brand profile toggle */}
        <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
            <input
              type="checkbox"
              checked={useBrandProfile}
              onChange={(e) => setUseBrandProfile(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Use saved Brand Profile
            </span>
          </label>
          <p className={`text-xs mt-1 ml-6 ${themeClasses.mutedText}`}>
            When enabled, your saved brand profile will auto-fill business name, type, services, and location if fields are empty.
          </p>
        </div>

        {/* Schema Type Toggles */}
        <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
          <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
            <input
              type="checkbox"
              checked={form.includeFaqSchema || false}
              onChange={(e) => handleFieldChange("includeFaqSchema", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Include FAQ Schema
            </span>
          </label>
          <label className={`flex items-center gap-2 ${themeClasses.labelText} cursor-pointer`}>
            <input
              type="checkbox"
              checked={form.includeWebPageSchema || false}
              onChange={(e) => handleFieldChange("includeWebPageSchema", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Include WebPage Schema
            </span>
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Required Fields */}
            <div>
              <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                Required Information
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Name <span className="text-red-500">*</span>
                    {autoFilledFields.has("businessName") && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        From Brand Profile
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) => handleFieldChange("businessName", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Example: Ocala Massage & Wellness"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="businessType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Type <span className="text-red-500">*</span>
                    {autoFilledFields.has("businessType") && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        From Brand Profile
                      </span>
                    )}
                  </label>
                  <select
                    id="businessType"
                    value={form.businessType}
                    onChange={(e) => handleFieldChange("businessType", e.target.value)}
                    className={getInputClasses(isDark)}
                    required
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="services"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Services (comma-separated)
                    {autoFilledFields.has("services") && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        From Brand Profile
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="services"
                    value={servicesInput}
                    onChange={(e) => handleServicesChange(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="Massage therapy, deep tissue, Swedish massage"
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Separate multiple services with commas
                  </p>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Address */}
            <div>
              <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                Address
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="streetAddress"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Street Address
                  </label>
                  <input
                    type="text"
                    id="streetAddress"
                    value={form.streetAddress}
                    onChange={(e) => handleFieldChange("streetAddress", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="city"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      City
                      {autoFilledFields.has("city") && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          isDark
                            ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                            : "bg-teal-50 text-teal-700 border border-teal-200"
                        }`}>
                          From Brand Profile
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={form.city}
                      onChange={(e) => handleFieldChange("city", e.target.value)}
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
                      {autoFilledFields.has("state") && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          isDark
                            ? "bg-teal-900/50 text-teal-200 border border-teal-700/50"
                            : "bg-teal-50 text-teal-700 border border-teal-200"
                        }`}>
                          From Brand Profile
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={form.state}
                      onChange={(e) => handleFieldChange("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="postalCode"
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      Postal Code
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      value={form.postalCode}
                      onChange={(e) => handleFieldChange("postalCode", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="34475"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Contact & Links */}
            <div>
              <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                Contact & Links
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="phone"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={form.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="(352) 555-1234"
                  />
                </div>

                <div>
                  <label
                    htmlFor="websiteUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="websiteUrl"
                    value={form.websiteUrl}
                    onChange={(e) => handleFieldChange("websiteUrl", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="googleMapsUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Google Maps URL (Optional)
                  </label>
                  <input
                    type="url"
                    id="googleMapsUrl"
                    value={form.googleMapsUrl}
                    onChange={(e) => handleFieldChange("googleMapsUrl", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Social Links */}
            <div>
              <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                Social Media Links
              </OBDHeading>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="facebookUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    id="facebookUrl"
                    value={form.socialLinks?.facebookUrl || ""}
                    onChange={(e) =>
                      handleFieldChange("socialLinks", {
                        ...form.socialLinks,
                        facebookUrl: e.target.value,
                      })
                    }
                    className={getInputClasses(isDark)}
                    placeholder="https://facebook.com/yourpage"
                  />
                </div>

                <div>
                  <label
                    htmlFor="instagramUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Instagram URL
                  </label>
                  <input
                    type="url"
                    id="instagramUrl"
                    value={form.socialLinks?.instagramUrl || ""}
                    onChange={(e) =>
                      handleFieldChange("socialLinks", {
                        ...form.socialLinks,
                        instagramUrl: e.target.value,
                      })
                    }
                    className={getInputClasses(isDark)}
                    placeholder="https://instagram.com/yourpage"
                  />
                </div>

                <div>
                  <label
                    htmlFor="xUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    X (Twitter) URL
                  </label>
                  <input
                    type="url"
                    id="xUrl"
                    value={form.socialLinks?.xUrl || ""}
                    onChange={(e) =>
                      handleFieldChange("socialLinks", {
                        ...form.socialLinks,
                        xUrl: e.target.value,
                      })
                    }
                    className={getInputClasses(isDark)}
                    placeholder="https://x.com/yourpage"
                  />
                </div>

                <div>
                  <label
                    htmlFor="linkedinUrl"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    id="linkedinUrl"
                    value={form.socialLinks?.linkedinUrl || ""}
                    onChange={(e) =>
                      handleFieldChange("socialLinks", {
                        ...form.socialLinks,
                        linkedinUrl: e.target.value,
                      })
                    }
                    className={getInputClasses(isDark)}
                    placeholder="https://linkedin.com/company/yourpage"
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Hours */}
            <div>
              <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                Business Hours
              </OBDHeading>
              <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
                Format: 9:00 AM - 5:00 PM (leave blank if closed)
              </p>
              <div className="space-y-3">
                {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((day) => (
                  <div key={day}>
                    <label
                      htmlFor={`hours-${day}`}
                      className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </label>
                    <input
                      type="text"
                      id={`hours-${day}`}
                      value={form.hours?.[day] || ""}
                      onChange={(e) =>
                        handleFieldChange("hours", {
                          ...form.hours,
                          [day]: e.target.value,
                        })
                      }
                      className={getInputClasses(isDark)}
                      placeholder="9:00 AM - 5:00 PM"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ Section */}
            {form.includeFaqSchema && (
              <>
                <div className={getDividerClass(isDark)}></div>
                <div>
                  <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                    FAQ Schema
                  </OBDHeading>
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={handleGenerate5FAQs}
                      className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? "bg-teal-900/50 text-teal-200 hover:bg-teal-900/70 border border-teal-700/50"
                          : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                      }`}
                    >
                      Generate 5 FAQs
                    </button>
                    <p className={`text-xs mt-2 ${themeClasses.mutedText}`}>
                      Generate template-based FAQs based on your business information.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {(form.faqs || []).map((faq, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${themeClasses.labelText}`}>
                            FAQ {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFAQ(index)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              isDark
                                ? "bg-red-900/50 text-red-200 hover:bg-red-900/70"
                                : "bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label
                              htmlFor={`faq-question-${index}`}
                              className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                            >
                              Question
                            </label>
                            <input
                              type="text"
                              id={`faq-question-${index}`}
                              value={faq.question}
                              onChange={(e) => handleFAQChange(index, "question", e.target.value)}
                              className={getInputClasses(isDark)}
                              placeholder="What services do you offer?"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`faq-answer-${index}`}
                              className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                            >
                              Answer
                            </label>
                            <textarea
                              id={`faq-answer-${index}`}
                              value={faq.answer}
                              onChange={(e) => handleFAQChange(index, "answer", e.target.value)}
                              rows={3}
                              className={getInputClasses(isDark, "resize-none")}
                              placeholder="We offer a variety of services..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddFAQ}
                      className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Add FAQ
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* WebPage Section */}
            {form.includeWebPageSchema && (
              <>
                <div className={getDividerClass(isDark)}></div>
                <div>
                  <OBDHeading level={3} isDark={isDark} className="mb-4 text-base">
                    WebPage Schema
                  </OBDHeading>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="pageUrl"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Page URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        id="pageUrl"
                        value={form.pageUrl || ""}
                        onChange={(e) => handleFieldChange("pageUrl", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder="https://example.com/page"
                        required={form.includeWebPageSchema}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pageType"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Page Type
                      </label>
                      <select
                        id="pageType"
                        value={form.pageType || "Homepage"}
                        onChange={(e) => handleFieldChange("pageType", e.target.value as SchemaGeneratorRequest["pageType"])}
                        className={getInputClasses(isDark)}
                      >
                        <option value="Homepage">Homepage</option>
                        <option value="ServicePage">Service Page</option>
                        <option value="LocationPage">Location Page</option>
                        <option value="About">About</option>
                        <option value="Contact">Contact</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="pageTitle"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Page Title
                      </label>
                      <input
                        type="text"
                        id="pageTitle"
                        value={form.pageTitle || ""}
                        onChange={(e) => handleFieldChange("pageTitle", e.target.value)}
                        className={getInputClasses(isDark)}
                        placeholder={`${form.businessName || "Business"} - ${form.pageType || "Homepage"}`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pageDescription"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Page Description
                      </label>
                      <textarea
                        id="pageDescription"
                        value={form.pageDescription || ""}
                        onChange={(e) => handleFieldChange("pageDescription", e.target.value)}
                        rows={3}
                        className={getInputClasses(isDark, "resize-none")}
                        placeholder="Brief description of this page..."
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className={getErrorPanelClasses(isDark)}>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* FAQ Warning */}
            {faqWarning && (
              <div className={`p-3 rounded-lg border ${
                isDark
                  ? "bg-yellow-900/20 border-yellow-700/50 text-yellow-200"
                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
              }`}>
                <p className="text-sm">{faqWarning}</p>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {loading ? "Generating..." : "Generate Schema"}
              </button>
            </div>
          </div>
        </form>
      </OBDPanel>

      {/* Results */}
      {result?.data && (
        <div id="schema-results" className="mt-8">
          <OBDHeading level={2} isDark={isDark} className="mb-6">
            Generated Schema
          </OBDHeading>

          <div className="space-y-6">
            {/* LocalBusiness JSON-LD */}
            <ResultCard
              title="LocalBusiness JSON-LD"
              isDark={isDark}
              copyText={result.data.localBusinessJsonLd}
            >
              <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
              }`}>
                <code>{result.data.localBusinessJsonLd}</code>
              </pre>
            </ResultCard>

            {/* FAQPage JSON-LD */}
            {result.data.faqJsonLd && (
              <ResultCard
                title="FAQPage JSON-LD"
                isDark={isDark}
                copyText={result.data.faqJsonLd}
              >
                <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                  isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}>
                  <code>{result.data.faqJsonLd}</code>
                </pre>
              </ResultCard>
            )}

            {/* WebPage JSON-LD */}
            {result.data.webPageJsonLd && (
              <ResultCard
                title="WebPage JSON-LD"
                isDark={isDark}
                copyText={result.data.webPageJsonLd}
              >
                <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                  isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}>
                  <code>{result.data.webPageJsonLd}</code>
                </pre>
              </ResultCard>
            )}

            {/* Combined JSON-LD Bundle */}
            <ResultCard
              title="Full Schema Bundle (Recommended)"
              isDark={isDark}
              copyText={result.data.combinedJsonLd}
            >
              <p className={`text-sm mb-3 ${themeClasses.mutedText}`}>
                Paste this into your website or SEO plugin. This includes everything above.
              </p>
              <pre className={`text-xs overflow-x-auto p-4 rounded-lg ${
                isDark ? "bg-slate-900 text-slate-100" : "bg-slate-100 text-slate-900"
              }`}>
                <code>{result.data.combinedJsonLd}</code>
              </pre>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleExportJson}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Export .json
                </button>
                <button
                  onClick={handleExportTxt}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Export .txt
                </button>
              </div>
            </ResultCard>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}

