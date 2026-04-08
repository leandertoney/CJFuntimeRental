import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>";

function emailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#fff;font-weight:500;">${value}</td>
  </tr>`;
}

function baseEmail(content: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
        <a href="https://cjfuntimerentals.com"><img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;"></a>
      </td></tr>
      <tr><td style="padding:36px 0;">${content}</td></tr>
      <tr><td style="padding:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
        <p style="font-size:11px;color:#555;margin:0;">CJ's Fun Time Rental &nbsp;·&nbsp; Lancaster, PA &nbsp;·&nbsp; Polaris Slingshot &amp; Can-Am Spyder Rentals</p>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;

  // Verify Stripe webhook signature
  if (webhookSecret) {
    const timestamp = sig.split(',').find((p: string) => p.startsWith('t='))?.split('=')[1];
    const v1 = sig.split(',').find((p: string) => p.startsWith('v1='))?.split('=')[1];
    if (!timestamp || !v1) return new Response('Missing signature', { status: 400 });
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return new Response('Timestamp too old', { status: 400 });

    const signedPayload = `${timestamp}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected !== v1) return new Response('Invalid signature', { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data as Record<string, unknown>;
    const obj = session.object as Record<string, unknown>;
    const meta = (obj.metadata || {}) as Record<string, string>;
    const customer = (obj.customer_details || {}) as Record<string, string>;
    const email = customer.email || '';
    const name = customer.name || '';
    const phone = customer.phone || '';
    const amountTotal = obj.amount_total as number;
    const total = (amountTotal / 100).toFixed(2);
    const amountDiscount = (obj.total_details as Record<string, number>)?.amount_discount || 0;
    const savings = amountDiscount ? (amountDiscount / 100).toFixed(2) : null;

    // Get vehicle name from config
    let vehicleName = meta.vehicleKey || 'Vehicle';
    try {
      const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
      vehicleName = data?.config?.vehicles?.[meta.vehicleKey]?.name || vehicleName;
    } catch { /* use key as fallback */ }

    // Save booking
    await supabase.from('bookings').upsert({
      id: obj.id as string,
      email: email.toLowerCase(),
      name, phone,
      vehicle: vehicleName,
      start_date: meta.startDate,
      end_date: meta.endDate,
      days: Number(meta.days) || 1,
      total: Number(total),
      savings: savings ? Number(savings) : 0,
      stripe_session_id: obj.id as string,
      status: 'confirmed'
    });

    // Customer confirmation email
    const customerHtml = baseEmail(`
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:36px;letter-spacing:3px;margin:0 0 8px;">You're Booked, ${name.split(' ')[0] || 'Rider'}!</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">Your reservation is confirmed. We'll send exact pickup details before your trip.</p>
      <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:32px;">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:16px;">Booking Summary</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${emailRow('Vehicle', vehicleName)}
          ${emailRow('Pick-up', meta.startDate)}
          ${emailRow('Return', meta.endDate || meta.startDate)}
          ${emailRow('Duration', meta.durationType === 'hourly' ? (meta.hours || '3') + ' hours' : meta.durationType === '9hr' ? '9 hours' : meta.durationType === '24hr' ? '24 hours' : meta.days + ' day' + (Number(meta.days) === 1 ? '' : 's'))}
          ${savings ? emailRow('Discount', '- $' + savings) : ''}
          ${emailRow('Total', '<strong style="color:#FF6B00;font-size:16px;">$' + total + '</strong>')}
        </table>
      </div>
      <div style="text-align:center;">
        <p style="font-size:13px;color:#555;">Questions? Reply to this email and Chris will get back to you.</p>
      </div>
    `);

    // Owner alert email
    const ownerHtml = baseEmail(`
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:36px;letter-spacing:3px;margin:0 0 8px;color:#FF6B00;">New Booking!</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">A new reservation just came in.</p>
      <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${emailRow('Customer', name)}
          ${emailRow('Email', email)}
          ${emailRow('Phone', phone || '—')}
          ${emailRow('Vehicle', vehicleName)}
          ${emailRow('Pick-up', meta.startDate)}
          ${emailRow('Return', meta.endDate || meta.startDate)}
          ${emailRow('Type', meta.durationType === 'hourly' ? (meta.hours || '3') + ' hours' : meta.durationType === '9hr' ? '9 hours' : meta.durationType === '24hr' ? '24 hours' : meta.days + ' day' + (Number(meta.days) === 1 ? '' : 's'))}
          ${meta.deliveryDropoff === 'true' || meta.deliveryPickup === 'true' ? emailRow('Delivery', [meta.deliveryDropoff === 'true' ? 'Drop-off' : '', meta.deliveryPickup === 'true' ? 'Pickup' : ''].filter(Boolean).join(' + ')) : ''}
          ${emailRow('Total', '$' + total)}
        </table>
      </div>
    `);

    await Promise.all([
      resend.emails.send({ from: FROM, to: email, subject: `✅ Booking confirmed — ${vehicleName} · ${meta.startDate}`, html: customerHtml }),
      resend.emails.send({ from: FROM, to: 'bookings@cjfuntimerentals.com', subject: `🔔 New booking — ${name} · ${vehicleName} · ${meta.startDate}`, html: ownerHtml })
    ]);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
