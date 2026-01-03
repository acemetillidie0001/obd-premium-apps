/**
 * Database Inspection Script
 * 
 * Connects to DATABASE_URL and reports:
 * - Current database name and schema
 * - List of all tables in public schema
 * - Specific checks for expected tables
 */

const { loadEnv } = require('./_loadEnv.cjs');
const { Client } = require('pg');

// Tables to specifically check for (case-insensitive)
const EXPECTED_TABLES = [
  'AiHelpDeskEntry',
  'ai_help_desk_entry',
  'BusinessDescriptionSavedVersion',
  'business_description_saved_version',
  'SchedulerBusyBlock',
  'scheduler_busy_block',
  'SchedulerCalendarIntegration',
  'scheduler_calendar_integration',
  'SocialPublishAttempt',
  'social_publish_attempt',
  'SocialAccountConnection',
  'social_account_connection',
  'BookingRequest',
  'booking_request',
  'BookingPublicLink',
  'booking_public_link',
];

async function inspectDatabase() {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log('='.repeat(60));
  console.log('DATABASE INSPECTION');
  console.log('='.repeat(60));
  console.log();

  // Parse DATABASE_URL to show connection info (without password)
  const urlObj = new URL(databaseUrl);
  console.log('Connection Info:');
  console.log(`  Host: ${urlObj.hostname}`);
  console.log(`  Port: ${urlObj.port || '5432'}`);
  console.log(`  Database: ${urlObj.pathname.replace('/', '')}`);
  console.log(`  User: ${urlObj.username}`);
  console.log();

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');
    console.log();

    // Get current database name
    const dbResult = await client.query('SELECT current_database() as db_name, current_schema() as schema_name');
    const dbName = dbResult.rows[0].db_name;
    const schemaName = dbResult.rows[0].schema_name;

    console.log('Current Database:');
    console.log(`  Name: ${dbName}`);
    console.log(`  Schema: ${schemaName}`);
    console.log();

    // Get all tables in public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const allTables = tablesResult.rows.map(row => row.table_name);
    
    console.log(`All Tables in 'public' schema (${allTables.length} total):`);
    allTables.forEach(table => {
      console.log(`  - ${table}`);
    });
    console.log();

    // Check for expected tables (case-insensitive)
    console.log('Checking for Expected Tables:');
    console.log('-'.repeat(60));
    
    const foundTables = [];
    const missingTables = [];
    
    for (const expectedTable of EXPECTED_TABLES) {
      // Check both exact case and case-insensitive
      const found = allTables.find(
        t => t === expectedTable || t.toLowerCase() === expectedTable.toLowerCase()
      );
      
      if (found) {
        foundTables.push({ expected: expectedTable, actual: found });
        console.log(`  ✓ ${expectedTable} → Found as "${found}"`);
      } else {
        missingTables.push(expectedTable);
        console.log(`  ✗ ${expectedTable} → NOT FOUND`);
      }
    }
    
    console.log();
    console.log('Summary:');
    console.log(`  Found: ${foundTables.length} expected table(s)`);
    console.log(`  Missing: ${missingTables.length} expected table(s)`);
    console.log();

    // Additional checks for scheduler/booking tables
    console.log('Additional Checks:');
    console.log('-'.repeat(60));
    
    const schedulerTables = allTables.filter(t => 
      t.toLowerCase().includes('scheduler') || t.toLowerCase().includes('booking')
    );
    
    if (schedulerTables.length > 0) {
      console.log('Scheduler/Booking related tables found:');
      schedulerTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('  No scheduler/booking tables found');
    }
    console.log();

    const socialTables = allTables.filter(t => 
      t.toLowerCase().includes('social')
    );
    
    if (socialTables.length > 0) {
      console.log('Social media related tables found:');
      socialTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('  No social media tables found');
    }
    console.log();

    const aiTables = allTables.filter(t => 
      t.toLowerCase().includes('ai') || t.toLowerCase().includes('help')
    );
    
    if (aiTables.length > 0) {
      console.log('AI/Help Desk related tables found:');
      aiTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('  No AI/Help Desk tables found');
    }
    console.log();

    // Final conclusion
    console.log('='.repeat(60));
    if (missingTables.length === 0) {
      console.log('CONCLUSION: ✓ Correct DB - All expected tables found');
    } else {
      console.log('CONCLUSION: ⚠ Wrong DB or Missing Tables');
      console.log();
      console.log('Missing expected tables:');
      missingTables.forEach(t => console.log(`  - ${t}`));
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error inspecting database:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log();
    console.log('✓ Connection closed');
  }
}

// Run the inspection
inspectDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

