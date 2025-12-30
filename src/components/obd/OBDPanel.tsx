"use client";

import { getPanelClasses } from "@/lib/obd-framework/theme";

export type OBDPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  isDark: boolean;
};

export default function OBDPanel({ children, isDark, className, ...props }: OBDPanelProps) {
  const baseClasses = getPanelClasses(isDark);
  const mergedClassName = className ? `${baseClasses} ${className}` : baseClasses;
  
  return (
    <div {...props} className={mergedClassName}>
      {children}
    </div>
  );
}

