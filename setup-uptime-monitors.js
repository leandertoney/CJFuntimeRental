/**
 * UptimeRobot Monitor Setup
 * Creates 5 monitors for CJ Funtime Rentals production site
 */

const UPTIME_API_KEY = 'u3610121-ff23444b93c9185922c7af8f';
const ALERT_EMAIL = 'support@universoleappstudios.com';

async function createMonitor(monitorData) {
  const response = await fetch('https://api.uptimerobot.com/v2/newMonitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: UPTIME_API_KEY,
      format: 'json',
      ...monitorData
    })
  });

  const result = await response.json();

  if (result.stat === 'ok') {
    console.log(`✅ Created monitor: ${monitorData.friendly_name}`);
    return result.monitor;
  } else {
    console.error(`❌ Failed to create ${monitorData.friendly_name}:`, result.error);
    return null;
  }
}

async function getAlertContacts() {
  const response = await fetch('https://api.uptimerobot.com/v2/getAlertContacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: UPTIME_API_KEY,
      format: 'json'
    })
  });

  const result = await response.json();

  if (result.stat === 'ok') {
    console.log('📧 Alert contacts:', result.alert_contacts.map(c => `${c.value} (ID: ${c.id})`).join(', '));
    return result.alert_contacts;
  } else {
    console.error('❌ Failed to get alert contacts:', result.error);
    return [];
  }
}

async function setup() {
  console.log('🚀 Setting up UptimeRobot monitors for CJ Funtime Rentals\n');

  // Get alert contacts (email addresses configured in UptimeRobot)
  const alertContacts = await getAlertContacts();
  const alertContactIds = alertContacts.map(c => c.id).join('-');

  if (!alertContactIds) {
    console.log('⚠️  No alert contacts found. Add leandertoney@gmail.com in UptimeRobot dashboard first.');
    console.log('   Go to: My Settings > Alert Contacts > Add Alert Contact');
    return;
  }

  // Monitor 1: Main site availability
  await createMonitor({
    friendly_name: 'CJ Funtime - Main Site',
    url: 'https://cjfuntimerentals.com',
    type: 1 // HTTP(S)
    // interval defaults to 300 (5 min) on free tier
    // alert_contacts will use default email
  });

  // Monitor 2: Homepage keyword - "Book Now" button exists
  await createMonitor({
    friendly_name: 'CJ Funtime - Book Now Button',
    url: 'https://cjfuntimerentals.com',
    type: 2, // Keyword
    keyword_type: 1, // exists
    keyword_value: 'Book Now',
    interval: 300,
    alert_contacts: alertContactIds
  });

  // Monitor 3: Homepage keyword - Slingshot correct price
  await createMonitor({
    friendly_name: 'CJ Funtime - Slingshot Price $175',
    url: 'https://cjfuntimerentals.com',
    type: 2, // Keyword
    keyword_type: 1, // exists
    keyword_value: 'from $175',
    interval: 300,
    alert_contacts: alertContactIds
  });

  // Monitor 4: Checkout endpoint
  await createMonitor({
    friendly_name: 'CJ Funtime - Checkout Endpoint',
    url: 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/checkout',
    type: 1, // HTTP(S)
    interval: 300,
    alert_contacts: alertContactIds
  });

  // Monitor 5: Config endpoint (pricing data)
  await createMonitor({
    friendly_name: 'CJ Funtime - Config Endpoint',
    url: 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/config',
    type: 1, // HTTP(S)
    interval: 300,
    alert_contacts: alertContactIds
  });

  console.log('\n✅ All monitors created! Check https://uptimerobot.com/dashboard');
  console.log('📧 Alerts will be sent to:', ALERT_EMAIL);
}

setup().catch(console.error);
