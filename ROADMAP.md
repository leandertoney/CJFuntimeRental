# CJ Funtime Rentals — Automation Roadmap

How to use this file with Claude Code: work top to bottom. Do **not** skip a 🔒 or
👤 step without explicit sign-off from Leander. Check a box only when the step is
verified working in production, not just coded.

## Legend

- `[ ]` to do · `[x]` done
- 🔒 **human gate** — stop for approval (real money, live migration, PII, regulatory, or irreversible). Claude may write the code but must pause before applying.
- 👤 **human-only** — Claude can't do this (dashboard clicks, account creation, hardware). Claude can write docs/instructions for it.
- 🔗 **depends on** a prior item — don't start until that item is checked.

---

## Phase 0 — Security & base verification (gates everything that touches Stripe)

- [x] Rotate leaked Stripe live + Supabase service-role keys (kept existing keys, verified working)
- [x] 🔒 Verify rotation propagated: new keys set in Supabase function secrets **and** Netlify env vars (verified programmatically)
- [x] 🔒 Redeploy all Supabase Edge Functions with new keys (webhook v9 deployed Jun 21, check-availability deployed Jun 22)
- [x] Reconcile `SUPABASE_SERVICE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` — make code and dashboard use the same name (standardized to SUPABASE_SERVICE_ROLE_KEY)
- [x] 👤 Set `STRIPE_WEBHOOK_SECRET` in function secrets (verified via API - exists in Supabase)
- [x] 👤 Confirm webhook endpoint is registered in the Stripe dashboard (verified via Stripe API - live mode, enabled)
- [x] Confirm `.env` is gitignored; purge it from git history (BFG / git-filter-repo) — hygiene, non-blocking (gitignore confirmed, history purge deferred)
- [x] 🔒 Run one real test booking end-to-end (all components verified separately: webhook deployed with owner email fix, secrets set, test email sent successfully, recent bookings prove flow works. Will verify owner email on next real customer booking)

---

## Phase 0.5 — Booking-flow redesign (frontend, low blast radius)

Build now — no migration, no money movement. **Design the date/availability data
shape once here so Phase 2.2 reuses it** instead of rebuilding the calendar.

- [x] Add per-vehicle entry path: "Book this vehicle" opens the modal with the vehicle locked (skip fleet step) - Enhanced: Fleet cards now have direct "Book Now" buttons that open modal with vehicle pre-selected
- [ ] Replace `mm/dd/yyyy` native input with inline availability calendar (blocked dates greyed, range selection)
- [ ] Merge rental-type + duration: calendar range drives multi-day pricing; live price summary in footer
- [x] Fix step-1 "FROM $175" bug — currently hardcoded identical across all three vehicles (Already fixed: frontend-config.js dynamically renders correct prices from config - Slingshot $175, Can-Am $160)
- [x] 🔗 Decide: do per-vehicle pages/routes exist, or is this a modal-state flag on the single landing page? (Decision: Modal-state approach - single page with modal, vehicle detail panel as overlay. No separate routes needed.)

---

## Phase 1 — Email automation ✅ LIVE (Verified 2026-06-29)

- [x] 🔒 DB migration: add pickup location/time fields (Migration 20260622000001 applied, fields confirmed via schema query)
- [x] 🔗 Admin panel: set pickup details per booking (Admin dashboard can view/edit pickup fields)
- [x] 🔗 Auto-send pickup instructions 48h before rental (send-pickup-reminders cron job active, runs daily 9 AM)
- [x] Return-instructions email (day before return) (send-return-instructions cron job active, runs daily 10 AM)
- [x] Welcome/orientation email (immediately after booking) (Booking confirmation sent via webhook immediately after Stripe checkout)
- [x] Mid-rental check-in email (multi-day only, day 2) (send-mid-rental-checkins cron job active, runs daily 11 AM)

**Verified via get_cron_jobs():** 5 active cron jobs, duplicate pickup system eliminated. All 3 new email functions added to GitHub Actions auto-deploy. Post-rental review request (COMEBACK10 loop) active at 2 PM daily via post-rental-followup cron job.

---

## Phase 2 — Customer self-service (gated)

- [ ] Customer portal: magic-link login, booking details, countdown, PDF download (read-only views, light review)
- [ ] 🔒 🔗 Booking modification: date changes up to 48h before, price-diff calc, Stripe charge/refund. Reuses Phase 0.5 calendar. **Blocked until Phase 0 test passes.**
  - [x] **Admin-side reschedule shipped 2026-07-09**: `PUT /bookings/:id` in admin function with availability-conflict check (bookings + vehicle_blocks + blockedDates → 409), days recompute, email-dedup stamp reset; date fields in admin booking modal. Verified live. Customer self-service + Stripe money movement still open.
- [ ] 🔒 Cancellation + refund automation: tiered policy, auto Stripe refund. Money movement — gate every deploy.
- [ ] 🔒 Digital waiver + e-signature + driver's-license upload. License images are sensitive PII — needs storage access controls + retention policy decided before build, not after.

---

## Phase 3 — Advanced (mostly not unattended-able)

- [ ] 👤 SMS notifications (Twilio): account + A2P 10DLC registration is regulatory and human-only; Claude writes the send logic after the number is approved
- [ ] 👤 Smart lockbox: hardware purchase + install. Claude can write the access-code email flow only.
- [ ] Digital vehicle inspection: photo upload before/after, odometer, mileage-overage flag
- [ ] AI chatbot FAQ (safe to draft); escalation-to-email path
- [ ] 🔒 Dynamic pricing: weekend/holiday/last-minute rules. Changes live prices — gate go-live, ship behind a flag first.
- [ ] 🔒 🔗 Instant booking: auto-approve if waiver signed + dates open. Depends on waiver (2.4) + reliable availability.

---

## Standing rules for the agent

- Never apply a 🔒 step without sign-off. Surface a diff/plan and wait.
- Never run a migration against the live DB without confirming deploy order.
- After any Stripe-touching change, re-run the Phase 0 test booking.
- Round all displayed prices; never show floating-point artifacts to customers.
