/**
 * Global Demo Mode Toast Notification System
 * 
 * Provides a centralized way to show toast notifications for Demo Mode read-only errors.
 * Uses CustomEvent for cross-component communication without React context overhead.
 */

const DEMO_TOAST_EVENT = "obd-demo-toast";

export interface DemoToastEventDetail {
  message: string;
}

/**
 * Dispatch a demo mode toast notification
 * This will be picked up by the global toast component in the layout
 */
export function showDemoToast(message: string = "Demo Mode is view-only. Upgrade to generate, save, or publish."): void {
  if (typeof window === "undefined") {
    return; // SSR-safe
  }

  const event = new CustomEvent<DemoToastEventDetail>(DEMO_TOAST_EVENT, {
    detail: { message },
    bubbles: true,
  });

  window.dispatchEvent(event);
}

/**
 * Subscribe to demo toast events
 * Used by the global toast component
 */
export function onDemoToast(callback: (message: string) => void): () => void {
  if (typeof window === "undefined") {
    return () => {}; // SSR-safe
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<DemoToastEventDetail>;
    if (customEvent.detail?.message) {
      callback(customEvent.detail.message);
    }
  };

  window.addEventListener(DEMO_TOAST_EVENT, handler);

  // Return cleanup function
  return () => {
    window.removeEventListener(DEMO_TOAST_EVENT, handler);
  };
}

