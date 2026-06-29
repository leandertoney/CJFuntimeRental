# Prompt for Claude in Chrome Browser

Copy this entire prompt and paste it into Claude in your browser:

---

I need help setting up monitoring for my production website. Please guide me through these setups step-by-step:

## UptimeRobot Setup

I'm already logged into UptimeRobot at https://uptimerobot.com/dashboard

**First, set up the alert email:**
1. Navigate to My Settings > Alert Contacts
2. Add `support@universoleappstudios.com` as an email alert contact
3. Verify the email (I'll check the inbox for verification link)
4. Set it as the default alert contact

**Then create these 5 monitors:**

### Monitor 1: Main Site
- Monitor Type: HTTP(s)
- Friendly Name: `CJ Funtime - Main Site`
- URL: `https://cjfuntimerentals.com`
- Monitoring Interval: 5 minutes

### Monitor 2: Book Now Button
- Monitor Type: Keyword
- Friendly Name: `CJ Funtime - Book Now Button`
- URL: `https://cjfuntimerentals.com`
- Keyword: `Book Now`
- Keyword Type: Exists
- Monitoring Interval: 5 minutes

### Monitor 3: Slingshot Price
- Monitor Type: Keyword
- Friendly Name: `CJ Funtime - Slingshot Price`
- URL: `https://cjfuntimerentals.com`
- Keyword: `from $175`
- Keyword Type: Exists
- Monitoring Interval: 5 minutes

### Monitor 4: Checkout Endpoint
- Monitor Type: HTTP(s)
- Friendly Name: `CJ Funtime - Checkout`
- URL: `https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/checkout`
- Monitoring Interval: 5 minutes

### Monitor 5: Config Endpoint
- Monitor Type: HTTP(s)
- Friendly Name: `CJ Funtime - Config`
- URL: `https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/config`
- Monitoring Interval: 5 minutes

**After setup:**
- Send a test alert to verify `support@universoleappstudios.com` receives emails
- Confirm all 5 monitors are green and running

## Sentry Setup (Optional - only if I want error tracking)

If I decide to set up Sentry for error tracking on the Edge Functions:

1. Go to https://sentry.io/signup/ (or login if I already have an account)
2. Create a new project:
   - Platform: JavaScript
   - Project name: `CJ Funtime Rentals`
3. Copy the DSN (Data Source Name) - it looks like: `https://xxxxx@yyyyy.ingest.sentry.io/zzzzz`
4. Give me the DSN so Claude Code can add it to the Edge Functions

---

Please guide me through this process step-by-step, waiting for my confirmation after each major step.
