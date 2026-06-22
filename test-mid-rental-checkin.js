require('dotenv').config();
const { sendMidRentalCheckin } = require('./emails');

async function test() {
  console.log('📧 Sending test mid-rental check-in to leander@universoleappstudios.com...\n');

  try {
    const result = await sendMidRentalCheckin({
      email: 'leander@universoleappstudios.com',
      name: 'Leander Toney',
      vehicle: '2022 Polaris Slingshot',
      endDate: 'Wed, Jun 25, 2026'
    });

    if (result) {
      console.log('✅ Mid-rental check-in sent successfully!');
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
