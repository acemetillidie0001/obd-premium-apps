// src/app/local-hiring-assistant/types.ts

export type PersonalityStyle = 'None' | 'Soft' | 'Bold' | 'High-Energy' | 'Luxury';

export type LanguageOption = 'English' | 'Spanish' | 'Bilingual';

export type JobPostLength = 'Short' | 'Medium' | 'Long';

export type EmploymentType =
  | 'Full-Time'
  | 'Part-Time'
  | 'Contract'
  | 'Seasonal'
  | 'Temporary';

export type WorkLocationType = 'On-site' | 'Hybrid' | 'Remote';

export interface LocalHiringAssistantRequest {
  // Business basics
  businessName: string;
  businessType: string;
  services?: string[];
  city?: string;
  state?: string;

  // Role basics
  roleTitle: string;
  employmentType: EmploymentType;
  workLocationType: WorkLocationType;
  department?: string;
  experienceLevel?: string; // e.g. "2–3 years", "Senior"
  scheduleDetails?: string; // e.g. "Monday–Friday, 9am–5pm"
  compensationDetails?: string; // salary, hourly range, etc.

  // Role details
  responsibilities?: string[];
  mustHaveSkills?: string[];
  niceToHaveSkills?: string[];
  certifications?: string[];
  benefits?: string[];
  aboutCompany?: string;
  idealCandidateProfile?: string;
  hiringGoals?: string; // e.g. "Fill this role in 30 days with strong local candidates"

  // Voice & style
  brandVoice?: string;
  personalityStyle: PersonalityStyle;
  language: LanguageOption;
  jobPostLength: JobPostLength;

  // Output toggles
  includeShortJobPostPack: boolean;
  includeScreeningQuestions: boolean;
  includeInterviewQuestions: boolean;
  includeBenefitsHighlight: boolean;
  includeApplicationInstructions: boolean;
}

export interface JobDescriptionSection {
  title: string;
  body: string;
}

export type HiringPlatform =
  | 'Facebook'
  | 'Instagram'
  | 'GoogleBusinessProfile'
  | 'X'
  | 'LinkedIn';

export interface HiringPost {
  platform: HiringPlatform;
  headline: string;
  body: string;
  callToAction: string;
}

export interface QuestionItem {
  question: string;
  rationale?: string;
}

export interface LocalHiringAssistantResponseMeta {
  modelVersion: string;
  createdAt: string;
}

export interface LocalHiringAssistantResponse {
  jobTitle: string;
  companyName: string;
  location: string;
  jobDescriptionSections: JobDescriptionSection[];

  shortJobPostPack?: HiringPost[];
  screeningQuestions?: QuestionItem[];
  interviewQuestions?: QuestionItem[];
  benefitsHighlight?: string[];
  applicationInstructions?: string;

  meta: LocalHiringAssistantResponseMeta;
}
