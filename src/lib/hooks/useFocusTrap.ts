/**
 * Focus trap hook for modals and dialogs
 * 
 * Ensures:
 * - Focus is trapped within the modal container
 * - Tab cycles through focusable elements
 * - Shift+Tab cycles backwards
 * - ESC closes the modal
 * - Focus returns to trigger element on close
 */

import { useEffect, useRef, RefObject } from "react";

interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
  enabled?: boolean;
}

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
  );
}

/**
 * Focus trap hook
 */
export function useFocusTrap({
  isOpen,
  onClose,
  triggerElement,
  enabled = true,
}: UseFocusTrapOptions): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !enabled) return;

    const container = containerRef.current;
    if (!container) return;

    // Store the element that had focus before modal opened
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements
    const focusableElements = getFocusableElements(container);
    
    if (focusableElements.length === 0) return;

    // Focus the first element
    const firstElement = focusableElements[0];
    firstElement.focus();

    // Handle Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const currentIndex = focusableElements.indexOf(
        document.activeElement as HTMLElement
      );

      if (currentIndex === -1) {
        // If focus is outside modal, focus first element
        e.preventDefault();
        firstElement.focus();
        return;
      }

      if (e.shiftKey) {
        // Shift+Tab: move backwards
        if (currentIndex === 0) {
          e.preventDefault();
          focusableElements[focusableElements.length - 1].focus();
        }
      } else {
        // Tab: move forwards
        if (currentIndex === focusableElements.length - 1) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Note: Backdrop click handling is managed by the modal component's onClick handler
    // We don't need to handle it here to avoid conflicts

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Return focus to trigger element or previous active element
      const elementToFocus = triggerElement || previousActiveElementRef.current;
      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        // Use setTimeout to ensure modal is fully closed before focusing
        setTimeout(() => {
          elementToFocus.focus();
        }, 0);
      }
    };
  }, [isOpen, onClose, triggerElement, enabled]);

  return containerRef;
}

