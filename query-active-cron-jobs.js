/**
 * Query all scheduled cron jobs in production
 * Uses the newly created get_cron_jobs() function
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryCronJobs() {
  console.log('🔍 Querying scheduled cron jobs in production...\n');

  try {
    const { data, error } = await supabase.rpc('get_cron_jobs');

    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

    console.log(`Found ${data.length} scheduled cron job(s):\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group by old vs new system
    const oldSystem = data.filter(j =>
      j.jobname === 'pickup-reminders' ||
      j.jobname === 'post-rental-followup'
    );

    const newSystem = data.filter(j =>
      j.jobname === 'send-pickup-reminders' ||
      j.jobname === 'send-return-instructions' ||
      j.jobname === 'send-mid-rental-checkins'
    );

    const other = data.filter(j =>
      !oldSystem.includes(j) && !newSystem.includes(j)
    );

    if (oldSystem.length > 0) {
      console.log('📅 OLD SYSTEM (April 2026):');
      oldSystem.forEach(job => {
        console.log(`   ${job.active ? '✅' : '❌'} ${job.jobname}`);
        console.log(`      Schedule: ${job.schedule}`);
        console.log(`      Command: ${job.command.substring(0, 80)}...`);
        console.log('');
      });
    }

    if (newSystem.length > 0) {
      console.log('📅 NEW SYSTEM (June 2026):');
      newSystem.forEach(job => {
        console.log(`   ${job.active ? '✅' : '❌'} ${job.jobname}`);
        console.log(`      Schedule: ${job.schedule}`);
        console.log(`      Command: ${job.command.substring(0, 80)}...`);
        console.log('');
      });
    }

    if (other.length > 0) {
      console.log('📅 OTHER CRON JOBS:');
      other.forEach(job => {
        console.log(`   ${job.active ? '✅' : '❌'} ${job.jobname}`);
        console.log(`      Schedule: ${job.schedule}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check for conflicts
    const hasOldPickup = oldSystem.some(j => j.jobname === 'pickup-reminders' && j.active);
    const hasNewPickup = newSystem.some(j => j.jobname === 'send-pickup-reminders' && j.active);

    if (hasOldPickup && hasNewPickup) {
      console.log('🚨 CONFLICT DETECTED: Both pickup reminder systems are ACTIVE!');
      console.log('   Customers will receive DUPLICATE emails at 9:00 AM daily.\n');
      console.log('   Old: pickup-reminders → /functions/v1/reminders');
      console.log('   New: send-pickup-reminders → /functions/v1/send-pickup-reminders\n');
    } else if (hasOldPickup) {
      console.log('📊 Status: OLD system active, NEW system not scheduled');
    } else if (hasNewPickup) {
      console.log('📊 Status: NEW system active, OLD system removed');
    } else {
      console.log('⚠️  Status: NO pickup reminder system is active!');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

queryCronJobs();
