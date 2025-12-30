"use client";

import { useState, useEffect, useCallback } from "react";
import { getInitialTheme, saveTheme, type OBDTheme } from "./theme-preference";

/**
 * OBD Theme Hook
 * 
 * Manages theme state with localStorage persistence and cross-tab synchronization.
 * 
 * @returns { theme, isDark, setTheme, toggleTheme }
 */
export function useOBDTheme() {
  // Always start with "light" to match server render and avoid hydration mismatch
  // We'll sync with localStorage/client preference in useEffect after mount
  const [theme, setThemeState] = useState<OBDTheme>("light");
  const [mounted, setMounted] = useState(false);
  const isDark = theme === "dark";

  // Sync with localStorage/system preference after mount (client-side only)
  useEffect(() => {
    setMounted(true);
    const initialTheme = getInitialTheme();
    setThemeState(initialTheme);
  }, []);

  // Save to localStorage whenever theme changes (but only after mount to avoid SSR issues)
  useEffect(() => {
    if (mounted) {
      saveTheme(theme);
    }
  }, [theme, mounted]);

  // Listen for storage events (cross-tab synchronization)
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "obd_theme" && e.newValue) {
        if (e.newValue === "light" || e.newValue === "dark") {
          setThemeState(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Set theme explicitly
  const setTheme = useCallback((newTheme: OBDTheme) => {
    setThemeState(newTheme);
  }, []);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
}

