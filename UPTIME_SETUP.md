# UptimeRobot Setup Instructions

**Time needed:** 5 minutes
**Dashboard:** https://uptimerobot.com/dashboard

## Monitors to Create

Go to Dashboard > Add New Monitor for each of these:

### 1. Main Site Availability
- **Monitor Type:** HTTP(s)
- **Friendly Name:** CJ Funtime - Main Site
- **URL:** `https://cjfuntimerentals.com`
- **Monitoring Interval:** 5 minutes
- **Monitor Timeout:** 30 seconds
- Click "Create Monitor"

### 2. Book Now Button Check
- **Monitor Type:** Keyword
- **Friendly Name:** CJ Funtime - Book Now Button
- **URL:** `https://cjfuntimerentals.com`
- **Keyword:** `Book Now`
- **Keyword Type:** Exists
- **Monitoring Interval:** 5 minutes
- Click "Create Monitor"

### 3. Slingshot Price Check
- **Monitor Type:** Keyword
- **Friendly Name:** CJ Funtime - Slingshot Price
- **URL:** `https://cjfuntimerentals.com`
- **Keyword:** `from $175`
- **Keyword Type:** Exists
- **Monitoring Interval:** 5 minutes
- Click "Create Monitor"

### 4. Checkout Endpoint
- **Monitor Type:** HTTP(s)
- **Friendly Name:** CJ Funtime - Checkout
- **URL:** `https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/checkout`
- **Monitoring Interval:** 5 minutes
- Click "Create Monitor"

### 5. Config Endpoint (Pricing Data)
- **Monitor Type:** HTTP(s)
- **Friendly Name:** CJ Funtime - Config
- **URL:** `https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/config`
- **Monitoring Interval:** 5 minutes
- Click "Create Monitor"

## Email Alert Setup

1. Go to **My Settings** > **Alert Contacts**
2. Add `support@universoleappstudios.com` as an alert contact
3. Verify the email (check inbox for verification link)
4. Set it as the default alert contact
5. Test by clicking "Send Test Alert"

## What You'll Get

- Email alert within 5 minutes if any monitor goes down
- Email when it comes back up
- Dashboard showing uptime % for each monitor

## Next Steps

After you've added these 5 monitors manually (or let me know if you want me to build the self-hosted solution instead):
- I'll build the health-check endpoint for cron job monitoring
- I'll add Sentry error tracking to Edge Functions
