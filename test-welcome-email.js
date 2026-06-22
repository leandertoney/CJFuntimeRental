require('dotenv').config();
const { sendWelcomeEmail } = require('./emails');

async function test() {
  console.log('📧 Sending test welcome email to leander@universoleappstudios.com...\n');

  try {
    const result = await sendWelcomeEmail({
      email: 'leander@universoleappstudios.com',
      name: 'Leander Toney',
      vehicle: '2022 Polaris Slingshot',
      startDate: 'Mon, Jun 23, 2026',
      endDate: 'Tue, Jun 24, 2026'
    });

    if (result) {
      console.log('✅ Welcome email sent successfully!');
      console.log('Email ID:', result.id);
    } else {
      console.log('❌ Email template is disabled or not found');
    }
  } catch (e) {
    console.error('❌ Failed to send email:', e.message);
    console.error(e.stack);
  }
}

test();
