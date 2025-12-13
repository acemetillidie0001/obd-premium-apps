"use client";

import { getPanelClasses } from "@/lib/obd-framework/theme";

interface OBDPanelProps {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}

export default function OBDPanel({ children, isDark, className = "" }: OBDPanelProps) {
  return (
    <div className={`${getPanelClasses(isDark)} ${className}`}>
      {children}
    </div>
  );
}

