/**
 * Database Inspection Script (TypeScript)
 * 
 * Uses Prisma $queryRaw to inspect the production database.
 * Confirms which database DATABASE_URL points to.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables (CommonJS import)
const { loadEnv } = require('./_loadEnv.cjs');

interface DatabaseInfo {
  db: string;
  schema: string;
  version: string;
}

interface TableRow {
  table_name: string;
}

async function inspectDatabase() {
  // Load environment variables first
  loadEnv();

  // Verify DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set after loading environment variables');
  }

  // Initialize PrismaClient with adapter (Prisma 7 requires adapter or accelerateUrl)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certificates (Railway uses these)
    },
    max: 1,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('='.repeat(60));
  console.log('DATABASE INSPECTION (Prisma $queryRaw)');
  console.log('='.repeat(60));
  console.log();

  // Print header with environment info
  console.log('Environment Info:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);
  console.log();

  try {
    // Query A: What database am I connected to?
    console.log('Query A: Database Connection Info');
    console.log('-'.repeat(60));
    
    const dbInfoResult = await prisma.$queryRaw<DatabaseInfo[]>`
      SELECT 
        current_database() AS db,
        current_schema() AS schema,
        version() AS version
    `;
    
    const dbInfo = dbInfoResult[0];
    console.log(`  Database: ${dbInfo.db}`);
    console.log(`  Schema: ${dbInfo.schema}`);
    console.log(`  PostgreSQL Version: ${dbInfo.version.split(',')[0]}`); // Just first line of version
    console.log();

    // Query B: List tables in public schema
    console.log('Query B: Tables in public schema');
    console.log('-'.repeat(60));
    
    const tablesResult = await prisma.$queryRaw<TableRow[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tables = tablesResult.map(row => row.table_name);
    
    tables.forEach((table, index) => {
      console.log(`  ${(index + 1).toString().padStart(3)}. ${table}`);
    });
    console.log();

    // Summary statistics
    console.log('Summary:');
    console.log('-'.repeat(60));
    console.log(`  Total table count: ${tables.length}`);
    console.log();

    // Check for specific table patterns (case-insensitive)
    const tableNamesLower = tables.map(t => t.toLowerCase());
    
    const checks = [
      {
        name: 'AI Help Desk tables',
        patterns: ['aihelp', 'helpdesk'],
        found: tableNamesLower.some(t => t.includes('aihelp') || t.includes('helpdesk'))
      },
      {
        name: 'Scheduler/Booking tables',
        patterns: ['scheduler', 'booking'],
        found: tableNamesLower.some(t => t.includes('scheduler') || t.includes('booking'))
      },
      {
        name: 'Business Description Saved Version tables',
        patterns: ['businessdescription', 'savedversion'],
        found: tableNamesLower.some(t => t.includes('businessdescription') || t.includes('savedversion'))
      },
      {
        name: 'Social Queue/Publish tables',
        patterns: ['social + (queue or publish)'],
        found: tableNamesLower.some(t => 
          t.includes('social') && (t.includes('queue') || t.includes('publish'))
        )
      }
    ];

    console.log('Table Pattern Checks:');
    checks.forEach(check => {
      const status = check.found ? '✓ Found' : '✗ Not found';
      console.log(`  ${status} - ${check.name}`);
      if (check.found) {
        const matching = tables.filter(t => {
          const tLower = t.toLowerCase();
          return check.patterns.some(p => tLower.includes(p.toLowerCase())) ||
                 (check.name.includes('Social') && tLower.includes('social') && 
                  (tLower.includes('queue') || tLower.includes('publish')));
        });
        matching.forEach(m => console.log(`      → ${m}`));
      }
    });
    console.log();

    // Additional detailed checks
    console.log('Detailed Table Analysis:');
    console.log('-'.repeat(60));
    
    const aiHelpTables = tables.filter(t => {
      const tLower = t.toLowerCase();
      return tLower.includes('aihelp') || tLower.includes('helpdesk') || 
             tLower.includes('ai_help') || tLower.includes('help_desk');
    });
    
    const schedulerTables = tables.filter(t => {
      const tLower = t.toLowerCase();
      return tLower.includes('scheduler') || tLower.includes('booking');
    });
    
    const businessDescTables = tables.filter(t => {
      const tLower = t.toLowerCase();
      return tLower.includes('businessdescription') || tLower.includes('savedversion') ||
             tLower.includes('business_description') || tLower.includes('saved_version');
    });
    
    const socialTables = tables.filter(t => {
      const tLower = t.toLowerCase();
      return tLower.includes('social');
    });

    if (aiHelpTables.length > 0) {
      console.log('AI Help Desk related:');
      aiHelpTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('AI Help Desk related: None found');
    }
    console.log();

    if (schedulerTables.length > 0) {
      console.log('Scheduler/Booking related:');
      schedulerTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('Scheduler/Booking related: None found');
    }
    console.log();

    if (businessDescTables.length > 0) {
      console.log('Business Description Saved Version related:');
      businessDescTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('Business Description Saved Version related: None found');
    }
    console.log();

    if (socialTables.length > 0) {
      console.log('Social media related:');
      socialTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('Social media related: None found');
    }
    console.log();

    console.log('='.repeat(60));
    console.log('Inspection complete');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error inspecting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the inspection
inspectDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

