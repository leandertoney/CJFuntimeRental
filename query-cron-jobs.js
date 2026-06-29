/**
 * Query pg_cron jobs directly from production database
 * READ-ONLY check to verify email automation is scheduled
 */

const { Client } = require('pg');
require('dotenv').config();

async function queryCronJobs() {
  // Build connection string from Supabase URL
  const supabaseUrl = process.env.SUPABASE_URL;
  const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)[1];

  // Direct database connection (not pooler)
  const connectionString = `postgresql://postgres:qn86dURhdD7heNjP@db.${projectRef}.supabase.co:5432/postgres`;

  const client = new Client({ connectionString });

  try {
    console.log('🔗 Connecting to production database...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Check 1: Is pg_cron extension enabled?
    console.log('1️⃣  Checking pg_cron extension status...');
    const extResult = await client.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';"
    );

    if (extResult.rows.length === 0) {
      console.log('   ❌ pg_cron extension NOT installed\n');
      console.log('🚨 STOP: pg_cron is not enabled in production database.');
      console.log('   Email automation cannot work without this extension.\n');
      await client.end();
      process.exit(1);
    }

    console.log(`   ✅ pg_cron version ${extResult.rows[0].extversion} is installed\n`);

    // Check 2: Query scheduled cron jobs
    console.log('2️⃣  Querying scheduled cron jobs...\n');
    const cronResult = await client.query(`
      SELECT
        jobid,
        jobname,
        schedule,
        command,
        active
      FROM cron.job
      WHERE jobname IN (
        'send-pickup-reminders',
        'send-return-instructions',
        'send-mid-rental-checkins'
      )
      ORDER BY jobname;
    `);

    if (cronResult.rows.length === 0) {
      console.log('   ❌ No cron jobs found for email automation\n');
      console.log('🚨 MIGRATION NOT APPLIED:');
      console.log('   The cron jobs are NOT scheduled in production.');
      console.log('   Migration 20260622000003_email_cron_jobs.sql needs to be applied.\n');
      await client.end();
      process.exit(1);
    }

    console.log(`   ✅ Found ${cronResult.rows.length} scheduled job(s):\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    cronResult.rows.forEach((job, i) => {
      console.log(`${i + 1}. ${job.jobname}`);
      console.log(`   Job ID: ${job.jobid}`);
      console.log(`   Schedule: ${job.schedule} (${getScheduleDesc(job.schedule)})`);
      console.log(`   Active: ${job.active ? '✅ YES' : '❌ NO'}`);
      console.log(`   Command: ${job.command.substring(0, 100)}...`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check if all are active
    const allActive = cronResult.rows.every(job => job.active);
    const hasAll3 = cronResult.rows.length === 3;

    if (!hasAll3) {
      console.log(`⚠️  WARNING: Expected 3 cron jobs, found ${cronResult.rows.length}`);
      console.log('   Missing jobs will not send automated emails.\n');
    }

    if (!allActive) {
      console.log('⚠️  WARNING: Some cron jobs are INACTIVE');
      console.log('   Inactive jobs will not trigger automated emails.\n');
    }

    if (hasAll3 && allActive) {
      console.log('✅ EMAIL AUTOMATION STATUS: FULLY OPERATIONAL\n');
      console.log('   ✓ pg_cron extension enabled');
      console.log('   ✓ All 3 email cron jobs scheduled');
      console.log('   ✓ All jobs active');
      console.log('\n   Automated emails will be sent daily:');
      console.log('   - Pickup reminders: 9:00 AM (48h before rental)');
      console.log('   - Return instructions: 10:00 AM (24h before return)');
      console.log('   - Mid-rental check-ins: 11:00 AM (day 2 of rental)\n');
    } else {
      console.log('⚠️  EMAIL AUTOMATION STATUS: INCOMPLETE\n');
      console.log('   Some jobs are missing or inactive.');
      console.log('   Automated emails may not be sent as expected.\n');
    }

    await client.end();

  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    console.error('\nFull error:', error);
    await client.end();
    process.exit(1);
  }
}

function getScheduleDesc(cron) {
  if (cron === '0 9 * * *') return 'Daily at 9:00 AM';
  if (cron === '0 10 * * *') return 'Daily at 10:00 AM';
  if (cron === '0 11 * * *') return 'Daily at 11:00 AM';
  return cron;
}

queryCronJobs();
