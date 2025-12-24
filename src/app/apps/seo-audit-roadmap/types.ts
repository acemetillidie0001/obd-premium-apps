/**
 * SEO Audit & Roadmap - Type Definitions
 * 
 * V3 app that audits a single local landing page and returns
 * a structured SEO score + prioritized roadmap (deterministic, no AI).
 */

export interface SEOAuditRoadmapRequest {
  // Audit Source (exactly one required)
  pageUrl?: string;
  pageContent?: string;
  
  // Context
  primaryService: string; // Required
  city: string; // Required (default "Ocala" on client)
  state: string; // Required (default "Florida" on client)
  businessType?: string;
  targetAudience?: "Residential" | "Commercial" | "Both";
}

export type CategoryStatus = "pass" | "needs-improvement" | "missing";

export interface AuditCategoryResult {
  key: string;
  label: string;
  pointsEarned: number;
  pointsMax: number;
  status: CategoryStatus;
  shortExplanation: string;
  fixRecommendation: string;
}

export interface RoadmapItem {
  id: string;
  priority: "HIGH" | "MEDIUM" | "OPTIONAL";
  category: string; // Category key for sorting (e.g., "h1-tag", "title-tag")
  title: string;
  whatIsWrong: string;
  whyItMatters: string;
  nextSteps: string[];
  estimatedEffort: "Low" | "Medium" | "High";
  pointsAvailable: number;
  relatedApp?: {
    name: string;
    href: string;
  };
}

export interface SEOAuditRoadmapResponse {
  score: number;
  band: string;
  summary: string;
  auditedUrl?: string;
  categoryResults: AuditCategoryResult[];
  roadmap: RoadmapItem[];
  meta: {
    requestId: string;
    auditedAtISO: string;
  };
}
