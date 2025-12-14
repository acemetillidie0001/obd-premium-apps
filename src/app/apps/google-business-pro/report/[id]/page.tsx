"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { GoogleBusinessProReportMeta } from "../../types";

type ReportData = {
  html: string;
  pdfBase64: string | null;
  meta: GoogleBusinessProReportMeta;
};

export default function ReportViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [theme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [meta, setMeta] = useState<GoogleBusinessProReportMeta | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        // Extract token from URL if present
        const token = searchParams.get("token");
        const url = token 
          ? `/api/google-business/pro/report/${id}?token=${token}`
          : `/api/google-business/pro/report/${id}`;

        const res = await fetch(url);
        
        if (!res.ok) {
          if (res.status === 404) {
            setError("Report not found");
          } else if (res.status === 401) {
            setError("This report is secured. Please request a valid access link.");
          } else if (res.status === 410) {
            setError("This report has expired.");
          } else {
            setError("Failed to load report");
          }
          return;
        }

        const data: ReportData = await res.json();
        setHtml(data.html);
        setMeta(data.meta);

        // Convert pdfBase64 to Blob URL if present
        if (data.pdfBase64) {
          try {
            const binaryString = atob(data.pdfBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
          } catch (pdfError) {
            console.error("Error creating PDF blob:", pdfError);
          }
        }
      } catch (err) {
        console.error("Error fetching report:", err);
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchReport();
    }
  }, [id, searchParams]);

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="gbp-report-viewer min-h-screen bg-slate-50 text-slate-900">
      {/* OBD-Styled Header */}
      <div className={`bg-gradient-to-r ${
        isDark 
          ? "from-slate-800 to-slate-900 border-b border-slate-700" 
          : "from-slate-50 to-white border-b border-slate-200"
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img 
              src="/obd-logo.png" 
              alt="Ocala Business Directory" 
              className="h-8 w-auto"
              onError={(e) => {
                // Fallback if logo not found
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <OBDHeading level={1} isDark={isDark} className="mb-0">
              Google Business Profile Pro Report
            </OBDHeading>
          </div>
          <p className={`text-center text-sm ${themeClasses.mutedText}`}>
            Powered by Ocala Business Directory
          </p>
          <div className={`h-1 w-24 mx-auto mt-3 bg-[#29c4a9] rounded-full`} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Business Info Card */}
        <div className="mb-8">
          
          {meta && (
            <div className={`report-card rounded-xl border p-4 mb-4 ${
              isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className={`text-lg font-semibold mb-1 ${themeClasses.headingText}`}>
                    {meta.businessName}
                  </h2>
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    {meta.city}, {meta.state}
                  </p>
                </div>
                {meta.score !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${themeClasses.mutedText}`}>
                      Audit Score:
                    </span>
                    <span className={`text-2xl font-bold ${
                      meta.score >= 80 ? "text-green-500" :
                      meta.score >= 60 ? "text-yellow-500" : "text-red-500"
                    }`}>
                      {meta.score}/100
                    </span>
                  </div>
                )}
              </div>
              <p className={`text-xs mt-3 ${themeClasses.mutedText}`}>
                Generated on {new Date(meta.createdAt).toLocaleString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          {/* Actions */}
          {pdfUrl && (
            <div className="mb-4">
              <a
                href={pdfUrl}
                download={`gbp-pro-report-${id}.pdf`}
                className={`inline-block px-4 py-2 font-medium rounded-xl transition-colors ${
                  isDark
                    ? "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                    : "bg-[#29c4a9] text-white hover:bg-[#24b09a]"
                }`}
              >
                Download PDF
              </a>
            </div>
          )}
        </div>

        {/* Content */}
        {loading && (
          <div className="text-center py-12">
            <p className={themeClasses.mutedText}>Loading report...</p>
          </div>
        )}

        {error && (
          <div className={`rounded-xl border p-6 text-center ${
            isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"
          }`}>
            <p className={`text-lg font-semibold mb-2 ${themeClasses.headingText}`}>
              {error}
            </p>
            <p className={themeClasses.mutedText}>
              The report you're looking for may have expired or doesn't exist.
            </p>
          </div>
        )}

        {html && !loading && !error && (
          <div className="relative">
            {/* Watermark */}
            <div 
              className="gbp-report-watermark absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
              style={{
                fontSize: "clamp(2rem, 8vw, 6rem)",
                fontWeight: "bold",
                transform: "rotate(-45deg)",
                opacity: isDark ? 0.1 : 0.1, // 10% opacity (within 8-12% range)
                color: isDark ? "#475569" : "#cbd5e1", // slate colors
              }}
            >
              Ocala Business Directory — Pro Report
            </div>

            {/* Content Container */}
            <div className={`relative z-10 rounded-xl border overflow-hidden ${
              isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"
            }`}>
              <div
                className="p-6 prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: html }}
                style={{
                  color: isDark ? "#f1f5f9" : "#1e293b",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Branded Footer */}
      <footer className={`mt-12 py-6 border-t ${
        isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
      }`}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
            © {new Date().getFullYear()} Ocala Business Directory · Local SEO & AI Marketing Tools
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @media (prefers-color-scheme: dark) {
          .gbp-report-viewer {
            background-color: #0f172a; /* slate-900 */
            color: #e2e8f0; /* slate-200 */
          }
          .gbp-report-viewer .report-card {
            background-color: rgba(15, 23, 42, 0.85);
            border-color: rgba(51, 65, 85, 0.6);
          }
        }

        @media print {
          .gbp-report-viewer header,
          .gbp-report-viewer footer,
          .gbp-report-viewer button,
          .gbp-report-viewer a,
          .gbp-report-viewer .no-print {
            display: none !important;
          }

          .gbp-report-viewer {
            background: #ffffff !important;
            color: #000000 !important;
          }

          .gbp-report-watermark {
            opacity: 0.05 !important;
          }
        }
      `}</style>
    </div>
  );
}
