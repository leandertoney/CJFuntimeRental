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
  pickup_location?: string;
  pickup_address?: string;
  pickup_time?: string;
  fuel_level?: string;
  pickup_instructions?: string;
  delivery_dropoff?: boolean;
  delivery_address?: string;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read default pickup details from site config
    const { data: configData } = await supabase
      .from('site_config')
      .select('config')
      .eq('id', 1)
      .single();

    const defaultPickup = configData?.config?.default_pickup_details || {};

    // Calculate target date (48 hours from now)
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + 48);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    console.log(`Looking for bookings starting on: ${targetDateStr}`);

    // Find confirmed bookings starting in 48 hours that haven't been reminded yet
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('start_date', targetDateStr)
      .eq('status', 'confirmed')
      .is('pickup_reminder_sent_at', null);

    if (error) throw error;

    // Exclude test data (same rule as the admin dashboard)
    const bookings = (allBookings || []).filter((b: Booking) =>
      !b.id.startsWith('test_') && !b.email.includes('test') && !b.email.includes('@example.com'));

    if (!bookings || bookings.length === 0) {
      console.log('No bookings found for pickup reminders');
      return new Response(JSON.stringify({ message: 'No bookings found', count: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${bookings.length} booking(s) to send reminders`);

    // Send email to each booking
    const results = await Promise.allSettled(
      bookings.map(async (booking: Booking) => {
        const firstName = booking.name ? booking.name.split(' ')[0] : 'there';

        // Determine pickup location based on delivery status and defaults
        let pickupLocation: string;
        let pickupAddress: string;
        let pickupInstructions: string;
        let pickupTime: string;
        let fuelLevel: string;

        if (booking.delivery_dropoff && booking.delivery_address) {
          // Delivery service: use customer's address
          pickupLocation = 'Your Location (Delivery Service)';
          pickupAddress = booking.delivery_address;
          pickupInstructions = booking.pickup_instructions || "We'll deliver the vehicle to your location. Please ensure someone is available to receive it and complete a brief walk-around inspection.";
          pickupTime = booking.pickup_time || 'TBD';
          fuelLevel = booking.fuel_level || 'Full';
        } else {
          // Office pickup: use booking details or fall back to defaults
          pickupLocation = booking.pickup_location || defaultPickup.pickup_location || 'TBD';
          pickupAddress = booking.pickup_address || defaultPickup.pickup_address || 'Will be sent shortly';
          pickupInstructions = booking.pickup_instructions || defaultPickup.pickup_instructions || 'Check your email for updates.';
          pickupTime = booking.pickup_time || defaultPickup.pickup_time || 'TBD';
          fuelLevel = booking.fuel_level || defaultPickup.fuel_level || 'Full';
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>",
            to: booking.email,
            subject: `Your ${booking.vehicle} is ready! Pickup details inside`,
            html: buildPickupReminderEmail({
              firstName,
              vehicleName: booking.vehicle,
              startDate: booking.start_date,
              pickupLocation,
              pickupAddress,
              pickupTime,
              fuelLevel,
              pickupInstructions
            })
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to send email: ${error}`);
        }

        // Stamp dedup marker so this booking is never reminded twice
        await supabase
          .from('bookings')
          .update({ pickup_reminder_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        return { email: booking.email, success: true };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({
      message: 'Pickup reminders processed',
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

function buildPickupReminderEmail(vars: any): string {
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
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Your rental begins tomorrow! Here's everything you need to know:</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Pickup Details:</strong></p>
          <ul style="margin:16px 0;padding-left:20px;">
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Location: ${vars.pickupLocation}</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Address: ${vars.pickupAddress}</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Time: ${vars.pickupTime}</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Fuel Level: ${vars.fuelLevel}</li>
          </ul>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Instructions:</strong></p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">${vars.pickupInstructions}</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>What to Bring:</strong></p>
          <ul style="margin:16px 0;padding-left:20px;">
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Valid driver's license</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Credit card on file</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Comfortable closed-toe shoes</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Sunglasses and sunscreen</li>
          </ul>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Questions?</strong><br>Call or text us: (717) 203-5778</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Safe travels!<br>– Chris</p>
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
