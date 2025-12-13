"use client";

import { getThemeClasses } from "@/lib/obd-framework/theme";

interface OBDHeadingProps {
  level: 1 | 2;
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}

export default function OBDHeading({ level, children, isDark, className = "" }: OBDHeadingProps) {
  const theme = getThemeClasses(isDark);

  if (level === 1) {
    return (
      <h1 className={`text-2xl md:text-3xl font-bold obd-heading ${theme.headingText} ${className}`}>
        {children}
      </h1>
    );
  }

  return (
    <h2 className={`text-lg font-semibold obd-heading ${theme.headingText} ${className}`}>
      {children}
    </h2>
  );
}

