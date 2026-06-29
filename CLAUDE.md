# CJ Funtime Rentals - Project State (Updated 2026-06-29)

## Critical Information

**This is a LIVE PRODUCTION site** for a paying $249/month retainer client. A previous pricing bug reached real customers. All changes must be thoroughly verified before deployment.

**My role:** I read and modify code. User (Leander) doesn't touch code/databases directly - I handle all technical operations including:
- ✅ READ operations: Database queries, status checks, log reads, deployment listings
- 🔒 WRITE operations (require explicit approval): Migrations, deployments affecting customers/money, price changes

## Supabase Access

**I have full access:**
- Service Role Key: Available in `.env` as `SUPABASE_SERVICE_ROLE_KEY`
- Can query via Supabase client/REST API
- Can deploy Edge Functions
- Cannot query `cron.job` table directly via PostgREST (schema not exposed)

**Limitation discovered 2026-06-29:**
The `cron.job` table exists in the `cron` schema and is not accessible via Supabase REST API or standard client queries. Direct PostgreSQL connection attempts failed due to pooler authentication issues. For pg_cron verification, need alternative approach (custom Edge Function with raw SQL, or user dashboard access).

## Current Production State (Verified This Session)

### Database Schema ✅ CONFIRMED
- **Pickup time fields DEPLOYED** to production `bookings` table:
  - `pickup_time` (TEXT)
  - `pickup_location` (TEXT)
  - `pickup_instructions` (TEXT)
- Migration: `20260622000001_email_automation_fields.sql` applied

### Pricing Configuration ✅ CONFIRMED
Live pricing in `site_config` table matches expected values:
- **Slingshot**: 9hr $175, 24hr $220
- **Can-Am**: 9hr $160, 24hr $200
- **Hourly**: $30/hr (3hr minimum)
- **Multi-day tiers**: Configured correctly
- **Delivery**: $50 within 30 miles

### Email Edge Functions ✅ CONFIRMED DEPLOYED
All 3 scheduled email functions are LIVE and responding:
- `send-pickup-reminders` - Status 200
- `send-return-instructions` - Status 200
- `send-mid-rental-checkins` - Status 200

### pg_cron Status ✅ VERIFIED (2026-06-29)
**Helper function created:** `public.get_cron_jobs()` - Read-only RPC to query cron.job table

**5 Active Cron Jobs Confirmed:**
1. `send-pickup-reminders` - Daily 9:00 AM (48h before rental) - NEW SYSTEM
2. `send-return-instructions` - Daily 10:00 AM (24h before return) - NEW SYSTEM
3. `send-mid-rental-checkins` - Daily 11:00 AM (day 2 of rental) - NEW SYSTEM
4. `post-rental-followup` - Daily 2:00 PM (post-rental Google review + COMEBACK10) - OLD SYSTEM, **INTENTIONALLY KEPT**
5. `refresh-google-reviews` - Daily 6:00 AM (update review cache)

**Duplicate Eliminated:** Old `pickup-reminders` job (9 AM) was unscheduled 2026-06-29 to prevent duplicate emails.

**IMPORTANT:** `post-rental-followup` (OLD) must be kept - it owns the COMEBACK10 review loop and has no replacement in the new system. Do not remove in future cleanups.

### Data Quality Issues Found

**NULL pickup_time bookings:** 4 total (1 future, 3 past)

**Future (needs action):**
- James Houck (marnie73rn@msn.com) - July 6, 2026 - ✅ Email sent requesting time

**Past (already completed, no action needed):**
- Chris Johnson - April 17, 2026
- Brenda Lee - June 13, 2026
- Milonda Johnson - June 25, 2026

**Root cause:** These bookings were created before pickup time feature was fully functional.

## Phases Status

### Phase 0: Security & Infrastructure
**Status:** NEEDS VERIFICATION (not confirmed this session)

Items requiring manual confirmation:
- 👤 STRIPE_WEBHOOK_SECRET set in Supabase? (not verified)
- 👤 Webhook registered in Stripe dashboard? (not verified)
- 👤 Stripe in live mode? (assumed yes, not verified)

### Phase 0.5: Booking Flow Redesign
**Status:** PARTIALLY COMPLETE

**✅ Completed:**
- Pickup time field added to booking flow
- Webhook saves pickup_time to database
- Date filtering bug fixed (ISO format enforced)
- Test data filtering deployed (excludes test_* and @example.com)

**⚠️ Incomplete:**
- "FROM $175" hardcoded in static HTML (only partially fixed)
- 14 landing pages still have hardcoded pricing
- Vehicle-locked booking redesign status unknown (needs verification)
- Inline calendar deployment status unknown

### Phase 1: Email Automation
**Status:** ✅ LIVE (Verified 2026-06-29)

**✅ Completed:**
- 3 email Edge Functions deployed and responding (send-pickup-reminders, send-return-instructions, send-mid-rental-checkins)
- All 3 functions added to GitHub Actions auto-deploy workflow
- All 3 functions added to supabase/config.toml
- pg_cron jobs verified active via get_cron_jobs() helper function
- Duplicate pickup reminder eliminated (old system unscheduled)
- Pickup time fields deployed to database
- Booking confirmation emails working (via webhook)
- Migration 20260622000003_email_cron_jobs.sql confirmed applied

**❌ Not done:**
- No monitoring/logging for scheduled emails (no failures logged, no send confirmations)

## Deployment Workflow

### Edge Functions Auto-Deployed (via GitHub Actions - Updated 2026-06-29)
1. `config`
2. `checkout`
3. `webhook`
4. `admin`
5. `send-pickup-reminders` ✅
6. `send-return-instructions` ✅
7. `send-mid-rental-checkins` ✅

### Edge Functions NOT Auto-Deployed (Manual Deployment Only)
1. `leads`
2. `follow-up` (used by post-rental-followup cron job)
3. `reminders` (DEPRECATED - old pickup system, function exists but cron job unscheduled)
4. `google-reviews`
5. `check-availability`

## Known Issues & Technical Debt

1. **"FROM $175" Hardcoded Pricing**
   - Location: Static HTML files + 14 landing pages
   - Risk: If pricing changes, these won't update automatically
   - Fix: Replace with dynamic config loading

2. **Email Automation Uncertain Status**
   - Functions exist but cron scheduling unverified
   - No way to confirm emails are being sent daily
   - Need: Monitoring/logging solution

3. **Test Data Cleanup**
   - 4 bookings had NULL pickup_time
   - Past bookings completed successfully despite missing data
   - Suggests pickup time wasn't critical for those rentals

4. **GitHub Actions Incomplete**
   - Only deploys 4 of 9 Edge Functions
   - Manual deployment required for email automation functions

## Verified Email Infrastructure

**Resend Configuration:**
- API Key: Set in `.env`
- Verified domain: `bookings@cjfuntimerentals.com`
- ✅ Successfully sent email to James Houck (2026-06-29)
- Email ID: `f02eea97-d662-4396-97e4-8b548ef32fad`

**Email Templates:**
- Booking confirmation (customer) ✅ Working
- Booking alert (owner) ✅ Working
- Pickup reminders (templated) ✅ Code exists
- Return instructions (templated) ✅ Code exists
- Mid-rental check-ins (templated) ✅ Code exists

## Files & Locations

### Configuration
- `.env` - All secrets (Supabase, Stripe, Resend)
- `db.js` - Database access for localhost
- `emails.js` - Email templates and sending logic

### Edge Functions (Supabase)
- `supabase/functions/webhook/index.ts` - Stripe webhook handler
- `supabase/functions/admin/index.ts` - Admin API
- `supabase/functions/send-pickup-reminders/index.ts`
- `supabase/functions/send-return-instructions/index.ts`
- `supabase/functions/send-mid-rental-checkins/index.ts`

### Migrations
- `supabase/migrations/20260622000001_email_automation_fields.sql` ✅ Applied
- `supabase/migrations/20260622000002_email_templates.sql` Status unknown
- `supabase/migrations/20260622000003_email_cron_jobs.sql` ⚠️ Status unknown
- (Plus 8 earlier migrations)

### Frontend
- `stripe-checkout.js` - Booking flow (lines 492-494 send pickup time)
- `admin/admin.js` - Admin dashboard logic

## Next Session Priorities

1. **Verify pg_cron status** - Need alternative method to query cron.job table
2. **Deploy email functions to GitHub Actions** - Add 3 functions to auto-deploy workflow
3. **Fix hardcoded pricing** - Replace static "$175" with dynamic config
4. **Monitor email sends** - Add logging for scheduled emails
5. **Follow up with James Houck** - Confirm pickup time received via email reply

## Gotchas & Lessons Learned

1. **Date Format Matters**: Database expects ISO (YYYY-MM-DD), not formatted strings
2. **Test Data Pollution**: Always filter `test_*` IDs and `@example.com` emails
3. **Schema Access**: `cron.job` table not exposed via PostgREST
4. **Connection Strings**: Supabase pooler requires specific format, direct connection attempts failed
5. **Gating Model**: Separate READ (just do it) from WRITE (get approval) operations
