/**
 * Fix date formats in bookings table
 * Convert from "Fri, Apr 17, 2026" to "2026-04-17"
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

function parseFormattedDate(dateStr) {
  // Parse "Fri, Apr 17, 2026" or similar formats
  // Return ISO format "2026-04-17"
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (e) {
    return null;
  }
}

async function fixDates() {
  console.log('🔧 Fixing date formats in bookings table...\n');

  // Fetch all bookings
  const { data: bookings, error: fetchError } = await supabase
    .from('bookings')
    .select('id, name, start_date, end_date');

  if (fetchError) {
    console.error('❌ Error fetching bookings:', fetchError.message);
    return;
  }

  console.log(`Found ${bookings.length} bookings to check\n`);

  let fixed = 0;
  let skipped = 0;

  for (const booking of bookings) {
    // Check if dates are already in ISO format (YYYY-MM-DD)
    const isISOFormat = /^\d{4}-\d{2}-\d{2}$/.test(booking.start_date);

    if (isISOFormat) {
      skipped++;
      continue;
    }

    // Convert dates
    const newStartDate = parseFormattedDate(booking.start_date);
    const newEndDate = parseFormattedDate(booking.end_date);

    if (!newStartDate || !newEndDate) {
      console.log(`⚠️  Skipping ${booking.name} - couldn't parse dates`);
      continue;
    }

    console.log(`Fixing ${booking.name}:`);
    console.log(`  Old: ${booking.start_date} → ${booking.end_date}`);
    console.log(`  New: ${newStartDate} → ${newEndDate}`);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        start_date: newStartDate,
        end_date: newEndDate
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error(`  ❌ Error updating: ${updateError.message}`);
    } else {
      console.log(`  ✅ Updated\n`);
      fixed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Fixed ${fixed} bookings`);
  console.log(`⏭️  Skipped ${skipped} bookings (already in ISO format)`);
  console.log('\n📊 Dashboard date filtering should now work correctly!');
}

fixDates();
