#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function runProbes() {
  console.log('=== Brand Kit Builder V3 - Runtime API Probes ===\n');

  // Read payload
  const payloadPath = join(__dirname, 'bkb-payload.json');
  if (!existsSync(payloadPath)) {
    console.error('❌ Payload file not found:', payloadPath);
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(payloadPath, 'utf-8'));
  console.log('1. Testing Brand Kit Builder API...');

  try {
    // Call Brand Kit Builder API
    const response = await fetch(`${API_BASE}/api/brand-kit-builder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API returned status ${response.status}: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();
    const outputPath = join(process.env.TEMP || process.env.TMP || '/tmp', 'bkb.json');
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`   ✅ Response saved to ${outputPath}`);

    // Validate response
    console.log('\n2. Validating response structure...');
    if (result.ok && result.data) {
      const data = result.data;
      console.log(`   ✅ Response has valid structure`);
      console.log(`   - requestId: ${data.meta?.requestId || 'missing'}`);
      console.log(`   - Colors: ${data.colorPalette?.colors?.length || 0}`);
      console.log(`   - Taglines: ${data.messaging?.taglines?.length || 0}`);
      console.log(`   - Value Props: ${data.messaging?.valueProps?.length || 0}`);
    } else {
      console.error('   ❌ Invalid response structure');
      process.exit(1);
    }

    // Call PDF API
    console.log('\n3. Testing PDF Export API...');
    const pdfResponse = await fetch(`${API_BASE}/api/brand-kit-builder/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandKit: result.data }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error(`   ❌ PDF API returned status ${pdfResponse.status}: ${errorText}`);
      process.exit(1);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfPath = join(process.env.TEMP || process.env.TMP || '/tmp', 'bkb.pdf');
    writeFileSync(pdfPath, Buffer.from(pdfBuffer), 'binary');
    console.log(`   ✅ PDF saved to ${pdfPath}`);

    // Validate PDF
    console.log('\n4. Validating PDF...');
    const pdfSize = pdfBuffer.byteLength;
    if (pdfSize < 5120) {
      console.error(`   ❌ PDF too small: ${pdfSize} bytes`);
      process.exit(1);
    }

    const pdfHeader = Buffer.from(pdfBuffer.slice(0, 4)).toString('ascii');
    if (pdfHeader !== '%PDF') {
      console.error(`   ❌ Invalid PDF header: "${pdfHeader}"`);
      process.exit(1);
    }

    console.log(`   ✅ PDF validation passed (${(pdfSize / 1024).toFixed(2)} KB)`);
    console.log('\n✅ All probes PASSED');
    console.log(`\nResponse JSON: ${outputPath}`);
    console.log(`PDF file: ${pdfPath}`);
  } catch (error) {
    console.error('❌ Probe failed:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
    process.exit(1);
  }
}

runProbes();

