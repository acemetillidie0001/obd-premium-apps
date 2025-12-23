#!/usr/bin/env node

import { readFileSync } from 'fs';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node check-bkb-response.mjs <response.json>');
  process.exit(1);
}

try {
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  // Check if response has ok: true and data
  if (!data.ok || !data.data) {
    console.error('❌ Response missing ok:true or data field');
    process.exit(1);
  }

  const result = data.data;
  const errors = [];

  // Meta checks
  if (!result.meta) {
    errors.push('❌ Missing meta object');
  } else {
    if (!result.meta.requestId) errors.push('❌ meta.requestId missing');
    if (!result.meta.createdAtISO) errors.push('❌ meta.createdAtISO missing');
    if (!result.meta.model) errors.push('❌ meta.model missing');
    if (result.meta.languageUsed !== 'English') {
      errors.push(`❌ meta.languageUsed is "${result.meta.languageUsed}", expected "English"`);
    }
  }

  // Color palette checks
  if (!result.colorPalette || !Array.isArray(result.colorPalette.colors)) {
    errors.push('❌ colorPalette.colors is not an array');
  } else if (result.colorPalette.colors.length < 5) {
    errors.push(`❌ colorPalette.colors length is ${result.colorPalette.colors.length}, expected >= 5`);
  }

  // Messaging checks
  if (!result.messaging) {
    errors.push('❌ Missing messaging object');
  } else {
    if (!Array.isArray(result.messaging.taglines)) {
      errors.push('❌ messaging.taglines is not an array');
    } else if (result.messaging.taglines.length !== 5) {
      errors.push(`❌ messaging.taglines length is ${result.messaging.taglines.length}, expected 5`);
    }

    if (!Array.isArray(result.messaging.valueProps)) {
      errors.push('❌ messaging.valueProps is not an array');
    } else if (result.messaging.valueProps.length !== 5) {
      errors.push(`❌ messaging.valueProps length is ${result.messaging.valueProps.length}, expected 5`);
    }
  }

  // Extras checks (if present)
  if (result.extras) {
    if (result.extras.gbpDescription) {
      if (result.extras.gbpDescription.length > 750) {
        errors.push(`❌ gbpDescription length is ${result.extras.gbpDescription.length}, expected <= 750`);
      }
    }
    if (result.extras.metaDescription) {
      const metaLen = result.extras.metaDescription.length;
      if (metaLen > 160) {
        errors.push(`❌ metaDescription length is ${metaLen}, expected <= 160`);
        errors.push(`   Sample: "${result.extras.metaDescription.substring(0, 50)}..."`);
      }
      if (metaLen < 140) {
        errors.push(`❌ metaDescription length is ${metaLen}, expected >= 140`);
        errors.push(`   Sample: "${result.extras.metaDescription}"`);
      }
      // Runtime assertion: metaDescription MUST be 140-160 chars when present
      if (metaLen < 140 || metaLen > 160) {
        console.error(`[RUNTIME ASSERTION FAILED] metaDescription length violation: ${metaLen} chars`);
        console.error(`   Full text: "${result.extras.metaDescription}"`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Validation failed:');
    errors.forEach(err => console.error(err));
    process.exit(1);
  }

  console.log('✅ All validation checks passed');
  console.log(`   - requestId: ${result.meta.requestId}`);
  console.log(`   - Colors: ${result.colorPalette.colors.length}`);
  console.log(`   - Taglines: ${result.messaging.taglines.length}`);
  console.log(`   - Value Props: ${result.messaging.valueProps.length}`);
  if (result.extras?.gbpDescription) {
    console.log(`   - GBP Description: ${result.extras.gbpDescription.length} chars`);
  }
  if (result.extras?.metaDescription) {
    console.log(`   - Meta Description: ${result.extras.metaDescription.length} chars`);
  }
  process.exit(0);
} catch (err) {
  console.error('❌ Failed to parse or validate response:', err.message);
  process.exit(1);
}

