export type StoredReport = {
  html: string;
  pdfBase64?: string;
  meta: {
    businessName: string;
    city: string;
    state: string;
    score?: number;
    createdAt: string; // ISO
    accessToken?: string;
  };
};

export const REPORT_STORE = new Map<string, StoredReport>();
