const { Resend } = require('resend');

const FROM = 'CJ\'s Fun Time Rental <bookings@cjfuntimerentals.com>';

// Initialised lazily so dotenv has already run by the time server.js requires this
let _resend;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const base = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CJ's Fun Time Rental</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:0 0 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
            <a href="https://cjfuntimerentals.com" style="display:inline-block;">
              <img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;">
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px 0;">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
            <p style="font-size:11px;color:#555555;margin:0 0 8px;">
              CJ's Fun Time Rental &nbsp;·&nbsp; Lancaster, PA
            </p>
            <p style="font-size:11px;color:#555555;margin:0 0 8px;">
              Polaris Slingshot &amp; Can-Am Spyder Rentals
            </p>
            <p style="font-size:11px;color:#555555;margin:0;">
              <a href="https://www.instagram.com/cjsfuntimerentals/" style="color:#FF6B00;text-decoration:none;">Instagram</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="https://www.facebook.com/people/CJs-Fun-Time-Rental/61575102921796/" style="color:#FF6B00;text-decoration:none;">Facebook</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const h1 = (text) =>
  `<h1 style="font-family:Impact,'Arial Narrow',sans-serif;font-size:36px;letter-spacing:3px;color:#ffffff;margin:0 0 8px;line-height:1.1;">${text}</h1>`;

const orange = (text) => `<span style="color:#FF6B00;">${text}</span>`;

const btn = (text, url) =>
  `<a href="${url}" style="display:inline-block;background:#FF6B00;color:#000000;font-weight:700;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:6px;text-decoration:none;margin-top:24px;">${text}</a>`;

const detail = (label, value) =>
  `<tr>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:#888888;letter-spacing:1px;text-transform:uppercase;width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#ffffff;font-weight:500;">${value}</td>
  </tr>`;


// ── 1. Lead capture — discount code ───────────────────────────────────────────
async function sendDiscountCode(email, code) {
  code = code || 'FIRST10';
  const html = base(`
    ${h1('Your 10% Off<br>${orange("Code Is Here")}')}
    <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">
      Thanks for signing up. Here's your exclusive first-rental discount — use it at checkout when you book your Polaris Slingshot or Can-Am Spyder.
    </p>

    <div style="background:#1a1a1a;border:1px solid rgba(255,107,0,0.3);border-radius:10px;padding:28px;text-align:center;margin-bottom:32px;">
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:10px;">Your Discount Code</div>
      <div style="font-family:Impact,'Arial Narrow',sans-serif;font-size:42px;letter-spacing:6px;color:#FF6B00;">${code}</div>
      <div style="font-size:12px;color:#888888;margin-top:10px;">10% off your first rental &nbsp;·&nbsp; Single use &nbsp;·&nbsp; No expiry</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detail('Vehicles', 'Polaris Slingshot &amp; Can-Am Spyder')}
      ${detail('Discount', '10% off total rental price')}
      ${detail('Pickup', 'Lancaster, PA (confirmed at booking)')}
      ${detail('License', 'Standard driver\'s license only')}
    </table>

    <div style="text-align:center;">
      ${btn('Book Your Ride &rarr;', 'https://cjfuntimerentals.com')}
    </div>

    <p style="font-size:12px;color:#555555;margin-top:28px;text-align:center;line-height:1.6;">
      Questions? Reply to this email and Chris will get back to you.
    </p>
  `);

  return getResend().emails.send({
    from:    FROM,
    to:      email,
    subject: '🏎️ Your 10% off code — CJ\'s Fun Time Rental',
    html
  });
}


// ── 2. Booking confirmation (to customer) ─────────────────────────────────────
async function sendBookingConfirmation({ email, name, vehicle, startDate, endDate, days, total, savings }) {
  const html = base(`
    ${h1(`You're ${orange('Booked')},<br>${name || 'Rider'}!`)}
    <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">
      Your reservation is confirmed. Get ready for an unforgettable ride through Lancaster County — we'll reach out with exact pickup details before your trip.
    </p>

    <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:32px;">
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:16px;">Booking Summary</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail('Vehicle', vehicle)}
        ${detail('Pick-up Date', startDate)}
        ${detail('Return Date', endDate)}
        ${detail('Duration', days + (days === 1 ? ' day' : ' days'))}
        ${savings ? detail('Discount', '- $' + savings) : ''}
        ${detail('Total', '<strong style="color:#FF6B00;font-size:16px;">$' + total + '</strong>')}
      </table>
    </div>

    <div style="background:rgba(255,107,0,0.05);border:1px solid rgba(255,107,0,0.15);border-radius:10px;padding:20px 24px;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FF6B00;margin-bottom:12px;">What's Included</div>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 8px;">✓ &nbsp;600 miles included</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 8px;">✓ &nbsp;Insurance coverage</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;">✓ &nbsp;Standard driver's license — no motorcycle license needed</p>
    </div>

    <p style="font-size:12px;color:#555555;margin-top:28px;text-align:center;line-height:1.6;">
      Need to make changes? Reply to this email and we'll sort it out.
    </p>
  `);

  return getResend().emails.send({
    from:    FROM,
    to:      email,
    subject: `✅ Booking confirmed — ${vehicle} · ${startDate}`,
    html
  });
}


// ── 3. New booking alert (to owner) ───────────────────────────────────────────
async function sendOwnerBookingAlert({ name, email, phone, vehicle, startDate, endDate, days, total }) {
  const html = base(`
    ${h1(`${orange('New Booking')} Received`)}
    <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">
      A new reservation just came in. Review the details below and confirm pickup location with the customer.
    </p>

    <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:8px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail('Customer', name)}
        ${detail('Email', '<a href="mailto:' + email + '" style="color:#FF6B00;">' + email + '</a>')}
        ${detail('Phone', phone || '—')}
        ${detail('Vehicle', vehicle)}
        ${detail('Pick-up', startDate)}
        ${detail('Return', endDate)}
        ${detail('Days', days)}
        ${detail('Total', '$' + total)}
      </table>
    </div>
  `);

  return getResend().emails.send({
    from:    FROM,
    to:      FROM,   // sends to the business inbox
    subject: `🔔 New booking — ${name} · ${vehicle} · ${startDate}`,
    html
  });
}


// ── 4. Reminder (day before pickup) ───────────────────────────────────────────
async function sendPickupReminder({ email, name, vehicle, startDate }) {
  const html = base(`
    ${h1(`Your Ride Is<br>${orange('Tomorrow')}!`)}
    <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">
      Hey ${name || 'there'} — just a friendly reminder that your <strong>${vehicle}</strong> rental kicks off tomorrow, <strong>${startDate}</strong>. We can't wait to get you out on the road.
    </p>

    <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:32px;">
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:16px;">What to Bring</div>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 10px;">✓ &nbsp;Valid driver's license</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 10px;">✓ &nbsp;Credit card used at booking</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;">✓ &nbsp;Comfortable clothes — it's an open-air ride</p>
    </div>

    <p style="font-size:14px;color:rgba(255,255,255,0.6);margin:0 0 8px;line-height:1.7;">
      Chris will send over the exact pickup address shortly if you haven't received it yet. Questions? Just reply to this email.
    </p>
  `);

  return getResend().emails.send({
    from:    FROM,
    to:      email,
    subject: `🏎️ Tomorrow's the day — your ${vehicle} rental reminder`,
    html
  });
}


module.exports = {
  sendDiscountCode,
  sendBookingConfirmation,
  sendOwnerBookingAlert,
  sendPickupReminder
};
