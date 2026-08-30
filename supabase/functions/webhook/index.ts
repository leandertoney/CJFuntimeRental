import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

Sentry.init({
  dsn: "https://127229b369d63b36820bcbf33816bad0@o4511654459801600.ingest.us.sentry.io/4511654476251136",
  environment: "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  release: Deno.env.get('RELEASE_VERSION') || 'unknown'
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>";
// Same pair the new-booking alert uses (Chris + Milonda), read from env so the
// owner address stays configurable.
const OWNER_EMAILS = [
  Deno.env.get('OWNER_EMAIL') || 'chrisjohnson839@gmail.com',
  'johnsonmilonda37@gmail.com'
];

// resend@2 forwards keys verbatim and the API reads `reply_to`, not `replyTo`,
// so a camelCase-only send silently loses the reply address. Both spellings go
// out; the cast is only to satisfy the SDK's narrower type.
function replyTo(addr: string) {
  return { reply_to: addr, replyTo: addr } as unknown as { reply_to: string };
}

function emailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#fff;font-weight:500;">${value}</td>
  </tr>`;
}

function formatTime(time24: string | null | undefined): string {
  if (!time24 || time24.trim() === '') return '';

  try {
    const parts = time24.split(':');
    if (parts.length !== 2) return '';

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return '';
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return '';
  }
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
  try {
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

  // ── Guided tour deposit ─────────────────────────────────────────────────────
  //
  // MUST come before the rental handler below. Both a rental and a tour arrive
  // as `checkout.session.completed` on this one endpoint, and the rental path
  // does a vehicle lookup, writes a `bookings` row and sends rental emails
  // (pickup instructions, agreements, deposit-refund language). Letting a tour
  // fall through would write a garbage booking and mail the guest instructions
  // for a rental they never made. This branch returns before any of that.
  const _obj = ((event.data as Record<string, unknown>)?.object || {}) as Record<string, unknown>;
  const _meta = (_obj.metadata || {}) as Record<string, string>;

  if (event.type === 'checkout.session.completed' && _meta.kind === 'tour-deposit') {
    const obj = _obj;
    const meta = _meta;
    const customer = (obj.customer_details || {}) as Record<string, string>;
    const tourId = meta.tourRequestId;
    const sessionId = obj.id as string;
    const paymentIntent = (obj.payment_intent as string) || null;

    if (!tourId) {
      console.error('[webhook] tour-deposit with no tourRequestId, session', sessionId);
      return new Response('ok', { status: 200 });
    }

    // Stripe delivers at-least-once. Only act if this row is not already paid,
    // so a retry cannot double-block the fleet or send a second email.
    const { data: existing } = await supabase
      .from('tour_requests')
      .select('id, status, deposit_paid_at, name, email, phone, route, preferred_date, group_size, notes')
      .eq('id', tourId).single();

    if (!existing) {
      console.error('[webhook] tour-deposit for unknown request', tourId);
      return new Response('ok', { status: 200 });
    }
    if (existing.deposit_paid_at) {
      return new Response('ok', { status: 200 }); // already handled
    }

    await supabase.from('tour_requests').update({
      status: 'paid',
      deposit_paid_at: new Date().toISOString(),
      stripe_session_id: sessionId,
      stripe_payment_intent: paymentIntent
    }).eq('id', tourId);

    // A paid tour must consume fleet inventory, or a renter could book a car
    // that is already committed to it. Hold ceil(guests/2) vehicles for the day
    // by writing the same vehicle_blocks rows the admin panel and the
    // availability checks already read.
    const needed = Number(meta.vehiclesNeeded) || Math.ceil(Number(existing.group_size) / 2);
    const tourDate = meta.tourDate || existing.preferred_date;
    try {
      const { data: cfgRow } = await supabase
        .from('site_config').select('config').eq('id', 1).single();
      const fleet = Object.keys(cfgRow?.config?.vehicles || {});

      const taken = new Set<string>();
      const { data: bk } = await supabase
        .from('bookings').select('vehicle, vehicle_key, start_date, end_date').eq('status', 'confirmed');
      (bk || []).forEach((b: Record<string, string>) => {
        if (b.start_date && b.start_date <= tourDate && (b.end_date || b.start_date) >= tourDate) {
          taken.add(b.vehicle_key || b.vehicle);
        }
      });
      const { data: vb } = await supabase
        .from('vehicle_blocks').select('vehicle_key, start_date, end_date');
      (vb || []).forEach((b: Record<string, string>) => {
        if (b.start_date && b.start_date <= tourDate && (b.end_date || b.start_date) >= tourDate) {
          taken.add(b.vehicle_key);
        }
      });

      const free = fleet.filter(k => !taken.has(k)).slice(0, needed);
      if (free.length === needed) {
        await supabase.from('vehicle_blocks').insert(free.map(key => ({
          vehicle_key: key,
          start_date: tourDate,
          end_date: tourDate,
          reason: 'guided tour',
          created_by: 'tour-checkout',
          tour_request_id: tourId
        })));
      } else {
        // Paid but the fleet moved underneath them. The money is real, so the
        // booking stands and Chris resolves it by hand; loud log, no silent drop.
        console.error('[webhook] tour ' + tourId + ' paid but only ' + free.length +
                      ' of ' + needed + ' vehicles free on ' + tourDate);
      }
    } catch (err) {
      console.error('[webhook] tour vehicle blocks failed:', (err as Error).message);
    }

    // Emails: owner alert + guest confirmation. Failure must not fail the
    // webhook, or Stripe retries a payment that already succeeded.
    const ROUTE_LABELS: Record<string, string> = {
      'north-east-md': 'North East, MD Run (Woody’s Crab House)',
      'gettysburg-york': 'Gettysburg / York History Route'
    };
    const TIERS: Record<number, number> = { 2: 450, 4: 700, 6: 900, 8: 1100 };
    const guests = Number(existing.group_size);
    const price = TIERS[guests] || 0;
    const paid = (Number(meta.depositCents) || 25000) / 100;
    const balance = price - paid;
    const routeLabel = ROUTE_LABELS[existing.route] || existing.route;
    const guestName = existing.name || customer.name || 'there';
    const esc = (s: unknown) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    try {
      await resend.emails.send({
        from: FROM,
        to: OWNER_EMAILS,
        ...replyTo(existing.email),
        subject: `TOUR BOOKED and PAID: ${existing.name}, ${guests} guests, ${routeLabel}, ${tourDate}`,
        html: `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;color:#111;background:#f6f6f6;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px;">
    <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FF6B00;margin:0 0 8px;">Tour Booked and Paid</p>
    <h1 style="font-size:22px;margin:0 0 20px;">${esc(existing.name)} paid the deposit</h1>
    <table style="width:100%;font-size:14px;line-height:1.9;">
      <tr><td style="color:#666;width:150px;">Date</td><td><strong>${esc(tourDate)}</strong></td></tr>
      <tr><td style="color:#666;">Route</td><td><strong>${esc(routeLabel)}</strong></td></tr>
      <tr><td style="color:#666;">Group size</td><td><strong>${guests} guests</strong></td></tr>
      <tr><td style="color:#666;">Vehicles held</td><td><strong>${needed}</strong></td></tr>
      <tr><td style="color:#666;">Deposit PAID</td><td><strong>$${paid.toLocaleString()}</strong></td></tr>
      <tr><td style="color:#666;">Balance due on the day</td><td><strong>$${balance.toLocaleString()}</strong></td></tr>
      <tr><td style="color:#666;">Email</td><td><a href="mailto:${esc(existing.email)}">${esc(existing.email)}</a></td></tr>
      <tr><td style="color:#666;">Phone</td><td><a href="tel:${esc(existing.phone)}">${esc(existing.phone)}</a></td></tr>
    </table>
    ${existing.notes ? `<p style="font-size:14px;background:#f6f6f6;border-radius:6px;padding:14px;margin:18px 0 0;"><strong>Notes:</strong><br>${esc(existing.notes)}</p>` : ''}
    <p style="font-size:13px;color:#666;line-height:1.8;margin:22px 0 0;border-top:1px solid #eee;padding-top:18px;">
      The vehicles for this date are already blocked on the calendar. This is a confirmed tour, not a request.
    </p>
  </div></body></html>`
      });
    } catch (err) {
      console.error('[webhook] tour owner email failed:', (err as Error).message);
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: existing.email,
        ...replyTo(OWNER_EMAILS[0]),
        subject: 'Your guided tour is booked',
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:Helvetica,Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;"><tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
    <tr><td style="padding:0 0 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
      <a href="https://cjfuntimerentals.com"><img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;"></a>
    </td></tr>
    <tr><td style="padding:36px 0;">
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:32px;letter-spacing:2px;margin:0 0 16px;">Your Tour Is Booked</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.65);line-height:1.8;margin:0 0 24px;">
        Thanks ${esc(guestName)}. Your deposit came through and your date is locked in. Chris guides every tour personally and will be in touch before the day with the meeting details.
      </p>
      <div style="background:#1a1a1a;border:1px solid rgba(255,107,0,0.3);border-radius:10px;padding:24px;margin-bottom:24px;">
        <table style="width:100%;font-size:14px;line-height:2;color:rgba(255,255,255,0.85);">
          <tr><td style="color:#888;width:150px;">Date</td><td>${esc(tourDate)}</td></tr>
          <tr><td style="color:#888;">Route</td><td>${esc(routeLabel)}</td></tr>
          <tr><td style="color:#888;">Group size</td><td>${guests} guests</td></tr>
          <tr><td style="color:#888;">Tour total</td><td>$${price.toLocaleString()}</td></tr>
          <tr><td style="color:#888;">Deposit paid</td><td style="color:#4ade80;font-weight:700;">$${paid.toLocaleString()}</td></tr>
          <tr><td style="color:#888;">Due on the day</td><td style="color:#FF6B00;font-weight:700;">$${balance.toLocaleString()}</td></tr>
        </table>
      </div>
      ${guests === 8 ? `<p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.8;margin:0 0 20px;background:#1a1a1a;border-radius:8px;padding:16px;">
        <strong style="color:#fff;">One thing for an 8 guest tour:</strong> it uses our whole fleet, which includes the Can-Am Spyder. Whoever drives that one needs a motorcycle endorsement on their license. Reply and let us know who is driving it and we will sort out the pairing.
      </p>` : ''}
      <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.8;margin:0 0 24px;">
        Rained out? You reschedule free. We would rather move your date than run a tour in the wet. Just reply to this email.
      </p>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);line-height:1.8;margin:0;">
        Questions before the day? Reply here and it reaches us directly.
      </p>
    </td></tr>
    <tr><td style="padding:28px 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
      <p style="font-size:11px;color:#555;margin:0;">CJ's Fun Time Rental &nbsp;&middot;&nbsp; Lancaster, PA &nbsp;&middot;&nbsp; Guided Slingshot Tours</p>
    </td></tr>
  </table></td></tr></table>
</body></html>`
      });
    } catch (err) {
      console.error('[webhook] tour guest email failed:', (err as Error).message);
    }

    return new Response('ok', { status: 200 });
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
    const depositCents = Number(meta.depositCents) || 0;
    const depositDollars = (depositCents / 100).toFixed(2).replace(/\.00$/, '');
    const paymentIntent = (obj.payment_intent as string) || null;
    const amountDiscount = (obj.total_details as Record<string, number>)?.amount_discount || 0;
    const savings = amountDiscount ? (amountDiscount / 100).toFixed(2) : null;

    // Get vehicle name from config.
    //
    // Two fleet vehicles share the exact display name "2016 Polaris Slingshot"
    // (slingshot_2020 = gray, slingshot_2016_red = red). `vehicleName` stays the
    // bare name because it is written to bookings.vehicle, where the legacy
    // fuzzy name matching still depends on it. `vehicleLabel` adds the color and
    // is what every human-facing email shows, so neither the customer nor the
    // owner has to guess which of the two cars a booking is for.
    let vehicleName = meta.vehicleKey || 'Vehicle';
    let vehicleLabel = vehicleName;
    // Transmission, read from the same fleet `specs` string the vehicle pages
    // use. Both 2016 Slingshots are 5-speed manuals. Until now no email said so,
    // so a renter who booked one only found out at handoff.
    let isManual = false;
    try {
      const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
      const v = data?.config?.vehicles?.[meta.vehicleKey];
      vehicleName = v?.name || vehicleName;
      vehicleLabel = v?.color ? `${vehicleName} (${v.color})` : vehicleName;
      const specs = (v?.specs || '').toLowerCase();
      isManual = specs.includes('manual') || specs.includes('5-speed');
    } catch { /* use key as fallback */ }

    // Look up the ID upload + rental-agreement acceptance for this booking.
    // Uploads happen before payment and are keyed by a client-generated
    // booking_ref carried through Stripe metadata.
    let idFields: Record<string, unknown> = {};
    const bookingRef = meta.bookingRef || '';
    if (bookingRef) {
      const { data: idUpload } = await supabase
        .from('id_uploads')
        .select('vehicle_type, canam_license_check_required, agreement_version, agreement_text, agreed_at, driver2_name, driver2_front_path, driver2_canam_license_check_required')
        .eq('booking_ref', bookingRef)
        .maybeSingle();
      if (idUpload) {
        const isCanam = idUpload.vehicle_type === 'canam' ||
          (meta.vehicleKey || '').includes('canam');
        idFields = {
          id_ref: bookingRef,
          id_upload_status: 'received',
          requires_canam_license_check: idUpload.canam_license_check_required || isCanam,
          canam_license_verified: false,
          agreement_version: idUpload.agreement_version || null,
          agreement_text: idUpload.agreement_text || null,
          agreed_at: idUpload.agreed_at || null
        };

        // Optional additional driver added during the booking flow. Free, so
        // nothing here touches price, total or any Stripe field.
        if (idUpload.driver2_name) {
          idFields.additional_driver_name = idUpload.driver2_name;
          idFields.driver2_id_upload_status = idUpload.driver2_front_path ? 'received' : 'pending';
          idFields.driver2_requires_canam_license_check =
            idUpload.driver2_canam_license_check_required || isCanam;
          idFields.driver2_canam_license_verified = false;
        }
      }
    }

    // Save booking
    await supabase.from('bookings').upsert({
      id: obj.id as string,
      email: email.toLowerCase(),
      name, phone,
      vehicle: vehicleName,
      vehicle_key: meta.vehicleKey || null,
      start_date: meta.startDate,
      end_date: meta.endDate,
      days: Number(meta.days) || 1,
      total: Number(total),
      savings: savings ? Number(savings) : 0,
      pickup_time: meta.pickupTime || null,
      stripe_session_id: obj.id as string,
      stripe_payment_intent: paymentIntent,
      deposit_cents: depositCents,
      status: 'confirmed',
      ...idFields
    });

    // Back-fill the booking id onto the upload record so admin can join them.
    if (bookingRef) {
      await supabase.from('id_uploads')
        .update({ booking_id: obj.id as string })
        .eq('booking_ref', bookingRef);
    }

    // Customer confirmation email
    const pickupTimeFormatted = formatTime(meta.pickupTime);
    const pickupMessage = pickupTimeFormatted
      ? `You'll receive an automated pickup reminder 48 hours before your rental with complete details (location, address, ${pickupTimeFormatted} pickup time, and instructions).`
      : "You'll receive an automated pickup reminder 48 hours before your rental with complete details (location, address, time, and instructions).";
    const customerHtml = baseEmail(`
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:36px;letter-spacing:3px;margin:0 0 8px;">You're Booked, ${name.split(' ')[0] || 'Rider'}!</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">Your reservation is confirmed. ${pickupMessage}</p>
      <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:32px;">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:16px;">Booking Summary</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${emailRow('Vehicle', vehicleLabel)}
          ${emailRow('Pick-up', meta.startDate + (pickupTimeFormatted ? ' at ' + pickupTimeFormatted : ''))}
          ${emailRow('Return', meta.endDate || meta.startDate)}
          ${emailRow('Duration', meta.durationType === 'hourly' ? (meta.hours || '3') + ' hours' : (meta.durationType === '10hr' || meta.durationType === '9hr') ? '9 hours' : meta.durationType === '24hr' ? '24 hours' : meta.days + ' day' + (Number(meta.days) === 1 ? '' : 's'))}
          ${savings ? emailRow('Discount', '- $' + savings) : ''}
          ${depositCents > 0 ? emailRow('Refundable Deposit', '$' + depositDollars + ' <span style="color:#888;font-size:12px;">(returned after drop-off)</span>') : ''}
          ${emailRow('Total', '<strong style="color:#FF6B00;font-size:16px;">$' + total + '</strong>')}
        </table>
        ${depositCents > 0 ? '<p style="font-size:12px;color:#888;margin:14px 0 0;line-height:1.6;">Your $' + depositDollars + ' reservation deposit is fully refunded to your card after the vehicle is returned in good condition.</p>' : ''}
      </div>
      ${isManual ? `
      <div style="background:rgba(255,183,0,0.08);border:1px solid rgba(255,183,0,0.3);border-radius:10px;padding:20px;margin-bottom:32px;">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#ffb700;margin-bottom:10px;">Manual Transmission</div>
        <p style="font-size:14px;color:rgba(255,255,255,0.8);line-height:1.7;margin:0;">
          Heads up: this Slingshot has a 5-speed manual transmission and requires experience driving a stick shift.
          If you have not driven a manual before, reply to this email before your pickup date and we will get you
          into our 2024 Slingshot with AutoDrive instead, at no charge.
        </p>
      </div>` : ''}
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
          ${emailRow('Vehicle', vehicleLabel + (isManual ? ' <span style="color:#ffb700;">(manual)</span>' : ''))}
          ${emailRow('Pick-up', meta.startDate + (pickupTimeFormatted ? ' at ' + pickupTimeFormatted : ''))}
          ${emailRow('Return', meta.endDate || meta.startDate)}
          ${emailRow('Type', meta.durationType === 'hourly' ? (meta.hours || '3') + ' hours' : (meta.durationType === '10hr' || meta.durationType === '9hr') ? '9 hours' : meta.durationType === '24hr' ? '24 hours' : meta.days + ' day' + (Number(meta.days) === 1 ? '' : 's'))}
          ${meta.deliveryDropoff === 'true' || meta.deliveryPickup === 'true' ? emailRow('Delivery', [meta.deliveryDropoff === 'true' ? 'Drop-off' : '', meta.deliveryPickup === 'true' ? 'Pickup' : ''].filter(Boolean).join(' + ')) : ''}
          ${depositCents > 0 ? emailRow('Deposit Held', '$' + depositDollars + ' <span style="color:#888;font-size:12px;">(refund from admin panel after return)</span>') : ''}
          ${idFields.additional_driver_name ? emailRow('Additional Driver', String(idFields.additional_driver_name) + ' <span style="color:#888;font-size:12px;">(free, ID on file)</span>') : ''}
          ${emailRow('Total', '$' + total)}
        </table>
      </div>
    `);

    await Promise.all([
      resend.emails.send({ from: FROM, to: email, subject: `✅ Booking confirmed — ${vehicleLabel} · ${meta.startDate}`, html: customerHtml }),
      resend.emails.send({ from: FROM, to: [Deno.env.get('OWNER_EMAIL') || 'chrisjohnson839@gmail.com', 'johnsonmilonda37@gmail.com'], subject: `🔔 New booking — ${name} · ${vehicleLabel} · ${meta.startDate}`, html: ownerHtml })
    ]);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    Sentry.captureException(error);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
