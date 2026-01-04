"use client";

import { useState, useEffect } from "react";

interface WorkflowGuidanceProps {
  isDark: boolean;
  currentStep: 1 | 2 | 3;
  storageKey?: string; // Optional custom storage key for different apps
}

export default function WorkflowGuidance({
  isDark,
  currentStep,
  storageKey = "bdw-workflow-guidance-dismissed",
}: WorkflowGuidanceProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const dismissed = localStorage.getItem(storageKey);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch (error) {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, "true");
      } catch (error) {
        // Ignore localStorage errors
      }
    }
  };

  if (isDismissed) {
    return null;
  }

  const steps = [
    { number: 1, label: "Business details", active: currentStep === 1, completed: currentStep > 1 },
    { number: 2, label: "Generate", active: currentStep === 2, completed: currentStep > 2 },
    { number: 3, label: "Fix & Export", active: currentStep === 3, completed: false },
  ];

  return (
    <div className={`rounded-lg border p-3 mb-4 ${
      isDark
        ? "bg-blue-900/20 border-blue-700"
        : "bg-blue-50 border-blue-200"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-semibold ${
              isDark ? "text-blue-200" : "text-blue-800"
            }`}>
              Workflow:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {steps.map((step, idx) => (
                <div key={step.number} className="flex items-center gap-1.5">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    step.active
                      ? isDark
                        ? "bg-blue-600 text-white"
                        : "bg-blue-600 text-white"
                      : step.completed
                      ? isDark
                        ? "bg-green-700 text-green-200"
                        : "bg-green-100 text-green-800"
                      : isDark
                      ? "bg-slate-700 text-slate-400"
                      : "bg-slate-200 text-slate-500"
                  }`}>
                    {step.completed ? "✓" : step.number}
                  </div>
                  <span className={`text-xs ${
                    step.active
                      ? isDark ? "text-blue-200 font-medium" : "text-blue-800 font-medium"
                      : step.completed
                      ? isDark ? "text-green-300" : "text-green-700"
                      : isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {step.label}
                  </span>
                  {idx < steps.length - 1 && (
                    <span className={`text-xs mx-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className={`text-xs ${
            isDark ? "text-blue-300" : "text-blue-700"
          }`}>
            {currentStep === 1 && "Fill in your business details to get started."}
            {currentStep === 2 && "Click the generate button to create your content."}
            {currentStep === 3 && "Review, fix, and export your generated content using the tools below."}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors flex-shrink-0 ${
            isDark
              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
          aria-label="Dismiss workflow guidance"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
