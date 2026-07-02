#!/usr/bin/env node
// Apply migration via Supabase Management API
import { readFileSync } from 'fs';

const SUPABASE_PROJECT_REF = 'yzdtevrwystezhbmgcwn';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZHRldnJ3eXN0ZXpoYm1nY3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQzODA4OSwiZXhwIjoyMDkxMDE0MDg5fQ.tS3Xvw4qoMzATi262Xd-2Y42I4B3u-S0IjTYwo4P-hQ';

const migrationSQL = readFileSync('supabase/migrations/20260701000001_id_uploads_and_contract.sql', 'utf-8');

async function applyMigration() {
  console.log('Applying migration via PostgREST...');

  // Use the PostgREST admin API to execute raw SQL
  const response = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      query: migrationSQL
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Migration failed:', response.status, error);

    // Try alternative: execute via query parameter
    console.log('\nTrying alternative method...');
    console.log('You may need to run this migration manually via Supabase Studio SQL Editor.');
    console.log('Migration file: supabase/migrations/20260701000001_id_uploads_and_contract.sql');
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Migration applied successfully!', result);
}

applyMigration().catch(err => {
  console.error('Error:', err.message);
  console.log('\n⚠️  Alternative: Run migration manually via Supabase Studio');
  console.log('   1. Go to https://supabase.com/dashboard/project/yzdtevrwystezhbmgcwn/sql');
  console.log('   2. Copy contents of supabase/migrations/20260701000001_id_uploads_and_contract.sql');
  console.log('   3. Paste and execute');
  process.exit(1);
});
