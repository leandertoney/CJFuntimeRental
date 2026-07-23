# CJ Funtime Rentals - Project State (Updated 2026-07-23)

## Session 2026-07-23: $100 refundable reservation deposit — CODED, NOT YET DEPLOYED

Client request (Milonda, Jul 18 email): (1) shareable booking link — nothing to build, site is public, direct vehicle-page links + "Book Now" already work; (2) add a $100 reservation fee refunded after the vehicle comes back.

**Implementation (charge + auto-refund; a true Stripe hold was rejected because uncaptured PaymentIntents expire in 7 days, which breaks bookings made further out):**
- `supabase/functions/checkout/index.ts` — adds a "Refundable Reservation Deposit" line item (default $100, config-driven via `site_config.pricing.deposit = { enabled, amount }`, default ON when the key is absent) + `metadata[depositCents]`. Deposit is NOT part of the baseCents price-verification check.
- `supabase/functions/webhook/index.ts` — stores `deposit_cents` + `stripe_payment_intent` on the booking; customer + owner emails show the deposit and explain the refund.
- `supabase/functions/admin/index.ts` — new `POST /bookings/:id/refund-deposit`: partial refund of `deposit_cents` on the payment intent (Stripe Idempotency-Key `deposit-refund-{bookingId}`; falls back to resolving the payment intent from the checkout session for older rows), records `deposit_refunded_at/by` + refund id. 409 if already refunded.
- `admin/index.html` + `admin/admin.js` — deposit section in the booking modal ("Vehicle returned — refund deposit" button, confirm dialog), held/refunded badges in the bookings table.
- `checkout.html` — deposit row + "Total Due Today" + refund explainer in the order summary (reads the same config key).
- `booking-widget.js` — "+ $100 refundable deposit" note on the vehicle-page price display.
- Migration `20260723000001_deposit_columns.sql` — adds `deposit_cents`, `deposit_refunded_at`, `deposit_refund_id`, `deposit_refunded_by`, `stripe_payment_intent` to `bookings`.

**🔒 Deploy checklist (money movement — run in this order):**
1. Apply the migration to the live DB (webhook writes the new columns; deploy webhook only after the columns exist).
2. Push → CI deploys Edge Functions + Netlify deploys the static site.
3. Run a real test booking end-to-end: pay, confirm deposit line item + emails, then refund the deposit from the admin panel and confirm the partial refund in Stripe.

**Known caveat:** a percentage promo code applies across the whole Checkout session, so it would also discount the deposit line item (Stripe Checkout has no per-line-item coupon exclusion). Current live promo usage is flat/COMEBACK10-style — verify behavior on the test booking if promo codes matter.

## Session 2026-07-15/16 (continued): checkout price verification + fleet-data consolidation — DEPLOYED & VERIFIED LIVE

Two more commits same continued session, both deployed and verified live:

**Commit d8e0333 — server-side checkout price verification (the highest-severity fix of the session):**
`supabase/functions/checkout/index.ts` had a comment claiming "server-side price verification using config pricing" but the actual code just charged whatever `baseCents` the client sent — zero real verification. Fixed: the function now independently recomputes the expected rental price (mirroring `booking-widget.js`'s `calcPrice()` — same duration-type/tier logic, same hardcoded-floor defaults since the live `site_config.pricing.*` fields are currently zeroed out) and rejects the checkout with a 409 if the client's number doesn't match within a few cents. **Verified safe** against every real historical booking (including bookings priced under older, since-changed rates — confirmed the check is point-in-time, not retroactive) and all duration-type/tier-boundary combinations before shipping. Delivery fee gets the same recomputation but is **log-only (Sentry), not blocking** — a real historical booking (Lamar's) was found with `deliveryDropoff/Pickup: true` in Stripe metadata but no delivery fee actually charged, root cause not understood, so blocking on that specific mismatch risked rejecting a legitimate future customer. **Watch Sentry for `Checkout delivery fee mismatch` — if it recurs, that's the signal to dig into root cause as its own task.**

**Also in d8e0333:**
- Fixed the `index.html` config race condition: the live `/functions/v1/config` script was `async` and could finish before OR after the static `site-config.js` fallback that follows it in the DOM, non-deterministically overwriting `window.SITE_CONFIG` either way. Made the live fetch a normal blocking script (guaranteed to run first) and `site-config.js` fallback-only (`window.SITE_CONFIG = window.SITE_CONFIG || {...}`) so it only ever fills in if the live fetch genuinely failed.
- Rebuilt `vehicle-detail.js`'s hardcoded `VEHICLES` fallback: was missing the red 2016 Slingshot entirely, had wrong years/prices, and had a dead field name bug (`rate9hr` was set but `getPricingForVehicle()` reads `rate10hr`, so the per-vehicle override silently never applied — always fell through to the `|| 180` default). **Note: nothing on the live site actually triggers this panel right now (`openVehicleDetail`/`data-vehicle-detail` has zero callers) — this fix is precautionary, not currently customer-facing.**
- Regenerated `site-config.js` from the live DB (previous "regenerated" pass on 2026-07-15 only fixed prose text, not the underlying vehicle/pricing data — this pass fixed both).
- Fixed the `check-availability` Edge Function's vehicle-matching bug (same root cause as the admin reschedule fix in b97dd79 below) — **not in the CI auto-deploy list**, so this fix is committed but not live; doesn't matter today since the function also has zero live callers (confirmed — nothing calls it, `booking-widget-v2.js`'s "Check Availability" button is a stubbed `// TODO`).
- Swept every live page still showing "2020"/"2022" Polaris Slingshot → "2016"/"2024": `booking-success.html`, `full-site.html`, 6 SEO landing pages, plus the local (non-production) AI-assistant prompt in `server.js`.

**Commit 3251e9b — client-side fleet-data consolidation (deliberately scoped narrow, no Edge Function/Stripe path touched):**
- `checkout.html`: delivery fee display now reads `SITE_CONFIG.pricing.delivery.fee` instead of a literal `"$50"` string.
- `booking-success.html`: now loads the live config script and reads `SITE_CONFIG.vehicles[key]` first; the hardcoded `FALLBACK_VEHICLES` map only fires if that fetch fails.
- All 4 `vehicles/*.html` detail pages: the "$180 / From 10 Hours" stat badge now syncs from `SITE_CONFIG.pricing.tenhrRate` via a small inline script instead of being frozen text.
- Fixed 2 more stale year mentions missed in the first sweep (Allentown + trike landing pages, one `index.html` alt tag).
- **Deliberately left alone:** SEO landing page `<title>`/meta/JSON-LD text (needs to stay static/crawler-visible, not a bug); all confirmed-dead files (`full-site.html`, `stripe-checkout.js`, `booking-widget-v2.js`, `test-*.js`, `server.js`/`emails.js`/`db.js` — reachable by direct URL on Netlify but unlinked/unindexed, not worth a correctness pass on dead code); the DB's own `copy.how.step1Body` field (confirmed stale years in the actual `site_config` table, but confirmed `index.html`'s "How It Works" section doesn't read that field at all — it's hardcoded correctly inline — so the DB field is orphaned/unused data, not worth a write).

**Root cause of the whole day's "why does it keep getting worse" feeling:** the fleet is genuinely 4 vehicles (2016 gray Slingshot, 2016 red Slingshot, 2024 orange Slingshot, 2021 Can-Am), but vehicle name/year/price data was duplicated across ~10 files that were meant to mirror `site_config` but drifted independently over time as the fleet/pricing changed. Nothing was ever actually charging customers wrong — Stripe/checkout pricing was always correct — it was *display* data (labels, fallback panels, static snapshots) that drifted. That's now consolidated: the two highest-stakes paths (what a customer is *charged*, and what vehicle *name* they see pre-purchase) both read live from the DB with the DB as the only real source of truth; hardcoded copies are fallback-only, never authoritative.

**Also in this session, from a separate Milonda email thread (Jul 15, unrelated to the vehicle-naming investigation):**
- Lamar Williams Jr's booking rescheduled Sat 7/18 → Sun 7/19 per his phone request to Milonda (see full detail in the session below — same booking, same fix).
- Milonda (johnsonmilonda37@gmail.com) added as a second recipient on new-booking owner alert emails, per her request in that thread — done in the same webhook change documented below.
- Milonda replied to/closed that thread herself; no outstanding action there.

## Session 2026-07-15: Lamar reschedule + self-service admin reschedule — DEPLOYED & VERIFIED LIVE

Commits 8737c3c (vehicle color labels — carried over from prior session) and b97dd79, deployed via GitHub Actions run 29453524962 (all steps green, including new "Apply vehicle_key migration" step), verified live.

**Lamar Williams Jr's booking rescheduled Sat 2026-07-18 → Sun 2026-07-19** (booking `cs_live_b1hnTogIFJQ9e76dkWflmsBkA8WKnkjkSmwQhusdzfYdqPpkAVhTOv8AtN`, gray 2016 Slingshot / `slingshot_2020`, $180, no delivery). Verified before changing: target date free (no booking/block/blockedDates conflict), price flat (codebase has no day-of-week/weekend pricing anywhere — confirmed by grep, not assumed). Verified after: Saturday freed, Sunday shows only Lamar, dedup stamps still NULL (no stale-date email risk), vehicle/total/all other fields unchanged.

**New: self-service "Reschedule" in admin.** The booking detail modal already had editable date fields wired to `PUT /bookings/:id` (built 2026-07-09), but it was two fields inside a large multi-field form with one shared Save button — not a clear one-click action, and it had no price-change guardrail. Now:
- Dedicated orange "Reschedule" section/button in the booking modal, separate from the general "Save" button (which now only handles pickup/return details, never dates).
- Same backend endpoint, extended: refuses date changes that would silently change the price (`ratePerDay × days` vs. `total`) unless the admin explicitly confirms (`confirmPriceChange: true`, surfaced as a JS `confirm()` dialog client-side). **Skipped for bookings with `delivery_dropoff`/`delivery_pickup` set** — the delivery fee is a separate Stripe line item folded into `total`, not separately stored on the booking row, so it can't be cleanly subtracted for the check without a false positive. Flat pricing today means this guardrail is inert in practice; it's there for if/when non-flat pricing is ever added.
- Availability/conflict logic unchanged in behavior, but fixed in accuracy (see below).

**Bug fixed: vehicle name collision in reschedule/blocking logic.** `bookings.vehicle` only ever stored the display NAME (e.g. "2016 Polaris Slingshot"), never the `site_config` key — and two fleet vehicles share that exact name (`slingshot_2020` = gray, `slingshot_2016_red` = red). The reschedule conflict check and `check-availability` both matched vehicles by fuzzy name substring, so they could not tell the two 2016 Slingshots apart (a false conflict or false clear was possible, though it never actually misfired in practice before this fix). Fixed: new `bookings.vehicle_key` column (migration `20260715000001_vehicle_key_column.sql`, applied via GitHub Actions the same way as the 2026-07-09 email-dedup migration — added as its own idempotent step in `deploy-supabase.yml`, since that workflow does NOT auto-apply every file in `supabase/migrations/`, only the steps explicitly listed). Webhook now stores `vehicleKey` from Stripe metadata onto every new booking. Reschedule conflict check uses exact `vehicle_key` match when both sides have one, falling back to the old fuzzy name match only for bookings created before this change (which have `vehicle_key = NULL`).

**Known residual gap (not fixed, out of scope this session):** `supabase/functions/check-availability/index.ts` (used by the public booking page) has the *same* fuzzy name-matching bug in its own separate implementation, AND independently always returns `bookings: []` for any real query — its `vehicleKey`-vs-`vehicle` matching (line 40-42) never actually succeeds against real data, so the public availability checker is effectively a permanent no-op right now. This was discovered while verifying Lamar's fix but was not touched (it doesn't affect the admin path, which has its own correct logic) — needs its own fix + verification pass.

**Melinda added to new-booking alert emails** (johnsonmilonda37@gmail.com), per Chris Johnson's request — she wants a second set of eyes on new bookings. Added as a second `to:` recipient alongside `OWNER_EMAIL` in both the live webhook (`supabase/functions/webhook/index.ts`) and the legacy local `emails.js` (kept in sync even though `emails.js`/`server.js` isn't the live path, to avoid drift). Scope: only the "new booking" alert — the automated pickup-reminder/return-instructions/mid-rental-checkin emails still go to the customer only, unchanged.

**Also carried over from earlier same-day work (see prior session entry below for full detail):** fixed a hardcoded placeholder phone number `(717) 123-4567` in the pickup-reminder and mid-rental-checkin email templates → real business number `(717) 203-5778`; verified the pickup address (Manor Shopping Center, 1234 Millersville Pike, Lancaster, PA 17603) is a real, correct location via independent public records (LoopNet/CBRE/Yelp), not a placeholder; added distinguishing `color` fields (Gray/Red/Orange) to the three Slingshots in `site_config` so the admin vehicle-blocking dropdown no longer shows two identical "2016 Polaris Slingshot" entries.

## Session 2026-07-09 (part 2): Defect-Fix Sprint — ALL DEPLOYED & VERIFIED LIVE

Four-phase fix plan executed, pushed (commits d97d403, 6c7d252, fe07b51), deployed via GitHub Actions run 28998088692 (all steps green), and verified live:

**Phase A — Admin login + reschedule:**
- **Login "500 with correct credentials" SOLVED — it was a test artifact, not a server bug.** The sandbox shell escapes `!` as `\!` inside curl JSON bodies; both admin passwords contain `!`, so every correct-credential curl test sent invalid JSON → `req.json()` threw → 500. Wrong-password test bodies had no `!` → clean 401. Browser dashboard login was never broken. Verified live: login → HTTP 200 + token; /me → 200. New `detail` field on 500s surfaced the root cause instantly. **Lesson: when curling with passwords containing `!`, write body bytes via `printf '\041'` octal escape to a temp file, use `--data @file`; pass auth headers via `curl -K configfile` (`$(cat …)` doesn't expand in this sandbox's headers).**
- **`PUT /bookings/:id` handler added** to admin function (was 404). Whitelisted fields incl. start_date/end_date; on date change: ISO validation (verified live → 400 on bad format), conflict check vs confirmed bookings (fuzzy vehicle match) + vehicle_blocks + blockedDates → 409; recomputes `days`; clears all 3 email dedup stamps so reminders re-fire for new dates. Verified live: authed no-op PUT → 200 `{ok:true}`. Admin modal now has editable Rental Dates fields (admin/index.html + admin.js). **Reschedules no longer need direct DB access.**

**Phase B — Email idempotency + safety (migration `20260709000001_email_dedup_columns.sql` applied, columns verified live):**
- `bookings` gained `pickup_reminder_sent_at`, `return_instructions_sent_at`, `midrental_checkin_sent_at` (TIMESTAMPTZ, NULL = not sent).
- All 3 scheduled email functions now filter `status='confirmed'`, skip test data (`test_*` ids, emails containing `test` or `@example.com`), skip already-stamped rows, and stamp after successful send. **Crons are NO LONGER pure date-arithmetic — sent-at stamps gate re-sends; PUT date-change clears them.**
- Migration is applied idempotently on EVERY deploy by a new GitHub Actions step using the Supabase Management API (`POST api.supabase.com/v1/projects/{ref}/database/query` with the repo secret `SUPABASE_ACCESS_TOKEN`). **This is the working path for running SQL — local CLI cannot (see below).**

**Phase C — Admin security hardening (verified live):**
- Plaintext passwords removed from source; SHA-256 hashes stored instead (`ADMIN_USERS` in admin/index.ts). NOTE: old plaintext still exists in git history (pre-d97d403); rotation deferred by plan.
- CORS `*` → `https://cjfuntimerentals.com` (verified via OPTIONS header).
- Per-IP login rate limit: 5 attempts / 15 min (in-memory, resets on cold start) → 429.
- `change-password` endpoint is in-memory only (lost on cold start) — documented in code, real fix deferred.

**Phase D — Stale pricing + dead code (verified live, zero stale strings on domain):**
- full-site.html + index.html + 6 landing pages: all `$30/hr`, `9-hour`, `$175/$160/$220/$200` references → current pricing ($35/hr 3hr-min, 10hr $180, 24hr $250). fleet.html `$200` lines are price-filter buckets — intentionally untouched.
- Deleted deprecated `supabase/functions/reminders/` + its config.toml block (cron unscheduled since 2026-06-29).

**Key infra discovery:** the local Supabase CLI is logged into a DIFFERENT account (only sees TPS/bruh-app projects) — this explains all historical CLI 403s on this project. There is no `rpc/exec` function in the DB (run-migration.mjs never worked). **Only working management credential = GitHub Actions secret `SUPABASE_ACCESS_TOKEN`.** DB SQL = Management API via workflow step.

**Deferred (explicitly, by approved plan):** password rotation + git-history purge, migration to Supabase Auth, timezone audit.

## Session 2026-07-09 (part 1): TJ Comp Booking Rescheduled + Issues Found

**Reschedule completed (approved by Leander):**
- Booking `comp_tj_jul10_2026` (Tavon Jackson, tjfire300@gmail.com, comp $0, automatic Slingshot) moved from 2026-07-10 → 2026-07-13 via PostgREST PATCH (start_date + end_date). All other fields unchanged (days=1, pickup_time 11:00).
- Verified: DB row updated, check-availability + public config show Jul 13 blocked / Jul 10 released.
- Email flows re-anchor automatically (at the time, crons were pure date-arithmetic with no sent-flags — NO LONGER TRUE, see part 2 dedup stamps): pickup reminder Jul 11 9AM, return instructions Jul 12 10AM, post-rental followup Jul 14 2PM.
- TJ had already received the Jul 10 pickup reminder (sent Jul 8). Date-change correction email sent via Resend (ID f7afb318-09e4-4a0d-968a-830fb5ecf7bb, BCC leandertoney@gmail.com) telling him to disregard Jul 10.
- Change executed 2026-07-09 ~00:50 ET, BEFORE the 10AM return-instructions cron — so no stray "return Jul 10" email fired.

**Production issues discovered — #1 and #2 RESOLVED in part 2 above:**
1. ~~Admin login returns 500 with correct credentials~~ → RESOLVED: was a curl/shell `!`-escaping artifact, never a server bug (see part 2).
2. ~~Admin booking-edit endpoint missing (PUT /bookings/:id → 404)~~ → RESOLVED: handler added with availability checks (see part 2).
3. **Supabase REST gateway flaky (2026-07-09 ~00:30-00:50 ET)**: same valid service-role key intermittently rejected with "Invalid API key" then accepted seconds later. Keys in .env are VALID — retry before assuming rotation.

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
3. `google-reviews`
4. `check-availability`

(`reminders` was DELETED 2026-07-09 — deprecated old pickup system, cron unscheduled 2026-06-29.)

## Known Issues & Technical Debt

1. **Hardcoded pricing in static HTML** — ✅ FIXED 2026-07-09 (Phase D): all stale strings corrected to current pricing and verified live. Values are still static text, so any future price change must repeat a grep for old values across full-site.html/index.html/pages/*. Long-term fix (dynamic config loading) remains open.

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
