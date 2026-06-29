/**
 * Clean up test bookings from database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('🧹 Cleaning up test bookings...\n');

  // First, let's see what we're deleting
  const { data: testBookings, error: fetchError } = await supabase
    .from('bookings')
    .select('id, email, name, vehicle, start_date')
    .or('id.like.test_%,email.ilike.%test%,email.ilike.%@example.com%');

  if (fetchError) {
    console.error('❌ Error fetching test bookings:', fetchError.message);
    return;
  }

  if (!testBookings || testBookings.length === 0) {
    console.log('✅ No test bookings found. Database is clean!');
    return;
  }

  console.log(`Found ${testBookings.length} test bookings to delete:\n`);
  testBookings.forEach((b, i) => {
    console.log(`${i + 1}. ${b.name || 'Unknown'} (${b.email}) - ${b.vehicle} on ${b.start_date}`);
  });

  console.log('\n🗑️  Deleting test bookings...');

  const { error: deleteError } = await supabase
    .from('bookings')
    .delete()
    .or('id.like.test_%,email.ilike.%test%,email.ilike.%@example.com%');

  if (deleteError) {
    console.error('❌ Error deleting test bookings:', deleteError.message);
    return;
  }

  console.log(`\n✅ Successfully deleted ${testBookings.length} test bookings!`);
  console.log('\n📊 Dashboard should now show accurate data.');
}

cleanup();
