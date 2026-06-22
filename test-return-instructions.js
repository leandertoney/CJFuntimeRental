require('dotenv').config();
const { sendReturnInstructions } = require('./emails');

async function test() {
  console.log('📧 Sending test return instructions to leander@universoleappstudios.com...\n');

  try {
    const result = await sendReturnInstructions({
      email: 'leander@universoleappstudios.com',
      name: 'Leander Toney',
      vehicle: '2022 Polaris Slingshot',
      endDate: 'Tue, Jun 24, 2026',
      returnLocation: "CJ's Fun Time Rental Office",
      returnAddress: '123 Main St, Lancaster, PA 17602',
      returnTime: '6:00 PM',
      fuelLevel: 'Full',
      returnInstructions: 'Please return with a full tank of gas. Park in the back lot in the same spot you picked up from. Remove all personal belongings and lock the vehicle.',
      keyDropLocation: 'Drop keys in the lockbox on the front door (code: 1234)'
    });

    if (result) {
      console.log('✅ Return instructions sent successfully!');
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
