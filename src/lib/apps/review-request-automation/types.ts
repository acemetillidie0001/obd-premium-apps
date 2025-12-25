/**
 * Review Request Automation - Type Definitions
 * 
 * V3 app that generates review request templates and manages a send queue
 * for automated review request campaigns. V3 does NOT send externally;
 * it generates templates and provides a manual send queue with copy buttons.
 */

export type ReviewPlatform = "Google" | "Facebook" | "Yelp" | "Other";

export type Language = "English" | "Spanish" | "Bilingual";

export type ToneStyle = "Friendly" | "Professional" | "Bold" | "Luxury";

export type TriggerType = "manual" | "after_service" | "after_payment";

export type FrequencyCapDays = 30 | 60 | 90;

export interface QuietHours {
  start: string; // HH:mm format, default "09:00"
  end: string; // HH:mm format, default "19:00"
}

export interface CampaignRules {
  triggerType: TriggerType;
  sendDelayHours: number; // 0-168
  followUpEnabled: boolean;
  followUpDelayDays: number; // 1-30, only if followUpEnabled
  frequencyCapDays: FrequencyCapDays;
  quietHours: QuietHours;
}

export interface Campaign {
  businessName: string; // required
  businessType?: string;
  platform: ReviewPlatform;
  reviewLink: string; // required, must be valid URL
  language: Language;
  toneStyle: ToneStyle;
  brandVoice?: string;
  rules: CampaignRules;
}

export interface Customer {
  id: string; // UUID
  customerName: string;
  phone?: string;
  email?: string;
  tags?: string[]; // optional tags for filtering
  lastVisitDate?: string; // ISO date string, optional
  serviceType?: string; // optional
  jobId?: string; // optional
  optedOut: boolean; // default false
  createdAt: string; // ISO date string
}

export type CustomerStatus = "queued" | "sent" | "clicked" | "reviewed" | "optedOut";

export interface CustomerWithStatus extends Customer {
  status: CustomerStatus;
  lastSentAt?: string; // ISO date string
  lastClickedAt?: string; // ISO date string
  lastReviewedAt?: string; // ISO date string
  needsFollowUp: boolean;
}

export type MessageVariant = "smsShort" | "smsStandard" | "email" | "followUpSms";

export type MessageChannel = "sms" | "email";

export interface SendQueueItem {
  id: string; // UUID
  customerId: string;
  scheduledAt: string; // ISO date string
  variant: MessageVariant;
  channel: MessageChannel;
  status: "pending" | "sent" | "clicked" | "reviewed" | "optedOut" | "skipped";
  skippedReason?: string; // if status is "skipped"
}

export interface MessageTemplate {
  smsShort: string; // <= 240 chars target
  smsStandard: string; // <= 420 chars target
  email: {
    subject: string;
    body: string;
  };
  followUpSms: string; // soft nudge
}

export interface Event {
  id: string; // UUID
  customerId: string;
  type: "queued" | "sent" | "clicked" | "reviewed" | "optedOut";
  timestamp: string; // ISO date string
  metadata?: Record<string, unknown>; // optional event metadata
}

export interface FunnelMetrics {
  loaded: number; // total customers loaded
  ready: number; // customers ready to send (has phone or email, not opted out)
  queued: number; // items in send queue
  sent: number; // items marked as sent
  clicked: number; // items marked as clicked
  reviewed: number; // items marked as reviewed
  optedOut: number; // customers who opted out
}

export type QualityCheckSeverity = "info" | "warning" | "error";

export interface QualityCheck {
  id: string;
  severity: QualityCheckSeverity;
  title: string;
  description: string;
  suggestedFix?: string;
}

export interface NextAction {
  id: string;
  title: string;
  description: string;
  copyText?: string; // text to copy if applicable
}

export type CampaignHealthStatus = "Good" | "Needs Attention" | "At Risk";

export interface CampaignHealth {
  status: CampaignHealthStatus;
  score: number; // 0-100
  reasons: string[]; // list of issues or positive signals
}

export interface TimelineEvent {
  id: string;
  label: string;
  timestamp: string; // ISO date string
  type: "now" | "initial_send" | "follow_up";
}

export interface SendTimeline {
  events: TimelineEvent[];
  hasFollowUp: boolean;
}

export type TemplateQualityLabel = "Good" | "Too Long" | "Missing Opt-out" | "Link Issue" | "Needs Review";

export type TemplateQualitySeverity = "info" | "warning" | "critical";

export interface TemplateQuality {
  templateKey: "smsShort" | "smsStandard" | "followUpSms" | "email";
  label: TemplateQualityLabel;
  severity: TemplateQualitySeverity;
  details: string[];
  suggestion?: string;
}

export interface BusinessTypeRecommendation {
  businessType: string;
  sendDelayHours: { min: number; max: number; recommended: number };
  followUpDelayDays: { min: number; max: number; recommended: number };
  toneStyle: ToneStyle[];
  explanation: string;
}

export interface GuidanceBenchmark {
  id: string;
  category: "followUp" | "quietHours" | "frequencyCap" | "contactInfo";
  title: string;
  recommendation: string;
  currentValue?: string;
  isWithinRange: boolean;
  suggestion?: string;
}

export interface ReviewRequestAutomationRequest {
  campaign: Campaign;
  customers: Customer[];
  events: Event[]; // status history
}

export interface ReviewRequestAutomationResponse {
  templates: MessageTemplate;
  sendQueue: SendQueueItem[];
  metrics: FunnelMetrics;
  qualityChecks: QualityCheck[];
  nextActions: NextAction[];
  validationErrors: string[]; // friendly error messages
  campaignHealth: CampaignHealth;
  sendTimeline: SendTimeline;
  templateQuality: TemplateQuality[];
  businessTypeRecommendation?: BusinessTypeRecommendation;
  guidanceBenchmarks: GuidanceBenchmark[];
}

