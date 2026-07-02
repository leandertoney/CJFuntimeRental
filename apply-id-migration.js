#!/usr/bin/env node
// Apply ID upload migration via Supabase service role
require('dotenv').config();
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const migrationSQL = fs.readFileSync('supabase/migrations/20260701000001_id_uploads_and_contract.sql', 'utf-8');

async function applyMigration() {
  console.log('📦 Applying ID upload + contract migration...');

  // Use service role to execute raw SQL via pg_query
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: migrationSQL })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Migration failed:', response.status, error);
    console.log('\n⚠️  Manual alternative:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/yzdtevrwystezhbmgcwn/sql/new');
    console.log('   2. Copy: supabase/migrations/20260701000001_id_uploads_and_contract.sql');
    console.log('   3. Paste and execute');
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Migration applied successfully!');
  console.log('   - Created storage bucket: booking-ids (private)');
  console.log('   - Created table: id_uploads');
  console.log('   - Added columns to: bookings');
}

applyMigration().catch(err => {
  console.error('❌ Error:', err.message);
  console.log('\n⚠️  Manual alternative:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/yzdtevrwystezhbmgcwn/sql/new');
  console.log('   2. Copy: supabase/migrations/20260701000001_id_uploads_and_contract.sql');
  console.log('   3. Paste and execute');
  process.exit(1);
});
