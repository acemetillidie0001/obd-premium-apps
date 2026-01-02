"use client";

import type { OBDToastType } from "./toastTypes";

// P1-23: Standardized toast props structure
interface OBDToastProps {
  message: string;
  type: OBDToastType;
  isDark?: boolean;
}

export default function OBDToast({ message, type, isDark = false }: OBDToastProps) {
  // P1-23: Support all toast types (success, error, info, warning)
  const getTypeClasses = () => {
    switch (type) {
      case "success":
        return isDark ? "bg-green-600 text-white" : "bg-green-500 text-white";
      case "error":
        return isDark ? "bg-red-600 text-white" : "bg-red-500 text-white";
      case "info":
        return isDark ? "bg-blue-600 text-white" : "bg-blue-500 text-white";
      case "warning":
        return isDark ? "bg-amber-600 text-white" : "bg-amber-500 text-white";
      default:
        return isDark ? "bg-slate-600 text-white" : "bg-slate-500 text-white";
    }
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg max-w-md transition-opacity ${getTypeClasses()}`}
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

