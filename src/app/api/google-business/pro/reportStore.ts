import type { GoogleBusinessProReportMeta } from "@/app/apps/google-business-pro/types";

// Shape of a stored report entry
export interface StoredReport {
  shareId: string;
  html: string;
  pdfBase64?: string;
  meta: GoogleBusinessProReportMeta;
}

// Simple in-memory map for storing Pro reports by shareId.
// NOTE: This is non-persistent and will reset on server restart or new deployment.
export const REPORT_STORE = new Map<string, StoredReport>();
