"use client";

/**
 * Global Demo Mode Toast Component
 * 
 * Listens for demo toast events and displays non-blocking toast notifications.
 * Should be rendered once in the root layout.
 */

import { useEffect, useState, useRef } from "react";
import { onDemoToast } from "@/lib/utils/demo-toast";

export function GlobalDemoToast() {
  const [toast, setToast] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Subscribe to demo toast events
    const unsubscribe = onDemoToast((message) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast(message);
      setIsVisible(true);

      // Auto-hide after 4 seconds
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        // Clear toast after fade-out animation
        setTimeout(() => setToast(null), 300);
      }, 4000);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-slate-900 text-white px-6 py-3 rounded-lg shadow-lg border border-slate-700 max-w-md text-sm font-medium">
        {toast}
      </div>
    </div>
  );
}

