"use client";

import { getPanelClasses } from "@/lib/obd-framework/theme";

export type OBDPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  isDark: boolean;
  variant?: "default" | "toolbar";
};

export default function OBDPanel({ children, isDark, className, variant = "default", ...props }: OBDPanelProps) {
  const baseClasses = getPanelClasses(isDark);
  // Toolbar variant uses tighter padding for toolbar/control panels
  const variantClasses = variant === "toolbar" 
    ? (isDark ? "px-4 py-3 md:px-5 md:py-4" : "px-4 py-3 md:px-5 md:py-4")
    : "";
  const baseWithVariant = variant === "toolbar" 
    ? baseClasses.replace(/px-6 py-6 md:px-8 md:py-7/, variantClasses)
    : baseClasses;
  const mergedClassName = className ? `${baseWithVariant} ${className}` : baseWithVariant;
  
  return (
    <div {...props} className={mergedClassName}>
      {children}
    </div>
  );
}

