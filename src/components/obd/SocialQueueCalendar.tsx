"use client";

import { useState } from "react";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import type { SocialQueueItem, SocialPlatform } from "@/lib/apps/social-auto-poster/types";

interface SocialQueueCalendarProps {
  items: SocialQueueItem[];
  isDark: boolean;
  onItemClick: (item: SocialQueueItem) => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  facebook: "📘",
  instagram: "📷",
  x: "🐦",
  googleBusiness: "📍",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SocialQueueCalendar({
  items,
  isDark,
  onItemClick,
}: SocialQueueCalendarProps) {
  const theme = getThemeClasses(isDark);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Group items by date
  const itemsByDate = new Map<string, SocialQueueItem[]>();
  items.forEach((item) => {
    if (item.scheduledAt) {
      const date = new Date(item.scheduledAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!itemsByDate.has(dateKey)) {
        itemsByDate.set(dateKey, []);
      }
      itemsByDate.get(dateKey)!.push(item);
    }
  });

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className={`px-3 py-1 rounded ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
        >
          ←
        </button>
        <h3 className={`text-lg font-semibold ${theme.headingText}`}>
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={goToNextMonth}
          className={`px-3 py-1 rounded ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
        >
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {DAYS.map((day) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-2 ${theme.mutedText}`}
          >
            {day}
          </div>
        ))}

        {/* Empty cells for days before month starts */}
        {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} className="aspect-square" />
        ))}

        {/* Calendar days */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayItems = itemsByDate.get(dateKey) || [];
          const isToday =
            year === new Date().getFullYear() &&
            month === new Date().getMonth() &&
            day === new Date().getDate();

          return (
            <div
              key={day}
              className={`aspect-square border rounded-lg p-1 ${
                isToday
                  ? isDark
                    ? "border-[#29c4a9] bg-[#29c4a9]/10"
                    : "border-[#29c4a9] bg-[#29c4a9]/5"
                  : isDark
                  ? "border-slate-700"
                  : "border-slate-200"
              }`}
            >
              <div className={`text-xs font-medium mb-1 ${theme.headingText}`}>{day}</div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item, itemIdx) => (
                  <button
                    key={itemIdx}
                    onClick={() => onItemClick(item)}
                    className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate ${
                      isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-100 hover:bg-slate-200"
                    }`}
                    title={`${PLATFORM_ICONS[item.platform]} ${item.content.substring(0, 50)}...`}
                  >
                    <span className="mr-1">{PLATFORM_ICONS[item.platform]}</span>
                    <span className={theme.inputText}>
                      {item.content.substring(0, 15)}...
                    </span>
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <div className={`text-[10px] ${theme.mutedText} px-1`}>
                    +{dayItems.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

