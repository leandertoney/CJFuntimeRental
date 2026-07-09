import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

Sentry.init({
  dsn: "https://127229b369d63b36820bcbf33816bad0@o4511654459801600.ingest.us.sentry.io/4511654476251136",
  environment: "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  release: Deno.env.get('RELEASE_VERSION') || 'unknown'
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

interface Booking {
  id: string;
  email: string;
  name: string;
  vehicle: string;
  start_date: string;
  end_date: string;
  days: number;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate yesterday's date (rentals that started yesterday are on day 2 today)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`Looking for multi-day bookings that started on: ${yesterdayStr}`);

    // Find confirmed multi-day bookings that started yesterday (day 2 today)
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('start_date', yesterdayStr)
      .gte('days', 2) // Only multi-day rentals
      .eq('status', 'confirmed')
      .is('midrental_checkin_sent_at', null);

    if (error) throw error;

    // Exclude test data (same rule as the admin dashboard)
    const bookings = (allBookings || []).filter((b: Booking) =>
      !b.id.startsWith('test_') && !b.email.includes('test') && !b.email.includes('@example.com'));

    if (!bookings || bookings.length === 0) {
      console.log('No multi-day bookings found for check-ins');
      return new Response(JSON.stringify({ message: 'No bookings found', count: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${bookings.length} booking(s) to send check-in emails`);

    // Send email to each booking
    const results = await Promise.allSettled(
      bookings.map(async (booking: Booking) => {
        const firstName = booking.name ? booking.name.split(' ')[0] : 'there';

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>",
            to: booking.email,
            subject: `How's your ${booking.vehicle} adventure going?`,
            html: buildMidRentalCheckinEmail({
              firstName,
              vehicleName: booking.vehicle,
              endDate: booking.end_date
            })
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to send email: ${error}`);
        }

        // Stamp dedup marker so this booking is never checked in twice
        await supabase
          .from('bookings')
          .update({ midrental_checkin_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        return { email: booking.email, success: true };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({
      message: 'Mid-rental check-ins processed',
      total: bookings.length,
      successful,
      failed,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    Sentry.captureException(error);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

function buildMidRentalCheckinEmail(vars: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
        <tr>
          <td style="padding:0 0 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
            <img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;">
          </td>
        </tr>
        <tr><td style="padding:36px 0;">
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Hi ${vars.firstName},</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Just checking in! Hope you're enjoying the ${vars.vehicleName}.</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Need Anything?</strong></p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">If you have questions or need assistance, we're here to help:</p>
          <ul style="margin:16px 0;padding-left:20px;">
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Call/Text: (717) 123-4567</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Email: Just reply to this message</li>
          </ul>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Reminder:</strong></p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Your rental continues through ${vars.endDate}. Return details will be sent tomorrow.</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Having Fun?</strong></p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">We'd love to see photos of your adventure! Tag us on social media or share your experience.</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Enjoy the ride!<br>– Chris</p>
        </td></tr>
        <tr>
          <td style="padding:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
            <p style="font-size:11px;color:#555555;margin:0 0 8px;">CJ's Fun Time Rental · Lancaster, PA</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
