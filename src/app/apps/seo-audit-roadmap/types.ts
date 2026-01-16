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

export type FindingConfidence = "HIGH" | "MEDIUM" | "LOW";

export type FindingEvidence = {
  /**
   * Deterministic checks performed (what we looked for).
   * Example: ["<title> tag present", "Length between 20–60 characters"]
   */
  checked?: string[];
  /**
   * Deterministic observations from the provided HTML/content (what we saw).
   * Example: ["Title length: 42 characters", "Found city keyword: Ocala"]
   */
  observed?: string[];
  /**
   * Optional notes/limitations (e.g., dynamic themes may inject tags via JS).
   */
  notes?: string;
};

export interface AuditCategoryResult {
  findingId?: string;
  key: string;
  label: string;
  pointsEarned: number;
  pointsMax: number;
  status: CategoryStatus;
  shortExplanation: string;
  fixRecommendation: string;
  evidence?: FindingEvidence;
  confidence?: FindingConfidence;
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
  dependsOnFindingIds?: string[];
  dependsOnRoadmapIds?: string[];
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
