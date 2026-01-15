"use client";

import { useEffect } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface LogoPreviewModalProps {
  isOpen: boolean;
  imageUrl: string;
  alt: string;
  title: string;
  onClose: () => void;
  isDark: boolean;
  triggerElement?: HTMLElement | null;
}

export default function LogoPreviewModal({
  isOpen,
  imageUrl,
  alt,
  title,
  onClose,
  isDark,
  triggerElement,
}: LogoPreviewModalProps) {
  const modalRef = useFocusTrap({
    isOpen,
    onClose,
    triggerElement,
  });

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow || "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-xl ${
          isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-preview-title"
      >
        <div
          className={`sticky top-0 flex items-center justify-between gap-3 p-4 border-b ${
            isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
          }`}
        >
          <div className="min-w-0">
            <h3
              id="logo-preview-title"
              className={`text-sm sm:text-base font-semibold truncate ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              title={title}
            >
              {title}
            </h3>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Preview zoom
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"
            }`}
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div
            className={`rounded-xl border overflow-hidden ${
              isDark ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-white"
            }`}
          >
            <img src={imageUrl} alt={alt} className="w-full h-auto block" />
          </div>
        </div>
      </div>
    </div>
  );
}


