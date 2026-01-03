"use client";

interface SerpPreviewProps {
  title: string;
  url: string;
  description: string;
  isDark: boolean;
}

/**
 * SERP Preview Component
 * 
 * Displays a Google-style search results preview showing how the meta description
 * will appear in search engine results pages.
 * 
 * @param title - The page title (typically business name + location)
 * @param url - The page URL (placeholder or actual URL)
 * @param description - The meta description text
 * @param isDark - Whether dark mode is enabled
 */
export default function SerpPreview({
  title,
  url,
  description,
  isDark,
}: SerpPreviewProps) {
  const charCount = description.length;
  const isOverLimit = charCount > 160;

  // Generate a simple slug from the title for the URL
  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);
  };

  const slug = generateSlug(title);
  const displayUrl = url || `ocalabusinessdirectory.com/listing/${slug}`;

  return (
    <div className={`rounded-lg border p-4 ${
      isDark
        ? "bg-slate-900/30 border-slate-700"
        : "bg-white border-slate-200"
    }`}>
      <div className="mb-3">
        <h4 className={`text-xs font-medium mb-2 ${
          isDark ? "text-slate-300" : "text-slate-600"
        }`}>
          Google Search Preview
        </h4>
        
        {/* Google-style SERP Card */}
        <div className={`rounded border ${
          isDark
            ? "bg-white border-slate-300"
            : "bg-white border-slate-200"
        }`}>
          <div className="p-3">
            {/* URL */}
            <div className="flex items-center mb-1">
              <p className="text-xs text-green-700 font-normal">
                {displayUrl}
              </p>
            </div>
            
            {/* Title */}
            <h3 className={`text-lg font-normal mb-1 leading-snug ${
              isDark ? "text-blue-600" : "text-blue-700"
            }`}>
              {title}
            </h3>
            
            {/* Description */}
            <p className={`text-sm leading-relaxed ${
              isDark ? "text-slate-700" : "text-slate-600"
            }`}>
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Character Count with Warning */}
      <div className={`flex items-center justify-between text-xs pt-2 border-t ${
        isDark
          ? "border-slate-700 text-slate-400"
          : "border-slate-200 text-slate-500"
      }`}>
        <span>
          {charCount.toLocaleString()} characters
        </span>
        {isOverLimit && (
          <span className={`font-medium ${
            isDark ? "text-yellow-400" : "text-yellow-600"
          }`}>
            ⚠️ Over 160 characters (may be truncated in search results)
          </span>
        )}
        {!isOverLimit && charCount >= 140 && (
          <span className={isDark ? "text-slate-400" : "text-slate-500"}>
            ✓ Optimal length
          </span>
        )}
      </div>
    </div>
  );
}

