# CJ Funtime Rentals - Project State (Updated 2026-06-30)

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

### Pricing Configuration ✅ CONFIRMED (Updated 2026-06-30)
Live pricing in `site_config` table:
- **Slingshot**: 10hr $180, 24hr $250
- **Can-Am**: 10hr $180, 24hr $250
- **Hourly**: $35/hr (3hr minimum)
- **Multi-day tiers**: Tiered discounts (10-24% off depending on duration)
- **Delivery**: $50 within 30 miles

**Previous pricing** (before June 30):
- Slingshot: 9hr $175, 24hr $220
- Can-Am: 9hr $160, 24hr $200
- Hourly: $30/hr

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
**Status:** ✅ LIVE (Deployed 2026-06-30 at 12:25pm ET)

**IMPORTANT - Deployment Timeline:**
- **June 22, 2026:** Email functions committed locally with message "pending deployment"
- **June 22-29:** Commits remained local, NOT pushed to GitHub
- **June 30, 12:25pm ET:** All commits pushed, GitHub Actions deployed functions
- **Actual live date:** June 30, 2026 (NOT June 29 as previously documented)
- **Impact:** 8-day deployment delay. No automated emails sent June 22-29.

**✅ Completed:**
- 3 email Edge Functions deployed and responding (send-pickup-reminders, send-return-instructions, send-mid-rental-checkins)
- All 3 functions added to GitHub Actions auto-deploy workflow
- All 3 functions added to supabase/config.toml
- pg_cron jobs created and active
- Duplicate pickup reminder eliminated (old system unscheduled)
- Pickup time fields deployed to database
- Booking confirmation emails working (via webhook)
- Migration 20260622000003_email_cron_jobs.sql applied
- Sentry error monitoring added to all 8 Edge Functions (deployed June 30)

**✅ Now done:**
- Monitoring via Sentry (1.0 error sample rate, 0.2 trace sample rate)
- Health check system runs every 15 minutes

### Phase 2: ID Upload + Rental Agreement (Contract)
**Status:** ✅ DEPLOYED (2026-07-06 at 19:35 ET)

Handles government-ID upload (front+back) and a rental-agreement acceptance step in
the booking flow. Upload + store for **manual** review only — NOT automated validation.

**Security model (the important part):**
- Private Supabase Storage bucket `booking-ids` (`public = false`, 10 MB/file,
  jpeg/png/webp/pdf). **No Storage RLS policies for anon/authenticated** → those roles
  get zero access. Only `service_role` (server-side Edge Functions) can read/write.
- Browser NEVER touches Storage directly. Uploads go through the `id-upload` Edge
  Function (service role); admin views via short-lived **signed URLs** minted by the
  admin function (admin-token gated).

**Flow:** upload happens BEFORE payment (booking row doesn't exist yet). A client
`bookingRef` (UUID) links the upload; it rides Stripe metadata; the webhook copies
`id_ref` + agreement snapshot onto the booking and sets `requires_canam_license_check`.

**Can-Am rule:** upload step states "driver's license required (state ID not accepted)"
and flags the booking. Admin shows a **⚠️ Verify M endorsement** badge + a "confirm M
endorsement" button. The system does NOT read the license — manual check only.

**Hard gate:** `checkout` rejects any session without a completed `id_uploads` row for
the `bookingRef` (fail-closed; also neutralizes the legacy modal path).

**Files:** migration `20260701000001_id_uploads_and_contract.sql`; `functions/id-upload/`;
`functions/_shared/rental-agreement.ts` (swap in the real contract here + bump version;
mirror the copy in `checkout.html`); edits to `checkout`, `webhook`, `admin` functions,
`admin/*`, `checkout.html`, `booking-widget.js/.css`, `booking-success.html`,
`config.toml`, deploy workflow.

**GO-LIVE (still gated — requires explicit approval):**
1. Apply the migration (creates the private bucket + tables).
2. Deploy functions (`id-upload` is added to GitHub Actions).
3. **Deploy ordering to avoid a checkout-outage window:** ship the new `checkout.html`
   (Netlify) and `id-upload` BEFORE the gated `checkout` function — old cached
   `checkout.html` sends no `bookingRef` and the gated `checkout` would reject it.
4. **Prove anon cannot read an ID:** upload a test ID, then
   `curl -i https://yzdtevrwystezhbmgcwn.supabase.co/storage/v1/object/public/booking-ids/<ref>/front.jpg`
   → expect 400/404; and the authenticated object path with the anon apikey → 403.
   Then confirm the admin signed URL returns 200.
5. Demo the Can-Am **Verify M endorsement** flag/button in admin.

**DEPLOYMENT VERIFIED (2026-07-06):**
- ✅ Migration applied: bucket `booking-ids` created (public=false, 10MB limit)
- ✅ Table `id_uploads` created with zero RLS policies for anon/authenticated
- ✅ Bookings table columns added: id_ref, agreement_version, agreed_at, etc.
- ✅ Edge Functions deployed: id-upload, updated checkout, webhook, admin
- ✅ Security test passed: public URL returns 400 (bucket not public)
- ✅ Test upload exists: booking_ref 837af79e-57b5-4ba5-ab6c-d8aad31dd019
- ⏳ Production booking flow test pending (user to test)
- ⏳ Can-Am M endorsement verification workflow pending (user to test)

## Deployment Workflow

### Edge Functions Auto-Deployed (via GitHub Actions - Updated 2026-07-06)
1. `config`
2. `checkout`
3. `webhook`
4. `admin`
5. `send-pickup-reminders` ✅
6. `send-return-instructions` ✅
7. `send-mid-rental-checkins` ✅
8. `health-check` ✅
9. `id-upload` ✅ (Phase 2)

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

## Deployment Verification Protocol (MANDATORY)

**CRITICAL:** A task is NOT done until code is pushed to GitHub AND verified live on the domain.

### Every Code/Config Change MUST Include:

1. **Commit locally** with clear, descriptive message
2. **Push to GitHub IMMEDIATELY:** `git push origin main`
   - Do NOT let commits pile up locally for days
   - Do NOT wait to push multiple changes at once (unless explicitly planning a batch deploy)
3. **Verify deployment succeeded** (wait 2-3 minutes for auto-deploy):
   ```bash
   # For static site changes (Netlify):
   curl -I https://cjfuntimerentals.com/[changed-path]

   # For Edge Functions (Supabase via GitHub Actions):
   # Check GitHub Actions tab for deploy status
   # OR list functions: supabase functions list --project-ref yzdtevrwystezhbmgcwn

   # For 410 redirects:
   curl -I https://cjfuntimerentals.com/news/test  # Should return 410

   # For security headers:
   curl -I https://cjfuntimerentals.com | grep X-Frame-Options  # Should show DENY

   # For pricing changes:
   curl -s https://cjfuntimerentals.com/config | # Check pricing in config endpoint
   ```
4. **Document verification** in commit message, session notes, or CLAUDE.md

### "Committed Locally" ≠ "Deployed"

**If commits sit unpushed, the following happens:**
- ❌ Netlify serves old version (static site not updated)
- ❌ GitHub Actions can't run (Edge Functions not deployed)
- ❌ Changes don't reach production customers
- ❌ Documentation becomes incorrect (claims things are live when they're not)
- ❌ Deployment drift increases (harder to track what's actually live)

### Red Flags - When to Push Immediately:

- ⚠️ "Pending deployment" in commit messages → Push immediately OR mark task as incomplete
- ⚠️ Multiple days between commit and push → High risk of deployment drift
- ⚠️ No live URL verification after commit → Can't confirm changes took effect
- ⚠️ CLAUDE.md claims something is "✅ LIVE" without curl/test verification → Likely incorrect

### Recent Example of Deployment Drift (June 2026):

**What happened:** Email automation functions were committed June 22 with message "pending deployment" but not pushed to GitHub until June 30 (8 days later). During that time:
- Documentation claimed email automation was "✅ LIVE (Verified 2026-06-29)"
- Reality: Functions only deployed June 30, 2026
- Impact: No automated emails sent for 8 days, customers didn't receive scheduled reminders

**Lesson:** Verify deployment with actual tests, not assumptions. Push to GitHub immediately after committing.

## Gotchas & Lessons Learned

1. **Date Format Matters**: Database expects ISO (YYYY-MM-DD), not formatted strings
2. **Test Data Pollution**: Always filter `test_*` IDs and `@example.com` emails
3. **Schema Access**: `cron.job` table not exposed via PostgREST
4. **Connection Strings**: Supabase pooler requires specific format, direct connection attempts failed
5. **Gating Model**: Separate READ (just do it) from WRITE (get approval) operations
6. **Deployment Drift**: Commits left unpushed create false "live" status. Always push immediately and verify.
7. **Config Changes**: Database pricing/config changes need audit trail. Use migrations or commit scripts, not manual dashboard edits.
