require('dotenv').config();
const { sendPickupReminderTemplated } = require('./emails');

async function test() {
  console.log('📧 Sending test pickup reminder to leander@universoleappstudios.com...\n');

  try {
    const result = await sendPickupReminderTemplated({
      email: 'leander@universoleappstudios.com',
      name: 'Leander Toney',
      vehicle: '2022 Polaris Slingshot',
      startDate: 'Mon, Jun 23, 2026',
      pickupLocation: "CJ's Fun Time Rental Office",
      pickupAddress: '123 Main St, Lancaster, PA 17602',
      pickupTime: '9:00 AM',
      fuelLevel: 'Full',
      pickupInstructions: 'Park in the back lot and enter through the side door. Check in at the front desk. Please bring your driver\'s license and the credit card used for booking.'
    });

    if (result) {
      console.log('✅ Pickup reminder sent successfully!');
      console.log('Email ID:', result.id || 'sent');
    } else {
      console.log('❌ Email template is disabled or not found');
    }
  } catch (e) {
    console.error('❌ Failed to send email:', e.message);
    console.error(e.stack);
  }
}

test();
