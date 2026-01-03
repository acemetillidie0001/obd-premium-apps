/**
 * Quality Controls analyzer for Business Description Writer
 * 
 * Provides deterministic analysis functions for quality checks:
 * - Hype words detection
 * - Repetition detection
 * - Keyword repetition warnings
 * - Readability estimates
 * 
 * Also provides safe fix functions that generate proposed changes.
 */

export interface BusinessDescriptionResponse {
  obdListingDescription: string;
  websiteAboutUs: string;
  googleBusinessDescription: string;
  elevatorPitch: string;
  metaDescription: string | null;
}

export interface HypeWordsResult {
  section: string;
  count: number;
  words: string[];
}

export interface RepetitionResult {
  section: string;
  count: number;
  sentences: string[];
}

export interface KeywordRepetitionResult {
  keyword: string;
  counts: {
    obd: number;
    gbp: number;
    website: number;
    citations: number;
    meta: number;
  };
  warnings: string[];
}

export interface ReadabilityResult {
  section: string;
  avgWordsPerSentence: number;
  avgCharsPerWord: number;
  band: "Easy" | "Standard" | "Complex";
}

export interface QualityAnalysis {
  hypeWords: HypeWordsResult[];
  repetitions: RepetitionResult[];
  keywordRepetitions: KeywordRepetitionResult[];
  readability: ReadabilityResult[];
}

// Hype words list (lowercase for matching)
const HYPE_WORDS = [
  "best",
  "top",
  "premier",
  "leading",
  "#1",
  "unmatched",
  "world-class",
  "ultimate",
  "perfect",
];

/**
 * Detect hype words in a text block
 */
function detectHypeWords(text: string): { count: number; words: Set<string> } {
  if (!text) return { count: 0, words: new Set() };
  
  const lowerText = text.toLowerCase();
  const found = new Set<string>();
  let count = 0;
  
  for (const word of HYPE_WORDS) {
    // Use word boundary regex for exact matches
    const regex = new RegExp(`\\b${word.replace(/[#.]/g, "\\$&")}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      count += matches.length;
      found.add(word.toLowerCase());
    }
  }
  
  return { count, words: found };
}

/**
 * Analyze hype words across all sections
 */
export function analyzeHypeWords(result: BusinessDescriptionResponse): HypeWordsResult[] {
  const sections: Array<{ name: string; text: string }> = [
    { name: "OBD", text: result.obdListingDescription },
    { name: "GBP", text: result.googleBusinessDescription },
    { name: "Website", text: result.websiteAboutUs },
    { name: "Citations", text: result.elevatorPitch },
    { name: "Meta", text: result.metaDescription || "" },
  ];
  
  return sections.map(({ name, text }) => {
    const { count, words } = detectHypeWords(text);
    return {
      section: name,
      count,
      words: Array.from(words).sort(),
    };
  });
}

/**
 * Detect repeated sentences in a text block
 */
function detectRepetitions(text: string): { count: number; sentences: string[] } {
  if (!text) return { count: 0, sentences: [] };
  
  // Split by sentence endings
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase().replace(/\s+/g, " "));
  
  // Find duplicates
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();
  
  for (const sentence of sentences) {
    const count = (seen.get(sentence) || 0) + 1;
    seen.set(sentence, count);
    if (count > 1) {
      duplicates.add(sentence);
    }
  }
  
  // Count total duplicate occurrences (excluding first occurrence)
  let duplicateCount = 0;
  for (const [sentence, count] of seen.entries()) {
    if (count > 1) {
      duplicateCount += count - 1;
    }
  }
  
  return {
    count: duplicateCount,
    sentences: Array.from(duplicates).slice(0, 10), // Limit to 10 for display
  };
}

/**
 * Analyze repetitions across all sections
 */
export function analyzeRepetitions(result: BusinessDescriptionResponse): RepetitionResult[] {
  const sections: Array<{ name: string; text: string }> = [
    { name: "OBD", text: result.obdListingDescription },
    { name: "GBP", text: result.googleBusinessDescription },
    { name: "Website", text: result.websiteAboutUs },
    { name: "Citations", text: result.elevatorPitch },
    { name: "Meta", text: result.metaDescription || "" },
  ];
  
  return sections
    .map(({ name, text }) => {
      const { count, sentences } = detectRepetitions(text);
      return {
        section: name,
        count,
        sentences,
      };
    })
    .filter((r) => r.count > 0);
}

/**
 * Extract keywords from form values (services and keywords fields)
 */
function extractKeywords(services?: string, keywords?: string): string[] {
  const allKeywords: string[] = [];
  
  if (services) {
    // Split by comma, newline, or common separators
    const serviceWords = services
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 50); // Reasonable keyword length
    allKeywords.push(...serviceWords);
  }
  
  if (keywords) {
    const keywordWords = keywords
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 50);
    allKeywords.push(...keywordWords);
  }
  
  // Normalize to lowercase and remove duplicates
  const normalized = new Set<string>();
  for (const kw of allKeywords) {
    normalized.add(kw.toLowerCase());
  }
  
  return Array.from(normalized);
}

/**
 * Count keyword occurrences in text (case-insensitive, whole word)
 */
function countKeywordOccurrences(text: string, keyword: string): number {
  if (!text || !keyword) return 0;
  
  const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Analyze keyword repetition across sections
 */
export function analyzeKeywordRepetition(
  result: BusinessDescriptionResponse,
  services?: string,
  keywords?: string
): KeywordRepetitionResult[] {
  const extractedKeywords = extractKeywords(services, keywords);
  
  if (extractedKeywords.length === 0) {
    return [];
  }
  
  const thresholds = {
    meta: 2,
    citations: 2,
    gbp: 4,
    website: 6,
    obd: 6,
  };
  
  return extractedKeywords.map((keyword) => {
    const counts = {
      obd: countKeywordOccurrences(result.obdListingDescription, keyword),
      gbp: countKeywordOccurrences(result.googleBusinessDescription, keyword),
      website: countKeywordOccurrences(result.websiteAboutUs, keyword),
      citations: countKeywordOccurrences(result.elevatorPitch, keyword),
      meta: countKeywordOccurrences(result.metaDescription || "", keyword),
    };
    
    const warnings: string[] = [];
    if (counts.meta > thresholds.meta) {
      warnings.push(`Meta: ${counts.meta} (limit: ${thresholds.meta})`);
    }
    if (counts.citations > thresholds.citations) {
      warnings.push(`Citations: ${counts.citations} (limit: ${thresholds.citations})`);
    }
    if (counts.gbp > thresholds.gbp) {
      warnings.push(`GBP: ${counts.gbp} (limit: ${thresholds.gbp})`);
    }
    if (counts.website > thresholds.website) {
      warnings.push(`Website: ${counts.website} (limit: ${thresholds.website})`);
    }
    if (counts.obd > thresholds.obd) {
      warnings.push(`OBD: ${counts.obd} (limit: ${thresholds.obd})`);
    }
    
    return {
      keyword,
      counts,
      warnings,
    };
  }).filter((r) => r.warnings.length > 0);
}

/**
 * Calculate readability metrics for a text block
 */
function calculateReadability(text: string): {
  avgWordsPerSentence: number;
  avgCharsPerWord: number;
  band: "Easy" | "Standard" | "Complex";
} {
  if (!text) {
    return {
      avgWordsPerSentence: 0,
      avgCharsPerWord: 0,
      band: "Standard",
    };
  }
  
  // Split into sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  
  if (sentences.length === 0) {
    return {
      avgWordsPerSentence: 0,
      avgCharsPerWord: 0,
      band: "Standard",
    };
  }
  
  // Count words and characters
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgCharsPerWord = words.length > 0 ? totalChars / words.length : 0;
  
  // Simple heuristic: Easy < 15 words/sentence, Complex > 20 words/sentence
  let band: "Easy" | "Standard" | "Complex";
  if (avgWordsPerSentence < 15) {
    band = "Easy";
  } else if (avgWordsPerSentence > 20) {
    band = "Complex";
  } else {
    band = "Standard";
  }
  
  return {
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgCharsPerWord: Math.round(avgCharsPerWord * 10) / 10,
    band,
  };
}

/**
 * Analyze readability across all sections
 */
export function analyzeReadability(result: BusinessDescriptionResponse): ReadabilityResult[] {
  const sections: Array<{ name: string; text: string }> = [
    { name: "OBD", text: result.obdListingDescription },
    { name: "GBP", text: result.googleBusinessDescription },
    { name: "Website", text: result.websiteAboutUs },
    { name: "Citations", text: result.elevatorPitch },
    { name: "Meta", text: result.metaDescription || "" },
  ];
  
  return sections.map(({ name, text }) => {
    const metrics = calculateReadability(text);
    return {
      section: name,
      ...metrics,
    };
  });
}

/**
 * Run all quality analyses
 */
export function runQualityAnalysis(
  result: BusinessDescriptionResponse,
  services?: string,
  keywords?: string
): QualityAnalysis {
  return {
    hypeWords: analyzeHypeWords(result),
    repetitions: analyzeRepetitions(result),
    keywordRepetitions: analyzeKeywordRepetition(result, services, keywords),
    readability: analyzeReadability(result),
  };
}

// ============================================================================
// Safe Fix Functions
// ============================================================================

/**
 * Soften hype words in text
 * Only replaces/removes if safe alternatives exist in the text
 */
export function softenHypeWords(text: string): string {
  if (!text) return text;
  
  let result = text;
  
  // Check if safe alternatives exist in the text
  const hasTrusted = /\b(trusted|reliable|local)\b/i.test(text);
  const hasLocal = /\b(local)\b/i.test(text);
  const hasReliable = /\b(reliable)\b/i.test(text);
  
  // Replace hype words with safe alternatives if they exist, otherwise remove
  const replacements: Array<{ pattern: RegExp; replacement: string }> = [];
  
  if (hasTrusted || hasLocal || hasReliable) {
    // We have safe words, so we can replace
    replacements.push(
      { pattern: /\bbest\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\btop\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\bpremier\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\bleading\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /#1\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\bunmatched\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\bworld-class\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\bultimate\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" },
      { pattern: /\bperfect\b/gi, replacement: hasTrusted ? "trusted" : hasLocal ? "local" : "reliable" }
    );
  } else {
    // No safe words, just remove hype words
    replacements.push(
      { pattern: /\bbest\b/gi, replacement: "" },
      { pattern: /\btop\b/gi, replacement: "" },
      { pattern: /\bpremier\b/gi, replacement: "" },
      { pattern: /\bleading\b/gi, replacement: "" },
      { pattern: /#1\b/gi, replacement: "" },
      { pattern: /\bunmatched\b/gi, replacement: "" },
      { pattern: /\bworld-class\b/gi, replacement: "" },
      { pattern: /\bultimate\b/gi, replacement: "" },
      { pattern: /\bperfect\b/gi, replacement: "" }
    );
  }
  
  for (const { pattern, replacement } of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, " ").trim();
  
  return result;
}

/**
 * Remove duplicate sentences from text
 * Preserves first occurrence only
 */
export function removeDuplicateSentences(text: string): string {
  if (!text) return text;
  
  // Split by sentence endings, preserving the delimiter
  const parts: Array<{ text: string; delimiter: string }> = [];
  const regex = /([^.!?]*)([.!?]+)/g;
  let match;
  let lastIndex = 0;
  
  while ((match = regex.exec(text)) !== null) {
    const sentence = match[1].trim();
    const delimiter = match[2];
    if (sentence) {
      parts.push({ text: sentence, delimiter });
    }
    lastIndex = regex.lastIndex;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex).trim();
    if (remaining) {
      parts.push({ text: remaining, delimiter: "" });
    }
  }
  
  // Track seen sentences (normalized)
  const seen = new Set<string>();
  const unique: Array<{ text: string; delimiter: string }> = [];
  
  for (const part of parts) {
    const normalized = part.text.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(part);
    }
  }
  
  // Reconstruct text
  return unique.map((p) => p.text + p.delimiter).join(" ").trim();
}

/**
 * Generate proposed changes for "Soften hype words" fix
 */
export function generateSoftenHypeWordsFix(
  result: BusinessDescriptionResponse
): Partial<BusinessDescriptionResponse> {
  const proposed: Partial<BusinessDescriptionResponse> = {};
  
  if (result.obdListingDescription) {
    const softened = softenHypeWords(result.obdListingDescription);
    if (softened !== result.obdListingDescription) {
      proposed.obdListingDescription = softened;
    }
  }
  
  if (result.googleBusinessDescription) {
    const softened = softenHypeWords(result.googleBusinessDescription);
    if (softened !== result.googleBusinessDescription) {
      proposed.googleBusinessDescription = softened;
    }
  }
  
  if (result.websiteAboutUs) {
    const softened = softenHypeWords(result.websiteAboutUs);
    if (softened !== result.websiteAboutUs) {
      proposed.websiteAboutUs = softened;
    }
  }
  
  if (result.elevatorPitch) {
    const softened = softenHypeWords(result.elevatorPitch);
    if (softened !== result.elevatorPitch) {
      proposed.elevatorPitch = softened;
    }
  }
  
  if (result.metaDescription) {
    const softened = softenHypeWords(result.metaDescription);
    if (softened !== result.metaDescription) {
      proposed.metaDescription = softened;
    }
  }
  
  return proposed;
}

/**
 * Generate proposed changes for "Remove duplicate sentences" fix
 */
export function generateRemoveDuplicatesFix(
  result: BusinessDescriptionResponse
): Partial<BusinessDescriptionResponse> {
  const proposed: Partial<BusinessDescriptionResponse> = {};
  
  if (result.obdListingDescription) {
    const cleaned = removeDuplicateSentences(result.obdListingDescription);
    if (cleaned !== result.obdListingDescription) {
      proposed.obdListingDescription = cleaned;
    }
  }
  
  if (result.googleBusinessDescription) {
    const cleaned = removeDuplicateSentences(result.googleBusinessDescription);
    if (cleaned !== result.googleBusinessDescription) {
      proposed.googleBusinessDescription = cleaned;
    }
  }
  
  if (result.websiteAboutUs) {
    const cleaned = removeDuplicateSentences(result.websiteAboutUs);
    if (cleaned !== result.websiteAboutUs) {
      proposed.websiteAboutUs = cleaned;
    }
  }
  
  if (result.elevatorPitch) {
    const cleaned = removeDuplicateSentences(result.elevatorPitch);
    if (cleaned !== result.elevatorPitch) {
      proposed.elevatorPitch = cleaned;
    }
  }
  
  if (result.metaDescription) {
    const cleaned = removeDuplicateSentences(result.metaDescription);
    if (cleaned !== result.metaDescription) {
      proposed.metaDescription = cleaned;
    }
  }
  
  return proposed;
}

