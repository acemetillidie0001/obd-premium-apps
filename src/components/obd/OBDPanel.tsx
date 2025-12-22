"use client";

import { getPanelClasses } from "@/lib/obd-framework/theme";

interface OBDPanelProps {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
  id?: string;
}

export default function OBDPanel({ children, isDark, className = "", id }: OBDPanelProps) {
  return (
    <div id={id} className={`${getPanelClasses(isDark)} ${className}`}>
      {children}
    </div>
  );
}

