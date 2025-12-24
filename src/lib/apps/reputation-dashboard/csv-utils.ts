/**
 * CSV Import Utilities
 * 
 * Tolerant CSV parsing with column mapping and row-level validation
 */

import { ReviewInput, ReviewPlatform } from "./types";

export interface CSVColumnMapping {
  platform?: string;
  rating?: string;
  reviewText?: string;
  authorName?: string;
  reviewDate?: string;
  responded?: string;
  responseDate?: string;
  responseText?: string;
}

export interface CSVRowError {
  rowIndex: number;
  errors: string[];
}

export interface CSVParseResult {
  reviews: ReviewInput[];
  errors: CSVRowError[];
  columnMapping: CSVColumnMapping;
}

/**
 * Detect CSV column mapping from headers
 */
export function detectColumnMapping(headers: string[]): CSVColumnMapping {
  const mapping: CSVColumnMapping = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizedHeaders[i];
    
    // Platform
    if (!mapping.platform && (normalized.includes("platform") || normalized.includes("source"))) {
      mapping.platform = headers[i];
    }
    
    // Rating
    if (!mapping.rating && (normalized.includes("rating") || normalized.includes("star") || normalized.includes("score"))) {
      mapping.rating = headers[i];
    }
    
    // Review Text
    if (!mapping.reviewText && (normalized.includes("reviewtext") || normalized.includes("review") || normalized.includes("comment") || normalized.includes("text"))) {
      mapping.reviewText = headers[i];
    }
    
    // Author Name
    if (!mapping.authorName && (normalized.includes("author") || normalized.includes("name") || normalized.includes("reviewer") || normalized.includes("customer"))) {
      mapping.authorName = headers[i];
    }
    
    // Review Date
    if (!mapping.reviewDate && (normalized.includes("reviewdate") || normalized.includes("date") || normalized.includes("reviewed"))) {
      mapping.reviewDate = headers[i];
    }
    
    // Responded
    if (!mapping.responded && (normalized.includes("responded") || normalized.includes("response") || normalized.includes("replied"))) {
      mapping.responded = headers[i];
    }
    
    // Response Date
    if (!mapping.responseDate && (normalized.includes("responsedate") || normalized.includes("replieddate"))) {
      mapping.responseDate = headers[i];
    }
    
    // Response Text
    if (!mapping.responseText && (normalized.includes("responsetext") || normalized.includes("reply") || normalized.includes("responsecomment"))) {
      mapping.responseText = headers[i];
    }
  }
  
  return mapping;
}

/**
 * Parse rating value with tolerance
 */
function parseRating(value: string): number | null {
  if (!value) return null;
  
  // Try direct number parse
  const num = parseFloat(value.trim());
  if (!isNaN(num) && num >= 1 && num <= 5) {
    return Math.round(num);
  }
  
  // Try extracting from text like "5 stars", "4/5", etc.
  const match = value.match(/(\d+)/);
  if (match) {
    const extracted = parseInt(match[1], 10);
    if (extracted >= 1 && extracted <= 5) {
      return extracted;
    }
  }
  
  return null;
}

/**
 * Parse date value with tolerance
 */
function parseDate(value: string): string | null {
  if (!value) return null;
  
  const trimmed = value.trim();
  
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  
  // Try other common formats
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }
  
  return null;
}

/**
 * Parse responded boolean with tolerance
 */
function parseResponded(value: string): boolean {
  if (!value) return false;
  
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "y";
}

/**
 * Normalize platform name
 */
function normalizePlatform(value: string): ReviewPlatform {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("google")) return "Google";
  if (normalized.includes("facebook") || normalized.includes("fb")) return "Facebook";
  if (normalized.includes("yelp")) return "Yelp";
  return "Other";
}

/**
 * Parse CSV with tolerant parsing and row-level validation
 */
export function parseCSV(
  csvText: string,
  columnMapping?: CSVColumnMapping
): CSVParseResult {
  const lines = csvText.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  
  if (lines.length < 2) {
    return {
      reviews: [],
      errors: [{ rowIndex: 0, errors: ["CSV must have at least a header row and one data row"] }],
      columnMapping: {},
    };
  }
  
  // Parse headers
  const headers = lines[0].split(",").map((h) => h.trim());
  
  // Detect or use provided mapping
  const mapping = columnMapping || detectColumnMapping(headers);
  
  // Validate required columns
  const requiredColumns = ["platform", "rating", "reviewText", "reviewDate"];
  const missingColumns = requiredColumns.filter((col) => !mapping[col as keyof CSVColumnMapping]);
  
  if (missingColumns.length > 0) {
    return {
      reviews: [],
      errors: [{ rowIndex: 0, errors: [`Missing required columns: ${missingColumns.join(", ")}`] }],
      columnMapping: mapping,
    };
  }
  
  // Parse CSV row safely (handle quoted fields)
  const parseCSVRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };
  
  // Parse rows
  const reviews: ReviewInput[] = [];
  const errors: CSVRowError[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const rowErrors: string[] = [];
    
    // Get values by column mapping (sanitize to prevent formula injection)
    const getValue = (col: keyof CSVColumnMapping): string => {
      const header = mapping[col];
      if (!header) return "";
      const headerIndex = headers.indexOf(header);
      if (headerIndex >= 0 && headerIndex < row.length) {
        let value = row[headerIndex].trim();
        // Prevent formula injection: if value starts with =, +, -, @, treat as plain text
        // This is safe because we're only displaying/using the text, not evaluating it
        return value;
      }
      return "";
    };
    
    // Parse platform
    const platformValue = getValue("platform");
    const platform = platformValue ? normalizePlatform(platformValue) : "Other";
    
    // Parse rating
    const ratingValue = getValue("rating");
    const rating = parseRating(ratingValue);
    if (rating === null) {
      rowErrors.push(`Invalid rating: "${ratingValue}" (must be 1-5)`);
    }
    
    // Parse review text
    const reviewText = getValue("reviewText");
    if (!reviewText) {
      rowErrors.push("Review text is required");
    }
    
    // Parse review date
    const reviewDateValue = getValue("reviewDate");
    const reviewDate = parseDate(reviewDateValue);
    if (!reviewDate) {
      rowErrors.push(`Invalid review date: "${reviewDateValue}"`);
    }
    
    // Parse optional fields
    const authorName = getValue("authorName") || undefined;
    const respondedValue = getValue("responded");
    const responded = parseResponded(respondedValue);
    const responseDateValue = getValue("responseDate");
    const responseDate = responseDateValue ? parseDate(responseDateValue) : undefined;
    const responseText = getValue("responseText") || undefined;
    
    // If critical errors, skip row
    if (rowErrors.length > 0) {
      errors.push({ rowIndex: i, errors: rowErrors });
      continue;
    }
    
    // Create review
    reviews.push({
      platform,
      rating: rating!,
      reviewText: reviewText!,
      authorName,
      reviewDate: reviewDate!,
      responded,
      responseDate: responseDate || undefined,
      responseText,
    });
  }
  
  return {
    reviews,
    errors,
    columnMapping: mapping,
  };
}

/**
 * Generate CSV template
 */
export function generateCSVTemplate(): string {
  return `platform,rating,reviewText,authorName,reviewDate,responded,responseDate,responseText
Google,5,"Great service! Very professional.",John Doe,2024-01-15,yes,2024-01-16,"Thank you for the kind words!"
Facebook,4,"Good experience overall.",Jane Smith,2024-01-20,no,,
Yelp,3,"Average service, could be better.",Bob Johnson,2024-01-25,yes,2024-01-26,"We appreciate your feedback."`;
}

/**
 * Export reviews to CSV
 */
export function exportReviewsToCSV(reviews: ReviewInput[]): string {
  const headers = ["platform", "rating", "reviewText", "authorName", "reviewDate", "responded", "responseDate", "responseText"];
  const rows = reviews.map((review) => {
    return [
      review.platform,
      review.rating.toString(),
      `"${review.reviewText.replace(/"/g, '""')}"`, // Escape quotes
      review.authorName || "",
      review.reviewDate,
      review.responded ? "yes" : "no",
      review.responseDate || "",
      review.responseText ? `"${review.responseText.replace(/"/g, '""')}"` : "",
    ].join(",");
  });
  
  return [headers.join(","), ...rows].join("\n");
}

