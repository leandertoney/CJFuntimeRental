/**
 * Test script for pickup time feature
 * Tests the webhook endpoint with various pickup time scenarios
 */

async function testPickupTime() {
  console.log('🧪 Testing Pickup Time Feature\n');
  console.log('=' .repeat(60));

  const WEBHOOK_URL = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/webhook';

  // Test Case 1: 9hr rental with 2:00 PM pickup time
  console.log('\n📋 Test 1: 9hr rental with 2:00 PM pickup time');
  console.log('-'.repeat(60));

  const test1Payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'test_session_' + Date.now(),
        amount_total: 17500,
        total_details: { amount_discount: 0 },
        customer_details: {
          email: 'leandertoney@gmail.com',
          name: 'Leander Toney',
          phone: '+15555551234'
        },
        metadata: {
          vehicleKey: 'slingshot_2022',
          durationType: '9hr',
          startDate: 'Fri, Jun 27, 2026',
          endDate: 'Fri, Jun 27, 2026',
          pickupTime: '14:00',
          hours: '',
          days: '',
          deliveryDropoff: 'false',
          deliveryPickup: 'false'
        }
      }
    }
  };

  try {
    const res1 = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test1Payload)
    });
    const result1 = await res1.json();
    console.log('✅ Status:', res1.status);
    console.log('Response:', result1);
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Case 2: Multi-day rental with 9:00 AM pickup (default)
  console.log('\n📋 Test 2: Multi-day rental with 9:00 AM pickup (default)');
  console.log('-'.repeat(60));

  const test2Payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'test_session_' + Date.now(),
        amount_total: 40000,
        total_details: { amount_discount: 0 },
        customer_details: {
          email: 'leandertoney@gmail.com',
          name: 'Leander Toney',
          phone: '+15555551234'
        },
        metadata: {
          vehicleKey: 'slingshot_2022',
          durationType: 'multi',
          startDate: 'Sat, Jun 28, 2026',
          endDate: 'Sun, Jun 29, 2026',
          pickupTime: '09:00',
          hours: '',
          days: '2',
          deliveryDropoff: 'false',
          deliveryPickup: 'false'
        }
      }
    }
  };

  try {
    const res2 = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test2Payload)
    });
    const result2 = await res2.json();
    console.log('✅ Status:', res2.status);
    console.log('Response:', result2);
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Case 3: 24hr rental with 5:30 PM pickup
  console.log('\n📋 Test 3: 24hr rental with 5:30 PM pickup');
  console.log('-'.repeat(60));

  const test3Payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'test_session_' + Date.now(),
        amount_total: 22000,
        total_details: { amount_discount: 0 },
        customer_details: {
          email: 'leandertoney@gmail.com',
          name: 'Leander Toney',
          phone: '+15555551234'
        },
        metadata: {
          vehicleKey: 'slingshot_2022',
          durationType: '24hr',
          startDate: 'Mon, Jun 30, 2026',
          endDate: 'Mon, Jun 30, 2026',
          pickupTime: '17:30',
          hours: '',
          days: '',
          deliveryDropoff: 'false',
          deliveryPickup: 'false'
        }
      }
    }
  };

  try {
    const res3 = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test3Payload)
    });
    const result3 = await res3.json();
    console.log('✅ Status:', res3.status);
    console.log('Response:', result3);
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Case 4: Edge case - No pickup time (should handle gracefully)
  console.log('\n📋 Test 4: Edge case - No pickup time provided');
  console.log('-'.repeat(60));

  const test4Payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'test_session_' + Date.now(),
        amount_total: 17500,
        total_details: { amount_discount: 0 },
        customer_details: {
          email: 'leandertoney@gmail.com',
          name: 'Leander Toney',
          phone: '+15555551234'
        },
        metadata: {
          vehicleKey: 'slingshot_2022',
          durationType: '9hr',
          startDate: 'Tue, Jul 1, 2026',
          endDate: 'Tue, Jul 1, 2026',
          pickupTime: '',
          hours: '',
          days: '',
          deliveryDropoff: 'false',
          deliveryPickup: 'false'
        }
      }
    }
  };

  try {
    const res4 = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test4Payload)
    });
    const result4 = await res4.json();
    console.log('✅ Status:', res4.status);
    console.log('Response:', result4);
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Case 5: Edge case - Invalid time format
  console.log('\n📋 Test 5: Edge case - Invalid time format');
  console.log('-'.repeat(60));

  const test5Payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'test_session_' + Date.now(),
        amount_total: 17500,
        total_details: { amount_discount: 0 },
        customer_details: {
          email: 'leandertoney@gmail.com',
          name: 'Leander Toney',
          phone: '+15555551234'
        },
        metadata: {
          vehicleKey: 'slingshot_2022',
          durationType: '9hr',
          startDate: 'Wed, Jul 2, 2026',
          endDate: 'Wed, Jul 2, 2026',
          pickupTime: 'invalid-time',
          hours: '',
          days: '',
          deliveryDropoff: 'false',
          deliveryPickup: 'false'
        }
      }
    }
  };

  try {
    const res5 = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test5Payload)
    });
    const result5 = await res5.json();
    console.log('✅ Status:', res5.status);
    console.log('Response:', result5);
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('📧 Check your email (leandertoney@gmail.com) for confirmation emails');
  console.log('🎯 Check admin panel to verify pickup times saved correctly');
}

testPickupTime();
