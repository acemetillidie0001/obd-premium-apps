/**
 * Theme Preference Utilities
 * 
 * Manages light/dark theme preference persistence via localStorage.
 * Safe for server-side rendering (returns null/fallbacks when window is undefined).
 */

export type OBDTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "obd_theme";

/**
 * Get saved theme from localStorage (safe on server)
 */
export function getSavedTheme(): OBDTheme | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch (error) {
    // localStorage may be disabled or unavailable
    console.warn("[Theme] Failed to read from localStorage:", error);
  }

  return null;
}

/**
 * Save theme to localStorage (safe on server)
 */
export function saveTheme(theme: OBDTheme): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // localStorage may be disabled or unavailable
    console.warn("[Theme] Failed to save to localStorage:", error);
  }
}

/**
 * Get initial theme preference
 * 
 * Priority:
 * 1. Saved theme from localStorage
 * 2. System preference (prefers-color-scheme)
 * 3. Default to "light"
 */
export function getInitialTheme(): OBDTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  // Check saved preference first
  const saved = getSavedTheme();
  if (saved) {
    return saved;
  }

  // Fallback to system preference
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch (error) {
    // matchMedia may not be available
    console.warn("[Theme] Failed to read system preference:", error);
  }

  // Default to light
  return "light";
}

