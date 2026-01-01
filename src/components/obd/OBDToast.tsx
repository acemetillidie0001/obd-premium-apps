"use client";

interface OBDToastProps {
  message: string;
  type: "success" | "error";
  isDark?: boolean;
}

export default function OBDToast({ message, type, isDark = false }: OBDToastProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg max-w-md transition-opacity ${
        type === "success"
          ? isDark ? "bg-green-600 text-white" : "bg-green-500 text-white"
          : isDark ? "bg-red-600 text-white" : "bg-red-500 text-white"
      }`}
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

