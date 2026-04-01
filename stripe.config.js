/**
 * CJ's Fun Time Rental — Stripe Configuration
 *
 * HOW TO ACTIVATE:
 * 1. Log into your Stripe dashboard (dashboard.stripe.com)
 * 2. Copy your Publishable Key from Developers > API Keys
 * 3. Create a Product + Price for each vehicle in Stripe Products
 * 4. Create a Payment Link for each Price (or use Stripe Checkout)
 * 5. Paste everything below and set STRIPE_ENABLED = true
 *
 * Until STRIPE_ENABLED is true, "Book Now" buttons fall back to Facebook.
 */

var STRIPE_ENABLED = false;

// Your Stripe Publishable Key (starts with pk_live_ or pk_test_)
var STRIPE_PUBLISHABLE_KEY = 'pk_live_REPLACE_WITH_YOUR_KEY';

/**
 * Payment Links created in your Stripe Dashboard.
 * Go to: Stripe Dashboard > Payment Links > Create a link
 * One link per vehicle/price is simplest and requires no backend.
 *
 * Alternatively, use Price IDs (price_xxx) if you want to use
 * Stripe Checkout Sessions via a backend. See comments below.
 */
var STRIPE_PAYMENT_LINKS = {
  slingshot_2022: 'https://buy.stripe.com/REPLACE_2022_SLINGSHOT_LINK',
  slingshot_2020: 'https://buy.stripe.com/REPLACE_2020_SLINGSHOT_LINK',
  canam_spyder:   'https://buy.stripe.com/REPLACE_CANAM_SPYDER_LINK'
};

/**
 * Price IDs (optional — only needed if using Stripe Checkout Sessions
 * instead of Payment Links, which requires a small backend/serverless fn).
 *
 * var STRIPE_PRICE_IDS = {
 *   slingshot_2022: 'price_REPLACE_2022_SLINGSHOT_PRICE_ID',
 *   slingshot_2020: 'price_REPLACE_2020_SLINGSHOT_PRICE_ID',
 *   canam_spyder:   'price_REPLACE_CANAM_SPYDER_PRICE_ID'
 * };
 */
