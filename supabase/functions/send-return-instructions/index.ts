import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

interface Booking {
  id: string;
  email: string;
  name: string;
  vehicle: string;
  end_date: string;
  return_location?: string;
  return_address?: string;
  return_time?: string;
  fuel_level?: string;
  return_instructions?: string;
  key_drop_location?: string;
  delivery_pickup?: boolean;
  delivery_address?: string;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read default pickup/return details from site config
    const { data: configData } = await supabase
      .from('site_config')
      .select('config')
      .eq('id', 1)
      .single();

    const defaultPickup = configData?.config?.default_pickup_details || {};

    // Calculate target date (24 hours from now)
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + 24);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    console.log(`Looking for bookings ending on: ${targetDateStr}`);

    // Find bookings ending in 24 hours
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('end_date', targetDateStr);

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      console.log('No bookings found for return instructions');
      return new Response(JSON.stringify({ message: 'No bookings found', count: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${bookings.length} booking(s) to send return instructions`);

    // Send email to each booking
    const results = await Promise.allSettled(
      bookings.map(async (booking: Booking) => {
        const firstName = booking.name ? booking.name.split(' ')[0] : 'there';

        // Determine return location based on pickup service status and defaults
        let returnLocation: string;
        let returnAddress: string;
        let returnInstructions: string;
        let returnTime: string;
        let fuelLevel: string;
        let keyDropInfo: string;

        if (booking.delivery_pickup && booking.delivery_address) {
          // Pickup service: use customer's address
          returnLocation = 'Your Location (Pickup Service)';
          returnAddress = booking.delivery_address;
          returnInstructions = booking.return_instructions || "We'll pick up the vehicle from your location. Please have it ready and parked in an accessible area.";
          returnTime = booking.return_time || 'TBD';
          fuelLevel = booking.fuel_level || 'Full';
          keyDropInfo = ''; // Not relevant for pickup service
        } else {
          // Office return: use booking details or fall back to defaults
          returnLocation = booking.return_location || defaultPickup.return_location || 'Same as pickup';
          returnAddress = booking.return_address || defaultPickup.return_address || 'Same as pickup address';
          returnInstructions = booking.return_instructions || defaultPickup.return_instructions || 'Please return the vehicle in the same condition.';
          returnTime = booking.return_time || defaultPickup.return_time || 'TBD';
          fuelLevel = booking.fuel_level || defaultPickup.fuel_level || 'Full';

          // Key drop info (only for office returns)
          const keyDropLoc = booking.key_drop_location || defaultPickup.key_drop_location;
          keyDropInfo = keyDropLoc
            ? `<p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>After Hours?</strong><br>Returning after hours? ${keyDropLoc}</p>`
            : '';
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
            subject: `Return instructions for your ${booking.vehicle} rental`,
            html: buildReturnInstructionsEmail({
              firstName,
              vehicleName: booking.vehicle,
              endDate: booking.end_date,
              returnLocation,
              returnAddress,
              returnTime,
              fuelLevel,
              returnInstructions,
              keyDropInfo
            })
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to send email: ${error}`);
        }

        return { email: booking.email, success: true };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({
      message: 'Return instructions processed',
      total: bookings.length,
      successful,
      failed,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

function buildReturnInstructionsEmail(vars: any): string {
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
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Hope you're having an amazing time with the ${vars.vehicleName}! Your rental ends tomorrow.</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Return Details:</strong></p>
          <ul style="margin:16px 0;padding-left:20px;">
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Location: ${vars.returnLocation}</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Address: ${vars.returnAddress}</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Time: ${vars.returnTime}</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Fuel Level: Return with ${vars.fuelLevel}</li>
          </ul>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Instructions:</strong></p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">${vars.returnInstructions}</p>
          ${vars.keyDropInfo}
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;"><strong>Before You Return:</strong></p>
          <ul style="margin:16px 0;padding-left:20px;">
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Fill fuel to match pickup level (${vars.fuelLevel})</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Remove all personal belongings</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Park in designated area</li>
            <li style="margin:6px 0;color:rgba(255,255,255,0.85);">Lock the vehicle</li>
          </ul>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">Thanks for riding with us! We'd love to hear about your experience.</p>
          <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.7;">– Chris & the team</p>
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
