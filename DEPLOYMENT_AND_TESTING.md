# CJ Funtime Rental - Deployment & Testing Guide

## 🚀 What Was Fixed

### Bug Fix: Pricing Configuration
- **Problem**: Database pricing was set to all $0 values
- **Solution**: Restored correct pricing (hourly $30, 24hr $220 Slingshot / $200 Can-Am, etc.)
- **Status**: ✅ FIXED AND DEPLOYED

### New Feature: Real-Time Availability Checking
- **Problem**: Customers could select already-booked dates and only find out at checkout
- **Solution**: Added real-time availability checking that validates dates BEFORE payment
- **Status**: ⚠️ REQUIRES DEPLOYMENT (see below)

---

## 📦 DEPLOYMENT REQUIRED

You need to deploy the new `check-availability` Supabase Edge Function:

### Step 1: Deploy the Function

```bash
cd /Users/leandertoney/CJFuntimeRental
supabase functions deploy check-availability --project-ref yzdtevrwystezhbmgcwn
```

**If you get permission errors:**
1. Run: `supabase login`
2. Make sure you're logged in to the correct Supabase account
3. Try the deploy command again

### Step 2: Verify Deployment

Check that the function is live:
```bash
curl -X POST https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/check-availability \
  -H "Content-Type: application/json" \
  -d '{"vehicleKey": "slingshot_2022"}'
```

You should see: `{"bookings": [...]}`

---

## 🧪 HOW TO TEST (Stripe Live Mode)

### ⚠️ Important: Stripe Test Cards DON'T Work with Live Keys

Since your site uses **live Stripe keys**, test credit cards (4242 4242...) will NOT work. Here are your options:

### Option 1: Use a Real Card & Immediate Refund (RECOMMENDED)
**Best for: Quick testing without switching to test mode**

1. **Make a small test booking:**
   - Go to https://cjfuntimerentals.com
   - Click "Book Now"
   - Select 2022 Slingshot → 24 Hours → Tomorrow's date
   - Use your REAL credit card
   - **TIP**: Use a small amount or add a high discount code

2. **Complete the payment**
   - You'll be charged the full amount ($220)
   - You should receive confirmation emails
   - Booking should appear in your admin panel

3. **Immediately refund:**
   - Go to Stripe Dashboard → Payments
   - Find the test payment
   - Click "Refund" → Full refund
   - Money will be back on your card in 5-7 days

4. **Clean up:**
   - Go to your admin panel → Bookings
   - Delete or mark the test booking as cancelled

**Pros**: Fast, no config changes needed
**Cons**: Ties up funds temporarily, requires manual refund

---

### Option 2: Create Test Mode Environment (BETTER FOR FREQUENT TESTING)

**Best for: If you need to test frequently**

#### Step 1: Get Stripe Test Keys

1. Go to https://dashboard.stripe.com
2. **Toggle to "Test mode"** (top right switch)
3. Go to Developers → API Keys
4. Copy:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

#### Step 2: Create a Test Webhook

1. While still in Test mode: Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/webhook`
3. Events to send: `checkout.session.completed`
4. Click "Add endpoint"
5. Copy the **Signing secret**: `whsec_...`

#### Step 3: Update Supabase Environment Variables (Test Keys)

Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Add/Update these with TEST values:**
- `STRIPE_SECRET_KEY_TEST` = `sk_test_...` (your test secret key)
- `STRIPE_WEBHOOK_SECRET_TEST` = `whsec_...` (your test webhook signing secret)

#### Step 4: Update Frontend to Use Test Mode

Edit `/Users/leandertoney/CJFuntimeRental/stripe.config.js`:

```javascript
// ORIGINAL (Live mode)
var STRIPE_PUBLISHABLE_KEY = 'pk_live_51TJ1OVDlmCSCy5M3ISFEchuw5ay54JEJj7yCIhzRDF3ao6SQrQ2YOIlEE0E3mC3AX9MGmjfyWl2j40TzMwCsk92r002A7uTDMS';

// CHANGE TO (Test mode)
var STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_TEST_KEY_HERE';
```

#### Step 5: Update Checkout Function to Use Test Keys

Edit `/Users/leandertoney/CJFuntimeRental/supabase/functions/checkout/index.ts` line 39:

```typescript
// Add environment variable check
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY')!;
```

Edit `/Users/leandertoney/CJFuntimeRental/supabase/functions/webhook/index.ts` line 37-38:

```typescript
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') || Deno.env.get('STRIPE_WEBHOOK_SECRET');
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY')!;
```

#### Step 6: Deploy Updated Functions

```bash
supabase functions deploy checkout --project-ref yzdtevrwystezhbmgcwn
supabase functions deploy webhook --project-ref yzdtevrwystezhbmgcwn
```

#### Step 7: Test with Stripe Test Cards

Now you can use test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient funds**: `4000 0000 0000 9995`
- Expiration: Any future date (e.g., 12/28)
- CVC: Any 3 digits (e.g., 123)

**Pros**: Unlimited free testing, no refunds needed
**Cons**: Requires code changes, environment variables, function deployments

---

### Option 3: Use Declined Card for Testing UI Only

**Best for: Testing the booking flow without actual payment**

Use a card that will be **declined**:
- Card: `4000 0000 0000 0002` (Generic decline)

**What this tests:**
- ✅ Booking modal opens
- ✅ Date selection works
- ✅ Pricing calculates correctly
- ✅ Stripe checkout page loads
- ❌ Won't test email sending or booking creation (payment fails)

---

## ✅ Testing Checklist

### Basic Checkout Flow
- [ ] Open https://cjfuntimerentals.com
- [ ] Click "Book Now" button
- [ ] Modal opens showing 3 vehicles
- [ ] Select "2022 Polaris Slingshot SL"
- [ ] Click "Next: Choose Rental Type"
- [ ] Select "24 Hours"
- [ ] Pick tomorrow's date
- [ ] Verify price shows **$220**
- [ ] Click "Review & Pay"
- [ ] Summary shows correct vehicle, date, and price
- [ ] Click "Book & Pay Securely"
- [ ] Redirected to Stripe checkout
- [ ] Complete payment (using one of the methods above)
- [ ] Redirected to booking success page
- [ ] Receive confirmation email at your email
- [ ] Receive owner alert at bookings@cjfuntimerentals.com

### Availability Checking (NEW!)
- [ ] Create a test booking for tomorrow
- [ ] Try to create ANOTHER booking for the same vehicle/date
- [ ] You should see error: "This vehicle is already booked from..."
- [ ] Error appears BEFORE payment (in Step 2 → Step 3 transition)

### Blocked Dates
- [ ] Go to admin panel → Calendar
- [ ] Block tomorrow's date
- [ ] Try to book that date
- [ ] Should see error: "Sorry, [date] is unavailable"

---

## 🔍 Troubleshooting

### "Something went wrong starting checkout"
- Check browser console (F12 → Console tab)
- Verify pricing is not $0 in admin panel
- Verify Stripe publishable key is correct in stripe.config.js

### "This vehicle is already booked" but no booking exists
- Check admin panel → Bookings to verify
- Clear browser cache and try again
- Verify the `check-availability` function is deployed

### No confirmation emails received
- Check Stripe Dashboard → Events for `checkout.session.completed`
- Check if webhook fired successfully
- Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase
- Check spam folder

### Payment succeeds but no booking in database
- This means webhook failed
- Check Stripe Dashboard → Webhooks → [your webhook] → Attempts tab
- Look for error messages
- Verify webhook URL is correct: `https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/webhook`

---

## 📝 Summary for Client

**What to tell Chris:**

> Hi Chris,
>
> I've fixed the checkout issue and added a major improvement:
>
> **What Was Fixed:**
> - Pricing bug resolved (was showing $0, now shows correct rates)
> - Added real-time availability checking so customers know BEFORE payment if dates are taken
>
> **What You Need to Do:**
> 1. Deploy the new availability function (see DEPLOYMENT REQUIRED section above)
> 2. Test the checkout flow (I recommend Option 1: use a real card and immediately refund)
>
> **How to Test:**
> - Make a booking with your real credit card for $220
> - Verify you get confirmation emails
> - Go to Stripe Dashboard → Payments and refund it immediately
> - Money returns to your card in 5-7 days
>
> **New Feature:**
> Customers now see an error message if they try to book dates that are already taken - BEFORE they enter payment info. This prevents confusion and failed bookings.
>
> Let me know once you've tested!

---

## 🔒 Security Note

**IMPORTANT**: The `.env` file contains production secrets and should NEVER be committed to git.

If you need to share environment variables:
1. Use `.env.example` with placeholder values
2. Share actual secrets via secure channels (1Password, encrypted email, etc.)
3. Never paste secrets in Slack, email, or other unsecured channels

---

## 📞 Need Help?

If you encounter any issues during deployment or testing, provide:
1. **Error message** (exact text)
2. **What step** you were on
3. **Screenshot** of browser console (F12 → Console tab)
4. **Stripe Dashboard events** (if payment-related)
