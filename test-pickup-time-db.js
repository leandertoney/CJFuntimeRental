/**
 * Test script to create bookings with pickup times in database
 * and verify admin panel displays them correctly
 */

require('dotenv').config();
const { insertBooking } = require('./db');

async function testPickupTimeInDB() {
  console.log('🧪 Testing Pickup Time Database Storage & Display\n');
  console.log('=' .repeat(70));

  // Test Case 1: 9hr rental with 2:00 PM pickup
  console.log('\n📋 Test 1: Creating booking with 14:00 (2:00 PM) pickup time');
  console.log('-'.repeat(70));

  const booking1 = {
    id: 'test_pickup_1_' + Date.now(),
    email: 'test1@example.com',
    name: 'Test User 1',
    phone: '+15555551001',
    vehicle: '2022 Polaris Slingshot',
    start_date: '2026-06-27',
    end_date: '2026-06-27',
    pickup_time: '14:00',
    days: 1,
    total: 175,
    savings: 0,
    stripe_session_id: 'test_session_1',
    status: 'confirmed'
  };

  try {
    await insertBooking(booking1);
    console.log('✅ Booking created successfully');
    console.log('   Vehicle:', booking1.vehicle);
    console.log('   Date:', booking1.start_date);
    console.log('   Pickup Time:', booking1.pickup_time, '(14:00 = 2:00 PM)');
  } catch (error1) {
    console.log('❌ Error:', error1.message);
  }

  // Test Case 2: Multi-day rental with 9:00 AM pickup
  console.log('\n📋 Test 2: Creating multi-day booking with 09:00 (9:00 AM) pickup');
  console.log('-'.repeat(70));

  const booking2 = {
    id: 'test_pickup_2_' + Date.now(),
    email: 'test2@example.com',
    name: 'Test User 2',
    phone: '+15555551002',
    vehicle: 'Can-Am Spyder',
    start_date: '2026-06-28',
    end_date: '2026-06-30',
    pickup_time: '09:00',
    days: 2,
    total: 400,
    savings: 0,
    stripe_session_id: 'test_session_2',
    status: 'confirmed'
  };

  try {
    await insertBooking(booking2);
    console.log('✅ Booking created successfully');
    console.log('   Vehicle:', booking2.vehicle);
    console.log('   Dates:', booking2.start_date, 'to', booking2.end_date);
    console.log('   Pickup Time:', booking2.pickup_time, '(09:00 = 9:00 AM)');
  } catch (error2) {
    console.log('❌ Error:', error2.message);
  }

  // Test Case 3: 24hr rental with 5:30 PM pickup
  console.log('\n📋 Test 3: Creating booking with 17:30 (5:30 PM) pickup');
  console.log('-'.repeat(70));

  const booking3 = {
    id: 'test_pickup_3_' + Date.now(),
    email: 'test3@example.com',
    name: 'Test User 3',
    phone: '+15555551003',
    vehicle: '2022 Polaris Slingshot',
    start_date: '2026-07-01',
    end_date: '2026-07-01',
    pickup_time: '17:30',
    days: 1,
    total: 220,
    savings: 0,
    stripe_session_id: 'test_session_3',
    status: 'confirmed'
  };

  try {
    await insertBooking(booking3);
    console.log('✅ Booking created successfully');
    console.log('   Vehicle:', booking3.vehicle);
    console.log('   Date:', booking3.start_date);
    console.log('   Pickup Time:', booking3.pickup_time, '(17:30 = 5:30 PM)');
  } catch (error3) {
    console.log('❌ Error:', error3.message);
  }

  // Test Case 4: Edge case - NULL pickup time (old bookings)
  console.log('\n📋 Test 4: Creating booking with NULL pickup time (legacy)');
  console.log('-'.repeat(70));

  const booking4 = {
    id: 'test_pickup_4_' + Date.now(),
    email: 'test4@example.com',
    name: 'Test User 4',
    phone: '+15555551004',
    vehicle: 'Can-Am Spyder',
    start_date: '2026-07-02',
    end_date: '2026-07-02',
    pickup_time: null,
    days: 1,
    total: 160,
    savings: 0,
    stripe_session_id: 'test_session_4',
    status: 'confirmed'
  };

  try {
    await insertBooking(booking4);
    console.log('✅ Booking created successfully');
    console.log('   Vehicle:', booking4.vehicle);
    console.log('   Date:', booking4.start_date);
    console.log('   Pickup Time:', booking4.pickup_time, '(NULL - should display gracefully)');
  } catch (error4) {
    console.log('❌ Error:', error4.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ All test bookings created!');
  console.log('\n📊 Next Steps:');
  console.log('   1. Open http://localhost:3000/admin');
  console.log('   2. Click "Bookings" in sidebar');
  console.log('   3. Verify pickup times display correctly:');
  console.log('      • Test User 1: should show 2:00 PM');
  console.log('      • Test User 2: should show 9:00 AM');
  console.log('      • Test User 3: should show 5:30 PM');
  console.log('      • Test User 4: should show gracefully (no error)');
  console.log('\n   4. To clean up test bookings, run:');
  console.log('      DELETE FROM bookings WHERE id LIKE \'test_pickup_%\';');
}

testPickupTimeInDB();
