'use client';

import React, { useState, useEffect, useRef } from 'react';
import OBDPageContainer from '@/components/obd/OBDPageContainer';
import OBDPanel from '@/components/obd/OBDPanel';
import ResultCard from '@/components/obd/ResultCard';
import { getThemeClasses, getInputClasses } from '@/lib/obd-framework/theme';
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from '@/lib/obd-framework/layout-helpers';
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

  const [formValues, setFormValues] = useState<LocalHiringAssistantRequest>(
    defaultFormValues,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocalHiringAssistantResponse | null>(
    null,
  );

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

  // Feature 12: Result section collapse/expand
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
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
    if (!result) return;
    const content = formatJobDescriptionForCopy();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.jobTitle.replace(/\s+/g, '_')}_job_description.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToATS = (format: 'greenhouse' | 'lever' | 'workday') => {
    if (!result) return;
    let content = '';
    
    if (format === 'greenhouse') {
      content = `Job Title: ${result.jobTitle}\n`;
      content += `Location: ${result.location}\n`;
      content += `Employment Type: ${formValues.employmentType}\n\n`;
      content += `Job Description:\n`;
      result.jobDescriptionSections.forEach((section) => {
        content += `${section.title}\n${section.body}\n\n`;
      });
    } else if (format === 'lever') {
      content = `# ${result.jobTitle}\n\n`;
      content += `**Location:** ${result.location}\n`;
      content += `**Team:** ${formValues.department || 'General'}\n\n`;
      result.jobDescriptionSections.forEach((section) => {
        content += `## ${section.title}\n${section.body}\n\n`;
      });
    } else if (format === 'workday') {
      content = `${result.jobTitle}\n`;
      content += `${result.location}\n\n`;
      result.jobDescriptionSections.forEach((section) => {
        content += `${section.title}\n${section.body}\n\n`;
      });
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.jobTitle.replace(/\s+/g, '_')}_${format}.txt`;
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

  // Helper to format job description for copying
  const formatJobDescriptionForCopy = (): string => {
    if (!result) return '';
    return result.jobDescriptionSections
      .map((section) => `${section.title}\n\n${section.body}`)
      .join('\n\n');
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
                Form auto-saves • Press Esc to clear • Ctrl/Cmd+K to focus first field
              </span>
            </div>

            <form ref={formRef} onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Business Basics */}
                <div>
                  <h3
                    className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}
                  >
                    Business Basics
                  </h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Role Basics */}
                <div>
                  <h3
                    className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}
                  >
                    Role Basics
                  </h3>
                  <div className="space-y-4">
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
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Role Details */}
                <div>
                  <h3
                    className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}
                  >
                    Role Details
                  </h3>
                  <div className="space-y-4">
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
                  </div>
                </div>

                <div className={getDividerClass(isDark)}></div>

                {/* Voice & Output */}
                <div>
                  <h3
                    className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}
                  >
                    Voice & Output
                  </h3>
                  <div className="space-y-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>

                {error && !loading && (
                  <div className={getErrorPanelClasses(isDark)}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className={SUBMIT_BUTTON_CLASSES}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Generating campaign…
                      </span>
                    ) : (
                      'Generate hiring campaign'
                    )}
                  </button>
                </div>
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

            {!result && !loading && (
              <div className="mt-8">
                <p className={`text-sm text-center ${themeClasses.mutedText}`}>
                  Fill in the details above and click "Generate hiring campaign"
                  to see your results here.
                </p>
              </div>
            )}

            {result && (
              <div className="mt-8 space-y-6">
                {/* Feature 4: Generate Again Button & Feature 5: Export Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={handleGenerateAgain}
                    disabled={loading}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    } disabled:opacity-50`}
                  >
                    Generate Again
                  </button>
                  <button
                    type="button"
                    onClick={exportToText}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Export as .txt
                  </button>
                  <div className="relative group">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-slate-700 text-white hover:bg-slate-600'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Export for ATS ▼
                    </button>
                    <div className="absolute left-0 mt-1 hidden group-hover:block z-10">
                      <div
                        className={`rounded shadow-lg border p-1 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => exportToATS('greenhouse')}
                          className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                            isDark ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          Greenhouse
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToATS('lever')}
                          className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                            isDark ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          Lever
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToATS('workday')}
                          className={`block w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                            isDark ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          Workday
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                      Full Job Description
                    </h3>
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
                  {!collapsedSections.has('jobDescription') && (
                    <ResultCard
                      title=""
                      isDark={isDark}
                      copyText={formatJobDescriptionForCopy()}
                    >
                  <div className="mb-3">
                    <p className={`text-xs ${themeClasses.mutedText}`}>
                      {result.jobTitle} · {result.companyName} ·{' '}
                      {result.location}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {result.jobDescriptionSections.map((section, idx) => (
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
                    </ResultCard>
                  )}
                </div>

                {/* Short Job Post Pack */}
                {result.shortJobPostPack &&
                  result.shortJobPostPack.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3
                          className={`text-lg font-semibold ${themeClasses.headingText}`}
                        >
                          Short Job Post Pack
                        </h3>
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
                      {!collapsedSections.has('shortJobPostPack') && (
                        <>
                          <p className={`mb-4 text-xs ${themeClasses.mutedText}`}>
                            Ready-to-paste posts for your top platforms.
                          </p>
                          <div className="grid gap-4 md:grid-cols-2">
                            {result.shortJobPostPack.map((post, idx) => {
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
                                      {isX && charCount > 280 && ' (exceeds X limit)'}
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
                                  isDark ? 'text-slate-100' : 'text-slate-700'
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
                        </>
                      )}
                    </div>
                  )}

                {/* Screening Questions */}
                {result.screeningQuestions &&
                  result.screeningQuestions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                          Screening Questions
                        </h3>
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
                      {!collapsedSections.has('screeningQuestions') && (
                        <ResultCard
                          title=""
                          isDark={isDark}
                          copyText={formatQuestionsForCopy(result.screeningQuestions)}
                        >
                      <ol className="space-y-3">
                        {result.screeningQuestions.map((q, idx) => (
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
                        </ResultCard>
                      )}
                    </div>
                  )}

                {/* Interview Questions */}
                {result.interviewQuestions &&
                  result.interviewQuestions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>
                          Interview Questions
                        </h3>
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
                      {!collapsedSections.has('interviewQuestions') && (
                        <ResultCard
                          title=""
                          isDark={isDark}
                          copyText={formatQuestionsForCopy(result.interviewQuestions)}
                        >
                      <ol className="space-y-3">
                        {result.interviewQuestions.map((q, idx) => (
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
                        </ResultCard>
                      )}
                    </div>
                  )}

                {/* Benefits Highlight */}
                {result.benefitsHighlight &&
                  result.benefitsHighlight.length > 0 && (
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
                          copyText={result.benefitsHighlight.join('\n')}
                        >
                      <ul className="list-disc space-y-1 pl-5">
                        {result.benefitsHighlight.map((b, idx) => (
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
                {result.applicationInstructions && (
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
                        copyText={result.applicationInstructions}
                      >
                    <p
                      className={`whitespace-pre-line ${
                        isDark ? 'text-slate-100' : 'text-slate-700'
                      }`}
                    >
                        {result.applicationInstructions}
                      </p>
                      </ResultCard>
                    )}
                  </div>
                )}
              </div>
            )}
          </OBDPanel>
        </div>
      </OBDPageContainer>
    );
  }
