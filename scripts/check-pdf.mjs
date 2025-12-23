#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node check-pdf.mjs <pdf-file>');
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`❌ PDF file not found: ${filePath}`);
  process.exit(1);
}

try {
  const buffer = readFileSync(filePath);
  const size = buffer.length;
  
  // Check file size (should be > 5 KB)
  if (size < 5120) {
    console.error(`❌ PDF file is too small: ${size} bytes (expected > 5 KB)`);
    process.exit(1);
  }
  
  // Check PDF header (first 4 bytes should be %PDF)
  const header = buffer.slice(0, 4).toString('ascii');
  if (header !== '%PDF') {
    console.error(`❌ Invalid PDF header: "${header}" (expected "%PDF")`);
    process.exit(1);
  }
  
  console.log('✅ PDF validation passed');
  console.log(`   - File size: ${(size / 1024).toFixed(2)} KB`);
  console.log(`   - Header: ${header}`);
  process.exit(0);
} catch (err) {
  console.error('❌ Failed to read or validate PDF:', err.message);
  process.exit(1);
}

