"use client";

import Link from "next/link";

interface UpgradePromptProps {
  className?: string;
}

export default function UpgradePrompt({ className = "" }: UpgradePromptProps) {
  return (
    <div className={`bg-gradient-to-r from-[#1EB9A7] to-[#0AC8E9] rounded-xl p-6 text-white ${className}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Upgrade Required</h3>
          <p className="text-sm text-white/90 mb-4">
            This feature is available with a premium subscription. Upgrade to unlock all premium tools and features.
          </p>
          <Link
            href="https://ocalabusinessdirectory.com/for-business-owners/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-[#1EB9A7] font-semibold px-6 py-2 rounded-full hover:opacity-90 transition shadow-md"
          >
            Upgrade to Premium
          </Link>
        </div>
      </div>
    </div>
  );
}

