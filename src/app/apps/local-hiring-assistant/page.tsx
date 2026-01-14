'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import OBDPageContainer from '@/components/obd/OBDPageContainer';
import OBDPanel from '@/components/obd/OBDPanel';
import ResultCard from '@/components/obd/ResultCard';
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from '@/components/obd/OBDStickyActionBar';
import { getThemeClasses, getInputClasses } from '@/lib/obd-framework/theme';
import { writeHandoff, HANDOFF_KEY } from '@/lib/obd-framework/social-handoff-transport';
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from '@/lib/obd-framework/layout-helpers';
import { JOB_POST_SECTIONS } from '@/lib/apps/local-hiring-assistant/types';
import type { JobPostItem } from '@/lib/apps/local-hiring-assistant/types';
import {
  getActiveJobPost,
  getActiveJobPosts,
  canExportJobPost,
  createJobPostItem,
  getJobPostStatus,
  getSectionContent,
} from '@/lib/apps/local-hiring-assistant/selectors';
import type { JobPostSectionKey } from '@/lib/apps/local-hiring-assistant/types';
import type { JobPostSection } from '@/lib/apps/local-hiring-assistant/types';
import type { SocialAutoPosterHandoffPayload } from '@/lib/apps/social-auto-poster/handoff-parser';
import { resolveBusinessId } from '@/lib/utils/resolve-business-id';
import type {
  LocalHiringAssistantRequest,
  LocalHiringAssistantResponse,
  EmploymentType,
  WorkLocationType,
  PersonalityStyle,
  JobPostLength,
  LanguageOption,
} from './types';

const employmentTypes: EmploymentType[] = [
  'Full-Time',
  'Part-Time',
  'Contract',
  'Seasonal',
  'Temporary',
];

const workLocationTypes: WorkLocationType[] = ['On-site', 'Hybrid', 'Remote'];

const personalityStyles: PersonalityStyle[] = [
  'None',
  'Soft',
  'Bold',
  'High-Energy',
  'Luxury',
];

const jobPostLengths: JobPostLength[] = ['Short', 'Medium', 'Long'];

const languages: LanguageOption[] = ['English', 'Spanish', 'Bilingual'];

// Preset role templates (Feature 1)
interface RoleTemplate {
  name: string;
  roleTitle: string;
  businessType: string;
  employmentType: EmploymentType;
  workLocationType: WorkLocationType;
  department?: string;
  experienceLevel?: string;
  responsibilities?: string[];
  mustHaveSkills?: string[];
  niceToHaveSkills?: string[];
  certifications?: string[];
}

const roleTemplates: RoleTemplate[] = [
  {
    name: 'Massage Therapist',
    roleTitle: 'Licensed Massage Therapist',
    businessType: 'Massage Spa',
    employmentType: 'Full-Time',
    workLocationType: 'On-site',
    department: 'Massage Therapy',
    experienceLevel: '2+ years in professional spa setting',
    responsibilities: [
      'Provide 60- and 90-minute massage sessions',
      'Maintain clean and calming treatment room',
      'Educate clients on wellness packages',
    ],
    mustHaveSkills: [
      'Active Florida massage license',
      'Strong client communication skills',
    ],
    niceToHaveSkills: [
      'Experience with hot stone therapy',
      'Knowledge of aromatherapy',
    ],
    certifications: ['Florida Massage License'],
  },
  {
    name: 'Restaurant Server',
    roleTitle: 'Server',
    businessType: 'Restaurant',
    employmentType: 'Part-Time',
    workLocationType: 'On-site',
    department: 'Front of House',
    experienceLevel: '1+ years serving experience',
    responsibilities: [
      'Take orders and serve food and beverages',
      'Provide excellent customer service',
      'Handle payments and maintain clean tables',
    ],
    mustHaveSkills: [
      'Customer service experience',
      'Ability to work in fast-paced environment',
    ],
    niceToHaveSkills: ['Knowledge of wine pairings', 'Bilingual (English/Spanish)'],
  },
  {
    name: 'Auto Mechanic',
    roleTitle: 'Auto Mechanic',
    businessType: 'Auto Repair Shop',
    employmentType: 'Full-Time',
    workLocationType: 'On-site',
    department: 'Service',
    experienceLevel: '3+ years automotive repair experience',
    responsibilities: [
      'Diagnose and repair vehicle issues',
      'Perform routine maintenance',
      'Communicate with customers about repairs',
    ],
    mustHaveSkills: [
      'ASE certification preferred',
      'Valid driver\'s license',
    ],
    certifications: ['ASE Certification'],
  },
  {
    name: 'Receptionist',
    roleTitle: 'Front Desk Receptionist',
    businessType: 'Medical Office',
    employmentType: 'Full-Time',
    workLocationType: 'On-site',
    department: 'Administration',
    experienceLevel: '1+ years front desk experience',
    responsibilities: [
      'Greet patients and visitors',
      'Schedule appointments',
      'Answer phones and handle inquiries',
    ],
    mustHaveSkills: [
      'Excellent phone etiquette',
      'Basic computer skills',
    ],
    niceToHaveSkills: ['Medical office experience', 'Bilingual'],
  },
];

const defaultFormValues: LocalHiringAssistantRequest = {
  businessName: '',
  businessType: '',
  services: [],
  city: 'Ocala',
  state: 'Florida',

  roleTitle: '',
  employmentType: 'Full-Time',
  workLocationType: 'On-site',
  department: '',
  experienceLevel: '',
  scheduleDetails: '',
  compensationDetails: '',

  responsibilities: [],
  mustHaveSkills: [],
  niceToHaveSkills: [],
  certifications: [],
  benefits: [],
  aboutCompany: '',
  idealCandidateProfile: '',
  hiringGoals: '',

  brandVoice: '',
  personalityStyle: 'None',
  language: 'English',
  jobPostLength: 'Medium',

  includeShortJobPostPack: true,
  includeScreeningQuestions: true,
  includeInterviewQuestions: true,
  includeBenefitsHighlight: true,
  includeApplicationInstructions: true,
};

export default function LocalHiringAssistantPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const isDark = theme === 'dark';
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();
  const businessId = resolveBusinessId(searchParams);

  const [formValues, setFormValues] = useState<LocalHiringAssistantRequest>(
    defaultFormValues,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocalHiringAssistantResponse | null>(
    null,
  );
  void result;

  // Canonical job posts state (new; UI continues to render from legacy `result`)
  const [jobPosts, setJobPosts] = useState<JobPostItem[]>([]);
  const [activeJobPostId, setActiveJobPostId] = useState<string | null>(null);

  // Derived canonical values (Tier 5B): deterministic selection + ordering
  const activeJobPost = getActiveJobPost(jobPosts, activeJobPostId);
  const status = activeJobPost ? getJobPostStatus(activeJobPost) : 'Draft';
  const exportCheck = canExportJobPost(activeJobPost);

  const getJobPostLabelParts = (
    item: JobPostItem,
  ): { jobTitle: string; location: string; time: string } => {
    let parsed: Partial<LocalHiringAssistantRequest> | null = null;
    try {
      const json = item.inputsJson ?? item.inputsHash;
      parsed = JSON.parse(json) as Partial<LocalHiringAssistantRequest>;
    } catch {
      parsed = null;
    }

    const jobTitle = (parsed?.roleTitle ?? '').trim() || 'Untitled role';
    const city = (parsed?.city ?? '').trim();
    const state = (parsed?.state ?? '').trim();
    const location =
      [city, state].filter(Boolean).join(', ') || 'Location not set';

    const timeIso =
      item.updatedAt && item.updatedAt !== item.createdAt
        ? item.updatedAt
        : item.createdAt;
    const t = Date.parse(timeIso);
    const time = Number.isFinite(t)
      ? new Date(t).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

    return { jobTitle, location, time };
  };

  const sortedJobPosts = getActiveJobPosts(jobPosts);

  const getStatusChipClasses = (s: 'Draft' | 'Generated' | 'Edited'): string => {
    const base = 'text-[10px] px-2 py-0.5 rounded-full border';
    if (s === 'Edited') {
      return `${base} ${
        isDark
          ? 'border-emerald-700/60 text-emerald-300 bg-emerald-900/20'
          : 'border-emerald-200 text-emerald-700 bg-emerald-50'
      }`;
    }
    if (s === 'Generated') {
      return `${base} ${
        isDark
          ? 'border-sky-700/60 text-sky-300 bg-sky-900/20'
          : 'border-sky-200 text-sky-700 bg-sky-50'
      }`;
    }
    return `${base} ${
      isDark
        ? 'border-slate-600 text-slate-200 bg-slate-800/40'
        : 'border-slate-200 text-slate-700 bg-white'
    }`;
  };

  const deleteJobPostVersion = (id: string) => {
    const item = (jobPosts ?? []).find((p) => p.id === id);
    const parts = item ? getJobPostLabelParts(item) : null;
    const label = parts
      ? `${parts.jobTitle} • ${parts.location}${parts.time ? ` • ${parts.time}` : ''}`
      : '';
    const ok = confirm(
      `Delete this version${label ? ` (${label})` : ''}? This cannot be undone.`,
    );
    if (!ok) return;

    const isDeletingActive = id === (activeJobPostId ?? activeJobPost?.id ?? null);
    if (isDeletingActive) setActiveJobPostId(null);

    setJobPosts((prev) => (prev ?? []).filter((p) => p.id !== id));
  };

  // Tier 5B inline edit (canonical pattern) — shared across canonical sections
  const [editingKey, setEditingKey] = useState<JobPostSectionKey | null>(null);
  const [draftText, setDraftText] = useState<string>('');
  const [compareKeys, setCompareKeys] = useState<Set<JobPostSectionKey>>(
    () => new Set<JobPostSectionKey>(),
  );

  const isComparing = (key: JobPostSectionKey): boolean => {
    return compareKeys.has(key);
  };

  const toggleCompare = (key: JobPostSectionKey) => {
    setCompareKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const closeCompare = (key: JobPostSectionKey) => {
    setCompareKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // If the active post changes while editing, deterministically cancel the edit
  const lastActiveJobPostIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextId = activeJobPost?.id ?? null;
    const prevId = lastActiveJobPostIdRef.current;
    if (prevId !== null && nextId !== prevId) {
      setEditingKey(null);
      setDraftText('');
      setCompareKeys(new Set<JobPostSectionKey>());
    }
    lastActiveJobPostIdRef.current = nextId;
  }, [activeJobPost?.id]);

  const isEditedBadgeVisible = (section?: JobPostSection | null): boolean => {
    const edited = section?.edited;
    if (edited === undefined || edited === null) return false;
    if (edited.trim().length === 0) return false;
    return edited !== (section?.generated ?? '');
  };

  const getIsDraftDirtyForKey = (key: JobPostSectionKey): boolean => {
    if (!activeJobPost) return false;
    if (editingKey !== key) return false;
    const section = activeJobPost.sections.find((s) => s.key === key);
    if (!section) return false;
    return draftText !== getSectionContent(section);
  };

  const beginEdit = (key: JobPostSectionKey) => {
    if (!activeJobPost) return;
    if (editingKey !== null && editingKey !== key) return;
    const section = activeJobPost.sections.find((s) => s.key === key);
    if (!section) return;
    setEditingKey(key);
    setDraftText(getSectionContent(section));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftText('');
  };

  const saveEdit = (key: JobPostSectionKey) => {
    if (!activeJobPost) return;
    if (editingKey !== key) return;
    const nowIso = new Date().toISOString();
    const activeId = activeJobPost.id;
    const currentSection = activeJobPost.sections.find((s) => s.key === key);
    if (!currentSection) return;

    // Normalize edits:
    // - Empty edits are treated as "no override" (reset to generated)
    // - Edits equal to generated are treated as "no override"
    const nextEditedRaw = draftText;
    const nextEdited =
      nextEditedRaw.trim().length === 0 ||
      nextEditedRaw === (currentSection.generated ?? "")
        ? null
        : nextEditedRaw;

    setJobPosts((prev) =>
      (prev ?? []).map((post) => {
        if (post.id !== activeId) return post;
        return {
          ...post,
          updatedAt: nowIso,
          sections: (post.sections ?? []).map((section) => {
            if (section.key !== key) return section;
            return {
              ...section,
              edited: nextEdited,
              updatedAt: nowIso,
            };
          }),
        };
      }),
    );

    setEditingKey(null);
    setDraftText('');
    if (nextEdited === null) closeCompare(key);
  };

  const resetSectionToGenerated = (key: JobPostSectionKey) => {
    if (!activeJobPost) return;
    if (editingKey === key) cancelEdit();
    const nowIso = new Date().toISOString();
    const activeId = activeJobPost.id;

    setJobPosts((prev) =>
      (prev ?? []).map((post) => {
        if (post.id !== activeId) return post;
        return {
          ...post,
          updatedAt: nowIso,
          sections: (post.sections ?? []).map((section) => {
            if (section.key !== key) return section;
            return {
              ...section,
              edited: null,
              updatedAt: nowIso,
            };
          }),
        };
      }),
    );
    closeCompare(key);
  };

  const resetAllEdits = () => {
    if (!activeJobPost) return;
    if (editingKey !== null) cancelEdit();
    const nowIso = new Date().toISOString();
    const activeId = activeJobPost.id;

    setJobPosts((prev) =>
      (prev ?? []).map((post) => {
        if (post.id !== activeId) return post;
        return {
          ...post,
          updatedAt: nowIso,
          sections: (post.sections ?? []).map((section) => ({
            ...section,
            edited: null,
            updatedAt: nowIso,
          })),
        };
      }),
    );
    setCompareKeys(new Set<JobPostSectionKey>());
  };

  const getCopyTextForKey = (
    key: JobPostSectionKey,
    section?: JobPostSection | null,
  ): string => {
    if (editingKey === key) return draftText;
    return section ? getSectionContent(section) : '';
  };

  // Simple "Copied!" feedback for header copy buttons (per canonical section)
  const [copiedKey, setCopiedKey] = useState<JobPostSectionKey | null>(null);

  const handleCopy = async (
    key: JobPostSectionKey,
    section?: JobPostSection | null,
  ) => {
    const text = getCopyTextForKey(key, section);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Local string state for comma-separated fields (allows free typing)
  const [servicesText, setServicesText] = useState('');
  const [responsibilitiesText, setResponsibilitiesText] = useState('');
  const [mustHaveSkillsText, setMustHaveSkillsText] = useState('');
  const [niceToHaveSkillsText, setNiceToHaveSkillsText] = useState('');
  const [certificationsText, setCertificationsText] = useState('');
  const [benefitsText, setBenefitsText] = useState('');

  // Feature 11: Form field validation on blur
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    businessType?: string;
    roleTitle?: string;
  }>({});

  // Tier 5A-style input accordion (UI-only)
  const [formAccordionState, setFormAccordionState] = useState({
    jobBasics: true, // default open
    roleDetails: false,
    paySchedule: false,
    requirements: false,
    companyVoice: false,
    postingGoals: false,
  });

  // Feature 12: Result section collapse/expand
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    // Default open: Full Job Description (others collapsed)
    new Set([
      'shortJobPostPack',
      'screeningQuestions',
      'interviewQuestions',
      'careersPageRaw',
      'benefitsHighlight',
      'applicationInstructions',
    ]),
  );

  // Feature 9: Loading progress indicator
  const [loadingStep, setLoadingStep] = useState<string>('');

  // Feature 1: Preset role template
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Feature 8: Multi-role support (simplified - save/load configurations)
  const [savedConfigurations, setSavedConfigurations] = useState<
    Array<{ name: string; data: LocalHiringAssistantRequest; textFields: Record<string, string> }>
  >([]);
  const SAVED_CONFIGS_KEY = 'local-hiring-assistant-saved-configs';

  // Refs for keyboard shortcuts (Feature 10)
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Feature 2: Form auto-save to localStorage
  const STORAGE_KEY = 'local-hiring-assistant-form';

  useEffect(() => {
    // Load saved form data on mount
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setFormValues(parsed.formValues);
          setServicesText(parsed.servicesText || '');
          setResponsibilitiesText(parsed.responsibilitiesText || '');
          setMustHaveSkillsText(parsed.mustHaveSkillsText || '');
          setNiceToHaveSkillsText(parsed.niceToHaveSkillsText || '');
          setCertificationsText(parsed.certificationsText || '');
          setBenefitsText(parsed.benefitsText || '');
        }
        // Feature 8: Load saved configurations
        const savedConfigs = localStorage.getItem(SAVED_CONFIGS_KEY);
        if (savedConfigs) {
          setSavedConfigurations(JSON.parse(savedConfigs));
        }
      } catch (e) {
        console.error('Failed to load saved form:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save form data on every change
    if (typeof window !== 'undefined') {
      try {
        const toSave = {
          formValues,
          servicesText,
          responsibilitiesText,
          mustHaveSkillsText,
          niceToHaveSkillsText,
          certificationsText,
          benefitsText,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.error('Failed to save form:', e);
      }
    }
  }, [formValues, servicesText, responsibilitiesText, mustHaveSkillsText, niceToHaveSkillsText, certificationsText, benefitsText]);

  // Feature 10: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (formRef.current && !loading) {
          formRef.current.requestSubmit();
        }
      }
      // Esc to clear form
      if (e.key === 'Escape' && !loading) {
        if (confirm('Clear all form data?')) {
          handleClearForm();
        }
      }
      // Ctrl/Cmd + K to focus first input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        firstInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading]);

  const handleClearForm = () => {
    setFormValues(defaultFormValues);
    setServicesText('');
    setResponsibilitiesText('');
    setMustHaveSkillsText('');
    setNiceToHaveSkillsText('');
    setCertificationsText('');
    setBenefitsText('');
    setResult(null);
    setJobPosts([]);
    setActiveJobPostId(null);
    setError(null);
    setFieldErrors({});
    setSelectedTemplate('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Feature 8: Save current configuration
  const handleSaveConfiguration = () => {
    const name = prompt('Enter a name for this configuration:');
    if (!name) return;
    
    const config = {
      name,
      data: formValues,
      textFields: {
        servicesText,
        responsibilitiesText,
        mustHaveSkillsText,
        niceToHaveSkillsText,
        certificationsText,
        benefitsText,
      },
    };
    
    const updated = [...savedConfigurations, config];
    setSavedConfigurations(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(updated));
    }
  };

  // Feature 8: Load saved configuration
  const handleLoadConfiguration = (config: typeof savedConfigurations[0]) => {
    setFormValues(config.data);
    setServicesText(config.textFields.servicesText || '');
    setResponsibilitiesText(config.textFields.responsibilitiesText || '');
    setMustHaveSkillsText(config.textFields.mustHaveSkillsText || '');
    setNiceToHaveSkillsText(config.textFields.niceToHaveSkillsText || '');
    setCertificationsText(config.textFields.certificationsText || '');
    setBenefitsText(config.textFields.benefitsText || '');
    setResult(null);
    setError(null);
  };

  // Feature 8: Delete saved configuration
  const handleDeleteConfiguration = (index: number) => {
    const updated = savedConfigurations.filter((_, i) => i !== index);
    setSavedConfigurations(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(updated));
    }
  };

  // Feature 1: Apply role template
  const applyTemplate = (template: RoleTemplate) => {
    setFormValues((prev) => ({
      ...prev,
      roleTitle: template.roleTitle,
      businessType: template.businessType,
      employmentType: template.employmentType,
      workLocationType: template.workLocationType,
      department: template.department || '',
      experienceLevel: template.experienceLevel || '',
      responsibilities: template.responsibilities || [],
      mustHaveSkills: template.mustHaveSkills || [],
      niceToHaveSkills: template.niceToHaveSkills || [],
      certifications: template.certifications || [],
    }));
    setResponsibilitiesText((template.responsibilities || []).join(', '));
    setMustHaveSkillsText((template.mustHaveSkills || []).join(', '));
    setNiceToHaveSkillsText((template.niceToHaveSkills || []).join(', '));
    setCertificationsText((template.certifications || []).join(', '));
  };

  const updateFormValue = <K extends keyof LocalHiringAssistantRequest>(
    key: K,
    value: LocalHiringAssistantRequest[K],
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Clear error when user edits
    if (error) setError(null);
    // Feature 11: Clear field-specific error
    if (fieldErrors[key as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof typeof fieldErrors];
        return next;
      });
    }
  };

  // Feature 11: Validate field on blur
  const validateField = (field: 'businessName' | 'businessType' | 'roleTitle') => {
    const value = formValues[field];
    if (!value || !value.trim()) {
      const messages = {
        businessName: 'Please enter your business name.',
        businessType: 'Please enter your business type.',
        roleTitle: 'Please enter the job title.',
      };
      setFieldErrors((prev) => ({ ...prev, [field]: messages[field] }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Convert string to array (used on blur or submit)
  const stringToArray = (value: string): string[] => {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  };

  // Handle text changes for comma-separated fields (store as string, allow free typing)
  const handleCommaListTextChange = (
    key:
      | 'services'
      | 'responsibilities'
      | 'mustHaveSkills'
      | 'niceToHaveSkills'
      | 'certifications'
      | 'benefits',
    value: string,
  ) => {
    // Update local string state immediately (allows free typing)
    switch (key) {
      case 'services':
        setServicesText(value);
        break;
      case 'responsibilities':
        setResponsibilitiesText(value);
        break;
      case 'mustHaveSkills':
        setMustHaveSkillsText(value);
        break;
      case 'niceToHaveSkills':
        setNiceToHaveSkillsText(value);
        break;
      case 'certifications':
        setCertificationsText(value);
        break;
      case 'benefits':
        setBenefitsText(value);
        break;
    }

    // Also update form state as array (for API submission)
    const items = stringToArray(value);
    updateFormValue(key, items);
  };

  // Handle blur - ensure array is synced
  const handleCommaListBlur = (
    key:
      | 'services'
      | 'responsibilities'
      | 'mustHaveSkills'
      | 'niceToHaveSkills'
      | 'certifications'
      | 'benefits',
  ) => {
    let value = '';
    switch (key) {
      case 'services':
        value = servicesText;
        break;
      case 'responsibilities':
        value = responsibilitiesText;
        break;
      case 'mustHaveSkills':
        value = mustHaveSkillsText;
        break;
      case 'niceToHaveSkills':
        value = niceToHaveSkillsText;
        break;
      case 'certifications':
        value = certificationsText;
        break;
      case 'benefits':
        value = benefitsText;
        break;
    }
    const items = stringToArray(value);
    updateFormValue(key, items);
  };

  // Get text value for display
  const getCommaListText = (
    key:
      | 'services'
      | 'responsibilities'
      | 'mustHaveSkills'
      | 'niceToHaveSkills'
      | 'certifications'
      | 'benefits',
  ): string => {
    switch (key) {
      case 'services':
        return servicesText;
      case 'responsibilities':
        return responsibilitiesText;
      case 'mustHaveSkills':
        return mustHaveSkillsText;
      case 'niceToHaveSkills':
        return niceToHaveSkillsText;
      case 'certifications':
        return certificationsText;
      case 'benefits':
        return benefitsText;
      default:
        return '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);
    setFieldErrors({});

    // Improved validation with friendly messages
    if (!formValues.businessName.trim()) {
      setError(
        'Please enter your business name so we can personalize the job description.',
      );
      return;
    }
    if (!formValues.businessType.trim()) {
      setError(
        'Please enter your business type (for example: "Massage Spa" or "Auto Repair").',
      );
      return;
    }
    if (!formValues.roleTitle.trim()) {
      setError(
        'Please enter the job title (for example: "Front Desk Receptionist" or "Licensed Massage Therapist").',
      );
      return;
    }

    // Build final payload with synced array values from text fields
    const payload: LocalHiringAssistantRequest = {
      ...formValues,
      services: stringToArray(servicesText),
      responsibilities: stringToArray(responsibilitiesText),
      mustHaveSkills: stringToArray(mustHaveSkillsText),
      niceToHaveSkills: stringToArray(niceToHaveSkillsText),
      certifications: stringToArray(certificationsText),
      benefits: stringToArray(benefitsText),
    };

    setLoading(true);
    // Feature 9: Loading progress indicator
    setLoadingStep('Generating job description...');
    
    try {
      const response = await fetch('/api/local-hiring-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error ||
          'Something went wrong while generating your hiring campaign. Please try again.';
        throw new Error(errorMessage);
      }

      setLoadingStep('Creating social posts...');
      const data: LocalHiringAssistantResponse = await response.json();
      
      setLoadingStep('Finalizing questions...');
      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      setResult(data);

      // Canonical wiring: store a JobPostItem alongside legacy `result` (UI still renders from `result`)
      const nowIso = new Date().toISOString();
      const fullText =
        (data.jobDescriptionSections ?? [])
          .map((s) => `${s.title}\n\n${s.body}`)
          .join('\n\n') || '';

      const screeningText =
        (data.screeningQuestions ?? [])
          .map((q, idx) => {
            let text = `${idx + 1}. ${q.question}`;
            if (q.rationale) text += `\n   ${q.rationale}`;
            return text;
          })
          .join('\n\n') || '';

      const interviewText =
        (data.interviewQuestions ?? [])
          .map((q, idx) => {
            let text = `${idx + 1}. ${q.question}`;
            if (q.rationale) text += `\n   ${q.rationale}`;
            return text;
          })
          .join('\n\n') || '';

      const benefitsText =
        (data.benefitsHighlight ?? []).map((b) => `- ${b}`).join('\n') || '';

      const applicationText = data.applicationInstructions ?? '';

      const careersPageText = [
        benefitsText ? `Benefits Highlight:\n${benefitsText}` : '',
        applicationText ? `Application Instructions:\n${applicationText}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const socialText =
        (data.shortJobPostPack ?? [])
          .map(
            (p) =>
              `[${p.platform}]\n${p.headline}\n\n${p.body}\n\n${p.callToAction}`,
          )
          .join('\n\n') || '';

      const newItem: JobPostItem = createJobPostItem({
        createdAtIso: nowIso,
        inputs: formValues,
        generatedByKey: {
          full: fullText,
          summary: screeningText,
          indeed: interviewText,
          careersPage: careersPageText,
          social: socialText,
        },
      });

      setJobPosts((prev) => [newItem, ...prev]);
      setActiveJobPostId(newItem.id);

      setLoadingStep('');
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while generating your hiring campaign. Please try again.',
      );
      setLoadingStep('');
    } finally {
      setLoading(false);
    }
  };

  // Feature 4: Generate again with same inputs
  const handleGenerateAgain = () => {
    if (editingKey !== null) {
      const ok = confirm(
        'You have an edit in progress. Generate Again will discard the in-progress edit and create a new version. Continue?',
      );
      if (!ok) return;
      cancelEdit();
    }
    if (status === 'Edited') {
      const ok = confirm(
        'This version has edits. Generate Again will create a new version (your edited version will still be available in Versions). Continue?',
      );
      if (!ok) return;
    }
    handleSubmit();
  };

  // Feature 3: Character count helpers
  const getCharacterCount = (text: string): number => {
    return text.length;
  };

  const getCharacterCountClass = (count: number, max?: number): string => {
    if (max) {
      if (count > max) return 'text-red-500';
      if (count > max * 0.9) return 'text-yellow-500';
    }
    return themeClasses.mutedText;
  };

  // Feature 5 & 7: Export functionality
  const exportToText = () => {
    const check = canExportJobPost(activeJobPost);
    if (!check.ok) {
      setError(check.reason || 'Unable to export yet.');
      return;
    }
    if (!activeJobPost) return;
    const byKey = new Map(activeJobPost.sections.map((s) => [s.key, s] as const));
    const content = JOB_POST_SECTIONS.map(({ key, title }) => {
      const section = byKey.get(key);
      const text = section ? getSectionContent(section).trim() : '';
      if (!text) return '';
      return `${title}\n\n${text}`;
    })
      .filter(Boolean)
      .join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(formValues.roleTitle || 'job_post').replace(
      /\s+/g,
      '_',
    )}_hiring_campaign.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToATS = (format: 'greenhouse' | 'lever' | 'workday') => {
    const check = canExportJobPost(activeJobPost, ['full']);
    if (!check.ok) {
      setError(check.reason || 'Unable to export yet.');
      return;
    }
    if (!activeJobPost) return;
    const fullSection = activeJobPost.sections.find((s) => s.key === 'full');
    const fullContent = fullSection ? getSectionContent(fullSection) : '';
    let content = '';
    
    if (format === 'greenhouse') {
      content = `Job Title: ${formValues.roleTitle}\n`;
      content += `Location: ${(formValues.city || 'Ocala')}, ${
        formValues.state || 'Florida'
      }\n`;
      content += `Employment Type: ${formValues.employmentType}\n\n`;
      content += `Job Description:\n`;
      content += `${fullContent}\n\n`;
    } else if (format === 'lever') {
      content = `# ${formValues.roleTitle}\n\n`;
      content += `**Location:** ${(formValues.city || 'Ocala')}, ${
        formValues.state || 'Florida'
      }\n`;
      content += `**Team:** ${formValues.department || 'General'}\n\n`;
      content += `${fullContent}\n\n`;
    } else if (format === 'workday') {
      content = `${formValues.roleTitle}\n`;
      content += `${(formValues.city || 'Ocala')}, ${
        formValues.state || 'Florida'
      }\n\n`;
      content += `${fullContent}\n\n`;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(formValues.roleTitle || 'job_post').replace(
      /\s+/g,
      '_',
    )}_${format}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Feature 12: Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Toggle input accordion section (UI-only)
  const toggleFormAccordion = (section: keyof typeof formAccordionState) => {
    setFormAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Tier 5A parity: quick controls for accordion + outputs
  const expandAllFormAccordion = () => {
    setFormAccordionState({
      jobBasics: true,
      roleDetails: true,
      paySchedule: true,
      requirements: true,
      companyVoice: true,
      postingGoals: true,
    });
  };

  const collapseAllFormAccordion = () => {
    // Keep Job Basics open so the form is never "empty" by default.
    setFormAccordionState({
      jobBasics: true,
      roleDetails: false,
      paySchedule: false,
      requirements: false,
      companyVoice: false,
      postingGoals: false,
    });
  };

  const expandAllOutputs = () => {
    setCollapsedSections(new Set());
  };

  const collapseAllOutputs = () => {
    setCollapsedSections(
      new Set([
        'jobDescription',
        'shortJobPostPack',
        'screeningQuestions',
        'interviewQuestions',
        'careersPageRaw',
        'benefitsHighlight',
        'applicationInstructions',
      ]),
    );
  };

  // 1-line summaries for accordion headers (UI-only; simple concatenation)
  const getJobBasicsSummary = (): string => {
    const parts: string[] = [];
    if (formValues.roleTitle?.trim()) parts.push(formValues.roleTitle.trim());
    const city = (formValues.city ?? '').trim();
    if (city) parts.push(city);
    if (parts.length === 0) return 'Not set';
    return parts.join(' • ');
  };

  const getRoleDetailsSummary = (): string => {
    const parts: string[] = [];
    if (formValues.department?.trim()) parts.push(formValues.department.trim());
    if (formValues.workLocationType) parts.push(formValues.workLocationType);
    if (parts.length === 0) return 'Not set';
    return parts.join(' • ');
  };

  const getPayScheduleSummary = (): string => {
    const parts: string[] = [];
    if (formValues.compensationDetails?.trim())
      parts.push(formValues.compensationDetails.trim());
    else if (formValues.scheduleDetails?.trim())
      parts.push(formValues.scheduleDetails.trim());
    else if (formValues.employmentType) parts.push(formValues.employmentType);
    if (parts.length === 0) return 'Not set';
    return parts.join(' • ');
  };

  const getRequirementsSummary = (): string => {
    const first =
      mustHaveSkillsText.trim() ||
      certificationsText.trim() ||
      niceToHaveSkillsText.trim() ||
      responsibilitiesText.trim();
    return first ? first : 'Not set';
  };

  const getCompanyVoiceSummary = (): string => {
    const parts: string[] = [];
    if ((formValues.brandVoice ?? '').trim()) parts.push('Brand voice');
    if (formValues.personalityStyle && formValues.personalityStyle !== 'None')
      parts.push(formValues.personalityStyle);
    if (formValues.language && formValues.language !== 'English')
      parts.push(formValues.language);
    if (parts.length === 0) return 'Not set';
    return parts.join(' • ');
  };

  const getPostingGoalsSummary = (): string => {
    const parts: string[] = [];
    if (formValues.jobPostLength) parts.push(formValues.jobPostLength);
    if ((formValues.hiringGoals ?? '').trim()) parts.push('Goals set');
    if (parts.length === 0) return 'Not set';
    return parts.join(' • ');
  };

  // Helper to format job description for copying
  const formatJobDescriptionForCopy = (): string => {
    if (!activeJobPost) return '';
    const fullSection = activeJobPost.sections.find((s) => s.key === 'full');
    return getCopyTextForKey('full', fullSection ?? null);
  };

  // Helper to format questions for copying
  const formatQuestionsForCopy = (questions: Array<{ question: string; rationale?: string }>): string => {
    return questions
      .map((q, idx) => {
        let text = `${idx + 1}. ${q.question}`;
        if (q.rationale) {
          text += `\n   ${q.rationale}`;
        }
        return text;
      })
      .join('\n\n');
  };

  // Canonical output projections (keep UI structure the same; just swap data source)
  const fullSection = activeJobPost?.sections.find((s) => s.key === 'full');
  const fullContent =
    editingKey === 'full'
      ? draftText
      : fullSection
        ? getSectionContent(fullSection)
        : '';

  const jobDescriptionDisplaySections = (() => {
    const parts = fullContent ? fullContent.split('\n\n') : [];
    const pairs: Array<{ title: string; body: string }> = [];
    for (let i = 0; i < parts.length; i += 2) {
      const title = (parts[i] ?? '').trim();
      const body = parts[i + 1] ?? '';
      if (!title && !body) continue;
      pairs.push({ title: title || 'Job Description', body });
    }
    return pairs;
  })();

  const screeningSection = activeJobPost?.sections.find((s) => s.key === 'summary');
  const screeningContentStable = screeningSection
    ? getSectionContent(screeningSection)
    : '';
  const screeningContent =
    editingKey === 'summary' ? draftText : screeningContentStable;
  const screeningItems = (() => {
    const blocks = screeningContentStable ? screeningContentStable.split('\n\n') : [];
    return blocks
      .map((block) => {
        const [firstLine, ...rest] = block.split('\n');
        const question = (firstLine ?? '').replace(/^\d+\.\s*/, '').trim();
        const rationale = rest.join('\n').replace(/^\s+/, '').trim();
        return { question, rationale: rationale || undefined };
      })
      .filter((q) => q.question);
  })();

  const interviewSection = activeJobPost?.sections.find((s) => s.key === 'indeed');
  const interviewContentStable = interviewSection
    ? getSectionContent(interviewSection)
    : '';
  const interviewContent =
    editingKey === 'indeed' ? draftText : interviewContentStable;
  const interviewItems = (() => {
    const blocks = interviewContentStable ? interviewContentStable.split('\n\n') : [];
    return blocks
      .map((block) => {
        const [firstLine, ...rest] = block.split('\n');
        const question = (firstLine ?? '').replace(/^\d+\.\s*/, '').trim();
        const rationale = rest.join('\n').replace(/^\s+/, '').trim();
        return { question, rationale: rationale || undefined };
      })
      .filter((q) => q.question);
  })();

  const careersSection = activeJobPost?.sections.find((s) => s.key === 'careersPage');
  const careersContentStable = careersSection ? getSectionContent(careersSection) : '';
  const benefitsItems = (() => {
    const m = careersContentStable.match(
      /Benefits Highlight:\n([\s\S]*?)(?:\n\nApplication Instructions:|$)/,
    );
    const block = (m?.[1] ?? '').trim();
    if (!block) return [];
    return block
      .split('\n')
      .map((line) => line.replace(/^\-\s*/, '').trim())
      .filter(Boolean);
  })();
  const applicationInstructions = (() => {
    const m = careersContentStable.match(/Application Instructions:\n([\s\S]*)$/);
    return (m?.[1] ?? '').trim();
  })();

  const socialSection = activeJobPost?.sections.find((s) => s.key === 'social');
  const socialContentStable = socialSection ? getSectionContent(socialSection) : '';
  const socialPosts = (() => {
    if (!socialContentStable.trim()) return [];
    const chunks = socialContentStable.split(/\n\n(?=\[)/).filter(Boolean);
    return chunks
      .map((chunk) => {
        const [firstLine, ...restLines] = chunk.split('\n');
        const platform = (firstLine ?? '').replace(/^\[|\]$/g, '').trim();
        const restText = restLines.join('\n').trim();
        const parts = restText ? restText.split('\n\n') : [];
        const headline = (parts[0] ?? '').trim();
        const callToAction = (parts[parts.length - 1] ?? '').trim();
        const body = parts.slice(1, -1).join('\n\n').trim();
        return { platform, headline, body, callToAction };
      })
      .filter((p) => p.platform && p.headline);
  })();

  const hasEditedOverrides =
    !!activeJobPost &&
    activeJobPost.sections.some((s) => isEditedBadgeVisible(s));
  // Allow global reset to also clear an in-progress edit session, even if it hasn't been saved yet.
  const hasDirtyDraft = editingKey !== null;
  const canResetEdits = !!activeJobPost && (hasEditedOverrides || hasDirtyDraft);

  const socialHandoffText = (() => {
    const section = activeJobPost?.sections.find((s) => s.key === 'social');
    return section ? getSectionContent(section).trim() : '';
  })();

  const canCreateHiringPostDraft =
    !!activeJobPost && !!businessId && !!socialHandoffText && exportCheck.ok;

  const careersPageHandoffText = (() => {
    const section = activeJobPost?.sections.find((s) => s.key === 'careersPage');
    return section ? getSectionContent(section).trim() : '';
  })();

  const canTurnIntoCareersPageDraft =
    !!activeJobPost && !!businessId && !!careersPageHandoffText && exportCheck.ok;

  const handleCreateHiringPostDraft = () => {
    if (!activeJobPost) return;
    const check = canExportJobPost(activeJobPost);
    if (!check.ok) {
      setError(check.reason || 'Nothing to hand off yet. Generate the campaign first.');
      return;
    }
    if (!businessId) {
      setError('Business ID not found. Add ?businessId=... to the URL to enable handoff.');
      return;
    }

    if (!socialHandoffText) {
      setError('No social post content available to send yet. Generate the campaign first.');
      return;
    }

    const headline = `Hiring: ${formValues.roleTitle || 'Now Hiring'}`;
    const location = `${formValues.city || 'Ocala'}, ${formValues.state || 'Florida'}`;

    // Use stable fields for duplicate safety (receiver also does its own checks)
    const stableCreatedAt =
      Date.parse(activeJobPost.createdAt) || Date.now();

    const payload: SocialAutoPosterHandoffPayload & {
      draftId: string;
      businessId: string;
      jobTitle: string;
      location: string;
      handoffKey: string;
    } = {
      type: 'social_auto_poster_import',
      // Use an accepted sourceApp so the existing receiver can import without changes
      sourceApp: 'offers-builder',
      campaignType: 'offer',
      headline,
      description: socialHandoffText,
      suggestedCTA: 'Apply now',
      meta: {
        sourceApp: 'offers-builder',
        createdAt: stableCreatedAt,
      },
      // Extra metadata for future receiver improvements + audit/debugging
      draftId: activeJobPost.id,
      businessId,
      jobTitle: formValues.roleTitle || '',
      location,
      handoffKey: HANDOFF_KEY,
    };

    // TTL: 15 minutes
    try {
      writeHandoff('local-hiring-assistant', payload, 15 * 60 * 1000);
    } catch {
      setError('Failed to prepare the handoff. Please try again.');
      return;
    }

    const dest = `/apps/social-auto-poster/composer?handoff=1&businessId=${encodeURIComponent(
      businessId,
    )}`;
    const w = window.open(dest, '_blank', 'noopener,noreferrer');
    if (!w) {
      setError('Popup blocked. Please allow popups for this site to open Social Auto-Poster.');
    }
  };

  const handleTurnIntoCareersPageDraft = () => {
    if (!activeJobPost) return;
    const check = canExportJobPost(activeJobPost);
    if (!check.ok) {
      setError(check.reason || 'Nothing to hand off yet. Generate the campaign first.');
      return;
    }
    if (!businessId) {
      setError('Business ID not found. Add ?businessId=... to the URL to enable handoff.');
      return;
    }

    if (!careersPageHandoffText) {
      setError('No careers page content available to send yet. Generate the campaign first.');
      return;
    }

    const titleSuggestion = `${formValues.roleTitle || 'Now Hiring'} — Careers`;

    const payload = {
      sourceApp: 'local-hiring-assistant' as const,
      contentType: 'careersPage' as const,
      createdAt: Date.now(),
      draftId: activeJobPost.id,
      businessId,
      titleSuggestion,
      text: careersPageHandoffText,
      meta: {
        jobTitle: formValues.roleTitle || '',
        location: `${formValues.city || 'Ocala'}, ${formValues.state || 'Florida'}`,
      },
    };

    // TTL: 15 minutes
    try {
      writeHandoff('local-hiring-assistant-to-content-writer', payload, 15 * 60 * 1000);
    } catch {
      setError('Failed to prepare the handoff. Please try again.');
      return;
    }

    const dest = `/apps/content-writer?handoff=1&businessId=${encodeURIComponent(
      businessId,
    )}`;
    const w = window.open(dest, '_blank', 'noopener,noreferrer');
    if (!w) {
      setError('Popup blocked. Please allow popups for this site to open AI Content Writer.');
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? 'light' : 'dark')}
      title="Local Hiring Assistant"
      tagline="Generate a complete job description and local hiring campaign for your next role — in minutes."
    >
      <div className="mt-7">
        {/* Single column – form + results */}
          <OBDPanel isDark={isDark}>
            <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
            {/* Feature 1: Preset Role Templates */}
            <div className="mb-6">
              <label
                htmlFor="roleTemplate"
                className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
              >
                Quick Start: Choose a Role Template (Optional)
              </label>
              <select
                id="roleTemplate"
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  if (e.target.value) {
                    const template = roleTemplates.find(
                      (t) => t.name === e.target.value,
                    );
                    if (template) {
                      applyTemplate(template);
                    }
                  }
                }}
                className={getInputClasses(isDark)}
              >
                <option value="">Start from scratch</option>
                {roleTemplates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.name}
                  </option>
                ))}
              </select>
              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                Select a template to pre-fill common fields for this role type.
              </p>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleClearForm}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    isDark
                      ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Clear Form
                </button>
                {/* Feature 8: Multi-role support - Save/Load configurations */}
                <button
                  type="button"
                  onClick={handleSaveConfiguration}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    isDark
                      ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Save Configuration
                </button>
                {savedConfigurations.length > 0 && (
                  <div className="relative group">
                    <button
                      type="button"
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Load Saved ({savedConfigurations.length}) ▼
                    </button>
                    <div className="absolute left-0 mt-1 hidden group-hover:block z-10 min-w-[200px]">
                      <div
                        className={`rounded shadow-lg border p-2 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {savedConfigurations.map((config, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 mb-1 last:mb-0"
                          >
                            <button
                              type="button"
                              onClick={() => handleLoadConfiguration(config)}
                              className={`flex-1 text-left px-2 py-1 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                                isDark ? 'text-white' : 'text-slate-700'
                              }`}
                            >
                              {config.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteConfiguration(idx)}
                              className="text-red-500 hover:text-red-700 text-xs px-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <span className={`text-xs ${themeClasses.mutedText} block`}>
                Auto-saves locally • Draft-only exports • Press Esc to clear • Ctrl/Cmd+K to focus first field
              </span>
            </div>

            <form ref={formRef} onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Input Accordion (UI-only) */}
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={expandAllFormAccordion}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Expand all input sections"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllFormAccordion}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Collapse input sections (keeps Job Basics open)"
                  >
                    Collapse
                  </button>
                </div>

                {/* Job Basics (default open) */}
                <div
                  className={`rounded-xl border ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Job Basics
                      </h3>
                      {!formAccordionState.jobBasics && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getJobBasicsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFormAccordion('jobBasics')}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {formAccordionState.jobBasics ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  {formAccordionState.jobBasics && (
                    <div className="px-4 pb-4 space-y-4">
                      <div>
                        <label
                          htmlFor="businessName"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Business Name <span className="text-red-500">*</span>
                          {/* Feature 6: Inline Field Help Text */}
                          <button
                            type="button"
                            onClick={() => {
                              const help = document.getElementById('help-businessName');
                              if (help) {
                                help.classList.toggle('hidden');
                              }
                            }}
                            className="ml-2 text-xs text-[#29c4a9] hover:underline"
                          >
                            ?
                          </button>
                        </label>
                        <div
                          id="help-businessName"
                          className="hidden mb-2 p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs"
                        >
                          <strong>What to enter:</strong> Your business's official name as it appears to customers.
                          <br />
                          <strong>Example:</strong> "Tranquil Touch Massage" or "Ocala Auto Repair"
                          <br />
                          <strong>Why it matters:</strong> This personalizes the job description and makes it feel authentic.
                        </div>
                        <input
                          ref={firstInputRef}
                          type="text"
                          id="businessName"
                          value={formValues.businessName}
                          onChange={(e) =>
                            updateFormValue('businessName', e.target.value)
                          }
                          onBlur={() => validateField('businessName')}
                          className={`${getInputClasses(isDark)} ${
                            fieldErrors.businessName ? 'border-red-500' : ''
                          }`}
                          placeholder="Example: Tranquil Touch Massage"
                          required
                        />
                        {fieldErrors.businessName && (
                          <p className="mt-1 text-xs text-red-500">
                            {fieldErrors.businessName}
                          </p>
                        )}
                        <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                          We'll use this to personalize your job description.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="businessType"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Business Type <span className="text-red-500">*</span>
                          <button
                            type="button"
                            onClick={() => {
                              const help = document.getElementById('help-businessType');
                              if (help) {
                                help.classList.toggle('hidden');
                              }
                            }}
                            className="ml-2 text-xs text-[#29c4a9] hover:underline"
                          >
                            ?
                          </button>
                        </label>
                        <div
                          id="help-businessType"
                          className="hidden mb-2 p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs"
                        >
                          <strong>What to enter:</strong> A short description of your business category.
                          <br />
                          <strong>Examples:</strong> "Massage Spa", "Auto Repair Shop", "Restaurant", "Medical Office"
                          <br />
                          <strong>Why it matters:</strong> Helps the AI understand your industry and generate appropriate content.
                        </div>
                        <input
                          type="text"
                          id="businessType"
                          value={formValues.businessType}
                          onChange={(e) =>
                            updateFormValue('businessType', e.target.value)
                          }
                          onBlur={() => validateField('businessType')}
                          className={`${getInputClasses(isDark)} ${
                            fieldErrors.businessType ? 'border-red-500' : ''
                          }`}
                          placeholder="Example: Massage Spa, Auto Repair, Restaurant"
                          required
                        />
                        {fieldErrors.businessType && (
                          <p className="mt-1 text-xs text-red-500">
                            {fieldErrors.businessType}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="roleTitle"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Role Title <span className="text-red-500">*</span>
                          <button
                            type="button"
                            onClick={() => {
                              const help = document.getElementById('help-roleTitle');
                              if (help) {
                                help.classList.toggle('hidden');
                              }
                            }}
                            className="ml-2 text-xs text-[#29c4a9] hover:underline"
                          >
                            ?
                          </button>
                        </label>
                        <div
                          id="help-roleTitle"
                          className="hidden mb-2 p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs"
                        >
                          <strong>What to enter:</strong> The exact job title you're hiring for.
                          <br />
                          <strong>Examples:</strong> "Licensed Massage Therapist", "Front Desk Receptionist", "Server"
                          <br />
                          <strong>Why it matters:</strong> This is the primary identifier for the position and appears in all generated content.
                        </div>
                        <input
                          type="text"
                          id="roleTitle"
                          value={formValues.roleTitle}
                          onChange={(e) =>
                            updateFormValue('roleTitle', e.target.value)
                          }
                          onBlur={() => validateField('roleTitle')}
                          className={`${getInputClasses(isDark)} ${
                            fieldErrors.roleTitle ? 'border-red-500' : ''
                          }`}
                          placeholder="Example: Licensed Massage Therapist"
                          required
                        />
                        {fieldErrors.roleTitle && (
                          <p className="mt-1 text-xs text-red-500">
                            {fieldErrors.roleTitle}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="city"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            City
                          </label>
                          <input
                            type="text"
                            id="city"
                            value={formValues.city ?? ''}
                            onChange={(e) =>
                              updateFormValue('city', e.target.value)
                            }
                            className={getInputClasses(isDark)}
                            placeholder="Ocala"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="state"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            State
                          </label>
                          <input
                            type="text"
                            id="state"
                            value={formValues.state ?? ''}
                            onChange={(e) =>
                              updateFormValue('state', e.target.value)
                            }
                            className={getInputClasses(isDark)}
                            placeholder="Florida"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="services"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Services (Optional)
                        </label>
                        <textarea
                          id="services"
                          value={getCommaListText('services')}
                          onChange={(e) =>
                            handleCommaListTextChange('services', e.target.value)
                          }
                          onBlur={() => handleCommaListBlur('services')}
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Deep tissue massage, Swedish massage, Couples massage"
                        />
                        <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                          List services separated by commas.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Role Details */}
                <div
                  className={`rounded-xl border ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Role Details
                      </h3>
                      {!formAccordionState.roleDetails && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getRoleDetailsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFormAccordion('roleDetails')}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {formAccordionState.roleDetails ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  {formAccordionState.roleDetails && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="workLocationType"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Work Location
                          </label>
                          <select
                            id="workLocationType"
                            value={formValues.workLocationType}
                            onChange={(e) =>
                              updateFormValue(
                                'workLocationType',
                                e.target.value as WorkLocationType,
                              )
                            }
                            className={getInputClasses(isDark)}
                          >
                            {workLocationTypes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="department"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Department (Optional)
                          </label>
                          <input
                            type="text"
                            id="department"
                            value={formValues.department ?? ''}
                            onChange={(e) =>
                              updateFormValue('department', e.target.value)
                            }
                            className={getInputClasses(isDark)}
                            placeholder="Example: Massage Therapy"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="responsibilities"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Key Responsibilities (Optional)
                        </label>
                        <textarea
                          id="responsibilities"
                          value={getCommaListText('responsibilities')}
                          onChange={(e) =>
                            handleCommaListTextChange(
                              'responsibilities',
                              e.target.value,
                            )
                          }
                          onBlur={() => handleCommaListBlur('responsibilities')}
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Provide 60- and 90-minute massage sessions, Maintain clean treatment room"
                        />
                        <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                          List responsibilities separated by commas.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pay & Schedule */}
                <div
                  className={`rounded-xl border ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Pay &amp; Schedule
                      </h3>
                      {!formAccordionState.paySchedule && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getPayScheduleSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFormAccordion('paySchedule')}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {formAccordionState.paySchedule ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  {formAccordionState.paySchedule && (
                    <div className="px-4 pb-4 space-y-4">
                      <div>
                        <label
                          htmlFor="employmentType"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Employment Type
                        </label>
                        <select
                          id="employmentType"
                          value={formValues.employmentType}
                          onChange={(e) =>
                            updateFormValue(
                              'employmentType',
                              e.target.value as EmploymentType,
                            )
                          }
                          className={getInputClasses(isDark)}
                        >
                          {employmentTypes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="scheduleDetails"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Schedule Details (Optional)
                        </label>
                        <input
                          type="text"
                          id="scheduleDetails"
                          value={formValues.scheduleDetails ?? ''}
                          onChange={(e) =>
                            updateFormValue('scheduleDetails', e.target.value)
                          }
                          className={getInputClasses(isDark)}
                          placeholder="Example: Mon–Fri, 9am–5pm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="compensationDetails"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Compensation Details (Optional)
                        </label>
                        <input
                          type="text"
                          id="compensationDetails"
                          value={formValues.compensationDetails ?? ''}
                          onChange={(e) =>
                            updateFormValue(
                              'compensationDetails',
                              e.target.value,
                            )
                          }
                          className={getInputClasses(isDark)}
                          placeholder="Example: Hourly + tips, details discussed in interview"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirements & Qualifications */}
                <div
                  className={`rounded-xl border ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Requirements &amp; Qualifications
                      </h3>
                      {!formAccordionState.requirements && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getRequirementsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFormAccordion('requirements')}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {formAccordionState.requirements ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  {formAccordionState.requirements && (
                    <div className="px-4 pb-4 space-y-4">
                      <div>
                        <label
                          htmlFor="experienceLevel"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Experience Level (Optional)
                        </label>
                        <input
                          type="text"
                          id="experienceLevel"
                          value={formValues.experienceLevel ?? ''}
                          onChange={(e) =>
                            updateFormValue('experienceLevel', e.target.value)
                          }
                          className={getInputClasses(isDark)}
                          placeholder="Example: 2+ years in professional spa setting"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="mustHaveSkills"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Must-Have Skills (Optional)
                        </label>
                        <textarea
                          id="mustHaveSkills"
                          value={getCommaListText('mustHaveSkills')}
                          onChange={(e) =>
                            handleCommaListTextChange(
                              'mustHaveSkills',
                              e.target.value,
                            )
                          }
                          onBlur={() => handleCommaListBlur('mustHaveSkills')}
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Active Florida massage license, Strong client communication skills"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="niceToHaveSkills"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Nice-to-Have Skills (Optional)
                        </label>
                        <textarea
                          id="niceToHaveSkills"
                          value={getCommaListText('niceToHaveSkills')}
                          onChange={(e) =>
                            handleCommaListTextChange(
                              'niceToHaveSkills',
                              e.target.value,
                            )
                          }
                          onBlur={() => handleCommaListBlur('niceToHaveSkills')}
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Experience with hot stone therapy, Knowledge of aromatherapy"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="certifications"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Certifications (Optional)
                        </label>
                        <textarea
                          id="certifications"
                          value={getCommaListText('certifications')}
                          onChange={(e) =>
                            handleCommaListTextChange(
                              'certifications',
                              e.target.value,
                            )
                          }
                          onBlur={() => handleCommaListBlur('certifications')}
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Florida Massage License, CPR Certification"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Company Voice & Culture */}
                <div
                  className={`rounded-xl border ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Company Voice &amp; Culture
                      </h3>
                      {!formAccordionState.companyVoice && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getCompanyVoiceSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFormAccordion('companyVoice')}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {formAccordionState.companyVoice ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  {formAccordionState.companyVoice && (
                    <div className="px-4 pb-4 space-y-4">
                      <div>
                        <label
                          htmlFor="aboutCompany"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          About the Company (Optional)
                        </label>
                        <textarea
                          id="aboutCompany"
                          value={formValues.aboutCompany ?? ''}
                          onChange={(e) =>
                            updateFormValue('aboutCompany', e.target.value)
                          }
                          rows={3}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="We are a locally owned spa focused on stress relief and wellness for the Ocala community."
                        />
                        {/* Feature 3: Character count indicator */}
                        <p
                          className={`mt-1 text-xs text-right ${getCharacterCountClass(
                            getCharacterCount(formValues.aboutCompany ?? ''),
                          )}`}
                        >
                          {getCharacterCount(formValues.aboutCompany ?? '')} characters
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="idealCandidateProfile"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Ideal Candidate Profile (Optional)
                        </label>
                        <textarea
                          id="idealCandidateProfile"
                          value={formValues.idealCandidateProfile ?? ''}
                          onChange={(e) =>
                            updateFormValue(
                              'idealCandidateProfile',
                              e.target.value,
                            )
                          }
                          rows={3}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Someone who loves building long-term client relationships and creating a calming experience."
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="brandVoice"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Brand Voice (Optional)
                        </label>
                        <textarea
                          id="brandVoice"
                          value={formValues.brandVoice ?? ''}
                          onChange={(e) =>
                            updateFormValue('brandVoice', e.target.value)
                          }
                          rows={3}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Paste core brand guidelines or describe your tone (e.g., Warm, friendly, and professional)"
                        />
                        {/* Feature 3: Character count indicator */}
                        <p
                          className={`mt-1 text-xs text-right ${getCharacterCountClass(
                            getCharacterCount(formValues.brandVoice ?? ''),
                          )}`}
                        >
                          {getCharacterCount(formValues.brandVoice ?? '')} characters
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="personalityStyle"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Personality Style
                          </label>
                          <select
                            id="personalityStyle"
                            value={formValues.personalityStyle}
                            onChange={(e) =>
                              updateFormValue(
                                'personalityStyle',
                                e.target.value as PersonalityStyle,
                              )
                            }
                            className={getInputClasses(isDark)}
                          >
                            {personalityStyles.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="language"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Language
                          </label>
                          <select
                            id="language"
                            value={formValues.language}
                            onChange={(e) =>
                              updateFormValue(
                                'language',
                                e.target.value as LanguageOption,
                              )
                            }
                            className={getInputClasses(isDark)}
                          >
                            {languages.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Posting Goals & Channels */}
                <div
                  className={`rounded-xl border ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Posting Goals &amp; Channels
                      </h3>
                      {!formAccordionState.postingGoals && (
                        <p className={`text-xs mt-1 truncate ${themeClasses.mutedText}`}>
                          {getPostingGoalsSummary()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFormAccordion('postingGoals')}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {formAccordionState.postingGoals ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  {formAccordionState.postingGoals && (
                    <div className="px-4 pb-4 space-y-4">
                      <div>
                        <label
                          htmlFor="benefits"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Benefits (Optional)
                        </label>
                        <textarea
                          id="benefits"
                          value={getCommaListText('benefits')}
                          onChange={(e) =>
                            handleCommaListTextChange('benefits', e.target.value)
                          }
                          onBlur={() => handleCommaListBlur('benefits')}
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Employee discounts, Flexible scheduling, Supportive team culture"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="hiringGoals"
                          className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Hiring Goals (Optional)
                        </label>
                        <textarea
                          id="hiringGoals"
                          value={formValues.hiringGoals ?? ''}
                          onChange={(e) =>
                            updateFormValue('hiringGoals', e.target.value)
                          }
                          rows={2}
                          className={getInputClasses(isDark, 'resize-none')}
                          placeholder="Fill this role within 30 days, attract more local candidates"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="jobPostLength"
                            className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                          >
                            Job Post Length
                          </label>
                          <select
                            id="jobPostLength"
                            value={formValues.jobPostLength}
                            onChange={(e) =>
                              updateFormValue(
                                'jobPostLength',
                                e.target.value as JobPostLength,
                              )
                            }
                            className={getInputClasses(isDark)}
                          >
                            {jobPostLengths.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <p
                          className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}
                        >
                          Output Options
                        </p>
                        <div className="space-y-2">
                          <label
                            className={`flex items-center gap-2 ${themeClasses.labelText}`}
                          >
                            <input
                              type="checkbox"
                              checked={formValues.includeShortJobPostPack}
                              onChange={(e) =>
                                updateFormValue(
                                  'includeShortJobPostPack',
                                  e.target.checked,
                                )
                              }
                              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                            />
                            <span className="text-sm">
                              Include short social job post pack
                            </span>
                          </label>
                          <label
                            className={`flex items-center gap-2 ${themeClasses.labelText}`}
                          >
                            <input
                              type="checkbox"
                              checked={formValues.includeScreeningQuestions}
                              onChange={(e) =>
                                updateFormValue(
                                  'includeScreeningQuestions',
                                  e.target.checked,
                                )
                              }
                              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                            />
                            <span className="text-sm">
                              Include screening questions
                            </span>
                          </label>
                          <label
                            className={`flex items-center gap-2 ${themeClasses.labelText}`}
                          >
                            <input
                              type="checkbox"
                              checked={formValues.includeInterviewQuestions}
                              onChange={(e) =>
                                updateFormValue(
                                  'includeInterviewQuestions',
                                  e.target.checked,
                                )
                              }
                              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                            />
                            <span className="text-sm">
                              Include interview questions
                            </span>
                          </label>
                          <label
                            className={`flex items-center gap-2 ${themeClasses.labelText}`}
                          >
                            <input
                              type="checkbox"
                              checked={formValues.includeBenefitsHighlight}
                              onChange={(e) =>
                                updateFormValue(
                                  'includeBenefitsHighlight',
                                  e.target.checked,
                                )
                              }
                              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                            />
                            <span className="text-sm">
                              Include benefits highlight section
                            </span>
                          </label>
                          <label
                            className={`flex items-center gap-2 ${themeClasses.labelText}`}
                          >
                            <input
                              type="checkbox"
                              checked={formValues.includeApplicationInstructions}
                              onChange={(e) =>
                                updateFormValue(
                                  'includeApplicationInstructions',
                                  e.target.checked,
                                )
                              }
                              className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                            />
                            <span className="text-sm">
                              Include application instructions
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {error && !loading && (
                  <div className={getErrorPanelClasses(isDark)}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
            </form>

            {/* Results section - below the form */}
            {loading && (
              <div className="mt-8">
                <ResultCard
                  title="Generating hiring campaign..."
                  isDark={isDark}
                >
                  {/* Feature 9: Loading progress indicator */}
                  <div className="space-y-2">
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      {loadingStep || 'Building your job description and local hiring content...'}
                    </p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-[#29c4a9] h-2 rounded-full transition-all duration-300 animate-pulse"
                        style={{ width: '60%' }}
                      ></div>
                    </div>
                    <p className={`text-xs ${themeClasses.mutedText}`}>
                      This usually takes a few seconds.
                    </p>
                  </div>
                </ResultCard>
              </div>
            )}

            {!activeJobPost && !loading && (
              <div className="mt-8">
                <p className={`text-sm text-center ${themeClasses.mutedText}`}>
                  Fill in the details above and click "Generate hiring campaign"
                  to see your results here.
                </p>
              </div>
            )}

            {activeJobPost && (
              <div className="mt-8 space-y-6">
                <p className={`text-xs ${themeClasses.mutedText}`}>
                  Edits are saved locally for this draft. Reset removes your override.
                </p>
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={expandAllOutputs}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Expand all output sections"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllOutputs}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      isDark
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Collapse all output sections"
                  >
                    Collapse all
                  </button>
                </div>

                {/* AI Help Desk awareness banner (read-only) */}
                <div
                  className={`rounded-xl border p-4 flex items-start justify-between gap-4 flex-wrap ${
                    isDark
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm ${isDark ? 'text-slate-100' : 'text-slate-700'}`}
                    >
                      This job draft can be referenced in AI Help Desk when customers ask about hiring.
                    </p>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Tip: Use “Generate Again” to create a new version without losing prior drafts.
                    </p>
                  </div>
                  <a
                    href="/apps/ai-help-desk"
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Open AI Help Desk
                  </a>
                </div>

                {/* Versions panel (select active draft) */}
                {sortedJobPosts.length > 0 && (
                  <div
                    className={`rounded-xl border p-3 ${
                      isDark
                        ? 'bg-slate-800/50 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Versions
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${themeClasses.mutedText}`}>
                          {activeJobPostId ? 'Manual selection' : 'Auto-selected'}
                        </span>
                        {activeJobPostId && (
                          <button
                            type="button"
                            onClick={() => setActiveJobPostId(null)}
                            className={`text-xs underline ${
                              isDark ? 'text-slate-200' : 'text-slate-700'
                            }`}
                            title="Clear manual selection (auto-pick most recent)"
                          >
                            Switch to Auto
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {sortedJobPosts.map((post) => {
                        const isActive = post.id === activeJobPost.id;
                        const parts = getJobPostLabelParts(post);
                        const st = getJobPostStatus(post);

                        return (
                          <div
                            key={post.id}
                            onClick={() => setActiveJobPostId(post.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveJobPostId(post.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`w-full text-left rounded-lg px-2 py-2 transition-colors border ${
                              isActive
                                ? isDark
                                  ? 'bg-slate-700/60 border-slate-600'
                                  : 'bg-white border-slate-300'
                                : isDark
                                  ? 'bg-transparent border-transparent hover:bg-slate-800/60'
                                  : 'bg-transparent border-transparent hover:bg-white'
                            }`}
                            title={post.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div
                                  className={`text-sm font-medium truncate ${
                                    isDark ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {parts.jobTitle} • {parts.location}
                                  {parts.time ? ` • ${parts.time}` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isActive && (
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                      isDark
                                        ? 'border-slate-600 text-slate-200 bg-slate-800/40'
                                        : 'border-slate-200 text-slate-700 bg-white'
                                    }`}
                                    title={
                                      activeJobPostId
                                        ? 'Manually selected version'
                                        : 'Auto-selected (most recent)'
                                    }
                                  >
                                    Active
                                  </span>
                                )}
                                <span className={getStatusChipClasses(st)}>{st}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteJobPostVersion(post.id);
                                  }}
                                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                                    isDark
                                      ? 'border-slate-600 text-slate-200 hover:bg-slate-700'
                                      : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                  title="Delete this version"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-xl border p-4 ${
                    isDark
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h4
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Create Hiring Post
                      </h4>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Send to Social Auto-Poster as a draft
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateHiringPostDraft}
                      disabled={!canCreateHiringPostDraft}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-slate-700 text-white hover:bg-slate-600'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      } disabled:opacity-50`}
                      title={
                        !businessId
                          ? 'Missing businessId (add ?businessId=... to the URL)'
                          : !socialHandoffText
                            ? 'No social post content yet (generate first)'
                            : 'Open Social Auto-Poster composer with a draft'
                      }
                    >
                      Create Hiring Post →
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    isDark
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h4
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Turn into a Careers Page
                      </h4>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        Sends to AI Content Writer as a draft (apply-only)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTurnIntoCareersPageDraft}
                      disabled={!canTurnIntoCareersPageDraft}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-slate-700 text-white hover:bg-slate-600'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      } disabled:opacity-50`}
                      title={
                        !businessId
                          ? 'Missing businessId (add ?businessId=... to the URL)'
                          : !careersPageHandoffText
                            ? 'No careers page content yet (generate first)'
                            : 'Open AI Content Writer with a draft (apply-only)'
                      }
                    >
                      Turn into a Careers Page →
                    </button>
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                        Full Job Description
                      </h3>
                      {isEditedBadgeVisible(fullSection) && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            isDark
                              ? 'border-emerald-700/60 text-emerald-300 bg-emerald-900/20'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                          }`}
                        >
                          Edited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {fullSection &&
                        isEditedBadgeVisible(fullSection) &&
                        editingKey !== 'full' && (
                          <button
                            type="button"
                            onClick={() => toggleCompare('full')}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                            title="Compare generated vs edited"
                          >
                            {isComparing('full') ? 'Hide' : 'Compare'}
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => handleCopy('full', fullSection ?? null)}
                        disabled={!activeJobPost || !fullSection}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          copiedKey === 'full'
                            ? 'bg-[#29c4a9] text-white'
                            : isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        } disabled:opacity-50`}
                      >
                        {copiedKey === 'full' ? 'Copied!' : 'Copy'}
                      </button>
                      {editingKey === 'full' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit('full')}
                            className={`text-xs px-2 py-1 rounded font-medium ${
                              isDark
                                ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500'
                            }`}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEdit('full')}
                          disabled={
                            !activeJobPost ||
                            !fullSection ||
                            editingKey !== null
                          }
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          } disabled:opacity-50`}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => resetSectionToGenerated('full')}
                        disabled={
                          !activeJobPost ||
                          (!fullSection?.edited && editingKey !== 'full')
                        }
                        className={`text-xs px-2 py-1 rounded ${
                          isDark
                            ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        } disabled:opacity-50`}
                        title="Reset back to the original generated section"
                      >
                        Reset
                      </button>
                      {/* Feature 12: Collapse/Expand */}
                      <button
                        type="button"
                        onClick={() => toggleSection('jobDescription')}
                        className={`text-xs px-2 py-1 rounded ${
                          isDark
                            ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {collapsedSections.has('jobDescription') ? '▼' : '▲'}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('jobDescription') && (
                    <ResultCard
                      title=""
                      isDark={isDark}
                    >
                  <div className="mb-3">
                    <p className={`text-xs ${themeClasses.mutedText}`}>
                      {formValues.roleTitle} · {formValues.businessName} ·{' '}
                      {(formValues.city || 'Ocala')}, {formValues.state || 'Florida'}
                    </p>
                  </div>
                  {fullSection &&
                  isEditedBadgeVisible(fullSection) &&
                  isComparing('full') &&
                  editingKey !== 'full' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          Generated vs edited (read-only)
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetSectionToGenerated('full');
                              closeCompare('full');
                            }}
                            className={`text-xs px-2 py-1 rounded font-medium ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                            title="Use generated content for this section"
                          >
                            Use Generated
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeCompare('full');
                              beginEdit('full');
                            }}
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      <ResultCard title="Generated" isDark={isDark}>
                        <p
                          className={`whitespace-pre-line ${
                            isDark ? 'text-slate-100' : 'text-slate-700'
                          }`}
                        >
                          {fullSection.generated}
                        </p>
                      </ResultCard>
                      <ResultCard title="Edited" isDark={isDark}>
                        <p
                          className={`whitespace-pre-line ${
                            isDark ? 'text-slate-100' : 'text-slate-700'
                          }`}
                        >
                          {fullSection.edited ?? ''}
                        </p>
                      </ResultCard>
                    </div>
                  ) : editingKey === 'full' ? (
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={14}
                      className={getInputClasses(isDark, 'min-h-[420px] resize-y')}
                      placeholder="Edit the full job description…"
                    />
                  ) : (
                    <div className="space-y-4">
                      {jobDescriptionDisplaySections.map((section, idx) => (
                        <div key={idx}>
                          <h4
                            className={`text-sm font-semibold mb-2 ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {section.title}
                          </h4>
                          <p
                            className={`whitespace-pre-line ${
                              isDark ? 'text-slate-100' : 'text-slate-700'
                            }`}
                          >
                            {section.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                    </ResultCard>
                  )}
                </div>

                {/* Short Job Post Pack */}
                {(!!socialSection &&
                  (socialContentStable.trim().length > 0 || editingKey === 'social')) && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-lg font-semibold ${themeClasses.headingText}`}
                          >
                            Short Job Post Pack
                          </h3>
                          {isEditedBadgeVisible(socialSection) && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                isDark
                                  ? 'border-emerald-700/60 text-emerald-300 bg-emerald-900/20'
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              }`}
                            >
                              Edited
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {socialSection &&
                            isEditedBadgeVisible(socialSection) &&
                            editingKey !== 'social' && (
                              <button
                                type="button"
                                onClick={() => toggleCompare('social')}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                                title="Compare generated vs edited"
                              >
                                {isComparing('social') ? 'Hide' : 'Compare'}
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy('social', socialSection ?? null)
                            }
                            disabled={!activeJobPost || !socialSection}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              copiedKey === 'social'
                                ? 'bg-[#29c4a9] text-white'
                                : isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            {copiedKey === 'social' ? 'Copied!' : 'Copy'}
                          </button>
                          {editingKey === 'social' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit('social')}
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  isDark
                                    ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                }`}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className={`text-xs px-2 py-1 rounded ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit('social')}
                              disabled={
                                !activeJobPost ||
                                !socialSection ||
                                editingKey !== null
                              }
                              className={`text-xs px-2 py-1 rounded ${
                                isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              } disabled:opacity-50`}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => resetSectionToGenerated('social')}
                            disabled={
                              !activeJobPost ||
                              (!socialSection?.edited && editingKey !== 'social')
                            }
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            Reset
                          </button>
                        <button
                          type="button"
                          onClick={() => toggleSection('shortJobPostPack')}
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {collapsedSections.has('shortJobPostPack') ? '▼' : '▲'}
                        </button>
                        </div>
                      </div>
                      {!collapsedSections.has('shortJobPostPack') && (
                        <>
                          <p className={`mb-4 text-xs ${themeClasses.mutedText}`}>
                            Ready-to-paste posts for your top platforms.
                          </p>
                          <ResultCard
                            title=""
                            isDark={isDark}
                          >
                            {socialSection &&
                            isEditedBadgeVisible(socialSection) &&
                            isComparing('social') &&
                            editingKey !== 'social' ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <p className={`text-xs ${themeClasses.mutedText}`}>
                                    Generated vs edited (read-only)
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        resetSectionToGenerated('social');
                                        closeCompare('social');
                                      }}
                                      className={`text-xs px-2 py-1 rounded font-medium ${
                                        isDark
                                          ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                      }`}
                                    >
                                      Use Generated
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        closeCompare('social');
                                        beginEdit('social');
                                      }}
                                      className={`text-xs px-2 py-1 rounded ${
                                        isDark
                                          ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                      }`}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>

                                <ResultCard title="Generated" isDark={isDark}>
                                  <p
                                    className={`whitespace-pre-line ${
                                      isDark ? 'text-slate-100' : 'text-slate-700'
                                    }`}
                                  >
                                    {socialSection.generated}
                                  </p>
                                </ResultCard>
                                <ResultCard title="Edited" isDark={isDark}>
                                  <p
                                    className={`whitespace-pre-line ${
                                      isDark ? 'text-slate-100' : 'text-slate-700'
                                    }`}
                                  >
                                    {socialSection.edited ?? ''}
                                  </p>
                                </ResultCard>
                              </div>
                            ) : editingKey === 'social' ? (
                              <textarea
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                rows={14}
                                className={getInputClasses(
                                  isDark,
                                  'min-h-[420px] resize-y',
                                )}
                                placeholder="Edit the full social job post pack…"
                              />
                            ) : (
                              <div className="grid gap-4 md:grid-cols-2">
                                {socialPosts.map((post, idx) => {
                                  const postText = `${post.headline}\n\n${post.body}\n\n${post.callToAction}`;
                                  const charCount = postText.length;
                                  const isX = post.platform === 'X';
                                  return (
                                    <ResultCard
                                      key={idx}
                                      title={post.platform}
                                      isDark={isDark}
                                      copyText={postText}
                                    >
                                      {/* Feature 3: Character count for social posts */}
                                      <div className="mb-2">
                                        <span
                                          className={`text-xs ${getCharacterCountClass(
                                            charCount,
                                            isX ? 280 : undefined,
                                          )}`}
                                        >
                                          {charCount} characters
                                          {isX &&
                                            charCount > 280 &&
                                            ' (exceeds X limit)'}
                                        </span>
                                      </div>
                                      <h4
                                        className={`text-sm font-semibold mb-2 ${
                                          isDark ? 'text-white' : 'text-slate-900'
                                        }`}
                                      >
                                        {post.headline}
                                      </h4>
                                      <p
                                        className={`whitespace-pre-line mb-2 ${
                                          isDark
                                            ? 'text-slate-100'
                                            : 'text-slate-700'
                                        }`}
                                      >
                                        {post.body}
                                      </p>
                                      <p
                                        className={`text-xs font-medium ${
                                          isDark
                                            ? 'text-emerald-400'
                                            : 'text-emerald-700'
                                        }`}
                                      >
                                        {post.callToAction}
                                      </p>
                                    </ResultCard>
                                  );
                                })}
                              </div>
                            )}
                          </ResultCard>
                        </>
                      )}
                    </div>
                  )}

                {/* Screening Questions */}
                {(!!screeningSection &&
                  (screeningContentStable.trim().length > 0 ||
                    editingKey === 'summary')) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-lg font-semibold ${themeClasses.headingText}`}
                          >
                            Screening Questions
                          </h3>
                          {isEditedBadgeVisible(screeningSection) && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                isDark
                                  ? 'border-emerald-700/60 text-emerald-300 bg-emerald-900/20'
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              }`}
                            >
                              Edited
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {screeningSection &&
                            isEditedBadgeVisible(screeningSection) &&
                            editingKey !== 'summary' && (
                              <button
                                type="button"
                                onClick={() => toggleCompare('summary')}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                                title="Compare generated vs edited"
                              >
                                {isComparing('summary') ? 'Hide' : 'Compare'}
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy('summary', screeningSection ?? null)
                            }
                            disabled={!activeJobPost || !screeningSection}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              copiedKey === 'summary'
                                ? 'bg-[#29c4a9] text-white'
                                : isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            {copiedKey === 'summary' ? 'Copied!' : 'Copy'}
                          </button>
                          {editingKey === 'summary' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit('summary')}
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  isDark
                                    ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                }`}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className={`text-xs px-2 py-1 rounded ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit('summary')}
                              disabled={
                                !activeJobPost ||
                                !screeningSection ||
                                editingKey !== null
                              }
                              className={`text-xs px-2 py-1 rounded ${
                                isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              } disabled:opacity-50`}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => resetSectionToGenerated('summary')}
                            disabled={
                              !activeJobPost ||
                              (!screeningSection?.edited && editingKey !== 'summary')
                            }
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            Reset
                          </button>
                        <button
                          type="button"
                          onClick={() => toggleSection('screeningQuestions')}
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {collapsedSections.has('screeningQuestions') ? '▼' : '▲'}
                        </button>
                        </div>
                      </div>
                      {!collapsedSections.has('screeningQuestions') && (
                        <ResultCard
                          title=""
                          isDark={isDark}
                        >
                      {screeningSection &&
                      isEditedBadgeVisible(screeningSection) &&
                      isComparing('summary') &&
                      editingKey !== 'summary' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className={`text-xs ${themeClasses.mutedText}`}>
                              Generated vs edited (read-only)
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  resetSectionToGenerated('summary');
                                  closeCompare('summary');
                                }}
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Use Generated
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  closeCompare('summary');
                                  beginEdit('summary');
                                }}
                                className={`text-xs px-2 py-1 rounded ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Edit
                              </button>
                            </div>
                          </div>

                          <ResultCard title="Generated" isDark={isDark}>
                            <p
                              className={`whitespace-pre-line ${
                                isDark ? 'text-slate-100' : 'text-slate-700'
                              }`}
                            >
                              {screeningSection.generated}
                            </p>
                          </ResultCard>
                          <ResultCard title="Edited" isDark={isDark}>
                            <p
                              className={`whitespace-pre-line ${
                                isDark ? 'text-slate-100' : 'text-slate-700'
                              }`}
                            >
                              {screeningSection.edited ?? ''}
                            </p>
                          </ResultCard>
                        </div>
                      ) : editingKey === 'summary' ? (
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          rows={10}
                          className={getInputClasses(isDark, 'min-h-[280px] resize-y')}
                          placeholder="Edit the screening questions…"
                        />
                      ) : (
                        <ol className="space-y-3">
                          {screeningItems.map((q, idx) => (
                            <li key={idx}>
                              <p
                                className={`font-semibold mb-1 ${
                                  isDark ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {idx + 1}. {q.question}
                              </p>
                              {q.rationale && (
                                <p className={`text-xs ${themeClasses.mutedText}`}>
                                  Why it matters: {q.rationale}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                        </ResultCard>
                      )}
                    </div>
                  )}

                {/* Interview Questions */}
                {(!!interviewSection &&
                  (interviewContentStable.trim().length > 0 ||
                    editingKey === 'indeed')) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-lg font-semibold ${themeClasses.headingText}`}
                          >
                            Interview Questions
                          </h3>
                          {isEditedBadgeVisible(interviewSection) && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                isDark
                                  ? 'border-emerald-700/60 text-emerald-300 bg-emerald-900/20'
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              }`}
                            >
                              Edited
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {interviewSection &&
                            isEditedBadgeVisible(interviewSection) &&
                            editingKey !== 'indeed' && (
                              <button
                                type="button"
                                onClick={() => toggleCompare('indeed')}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                                title="Compare generated vs edited"
                              >
                                {isComparing('indeed') ? 'Hide' : 'Compare'}
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy('indeed', interviewSection ?? null)
                            }
                            disabled={!activeJobPost || !interviewSection}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              copiedKey === 'indeed'
                                ? 'bg-[#29c4a9] text-white'
                                : isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            {copiedKey === 'indeed' ? 'Copied!' : 'Copy'}
                          </button>
                          {editingKey === 'indeed' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit('indeed')}
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  isDark
                                    ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                }`}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className={`text-xs px-2 py-1 rounded ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit('indeed')}
                              disabled={
                                !activeJobPost ||
                                !interviewSection ||
                                editingKey !== null
                              }
                              className={`text-xs px-2 py-1 rounded ${
                                isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              } disabled:opacity-50`}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => resetSectionToGenerated('indeed')}
                            disabled={
                              !activeJobPost ||
                              (!interviewSection?.edited && editingKey !== 'indeed')
                            }
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            Reset
                          </button>
                        <button
                          type="button"
                          onClick={() => toggleSection('interviewQuestions')}
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {collapsedSections.has('interviewQuestions') ? '▼' : '▲'}
                        </button>
                        </div>
                      </div>
                      {!collapsedSections.has('interviewQuestions') && (
                        <ResultCard
                          title=""
                          isDark={isDark}
                        >
                      {interviewSection &&
                      isEditedBadgeVisible(interviewSection) &&
                      isComparing('indeed') &&
                      editingKey !== 'indeed' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className={`text-xs ${themeClasses.mutedText}`}>
                              Generated vs edited (read-only)
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  resetSectionToGenerated('indeed');
                                  closeCompare('indeed');
                                }}
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Use Generated
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  closeCompare('indeed');
                                  beginEdit('indeed');
                                }}
                                className={`text-xs px-2 py-1 rounded ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Edit
                              </button>
                            </div>
                          </div>

                          <ResultCard title="Generated" isDark={isDark}>
                            <p
                              className={`whitespace-pre-line ${
                                isDark ? 'text-slate-100' : 'text-slate-700'
                              }`}
                            >
                              {interviewSection.generated}
                            </p>
                          </ResultCard>
                          <ResultCard title="Edited" isDark={isDark}>
                            <p
                              className={`whitespace-pre-line ${
                                isDark ? 'text-slate-100' : 'text-slate-700'
                              }`}
                            >
                              {interviewSection.edited ?? ''}
                            </p>
                          </ResultCard>
                        </div>
                      ) : editingKey === 'indeed' ? (
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          rows={10}
                          className={getInputClasses(isDark, 'min-h-[280px] resize-y')}
                          placeholder="Edit the interview questions…"
                        />
                      ) : (
                        <ol className="space-y-3">
                          {interviewItems.map((q, idx) => (
                            <li key={idx}>
                              <p
                                className={`font-semibold mb-1 ${
                                  isDark ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {idx + 1}. {q.question}
                              </p>
                              {q.rationale && (
                                <p className={`text-xs ${themeClasses.mutedText}`}>
                                  What you're listening for: {q.rationale}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                        </ResultCard>
                      )}
                    </div>
                  )}

                {/* Careers Page (Raw) — editable canonical section (careersPage) */}
                {(!!careersSection &&
                  (careersContentStable.trim().length > 0 ||
                    editingKey === 'careersPage')) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                          Careers Page (Raw)
                        </h3>
                        {isEditedBadgeVisible(careersSection) && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              isDark
                                ? 'border-emerald-700/60 text-emerald-300 bg-emerald-900/20'
                                : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                            }`}
                          >
                            Edited
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {careersSection &&
                          isEditedBadgeVisible(careersSection) &&
                          editingKey !== 'careersPage' && (
                            <button
                              type="button"
                              onClick={() => toggleCompare('careersPage')}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                              title="Compare generated vs edited"
                            >
                              {isComparing('careersPage') ? 'Hide' : 'Compare'}
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => handleCopy('careersPage', careersSection ?? null)}
                          disabled={!activeJobPost || !careersSection}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            copiedKey === 'careersPage'
                              ? 'bg-[#29c4a9] text-white'
                              : isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          } disabled:opacity-50`}
                        >
                          {copiedKey === 'careersPage' ? 'Copied!' : 'Copy'}
                        </button>
                        {editingKey === 'careersPage' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit('careersPage')}
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                isDark
                                  ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
                              }`}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className={`text-xs px-2 py-1 rounded ${
                                isDark
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEdit('careersPage')}
                            disabled={
                              !activeJobPost ||
                              !careersSection ||
                              editingKey !== null
                            }
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            } disabled:opacity-50`}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => resetSectionToGenerated('careersPage')}
                          disabled={
                            !activeJobPost ||
                            (!careersSection?.edited && editingKey !== 'careersPage')
                          }
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          } disabled:opacity-50`}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSection('careersPageRaw')}
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {collapsedSections.has('careersPageRaw') ? '▼' : '▲'}
                        </button>
                      </div>
                    </div>
                    {!collapsedSections.has('careersPageRaw') && (
                      <ResultCard title="" isDark={isDark}>
                        {careersSection &&
                        isEditedBadgeVisible(careersSection) &&
                        isComparing('careersPage') &&
                        editingKey !== 'careersPage' ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <p className={`text-xs ${themeClasses.mutedText}`}>
                                Generated vs edited (read-only)
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetSectionToGenerated('careersPage');
                                    closeCompare('careersPage');
                                  }}
                                  className={`text-xs px-2 py-1 rounded font-medium ${
                                    isDark
                                      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  }`}
                                >
                                  Use Generated
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeCompare('careersPage');
                                    beginEdit('careersPage');
                                  }}
                                  className={`text-xs px-2 py-1 rounded ${
                                    isDark
                                      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  }`}
                                >
                                  Edit
                                </button>
                              </div>
                            </div>

                            <ResultCard title="Generated" isDark={isDark}>
                              <p
                                className={`whitespace-pre-line ${
                                  isDark ? 'text-slate-100' : 'text-slate-700'
                                }`}
                              >
                                {careersSection.generated}
                              </p>
                            </ResultCard>
                            <ResultCard title="Edited" isDark={isDark}>
                              <p
                                className={`whitespace-pre-line ${
                                  isDark ? 'text-slate-100' : 'text-slate-700'
                                }`}
                              >
                                {careersSection.edited ?? ''}
                              </p>
                            </ResultCard>
                          </div>
                        ) : editingKey === 'careersPage' ? (
                          <textarea
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            rows={12}
                            className={getInputClasses(isDark, 'min-h-[320px] resize-y')}
                            placeholder="Edit the careers page copy…"
                          />
                        ) : (
                          <p
                            className={`whitespace-pre-line ${
                              isDark ? 'text-slate-100' : 'text-slate-700'
                            }`}
                          >
                            {careersContentStable}
                          </p>
                        )}
                      </ResultCard>
                    )}
                  </div>
                )}

                {/* Benefits Highlight */}
                {benefitsItems.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                          Benefits Highlight
                        </h3>
                        <button
                          type="button"
                          onClick={() => toggleSection('benefitsHighlight')}
                          className={`text-xs px-2 py-1 rounded ${
                            isDark
                              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {collapsedSections.has('benefitsHighlight') ? '▼' : '▲'}
                        </button>
                      </div>
                      {!collapsedSections.has('benefitsHighlight') && (
                        <ResultCard
                          title=""
                          isDark={isDark}
                          copyText={benefitsItems.join('\n')}
                        >
                      <ul className="list-disc space-y-1 pl-5">
                        {benefitsItems.map((b, idx) => (
                          <li
                            key={idx}
                            className={
                              isDark ? 'text-slate-100' : 'text-slate-700'
                            }
                          >
                            {b}
                          </li>
                        ))}
                      </ul>
                        </ResultCard>
                      )}
                    </div>
                  )}

                {/* Application Instructions */}
                {applicationInstructions && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                        Application Instructions
                      </h3>
                      <button
                        type="button"
                        onClick={() => toggleSection('applicationInstructions')}
                        className={`text-xs px-2 py-1 rounded ${
                          isDark
                            ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {collapsedSections.has('applicationInstructions') ? '▼' : '▲'}
                      </button>
                    </div>
                    {!collapsedSections.has('applicationInstructions') && (
                      <ResultCard
                        title=""
                        isDark={isDark}
                        copyText={applicationInstructions}
                      >
                    <p
                      className={`whitespace-pre-line ${
                        isDark ? 'text-slate-100' : 'text-slate-700'
                      }`}
                    >
                        {applicationInstructions}
                      </p>
                      </ResultCard>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Sticky Action Bar (Tier 5A) */}
            <OBDStickyActionBar
              isDark={isDark}
              left={
                <div
                  className={`px-3 py-2 rounded text-sm border flex items-center gap-2 ${
                    isDark
                      ? 'border-slate-700 text-slate-200'
                      : 'border-slate-200 text-slate-700'
                  }`}
                  title="Overall job post status"
                >
                  <span className="text-xs">Status</span>
                  <span className={getStatusChipClasses(status)}>{status}</span>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                disabled={loading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>

              <div className="flex flex-col items-start">
                <button
                  type="button"
                  onClick={handleGenerateAgain}
                  disabled={loading || !activeJobPost}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  } disabled:opacity-50`}
                >
                  Generate Again
                </button>
                {activeJobPost && status === 'Edited' && (
                  <span className={`mt-1 text-[11px] ${themeClasses.mutedText}`}>
                    This version has edits. Regenerate will create a new version.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleClearForm}
                disabled={loading}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                } disabled:opacity-50`}
              >
                Reset
              </button>

              <div className="relative group flex flex-col items-end">
                <button
                  type="button"
                  disabled={loading || !exportCheck.ok}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  } disabled:opacity-50`}
                  title={exportCheck.ok ? 'Export options' : exportCheck.reason}
                >
                  Export ▼
                </button>
                <span className={`mt-1 text-[11px] ${themeClasses.mutedText}`}>
                  Draft-only exports. OBD never contacts applicants or automates hiring.
                </span>
                <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-20">
                  <div
                    className={`rounded shadow-lg border p-1 min-w-[180px] ${
                      isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={exportToText}
                      disabled={loading || !exportCheck.ok}
                      className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        isDark ? 'text-white' : 'text-slate-700'
                      } disabled:opacity-50`}
                    >
                      Export as .txt
                    </button>
                    <div className={getDividerClass(isDark)}></div>
                    <button
                      type="button"
                      onClick={() => exportToATS('greenhouse')}
                      disabled={loading || !exportCheck.ok}
                      className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        isDark ? 'text-white' : 'text-slate-700'
                      } disabled:opacity-50`}
                    >
                      Greenhouse
                    </button>
                    <button
                      type="button"
                      onClick={() => exportToATS('lever')}
                      disabled={loading || !exportCheck.ok}
                      className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        isDark ? 'text-white' : 'text-slate-700'
                      } disabled:opacity-50`}
                    >
                      Lever
                    </button>
                    <button
                      type="button"
                      onClick={() => exportToATS('workday')}
                      disabled={loading || !exportCheck.ok}
                      className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        isDark ? 'text-white' : 'text-slate-700'
                      } disabled:opacity-50`}
                    >
                      Workday
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!activeJobPost) return;
                  const ok = confirm(
                    hasEditedOverrides
                      ? 'Reset all edited sections back to generated? This will remove your overrides for this version.'
                      : 'Discard the current in-progress edit?',
                  );
                  if (!ok) return;
                  resetAllEdits();
                }}
                disabled={loading || !canResetEdits}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                } disabled:opacity-50`}
                title={
                  !activeJobPost
                    ? 'Generate a job post first'
                    : hasEditedOverrides
                      ? 'Reset all edited sections back to generated'
                      : 'Clear current edit state'
                }
              >
                Reset edits
              </button>
            </OBDStickyActionBar>
          </OBDPanel>
        </div>
      </OBDPageContainer>
    );
  }
