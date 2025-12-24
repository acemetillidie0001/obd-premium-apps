/**
 * CSV Import Utilities for Review Request Automation
 * 
 * Tolerant CSV parsing for customer data with column mapping and row-level validation
 */

import { Customer } from "./types";

export interface CSVColumnMapping {
  customerName?: string;
  phone?: string;
  email?: string;
  tags?: string;
  lastVisitDate?: string;
  serviceType?: string;
  jobId?: string;
}

export interface CSVRowError {
  rowIndex: number;
  errors: string[];
}

export interface CSVParseResult {
  customers: Customer[];
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
    
    // Customer Name
    if (!mapping.customerName && (normalized.includes("customername") || normalized.includes("name") || normalized.includes("customer"))) {
      mapping.customerName = headers[i];
    }
    
    // Phone
    if (!mapping.phone && (normalized.includes("phone") || normalized.includes("mobile") || normalized.includes("cell"))) {
      mapping.phone = headers[i];
    }
    
    // Email
    if (!mapping.email && (normalized.includes("email") || normalized.includes("e-mail"))) {
      mapping.email = headers[i];
    }
    
    // Tags
    if (!mapping.tags && (normalized.includes("tag") || normalized.includes("label") || normalized.includes("category"))) {
      mapping.tags = headers[i];
    }
    
    // Last Visit Date
    if (!mapping.lastVisitDate && (normalized.includes("lastvisitdate") || normalized.includes("lastvisit") || normalized.includes("visitdate") || normalized.includes("lastservicedate"))) {
      mapping.lastVisitDate = headers[i];
    }
    
    // Service Type
    if (!mapping.serviceType && (normalized.includes("servicetype") || normalized.includes("service") || normalized.includes("jobtype"))) {
      mapping.serviceType = headers[i];
    }
    
    // Job ID
    if (!mapping.jobId && (normalized.includes("jobid") || normalized.includes("job") || normalized.includes("workorder") || normalized.includes("invoice"))) {
      mapping.jobId = headers[i];
    }
  }
  
  return mapping;
}

/**
 * Parse phone number with tolerance (removes common formatting)
 */
function parsePhone(value: string): string | null {
  if (!value) return null;
  
  // Remove common formatting characters
  const cleaned = value.trim().replace(/[\s\-\(\)\.]/g, "");
  
  // Must have at least 10 digits
  if (/^\d{10,}$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

/**
 * Parse email with basic validation
 */
function parseEmail(value: string): string | null {
  if (!value) return null;
  
  const trimmed = value.trim().toLowerCase();
  
  // Basic email validation
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed;
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
 * Parse tags (comma-separated or semicolon-separated)
 */
function parseTags(value: string): string[] {
  if (!value) return [];
  
  return value
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Generate UUID v4 (simple implementation for client-side)
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
      customers: [],
      errors: [{ rowIndex: 0, errors: ["CSV must have at least a header row and one data row"] }],
      columnMapping: {},
    };
  }
  
  // Parse headers
  const headers = lines[0].split(",").map((h) => h.trim());
  
  // Detect or use provided mapping
  const mapping = columnMapping || detectColumnMapping(headers);
  
  // Validate required columns
  const requiredColumns = ["customerName"];
  const missingColumns = requiredColumns.filter((col) => !mapping[col as keyof CSVColumnMapping]);
  
  if (missingColumns.length > 0) {
    return {
      customers: [],
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
  const customers: Customer[] = [];
  const errors: CSVRowError[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const rowErrors: string[] = [];
    
    // Get values by column mapping
    const getValue = (col: keyof CSVColumnMapping): string => {
      const header = mapping[col];
      if (!header) return "";
      const headerIndex = headers.indexOf(header);
      if (headerIndex >= 0 && headerIndex < row.length) {
        return row[headerIndex].trim();
      }
      return "";
    };
    
    // Parse customer name (required)
    const customerName = getValue("customerName");
    if (!customerName) {
      rowErrors.push("Customer name is required");
    }
    
    // Parse optional fields
    const phoneValue = getValue("phone");
    const phoneParsed = phoneValue ? parsePhone(phoneValue) : null;
    const phone = phoneParsed || undefined;
    if (phoneValue && !phoneParsed) {
      rowErrors.push(`Invalid phone number: "${phoneValue}"`);
    }
    
    const emailValue = getValue("email");
    const emailParsed = emailValue ? parseEmail(emailValue) : null;
    const email = emailParsed || undefined;
    if (emailValue && !emailParsed) {
      rowErrors.push(`Invalid email: "${emailValue}"`);
    }
    
    const tagsValue = getValue("tags");
    const tags = tagsValue ? parseTags(tagsValue) : undefined;
    
    const lastVisitDateValue = getValue("lastVisitDate");
    const lastVisitDateParsed = lastVisitDateValue ? parseDate(lastVisitDateValue) : null;
    const lastVisitDate = lastVisitDateParsed || undefined;
    if (lastVisitDateValue && !lastVisitDateParsed) {
      rowErrors.push(`Invalid last visit date: "${lastVisitDateValue}"`);
    }
    
    const serviceType = getValue("serviceType") || undefined;
    const jobId = getValue("jobId") || undefined;
    
    // If critical errors, skip row
    if (rowErrors.length > 0) {
      errors.push({ rowIndex: i, errors: rowErrors });
      continue;
    }
    
    // At least phone or email must be present
    if (!phone && !email) {
      errors.push({ 
        rowIndex: i, 
        errors: ["At least phone or email must be provided"] 
      });
      continue;
    }
    
    // Create customer
    customers.push({
      id: generateUUID(),
      customerName: customerName!,
      phone,
      email,
      tags,
      lastVisitDate,
      serviceType,
      jobId,
      optedOut: false,
      createdAt: new Date().toISOString(),
    });
  }
  
  return {
    customers,
    errors,
    columnMapping: mapping,
  };
}

/**
 * Generate CSV template
 */
export function generateCSVTemplate(): string {
  return `customerName,phone,email,tags,lastVisitDate,serviceType,jobId
John Doe,5551234567,john@example.com,"VIP,Regular",2024-01-15,Plumbing,JO-12345
Jane Smith,5559876543,jane@example.com,Regular,2024-01-20,Electrical,JO-12346
Bob Johnson,,bob@example.com,"New Customer",2024-01-25,HVAC,JO-12347`;
}

/**
 * Export customers to CSV
 */
export function exportCustomersToCSV(customers: Customer[]): string {
  const headers = ["customerName", "phone", "email", "tags", "lastVisitDate", "serviceType", "jobId"];
  const rows = customers.map((customer) => {
    return [
      `"${customer.customerName.replace(/"/g, '""')}"`, // Escape quotes
      customer.phone || "",
      customer.email || "",
      customer.tags ? `"${customer.tags.join(",").replace(/"/g, '""')}"` : "",
      customer.lastVisitDate || "",
      customer.serviceType || "",
      customer.jobId || "",
    ].join(",");
  });
  
  return [headers.join(","), ...rows].join("\n");
}

