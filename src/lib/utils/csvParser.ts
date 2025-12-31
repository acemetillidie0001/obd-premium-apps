/**
 * Simple CSV Parser Utility
 * 
 * Handles basic CSV parsing without external dependencies.
 * Supports:
 * - Comma-separated values
 * - Quoted fields (basic support)
 * - Header row required
 * - CRLF/LF line endings
 * - Trimming whitespace
 */

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  error?: string;
}

/**
 * Parse CSV string into headers and rows
 */
export function parseCSV(csvText: string): ParsedCSV {
  if (!csvText || csvText.trim().length === 0) {
    return { headers: [], rows: [], error: "CSV file is empty" };
  }

  const lines: string[] = [];
  const linesRaw = csvText.split(/\r?\n/);
  
  // Remove empty lines at the end
  for (let i = linesRaw.length - 1; i >= 0; i--) {
    if (linesRaw[i].trim()) {
      lines.push(...linesRaw.slice(0, i + 1));
      break;
    }
  }
  
  if (lines.length === 0) {
    return { headers: [], rows: [], error: "No data found in CSV" };
  }

  // Parse header row
  const headerLine = lines[0].trim();
  if (!headerLine) {
    return { headers: [], rows: [], error: "CSV must have a header row" };
  }

  const headers = parseCSVLine(headerLine);
  if (headers.length === 0) {
    return { headers: [], rows: [], error: "Header row is empty" };
  }

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const row = parseCSVLine(line);
    if (row.length > 0) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = i + 1 < line.length ? line[i + 1] : null;

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i += 2;
      } else if (insideQuotes && (nextChar === ',' || nextChar === null || nextChar === '\r' || nextChar === '\n')) {
        // End of quoted field
        insideQuotes = false;
        i++;
      } else {
        // Start of quoted field
        insideQuotes = true;
        i++;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator
      fields.push(currentField.trim());
      currentField = "";
      i++;
    } else {
      currentField += char;
      i++;
    }
  }

  // Add the last field
  fields.push(currentField.trim());

  return fields;
}

