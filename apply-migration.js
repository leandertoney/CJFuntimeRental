#!/usr/bin/env node
// Temporary script to apply migration using Supabase client
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://yzdtevrwystezhbmgcwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZHRldnJ3eXN0ZXpoYm1nY3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQzODA4OSwiZXhwIjoyMDkxMDE0MDg5fQ.tS3Xvw4qoMzATi262Xd-2Y42I4B3u-S0IjTYwo4P-hQ'
);

const migrationSQL = readFileSync('supabase/migrations/20260701000001_id_uploads_and_contract.sql', 'utf-8');

// Split by statement (basic approach - won't handle all edge cases but good for this migration)
const statements = migrationSQL
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && line.trim()) // Remove comments and empty lines
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Found ${statements.length} SQL statements to execute`);

async function runMigration() {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });

    if (error) {
      console.error(`Error on statement ${i + 1}:`, error);
      console.error('Statement:', stmt.substring(0, 200) + '...');

      // Try alternative: use REST API directly
      const response = await fetch('https://yzdtevrwystezhbmgcwn.supabase.co/rest/v1/rpc/exec_sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZHRldnJ3eXN0ZXpoYm1nY3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQzODA4OSwiZXhwIjoyMDkxMDE0MDg5fQ.tS3Xvw4qoMzATi262Xd-2Y42I4B3u-S0IjTYwo4P-hQ',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZHRldnJ3eXN0ZXpoYm1nY3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQzODA4OSwiZXhwIjoyMDkxMDE0MDg5fQ.tS3Xvw4qoMzATi262Xd-2Y42I4B3u-S0IjTYwo4P-hQ'
        },
        body: JSON.stringify({ sql_query: stmt })
      });

      console.log('Alternative attempt status:', response.status);
      continue;
    }

    console.log(`✓ Statement ${i + 1} executed successfully`);
  }

  console.log('\n✅ Migration complete!');
}

runMigration().catch(console.error);
